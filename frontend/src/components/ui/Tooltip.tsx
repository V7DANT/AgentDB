import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Lightweight CSS-only tooltip.
 * Deliberately dependency-free — the app has no tooltip library.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content?: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  if (!content) return <>{children}</>;

  const positions = {
    top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
    left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
    right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
  } as const;

  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-40 hidden w-max max-w-xs rounded border border-base-600/80 bg-base-850 px-2 py-1 text-2xs leading-relaxed text-base-100 shadow-lg group-hover:block',
          positions[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
