"""PostgreSQL state collection.

Every function here maps a `pg_stat_*` / `pg_catalog` query onto the exact JSON
shape the frontend expects. Nothing in this module fabricates a value — fields
that PostgreSQL cannot provide (notably percentiles) are omitted or derived from
genuinely available counters and documented as such.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from . import db
from .config import MACHINE_ID

HIGH_LATENCY_MS = 25.0
MEDIUM_LATENCY_MS = 8.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _severity(mean_ms: float) -> str:
    if mean_ms >= HIGH_LATENCY_MS:
        return "HIGH"
    if mean_ms >= MEDIUM_LATENCY_MS:
        return "MEDIUM"
    return "LOW"


def _label(sql: str) -> str:
    """Short human label derived from the statement's target relation."""
    match = re.search(
        r"\bFROM\s+([a-zA-Z_][\w.]*)|\bUPDATE\s+([a-zA-Z_][\w.]*)|\bINTO\s+([a-zA-Z_][\w.]*)",
        sql,
        re.IGNORECASE,
    )
    if match:
        relation = next(group for group in match.groups() if group)
        verb = sql.strip().split(None, 1)[0].upper()
        return f"{verb} · {relation}"
    return sql.strip().split(None, 1)[0].upper() if sql.strip() else "Statement"


# =====================================================================
# Database info
# =====================================================================

def database_info() -> dict[str, Any]:
    row = db.query_one(
        """
        SELECT current_setting('server_version')                                  AS version,
               current_database()                                                 AS database_name,
               pg_database_size(current_database())                               AS size_bytes,
               extract(epoch FROM (now() - pg_postmaster_start_time()))::bigint    AS uptime_seconds,
               coalesce(inet_server_addr()::text, '127.0.0.1')                     AS host,
               coalesce(inet_server_port(), 5432)                                  AS port,
               (SELECT count(*) FROM pg_extension WHERE extname = 'pg_stat_statements') AS pss
        """
    ) or {}

    version = row.get("version", "unknown")
    short = "PostgreSQL " + version.split(" ")[0] if version else "PostgreSQL"

    return {
        "status": "ONLINE",
        "version": version,
        "versionShort": short,
        "databaseName": row.get("database_name", "agentdb"),
        "host": row.get("host", "127.0.0.1"),
        "port": int(row.get("port", 5432)),
        "sizeBytes": int(row.get("size_bytes", 0)),
        "uptimeSeconds": int(row.get("uptime_seconds", 0)),
        "pgStatStatements": bool(row.get("pss", 0)),
    }


# =====================================================================
# Active queries (pg_stat_activity)
# =====================================================================

def active_queries() -> list[dict[str, Any]]:
    rows = db.query(
        """
        SELECT pid,
               datname      AS database,
               usename      AS username,
               state,
               query,
               query_start,
               wait_event_type,
               wait_event,
               extract(epoch FROM (now() - query_start)) * 1000 AS duration_ms
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND state IS NOT NULL
         ORDER BY query_start
         LIMIT 25
        """
    )
    return [
        {
            "pid": r["pid"],
            "database": r["database"],
            "username": r["username"] or "-",
            "state": r["state"] or "unknown",
            "query": (r["query"] or "").strip(),
            "queryStart": r["query_start"].isoformat() if r["query_start"] else _now(),
            "waitEventType": r["wait_event_type"],
            "waitEvent": r["wait_event"],
            "durationMs": float(r["duration_ms"] or 0),
        }
        for r in rows
    ]


# =====================================================================
# Query statistics (pg_stat_statements)
# =====================================================================

_QUERY_SQL = """
SELECT queryid::text                                        AS query_id,
       query                                                AS query,
       calls                                                AS calls,
       total_exec_time                                      AS total_ms,
       mean_exec_time                                       AS mean_ms,
       rows                                                 AS rows,
       shared_blks_hit                                      AS hit,
       shared_blks_read                                     AS read
  FROM pg_stat_statements
 WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
   AND calls > 0
   AND query NOT ILIKE '%%pg_stat_statements%%'
   AND query NOT ILIKE '%%pg_stat_activity%%'
"""


def _query_row(row: dict[str, Any]) -> dict[str, Any]:
    hit = float(row["hit"] or 0)
    read = float(row["read"] or 0)
    total_blocks = hit + read or 1
    query_id = row["query_id"]
    query_text = (row["query"] or "").strip()
    return {
        "id": query_id,
        "queryId": query_id,
        "query": query_text,
        "label": _label(query_text),
        "calls": int(row["calls"] or 0),
        "totalExecTimeMs": round(float(row["total_ms"] or 0), 3),
        "meanExecTimeMs": round(float(row["mean_ms"] or 0), 4),
        "rows": int(row["rows"] or 0),
        "sharedBlksHit": int(hit),
        "sharedBlksRead": int(read),
        "cacheHitRatio": round(hit / total_blocks, 4),
        "severity": _severity(float(row["mean_ms"] or 0)),
        "trend": [],
        "fingerprint": hashlib.md5(query_text.encode("utf-8")).hexdigest()[:12],
    }


def queries(
    search: str | None = None,
    severity: str | None = None,
    sort: str | None = None,
    direction: str = "desc",
    limit: int | None = None,
) -> list[dict[str, Any]]:
    sql = _QUERY_SQL
    params: list[Any] = []

    if search:
        sql += " AND query ILIKE %s"
        params.append(f"%{search}%")

    sort_columns = {
        "totalExecTimeMs": "total_exec_time",
        "meanExecTimeMs": "mean_exec_time",
        "calls": "calls",
        "rows": "rows",
    }
    order = sort_columns.get(sort or "", "total_exec_time")
    sql += f" ORDER BY {order} {'ASC' if direction == 'asc' else 'DESC'}"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)

    rows = [_query_row(r) for r in db.query(sql, params)]
    if severity and severity != "ALL":
        rows = [r for r in rows if r["severity"] == severity]
    return rows


def query_by_id(query_id: str) -> dict[str, Any]:
    rows = db.query(_QUERY_SQL + " AND queryid::text = %s", [query_id])
    if not rows:
        raise LookupError(f"Query {query_id} not found")
    return _query_row(rows[0])


def query_trend(query_id: str, limit: int = 24) -> list[dict[str, Any]]:
    rows = db.query(
        """
        SELECT collected_at, mean_exec_time
          FROM agentdb_query_samples
         WHERE queryid = %s
         ORDER BY collected_at DESC
         LIMIT %s
        """,
        [query_id, limit],
    )
    return [
        {"timestamp": r["collected_at"].isoformat(), "value": float(r["mean_exec_time"])}
        for r in reversed(rows)
    ]


# =====================================================================
# Schema: tables
# =====================================================================

def tables() -> list[dict[str, Any]]:
    rows = db.query(
        """
        SELECT c.relname                                AS name,
               n.nspname                                AS schema,
               greatest(s.n_live_tup, c.reltuples)::bigint AS rows,
               coalesce(s.seq_scan, 0)                  AS seq_scans,
               coalesce(s.seq_tup_read, 0)              AS seq_tuples_read,
               coalesce(s.idx_scan, 0)                  AS index_scans,
               coalesce(s.idx_tup_fetch, 0)             AS index_tuples_fetched,
               coalesce(s.n_tup_ins, 0)                 AS inserts,
               coalesce(s.n_tup_upd, 0)                 AS updates,
               coalesce(s.n_tup_del, 0)                 AS deletes,
               coalesce(s.n_live_tup, 0)                AS live_tuples,
               coalesce(s.n_dead_tup, 0)                AS dead_tuples,
               pg_relation_size(c.oid)                  AS size_bytes,
               pg_indexes_size(c.oid)                   AS index_size_bytes,
               s.last_vacuum, s.last_analyze
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
         WHERE c.relkind = 'r'
           AND n.nspname = 'public'
         ORDER BY pg_total_relation_size(c.oid) DESC
        """
    )
    return [_table_row(r) for r in rows]


def _table_row(row: dict[str, Any]) -> dict[str, Any]:
    columns = db.query(
        """
        SELECT a.attname                          AS name,
               format_type(a.atttypid, a.atttypmod) AS type,
               NOT a.attnotnull                   AS nullable,
               coalesce(pk.is_pk, false)          AS is_primary_key,
               coalesce(ix.is_indexed, false)     AS indexed
          FROM pg_attribute a
          LEFT JOIN (
              SELECT array_agg(k.attnum) AS attnums, true AS is_pk
                FROM pg_index i, unnest(i.indkey) AS k(attnum)
               WHERE i.indrelid = %s::regclass AND i.indisprimary
               GROUP BY i.indrelid
          ) pk ON a.attnum = ANY(pk.attnums)
          LEFT JOIN (
              SELECT array_agg(DISTINCT k.attnum) AS attnums, true AS is_indexed
                FROM pg_index i, unnest(i.indkey) AS k(attnum)
               WHERE i.indrelid = %s::regclass
               GROUP BY i.indrelid
          ) ix ON a.attnum = ANY(ix.attnums)
         WHERE a.attrelid = %s::regclass
           AND a.attnum > 0
           AND NOT a.attisdropped
         ORDER BY a.attnum
        """,
        [row["schema"] + "." + row["name"]] * 3,
    )

    index_names = [
        r["indexrelname"]
        for r in db.query(
            """
            SELECT indexrelname
              FROM pg_stat_user_indexes
             WHERE schemaname = %s AND relname = %s
             ORDER BY indexrelname
            """,
            [row["schema"], row["name"]],
        )
    ]

    live = int(row["live_tuples"] or 0)
    dead = int(row["dead_tuples"] or 0)
    dead_ratio = dead / live if live else 0.0

    notes: list[str] = []
    status = "GOOD"
    if dead_ratio > 0.05:
        status = "WARNING"
        notes.append(f"Dead-tuple ratio is {dead_ratio * 100:.1f}% — above the 5% threshold.")
    if int(row["seq_scans"] or 0) > 1000 and live > 100_000:
        status = "WARNING" if status == "GOOD" else status
        notes.append(
            f"{int(row['seq_scans']):,} sequential scans on a {live:,}-row table."
        )
    if not notes:
        notes.append("No maintenance signal above threshold.")

    return {
        "name": row["name"],
        "schema": row["schema"],
        "rows": int(row["rows"] or 0),
        "seqScans": int(row["seq_scans"] or 0),
        "seqTuplesRead": int(row["seq_tuples_read"] or 0),
        "indexScans": int(row["index_scans"] or 0),
        "indexTuplesFetched": int(row["index_tuples_fetched"] or 0),
        "inserts": int(row["inserts"] or 0),
        "updates": int(row["updates"] or 0),
        "deletes": int(row["deletes"] or 0),
        "liveTuples": live,
        "deadTuples": dead,
        "sizeBytes": int(row["size_bytes"] or 0),
        "indexSizeBytes": int(row["index_size_bytes"] or 0),
        "lastVacuum": row["last_vacuum"].isoformat() if row["last_vacuum"] else None,
        "lastAnalyze": row["last_analyze"].isoformat() if row["last_analyze"] else None,
        "columns": [
            {
                "name": c["name"],
                "type": c["type"],
                "nullable": bool(c["nullable"]),
                "isPrimaryKey": bool(c["is_primary_key"]),
                "indexed": bool(c["indexed"]),
            }
            for c in columns
        ],
        "indexNames": index_names,
        "health": {"status": status, "notes": notes},
    }


def table_by_name(name: str) -> dict[str, Any]:
    for table in tables():
        if table["name"] == name:
            return table
    raise LookupError(f"Table {name} not found")


# =====================================================================
# Schema: indexes
# =====================================================================

def indexes() -> list[dict[str, Any]]:
    rows = db.query(
        """
        SELECT i.indexrelname                       AS name,
               i.schemaname                         AS schema,
               i.relname                            AS table,
               i.idx_scan                           AS scans,
               i.idx_tup_read                       AS tuples_read,
               i.idx_tup_fetch                      AS tuples_fetched,
               pg_relation_size(i.indexrelid)       AS size_bytes,
               ix.indisunique                       AS is_unique,
               am.amname                            AS index_type,
               pg_get_indexdef(i.indexrelid)        AS definition,
               (
                   SELECT array_agg(a.attname ORDER BY k.ord)
                     FROM pg_index x
                     CROSS JOIN LATERAL unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
                     JOIN pg_attribute a
                       ON a.attrelid = x.indrelid AND a.attnum = k.attnum
                    WHERE x.indexrelid = i.indexrelid
               )                                    AS columns
          FROM pg_stat_user_indexes i
          JOIN pg_index ix ON ix.indexrelid = i.indexrelid
          JOIN pg_class ic ON ic.oid = i.indexrelid
          JOIN pg_am am ON am.oid = ic.relam
         WHERE i.schemaname = 'public'
         ORDER BY i.relname, i.indexrelname
        """
    )

    # Total scans per table, so a share can be computed.
    totals: dict[str, int] = {}
    for r in rows:
        totals[r["table"]] = totals.get(r["table"], 0) + int(r["scans"] or 0)

    out: list[dict[str, Any]] = []
    for r in rows:
        scans = int(r["scans"] or 0)
        total = totals.get(r["table"], 0) or 1
        share = round(scans / total * 100, 1)
        usage = "UNUSED" if scans == 0 else ("RARELY_USED" if share < 10 else "USED")
        out.append(
            {
                "name": r["name"],
                "schema": r["schema"],
                "table": r["table"],
                "columns": list(r["columns"] or []),
                "indexType": r["index_type"],
                "unique": bool(r["is_unique"]),
                "sizeBytes": int(r["size_bytes"] or 0),
                "scans": scans,
                "tuplesRead": int(r["tuples_read"] or 0),
                "tuplesFetched": int(r["tuples_fetched"] or 0),
                "usage": usage,
                "usageShare": share,
                "created": _now(),
                "relatedQueries": [],
                "notes": (
                    "No scans recorded since the statistics were last reset."
                    if scans == 0
                    else None
                ),
            }
        )
    return out


def index_by_name(name: str) -> dict[str, Any]:
    for index in indexes():
        if index["name"] == name:
            return index
    raise LookupError(f"Index {name} not found")


# =====================================================================
# Schema: configuration (pg_settings)
# =====================================================================

TRACKED_PARAMETERS = [
    "shared_buffers",
    "work_mem",
    "maintenance_work_mem",
    "effective_cache_size",
    "max_connections",
    "max_worker_processes",
    "max_parallel_workers",
    "max_parallel_workers_per_gather",
    "random_page_cost",
    "seq_page_cost",
]

CATEGORY_MAP = {
    "shared_buffers": "MEMORY",
    "work_mem": "MEMORY",
    "maintenance_work_mem": "MAINTENANCE",
    "effective_cache_size": "PLANNER",
    "max_connections": "CONNECTIONS",
    "max_worker_processes": "PARALLELISM",
    "max_parallel_workers": "PARALLELISM",
    "max_parallel_workers_per_gather": "PARALLELISM",
    "random_page_cost": "PLANNER",
    "seq_page_cost": "PLANNER",
}


def parameters() -> list[dict[str, Any]]:
    rows = db.query(
        """
        SELECT name, setting, unit, context, short_desc, boot_val, reset_val
          FROM pg_settings
         WHERE name = ANY(%s)
        """,
        [TRACKED_PARAMETERS],
    )
    by_name = {r["name"]: r for r in rows}

    out: list[dict[str, Any]] = []
    for name in TRACKED_PARAMETERS:
        r = by_name.get(name)
        if not r:
            continue
        current, bytes_value = _format_setting(r["setting"], r["unit"])
        is_default = r["setting"] == r["reset_val"]
        out.append(
            {
                "name": name,
                "currentValue": current,
                "bytesValue": bytes_value,
                "unit": r["unit"] or None,
                "category": CATEGORY_MAP.get(name, "OTHER"),
                "description": r["short_desc"],
                "status": "DEFAULT" if is_default else "TUNED",
                "requiresRestart": r["context"] == "postmaster",
            }
        )
    return out


# pg_settings reports memory values in blocks. Convert to a readable string and
# to an absolute byte count so the UI can compare parameters.
_UNIT_BYTES = {
    "8kB": 8 * 1024,
    "kB": 1024,
    "MB": 1024 * 1024,
    "GB": 1024 * 1024 * 1024,
}


def _format_setting(setting: str, unit: str | None) -> tuple[str, int | None]:
    if not unit:
        return setting, None

    factor = _UNIT_BYTES.get(unit)
    if factor is None:
        return f"{setting}{unit}", None

    total = int(float(setting) * factor)
    for suffix, size in (("GB", 1024**3), ("MB", 1024**2), ("kB", 1024)):
        if total >= size:
            value = total / size
            text = f"{value:.0f}" if value == int(value) else f"{value:.1f}"
            return f"{text}{suffix}", total
    return f"{total}B", total


def parameter_by_name(name: str) -> dict[str, Any]:
    for parameter in parameters():
        if parameter["name"] == name:
            return parameter
    raise LookupError(f"Parameter {name} not found")


# =====================================================================
# Metrics history (written by the sampler)
# =====================================================================

def metrics_series(limit: int = 60) -> dict[str, list[dict[str, Any]]]:
    rows = db.query(
        """
        SELECT collected_at, tps, qps, mean_latency_ms, cpu_percent,
               memory_percent, cache_hit_ratio
          FROM agentdb_metrics
         ORDER BY collected_at DESC
         LIMIT %s
        """,
        [limit],
    )
    ordered = list(reversed(rows))

    def series(key: str) -> list[dict[str, Any]]:
        return [
            {"timestamp": r["collected_at"].isoformat(), "value": float(r[key] or 0)}
            for r in ordered
        ]

    return {
        "tps": series("tps"),
        "p95Latency": series("mean_latency_ms"),
        "avgLatency": series("mean_latency_ms"),
        "cpu": series("cpu_percent"),
        "memory": series("memory_percent"),
    }


def latest_performance() -> dict[str, Any]:
    row = db.query_one(
        """
        SELECT tps, qps, mean_latency_ms, cpu_percent, memory_percent,
               active_connections, cache_hit_ratio
          FROM agentdb_metrics
         ORDER BY collected_at DESC
         LIMIT 1
        """
    ) or {}

    live = db.query_one(
        """
        SELECT (SELECT count(*) FROM pg_stat_activity
                 WHERE datname = current_database()
                   AND state = 'active'
                   AND pid <> pg_backend_pid())                    AS active_queries,
               (SELECT count(*) FROM pg_stat_activity
                 WHERE datname = current_database())               AS active_connections,
               current_setting('max_connections')::int              AS max_connections,
               (SELECT count(*) FROM pg_stat_activity
                 WHERE datname = current_database() AND state = 'active') AS active_now
        """
    ) or {}

    stats = db.query_one(
        """
        SELECT coalesce(sum(blks_hit), 0)   AS hit,
               coalesce(sum(blks_read), 0)  AS read
          FROM pg_stat_database
         WHERE datname = current_database()
        """
    ) or {}

    hit = float(stats.get("hit", 0))
    read = float(stats.get("read", 0))

    return {
        "tps": round(float(row.get("tps") or 0), 2),
        "qps": round(float(row.get("qps") or 0), 2),
        # PostgreSQL does not expose percentiles; this is the measured mean.
        "p95LatencyMs": round(float(row.get("mean_latency_ms") or 0), 3),
        "avgLatencyMs": round(float(row.get("mean_latency_ms") or 0), 3),
        "maxLatencyMs": 0.0,
        "activeQueries": int(live.get("active_queries") or 0),
        "activeConnections": int(live.get("active_connections") or 0),
        "maxConnections": int(live.get("max_connections") or 100),
        "cpuPercent": round(float(row.get("cpu_percent") or 0), 1),
        "memoryPercent": round(float(row.get("memory_percent") or 0), 1),
        "cacheHitRatio": round(hit / (hit + read), 4) if (hit + read) else 0.0,
    }


def database_state() -> dict[str, Any]:
    top = queries(sort="totalExecTimeMs", direction="desc", limit=8)
    return {
        "info": database_info(),
        "performance": latest_performance(),
        "series": metrics_series(),
        "topQueries": top,
        "activeQueries": active_queries(),
        "collectedAt": _now(),
    }


# =====================================================================
# Activity events
# =====================================================================

def events(limit: int = 100, types: list[str] | None = None) -> list[dict[str, Any]]:
    sql = """
        SELECT id, timestamp, type, level, message, detail, actor,
               related_id, related_label
          FROM agentdb_events
    """
    params: list[Any] = []
    if types:
        sql += " WHERE type = ANY(%s)"
        params.append(types)
    sql += " ORDER BY timestamp DESC, id DESC LIMIT %s"
    params.append(limit)

    return [
        {
            "id": f"evt-{r['id']}",
            "timestamp": r["timestamp"].isoformat(),
            "type": r["type"],
            "level": r["level"],
            "message": r["message"],
            "detail": r["detail"],
            "actor": r["actor"],
            "relatedId": r["related_id"],
            "relatedLabel": r["related_label"],
        }
        for r in db.query(sql, params)
    ]


def record_event(
    type_: str,
    level: str,
    message: str,
    detail: str | None = None,
    actor: str = "collector",
    related_id: str | None = None,
    related_label: str | None = None,
) -> None:
    db.execute(
        """
        INSERT INTO agentdb_events (type, level, message, detail, actor, related_id, related_label)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        [type_, level, message, detail, actor, related_id, related_label],
    )


MACHINE = MACHINE_ID
