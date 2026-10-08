"""Execution plans via EXPLAIN (FORMAT JSON).

pg_stat_statements stores normalized statements with `$1` placeholders, so a
plan is obtained by PREPAREing the statement and EXPLAINing an EXECUTE with
dummy arguments. Two literal styles are tried (numeric, then text) because a
placeholder's type depends on context.

`EXPLAIN (FORMAT JSON)` is used without ANALYZE: it costs nothing to run and
still reveals the plan shape (Seq Scan vs Index Scan), which is what the
optimiser reasons about. Plans are therefore estimates only — `actualTimeMs`
and `actualRows` are absent and the UI renders them as "—".
"""

from __future__ import annotations

import re
from typing import Any

from . import db
from .collector import query_by_id

CONDITION_KEYS = [
    "Filter",
    "Index Cond",
    "Recheck Cond",
    "Hash Cond",
    "Merge Cond",
    "Join Filter",
    "Sort Key",
    "Group Key",
]

SEQ_SCAN_ROW_THRESHOLD = 10_000


def _explain(query_text: str) -> list[dict[str, Any]] | None:
    """PREPARE the statement and EXPLAIN an EXECUTE with dummy literals.

    Literals are inlined rather than bound as parameters: PostgreSQL cannot infer
    the type of a bind parameter inside `EXECUTE name(...)`.
    """
    parameter_count = max((int(m) for m in re.findall(r"\$(\d+)", query_text)), default=0)

    for literal in ("1", "'x'"):
        call = ""
        if parameter_count:
            call = "(" + ", ".join([literal] * parameter_count) + ")"
        try:
            db.execute("PREPARE agentdb_plan AS " + query_text)
            try:
                row = db.query_one("EXPLAIN (FORMAT JSON) EXECUTE agentdb_plan" + call)
            finally:
                db.execute("DEALLOCATE agentdb_plan")
            if row:
                value = next(iter(row.values()))
                if isinstance(value, list):
                    return value
        except Exception:
            continue
    return None


def _conditions(node: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for key in CONDITION_KEYS:
        value = node.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            out.append(f"{key}: {', '.join(str(v) for v in value)}")
        else:
            out.append(f"{key}: {value}")
    return out


def _build_node(node: dict[str, Any], path: str) -> dict[str, Any]:
    node_type = node.get("Node Type", "Unknown")
    estimated_rows = int(node.get("Plan Rows", 0) or 0)

    warnings: list[dict[str, Any]] = []
    if node_type == "Seq Scan" and estimated_rows >= SEQ_SCAN_ROW_THRESHOLD:
        warnings.append(
            {
                "severity": "HIGH" if estimated_rows >= 100_000 else "MEDIUM",
                "message": (
                    f"Sequential scan estimates {estimated_rows:,} rows. "
                    "A supporting index on the filtered column may remove this scan."
                ),
            }
        )

    children = [
        _build_node(child, f"{path}.{index}")
        for index, child in enumerate(node.get("Plans", []) or [])
    ]

    return {
        "id": path,
        "nodeType": node_type,
        "relation": node.get("Relation Name"),
        "alias": node.get("Alias"),
        "estimatedCost": float(node.get("Startup Cost", 0) or 0),
        "totalCost": float(node.get("Total Cost", 0) or 0),
        "actualTimeMs": node.get("Actual Total Time"),
        "estimatedRows": estimated_rows,
        "actualRows": node.get("Actual Rows"),
        "loops": int(node.get("Actual Loops", 1) or 1),
        "conditions": _conditions(node) or None,
        "rowsRemovedByFilter": node.get("Rows Removed by Filter"),
        "warnings": warnings or None,
        "children": children,
    }


def _collect_bottlenecks(node: dict[str, Any], path: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for warning in node.get("warnings") or []:
        found.append(
            {
                "nodeId": node["id"],
                "nodeType": node["nodeType"],
                "relation": node.get("relation"),
                "severity": warning["severity"],
                "message": warning["message"],
                "rowsExamined": node["estimatedRows"],
            }
        )
    for child in node["children"]:
        found.extend(_collect_bottlenecks(child, path))
    return found


def plan_for_query(query_id: str) -> dict[str, Any] | None:
    try:
        stat = query_by_id(query_id)
    except LookupError:
        return None

    raw = _explain(stat["query"])
    if not raw:
        return None

    root = _build_node(raw[0]["Plan"], "root")
    return {
        "queryId": stat["id"],
        "query": stat["query"],
        "planningTimeMs": float(raw[0].get("Planning Time", 0) or 0),
        "executionTimeMs": float(raw[0].get("Execution Time", 0) or 0),
        "totalCost": root["totalCost"],
        "bottlenecks": _collect_bottlenecks(root, "root"),
        "root": root,
        "source": "EXPLAIN_ANALYZE" if raw[0].get("Execution Time") else "SIMULATED",
    }
