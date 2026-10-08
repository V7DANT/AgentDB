import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  width = 'w-full sm:w-72',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  width?: string;
}) {
  return (
    <div className={cn('relative', width, className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-base-700/70 bg-base-900/80 pl-8 pr-2.5 text-sm text-base-50 placeholder:text-base-500 focus:border-accent-500/70 focus:outline-none"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2', className)}>
      {label ? <span className="text-xs text-base-300">{label}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle switch                                                       */
/* ------------------------------------------------------------------ */

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-base-50">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-base-300">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked
            ? 'border-accent-500/70 bg-accent-600/80'
            : 'border-base-600/70 bg-base-750',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.15rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radio group                                                         */
/* ------------------------------------------------------------------ */

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; description?: string; recommended?: boolean }[];
  name: string;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
              selected
                ? 'border-accent-500/60 bg-accent-500/[0.07]'
                : 'border-base-700/70 bg-base-900/50 hover:border-base-600',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-3.5 w-3.5 accent-accent-500"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm text-base-50">{option.label}</span>
                {option.recommended ? (
                  <span className="rounded border border-status-ok/30 bg-status-ok/10 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-status-ok">
                    Recommended
                  </span>
                ) : null}
              </span>
              {option.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-base-300">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-800/70 px-3 py-2.5">
      <p className="text-xs text-base-300">
        <span className="mono-num text-base-100">{first}</span>–
        <span className="mono-num text-base-100">{last}</span> of{' '}
        <span className="mono-num text-base-100">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={[10, 20, 50, 100].map((size) => ({
              value: String(size),
              label: `${size} / page`,
            }))}
          />
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 text-xs text-base-300">
            Page <span className="mono-num text-base-100">{page}</span> /{' '}
            <span className="mono-num">{pageCount}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="border-b border-base-800/70 pb-4">
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-base-50">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-base-300">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="mt-3 flex flex-wrap items-center gap-3">{meta}</div> : null}
    </header>
  );
}

/** Small monospace helper for SQL snippets in tables and lists. */
export function SqlSnippet({
  sql,
  maxLength = 110,
  className,
}: {
  sql: string;
  maxLength?: number;
  className?: string;
}) {
  const collapsed = sql.replace(/\s+/g, ' ').trim();
  const display =
    collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
  return (
    <code
      title={collapsed}
      className={cn('font-mono text-xs leading-relaxed text-base-100', className)}
    >
      {display}
    </code>
  );
}
