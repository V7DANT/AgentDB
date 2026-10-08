import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-base-700/50', className)}
      aria-hidden
    />
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="panel p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-base-800/70">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5', columnIndex === 0 ? 'w-1/3' : 'w-16')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-1" style={{ height }}>
      {Array.from({ length: 18 }).map((_, index) => (
        <Skeleton
          key={index}
          className="flex-1"
          // Deterministic pseudo-random heights so the load state looks like a chart.
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full-area states                                                    */
/* ------------------------------------------------------------------ */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <RefreshCw className="h-5 w-5 animate-spin text-base-400" aria-hidden />
      <p className="text-sm text-base-300">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Could not load this data',
}: {
  error?: Error | null;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-status-danger/30 bg-status-danger/10">
        <AlertTriangle className="h-4 w-4 text-status-danger" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-base-50">{title}</p>
        <p className="mt-1 max-w-md text-xs text-base-300">
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'empty',
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'empty' | 'search' | 'offline';
  compact?: boolean;
}) {
  const Icon =
    variant === 'search' ? SearchX : variant === 'offline' ? WifiOff : Inbox;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-8' : 'py-14',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-base-700/70 bg-base-850/70">
        {icon ?? <Icon className="h-4 w-4 text-base-400" aria-hidden />}
      </span>
      <div>
        <p className="text-sm font-medium text-base-50">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-base-300">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Renders whichever of the four async states applies, so pages never forget
 * one. Keeps loading / empty / error handling consistent across the app.
 */
export function AsyncBoundary<T>({
  state,
  isEmpty,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyAction,
  loadingLabel,
  children,
  skeleton,
}: {
  state: { data: T | null; error: Error | null; loading: boolean; refreshing: boolean; reload: () => void };
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loadingLabel?: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.loading) {
    return <>{skeleton ?? <LoadingState label={loadingLabel} />}</>;
  }
  if (state.error && state.data === null) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  if (state.data === null) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  if (isEmpty?.(state.data)) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }
  return <>{children(state.data)}</>;
}
