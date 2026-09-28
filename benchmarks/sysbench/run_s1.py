import json
import math
import os
import platform
import re
import statistics
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil
import psycopg


# ============================================================
# Experiment configuration
# ============================================================

WORKLOAD = "oltp_read_only"

TABLES = 4
TABLE_SIZE = 100_000

THREADS = 4
DURATION_SECONDS = 60
RUNS = 5

REPORT_INTERVAL = 10
SAMPLE_INTERVAL = 5

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "agentdb")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


# ============================================================
# Paths / machine identity
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

hostname = platform.node() or "unknown-machine"

MACHINE_ID = re.sub(
    r"[^a-zA-Z0-9_-]",
    "",
    hostname.lower().replace(" ", "-"),
)

RESULT_DIR = (
    PROJECT_ROOT
    / "results"
    / MACHINE_ID
    / "sysbench"
    / "S1"
)

RESULT_DIR.mkdir(parents=True, exist_ok=True)

MACHINE_FINGERPRINT = (
    PROJECT_ROOT
    / "machines"
    / MACHINE_ID
    / "environment.txt"
)


# ============================================================
# Utility functions
# ============================================================

def utc_now():
    return datetime.now(timezone.utc).isoformat()


def run_command(command):
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )

    return {
        "command": command,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def percentile(values, p):
    if not values:
        return None

    values = sorted(values)

    index = math.ceil((p / 100) * len(values)) - 1
    index = max(0, min(index, len(values) - 1))

    return values[index]


# ============================================================
# Runtime state collection
# ============================================================

def collect_host_state():
    memory = psutil.virtual_memory()

    return {
        "timestamp": utc_now(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "cpu_count_logical": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "memory_total_bytes": memory.total,
        "memory_available_bytes": memory.available,
        "memory_used_percent": memory.percent,
        "load_average": list(os.getloadavg()),
    }


def collect_container_state():
    result = subprocess.run(
        [
            "docker",
            "stats",
            "--no-stream",
            "--format",
            "{{json .}}",
            "agentdb-postgres",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        return {
            "error": result.stderr.strip()
        }

    output = result.stdout.strip()

    if not output:
        return {}

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return {
            "raw_output": output
        }


def collect_postgres_state():
    try:
        with psycopg.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        ) as conn:

            with conn.cursor() as cur:

                cur.execute("SELECT version();")
                version = cur.fetchone()[0]

                cur.execute(
                    """
                    SELECT name, setting, unit
                    FROM pg_settings
                    WHERE name IN (
                        'shared_buffers',
                        'work_mem',
                        'maintenance_work_mem',
                        'effective_cache_size',
                        'max_connections',
                        'max_worker_processes',
                        'max_parallel_workers',
                        'max_parallel_workers_per_gather',
                        'random_page_cost',
                        'seq_page_cost'
                    )
                    ORDER BY name;
                    """
                )

                settings = {}

                for name, setting, unit in cur.fetchall():
                    settings[name] = {
                        "setting": setting,
                        "unit": unit,
                    }

                return {
                    "version": version,
                    "settings": settings,
                }

    except Exception as exc:
        return {
            "error": str(exc)
        }


def collect_runtime_state():
    return {
        "host": collect_host_state(),
        "postgres_container": collect_container_state(),
        "postgres": collect_postgres_state(),
    }


# ============================================================
# Background runtime sampler
# ============================================================

class RuntimeSampler:

    def __init__(self):
        self.samples = []
        self.running = False
        self.thread = None

    def _sample_loop(self):
        while self.running:
            self.samples.append(
                collect_runtime_state()
            )

            time.sleep(SAMPLE_INTERVAL)

    def start(self):
        self.running = True

        self.thread = threading.Thread(
            target=self._sample_loop,
            daemon=True,
        )

        self.thread.start()

    def stop(self):
        self.running = False

        if self.thread is not None:
            self.thread.join(timeout=SAMPLE_INTERVAL + 2)


# ============================================================
# Sysbench execution
# ============================================================

def build_sysbench_command():
    return [
        "sysbench",
        WORKLOAD,

        "--db-driver=pgsql",

        f"--pgsql-host={DB_HOST}",
        f"--pgsql-port={DB_PORT}",
        f"--pgsql-user={DB_USER}",
        f"--pgsql-password={DB_PASSWORD}",
        f"--pgsql-db={DB_NAME}",

        f"--tables={TABLES}",
        f"--table-size={TABLE_SIZE}",

        f"--threads={THREADS}",
        f"--time={DURATION_SECONDS}",
        f"--report-interval={REPORT_INTERVAL}",

        "run",
    ]


def parse_sysbench_output(output):
    patterns = {
        "transactions_per_second": r"transactions:\s+.*\(([\d.]+) per sec\.\)",
        "queries_per_second": r"queries:\s+.*\(([\d.]+) per sec\.\)",
        "total_queries": r"total:\s+(\d+)",
        "total_transactions": r"transactions:\s+(\d+)",
        "ignored_errors": r"ignored errors:\s+(\d+)",
        "reconnects": r"reconnects:\s+(\d+)",
        "total_time_seconds": r"total time:\s+([\d.]+)s",
        "latency_min_ms": r"min:\s+([\d.]+)",
        "latency_avg_ms": r"avg:\s+([\d.]+)",
        "latency_max_ms": r"max:\s+([\d.]+)",
        "latency_p95_ms": r"95th percentile:\s+([\d.]+)",
    }

    parsed = {}

    for key, pattern in patterns.items():
        match = re.search(pattern, output)

        if match:
            value = match.group(1)

            if key in {
                "total_queries",
                "total_transactions",
                "ignored_errors",
                "reconnects",
            }:
                parsed[key] = int(value)
            else:
                parsed[key] = float(value)

    return parsed


def run_single_benchmark(run_number):
    print()
    print("=" * 60)
    print(f"S1 RUN {run_number}/{RUNS}")
    print("=" * 60)

    print("Collecting pre-run runtime state...")

    before = collect_runtime_state()

    command = build_sysbench_command()

    print()
    print("Running:")
    print(" ".join(command).replace(DB_PASSWORD, "***"))

    sampler = RuntimeSampler()

    start_time = time.perf_counter()

    sampler.start()

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )

    elapsed = time.perf_counter() - start_time

    sampler.stop()

    print("Collecting post-run runtime state...")

    after = collect_runtime_state()

    parsed = parse_sysbench_output(result.stdout)

    run_result = {
        "run": run_number,
        "started_at": utc_now(),
        "duration_wall_clock_seconds": elapsed,

        "configuration": {
            "workload": WORKLOAD,
            "tables": TABLES,
            "table_size": TABLE_SIZE,
            "threads": THREADS,
            "duration_seconds": DURATION_SECONDS,
            "report_interval_seconds": REPORT_INTERVAL,
        },

        "metrics": parsed,

        "process": {
            "returncode": result.returncode,
        },

        "runtime": {
            "before": before,
            "samples": sampler.samples,
            "after": after,
        },

        "raw_sysbench_output": result.stdout,
        "sysbench_stderr": result.stderr,
    }

    output_file = RESULT_DIR / f"run_{run_number:02d}.json"

    with output_file.open("w") as f:
        json.dump(run_result, f, indent=2)

    print()
    print(f"Saved: {output_file}")

    return run_result


# ============================================================
# Summary
# ============================================================

def calculate_summary(results):
    tps = [
        r["metrics"]["transactions_per_second"]
        for r in results
        if "transactions_per_second" in r["metrics"]
    ]

    qps = [
        r["metrics"]["queries_per_second"]
        for r in results
        if "queries_per_second" in r["metrics"]
    ]

    avg_latency = [
        r["metrics"]["latency_avg_ms"]
        for r in results
        if "latency_avg_ms" in r["metrics"]
    ]

    p95_latency = [
        r["metrics"]["latency_p95_ms"]
        for r in results
        if "latency_p95_ms" in r["metrics"]
    ]

    max_latency = [
        r["metrics"]["latency_max_ms"]
        for r in results
        if "latency_max_ms" in r["metrics"]
    ]

    errors = [
        r["metrics"].get("ignored_errors", 0)
        for r in results
    ]

    def stats(values):
        if not values:
            return {}

        return {
            "mean": statistics.mean(values),
            "stddev": statistics.stdev(values)
            if len(values) >= 2
            else 0,
            "min": min(values),
            "max": max(values),
        }

    return {
        "experiment": "S1",
        "workload": WORKLOAD,
        "runs": len(results),

        "configuration": {
            "tables": TABLES,
            "table_size": TABLE_SIZE,
            "threads": THREADS,
            "duration_seconds": DURATION_SECONDS,
        },

        "metrics": {
            "tps": stats(tps),
            "qps": stats(qps),
            "average_latency_ms": stats(avg_latency),
            "p95_latency_ms": stats(p95_latency),
            "maximum_latency_ms": stats(max_latency),
            "errors": {
                "total": sum(errors),
                "per_run": errors,
            },
        },

        "generated_at": utc_now(),
    }


# ============================================================
# Main
# ============================================================

def main():

    print()
    print("============================================================")
    print("AgentDB — Sysbench S1 Baseline Stability")
    print("============================================================")
    print()

    print(f"Machine ID: {MACHINE_ID}")
    print(f"Results:    {RESULT_DIR}")

    if not MACHINE_FINGERPRINT.exists():
        print()
        print("WARNING:")
        print("Machine fingerprint was not found:")
        print(MACHINE_FINGERPRINT)
        print()
        print("Run machines/fingerprint.sh before continuing.")
        return 1

    print(f"Fingerprint: {MACHINE_FINGERPRINT}")

    print()
    print("Collecting experiment metadata...")

    environment = {
        "experiment": "S1",
        "machine_id": MACHINE_ID,
        "machine_fingerprint": str(
            MACHINE_FINGERPRINT.relative_to(PROJECT_ROOT)
        ),
        "generated_at": utc_now(),
        "git_commit": run_command(
            ["git", "rev-parse", "HEAD"]
        ),
        "git_status": run_command(
            ["git", "status", "--short"]
        ),
        "configuration": {
            "workload": WORKLOAD,
            "tables": TABLES,
            "table_size": TABLE_SIZE,
            "threads": THREADS,
            "duration_seconds": DURATION_SECONDS,
            "runs": RUNS,
        },
        "initial_runtime_state": collect_runtime_state(),
    }

    with (RESULT_DIR / "experiment.json").open("w") as f:
        json.dump(environment, f, indent=2)

    results = []

    for run_number in range(1, RUNS + 1):
        result = run_single_benchmark(run_number)
        results.append(result)

    summary = calculate_summary(results)

    with (RESULT_DIR / "summary.json").open("w") as f:
        json.dump(summary, f, indent=2)

    print()
    print("=" * 60)
    print("S1 COMPLETE")
    print("=" * 60)

    print()
    print("Summary:")
    print(json.dumps(summary["metrics"], indent=2))

    print()
    print(f"Results stored in:")
    print(RESULT_DIR)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())