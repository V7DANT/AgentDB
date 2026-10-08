import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 border-b border-base-700/70', className)}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              active
                ? 'border-accent-500 text-base-50'
                : 'border-transparent text-base-300 hover:border-base-600 hover:text-base-100',
              item.disabled && 'cursor-not-allowed opacity-40 hover:border-transparent',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                  active ? 'bg-accent-500/15 text-accent-300' : 'bg-base-800 text-base-300',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control used for mutually exclusive view options. */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; title?: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-base-700/70 bg-base-900/70 p-0.5',
        className,
      )}
    >
      {items.map((item) => (
        <Tooltip key={item.id} content={item.title}>
          <button
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              item.id === value
                ? 'bg-base-750 text-base-50 shadow-sm'
                : 'text-base-300 hover:text-base-100',
            )}
          >
            {item.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
