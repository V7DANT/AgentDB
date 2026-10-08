"""Configuration for the AgentDB collector backend."""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------- database

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "agentdb")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

DSN = (
    f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
    f"user={DB_USER} password={DB_PASSWORD}"
)

# ---------------------------------------------------------------- paths

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
RESULTS_DIR = PROJECT_ROOT / "results"
SQL_DIR = BACKEND_ROOT / "sql"
WORKLOAD_DIR = BACKEND_ROOT / "workloads"

# Machine whose benchmark results are served. Matches the directory names under
# results/. Change this if you demo on a different machine.
MACHINE_ID = os.getenv("AGENTDB_MACHINE_ID", "vedant-bothra")

# ---------------------------------------------------------------- sampling

SAMPLE_INTERVAL_SECONDS = float(os.getenv("AGENTDB_SAMPLE_INTERVAL", "5"))
QUERY_SAMPLE_LIMIT = 15
EVENT_EVERY_N_SAMPLES = 12  # one OBSERVATION event per minute at 5s interval

# ---------------------------------------------------------------- runner

# Only these workloads may be launched through the API. Never accept arbitrary
# command strings from the client.
ALLOWED_WORKLOADS = {
    "oltp_read_only": "sysbench",
    "oltp_read_write": "sysbench",
    "oltp_point_select": "sysbench",
    "oltp_write_only": "sysbench",
    "app_mixed": "pgbench",
}

ALLOWED_DURATIONS = {15, 30, 60, 120, 300}
ALLOWED_CONCURRENCY = {1, 2, 4, 8, 16, 32}
ALLOWED_TABLES = {4, 8, 16, 32}
