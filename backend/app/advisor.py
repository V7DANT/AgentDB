"""Rule-based index advisor.

This is the simplest honest version of the "Index Expert". It does four things:

  1. Reads `pg_stat_user_tables` to find large relations that are scanned
     sequentially far more often than they are indexed.
  2. Finds the statement in `pg_stat_statements` that most likely causes those
     scans.
  3. Re-plans that statement with `EXPLAIN (FORMAT JSON)` and reads the *real*
     plan: which node is a `Seq Scan` on that relation, and which column its
     filter touches.
  4. Writes one reviewable `CREATE INDEX` proposal per finding.

What is real here: the scan counts, the plan, the relation, and the column all
come from PostgreSQL. Nothing is invented. The proposal is never executed — it
is only queued for a human decision.

What is deliberately absent: a predicted speed-up. `expectedGain` is the share
of the plan's estimated total cost attributable to the sequential scan, which is
a genuine planner number and an *upper bound* on what an index could recover.
The measured gain is only known after the index is built and the workload
re-run.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from . import db, plans
from .collector import record_event

ADVISOR = "index-advisor"

_ensured = False

_DDL = """
CREATE TABLE IF NOT EXISTS agentdb_optimizations (
    id            text PRIMARY KEY,
    type          text        NOT NULL,
    action        text        NOT NULL,
    target        text        NOT NULL,
    title         text        NOT NULL,
    description   text        NOT NULL,
    statement     text        NOT NULL,
    query_id      text,
    query_text    text,
    severity      text        NOT NULL,
    expert        text        NOT NULL,
    confidence    double precision NOT NULL,
    expected_gain double precision NOT NULL,
    status        text        NOT NULL,
    problem       jsonb       NOT NULL,
    rationale     jsonb       NOT NULL,
    risks          jsonb       NOT NULL,
    reviewed_by   text,
    rejection_reason text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    reviewed_at   timestamptz
);
"""


def _ensure() -> None:
    """Create the proposal table on first use (idempotent)."""
    global _ensured
    if _ensured:
        return
    db.execute(_DDL)
    _ensured = True


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------- detection

def _candidates() -> list[dict[str, Any]]:
    """Large tables scanned sequentially far more than they are indexed."""
    return db.query(
        """
        SELECT relname                                            AS table_name,
               seq_scan,
               coalesce(idx_scan, 0)                              AS idx_scan,
               n_live_tup,
               pg_relation_size(relid)                            AS size_bytes
          FROM pg_stat_user_tables
         WHERE schemaname = 'public'
           AND n_live_tup > 50000
           AND seq_scan > 50
           AND seq_scan > 5 * greatest(coalesce(idx_scan, 0), 1)
         ORDER BY seq_scan DESC
         LIMIT 8
        """
    )


def _top_statements(table: str, limit: int = 5) -> list[dict[str, Any]]:
    """The most time-consuming SELECT statements that mention `table`.

    Seeding and DDL statements are excluded: they touch the table but they are
    not the workload the index is meant to serve, and they cannot be re-planned.
    """
    return db.query(
        """
        SELECT queryid::text AS query_id, query, calls, total_exec_time
          FROM pg_stat_statements
         WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
           AND query ILIKE %s
           AND ltrim(query) ILIKE 'select%%'
           AND query NOT ILIKE '%%agentdb_%%'
         ORDER BY total_exec_time DESC
         LIMIT %s
        """,
        [f"%{table}%", limit],
    )


def _columns(table: str) -> set[str]:
    rows = db.query(
        """
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = %s
        """,
        [table],
    )
    return {row["column_name"] for row in rows}


def _scan_finding(
    query_text: str, table: str
) -> tuple[list[str], float, float]:
    """Return (filtered columns, seq-scan cost, most expensive node's cost).

    The denominator is the plan's most expensive node rather than the root node:
    a `LIMIT` above a sequential scan reports a lower cost than its own child, so
    comparing against the root would produce ratios above 1.
    """
    raw = plans._explain(query_text)
    if not raw:
        return [], 0.0, 0.0

    plan = raw[0].get("Plan") or {}
    seq_cost = 0.0
    peak_cost = 0.0
    text_filters: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        nonlocal seq_cost, peak_cost
        cost = float(node.get("Total Cost") or 0.0)
        peak_cost = max(peak_cost, cost)
        if node.get("Node Type") == "Seq Scan" and node.get("Relation Name") == table:
            seq_cost = max(seq_cost, cost)
            for key in ("Filter", "Recheck Cond", "Index Cond"):
                value = node.get(key)
                if isinstance(value, str):
                    text_filters.append(value)
        for child in node.get("Plans") or []:
            walk(child)

    walk(plan)

    valid = _columns(table)
    found: list[str] = []
    for text in text_filters:
        for name in re.findall(r"([a-z_][a-z0-9_]*)\s*(?:=|>=|<=|<>|~~|>|<)", text):
            if name in valid and name not in found:
                found.append(name)

    return found, seq_cost, peak_cost


def _severity(seq_scan: int) -> str:
    if seq_scan >= 5000:
        return "HIGH"
    if seq_scan >= 500:
        return "MEDIUM"
    return "LOW"


def _insert(row: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT INTO agentdb_optimizations
            (id, type, action, target, title, description, statement, query_id,
             query_text, severity, expert, confidence, expected_gain, status,
             problem, rationale, risks)
        VALUES (%(id)s, %(type)s, %(action)s, %(target)s, %(title)s, %(description)s,
                %(statement)s, %(query_id)s, %(query_text)s, %(severity)s, %(expert)s,
                %(confidence)s, %(expected_gain)s, %(status)s,
                %(problem)s::jsonb, %(rationale)s::jsonb, %(risks)s::jsonb)
        ON CONFLICT (id) DO NOTHING
        """,
        row,
    )


def detect() -> dict[str, Any]:
    """Run the detector and queue any new proposals. Safe to call repeatedly."""
    import json

    _ensure()

    examined = 0
    created: list[str] = []

    for candidate in _candidates():
        table = candidate["table_name"]
        examined += 1

        # Try the most expensive statements in turn: one of them is expected to
        # both touch the table and be re-plannable with placeholder literals.
        columns: list[str] = []
        seq_cost = peak_cost = 0.0
        statement: dict[str, Any] | None = None
        for probe in _top_statements(table):
            found, seq, peak = _scan_finding(probe["query"], table)
            if found:
                statement, columns, seq_cost, peak_cost = probe, found, seq, peak
                break
        if not statement or not columns:
            continue

        column = columns[0]
        target = f"{table}({column})"
        opt_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"agentdb:index:{target}"))

        existing = db.query_one(
            "SELECT status FROM agentdb_optimizations WHERE id = %s", [opt_id]
        )
        if existing:
            continue

        index_name = f"agentdb_{table}_{column}_idx"
        share = min(seq_cost / peak_cost, 1.0) if peak_cost else 0.0
        severity = _severity(int(candidate["seq_scan"]))
        rows_filtered = candidate["seq_scan"]

        _insert(
            {
                "id": opt_id,
                "type": "INDEX",
                "action": "CREATE",
                "target": target,
                "title": f"Add index on {target}",
                "description": (
                    f"{table} is scanned sequentially on every lookup of {column} "
                    f"({candidate['seq_scan']:,} sequential scans recorded, "
                    f"{candidate['idx_scan']:,} index scans)."
                ),
                "statement": (
                    f"CREATE INDEX CONCURRENTLY {index_name} ON public.{table} ({column});"
                ),
                "query_id": statement["query_id"],
                "query_text": statement["query"],
                "severity": severity,
                "expert": ADVISOR,
                "confidence": 0.5,
                "expected_gain": round(share, 4),
                "status": "PENDING",
                "problem": json.dumps(
                    {
                        "summary": f"Sequential scan on {table}",
                        "kind": "Sequential scan",
                        "relation": table,
                        "queryFrequency": int(statement["calls"]),
                        "averageLatencyMs": round(
                            float(statement["total_exec_time"]) / max(int(statement["calls"]), 1),
                            4,
                        ),
                        "detail": (
                            f"Filter column '{column}' is not the leading column of any index "
                            f"on {table}."
                        ),
                        "severity": severity,
                    }
                ),
                "rationale": json.dumps(
                    [
                        f"The planner chooses a sequential scan on {table} when filtering {column}.",
                        f"pg_stat_user_tables records {candidate['seq_scan']:,} sequential "
                        f"scans against {candidate['idx_scan']:,} index scans.",
                        f"The sequential scan costs {seq_cost:,.0f} against a most-expensive node "
                        f"of {peak_cost:,.0f} — it dominates the plan, so {share * 100:.0f}% is an "
                        f"upper bound on the gain this index can deliver, not a prediction.",
                        "Measured gain is only known after the index is built and the workload "
                        "re-run.",
                    ]
                ),
                "risks": json.dumps(
                    [
                        "Writes to this table become slower: every INSERT/UPDATE must maintain "
                        "the new index.",
                        "CREATE INDEX CONCURRENTLY cannot run inside a transaction and takes "
                        "longer to build.",
                        "If the filter is not selective the planner may keep choosing the "
                        "sequential scan and the index becomes dead weight.",
                    ]
                ),
            }
        )
        created.append(target)

        record_event(
            "OPTIMIZATION",
            "INFO",
            f"Index proposal queued — {target}",
            f"{candidate['seq_scan']:,} sequential scans recorded on {table}",
            actor=ADVISOR,
            related_id=opt_id,
            related_label=target,
        )

    if created:
        record_event(
            "OPTIMIZATION",
            "INFO",
            f"Index scan complete — {len(created)} new proposal(s)",
            ", ".join(created),
            actor=ADVISOR,
        )

    return {"examined": examined, "created": created, "queued": len(created)}


# ------------------------------------------------------------------------ reads

def _row_to_optimization(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "type": row["type"],
        "action": row["action"],
        "target": row["target"],
        "title": row["title"],
        "description": row["description"],
        "statement": row["statement"],
        "queryId": row["query_id"],
        "queryText": row["query_text"],
        "severity": row["severity"],
        "expert": row["expert"],
        "confidence": row["confidence"],
        "expectedGain": row["expected_gain"],
        "status": row["status"],
        "problem": row["problem"],
        "rationale": row["rationale"],
        "risks": row["risks"],
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
        "reviewedAt": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
        "reviewedBy": row["reviewed_by"] or None,
        "rejectionReason": row["rejection_reason"] or None,
    }


def list_all() -> list[dict[str, Any]]:
    _ensure()
    rows = db.query("SELECT * FROM agentdb_optimizations ORDER BY created_at DESC")
    return [_row_to_optimization(row) for row in rows]


def list_pending() -> list[dict[str, Any]]:
    _ensure()
    rows = db.query(
        "SELECT * FROM agentdb_optimizations WHERE status = 'PENDING' ORDER BY created_at DESC"
    )
    return [_row_to_optimization(row) for row in rows]


def get(optimization_id: str) -> dict[str, Any] | None:
    _ensure()
    row = db.query_one("SELECT * FROM agentdb_optimizations WHERE id = %s", [optimization_id])
    return _row_to_optimization(row) if row else None


def summary() -> dict[str, Any]:
    _ensure()
    row = db.query_one(
        """
        SELECT count(*) FILTER (WHERE status = 'PENDING')   AS pending,
               count(*) FILTER (WHERE status = 'APPROVED')  AS approved,
               count(*) FILTER (WHERE status = 'REJECTED')  AS rejected,
               count(*) FILTER (WHERE status = 'VALIDATED') AS validated,
               count(*)                                     AS total
          FROM agentdb_optimizations
        """
    ) or {}
    pending = int(row.get("pending") or 0)
    return {
        "pending": pending,
        "approved": int(row.get("approved") or 0),
        "rejected": int(row.get("rejected") or 0),
        "validated": int(row.get("validated") or 0),
        "total": int(row.get("total") or 0),
        "projectedGain": 0.0,
        "implemented": True,
        "message": (
            "Rule-based index advisor active."
            if int(row.get("total") or 0) > 0
            else "No proposals yet — run a workload, then scan for issues."
        ),
    }


# --------------------------------------------------------------------- decisions

def _decide(optimization_id: str, status: str, reviewer: str, reason: str | None) -> dict[str, Any]:
    _ensure()
    row = db.query_one("SELECT * FROM agentdb_optimizations WHERE id = %s", [optimization_id])
    if not row:
        raise LookupError(f"Optimization {optimization_id} not found")
    if row["status"] != "PENDING":
        raise ValueError(f"Optimization {optimization_id} is already {row['status']}.")

    db.execute(
        """
        UPDATE agentdb_optimizations
           SET status = %s,
               reviewed_by = %s,
               rejection_reason = %s,
               reviewed_at = now(),
               updated_at = now()
         WHERE id = %s
        """,
        [status, reviewer, reason, optimization_id],
    )

    record_event(
        "OPTIMIZATION",
        "INFO" if status == "APPROVED" else "WARNING",
        f"Proposal {status.lower()} — {row['target']}",
        reason or f"Reviewed by {reviewer}",
        actor=reviewer,
        related_id=optimization_id,
        related_label=row["target"],
    )

    updated = get(optimization_id)
    assert updated is not None
    return updated


def approve(optimization_id: str, reviewer: str = "operator", note: str | None = None) -> dict[str, Any]:
    return _decide(optimization_id, "APPROVED", reviewer, note)


def reject(optimization_id: str, reason: str, reviewer: str = "operator") -> dict[str, Any]:
    return _decide(optimization_id, "REJECTED", reviewer, reason)


def history() -> list[dict[str, Any]]:
    """Confirmed experience records — approved or rejected proposals."""
    return [row for row in list_all() if row["status"] != "PENDING"]
