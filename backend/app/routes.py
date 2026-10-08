"""HTTP API.

All routes are mounted under /api. Endpoint names and response shapes match the
TypeScript service contracts in `frontend/src/services/contracts.ts` exactly.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from . import advisor, benchmarks, collector, db, plans, runner

router = APIRouter(prefix="/api")


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- state

@router.get("/database/info")
def database_info():
    return collector.database_info()


@router.get("/state")
def state():
    return collector.database_state()


@router.get("/state/activity")
def state_activity():
    return collector.active_queries()


# ---------------------------------------------------------------- queries

@router.get("/queries")
def queries(
    search: str | None = None,
    severity: str | None = None,
    sort: str | None = None,
    direction: str = "desc",
    limit: int | None = None,
):
    return collector.queries(search, severity, sort, direction, limit)


@router.get("/queries/top")
def top_queries(limit: int = 8):
    return collector.queries(sort="totalExecTimeMs", direction="desc", limit=limit)


@router.get("/queries/{query_id}")
def query_detail(query_id: str):
    try:
        return collector.query_by_id(query_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/queries/{query_id}/trend")
def query_trend(query_id: str, limit: int = 24):
    return collector.query_trend(query_id, limit)


@router.post("/queries/{query_id}/analyze")
def analyze_query(query_id: str):
    """Rule-based analysis derived from the statement's own statistics and plan.

    No model is involved. Observations are computed from pg_stat_statements and
    the EXPLAIN output, which is what the Query/Planner Expert will consume.
    """
    try:
        stat = collector.query_by_id(query_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    plan = plans.plan_for_query(query_id)

    observations = [
        f"Executed {stat['calls']:,} times, consuming {stat['totalExecTimeMs'] / 1000:.1f}s of total execution time.",
        f"Mean execution time is {stat['meanExecTimeMs']:.2f} ms with a cache hit ratio of {stat['cacheHitRatio'] * 100:.1f}%.",
        f"Returned {stat['rows']:,} rows overall ({stat['rows'] / max(stat['calls'], 1):.1f} per call).",
    ]
    if stat["cacheHitRatio"] < 0.85:
        observations.append(
            f"Cache hit ratio is below 85% — {stat['sharedBlksRead']:,} blocks are being read from disk."
        )

    suspected = []
    for bottleneck in (plan or {}).get("bottlenecks", []):
        relation = f" on {bottleneck['relation']}" if bottleneck.get("relation") else ""
        suspected.append(
            {
                "title": f"{bottleneck['nodeType']}{relation}",
                "detail": bottleneck["message"],
                "severity": bottleneck["severity"],
            }
        )
    if not suspected:
        suspected.append(
            {
                "title": "No structural bottleneck detected",
                "detail": (
                    "The captured plan uses index access paths and reports no sequential scan "
                    "above the configured row threshold."
                ),
                "severity": "LOW",
            }
        )

    focus = []
    if stat["severity"] == "HIGH":
        focus.append("Prioritise this statement — it is in the highest latency band.")
    if any("Seq Scan" in item["title"] for item in suspected):
        focus.append("Evaluate a supporting index for the filtered columns.")
    if not focus:
        focus.append("No action required; continue monitoring for distribution drift.")

    return {
        "queryId": stat["queryId"],
        "status": "RULE_BASED",
        "generatedAt": _utc(),
        "summary": (
            f"{stat['label']} classified {stat['severity']} severity with a mean execution time "
            f"of {stat['meanExecTimeMs']:.2f} ms across {stat['calls']:,} calls."
        ),
        "observations": observations,
        "suspectedIssues": suspected,
        "planSummary": (
            f"Plan root is a {plan['root']['nodeType']} node with a total cost of "
            f"{plan['totalCost']:,.0f} and {len(plan['bottlenecks'])} flagged node(s)."
            if plan
            else "No plan could be produced for this statement."
        ),
        "suggestedFocus": focus,
    }


# ---------------------------------------------------------------- plans

@router.get("/plans/query-ids")
def planned_query_ids(limit: int = 10):
    """Only the busiest statements produce plans; EXPLAIN is not free."""
    return [q["id"] for q in collector.queries(sort="totalExecTimeMs", direction="desc", limit=limit)]


@router.get("/plans")
def all_plans(limit: int = 5):
    out = []
    for query_id in planned_query_ids(limit):
        plan = plans.plan_for_query(query_id)
        if plan:
            out.append(plan)
    return out


@router.get("/plans/{query_id}")
def plan_detail(query_id: str):
    return plans.plan_for_query(query_id)


# ---------------------------------------------------------------- schema

@router.get("/schema/tables")
def schema_tables():
    return collector.tables()


@router.get("/schema/tables/{name}")
def schema_table(name: str):
    try:
        return collector.table_by_name(name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/schema/indexes")
def schema_indexes():
    return collector.indexes()


@router.get("/schema/indexes/{name}")
def schema_index(name: str):
    try:
        return collector.index_by_name(name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/schema/configuration")
def schema_configuration():
    return collector.parameters()


@router.get("/schema/configuration/{name}")
def schema_parameter(name: str):
    try:
        return collector.parameter_by_name(name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------- activity

@router.get("/activity")
def activity(limit: int = 100, types: str | None = None):
    type_list = types.split(",") if types else None
    return collector.events(limit, type_list)


@router.get("/activity/recent")
def activity_recent(limit: int = 8):
    return collector.events(limit)


# ---------------------------------------------------------------- benchmarks

@router.get("/benchmarks")
def benchmark_experiments():
    return benchmarks.list_experiments()


@router.get("/benchmarks/runs")
def benchmark_runs():
    return sorted(runner.RUNS.values(), key=lambda r: r["queuedAt"], reverse=True)


@router.get("/benchmarks/runs/{run_id}")
def benchmark_run(run_id: str):
    run = runner.RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


@router.post("/benchmarks/runs")
def start_benchmark(payload: dict):
    try:
        return runner.start(
            workload=payload.get("workload", ""),
            duration=int(payload.get("durationSeconds", 60)),
            concurrency=int(payload.get("concurrency", 4)),
            mode=payload.get("mode", "run"),
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/benchmarks/{experiment_id}")
def benchmark_experiment(experiment_id: str):
    if experiment_id == "runs":
        return benchmark_runs()
    experiment = benchmarks.get_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return experiment


# ---------------------------------------------------------------- runner helpers

@router.get("/runner/status")
def runner_status():
    return {**runner.status(), "workloads": runner.available_workloads()}


@router.post("/runner/reset-statistics")
def reset_statistics():
    runner.reset_statistics()
    return {"ok": True}


@router.post("/runner/index")
def mutate_index(payload: dict):
    try:
        runner.reset_index(payload.get("name", ""), payload.get("action", ""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


# ---------------------------------------------------------------- optimizations
# Backed by the rule-based index advisor. Every proposal is derived from real
# pg_stat_user_tables counters and a real EXPLAIN plan. Nothing is executed:
# approving a proposal only records the decision.

@router.get("/optimizations/summary")
def optimization_summary():
    return advisor.summary()


@router.post("/optimizations/detect")
def optimization_detect():
    return advisor.detect()


@router.get("/optimizations")
def optimizations_all():
    return advisor.list_all()


@router.get("/optimizations/recommendations")
def optimizations_pending():
    return advisor.list_pending()


@router.get("/optimizations/history")
def optimizations_history():
    return advisor.history()


@router.get("/optimizations/history/{record_id}")
def optimization_record(record_id: str):
    record = advisor.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    return record


@router.get("/optimizations/{optimization_id}")
def optimization_detail(optimization_id: str):
    optimization = advisor.get(optimization_id)
    if not optimization:
        raise HTTPException(status_code=404, detail=f"Optimization {optimization_id} not found")
    return optimization


@router.post("/optimizations/{optimization_id}/approve")
def optimization_approve(optimization_id: str, payload: dict | None = None):
    payload = payload or {}
    try:
        return advisor.approve(
            optimization_id,
            reviewer=payload.get("reviewer") or "operator",
            note=payload.get("note"),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/optimizations/{optimization_id}/reject")
def optimization_reject(optimization_id: str, payload: dict | None = None):
    payload = payload or {}
    try:
        return advisor.reject(
            optimization_id,
            reason=payload.get("reason") or "Rejected by operator",
            reviewer=payload.get("reviewer") or "operator",
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/optimizations/history/{record_id}/validate")
def optimization_validate(record_id: str):
    record = advisor.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    raise HTTPException(
        status_code=501,
        detail="Validation compares a before/after measurement and is not implemented yet.",
    )


# ---------------------------------------------------------------- health

@router.get("/health")
def health():
    ok = db.healthy()
    return {"status": "ok" if ok else "degraded", "database": ok, "time": _utc()}
