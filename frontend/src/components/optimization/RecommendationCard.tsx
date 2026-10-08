import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Gauge,
  Settings2,
  Sparkles,
  Terminal,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import type { Optimization, OptimizationType } from '@/types';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { ConfidenceBar, GainBar } from '@/components/ui/Progress';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { formatCompactNumber, formatMs, formatPercent } from '@/utils/format';

const TYPE_META: Record<
  OptimizationType,
  { label: string; icon: typeof Sparkles; tone: 'accent' | 'info' | 'warn' | 'ok' | 'neutral' }
> = {
  INDEX: { label: 'Index optimization', icon: Database, tone: 'accent' },
  CONFIGURATION: { label: 'Configuration tuning', icon: Settings2, tone: 'info' },
  QUERY_REWRITE: { label: 'Query rewrite', icon: Wand2, tone: 'warn' },
  VACUUM: { label: 'Maintenance', icon: Trash2, tone: 'neutral' },
  STATISTICS: { label: 'Statistics', icon: Gauge, tone: 'neutral' },
};

export function OptimizationTypeBadge({ type }: { type: OptimizationType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

interface RecommendationCardProps {
  optimization: Optimization;
  onApprove?: (optimization: Optimization) => void;
  onReject?: (optimization: Optimization) => void;
  /** Hides the action buttons (used on the read-only recommendations page). */
  readOnly?: boolean;
  className?: string;
}

/**
 * The primary optimization artifact: detected problem, proposed change, and the
 * decision controls. Used on both the Recommendations and Pending Actions pages.
 */
export function RecommendationCard({
  optimization,
  onApprove,
  onReject,
  readOnly = false,
  className,
}: RecommendationCardProps) {
  const { problem } = optimization;

  return (
    <article className={cn('panel overflow-hidden', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-800/70 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border',
              problem.severity === 'HIGH'
                ? 'border-status-danger/30 bg-status-danger/10 text-status-danger'
                : problem.severity === 'MEDIUM'
                  ? 'border-status-warn/30 bg-status-warn/10 text-status-warn'
                  : 'border-base-600/70 bg-base-800/60 text-base-300',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={problem.severity} />
              <OptimizationTypeBadge type={optimization.type} />
              <span className="font-mono text-2xs text-base-400">{optimization.id}</span>
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-base-50">{problem.summary}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-base-300">{problem.detail}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LinkButton
            to={`/recommendations/${optimization.id}`}
            variant="outline"
            size="sm"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Review
          </LinkButton>
          {!readOnly && onApprove ? (
            <Button
              variant="success"
              size="sm"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => onApprove(optimization)}
            >
              Approve
            </Button>
          ) : null}
          {!readOnly && onReject ? (
            <Button
              variant="outline"
              size="sm"
              icon={<XCircle className="h-3.5 w-3.5" />}
              onClick={() => onReject(optimization)}
            >
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      {/* Problem metrics */}
      <div className="grid grid-cols-2 divide-base-800/70 border-b border-base-800/70 sm:grid-cols-4 sm:divide-x">
        <MetricCell
          label="Query frequency"
          value={`${formatCompactNumber(problem.queryFrequency)} calls`}
        />
        <MetricCell label="Average latency" value={formatMs(problem.averageLatencyMs)} />
        <MetricCell
          label="Confidence"
          value={<ConfidenceBar value={optimization.confidence} showLabel={false} />}
        />
        <MetricCell
          label="Expected improvement"
          value={<GainBar value={optimization.expectedGain} showSign={false} />}
        />
      </div>

      {/* Proposed change */}
      <div className="px-4 py-3">
        <p className="text-2xs font-semibold uppercase tracking-wider text-base-400">
          Recommended {optimization.type === 'CONFIGURATION' ? 'configuration change' : 'action'}
        </p>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-base-700/70 bg-base-950/60 px-3 py-2.5">
          <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-base-500" aria-hidden />
          <code className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-base-100">
            {optimization.statement}
          </code>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-base-400">
          <Tooltip content="Expert that generated this recommendation">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" aria-hidden />
              Expert: <span className="text-base-200">{optimization.expert}</span>
            </span>
          </Tooltip>
          <span>
            Target: <span className="font-mono text-base-200">{optimization.target}</span>
          </span>
          <span>
            Projected gain:{' '}
            <span className="text-status-ok">{formatPercent(optimization.expectedGain, 0)}</span>
          </span>
          {optimization.queryId ? (
            <Link
              to={`/queries/${optimization.queryId}`}
              className="text-accent-300 hover:text-accent-200"
            >
              Inspect source query →
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetricCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <div className="mt-1 text-sm text-base-50">{value}</div>
    </div>
  );
}
