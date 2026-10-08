import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Crumb {
  label: string;
  to?: string;
}

/** Breadcrumb trail used on every detail page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-xs', className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !last ? (
              <Link to={item.to} className="text-base-300 transition-colors hover:text-base-100">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'text-base-200' : 'text-base-300'}>{item.label}</span>
            )}
            {!last ? <ChevronRight className="h-3 w-3 text-base-500" aria-hidden /> : null}
          </span>
        );
      })}
    </nav>
  );
}
