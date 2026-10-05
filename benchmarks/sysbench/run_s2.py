import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, stdev

import psutil


# ============================================================
# S2 CONFIGURATION
# ============================================================

WORKLOAD = "oltp_read_only"

TABLES = 4
TABLE_SIZE = 100_000

# Concurrency levels being evaluated
CONCURRENCY_LEVELS = [1, 2, 4, 8, 16]

# Repeated runs at each concurrency level
RUNS_PER_LEVEL = 3

# Duration of each measured run
DURATION_SECONDS = 60

# Sysbench progress reporting
REPORT_INTERVAL = 10

# System monitoring interval
SAMPLE_INTERVAL = 5


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "agentdb"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MACHINE_ID = subprocess.check_output(
    ["hostname"],
    text=True
).strip().lower()

MACHINE_ID = re.sub(
    r"[^a-z0-9_-]",
    "-",
    MACHINE_ID
)

RESULTS_DIR = (
    PROJECT_ROOT
    / "results"
    / MACHINE_ID
    / "sysbench"
    / "S2"
)

FINGERPRINT_FILE = (
    PROJECT_ROOT
    / "machines"
    / MACHINE_ID
    / "environment.txt"
)


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def utc_now():
    return datetime.now(timezone.utc).isoformat()


def run_command(command):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False
        )

        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    except Exception as exc:
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": str(exc),
        }


def git_info():
    commit = run_command(
        ["git", "rev-parse", "HEAD"]
    )

    status = run_command(
        ["git", "status", "--short"]
    )

    return {
        "commit": commit["stdout"].strip(),
        "working_tree_status": status["stdout"].strip(),
    }


# ============================================================
# SYSTEM MONITORING
# ============================================================

def collect_host_state():
    memory = psutil.virtual_memory()

    try:
        load_average = os.getloadavg()
    except (AttributeError, OSError):
        load_average = None

    return {
        "timestamp": utc_now(),
        "cpu_percent": psutil.cpu_percent(interval=0.2),
        "logical_cpus": psutil.cpu_count(logical=True),
        "physical_cpus": psutil.cpu_count(logical=False),
        "memory_total_bytes": memory.total,
        "memory_available_bytes": memory.available,
        "memory_percent": memory.percent,
        "load_average": load_average,
    }


def collect_docker_state():
    result = run_command([
        "docker",
        "stats",
        "--no-stream",
        "--format",
        "{{json .}}",
        "agentdb-postgres",
    ])

    if result["returncode"] != 0:
        return {
            "error": result["stderr"].strip()
        }

    try:
        return json.loads(
            result["stdout"].strip()
        )
    except json.JSONDecodeError:
        return {
            "raw": result["stdout"].strip()
        }


def collect_runtime_state():
    return {
        "host": collect_host_state(),
        "postgres_container": collect_docker_state(),
    }


# ============================================================
# RUNTIME MONITORING THREAD
# ============================================================

def monitor_runtime(samples, stop_event):
    while not stop_event.is_set():

        samples.append(
            collect_runtime_state()
        )

        stop_event.wait(SAMPLE_INTERVAL)


# ============================================================
# POSTGRESQL STATE
# ============================================================

def collect_postgres_state():

    sql = """
    SELECT
        current_setting('server_version'),
        current_setting('shared_buffers'),
        current_setting('work_mem'),
        current_setting('maintenance_work_mem'),
        current_setting('effective_cache_size'),
        current_setting('max_connections'),
        current_setting('max_worker_processes'),
        current_setting('max_parallel_workers'),
        current_setting('max_parallel_workers_per_gather'),
        current_setting('random_page_cost'),
        current_setting('seq_page_cost');
    """

    result = run_command([
        "docker",
        "exec",
        "agentdb-postgres",
        "psql",
        "-U",
        DB_CONFIG["user"],
        "-d",
        DB_CONFIG["database"],
        "-At",
        "-F",
        "|",
        "-c",
        sql,
    ])

    if result["returncode"] != 0:
        return {
            "error": result["stderr"].strip()
        }

    values = result["stdout"].strip().split("|")

    keys = [
        "server_version",
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

    if len(values) != len(keys):
        return {
            "raw": result["stdout"].strip()
        }

    return dict(zip(keys, values))


# ============================================================
# SYSBENCH OUTPUT PARSER
# ============================================================

def parse_sysbench_output(output):

    result = {}

    patterns = {
        "tps": r"transactions:\s+\d+\s+\(([\d.]+)\s+per sec\.\)",
        "qps": r"queries:\s+\d+\s+\(([\d.]+)\s+per sec\.\)",
        "total_queries": r"queries:\s+(\d+)",
        "total_transactions": r"transactions:\s+(\d+)",
        "errors": r"errors:\s+(\d+)",
        "reconnects": r"reconnects:\s+(\d+)",
        "total_time": r"total time:\s+([\d.]+)s",
        "latency_min": r"min:\s+([\d.]+)",
        "latency_avg": r"avg:\s+([\d.]+)",
        "latency_max": r"max:\s+([\d.]+)",
        "latency_p95": r"95th percentile:\s+([\d.]+)",
    }

    for key, pattern in patterns.items():

        match = re.search(
            pattern,
            output
        )

        if not match:
            continue

        value = match.group(1)

        if key in {
            "total_queries",
            "total_transactions",
            "errors",
            "reconnects",
        }:
            result[key] = int(value)
        else:
            result[key] = float(value)

    return result


# ============================================================
# RUN ONE SYSBENCH EXPERIMENT
# ============================================================

def run_sysbench(threads, run_number):

    print()
    print("=" * 70)
    print(
        f"S2 | {threads} threads | "
        f"run {run_number}/{RUNS_PER_LEVEL}"
    )
    print("=" * 70)

    command = [
        "sysbench",

        "--db-driver=pgsql",

        f"--pgsql-host={DB_CONFIG['host']}",
        f"--pgsql-port={DB_CONFIG['port']}",
        f"--pgsql-user={DB_CONFIG['user']}",
        f"--pgsql-password={DB_CONFIG['password']}",
        f"--pgsql-db={DB_CONFIG['database']}",

        f"--tables={TABLES}",
        f"--table-size={TABLE_SIZE}",

        f"--threads={threads}",
        f"--time={DURATION_SECONDS}",
        f"--report-interval={REPORT_INTERVAL}",

        WORKLOAD,
        "run",
    ]

    print(
        f"Workload: {WORKLOAD}\n"
        f"Threads: {threads}\n"
        f"Duration: {DURATION_SECONDS}s"
    )

    start_time = time.time()

    runtime_samples = []

    stop_monitoring = threading.Event()

    monitor_thread = threading.Thread(
        target=monitor_runtime,
        args=(
            runtime_samples,
            stop_monitoring,
        ),
        daemon=True,
    )

    monitor_thread.start()

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    output_lines = []

    try:

        for line in process.stdout:

            print(line, end="")

            output_lines.append(line)

    finally:

        process.wait()

        stop_monitoring.set()
        monitor_thread.join(timeout=2)

    end_time = time.time()

    output = "".join(output_lines)

    metrics = parse_sysbench_output(
        output
    )

    result = {
        "experiment": "S2",
        "machine_id": MACHINE_ID,

        "concurrency": threads,
        "run_number": run_number,

        "started_at": utc_now(),
        "duration_wall_clock_seconds":
            round(end_time - start_time, 3),

        "command": command,

        "exit_code": process.returncode,

        "metrics": metrics,

        "runtime_samples": runtime_samples,
    }

    return result


# ============================================================
# MAIN EXPERIMENT
# ============================================================

def main():

    print("=" * 70)
    print("AgentDB - Sysbench S2: Concurrency Scaling")
    print("=" * 70)

    # --------------------------------------------------------
    # Check machine fingerprint
    # --------------------------------------------------------

    if not FINGERPRINT_FILE.exists():

        print(
            "\nERROR: Machine fingerprint not found."
        )

        print(
            f"Expected:\n{FINGERPRINT_FILE}"
        )

        print(
            "\nRun first:\n"
            "./machines/fingerprint.sh"
        )

        return 1

    # --------------------------------------------------------
    # Create result directory
    # --------------------------------------------------------

    RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Collect experiment metadata
    # --------------------------------------------------------

    experiment_metadata = {

        "experiment": "S2",

        "name": (
            "Sysbench Concurrency Scaling"
        ),

        "machine_id": MACHINE_ID,

        "fingerprint_file": str(
            FINGERPRINT_FILE.relative_to(
                PROJECT_ROOT
            )
        ),

        "started_at": utc_now(),

        "objective": (
            "Measure how throughput, latency and "
            "resource usage change as concurrency "
            "increases under a fixed read-only "
            "OLTP workload."
        ),

        "methodology": {
            "workload": WORKLOAD,
            "tables": TABLES,
            "rows_per_table": TABLE_SIZE,
            "duration_seconds":
                DURATION_SECONDS,
            "concurrency_levels":
                CONCURRENCY_LEVELS,
            "runs_per_level":
                RUNS_PER_LEVEL,
        },

        "git": git_info(),

        "postgresql":
            collect_postgres_state(),

        "initial_runtime_state":
            collect_runtime_state(),
    }

    with open(
        RESULTS_DIR / "experiment.json",
        "w"
    ) as file:

        json.dump(
            experiment_metadata,
            file,
            indent=2
        )

    # --------------------------------------------------------
    # Run all concurrency levels
    # --------------------------------------------------------

    all_results = []

    for threads in CONCURRENCY_LEVELS:

        level_dir = (
            RESULTS_DIR
            / f"concurrency_{threads:02d}"
        )

        level_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        for run_number in range(
            1,
            RUNS_PER_LEVEL + 1
        ):

            result = run_sysbench(
                threads,
                run_number
            )

            output_file = (
                level_dir
                / f"run_{run_number:02d}.json"
            )

            with open(
                output_file,
                "w"
            ) as file:

                json.dump(
                    result,
                    file,
                    indent=2
                )

            all_results.append(
                result
            )

            print(
                f"\nSaved: {output_file}"
            )

    # ========================================================
    # BUILD SUMMARY
    # ========================================================

    summary = {

        "experiment": "S2",

        "machine_id": MACHINE_ID,

        "concurrency_levels": {},
    }

    metrics_to_summarize = [
        "tps",
        "qps",
        "latency_avg",
        "latency_p95",
        "latency_max",
    ]

    for threads in CONCURRENCY_LEVELS:

        runs = [
            result
            for result in all_results
            if result["concurrency"] == threads
        ]

        level_summary = {
            "runs": len(runs),
            "metrics": {},
        }

        for metric in metrics_to_summarize:

            values = [
                result["metrics"][metric]
                for result in runs
                if metric in result["metrics"]
            ]

            if not values:
                continue

            metric_summary = {

                "mean": mean(values),

                "min": min(values),

                "max": max(values),
            }

            if len(values) > 1:

                metric_summary["stddev"] = (
                    stdev(values)
                )

            level_summary["metrics"][
                metric
            ] = metric_summary

        level_summary["total_errors"] = sum(
            result["metrics"].get(
                "errors",
                0
            )
            for result in runs
        )

        summary["concurrency_levels"][
            str(threads)
        ] = level_summary

    summary["completed_at"] = utc_now()

    with open(
        RESULTS_DIR / "summary.json",
        "w"
    ) as file:

        json.dump(
            summary,
            file,
            indent=2
        )

    # ========================================================
    # PRINT SUMMARY
    # ========================================================

    print()
    print("=" * 70)
    print("S2 COMPLETE")
    print("=" * 70)

    print(
        f"\nResults saved to:\n"
        f"{RESULTS_DIR}"
    )

    print("\nSummary:")

    for threads in CONCURRENCY_LEVELS:

        level = summary[
            "concurrency_levels"
        ][str(threads)]

        print(
            f"\n{threads} threads"
        )

        for metric, values in level[
            "metrics"
        ].items():

            print(
                f"  {metric}: "
                f"{values['mean']:.2f}"
            )

        print(
            f"  errors: "
            f"{level['total_errors']}"
        )

    print()
    print(
        "S2 has finished. "
        "Review the JSON results before committing them."
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())