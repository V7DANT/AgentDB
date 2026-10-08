import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  /** Relative change vs. the previous window, e.g. 0.12 for +12%. */
  delta?: number;
  /** Set when a rising value is bad (latency, CPU). */
  invertDelta?: boolean;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'accent';
  icon?: ReactNode;
  tooltip?: ReactNode;
  className?: string;
}

const VALUE_TONES = {
  default: 'text-base-50',
  ok: 'text-status-ok',
  warn: 'text-status-warn',
  danger: 'text-status-danger',
  accent: 'text-accent-300',
} as const;

/**
 * A single performance indicator.
 * Values are rendered in tabular figures so columns of tiles stay aligned.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  delta,
  invertDelta = false,
  tone = 'default',
  icon,
  tooltip,
  className,
}: StatTileProps) {
  const deltaPositive = delta !== undefined && delta > 0;
  const deltaGood = delta === undefined ? null : invertDelta ? !deltaPositive : deltaPositive;
  const DeltaIcon =
    delta === undefined || Math.abs(delta) < 0.0005 ? Minus : deltaPositive ? ArrowUpRight : ArrowDownRight;

  const body = (
    <div className={cn('panel p-3.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-base-400">{label}</span>
        {icon ? <span className="text-base-500">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('mono-num text-[1.375rem] font-semibold leading-none', VALUE_TONES[tone])}>
          {value}
        </span>
        {unit ? <span className="text-xs text-base-400">{unit}</span> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-2xs text-base-400">{hint}</span>
        {delta != null ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums',
              deltaGood === null
                ? 'text-base-400'
                : deltaGood
                  ? 'text-status-ok'
                  : 'text-status-danger',
            )}
          >
            <DeltaIcon className="h-3 w-3" aria-hidden />
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  );

  return tooltip ? <Tooltip content={tooltip}>{body}</Tooltip> : body;
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
