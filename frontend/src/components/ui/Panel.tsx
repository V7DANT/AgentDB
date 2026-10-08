import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Removes the inner padding so tables can run edge-to-edge. */
  flush?: boolean;
}

export function Panel({ children, className, flush = false, ...rest }: PanelProps) {
  return (
    <section className={cn('panel', flush ? 'overflow-hidden' : 'p-4', className)} {...rest}>
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, description, actions, icon, className }: PanelHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-base-300">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-base-300">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Panel variant with the header separated by a border (used for tables). */
export function PanelSection({
  title,
  description,
  actions,
  icon,
  children,
  className,
  bodyClassName,
}: PanelHeaderProps & { children: ReactNode; bodyClassName?: string }) {
  return (
    <section className={cn('panel overflow-hidden', className)}>
      <div className="panel-header">
        <PanelHeader title={title} description={description} icon={icon} />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Small structural helpers                                            */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        'text-2xs font-semibold uppercase tracking-[0.14em] text-base-400',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-base-700/60', className)} />;
}

interface KeyValueProps {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}

export function KeyValue({ label, children, mono = false, className }: KeyValueProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className="text-xs text-base-300">{label}</dt>
      <dd className={cn('text-right text-xs text-base-50', mono && 'font-mono tabular-nums')}>
        {children}
      </dd>
    </div>
  );
}

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-base-800/70', className)}>{children}</dl>;
}

/** Visually distinct note used to flag simulated / not-yet-connected behaviour. */
export function Notice({
  children,
  tone = 'info',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'neutral';
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-accent-500/25 bg-accent-500/[0.06] text-accent-200',
    warning: 'border-status-warn/25 bg-status-warn/[0.07] text-status-warn',
    neutral: 'border-base-700/70 bg-base-850/70 text-base-200',
  } as const;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs leading-relaxed',
        tones[tone],
        className,
      )}
    >
      {icon ? <span className="mt-px shrink-0">{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
