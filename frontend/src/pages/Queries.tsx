import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  GitBranch,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { QueryAnalysis, QuerySeverity, QuerySortKey } from '@/types';
import { PageHeader, Pagination, SearchInput, Select, SqlSnippet } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, SectionLabel } from '@/components/ui/Panel';
import { DataTable, type Column, type SortState } from '@/components/ui/Table';
import { Badge, DataSourceBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { ConfidenceBar } from '@/components/ui/Progress';
import { ChartFrame, TimeSeriesChart } from '@/components/charts/Charts';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useDebouncedValue, useServiceQuery } from '@/hooks';
import { useServices } from '@/services';
import {
  formatCompactNumber,
  formatFixed,
  formatMs,
  formatNumber,
  formatPercent,
} from '@/utils/format';

const PAGE_SIZE = 10;

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

const SORT_KEYS: QuerySortKey[] = ['totalExecTimeMs', 'meanExecTimeMs', 'calls', 'rows', 'cacheHitRatio'];

export function QueriesPage() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<QuerySeverity | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortState>({ key: 'totalExecTimeMs', direction: 'desc' });
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);
  const navigate = useNavigate();

  const queries = useServiceQuery(
    (services) =>
      services.queries.getQueries({
        filter: { search: debouncedSearch, severity },
        sort: SORT_KEYS.includes(sort.key as QuerySortKey)
          ? { key: sort.key as QuerySortKey, direction: sort.direction }
          : undefined,
      }),
    [debouncedSearch, severity, sort.key, sort.direction],
  );

  const rows = queries.data ?? [];
  const paged = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  const counts = useMemo(
    () => ({
      high: rows.filter((row) => row.severity === 'HIGH').length,
      medium: rows.filter((row) => row.severity === 'MEDIUM').length,
      low: rows.filter((row) => row.severity === 'LOW').length,
    }),
    [rows],
  );

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'query',
      header: 'Query',
      width: '38%',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-base-100">{row.label ?? 'Statement'}</p>
          <SqlSnippet sql={row.query} maxLength={78} className="text-base-400" />
          <p className="mt-0.5 font-mono text-2xs text-base-500">queryid {row.queryId}</p>
        </div>
      ),
    },
    {
      key: 'calls',
      header: 'Calls',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatCompactNumber(row.calls)}</span>,
    },
    {
      key: 'totalExecTimeMs',
      header: 'Total time',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="mono-num text-xs">{formatFixed(row.totalExecTimeMs / 1000, 1)}s</span>
      ),
    },
    {
      key: 'meanExecTimeMs',
      header: 'Mean time',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatMs(row.meanExecTimeMs)}</span>,
    },
    {
      key: 'cache',
      header: 'Cache hit',
      align: 'right',
      tooltip: 'shared_blks_hit / (shared_blks_hit + shared_blks_read)',
      render: (row) => (
        <span
          className={`mono-num text-xs ${row.cacheHitRatio < 0.85 ? 'text-status-warn' : 'text-base-100'}`}
        >
          {formatPercent(row.cacheHitRatio, 1)}
        </span>
      ),
    },
    {
      key: 'diskReads',
      header: 'Disk reads',
      align: 'right',
      tooltip: 'shared_blks_read — blocks read from disk rather than the buffer cache',
      render: (row) => (
        <span className="mono-num text-xs">{formatCompactNumber(row.sharedBlksRead)}</span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Query workload"
        description="pg_stat_statements — normalized statements ordered by total execution time. Every optimization recommendation in AgentDB originates from a row in this table."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={queries.reload}
            loading={queries.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              <span className="text-status-danger">{counts.high} high</span> ·{' '}
              <span className="text-status-warn">{counts.medium} medium</span> ·{' '}
              <span className="text-status-ok">{counts.low} low</span>
            </span>
          </>
        }
      />

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-base-400" />
            Statements
            <span className="mono-num text-xs font-normal text-base-400">({rows.length})</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search SQL, label or queryid…"
            />
            <Select
              value={severity}
              onChange={(value) => {
                setSeverity(value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All severities' },
                { value: 'HIGH', label: 'High only' },
                { value: 'MEDIUM', label: 'Medium only' },
                { value: 'LOW', label: 'Low only' },
              ]}
            />
          </div>
        }
      >
        <AsyncBoundary
          state={queries}
          skeleton={<TableSkeleton rows={8} columns={6} />}
          loadingLabel="Loading workload…"
          isEmpty={(data) => data.length === 0}
          emptyTitle="No statements match these filters"
          emptyDescription="Adjust the search term or severity filter."
          emptyAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setSeverity('ALL');
              }}
            >
              Clear filters
            </Button>
          }
        >
          {() => (
            <>
              <DataTable
                columns={columns}
                rows={paged}
                getRowKey={(row) => row.id}
                sort={sort}
                onSortChange={(next) => {
                  setSort(next);
                  setPage(1);
                }}
                onRowClick={(row) => navigate(`/queries/${row.id}`)}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            </>
          )}
        </AsyncBoundary>
      </PanelSection>

      <Notice tone="neutral">
        Severity is derived from mean execution time: ≥ 25 ms is HIGH, ≥ 8 ms is MEDIUM. The State
        Collector will populate this table from pg_stat_statements once implemented.
      </Notice>
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function QueryDetailPage() {
  const { queryId = '' } = useParams();
  const services = useServices();

  const [analysis, setAnalysis] = useState<QueryAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<Error | null>(null);

  const query = useServiceQuery((s) => s.queries.getQuery(queryId), [queryId]);
  const trend = useServiceQuery((s) => s.queries.getQueryTrend(queryId), [queryId]);
  const related = useServiceQuery(async (s) => {
    const all = await s.optimizations.getAllOptimizations();
    return all.filter((optimization) => optimization.queryId === queryId);
  }, [queryId]);

  const runAnalysis = async () => {
    setAnalysing(true);
    setAnalysisError(null);
    try {
      setAnalysis(await services.queries.analyzeQuery(queryId));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setAnalysing(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={query.data?.label ?? 'Query detail'}
        description="Normalized statement statistics, execution trend and the analysis interface the Query/Planner Expert will implement."
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Workload', to: '/queries' },
              { label: 'Queries', to: '/queries' },
              { label: query.data?.queryId ?? queryId },
            ]}
          />
        }
        actions={
          <>
            <LinkButton
              to="/queries"
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Back
            </LinkButton>
            <LinkButton
              to={`/plans/${queryId}`}
              variant="outline"
              size="sm"
              icon={<GitBranch className="h-3.5 w-3.5" />}
            >
              Execution plan
            </LinkButton>
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              loading={analysing}
              onClick={runAnalysis}
            >
              Analyze query
            </Button>
          </>
        }
      />

      <AsyncBoundary
        state={query}
        skeleton={<TableSkeleton rows={6} columns={3} />}
        loadingLabel="Loading statement…"
      >
        {(data) => (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Panel>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>Normalized statement</SectionLabel>
                    <SeverityBadge severity={data.severity} />
                  </div>
                  <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-base-700/70 bg-base-950/70 px-3 py-3 font-mono text-xs leading-relaxed text-base-100">
                    {data.query}
                  </pre>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="queryid" value={data.queryId} mono />
                    <Field label="Fingerprint" value={data.fingerprint} mono />
                    <Field label="Calls" value={formatNumber(data.calls)} mono />
                    <Field label="Rows returned" value={formatNumber(data.rows)} mono />
                  </div>
                </Panel>

                <ChartFrame
                  title="Mean execution time"
                  description="Recent observations (ms)"
                  height={220}
                  footer="Each point is one observation window. Drift detection compares the latest value against the S1 variability band."
                >
                  <AsyncBoundary state={trend} skeleton={<div className="h-full" />}>
                    {(points) => (
                      <TimeSeriesChart
                        points={points}
                        tone={data.severity === 'HIGH' ? 'danger' : data.severity === 'MEDIUM' ? 'warn' : 'ok'}
                        unit="ms"
                        decimals={2}
                      />
                    )}
                  </AsyncBoundary>
                </ChartFrame>

                <PanelSection
                  title="Optimizations linked to this statement"
                  description="Recommendations and applied changes derived from this query"
                  actions={
                    <LinkButton to="/recommendations" variant="ghost" size="sm">
                      All recommendations
                    </LinkButton>
                  }
                >
                  <AsyncBoundary state={related} skeleton={<TableSkeleton rows={2} columns={3} />}>
                    {(items) =>
                      items.length === 0 ? (
                        <EmptyState
                          compact
                          title="No optimization references this statement"
                          description="The agent has not proposed a change for this query yet."
                        />
                      ) : (
                        <ul className="divide-y divide-base-800/70">
                          {items.map((item) => (
                            <li key={item.id}>
                              <Link
                                to={`/recommendations/${item.id}`}
                                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-base-800/40"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs text-base-100">{item.title}</span>
                                  <code className="mt-0.5 block truncate font-mono text-2xs text-base-400">
                                    {item.statement}
                                  </code>
                                </span>
                                <Badge tone={item.status === 'PENDING' ? 'warn' : 'ok'}>
                                  {item.status}
                                </Badge>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  </AsyncBoundary>
                </PanelSection>
              </div>

              <div className="space-y-4">
                <Panel>
                  <SectionLabel>Execution statistics</SectionLabel>
                  <dl className="mt-2.5 divide-y divide-base-800/70">
                    <MetricRow label="Total execution time" value={`${formatFixed(data.totalExecTimeMs / 1000, 1)} s`} />
                    <MetricRow label="Mean execution time" value={formatMs(data.meanExecTimeMs)} />
                    <MetricRow label="Calls" value={formatNumber(data.calls)} />
                    <MetricRow label="Rows" value={formatNumber(data.rows)} />
                    <MetricRow label="Shared blocks hit" value={formatNumber(data.sharedBlksHit)} />
                    <MetricRow label="Shared blocks read" value={formatNumber(data.sharedBlksRead)} />
                    <MetricRow
                      label="Cache hit ratio"
                      value={formatPercent(data.cacheHitRatio, 2)}
                      tone={data.cacheHitRatio < 0.85 ? 'warn' : 'ok'}
                    />
                    <MetricRow
                      label="Rows per call"
                      value={formatFixed(data.rows / data.calls, 1)}
                    />
                  </dl>
                </Panel>

                <Panel>
                  <SectionLabel>Analysis</SectionLabel>
                  {analysis === null ? (
                    <div className="mt-3">
                      <p className="text-xs leading-relaxed text-base-300">
                        No analysis has been requested for this statement. The button below calls
                        the same service method the Query/Planner Expert will back — today it
                        returns a deterministic simulation derived from the statement's own
                        statistics and plan.
                      </p>
                      {analysisError ? (
                        <p className="mt-2 text-2xs text-status-danger">{analysisError.message}</p>
                      ) : null}
                      <Button
                        className="mt-3"
                        variant="primary"
                        size="sm"
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        loading={analysing}
                        onClick={runAnalysis}
                      >
                        Analyze query
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <Notice tone="warning">
                        Rule-based analysis over the live plan and statistics — no ML model was
                        involved. Generated{' '}
                        {new Date(analysis.generatedAt).toLocaleTimeString('en-US', { hour12: false })}.
                      </Notice>
                      <p className="text-xs leading-relaxed text-base-200">{analysis.summary}</p>

                      <div>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-base-400">
                          Observations
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.observations.map((item) => (
                            <li key={item} className="text-xs leading-relaxed text-base-200">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-base-400">
                          Suspected issues
                        </p>
                        <ul className="mt-1.5 space-y-2">
                          {analysis.suspectedIssues.map((issue) => (
                            <li
                              key={issue.title}
                              className="rounded-md border border-base-700/70 bg-base-950/50 px-2.5 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <SeverityBadge severity={issue.severity} />
                                <span className="text-xs font-medium text-base-50">{issue.title}</span>
                              </div>
                              <p className="mt-1 text-2xs leading-relaxed text-base-300">
                                {issue.detail}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-2xs font-semibold uppercase tracking-wider text-base-400">
                          Suggested focus
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.suggestedFocus.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-1.5 text-xs leading-relaxed text-base-200"
                            >
                              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-accent-400" aria-hidden />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <BarChart3 className="h-3.5 w-3.5 text-base-400" aria-hidden />
                        <span className="text-2xs text-base-400">{analysis.planSummary}</span>
                      </div>

                      <Button variant="ghost" size="sm" onClick={runAnalysis} loading={analysing}>
                        Re-run analysis
                      </Button>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p className={`mt-0.5 text-xs text-base-50 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-xs text-base-300">{label}</dt>
      <dd
        className={`mono-num text-xs ${
          tone === 'warn' ? 'text-status-warn' : tone === 'ok' ? 'text-status-ok' : 'text-base-50'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
