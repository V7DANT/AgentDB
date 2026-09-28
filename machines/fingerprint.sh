#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACHINE_ID="$(hostname | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]_-')"
OUTPUT_DIR="$PROJECT_ROOT/machines/$MACHINE_ID"
OUTPUT_FILE="$OUTPUT_DIR/environment.txt"

mkdir -p "$OUTPUT_DIR"

{
    echo "============================================================"
    echo "AgentDB Machine Environment Fingerprint"
    echo "============================================================"
    echo

    echo "Generated:"
    date --iso-8601=seconds

    echo
    echo "Machine ID:"
    echo "$MACHINE_ID"

    echo
    echo "------------------------------------------------------------"
    echo "HARDWARE"
    echo "------------------------------------------------------------"

    echo
    echo "[CPU]"
    lscpu | grep -E \
        'Model name|Socket|Core|Thread|CPU\(s\)|Architecture|MHz|CPU max MHz|CPU min MHz' \
        || true

    echo
    echo "[RAM]"
    free -h

    echo
    echo "[Storage]"
    lsblk -o NAME,MODEL,SIZE,TYPE,FSTYPE,MOUNTPOINTS

    echo
    echo "------------------------------------------------------------"
    echo "OPERATING SYSTEM"
    echo "------------------------------------------------------------"

    echo
    echo "[OS]"
    if [ -f /etc/os-release ]; then
        cat /etc/os-release
    fi

    echo
    echo "[Kernel]"
    uname -a

    echo
    echo "[Architecture]"
    uname -m

    echo
    echo "------------------------------------------------------------"
    echo "SOFTWARE"
    echo "------------------------------------------------------------"

    echo
    echo "[Docker]"
    docker --version 2>&1 || true

    echo
    echo "[Docker Compose]"
    docker compose version 2>&1 || true

    echo
    echo "[Python]"
    python3 --version 2>&1 || true

    echo
    echo "[Sysbench]"
    sysbench --version 2>&1 || true

    echo
    echo "------------------------------------------------------------"
    echo "DOCKER / POSTGRESQL"
    echo "------------------------------------------------------------"

    echo
    echo "[Docker Containers]"
    docker ps --format \
        'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' \
        2>&1 || true

    echo
    echo "[PostgreSQL Version]"
    docker exec agentdb-postgres \
        psql -U postgres -d agentdb -tAc "SELECT version();" \
        2>&1 || true

    echo
    echo "[PostgreSQL Settings]"
    docker exec agentdb-postgres \
        psql -U postgres -d agentdb -c "
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
        " 2>&1 || true

    echo
    echo "[PostgreSQL Image]"
    docker inspect agentdb-postgres \
        --format '{{.Config.Image}}' \
        2>&1 || true

    echo
    echo "[PostgreSQL Container Limits]"
    docker inspect agentdb-postgres \
        --format 'CPU limit: {{.HostConfig.NanoCpus}} | Memory limit: {{.HostConfig.Memory}} bytes' \
        2>&1 || true

    echo
    echo "------------------------------------------------------------"
    echo "END OF FINGERPRINT"
    echo "------------------------------------------------------------"

} > "$OUTPUT_FILE"

echo "Machine fingerprint created:"
echo "$OUTPUT_FILE"