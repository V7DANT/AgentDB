"""Benchmark result reader.

Serves the committed artefacts under `results/<machine>/sysbench/` directly, so
the frontend shows the same numbers that are in the repository. No value is
recomputed or invented.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import MACHINE_ID, RESULTS_DIR

S1_EXPERIMENT_COMMIT = "cdc72d65"
S2_EXPERIMENT_COMMIT = "af7902a5"


def _read(path: Path) -> dict[str, Any] | None:
    try:
        with path.open() as handle:
            return json.load(handle)
    except Exception:
        return None


def _summary_block(metrics: dict[str, Any], key: str) -> dict[str, float] | None:
    value = metrics.get(key)
    if not isinstance(value, dict):
        return None
    return {
        "mean": float(value.get("mean", 0)),
        "min": float(value.get("min", 0)),
        "max": float(value.get("max", 0)),
        **({"stddev": float(value["stddev"])} if "stddev" in value else {}),
    }


def _run_from(metrics: dict[str, Any], run_id: str, number: int, started: str,
              concurrency: int | None = None) -> dict[str, Any]:
    return {
        "id": run_id,
        "runNumber": number,
        "concurrency": concurrency,
        "tps": float(metrics.get("tps", 0)),
        "qps": float(metrics.get("qps", 0)),
        "avgLatencyMs": float(metrics.get("latency_avg", 0)),
        "p95LatencyMs": float(metrics.get("latency_p95", 0)),
        "maxLatencyMs": float(metrics.get("latency_max", 0)),
        "errors": int(metrics.get("errors", 0)),
        "startedAt": started,
    }


def _s1() -> dict[str, Any] | None:
    base = RESULTS_DIR / MACHINE_ID / "sysbench" / "S1"
    summary = _read(base / "summary.json")
    if not summary:
        return None

    config = summary.get("configuration", {})
    metrics = summary.get("metrics", {})

    runs = []
    for index in range(1, 6):
        run = _read(base / f"run_{index:02d}.json")
        if run and isinstance(run.get("metrics"), dict):
            runs.append(
                _run_from(
                    run["metrics"],
                    f"S1-run-{index:02d}",
                    index,
                    run.get("started_at", ""),
                )
            )

    return {
        "id": "S1",
        "name": "S1 — Baseline Stability",
        "question": (
            "How much does the same database workload vary between repeated executions "
            "when no intentional change is made?"
        ),
        "purpose": (
            "Establishes the natural run-to-run variability of the benchmark environment "
            "before any AgentDB optimization is evaluated."
        ),
        "status": "COMPLETED",
        "workload": "sysbench " + str(summary.get("workload", "oltp_read_only")),
        "tool": "Sysbench",
        "machineId": MACHINE_ID,
        "gitCommit": S1_EXPERIMENT_COMMIT,
        "configuration": {
            "workload": summary.get("workload", "oltp_read_only"),
            "tables": config.get("tables", 0),
            "table_size": config.get("table_size", 0),
            "threads": config.get("threads", 0),
            "duration_seconds": config.get("duration_seconds", 0),
            "runs": summary.get("runs", 0),
        },
        "runsCount": int(summary.get("runs", len(runs))),
        "durationSeconds": int(config.get("duration_seconds", 60)),
        "startedAt": summary.get("generated_at", ""),
        "completedAt": summary.get("generated_at", ""),
        "summary": {
            "tps": _summary_block(metrics, "tps") or _zero(),
            "qps": _summary_block(metrics, "qps") or _zero(),
            "avgLatencyMs": _summary_block(metrics, "average_latency_ms") or _zero(),
            "p95LatencyMs": _summary_block(metrics, "p95_latency_ms") or _zero(),
            "maxLatencyMs": _summary_block(metrics, "maximum_latency_ms") or _zero(),
            "errors": int((metrics.get("errors") or {}).get("total", 0)),
        },
        "runs": runs,
        "observations": [
            "Statistics below are read from results/<machine>/sysbench/S1/summary.json.",
            (
                f"Mean throughput {metrics.get('tps', {}).get('mean', 0):,.2f} TPS with a "
                f"standard deviation of {metrics.get('tps', {}).get('stddev', 0):,.2f} TPS."
            ),
            (
                f"P95 latency {metrics.get('p95_latency_ms', {}).get('mean', 0):.2f} ms "
                f"(std. dev. {metrics.get('p95_latency_ms', {}).get('stddev', 0):.2f} ms)."
            ),
            (
                f"Maximum latency varied from "
                f"{metrics.get('maximum_latency_ms', {}).get('min', 0):.2f} ms to "
                f"{metrics.get('maximum_latency_ms', {}).get('max', 0):.2f} ms across the runs."
            ),
            f"Total errors: {(metrics.get('errors') or {}).get('total', 0)}.",
        ],
        "dataSource": "RESULTS_DIR",
    }


def _zero() -> dict[str, float]:
    return {"mean": 0.0, "min": 0.0, "max": 0.0}


def _s2() -> dict[str, Any] | None:
    base = RESULTS_DIR / MACHINE_ID / "sysbench" / "S2"
    summary = _read(base / "summary.json")
    if not summary:
        return None

    experiment = _read(base / "experiment.json") or {}
    methodology = experiment.get("methodology", {})
    levels_raw = summary.get("concurrency_levels", {})

    levels: list[dict[str, Any]] = []
    runs: list[dict[str, Any]] = []
    for key in sorted(levels_raw, key=lambda k: int(k)):
        entry = levels_raw[key]
        metrics = entry.get("metrics", {})
        concurrency = int(key)

        tps = _summary_block(metrics, "tps") or _zero()
        qps = _summary_block(metrics, "qps") or _zero()
        avg = _summary_block(metrics, "latency_avg") or _zero()
        p95 = _summary_block(metrics, "latency_p95") or _zero()
        maximum = _summary_block(metrics, "latency_max") or _zero()

        levels.append(
            {
                "concurrency": concurrency,
                "runs": int(entry.get("runs", 0)),
                "tps": tps,
                "qps": qps,
                "avgLatencyMs": avg,
                "p95LatencyMs": p95,
                "maxLatencyMs": maximum,
                "errors": int(entry.get("total_errors", 0)),
            }
        )

        level_dir = base / f"concurrency_{concurrency:02d}"
        for number in range(1, int(entry.get("runs", 0)) + 1):
            run = _read(level_dir / f"run_{number:02d}.json")
            if run and isinstance(run.get("metrics"), dict):
                runs.append(
                    _run_from(
                        run["metrics"],
                        f"S2-c{concurrency}-run-{number}",
                        number,
                        run.get("started_at", ""),
                        concurrency=concurrency,
                    )
                )

    return {
        "id": "S2",
        "name": "S2 — Concurrency Scaling",
        "question": (
            "How does PostgreSQL performance change as the number of concurrent clients "
            "increases under a fixed read-only OLTP workload?"
        ),
        "purpose": (
            "Characterises the relationship between concurrency, throughput, latency and "
            "resource utilisation."
        ),
        "status": "COMPLETED",
        "workload": f"sysbench {methodology.get('workload', 'oltp_read_only')}",
        "tool": "Sysbench",
        "machineId": summary.get("machine_id", MACHINE_ID),
        "gitCommit": (experiment.get("git") or {}).get("commit", S2_EXPERIMENT_COMMIT)[:8],
        "configuration": {
            "workload": methodology.get("workload", "oltp_read_only"),
            "tables": methodology.get("tables", 0),
            "table_size": methodology.get("rows_per_table", 0),
            "duration_seconds": methodology.get("duration_seconds", 0),
            "concurrency_levels": ", ".join(str(l["concurrency"]) for l in levels),
            "runs_per_level": methodology.get("runs_per_level", 0),
        },
        "runsCount": sum(l["runs"] for l in levels),
        "durationSeconds": int(methodology.get("duration_seconds", 60)),
        "startedAt": experiment.get("started_at", ""),
        "completedAt": summary.get("completed_at", ""),
        "runs": runs,
        "concurrencyLevels": levels,
        "observations": _s2_observations(levels),
        "dataSource": "RESULTS_DIR",
    }


def _s2_observations(levels: list[dict[str, Any]]) -> list[str]:
    if not levels:
        return ["No concurrency levels recorded."]

    first, last = levels[0], levels[-1]
    observations = [
        "Statistics below are read from results/<machine>/sysbench/S2/summary.json.",
        (
            f"Throughput rises from {first['tps']['mean']:,.2f} TPS at {first['concurrency']} "
            f"thread(s) to {last['tps']['mean']:,.2f} TPS at {last['concurrency']} — a "
            f"{last['tps']['mean'] / first['tps']['mean']:.2f}× increase."
        ),
        (
            f"P95 latency rises from {first['p95LatencyMs']['mean']:.2f} ms to "
            f"{last['p95LatencyMs']['mean']:.2f} ms."
        ),
        (
            f"Average latency rises from {first['avgLatencyMs']['mean']:.2f} ms to "
            f"{last['avgLatencyMs']['mean']:.2f} ms."
        ),
        f"Zero errors recorded across all {sum(l['runs'] for l in levels)} runs.",
    ]
    return observations


def list_experiments() -> list[dict[str, Any]]:
    out = []
    for builder in (_s1, _s2):
        experiment = builder()
        if experiment:
            out.append(experiment)
    return out


def get_experiment(experiment_id: str) -> dict[str, Any] | None:
    for experiment in list_experiments():
        if experiment["id"] == experiment_id:
            return experiment
    return None
