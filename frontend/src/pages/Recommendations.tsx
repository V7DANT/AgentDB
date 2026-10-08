import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import type { OptimizationType, Severity } from '@/types';
import { PageHeader, Select } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, KeyValue, KeyValueList, SectionLabel } from '@/components/ui/Panel';
import { Badge, DataSourceBadge, OptimizationStatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { ConfidenceBar, GainBar } from '@/components/ui/Progress';
import { OptimizationTypeBadge, RecommendationCard } from '@/components/optimization/RecommendationCard';
import { useOptimizationDecisions } from '@/components/optimization/useOptimizationDecisions';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useServiceQuery, useMutation } from '@/hooks';
import { useServices } from '@/services';
import { useToast } from '@/components/ui/Toast';
import { formatCompactNumber, formatDateTime, formatMs, formatPercent } from '@/utils/format';

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

export function RecommendationsPage() {
  const [type, setType] = useState<OptimizationType | 'ALL'>('ALL');
  const [severity, setSeverity] = useState<Severity | 'ALL'>('ALL');

  const recommendations = useServiceQuery(
    (services) => services.optimizations.getRecommendations(),
    [],
  );
  const summary = useServiceQuery((services) => services.optimizations.getSummary(), []);
  const decisions = useOptimizationDecisions();

  const services = useServices();
  const toast = useToast();
  const scan = useMutation(() => services.optimizations.runDetection());

  /** Asks the backend detector to look for new problems and re-reads the queue. */
  const runScan = async () => {
    try {
      const result = await scan.run();
      services.invalidate?.();
      recommendations.reload();
      summary.reload();
      toast.push({
        tone: result.queued > 0 ? 'success' : 'info',
        title:
          result.queued > 0 ? `${result.queued} new proposal(s)` : 'No new issues found',
        description:
          result.queued > 0
            ? `Queued: ${result.created.join(', ')}`
            : `Examined ${result.examined} relation(s). Run a workload first so there are scans to analyse.`,
      });
    } catch (error) {
      toast.push({
        tone: 'error',
        title: 'Scan failed',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const rows = useMemo(() => {
    let all = recommendations.data ?? [];
    if (type !== 'ALL') all = all.filter((item) => item.type === type);
    if (severity !== 'ALL') all = all.filter((item) => item.problem.severity === severity);
    return [...all].sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      if (rank[a.problem.severity] !== rank[b.problem.severity]) {
        return rank[a.problem.severity] - rank[b.problem.severity];
      }
      return b.expectedGain - a.expectedGain;
    });
  }, [recommendations.data, type, severity]);

  const stats = summary.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Optimization recommendations"
        description="Detected problems and the proposed interventions. Every recommendation carries a confidence estimate, an expected gain and an explicit statement to execute."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={runScan}
              loading={scan.pending}
            >
              Scan for issues
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={recommendations.reload}
              loading={recommendations.refreshing}
            >
              Refresh
            </Button>
          </div>
        }
        meta={
          <>
            <DataSourceBadge />
            {stats ? (
              <span className="text-2xs text-base-400">
                <span className="text-status-warn">{stats.pending} pending</span> ·{' '}
                <span className="text-status-ok">{stats.validated} validated</span> ·{' '}
                <span className="text-base-300">{stats.rejected} rejected</span>
              </span>
            ) : null}
            {stats ? (
              <span className="text-2xs text-base-400">
                aggregate projected gain{' '}
                <span className="mono-num text-status-ok">
                  {formatPercent(stats.projectedGain, 1)}
                </span>
              </span>
            ) : null}
          </>
        }
      />

      <Notice tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        These proposals come from a <span className="font-medium">rule-based index advisor</span>,
        not a trained model: it reads <span className="font-mono">pg_stat_user_tables</span> for
        tables scanned far more than they are indexed, then re-plans the offending statement with{' '}
        <span className="font-mono">EXPLAIN (FORMAT JSON)</span> to find the column the filter uses.
        Nothing is executed against PostgreSQL — approving records the decision, appends it to the
        history and emits an activity event.{' '}
        <span className="font-medium">Scan for issues</span> re-runs the detector.
      </Notice>

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-base-400" />
            Pending review
            <span className="mono-num text-xs font-normal text-base-400">({rows.length})</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'INDEX', label: 'Index' },
                { value: 'CONFIGURATION', label: 'Configuration' },
                { value: 'QUERY_REWRITE', label: 'Query rewrite' },
                { value: 'VACUUM', label: 'Maintenance' },
              ]}
            />
            <Select
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'ALL', label: 'All severities' },
                { value: 'HIGH', label: 'High' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LOW', label: 'Low' },
              ]}
            />
          </div>
        }
      >
        <AsyncBoundary
          state={recommendations}
          skeleton={<div className="space-y-3 p-4"><TableSkeleton rows={4} columns={4} /></div>}
          loadingLabel="Loading recommendations…"
          isEmpty={(data) => data.length === 0}
          emptyTitle="No recommendations are awaiting review"
          emptyDescription="The agent has not proposed any changes, or every proposal has already been decided."
          emptyAction={<LinkButton to="/history" variant="outline" size="sm">View history</LinkButton>}
        >
          {() =>
            rows.length === 0 ? (
              <EmptyState
                variant="search"
                title="No recommendations match these filters"
                description="Broaden the type or severity filter to see more."
              />
            ) : (
              <div className="space-y-3 p-4">
                {rows.map((optimization) => (
                  <RecommendationCard
                    key={optimization.id}
                    optimization={optimization}
                    onApprove={decisions.requestApprove}
                    onReject={decisions.requestReject}
                  />
                ))}
              </div>
            )
          }
        </AsyncBoundary>
      </PanelSection>

      {decisions.dialogs}
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function RecommendationDetailPage() {
  const { optimizationId = '' } = useParams();
  const optimization = useServiceQuery(
    (services) => services.optimizations.getOptimization(optimizationId),
    [optimizationId],
  );
  const decisions = useOptimizationDecisions();

  return (
    <div className="space-y-5">
      <PageHeader
        title={optimization.data?.title ?? 'Recommendation'}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Optimization', to: '/recommendations' },
              { label: 'Recommendations', to: '/recommendations' },
              { label: optimizationId },
            ]}
          />
        }
        actions={
          <>
            <LinkButton
              to="/recommendations"
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Back
            </LinkButton>
            {optimization.data?.status === 'PENDING' ? (
              <>
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  onClick={() => decisions.requestApprove(optimization.data!)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  onClick={() => decisions.requestReject(optimization.data!)}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <AsyncBoundary
        state={optimization}
        skeleton={<TableSkeleton rows={8} columns={3} />}
        loadingLabel="Loading recommendation…"
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Panel>
                <div className="flex flex-wrap items-center gap-2">
                  <OptimizationStatusBadge status={data.status} />
                  <OptimizationTypeBadge type={data.type} />
                  <SeverityBadge severity={data.problem.severity} />
                  <span className="font-mono text-2xs text-base-400">{data.id}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-base-200">{data.description}</p>
              </Panel>

              <Panel>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-warn" aria-hidden />
                  <SectionLabel>Detected problem</SectionLabel>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-base-50">{data.problem.summary}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-base-300">{data.problem.detail}</p>

                <div className="mt-4 grid grid-cols-2 divide-base-800/70 border-t border-base-800/70 pt-3 sm:grid-cols-4 sm:divide-x">
                  <Cell label="Signal" value={data.problem.kind} />
                  <Cell label="Relation" value={data.problem.relation ?? '—'} mono />
                  <Cell label="Query frequency" value={`${formatCompactNumber(data.problem.queryFrequency)} calls`} />
                  <Cell label="Average latency" value={formatMs(data.problem.averageLatencyMs)} />
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent-400" aria-hidden />
                  <SectionLabel>Proposed action</SectionLabel>
                </div>
                <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-base-700/70 bg-base-950/70 px-3 py-3 font-mono text-xs leading-relaxed text-base-100">
                  {data.statement}
                </pre>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-base-400">Rationale</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {data.rationale.map((item) => (
                        <li key={item} className="text-xs leading-relaxed text-base-200">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-base-400">Risks</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {data.risks.map((item) => (
                        <li key={item} className="text-xs leading-relaxed text-status-warn">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>

              {data.status === 'REJECTED' && data.rejectionReason ? (
                <Notice tone="warning">
                  <span className="font-medium">Rejected:</span> {data.rejectionReason}
                </Notice>
              ) : null}
            </div>

            <div className="space-y-4">
              <Panel>
                <SectionLabel>Decision quality</SectionLabel>
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-base-400">Confidence</p>
                    <div className="mt-1.5">
                      <ConfidenceBar value={data.confidence} />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-base-400">
                      Expected improvement
                    </p>
                    <div className="mt-1.5">
                      <GainBar value={data.expectedGain} showSign={false} />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <SectionLabel>Provenance</SectionLabel>
                <KeyValueList className="mt-2.5">
                  <KeyValue label="Expert" mono>
                    {data.expert}
                  </KeyValue>
                  <KeyValue label="Target" mono>
                    {data.target}
                  </KeyValue>
                  <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                  <KeyValue label="Updated">{formatDateTime(data.updatedAt)}</KeyValue>
                  {data.reviewedAt ? (
                    <KeyValue label="Reviewed">{formatDateTime(data.reviewedAt)}</KeyValue>
                  ) : null}
                  {data.reviewedBy ? (
                    <KeyValue label="Reviewed by" mono>
                      {data.reviewedBy}
                    </KeyValue>
                  ) : null}
                </KeyValueList>
              </Panel>

              {data.queryId ? (
                <Panel>
                  <SectionLabel>Source query</SectionLabel>
                  <p className="mt-2 text-2xs text-base-400">
                    This recommendation was derived from the workload of:
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded border border-base-700/60 bg-base-950/60 p-2.5 font-mono text-2xs leading-relaxed text-base-200">
                    {data.queryText}
                  </pre>
                  <div className="mt-2 flex gap-2">
                    <LinkButton to={`/queries/${data.queryId}`} variant="outline" size="sm">
                      Query statistics
                    </LinkButton>
                    <LinkButton to={`/plans/${data.queryId}`} variant="ghost" size="sm">
                      Execution plan
                    </LinkButton>
                  </div>
                </Panel>
              ) : null}

              <Panel>
                <SectionLabel>Service contract</SectionLabel>
                <pre className="mt-2 overflow-x-auto rounded border border-base-700/60 bg-base-950/60 p-2.5 font-mono text-2xs leading-relaxed text-base-300">
{`OptimizationService.getOptimization("${data.id}")
OptimizationService.approve({ id })
OptimizationService.reject({ id, reason })`}
                </pre>
                <p className="mt-2 text-2xs text-base-400">
                  <Link to="/history" className="text-accent-300 hover:text-accent-200">
                    View optimization history →
                  </Link>
                </p>
              </Panel>

              <Panel>
                <SectionLabel>Review status</SectionLabel>
                <p className="mt-2 text-xs leading-relaxed text-base-300">
                  {data.status === 'PENDING'
                    ? 'Waiting for an operator decision. With HUMAN_APPROVAL mode the agent will never execute this change on its own.'
                    : data.status === 'REJECTED'
                      ? 'Rejected. The record is retained as negative training signal.'
                      : data.status === 'APPROVED'
                        ? 'Approved. The execution layer will apply the statement on the next cycle.'
                        : 'Decided. See the optimization history for measured results.'}
                </p>
                <p className="mt-2 text-2xs text-base-400">
                  Generated by <span className="flex items-center gap-1">{data.expert} expert</span> ·
                  confidence {formatPercent(data.confidence, 0)}
                </p>
              </Panel>
            </div>
          </div>
        )}
      </AsyncBoundary>

      {decisions.dialogs}
    </div>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-3 py-2 first:pl-0">
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p className={`mt-0.5 text-xs text-base-50 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
