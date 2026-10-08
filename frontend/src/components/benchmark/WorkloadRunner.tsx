import { useEffect, useState } from 'react';
import { AlertTriangle, Database, Eraser, Play, RefreshCw, Wrench } from 'lucide-react';
import type { ExperimentRun, ExperimentRunRequest } from '@/types';
import { Panel, Notice, SectionLabel } from '@/components/ui/Panel';
import { Badge, BenchmarkStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AsyncBoundary, LoadingState } from '@/components/ui/States';
import { useMutation, useServiceQuery } from '@/hooks';
import { useServices } from '@/services';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { formatFixed } from '@/utils/format';

const DURATIONS = [15, 30, 60, 120, 300];
const CONCURRENCIES = [1, 2, 4, 8, 16, 32];

/**
 * Live workload runner.
 *
 * The backend validates every parameter against a whitelist and spawns the
 * configured tool (sysbench or pgbench) as a subprocess — the browser never
 * sends a command string. Results appear in the run list below.
 */
export function WorkloadRunner() {
  const services = useServices();
  const toast = useToast();

  const status = useServiceQuery((s) => s.benchmarks.getRunnerStatus(), []);
  const runs = useServiceQuery((s) => s.benchmarks.getRuns(), []);

  const [workload, setWorkload] = useState('oltp_read_only');
  const [duration, setDuration] = useState(60);
  const [concurrency, setConcurrency] = useState(4);
  const [mode, setMode] = useState<'run' | 'prepare'>('run');

  const start = useMutation((request: ExperimentRunRequest) =>
    services.benchmarks.runExperiment(request),
  );
  const resetStats = useMutation(() => services.benchmarks.resetStatistics());
  const mutateIndex = useMutation((name: string, action: 'drop' | 'recreate') =>
    services.benchmarks.mutateIndex(name, action),
  );

  const list = runs.data ?? [];
  const active = list.find((run) => run.status === 'RUNNING' || run.status === 'QUEUED');

  // Poll while a run is in flight; the server owns the progress.
  useEffect(() => {
    if (!active && !status.data?.busy) return;
    const handle = window.setInterval(() => {
      runs.reload();
      status.reload();
    }, 2000);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, status.data?.busy]);

  const launch = async () => {
    try {
      await start.run({ workload, durationSeconds: duration, concurrency, mode });
      toast.push({
        tone: 'info',
        title: mode === 'prepare' ? 'Dataset preparation queued' : 'Workload started',
        description: `${workload} · ${concurrency} thread(s) · ${duration}s`,
      });
      runs.reload();
      status.reload();
    } catch (error) {
      toast.push({
        tone: 'error',
        title: 'Could not start the workload',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const tool = status.data?.workloads.find((w) => w.id === workload)?.tool ?? 'sysbench';
  const selected = status.data?.workloads.find((w) => w.id === workload);
  const toolAvailable = selected
    ? selected.tool === 'sysbench'
      ? (status.data?.sysbench ?? false)
      : (status.data?.pgbench ?? false)
    : false;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-base-400" aria-hidden />
            <SectionLabel>Run a workload</SectionLabel>
          </div>
          <Badge tone={active ? 'info' : 'ok'} dot>
            {active ? 'running' : 'idle'}
          </Badge>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-base-300">
          Launches the configured workload against this PostgreSQL instance. The parameters are
          validated server-side and only whitelisted values are accepted.
        </p>

        <AsyncBoundary state={status} skeleton={<LoadingState label="Checking runner…" />}>
          {(data) => (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={data.sysbench ? 'ok' : 'danger'}>sysbench {data.sysbench ? 'available' : 'missing'}</Badge>
                <Badge tone={data.pgbench ? 'ok' : 'danger'}>pgbench {data.pgbench ? 'available' : 'missing'}</Badge>
              </div>

              <Field label="Workload">
                <select
                  value={workload}
                  onChange={(event) => setWorkload(event.target.value)}
                  className="h-9 w-full rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
                >
                  {data.workloads.map((option) => (
                    <option key={option.id} value={option.id} disabled={!option.available}>
                      {option.label}
                      {option.available ? '' : ' (unavailable)'}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Duration">
                  <select
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    className="h-9 w-full rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
                  >
                    {DURATIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Concurrency">
                  <select
                    value={concurrency}
                    onChange={(event) => setConcurrency(Number(event.target.value))}
                    className="h-9 w-full rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
                  >
                    {CONCURRENCIES.map((value) => (
                      <option key={value} value={value}>
                        {value} threads
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Phase">
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as 'run' | 'prepare')}
                    disabled={tool !== 'sysbench'}
                    className="h-9 w-full rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none disabled:opacity-50"
                  >
                    <option value="run">run</option>
                    <option value="prepare">prepare</option>
                  </select>
                </Field>
              </div>

              <Button
                variant="primary"
                fullWidth
                icon={<Play className="h-3.5 w-3.5" />}
                loading={start.pending}
                disabled={data.busy || !toolAvailable}
                onClick={launch}
              >
                {mode === 'prepare' ? 'Prepare dataset' : 'Run workload'}
              </Button>

              <div className="flex flex-wrap gap-2 border-t border-base-800/70 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Eraser className="h-3.5 w-3.5" />}
                  loading={resetStats.pending}
                  onClick={async () => {
                    await resetStats.run();
                    toast.push({
                      tone: 'warning',
                      title: 'Statistics reset',
                      description: 'Cumulative counters cleared. The next measurement starts from zero.',
                    });
                  }}
                >
                  Reset statistics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Wrench className="h-3.5 w-3.5" />}
                  loading={mutateIndex.pending}
                  onClick={async () => {
                    await mutateIndex.run('k_1', 'drop');
                    toast.push({
                      tone: 'warning',
                      title: 'Index k_1 dropped',
                      description: 'Run oltp_read_write to exercise the affected statement.',
                    });
                  }}
                >
                  Drop k_1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  loading={mutateIndex.pending}
                  onClick={async () => {
                    await mutateIndex.run('k_1', 'recreate');
                    toast.push({
                      tone: 'success',
                      title: 'Index k_1 recreated',
                      description: 'CREATE INDEX ON sbtest1 (k)',
                    });
                  }}
                >
                  Recreate k_1
                </Button>
              </div>

              <Notice tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                <span className="font-medium">oltp_read_only does not use the k index.</span> To
                demonstrate index detection, use <span className="font-mono">oltp_read_write</span>{' '}
                after dropping k_1, or run the pgbench application workload against the tables that
                are missing an index.
              </Notice>
            </div>
          )}
        </AsyncBoundary>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-base-400" aria-hidden />
            <SectionLabel>Run history</SectionLabel>
          </div>
          <span className="text-2xs text-base-400">{list.length} run(s)</span>
        </div>

        <AsyncBoundary state={runs} skeleton={<LoadingState />} isEmpty={() => false}>
          {() =>
            list.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-base-300">
                No workloads have been launched from the dashboard yet. Runs started from a terminal
                will not appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {list.slice(0, 8).map((run: ExperimentRun) => (
                  <li key={run.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <BenchmarkStatusBadge status={run.status} />
                        <span className="font-mono text-xs text-base-100">{run.request.workload}</span>
                      </span>
                      <span className="mono-num text-2xs text-base-400">
                        {run.request.concurrency} threads · {run.request.durationSeconds}s
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-base-700/60">
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-300',
                          run.status === 'FAILED'
                            ? 'bg-status-danger'
                            : run.status === 'COMPLETED'
                              ? 'bg-status-ok'
                              : 'bg-accent-500',
                        )}
                        style={{ width: `${run.progress}%` }}
                      />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-2xs text-base-300">{run.message}</span>
                      {run.result ? (
                        <span className="mono-num text-2xs text-status-ok">
                          {formatFixed(run.result.tps, 1)} TPS · {formatFixed(run.result.avgLatencyMs, 2)} ms
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </AsyncBoundary>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-2xs uppercase tracking-wider text-base-400">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
