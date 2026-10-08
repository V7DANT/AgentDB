"""Background sampler.

PostgreSQL keeps only cumulative counters — no history — so the dashboard's
time-series charts need someone to record snapshots. This thread computes the
genuinely derivable metrics every few seconds and writes them to
`agentdb_metrics`, plus per-query mean times to `agentdb_query_samples`.

What is real here:
  * TPS   = Δ(xact_commit + xact_rollback) / Δt          [pg_stat_database]
  * QPS   = Δ(calls) / Δt                                [pg_stat_statements]
  * mean  = Δ(total_exec_time) / Δ(calls)                [pg_stat_statements]
  * CPU / memory via psutil

What is NOT here: percentiles. PostgreSQL does not expose them.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import psutil

from . import db
from .collector import record_event
from .config import (
    EVENT_EVERY_N_SAMPLES,
    QUERY_SAMPLE_LIMIT,
    SAMPLE_INTERVAL_SECONDS,
)

_lock = threading.Lock()
_stop = threading.Event()
_thread: threading.Thread | None = None

_prev: dict[str, Any] = {}
_cycle = 0


def _snapshot() -> dict[str, float]:
    database = db.query_one(
        """
        SELECT coalesce(xact_commit, 0) + coalesce(xact_rollback, 0) AS xacts,
               coalesce(blks_hit, 0)  AS hit,
               coalesce(blks_read, 0) AS read
          FROM pg_stat_database
         WHERE datname = current_database()
        """
    ) or {}

    statements = db.query_one(
        """
        SELECT coalesce(sum(calls), 0)            AS calls,
               coalesce(sum(total_exec_time), 0)  AS total_ms
          FROM pg_stat_statements
         WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        """
    ) or {}

    connections = db.query_one(
        """
        SELECT count(*) FILTER (WHERE state = 'active') AS active
          FROM pg_stat_activity
         WHERE datname = current_database()
        """
    ) or {}

    return {
        "xacts": float(database.get("xacts") or 0),
        "hit": float(database.get("hit") or 0),
        "read": float(database.get("read") or 0),
        "calls": float(statements.get("calls") or 0),
        "total_ms": float(statements.get("total_ms") or 0),
        "active": float(connections.get("active") or 0),
    }


def _sample() -> None:
    global _prev, _cycle

    current = _snapshot()
    now = time.time()

    previous = _prev
    _prev = current
    if not previous:
        return

    elapsed = SAMPLE_INTERVAL_SECONDS or 1
    delta_xacts = max(current["xacts"] - previous["xacts"], 0)
    delta_calls = max(current["calls"] - previous["calls"], 0)
    delta_ms = max(current["total_ms"] - previous["total_ms"], 0)

    tps = delta_xacts / elapsed
    qps = delta_calls / elapsed
    mean_ms = (delta_ms / delta_calls) if delta_calls else 0.0

    total_blocks = current["hit"] + current["read"]
    cache_ratio = (current["hit"] / total_blocks) if total_blocks else 0.0

    db.execute(
        """
        INSERT INTO agentdb_metrics
            (tps, qps, mean_latency_ms, cpu_percent, memory_percent,
             active_connections, cache_hit_ratio)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        [
            round(tps, 2),
            round(qps, 2),
            round(mean_ms, 4),
            psutil.cpu_percent(interval=None),
            psutil.virtual_memory().percent,
            int(current["active"]),
            round(cache_ratio, 4),
        ],
    )

    if delta_calls > 0:
        top = db.query(
            """
            SELECT queryid::text AS query_id, mean_exec_time
              FROM pg_stat_statements
             WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
               AND calls > 0
             ORDER BY total_exec_time DESC
             LIMIT %s
            """,
            [QUERY_SAMPLE_LIMIT],
        )
        for row in top:
            db.execute(
                """
                INSERT INTO agentdb_query_samples (queryid, mean_exec_time)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                [row["query_id"], float(row["mean_exec_time"])],
            )

    _cycle += 1
    if _cycle % EVENT_EVERY_N_SAMPLES == 0:
        record_event(
            "OBSERVATION",
            "INFO",
            "Observation window completed",
            (
                f"{qps:,.0f} statements/s, {tps:,.1f} transactions/s, "
                f"mean {mean_ms:.2f} ms, {int(current['active'])} active session(s)."
            ),
            actor="state-collector",
        )
        db.execute(
            "DELETE FROM agentdb_metrics WHERE collected_at < now() - interval '2 days'"
        )
        db.execute(
            "DELETE FROM agentdb_query_samples WHERE collected_at < now() - interval '2 days'"
        )


def _loop() -> None:
    while not _stop.is_set():
        try:
            with _lock:
                _sample()
        except Exception as exc:  # keep sampling even if one cycle fails
            print(f"[sampler] cycle failed: {exc}")
        _stop.wait(SAMPLE_INTERVAL_SECONDS)


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="agentdb-sampler", daemon=True)
    _thread.start()


def stop() -> None:
    _stop.set()
