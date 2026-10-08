"""Quick end-to-end check of the AgentDB collector API.

Usage:  .venv/bin/python backend/scripts/verify_api.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://127.0.0.1:8000/api"


def get(path: str):
    with urllib.request.urlopen(BASE + path, timeout=120) as response:
        return json.load(response)


def post(path: str, payload: dict | None = None):
    body = json.dumps(payload or {}).encode()
    request = urllib.request.Request(
        BASE + path, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)


def main() -> None:
    info = get("/database/info")
    print(f"info        : {info['versionShort']} / {info['databaseName']} / {info['sizeBytes'] / 1e6:.0f} MB")

    for table in get("/schema/tables"):
        if table["name"].startswith("agentdb_"):
            continue
        print(
            f"table       : {table['name']:12} rows={table['rows']:>9,} "
            f"seq={table['seqScans']:>6,} idx={table['indexScans']:>9,} "
            f"{table['sizeBytes'] / 1e6:7.1f}MB {table['health']['status']}"
        )

    for index in get("/schema/indexes"):
        if index["table"].startswith("agentdb_"):
            continue
        flag = "  <-- UNUSED" if index["usage"] == "UNUSED" else ""
        print(f"index       : {index['name']:34} {index['table']:12} scans={index['scans']:>9,}{flag}")

    print("config      :", ", ".join(
        f"{p['name']}={p['currentValue']}" for p in get("/schema/configuration")[:3]
    ))

    queries = get("/queries/top?limit=4")
    for row in queries:
        print(
            f"query       : calls={row['calls']:>9,} mean={row['meanExecTimeMs']:9.3f}ms "
            f"{row['severity']:6} {row['label'][:34]}"
        )

    perf = get("/state")["performance"]
    print(f"performance : tps={perf['tps']} qps={perf['qps']} mean={perf['avgLatencyMs']}ms "
          f"cache={perf['cacheHitRatio']} cpu={perf['cpuPercent']}%")
    print(f"series      : {len(get('/state')['series']['tps'])} tps points")

    ids = get("/plans/query-ids")
    print(f"plan ids    : {ids[:3]}")
    if ids:
        plan = get(f"/plans/{ids[0]}")
        if plan:
            print(f"plan root   : {plan['root']['nodeType']} cost={plan['totalCost']:.0f} "
                  f"bottlenecks={[(b['nodeType'], b['relation']) for b in plan['bottlenecks']][:2]}")
            analysis = post(f"/queries/{ids[0]}/analyze")
            print(f"analyze     : {analysis['status']} | {analysis['suspectedIssues'][0]['title']}")

    events = get("/activity")
    print(f"events      : {len(events)}")
    for event in events[:3]:
        print(f"  event     : {event['type']:14} {event['message'][:64]}")

    runner = get("/runner/status")
    print(f"runner      : sysbench={runner['sysbench']} pgbench={runner['pgbench']} "
          f"busy={runner['busy']} workloads={len(runner['workloads'])}")

    benchmarks = get("/benchmarks")
    print(f"benchmarks  : {[b['id'] for b in benchmarks]}")

    print("\nAll endpoints responded.")


if __name__ == "__main__":
    main()
