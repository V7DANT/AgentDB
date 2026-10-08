import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BarChart3, Info, RefreshCw } from 'lucide-react';
import type { BenchmarkExperiment } from '@/types';
import { PageHeader } from '@/components/ui/Inputs';
import {
  Panel,
  PanelSection,
  Notice,
  KeyValue,
  KeyValueList,
  SectionLabel,
} from '@/components/ui/Panel';
import { Badge, BenchmarkStatusBadge, SourceBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, TableSkeleton } from '@/components/ui/States';
import { ChartFrame, MultiLineChart } from '@/components/charts/Charts';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { WorkloadRunner } from '@/components/benchmark/WorkloadRunner';
import { DataTable, type Column } from '@/components/ui/Table';
import { useServiceQuery } from '@/hooks';
import { CROSS_EXPERIMENT_NOTE, S2_CHART_DATA } from '@/data/benchmarks';
import { cn } from '@/utils/cn';
import { formatDateTime, formatFixed, formatNumber } from '@/utils/format';

/* ================================================================== */
/* List + S2 deep dive                                                 */
/* ================================================================== */

export function BenchmarksPage() {
  const navigate = useNavigate();
  const experiments = useServiceQuery((s) => s.benchmarks.getExperiments(), []);

  const completed = (experiments.data ?? []).filter(
    (experiment) => experiment.status === 'COMPLETED',
  );
  const s2 = experiments.data?.find((experiment) => experiment.id === 'S2');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Benchmarks"
        description="The Sysbench experiments that establish AgentDB's performance baseline. Data is read from the committed result files under results/<machine-id>/sysbench/."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={experiments.reload}
            loading={experiments.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <Badge tone="info" dot>
              recorded results
            </Badge>
            <span className="text-2xs text-base-400">
              machine <span className="font-mono text-base-200">vedant-bothra</span> ·{' '}
              {completed.length} completed experiments
            </span>
          </>
        }
      />

      <div className="flex items-start gap-2.5 rounded-md border border-status-warn/25 bg-status-warn/[0.06] px-3 py-2.5">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-status-warn" aria-hidden />
        <div>
          <p className="text-xs font-medium text-status-warn">{CROSS_EXPERIMENT_NOTE.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-base-200">{CROSS_EXPERIMENT_NOTE.body}</p>
        </div>
      </div>

      <WorkloadRunner />

      <AsyncBoundary state={experiments} skeleton={<TableSkeleton rows={2} columns={3} />}>
        {() => (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {completed.map((experiment) => (
              <BenchmarkCard
                key={experiment.id}
                experiment={experiment}
                onOpen={() => navigate(`/benchmarks/${experiment.id}`)}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>

      {s2 ? (
        <PanelSection
          title={
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-base-400" />
              S2 — concurrency scaling
            </span>
          }
          actions={<SourceBadge source="RESULTS_DIR" />}
        >
          <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
            <ChartFrame
              title="Throughput vs. concurrency"
              description="Mean TPS and QPS per concurrency level"
              height={250}
              footer="Means of 3 × 60s runs per level, from S2/summary.json."
            >
              <MultiLineChart
                data={S2_CHART_DATA}
                xKey="concurrency"
                xLabel="threads"
                leftUnit="TPS"
                rightUnit="QPS"
                decimals={0}
                series={[
                  { key: 'tps', label: 'TPS', tone: 'accent' },
                  { key: 'qps', label: 'QPS', tone: 'violet', axis: 'right' },
                ]}
              />
            </ChartFrame>

            <ChartFrame
              title="Latency vs. concurrency"
              description="Average and P95 transaction latency"
              height={250}
              footer="P95 rises 7.5× from 1 to 16 threads while throughput rises only 2.31×."
            >
              <MultiLineChart
                data={S2_CHART_DATA}
                xKey="concurrency"
                xLabel="threads"
                leftUnit="ms"
                decimals={2}
                series={[
                  { key: 'avgLatencyMs', label: 'Average latency', tone: 'ok' },
                  { key: 'p95LatencyMs', label: 'P95 latency', tone: 'warn' },
                ]}
              />
            </ChartFrame>
          </div>

          <div className="border-t border-base-800/70 p-4">
            <SectionLabel>Observations from the recorded data</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {s2.observations.map((observation) => (
                <li key={observation} className="text-xs leading-relaxed text-base-200">
                  • {observation}
                </li>
              ))}
            </ul>
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}

function BenchmarkCard({
  experiment,
  onOpen,
}: {
  experiment: BenchmarkExperiment;
  onOpen: () => void;
}) {
  return (
    <article className="panel flex flex-col p-4 transition-colors hover:border-base-600">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-base-50">{experiment.name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-base-300">{experiment.question}</p>
        </div>
        <BenchmarkStatusBadge status={experiment.status} />
      </div>

      <KeyValueList className="mt-3">
        <KeyValue label="Workload" mono>
          {experiment.workload}
        </KeyValue>
        <KeyValue label="Runs" mono>
          {experiment.runsCount}
        </KeyValue>
        <KeyValue label="Duration" mono>
          {experiment.durationSeconds}s per run
        </KeyValue>
        <KeyValue label="Git commit" mono>
          {experiment.gitCommit.slice(0, 8)}
        </KeyValue>
      </KeyValueList>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <SourceBadge source={experiment.dataSource} />
        <Button variant="outline" size="sm" onClick={onOpen}>
          Open results
        </Button>
      </div>
    </article>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function BenchmarkDetailPage() {
  const { experimentId = '' } = useParams();
  const experiment = useServiceQuery(
    (s) => s.benchmarks.getExperiment(experimentId),
    [experimentId],
  );

  const runColumns: Column<NonNullable<typeof experiment.data>['runs'][number]>[] = [
    {
      key: 'run',
      header: 'Run',
      render: (run) => (
        <span className="mono-num text-xs text-base-100">
          {run.concurrency !== undefined ? `c${run.concurrency} · ` : ''}run {run.runNumber}
        </span>
      ),
    },
    {
      key: 'tps',
      header: 'TPS',
      align: 'right',
      render: (run) => <span className="mono-num text-xs">{formatFixed(run.tps, 2)}</span>,
    },
    {
      key: 'qps',
      header: 'QPS',
      align: 'right',
      render: (run) => <span className="mono-num text-xs">{formatFixed(run.qps, 2)}</span>,
    },
    {
      key: 'avg',
      header: 'Avg latency',
      align: 'right',
      render: (run) => (
        <span className="mono-num text-xs">{formatFixed(run.avgLatencyMs, 2)} ms</span>
      ),
    },
    {
      key: 'p95',
      header: 'P95',
      align: 'right',
      render: (run) => (
        <span className="mono-num text-xs">{formatFixed(run.p95LatencyMs, 2)} ms</span>
      ),
    },
    {
      key: 'max',
      header: 'Max',
      align: 'right',
      render: (run) => (
        <span className="mono-num text-xs">{formatFixed(run.maxLatencyMs, 2)} ms</span>
      ),
    },
    {
      key: 'errors',
      header: 'Errors',
      align: 'right',
      render: (run) => (
        <span className={cn('mono-num text-xs', run.errors > 0 && 'text-status-danger')}>
          {run.errors}
        </span>
      ),
    },
    {
      key: 'started',
      header: 'Started',
      render: (run) => (
        <span className="mono-num text-2xs text-base-400">{formatDateTime(run.startedAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={experiment.data?.name ?? `Experiment ${experimentId}`}
        description={experiment.data?.purpose}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Experiments', to: '/benchmarks' },
              { label: 'Benchmarks', to: '/benchmarks' },
              { label: experimentId },
            ]}
          />
        }
        actions={
          <LinkButton
            to="/benchmarks"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Back
          </LinkButton>
        }
      />

      <AsyncBoundary
        state={experiment}
        skeleton={<TableSkeleton rows={6} columns={5} />}
        loadingLabel="Loading experiment…"
      >
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label={data.id === 'S2' ? 'Concurrency levels' : 'Peak mean TPS'}
                value={
                  data.id === 'S2'
                    ? String(data.concurrencyLevels?.length ?? 0)
                    : data.summary
                      ? formatFixed(data.summary.tps.max, 2)
                      : '—'
                }
                hint={data.id === 'S2' ? '1, 2, 4, 8, 16 threads' : 'highest run'}
              />
              <MetricCard label="Total runs" value={String(data.runs.length)} hint="measured" />
              <MetricCard
                label="Total errors"
                value={String(data.runs.reduce((sum, run) => sum + run.errors, 0))}
                hint="across all runs"
                tone="ok"
              />
              <MetricCard label="Tool" value={data.tool.split(' ')[1] ?? data.tool} hint={data.tool} />
            </div>

            {data.summary ? (
              <Panel>
                <SectionLabel>Summary statistics — {data.id}</SectionLabel>
                <p className="mt-1 text-2xs text-base-400">
                  Calculated across {data.runsCount} measured runs of {data.durationSeconds}s each.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryBlock label="TPS" metric={data.summary.tps} decimals={2} />
                  <SummaryBlock label="QPS" metric={data.summary.qps} decimals={2} />
                  <SummaryBlock
                    label="Average latency (ms)"
                    metric={data.summary.avgLatencyMs}
                    decimals={3}
                  />
                  <SummaryBlock
                    label="P95 latency (ms)"
                    metric={data.summary.p95LatencyMs}
                    decimals={2}
                  />
                  <SummaryBlock
                    label="Maximum latency (ms)"
                    metric={data.summary.maxLatencyMs}
                    decimals={2}
                  />
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-base-400">Errors</p>
                    <p className="mono-num mt-1 text-lg text-status-ok">{data.summary.errors}</p>
                  </div>
                </div>
              </Panel>
            ) : null}

            {data.concurrencyLevels ? (
              <Panel>
                <SectionLabel>Concurrency level summary</SectionLabel>
                <div className="mt-3 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Threads</th>
                        <th className="text-right">Mean TPS</th>
                        <th className="text-right">Std dev</th>
                        <th className="text-right">Mean QPS</th>
                        <th className="text-right">Avg latency</th>
                        <th className="text-right">P95</th>
                        <th className="text-right">Max</th>
                        <th className="text-right">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.concurrencyLevels.map((level) => (
                        <tr key={level.concurrency}>
                          <td className="mono-num text-xs text-base-100">{level.concurrency}</td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(level.tps.mean, 2)}
                          </td>
                          <td className="mono-num text-right text-xs text-base-400">
                            {level.tps.stddev !== undefined
                              ? formatFixed(level.tps.stddev, 2)
                              : '—'}
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatNumber(level.qps.mean, 0)}
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(level.avgLatencyMs.mean, 2)} ms
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(level.p95LatencyMs.mean, 2)} ms
                          </td>
                          <td className="mono-num text-right text-xs">
                            {formatFixed(level.maxLatencyMs.mean, 2)} ms
                          </td>
                          <td className="mono-num text-right text-xs">
                            {level.errors === 0 ? (
                              <span className="text-status-ok">0</span>
                            ) : (
                              <span className="text-status-danger">{level.errors}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            <PanelSection
              title="Individual runs"
              description="Every measured run with its recorded metrics"
              actions={<SourceBadge source={data.dataSource} />}
            >
              <DataTable columns={runColumns} rows={data.runs} getRowKey={(run) => run.id} />
            </PanelSection>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Panel>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-base-400" aria-hidden />
                  <SectionLabel>Recorded observations</SectionLabel>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {data.observations.map((observation) => (
                    <li key={observation} className="text-xs leading-relaxed text-base-200">
                      • {observation}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel>
                <SectionLabel>Experiment configuration</SectionLabel>
                <KeyValueList className="mt-3">
                  {Object.entries(data.configuration).map(([key, value]) => (
                    <KeyValue key={key} label={key.replace(/_/g, ' ')} mono>
                      {String(value)}
                    </KeyValue>
                  ))}
                  <KeyValue label="Machine" mono>
                    {data.machineId}
                  </KeyValue>
                  <KeyValue label="Git commit" mono>
                    {data.gitCommit}
                  </KeyValue>
                  <KeyValue label="Started">{formatDateTime(data.startedAt)}</KeyValue>
                  <KeyValue label="Completed">
                    {data.completedAt ? formatDateTime(data.completedAt) : '—'}
                  </KeyValue>
                  <KeyValue label="Result path" mono>
                    results/{data.machineId}/sysbench/{data.id}/
                  </KeyValue>
                </KeyValueList>
                <Notice tone="neutral" className="mt-3">
                  These figures are read from the committed result artefacts, not measured by this
                  frontend.
                </Notice>
              </Panel>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'ok';
}) {
  return (
    <div className="panel p-4">
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p
        className={cn(
          'mono-num mt-1.5 text-xl font-semibold',
          tone === 'ok' ? 'text-status-ok' : 'text-base-50',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-2xs text-base-400">{hint}</p>
    </div>
  );
}

function SummaryBlock({
  label,
  metric,
  decimals,
}: {
  label: string;
  metric: { mean: number; min: number; max: number; stddev?: number };
  decimals: number;
}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p className="mono-num mt-1 text-lg text-base-50">{formatFixed(metric.mean, decimals)}</p>
      <p className="mt-0.5 text-2xs text-base-400">
        min {formatFixed(metric.min, decimals)} · max {formatFixed(metric.max, decimals)}
        {metric.stddev !== undefined ? ` · σ ${formatFixed(metric.stddev, decimals)}` : ''}
      </p>
    </div>
  );
}
