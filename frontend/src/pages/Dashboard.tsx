import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Database, RefreshCw, Zap } from 'lucide-react';
import { PageHeader, SqlSnippet } from '@/components/ui/Inputs';
import { Panel, PanelSection } from '@/components/ui/Panel';
import { StatGrid, StatTile } from '@/components/ui/Stat';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge, SeverityBadge, StatusDot } from '@/components/ui/Badge';
import { AsyncBoundary, StatSkeleton, TableSkeleton } from '@/components/ui/States';
import { ChartFrame, TimeSeriesChart } from '@/components/charts/Charts';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { useServiceQuery } from '@/hooks';
import {
  formatBytes,
  formatCompactNumber,
  formatDuration,
  formatFixed,
  formatNumber,
  formatPercent,
} from '@/utils/format';

/**
 * Overview page.
 *
 * Scope is deliberately narrow: is the database healthy, what is the workload
 * doing, and what has the agent been doing. Everything else lives on the page
 * that owns it.
 */
export function DashboardPage() {
  const state = useServiceQuery((services) => services.state.getCurrentState(), []);
  const activity = useServiceQuery((services) => services.activity.getRecent(5), []);
  const summary = useServiceQuery((services) => services.optimizations.getSummary(), []);

  const pending = summary.data?.pending ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Current state of the AgentDB PostgreSQL instance and the latest agent decisions."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={state.reload}
              loading={state.refreshing}
            >
              Refresh
            </Button>
            <LinkButton
              to="/recommendations"
              variant="primary"
              size="sm"
              icon={<Zap className="h-3.5 w-3.5" />}
            >
              Review recommendations
            </LinkButton>
          </>
        }
      />

      <AsyncBoundary state={state} skeleton={<StatSkeleton count={6} />} loadingLabel="Loading database state…">
        {(data) => (
          <>
            {/* Connection strip */}
            <Panel>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot tone={data.info.status === 'ONLINE' ? 'ok' : 'warn'} pulse />
                  <span className="text-sm font-medium text-base-50">
                    {data.info.versionShort}
                  </span>
                </div>
                <Fact label="Database" value={data.info.databaseName} mono />
                <Fact label="Endpoint" value={`${data.info.host}:${data.info.port}`} mono />
                <Fact label="Size" value={formatBytes(data.info.sizeBytes)} />
                <Fact label="Uptime" value={formatDuration(data.info.uptimeSeconds)} />
                <Fact
                  label="pg_stat_statements"
                  value={data.info.pgStatStatements ? 'enabled' : 'disabled'}
                  tone={data.info.pgStatStatements ? 'ok' : 'danger'}
                />
                {pending > 0 ? (
                  <Link to="/recommendations" className="ml-auto">
                    <Badge tone="warn" dot>
                      {pending} awaiting review
                    </Badge>
                  </Link>
                ) : (
                  <Badge tone="ok" className="ml-auto">
                    queue clear
                  </Badge>
                )}
              </div>
            </Panel>

            {/* Key performance indicators */}
            <StatGrid className="xl:grid-cols-3">
              <StatTile
                label="Transactions / sec"
                value={formatNumber(data.performance.tps, 1)}
                hint="throughput"
                tooltip="Completed transactions per second."
              />
              <StatTile
                label="Queries / sec"
                value={formatNumber(data.performance.qps, 1)}
                hint="statements executed"
              />
              <StatTile
                label="Mean latency"
                value={formatFixed(data.performance.avgLatencyMs, 2)}
                unit="ms"
                invertDelta
                hint="per statement"
                tooltip="Average statement execution time from pg_stat_statements. PostgreSQL does not expose percentiles, so P95 is only available from a benchmark run."
              />
              <StatTile
                label="Cache hit ratio"
                value={formatPercent(data.performance.cacheHitRatio, 2)}
                tone={data.performance.cacheHitRatio > 0.95 ? 'ok' : 'warn'}
                hint="shared buffers"
                tooltip="shared_blks_hit / (hit + read). A low ratio points to under-sized shared_buffers or a missing index."
              />
              <StatTile
                label="Active connections"
                value={`${data.performance.activeConnections}`}
                hint={`of ${data.performance.maxConnections} allowed`}
                icon={<Database className="h-3.5 w-3.5" />}
              />
              <StatTile
                label="CPU utilisation"
                value={formatFixed(data.performance.cpuPercent, 1)}
                unit="%"
                tone={data.performance.cpuPercent > 80 ? 'warn' : 'default'}
                hint="host, all cores"
              />
            </StatGrid>

            {/* The two metrics that drive every optimization decision */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartFrame
                title="Throughput"
                description="Transactions per second"
                height={220}
              >
                <TimeSeriesChart points={data.series.tps} tone="accent" unit="TPS" decimals={0} />
              </ChartFrame>

              <ChartFrame
                title="Mean query latency"
                description="Average statement execution time"
                height={220}
              >
                <TimeSeriesChart
                  points={data.series.avgLatency}
                  tone="warn"
                  unit="ms"
                  decimals={2}
                />
              </ChartFrame>
            </div>

            {/* Workload + agent */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <PanelSection
                title="Top queries by total execution time"
                description="The workload behind every optimization recommendation"
                actions={
                  <LinkButton
                    to="/queries"
                    variant="ghost"
                    size="sm"
                    iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}
                  >
                    All queries
                  </LinkButton>
                }
              >
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Query</th>
                        <th className="text-right">Calls</th>
                        <th className="text-right">Total time</th>
                        <th className="text-right">Mean</th>
                        <th>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topQueries.slice(0, 6).map((query) => (
                        <tr key={query.id}>
                          <td className="max-w-md">
                            <Link to={`/queries/${query.id}`} className="group block">
                              <span className="block truncate text-xs text-base-100 group-hover:text-accent-300">
                                {query.label ?? query.query}
                              </span>
                              <SqlSnippet
                                sql={query.query}
                                maxLength={58}
                                className="text-base-400"
                              />
                            </Link>
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatCompactNumber(query.calls)}
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(query.totalExecTimeMs / 1000, 1)}s
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(query.meanExecTimeMs, 2)} ms
                          </td>
                          <td>
                            <SeverityBadge severity={query.severity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelSection>

              <PanelSection
                title="Recent agent activity"
                icon={<Activity className="h-4 w-4" />}
                actions={
                  <LinkButton to="/agent/activity" variant="ghost" size="sm">
                    Timeline
                  </LinkButton>
                }
              >
                <AsyncBoundary state={activity} skeleton={<TableSkeleton rows={5} columns={2} />}>
                  {(events) => <ActivityFeed events={events} compact />}
                </AsyncBoundary>
              </PanelSection>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function Fact({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'ok' | 'danger';
}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p
        className={`mt-0.5 text-xs ${
          tone === 'ok' ? 'text-status-ok' : tone === 'danger' ? 'text-status-danger' : 'text-base-100'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
