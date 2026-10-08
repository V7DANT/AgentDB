import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/format';

/** Generic filled bar. */
export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  className,
  height = 'h-1.5',
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
  className?: string;
  height?: string;
}) {
  const colors = {
    accent: 'bg-accent-500',
    ok: 'bg-status-ok',
    warn: 'bg-status-warn',
    danger: 'bg-status-danger',
    info: 'bg-status-info',
  } as const;
  const ratio = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-base-700/60', height, className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', colors[tone])}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}

/**
 * Confidence indicator with an explicit label.
 * High confidence is green, medium amber, low red — no colour-only signalling.
 */
export function ConfidenceBar({
  value,
  className,
  showLabel = true,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const tone = value >= 0.8 ? 'ok' : value >= 0.6 ? 'warn' : 'danger';
  const label = value >= 0.8 ? 'High' : value >= 0.6 ? 'Medium' : 'Low';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ProgressBar value={value * 100} tone={tone} className="w-16" />
      <span className="mono-num text-xs text-base-100">{formatPercent(value, 0)}</span>
      {showLabel ? <span className="text-2xs text-base-400">{label}</span> : null}
    </div>
  );
}

/** Signed improvement bar: green for gains, red for regressions. */
export function GainBar({
  value,
  className,
  showSign = true,
}: {
  value: number;
  className?: string;
  showSign?: boolean;
}) {
  const positive = value >= 0;
  const width = Math.min(100, Math.abs(value) * 200); // 50% of bar == 25% gain
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'mono-num w-14 text-right text-xs font-medium',
          positive ? 'text-status-ok' : 'text-status-danger',
        )}
      >
        {showSign && positive ? '+' : ''}
        {formatPercent(value, 1)}
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-base-700/60">
        <div
          className={cn('h-full rounded-full', positive ? 'bg-status-ok' : 'bg-status-danger')}
          style={{ width: `${Math.max(4, width)}%` }}
        />
      </div>
    </div>
  );
}

/** Horizontal meter with a caption row, used on detail pages. */
export function Meter({
  label,
  value,
  max = 100,
  display,
  tone = 'accent',
  hint,
}: {
  label: ReactNode;
  value: number;
  max?: number;
  display?: ReactNode;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
  hint?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-base-300">{label}</span>
        <span className="mono-num text-xs text-base-50">{display ?? value}</span>
      </div>
      <ProgressBar value={value} max={max} tone={tone} className="mt-1.5" />
      {hint ? <p className="mt-1 text-2xs text-base-400">{hint}</p> : null}
    </div>
  );
}
