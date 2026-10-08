"""Whitelisted workload runner.

The API never accepts a command string. Callers pick a workload name, a
duration and a concurrency level; those are validated against the sets in
`config.py` and only then assembled into an argv list. A single global lock
prevents two runs from overlapping, because concurrent benchmarks would
invalidate each other's measurements.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from .collector import record_event
from .config import (
    ALLOWED_CONCURRENCY,
    ALLOWED_DURATIONS,
    ALLOWED_TABLES,
    ALLOWED_WORKLOADS,
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_USER,
    WORKLOAD_DIR,
)

RUNS: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()
_active: str | None = None

_SYSBENCH_PATTERNS = {
    "tps": r"transactions:\s+\d+\s+\(([\d.]+)\s+per sec\.\)",
    "qps": r"queries:\s+\d+\s+\(([\d.]+)\s+per sec\.\)",
    "errors": r"errors:\s+(\d+)",
    "avg_latency": r"avg:\s+([\d.]+)",
    "p95_latency": r"95th percentile:\s+([\d.]+)",
    "max_latency": r"max:\s+([\d.]+)",
}

_PGBENCH_PATTERNS = {
    "tps": r"tps\s*=\s*([\d.]+)",
    "avg_latency": r"latency average\s*=\s*([\d.]+)",
    "stddev_latency": r"latency stddev\s*=\s*([\d.]+)",
}

WORKLOAD_LABELS = {
    "oltp_read_only": "Sysbench read-only OLTP",
    "oltp_read_write": "Sysbench read/write OLTP",
    "oltp_point_select": "Sysbench point select",
    "oltp_write_only": "Sysbench write-only OLTP",
    "app_mixed": "pgbench application workload",
}

SYSBENCH_ONLY = {"oltp_read_only", "oltp_read_write", "oltp_point_select", "oltp_write_only"}

# `pgbench` is shipped with the PostgreSQL client tools. On Debian/Ubuntu
# `/usr/bin/pgbench` is a wrapper that fails with "You must install at least one
# postgresql-client-<version> package" when no client package is installed, so
# detecting the wrapper is not enough: we probe it. When it is unusable we run
# pgbench inside the postgres container instead, which always has it.
PROJECT_ROOT = WORKLOAD_DIR.parent.parent
DOCKER_PG_SERVICE = os.getenv("PG_DOCKER_SERVICE", "postgres")
_docker_pgbench: bool | None = None


def _host_pgbench_works() -> bool:
    if shutil.which("pgbench") is None:
        return False
    try:
        probe = subprocess.run(
            ["pgbench", "--version"], capture_output=True, text=True, timeout=15
        )
        return probe.returncode == 0
    except Exception:
        return False


def _docker_pgbench_works() -> bool:
    """Probe `docker compose exec <service> pgbench --version`. Cached."""
    global _docker_pgbench
    if _docker_pgbench is not None:
        return _docker_pgbench
    _docker_pgbench = False
    if shutil.which("docker") is not None:
        try:
            probe = subprocess.run(
                [
                    "docker", "compose", "exec", "-T", DOCKER_PG_SERVICE,
                    "pgbench", "--version",
                ],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=30,
            )
            _docker_pgbench = probe.returncode == 0
        except Exception:
            _docker_pgbench = False
    return _docker_pgbench


def pgbench_available() -> bool:
    return _host_pgbench_works() or _docker_pgbench_works()


def available_workloads() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for name, tool in ALLOWED_WORKLOADS.items():
        if tool == "sysbench":
            available = shutil.which("sysbench") is not None
        else:
            available = pgbench_available()
        out.append(
            {
                "id": name,
                "label": WORKLOAD_LABELS.get(name, name),
                "tool": tool,
                "available": available,
            }
        )
    return out


def status() -> dict[str, Any]:
    return {
        "busy": _active is not None,
        "activeRunId": _active,
        "sysbench": shutil.which("sysbench") is not None,
        "pgbench": pgbench_available(),
        "toolDirectory": str(WORKLOAD_DIR),
    }


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def start(workload: str, duration: int, concurrency: int, mode: str = "run") -> dict[str, Any]:
    global _active

    if workload not in ALLOWED_WORKLOADS:
        raise ValueError(
            f"Workload '{workload}' is not allowed. Choose one of: "
            + ", ".join(sorted(ALLOWED_WORKLOADS))
        )
    if duration not in ALLOWED_DURATIONS:
        raise ValueError(f"Duration must be one of {sorted(ALLOWED_DURATIONS)} seconds.")
    if concurrency not in ALLOWED_CONCURRENCY:
        raise ValueError(f"Concurrency must be one of {sorted(ALLOWED_CONCURRENCY)}.")

    tool = ALLOWED_WORKLOADS[workload]
    binary = "sysbench" if tool == "sysbench" else "pgbench"
    if tool == "sysbench":
        if shutil.which(binary) is None:
            raise RuntimeError("'sysbench' was not found on PATH.")
    elif not pgbench_available():
        raise RuntimeError(
            "pgbench is not usable: neither the host client nor "
            f"`docker compose exec {DOCKER_PG_SERVICE} pgbench` is available."
        )

    if mode == "prepare" and tool != "sysbench":
        raise ValueError("Only sysbench workloads support the prepare phase.")

    with _lock:
        if _active is not None:
            raise RuntimeError("A benchmark run is already in progress.")
        run_id = uuid.uuid4().hex[:12]
        _active = run_id

    run: dict[str, Any] = {
        "id": run_id,
        "request": {
            "workload": workload,
            "experiment": "custom",
            "durationSeconds": duration,
            "concurrency": concurrency,
            "tables": 4,
            "tableSize": 100_000,
        },
        "status": "QUEUED",
        "queuedAt": _utc(),
        "progress": 0,
        "message": "Queued.",
        "result": None,
    }
    RUNS[run_id] = run

    record_event(
        "BENCHMARK",
        "INFO",
        f"Benchmark queued — {WORKLOAD_LABELS.get(workload, workload)}",
        f"{tool} · {concurrency} thread(s) · {duration}s · mode={mode}",
        actor="benchmark-runner",
        related_id=run_id,
        related_label=workload,
    )

    thread = threading.Thread(
        target=_execute,
        args=(run_id, workload, tool, duration, concurrency, mode),
        name=f"agentdb-run-{run_id}",
        daemon=True,
    )
    thread.start()
    return run


def _command(workload: str, tool: str, duration: int, concurrency: int, mode: str) -> list[str]:
    if tool == "sysbench":
        return [
            "sysbench",
            "--db-driver=pgsql",
            f"--pgsql-host={DB_HOST}",
            f"--pgsql-port={DB_PORT}",
            f"--pgsql-user={DB_USER}",
            f"--pgsql-password={DB_PASSWORD}",
            f"--pgsql-db={DB_NAME}",
            "--tables=4",
            "--table-size=100000",
            f"--threads={concurrency}",
            f"--time={duration}",
            "--report-interval=10",
            workload,
            mode,
        ]

    script = WORKLOAD_DIR / f"{workload}.sql"
    # `-f -` reads the script from stdin so the same file works whether pgbench
    # runs on the host or inside the container (which has no access to it).
    args = [
        "-n",
        f"-c{concurrency}",
        f"-j{min(concurrency, 4)}",
        f"-T{duration}",
        "-f",
        "-",
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
    ]
    if _host_pgbench_works():
        return ["pgbench", *args]
    return [
        "docker", "compose", "exec", "-T",
        "-e", f"PGPASSWORD={DB_PASSWORD}",
        DOCKER_PG_SERVICE, "pgbench", *args,
    ]


def _execute(
    run_id: str,
    workload: str,
    tool: str,
    duration: int,
    concurrency: int,
    mode: str,
) -> None:
    global _active

    run = RUNS[run_id]
    command = _command(workload, tool, duration, concurrency, mode)
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    run.update(status="RUNNING", startedAt=_utc(), message="Running workload…")
    started = time.time()

    try:
        use_docker = tool != "sysbench" and not _host_pgbench_works()
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stdin=subprocess.PIPE if use_docker else None,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
            cwd=str(PROJECT_ROOT) if use_docker else None,
        )

        if use_docker and process.stdin is not None:
            script = WORKLOAD_DIR / f"{workload}.sql"
            process.stdin.write(script.read_text())
            process.stdin.flush()
            process.stdin.close()

        lines: list[str] = []
        assert process.stdout is not None
        for line in process.stdout:
            lines.append(line)
            # pgbench streams progress; sysbench streams 10s interval reports.
            match = re.search(r"progress:\s+\d+\.\d+\s+s", line)
            elapsed = time.time() - started
            if match or mode == "run":
                run["progress"] = min(99, int(elapsed / max(duration, 1) * 100))
                run["message"] = f"Running — {run['progress']}%"

        process.wait()
        output = "".join(lines)
        exit_code = process.returncode
    except Exception as exc:
        run.update(
            status="FAILED",
            completedAt=_utc(),
            message=f"Could not start the workload: {exc}",
            progress=0,
        )
        record_event(
            "BENCHMARK", "ERROR", "Benchmark failed to start", str(exc),
            actor="benchmark-runner", related_id=run_id,
        )
        with _lock:
            _active = None
        return

    duration_actual = round(time.time() - started, 2)

    if exit_code != 0:
        tail = "\n".join(output.strip().splitlines()[-6:])
        run.update(
            status="FAILED",
            completedAt=_utc(),
            progress=100,
            message=f"Workload exited with code {exit_code}.",
            output=tail,
        )
        record_event(
            "BENCHMARK", "ERROR", f"Benchmark failed — {workload}", tail or None,
            actor="benchmark-runner", related_id=run_id,
        )
        with _lock:
            _active = None
        return

    metrics = _parse(output, tool, workload)
    run.update(
        status="COMPLETED",
        completedAt=_utc(),
        progress=100,
        message="Completed.",
        result=metrics,
        durationSeconds=duration_actual,
    )

    summary = (
        f"TPS {metrics.get('tps', 0):,.1f} · QPS {metrics.get('qps', 0):,.1f} · "
        f"avg {metrics.get('avgLatencyMs', 0):.2f} ms"
    )
    record_event(
        "BENCHMARK",
        "SUCCESS",
        f"Benchmark completed — {WORKLOAD_LABELS.get(workload, workload)}",
        summary,
        actor="benchmark-runner",
        related_id=run_id,
        related_label=workload,
    )

    with _lock:
        _active = None


def _statement_count(workload: str) -> int:
    """Number of statements one transaction executes in a pgbench script."""
    try:
        text = (WORKLOAD_DIR / f"{workload}.sql").read_text()
    except OSError:
        return 1
    body = "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("--")
    )
    return max(body.count(";"), 1)


def _parse(output: str, tool: str, workload: str) -> dict[str, Any]:
    patterns = _SYSBENCH_PATTERNS if tool == "sysbench" else _PGBENCH_PATTERNS
    found: dict[str, float] = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, output)
        if match:
            found[key] = float(match.group(1))

    if tool == "sysbench":
        return {
            "tps": round(found.get("tps", 0.0), 2),
            "qps": round(found.get("qps", 0.0), 2),
            "avgLatencyMs": round(found.get("avg_latency", 0.0), 3),
            "p95LatencyMs": round(found.get("p95_latency", 0.0), 3),
            "maxLatencyMs": round(found.get("max_latency", 0.0), 3),
            "errors": int(found.get("errors", 0)),
        }

    # pgbench reports transactions/s and a latency average, and nothing else.
    # Percentiles are left null rather than copied from the average, and the
    # query rate is derived from the number of statements per transaction.
    tps = found.get("tps", 0.0)
    return {
        "tps": round(tps, 2),
        "qps": round(tps * _statement_count(workload), 2),
        "avgLatencyMs": round(found.get("avg_latency", 0.0), 3),
        "p95LatencyMs": None,
        "maxLatencyMs": None,
        "errors": 0,
    }


def reset_statistics() -> None:
    """Clear cumulative counters so the next measurement is attributable."""
    from . import db

    db.execute("SELECT pg_stat_reset()")
    record_event(
        "SYSTEM",
        "WARNING",
        "Statistics reset",
        "Cumulative pg_stat counters were cleared; the next observation window starts from zero.",
        actor="operator",
    )


def reset_index(name: str, action: str) -> None:
    """Drop or recreate a sysbench index, to demonstrate index detection."""
    from . import db

    if not re.fullmatch(r"[a-z0-9_]+", name):
        raise ValueError("Invalid index name.")

    if action == "drop":
        db.execute(f'DROP INDEX IF EXISTS "{name}"')
        record_event(
            "EXECUTION", "WARNING", f"Index dropped — {name}",
            "Removed so the workload has to fall back to a sequential scan.",
            actor="operator",
        )
    elif action == "recreate":
        table = re.sub(r"^(k|c)_(\d+)$", lambda m: f"sbtest{m.group(2)}", name)
        column = name[0]
        if table == name:
            raise ValueError("Only sysbench k_/c_ indexes can be recreated automatically.")
        db.execute(f'CREATE INDEX IF NOT EXISTS "{name}" ON {table} ({column})')
        record_event(
            "EXECUTION", "SUCCESS", f"Index recreated — {name}",
            f"CREATE INDEX ON {table} ({column})",
            actor="operator",
        )
    else:
        raise ValueError("Action must be 'drop' or 'recreate'.")
