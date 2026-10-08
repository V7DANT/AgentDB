"""AgentDB collector API.

Start with:
    uvicorn app.main:app --reload --port 8000     (from the backend/ directory)
or:
    python run.py
"""

from __future__ import annotations

import contextlib
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db, sampling
from .config import SQL_DIR
from .routes import router


def _apply_schema() -> None:
    """Create the agentdb_* tables and seed the application schema.

    Idempotent: every statement is IF NOT EXISTS and the seed only runs when a
    table is empty.
    """
    schema_file = Path(SQL_DIR) / "001_agentdb.sql"
    if not schema_file.exists():
        print(f"[startup] schema file not found: {schema_file}")
        return
    sql = schema_file.read_text()
    with db.cursor() as cur:
        cur.execute(sql)
    print("[startup] schema and seed applied")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        _apply_schema()
    except Exception as exc:
        print(f"[startup] could not apply schema: {exc}")
    sampling.start()
    yield
    sampling.stop()


app = FastAPI(
    title="AgentDB Collector API",
    version="0.1.0",
    description=(
        "Read-only PostgreSQL state collector backing the AgentDB dashboard. "
        "Serves pg_stat_statements, pg_stat_user_tables, pg_stat_user_indexes, "
        "pg_settings, EXPLAIN plans and the committed benchmark result files."
    ),
    lifespan=lifespan,
)

# The Vite dev server proxies /api, so CORS is not strictly required; it is
# enabled for direct access during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "agentdb-collector",
        "docs": "/docs",
        "api": "/api",
        "health": "/api/health",
    }
