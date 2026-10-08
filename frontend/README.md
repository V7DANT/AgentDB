# AgentDB Frontend — Control & Observability Dashboard

The operator-facing console for **AgentDB**, an autonomous PostgreSQL optimization
research project. It surfaces the system's full architecture — Observe → Reason → Act →
Measure → Learn — even though the backend is being built incrementally.

> **This is a frontend prototype.** No FastAPI backend, PostgreSQL connection, ML model,
> RAG pipeline or optimization executor is connected. Every observability figure,
> recommendation, expert and retrieval result is generated in the browser from a mock
> repository. The UI labels simulated content explicitly and repeatedly — see
> [Research honesty](#research-honesty).

---

## 1. Purpose

AgentDB aims to autonomously optimize a PostgreSQL instance using specialized experts
(query/planner, index, configuration) validated by controlled benchmarks and improved over
time through an experience repository. This frontend exists to:

1. Define and validate the **interface contract** between the operator and the agent before
   the backend exists.
2. Make the **complete architecture legible** to a reviewer — every stage of the loop has a
   real page, not a placeholder.
3. Be **API-ready**: replacing mock data with real REST endpoints requires no UI redesign.

It is not a benchmark visualisation site. It is a control and observability console.

---

## 2. Technology stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 (custom dark design tokens) |
| Routing | React Router 6 |
| Charts | Recharts 2 |
| Icons | lucide-react |
| State | React context + `useSyncExternalStore` (no Redux) |

No other runtime dependencies are used.

---

## 3. Running it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
```

---

## 4. Folder structure

```
frontend/src/
├── app/                  Route table, navigation config, error boundary
├── components/
│   ├── activity/         Agent event timeline
│   ├── charts/           Recharts primitives (shared visual language)
│   ├── common/           Breadcrumbs
│   ├── layout/           Sidebar, header, app shell
│   ├── optimization/     Recommendation card, approve/reject dialogs, decision hook
│   ├── plan/             EXPLAIN plan tree + node inspector
│   └── ui/               Design-system primitives (panel, button, badge, table, …)
├── data/                 Mock dataset (one module per domain) + clock/context constants
├── hooks/                useServiceQuery, useMutation, useLocalStorage
├── pages/                One module per route (list + detail pages co-located)
├── services/
│   ├── contracts.ts      All service interfaces + the AgentDbServices container
│   ├── api/              REST implementations + fetch client
│   ├── mock/             In-memory implementations + reactive runtime
│   ├── ServiceProvider   React context exposing the container
│   └── createServices.ts The single factory that picks mock vs. API
├── types/                Domain model (one module per domain + barrel)
└── utils/                Formatting, deterministic series generation, cn()
```

The separation is strict:

- **UI** never imports from `data/` or `services/mock/`.
- **Domain types** live in `types/` and are imported by everyone.
- **Data access** happens only through `services/contracts.ts` interfaces.

---

## 5. Pages

| Section | Route | Page |
|---|---|---|
| Overview | `/` | Dashboard — connection facts, 6 KPIs, TPS and P95 charts, top queries, recent activity |
| Workload | `/queries` | Query table: search, severity filter, sortable columns, pagination |
| | `/queries/:id` | Query detail — statistics, mean-latency trend, **Analyze query**, related optimizations |
| | `/plans`, `/plans/:id` | Execution plan tree with node inspector and bottleneck detection |
| Database | `/tables`, `/tables/:name` | Table statistics, columns, indexes, tuple health |
| | `/indexes`, `/indexes/:name` | Index inventory with unused-index warnings and usage share |
| | `/configuration`, `/configuration/:name` | PostgreSQL parameters with proposals |
| Optimization | `/recommendations`, `/recommendations/:id` | Optimization centre: detected problem → proposed change → approve/reject |
| | `/agent/activity` | Decision-cycle event timeline |
| | `/history`, `/history/:id` | Applied changes with before/after comparison and validation runner |
| Experiments | `/benchmarks`, `/benchmarks/:id` | S1/S2 results and concurrency charts |

### Scope rule

The navigation contains **only** pages whose data is readable from PostgreSQL today
(`pg_stat_*`, `pg_catalog`, `EXPLAIN`) or from the committed benchmark result files.

Pages for components that cannot be built yet were deliberately removed rather than shown
with placeholder data:

| Removed | Why |
|---|---|
| Retrieval / RAG | Needs an embedding model and a vector store — not a frontend concern and not implementable now |
| Experts | The three ML models are not trained; any metric shown would have been invented |
| Agent Controls | Meaningless without a running agent loop |
| Pending Actions | Duplicated the Recommendations page; the inline approve/reject workflow now lives there |
| Experience Repository | Duplicated the History page; the history record *is* the stored experience |

The page count went from 16 to 9 as a result. Every remaining page is one the backend can fill
with real data.


---

## 6. Service architecture (the important part)

Components never call `fetch`. They depend on interfaces:

```ts
interface QueryService {
  getQueries(options?): Promise<QueryStat[]>;
  getQuery(id: string): Promise<QueryStat>;
  analyzeQuery(id: string): Promise<QueryAnalysis>;
}

interface OptimizationService {
  getRecommendations(): Promise<Optimization[]>;
  approve(input: ApproveOptimizationInput): Promise<Optimization>;
  reject(input: RejectOptimizationInput): Promise<Optimization>;
  runValidation(recordId: string): Promise<OptimizationRecord>;
}

interface StateService {
  getDatabaseInfo(): Promise<DatabaseInfo>;
  getCurrentState(): Promise<DatabaseState>;
}
```

Seven services are defined in `services/contracts.ts`:

`StateService`, `QueryService`, `PlanService`, `SchemaService` (tables / indexes / configuration),
`OptimizationService`, `ActivityService`, `BenchmarkService`.

Each has two complete implementations:

- `services/mock/Mock*Service.ts` — backed by an in-memory runtime (default)
- `services/api/Api*Service.ts` — REST over the shared `fetch` client

### Swapping mock → API

Create `frontend/.env.local`:

```bash
VITE_AGENTDB_DATA_SOURCE=api
VITE_AGENTDB_API_BASE_URL=http://localhost:8000/api
```

Nothing else changes. The endpoint paths the frontend expects are documented inline in
`services/api/ApiServices.ts` (e.g. `GET /queries`, `POST /optimizations/:id/approve`,
`GET /plans/:queryId`, `POST /experience/retrieve`).

### Data flow

```
User action
   ↓
useMutation → AgentDbServices.optimizations.approve(...)
   ↓
MockOptimizationService mutates the reactive runtime and emits
   ↓
ServiceProvider revision increments
   ↓
Every mounted useServiceQuery re-fetches
   ↓
Queue count, history, activity feed and dashboard all update
```

This is why approving a recommendation on `/pending` immediately changes the sidebar badge,
the header notification count, the history table and the activity timeline. Against the API
container the same effect is achieved by calling `services.invalidate()` after a mutation.

`useServiceQuery` keeps previously loaded data on screen while refreshing, so mutations never
cause a flash of empty content.

---

## 7. Mock data architecture

`services/mock/runtime.ts` holds a single `MockRuntime` instance containing the mutable
collections: optimizations, optimization records, experiences, activity events, agent control
state and submitted experiment runs. All mock services read and write through it.

`data/` holds the seeded dataset, one module per domain. Consistency between pages is
deliberate, not accidental:

- The expensive query `q-001` (sequential scan on `orders`, 15,230 calls, 42.1 ms mean) is the
  motivation for recommendation `opt-001` (`CREATE INDEX orders_customer_id_idx`).
- Every index that exists today has a corresponding **validated** history record explaining it.
- The one **failed** configuration experiment (`random_page_cost` 4.0 → 2.0, reverted) explains
  why that parameter is still at its default — so the configuration page and the history agree.
- Approving a recommendation appends a record, an activity event and, after validation, an
  Experience Repository entry.

Seeded benchmark data is transcribed from the committed result artefacts:

- **S1** mean/min/max/σ from `results/vedant-bothra/sysbench/S1/summary.json`; per-run values
  reconstruct those statistics exactly.
- **S2** all concurrency-level means, minima, maxima and standard deviations from
  `results/vedant-bothra/sysbench/S2/summary.json`. Zero values are invented; the marginal
  per-thread gains quoted in the observations are computed from the recorded means.
- The PostgreSQL configuration page shows the **real** GUC values recorded in
  `S2/experiment.json`.

The Benchmarks page also surfaces an open question rather than hiding it: S1 (4 threads) reports
1,441.35 TPS while S2 at the same concurrency reports 1,913.39 TPS, and the recorded metadata
does not explain the difference.

Use **Reset demo** in the header to restore the seeded dataset.

---

## 8. Research honesty

The UI must not imply that unbuilt components exist. Accordingly:

| Claim | How the UI handles it |
|---|---|
| A banner on every page | States that the observability pages are designed to read live PostgreSQL statistics and that mock values are labelled |
| Simulated panels | Carry a `Simulated` / `Mock data` badge |
| Execution plans | Labelled "Simulated plans"; states that real `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output will use the same renderer |
| Benchmark data | Marked `Recorded results` (from the committed files) vs. `Mock data` |
| Validation results | A measured change below 1.5% is reported as *within run-to-run variability* and no improvement is claimed |
| Removed features | Not shown at all, rather than shown with invented values |

Consequently the dashboard never claims that an LLM is optimizing PostgreSQL, that RAG is
implemented, that experts are trained, or that metrics are live.

---

## 9. What is implemented vs. simulated

**Implemented (frontend):** routing, layout, design system, all 9 pages, sorting/filtering/
search/pagination, loading/empty/error states, dialogs, toasts, charts, responsive layout,
the full service layer with two implementations, and a working mutate-then-refresh data flow.

**Simulated until the backend lands:** database state, workload statistics, table/index/
configuration statistics, execution plans, query analysis, recommendations and their
confidence/expected-gain figures, approval execution, and validation results.

**Not implemented anywhere yet:** the State Collector, agent, experts, validator, executor,
FastAPI API, RAG, and any database connection.

### Recommended implementation order

1. **Observability (~1.5 days)** — FastAPI + psycopg behind `StateService`, `QueryService`,
   `PlanService`, `SchemaService`. Turns Dashboard / Queries / Execution Plans / Tables /
   Indexes / Configuration into live data.
2. **Optimization loop (~2 days)** — rule-based detector behind `OptimizationService`, real DDL
   execution, measurement before/after, results written to a history table. Reuses the existing
   approve → validate → history flow.
3. **Benchmarks (~2 h)** — serve the existing `results/**` JSON from an endpoint.

Set `VITE_AGENTDB_DATA_SOURCE=api` after step 1 and the UI switches over with no code changes.


---

## 10. Design notes

- Dark theme only, cool desaturated neutral palette with a single restrained accent.
- Tighter corner radii and 1px borders instead of large rounded cards, to avoid a generic
  admin-template look.
- Tabular figures (`tabular-nums`) on all numeric columns so tables and stat tiles align.
- Charts share one grid, axis and tooltip style so the dashboard reads as one system.
- Status is never communicated by colour alone — every badge and bar carries a label.
- Responsive from ~380 px (sidebar becomes an overlay drawer) up to ultrawide.
