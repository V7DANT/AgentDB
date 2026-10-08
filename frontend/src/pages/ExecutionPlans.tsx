import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GitBranch, Info, RefreshCw, Search } from 'lucide-react';
import { PageHeader, SqlSnippet } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, SectionLabel } from '@/components/ui/Panel';
import { Badge, DataSourceBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { BottleneckList, PlanTree, flatten } from '@/components/plan/PlanTree';
import { DataTable, type Column } from '@/components/ui/Table';
import { useServiceQuery } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatCompactNumber, formatFixed, formatMs } from '@/utils/format';

/**
 * EXPLAIN plan visualiser.
 *
 * A query is selected on the left and its plan rendered as a tree on the right.
 * The data model accepts PostgreSQL's `EXPLAIN (ANALYZE, FORMAT JSON)` output,
 * so the renderer will work unchanged against a real plan.
 */
export function ExecutionPlansPage() {
  const { queryId } = useParams();
  const navigate = useNavigate();

  const plannedIds = useServiceQuery((services) => services.plans.getPlannedQueryIds(), []);
  const queries = useServiceQuery((services) => services.queries.getQueries(), []);

  const ids = plannedIds.data ?? [];
  const selectedId = useMemo(() => {
    if (queryId && ids.includes(queryId)) return queryId;
    return ids[0] ?? '';
  }, [queryId, ids]);

  const plan = useServiceQuery(
    (services) => (selectedId ? services.plans.getPlan(selectedId) : Promise.resolve(null)),
    [selectedId],
  );

  const selectedQuery = queries.data?.find((row) => row.id === selectedId);
  const rows = (queries.data ?? []).filter((row) => ids.includes(row.id));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'query',
      header: 'Statement',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-base-100">{row.label ?? 'Statement'}</p>
          <SqlSnippet sql={row.query} maxLength={70} className="text-base-400" />
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'mean',
      header: 'Mean',
      align: 'right',
      render: (row) => <span className="mono-num text-xs">{formatMs(row.meanExecTimeMs)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Execution plans"
        description="EXPLAIN (FORMAT JSON) plan trees with per-node costs, row estimates and detected bottlenecks."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={plan.reload}
            loading={plan.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              {ids.length} statements have a captured plan
            </span>
          </>
        }
      />

      <Notice tone="info" icon={<Info className="h-3.5 w-3.5" />}>
        Plans are produced live by the State Collector with
        <code className="mx-1 font-mono">EXPLAIN (FORMAT JSON)</code>
        against the statements recorded in <code className="mx-1 font-mono">pg_stat_statements</code>.
        Costs and row estimates are real planner output. Actual timings and row counts are absent
        because these statements use bind parameters, which cannot be re-executed safely as literals.
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Statement picker */}
        <PanelSection
          title={
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-base-400" />
              Select statement
            </span>
          }
        >
          <AsyncBoundary state={queries} skeleton={<TableSkeleton rows={5} columns={2} />}>
            {() => (
              <DataTable
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.id}
                onRowClick={(row) => navigate(`/plans/${row.id}`)}
                rowClassName={(row) => (row.id === selectedId ? 'bg-accent-500/[0.07]' : undefined)}
              />
            )}
          </AsyncBoundary>
        </PanelSection>

        {/* Plan */}
        <AsyncBoundary
          state={plan}
          skeleton={<TableSkeleton rows={6} columns={4} />}
          loadingLabel="Loading execution plan…"
          isEmpty={() => selectedId === ''}
          emptyTitle="Select a statement"
          emptyDescription="Choose a statement from the list to inspect its plan tree."
        >
          {(data) =>
            data === null ? (
              <Panel>
                <EmptyState
                  title="No plan captured for this statement"
                  description="The State Collector explains every statement it can re-plan from pg_stat_statements. Statements with bind parameters that cannot be substituted are reported here without a plan."
                />
              </Panel>
            ) : (
              <div className="space-y-4">
                {selectedQuery ? (
                  <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <SectionLabel>Statement</SectionLabel>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-base-100">
                          {data.query}
                        </pre>
                      </div>
                      <LinkButton
                        to={`/queries/${data.queryId}`}
                        variant="outline"
                        size="sm"
                        icon={<GitBranch className="h-3.5 w-3.5" />}
                      >
                        Query detail
                      </LinkButton>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-base-800/70 pt-3 sm:grid-cols-5">
                      <PlanMetric label="Node count" value={String(flatten(data.root).length)} />
                      <PlanMetric label="Planning time" value={formatMs(data.planningTimeMs, 3)} />
                      <PlanMetric label="Execution time" value={formatMs(data.executionTimeMs)} />
                      <PlanMetric
                        label="Total cost"
                        value={formatFixed(data.totalCost, 1)}
                      />
                      <PlanMetric
                        label="Bottlenecks"
                        value={String(data.bottlenecks.length)}
                        tone={data.bottlenecks.length > 0 ? 'warn' : 'ok'}
                      />
                    </div>
                  </Panel>
                ) : null}

                <Panel>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>Detected bottlenecks</SectionLabel>
                    <Badge tone="neutral">severity-ranked</Badge>
                  </div>
                  <div className="mt-3">
                    <BottleneckList plan={data} />
                  </div>
                </Panel>

                <PlanTree plan={data} />
              </div>
            )
          }
        </AsyncBoundary>
      </div>
    </div>
  );
}

function PlanMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p
        className={cn(
          'mono-num mt-0.5 text-sm',
          tone === 'warn' ? 'text-status-warn' : tone === 'ok' ? 'text-status-ok' : 'text-base-50',
        )}
      >
        {value}
      </p>
    </div>
  );
}

