import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { DATA_SOURCE } from '@/services';
import type {
  ActivityLevel,
  IndexUsageStatus,
  OptimizationStatus,
  Severity,
  ValidationStatus,
  HealthStatus,
  ConfigStatus,
  BenchmarkStatus,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Base badge                                                          */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger' | 'accent' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: 'border-base-600/70 bg-base-800/70 text-base-200',
  muted: 'border-base-700/60 bg-base-850/60 text-base-300',
  info: 'border-status-info/30 bg-status-info/10 text-status-info',
  ok: 'border-status-ok/30 bg-status-ok/10 text-status-ok',
  warn: 'border-status-warn/30 bg-status-warn/10 text-status-warn',
  danger: 'border-status-danger/30 bg-status-danger/10 text-status-danger',
  accent: 'border-accent-500/40 bg-accent-500/10 text-accent-300',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
  mono = false,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide',
        TONES[tone],
        mono && 'font-mono',
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Domain badges                                                       */
/* ------------------------------------------------------------------ */

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Tone = severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warn' : 'ok';
  return <Badge tone={tone}>{severity}</Badge>;
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  const map: Record<HealthStatus, Tone> = {
    GOOD: 'ok',
    WARNING: 'warn',
    CRITICAL: 'danger',
    UNKNOWN: 'muted',
  };
  return <Badge tone={map[status]} dot>{status}</Badge>;
}

const OPTIMIZATION_TONES: Record<OptimizationStatus, Tone> = {
  DRAFT: 'muted',
  PENDING: 'warn',
  APPROVED: 'info',
  REJECTED: 'neutral',
  APPLIED: 'accent',
  VALIDATED: 'ok',
  FAILED: 'danger',
};

export function OptimizationStatusBadge({ status }: { status: OptimizationStatus }) {
  return (
    <Badge tone={OPTIMIZATION_TONES[status]} dot>
      {status.replace('_', ' ')}
    </Badge>
  );
}

const VALIDATION_TONES: Record<ValidationStatus, Tone> = {
  CONFIRMED: 'ok',
  PENDING: 'warn',
  REGRESSION: 'danger',
  NOT_RUN: 'muted',
};

export function ValidationBadge({ status }: { status: ValidationStatus }) {
  return <Badge tone={VALIDATION_TONES[status]}>{status.replace('_', ' ')}</Badge>;
}

const ACTIVITY_TONES: Record<ActivityLevel, Tone> = {
  INFO: 'neutral',
  SUCCESS: 'ok',
  WARNING: 'warn',
  ERROR: 'danger',
};

export function ActivityLevelBadge({ level }: { level: ActivityLevel }) {
  return <Badge tone={ACTIVITY_TONES[level]}>{level}</Badge>;
}

const INDEX_USAGE_TONES: Record<IndexUsageStatus, Tone> = {
  USED: 'ok',
  RARELY_USED: 'warn',
  UNUSED: 'danger',
};

export function IndexUsageBadge({ usage }: { usage: IndexUsageStatus }) {
  return <Badge tone={INDEX_USAGE_TONES[usage]}>{usage.replace('_', ' ')}</Badge>;
}

const CONFIG_TONES: Record<ConfigStatus, Tone> = {
  DEFAULT: 'neutral',
  TUNED: 'ok',
  SUBOPTIMAL: 'warn',
  WARNING: 'danger',
};

export function ConfigStatusBadge({ status }: { status: ConfigStatus }) {
  return <Badge tone={CONFIG_TONES[status]}>{status}</Badge>;
}

const BENCHMARK_TONES: Record<BenchmarkStatus, Tone> = {
  COMPLETED: 'ok',
  RUNNING: 'info',
  QUEUED: 'warn',
  FAILED: 'danger',
  PLANNED: 'muted',
};

export function BenchmarkStatusBadge({ status }: { status: BenchmarkStatus }) {
  return (
    <Badge tone={BENCHMARK_TONES[status]} dot>
      {status}
    </Badge>
  );
}

/** Flags data provenance so simulated content is never mistaken for live data. */
export function SourceBadge({ source }: { source: 'MOCK' | 'API' | 'RESULTS_DIR' | 'SIMULATED' }) {
  const map = {
    MOCK: { tone: 'warn' as Tone, label: 'Mock data' },
    SIMULATED: { tone: 'warn' as Tone, label: 'Simulated' },
    API: { tone: 'ok' as Tone, label: 'Live API' },
    RESULTS_DIR: { tone: 'info' as Tone, label: 'Recorded results' },
  };
  const { tone, label } = map[source];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/**
 * Provenance badge for the page header.
 *
 * Reads the resolved data source so a page can never claim to be simulated
 * while it is in fact reporting numbers collected from a live PostgreSQL.
 */
export function DataSourceBadge() {
  return <SourceBadge source={DATA_SOURCE === 'api' ? 'API' : 'MOCK'} />;
}

/** Compact inline status dot + label used in headers and lists. */
export function StatusDot({
  tone = 'ok',
  label,
  pulse = false,
}: {
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
  label?: string;
  pulse?: boolean;
}) {
  const colors = {
    ok: 'bg-status-ok',
    warn: 'bg-status-warn',
    danger: 'bg-status-danger',
    neutral: 'bg-base-400',
  } as const;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', colors[tone], pulse && 'animate-pulse')} />
      {label ? <span className="text-xs text-base-200">{label}</span> : null}
    </span>
  );
}
