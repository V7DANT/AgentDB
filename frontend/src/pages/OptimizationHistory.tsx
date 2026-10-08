import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FlaskConical,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import type { OptimizationRecord } from '@/types';
import { PageHeader, SearchInput, Select } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, KeyValue, KeyValueList, SectionLabel } from '@/components/ui/Panel';
import { DataTable, type Column } from '@/components/ui/Table';
import { Badge, DataSourceBadge, OptimizationStatusBadge, ValidationBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, LoadingState, TableSkeleton } from '@/components/ui/States';
import { GainBar } from '@/components/ui/Progress';
import { OptimizationTypeBadge } from '@/components/optimization/RecommendationCard';
import { RecordStatusCell } from '@/components/optimization/RecordStatusCell';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useMutation, useServiceQuery, useDebouncedValue } from '@/hooks';
import { useServices } from '@/services';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import {
  formatDateTime,
  formatFixed,
  formatMs,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
} from '@/utils/format';

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

export function OptimizationHistoryPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'CONFIRMED' | 'REGRESSION' | 'PENDING' | 'REJECTED'>(
    'ALL',
  );
  const [validationRunningFor, setValidationRunningFor] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const navigate = useNavigate();
  const services = useServices();
  const toast = useToast();

  const history = useServiceQuery((services_) => services_.optimizations.getHistory(), []);
  const validate = useMutation((recordId: string) =>
    services.optimizations.runValidation(recordId),
  );

  const rows = useMemo(() => {
    let all = history.data ?? [];
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      all = all.filter(
        (record) =>
          record.target.toLowerCase().includes(needle) ||
          record.statement.toLowerCase().includes(needle) ||
          record.id.toLowerCase().includes(needle),
      );
    }
    if (status === 'REJECTED') all = all.filter((record) => record.status === 'REJECTED');
    else if (status !== 'ALL') all = all.filter((record) => record.validationStatus === status);
    return all;
  }, [history.data, debouncedSearch, status]);

  const confirmed = (history.data ?? []).filter((r) => r.validationStatus === 'CONFIRMED');
  const averageActualGain =
    confirmed.length > 0
      ? confirmed.reduce((sum, record) => sum + (record.actualGain ?? 0), 0) / confirmed.length
      : 0;

  const runValidation = async (record: OptimizationRecord) => {
    setValidationRunningFor(record.id);
    try {
      const updated = await validate.run(record.id);
      toast.push({
        tone: updated.validationStatus === 'CONFIRMED' ? 'success' : 'warning',
        title:
          updated.validationStatus === 'CONFIRMED'
            ? 'Validation confirmed an improvement'
            : 'Measured change is within noise',
        description:
          updated.validationStatus === 'CONFIRMED'
            ? `Measured ${formatSignedPercent(updated.actualGain ?? 0)} against an expected ${formatSignedPercent(updated.expectedGain)}.`
            : `Measured ${formatSignedPercent(updated.actualGain ?? 0)}, below the 1.5% significance threshold. No improvement is claimed.`,
      });
    } catch (error) {
      toast.push({
        tone: 'error',
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setValidationRunningFor(null);
    }
  };

  const columns: Column<OptimizationRecord>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (record) => (
        <span className="flex flex-col">
          <span className="mono-num text-xs text-base-100">{formatDateTime(record.timestamp)}</span>
          <span className="text-2xs text-base-500">{formatRelativeTime(record.timestamp)}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (record) => <OptimizationTypeBadge type={record.type} />,
    },
    {
      key: 'target',
      header: 'Target',
      render: (record) => (
        <span className="flex flex-col">
          <span className="font-mono text-xs text-base-100">{record.target}</span>
          <span className="font-mono text-2xs text-base-500">{record.action}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (record) => <OptimizationStatusBadge status={record.status} />,
    },
    {
      key: 'expected',
      header: 'Expected',
      align: 'right',
      render: (record) => (
        <span className="mono-num text-xs text-base-200">
          {formatPercent(record.expectedGain, 1)}
        </span>
      ),
    },
    {
      key: 'actual',
      header: 'Actual',
      align: 'right',
      render: (record) =>
        record.actualGain !== undefined ? (
          <GainBar value={record.actualGain} />
        ) : (
          <span className="text-2xs text-base-500">—</span>
        ),
    },
    {
      key: 'validation',
      header: 'Validation',
      render: (record) => <ValidationBadge status={record.validationStatus} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (record) =>
        record.validationStatus === 'PENDING' && record.status !== 'REJECTED' ? (
          <Button
            size="sm"
            variant="outline"
            loading={validationRunningFor === record.id}
            onClick={(event) => {
              event.stopPropagation();
              void runValidation(record);
            }}
          >
            Run validation
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Optimization history"
        description="Every optimization attempt with its expected and measured effect. This collection is the source for the Experience Repository and future expert training data."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={history.reload}
            loading={history.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              {confirmed.length} confirmed · mean measured gain{' '}
              <span className="mono-num text-status-ok">
                {formatSignedPercent(averageActualGain)}
              </span>
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Confirmed improvements"
          value={String(confirmed.length)}
          hint="validation status CONFIRMED"
          tone="ok"
        />
        <SummaryCard
          label="Regressions"
          value={String((history.data ?? []).filter((r) => r.validationStatus === 'REGRESSION').length)}
          hint="rolled back automatically"
          tone="danger"
        />
        <SummaryCard
          label="Awaiting validation"
          value={String((history.data ?? []).filter((r) => r.validationStatus === 'PENDING').length)}
          hint="applicable records pending a benchmark"
          tone="warn"
        />
      </div>

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-base-400" />
            Records
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search target or statement…"
            />
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ALL', label: 'All records' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'PENDING', label: 'Pending validation' },
                { value: 'REGRESSION', label: 'Regressions' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
          </div>
        }
      >
        <AsyncBoundary
          state={history}
          skeleton={<TableSkeleton rows={7} columns={6} />}
          loadingLabel="Loading history…"
          isEmpty={(data) => data.length === 0}
          emptyTitle="No optimization history yet"
          emptyDescription="Approving a recommendation adds its first entry."
          emptyAction={
            <LinkButton to="/recommendations" variant="primary" size="sm">
              Review recommendations
            </LinkButton>
          }
        >
          {() => (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(record) => record.id}
              onRowClick={(record) => navigate(`/history/${record.id}`)}
              emptyMessage="No records match these filters."
            />
          )}
        </AsyncBoundary>
      </PanelSection>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'ok' | 'danger' | 'warn';
}) {
  return (
    <div className="panel p-4">
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p
        className={cn(
          'mono-num mt-1.5 text-2xl font-semibold',
          tone === 'ok' ? 'text-status-ok' : tone === 'danger' ? 'text-status-danger' : 'text-status-warn',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-2xs text-base-400">{hint}</p>
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function OptimizationRecordDetailPage() {
  const { recordId = '' } = useParams();
  const services = useServices();
  const toast = useToast();

  const record = useServiceQuery((s) => s.optimizations.getRecord(recordId), [recordId]);
  const validate = useMutation((id: string) => services.optimizations.runValidation(id));

  const runValidation = async () => {
    try {
      const updated = await validate.run(recordId);
      toast.push({
        tone: updated.validationStatus === 'CONFIRMED' ? 'success' : 'warning',
        title:
          updated.validationStatus === 'CONFIRMED'
            ? 'Validation completed — improvement confirmed'
            : 'Validation completed — change within noise',
        description: `Measured ${formatSignedPercent(updated.actualGain ?? 0)} against an expected ${formatSignedPercent(updated.expectedGain)}.`,
      });
    } catch (error) {
      toast.push({
        tone: 'error',
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={record.data?.target ?? 'Optimization record'}
        description="Complete before/after measurement for a single optimization — the exact record the Experience Repository stores."
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Optimization', to: '/history' },
              { label: 'History', to: '/history' },
              { label: recordId },
            ]}
          />
        }
        actions={
          <>
            <LinkButton
              to="/history"
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Back
            </LinkButton>
            {record.data?.validationStatus === 'PENDING' && record.data.status !== 'REJECTED' ? (
              <Button
                variant="primary"
                size="sm"
                icon={<FlaskConical className="h-3.5 w-3.5" />}
                loading={validate.pending}
                onClick={runValidation}
              >
                Run validation benchmark
              </Button>
            ) : null}
          </>
        }
      />

      <AsyncBoundary
        state={record}
        skeleton={<LoadingState label="Loading record…" />}
        loadingLabel="Loading record…"
      >
        {(data) => (
          <>
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <OptimizationStatusBadge status={data.status} />
                <ValidationBadge status={data.validationStatus} />
                <OptimizationTypeBadge type={data.type} />
                <span className="font-mono text-2xs text-base-400">{data.id}</span>
                <span className="text-2xs text-base-400">
                  {formatDateTime(data.timestamp)}
                </span>
              </div>
            </Panel>

            {/* BEFORE / AFTER comparison */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ComparePanel
                title="Before"
                subtitle="Baseline measurement"
                snapshot={data.before}
                tone="neutral"
              />
              <ComparePanel
                title="After"
                subtitle={
                  data.after ? 'Post-change measurement' : 'Not measured yet'
                }
                snapshot={data.after}
                tone={data.after ? 'accent' : 'neutral'}
              />
              <Panel>
                <SectionLabel>Result</SectionLabel>
                {data.after ? (
                  <div className="mt-3 space-y-3">
                    <DeltaRow label="TPS" before={data.before.tps} after={data.after.tps} higherIsBetter />
                    <DeltaRow
                      label="QPS"
                      before={data.before.qps}
                      after={data.after.qps}
                      higherIsBetter
                    />
                    <DeltaRow
                      label="P95 latency"
                      before={data.before.p95LatencyMs}
                      after={data.after.p95LatencyMs}
                    />
                    <DeltaRow
                      label="Avg latency"
                      before={data.before.avgLatencyMs}
                      after={data.after.avgLatencyMs}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-base-300">
                    No post-change measurement has been taken. Run the validation benchmark to
                    produce the comparison.
                  </p>
                )}

                <div className="mt-4 border-t border-base-800/70 pt-3">
                  <KeyValueList>
                    <KeyValue label="Expected gain" mono>
                      {formatSignedPercent(data.expectedGain)}
                    </KeyValue>
                    <KeyValue label="Actual gain" mono>
                      {data.actualGain !== undefined ? (
                        <span
                          className={
                            data.actualGain >= 0 ? 'text-status-ok' : 'text-status-danger'
                          }
                        >
                          {formatSignedPercent(data.actualGain)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </KeyValue>
                    <KeyValue label="Validation">{data.validationStatus}</KeyValue>
                    <KeyValue label="Execution time" mono>
                      {data.executionTimeMs !== undefined
                        ? data.executionTimeMs === 0
                          ? 'not applicable (statement rewrite)'
                          : `${data.executionTimeMs} ms`
                        : '—'}
                    </KeyValue>
                  </KeyValueList>
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <Panel>
                <SectionLabel>Optimization applied</SectionLabel>
                <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-base-700/70 bg-base-950/70 px-3 py-3 font-mono text-xs leading-relaxed text-base-100">
                  {data.statement}
                </pre>
                <KeyValueList className="mt-3">
                  <KeyValue label="Action" mono>
                    {data.action}
                  </KeyValue>
                  <KeyValue label="Type" mono>
                    {data.type}
                  </KeyValue>
                  <KeyValue label="Expert" mono>
                    {data.expert}
                  </KeyValue>
                  <KeyValue label="Confidence at decision time" mono>
                    {formatPercent(data.confidence, 0)}
                  </KeyValue>
                  <KeyValue label="Optimization id" mono>
                    <Link
                      to={`/recommendations/${data.optimizationId}`}
                      className="text-accent-300 hover:text-accent-200"
                    >
                      {data.optimizationId}
                    </Link>
                  </KeyValue>
                </KeyValueList>
                {data.note ? (
                  <p className="mt-3 rounded-md border border-base-700/60 bg-base-950/50 px-2.5 py-2 text-xs leading-relaxed text-base-200">
                    {data.note}
                  </p>
                ) : null}
              </Panel>

              <div className="space-y-4">
                {data.status === 'REJECTED' ? (
                  <Panel>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-status-danger" aria-hidden />
                      <SectionLabel>Rejection</SectionLabel>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-base-200">
                      {data.rejectionReason ?? 'No reason recorded.'}
                    </p>
                    <p className="mt-2 text-2xs text-base-400">
                      Rejections are retained as negative training signal.
                    </p>
                  </Panel>
                ) : null}

                <Panel>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-base-400" aria-hidden />
                    <SectionLabel>Validation protocol</SectionLabel>
                  </div>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-base-300">
                    <li>1. Snapshot the current performance indicators.</li>
                    <li>2. Apply the change through the execution layer.</li>
                    <li>3. Re-run the identical workload (3 × 60s, same concurrency).</li>
                    <li>
                      4. Compare against the S1 run-to-run variability band (±0.36% TPS) before
                      claiming an improvement.
                    </li>
                    <li>5. Store the outcome in the Experience Repository.</li>
                  </ul>
                  {data.validationStatus === 'REGRESSION' ? (
                    <Notice tone="warning" className="mt-3">
                      This change regressed performance and was rolled back. It is stored so the
                      agent can avoid repeating it.
                    </Notice>
                  ) : null}
                </Panel>

                <Panel>
                  <SectionLabel>Experience record</SectionLabel>
                  <p className="mt-2 text-xs leading-relaxed text-base-300">
                    This entry <em>is</em> the stored experience: the database state before the
                    change, the action taken, the confidence it was taken with, and the measured
                    outcome. The experience repository is this same table, read back as a knowledge
                    base — which is what the retrieval layer will index once it exists.
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {[
                      ['optimizationType', data.type],
                      ['action', data.action],
                      ['expectedGain', formatFixed(data.expectedGain, 3)],
                      ['actualGain', formatFixed(data.actualGain, 3)],
                    ].map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded border border-base-700/60 bg-base-950/50 px-2 py-1.5"
                      >
                        <p className="font-mono text-2xs text-base-500">{key}</p>
                        <p className="mono-num mt-0.5 truncate text-xs text-base-100">{value}</p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel>
                  <SectionLabel>Agent event trail</SectionLabel>
                  <p className="mt-2 text-xs leading-relaxed text-base-300">
                    Every state transition for this optimization was appended to the activity
                    timeline.
                  </p>
                  <LinkButton to="/agent/activity" variant="outline" size="sm" className="mt-2.5">
                    Open activity timeline
                  </LinkButton>
                </Panel>
              </div>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function ComparePanel({
  title,
  subtitle,
  snapshot,
  tone,
}: {
  title: string;
  subtitle: string;
  snapshot?: { tps: number; qps: number; p95LatencyMs: number; avgLatencyMs: number };
  tone: 'neutral' | 'accent';
}) {
  return (
    <Panel className={cn(tone === 'accent' && 'border-accent-500/40')}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionLabel>{title}</SectionLabel>
          <p className="mt-0.5 text-2xs text-base-400">{subtitle}</p>
        </div>
        {tone === 'accent' ? <TrendingUp className="h-4 w-4 text-accent-400" aria-hidden /> : null}
      </div>

      {snapshot ? (
        <KeyValueList className="mt-3">
          <KeyValue label="TPS" mono>
            {formatFixed(snapshot.tps, 1)}
          </KeyValue>
          <KeyValue label="QPS" mono>
            {formatFixed(snapshot.qps, 1)}
          </KeyValue>
          <KeyValue label="P95 latency" mono>
            {formatMs(snapshot.p95LatencyMs)}
          </KeyValue>
          <KeyValue label="Average latency" mono>
            {formatMs(snapshot.avgLatencyMs)}
          </KeyValue>
        </KeyValueList>
      ) : (
        <p className="mt-3 text-xs text-base-400">Not measured.</p>
      )}
    </Panel>
  );
}

function DeltaRow({
  label,
  before,
  after,
  higherIsBetter = false,
}: {
  label: string;
  before: number;
  after: number;
  higherIsBetter?: boolean;
}) {
  const change = before === 0 ? 0 : (after - before) / before;
  const good = higherIsBetter ? change >= 0 : change <= 0;
  const Icon = change >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-base-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="mono-num text-2xs text-base-400">
          {formatFixed(before, 2)} → {formatFixed(after, 2)}
        </span>
        <span
          className={cn(
            'mono-num flex items-center gap-0.5 text-xs font-medium',
            good ? 'text-status-ok' : 'text-status-danger',
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {Math.abs(change * 100).toFixed(1)}%
        </span>
      </span>
    </div>
  );
}

