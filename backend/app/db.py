"""Database access helpers.

A tiny connection pool is enough here: the collector is read-mostly and the
sampler owns a long-lived connection of its own.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Any, Iterable, Iterator, Sequence

import psycopg
from psycopg.rows import dict_row

from .config import DSN

_local = threading.local()


def _connection() -> psycopg.Connection:
    """One connection per thread, reused across requests."""
    conn = getattr(_local, "conn", None)
    if conn is None or conn.closed:
        conn = psycopg.connect(DSN, autocommit=True, row_factory=dict_row)
        _local.conn = conn
    return conn


@contextmanager
def cursor() -> Iterator[psycopg.Cursor]:
    conn = _connection()
    try:
        with conn.cursor() as cur:
            yield cur
    except psycopg.OperationalError:
        # Reconnect once on a dropped connection.
        _local.conn = None
        with _connection().cursor() as cur:
            yield cur


def query(sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def query_one(sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Sequence[Any] | None = None) -> None:
    with cursor() as cur:
        cur.execute(sql, params or ())


def execute_script(statements: Iterable[str]) -> None:
    for statement in statements:
        execute(statement)


def healthy() -> bool:
    try:
        query_one("SELECT 1 AS ok")
        return True
    except Exception:
        return False
