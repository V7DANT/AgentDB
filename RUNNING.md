# Running AgentDB

Three processes must be running for the dashboard to show live data.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  PostgreSQL  │────▶│  Collector API   │────▶│  Dashboard   │
│  (Docker)    │     │  FastAPI :8000   │     │  Vite :5173  │
└──────────────┘     └──────────────────┘     └──────────────┘
docker compose            backend/                frontend/
```

## TL;DR (VS Code)

`Ctrl+Shift+P` → **Tasks: Run Task** → **`AgentDB: Start All`**, then open
<http://localhost:5173>.

> **Docker does not start automatically.** `docker-compose.yml` has no `restart:`
> policy, so after a reboot you must run step 1 yourself.

## Manual start — three terminals

### 1. PostgreSQL

```bash
cd /home/vedant-bothra/projects/agent-db
docker compose up -d
docker compose ps          # agentdb-postgres should say "Up"
```

### 2. Collector API

```bash
cd /home/vedant-bothra/projects/agent-db/backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On the first run this creates its tables and seeds the application schema
(1M orders, 2M order items) — about a minute. Later starts are instant.

* Health check: <http://127.0.0.1:8000/api/health>
* API docs: <http://127.0.0.1:8000/docs>

### 3. Frontend

```bash
cd /home/vedant-bothra/projects/agent-db/frontend
npm run dev
```

Open <http://localhost:5173>.

## Port already in use

```bash
pkill -f "uvicorn app.main:app"     # frees 8000
pkill -f vite                       # frees 5173
```

## Verify every endpoint

```bash
cd /home/vedant-bothra/projects/agent-db
.venv/bin/python backend/scripts/verify_api.py
```

## Demo flow

1. **Benchmarks** → **Run workload** → `oltp_read_only`, 30s, 4 threads.
   Watch Dashboard / Queries / Tables / Indexes update live while it runs.
2. **Reset statistics** between measurements so each window is attributable.
3. For the index story use the **`app_mixed`** pgbench workload — it queries
   `orders.customer_id` and `order_items.product_id`, which have **no index**, so
   sequential-scan counters climb visibly.

## Make Docker start on boot (optional)

Add one line to `docker-compose.yml`:

```yaml
services:
  postgres:
    restart: unless-stopped
```
