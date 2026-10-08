import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { NAVIGATION } from '@/app/navigation';
import { useServiceQuery } from '@/hooks';
import { DATA_SOURCE } from '@/services';
import { cn } from '@/utils/cn';

interface SidebarProps {
  /** Controls the mobile drawer. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const summary = useServiceQuery((services) => services.optimizations.getSummary(), []);
  const dbInfo = useServiceQuery((services) => services.state.getDatabaseInfo(), []);
  const pending = summary.data?.pending ?? 0;
  const db = dbInfo.data;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-base-950/70 backdrop-blur-sm lg:hidden',
          open ? 'block' : 'hidden',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-base-800/80 bg-base-925',
          'transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-base-800/80 px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-accent-500/40 bg-accent-500/10">
              <span className="font-mono text-xs font-bold text-accent-300">A</span>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-base-50">AgentDB</p>
              <p className="text-2xs text-base-400">Control &amp; Observability</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-base-400 hover:bg-base-800 hover:text-base-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
          {NAVIGATION.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-base-500">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        title={item.description}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                            isActive
                              ? 'bg-base-800/80 text-base-50'
                              : 'text-base-300 hover:bg-base-850/70 hover:text-base-100',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isActive ? 'text-accent-400' : 'text-base-400 group-hover:text-base-300',
                              )}
                              aria-hidden
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge === 'pending' && pending > 0 ? (
                              <span className="mono-num rounded border border-status-warn/30 bg-status-warn/10 px-1.5 py-0.5 text-2xs font-semibold text-status-warn">
                                {pending}
                              </span>
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — states where the numbers actually come from. */}
        <div className="border-t border-base-800/80 px-4 py-3">
          <p className="text-2xs leading-relaxed text-base-400">
            Data source · {DATA_SOURCE === 'api' ? 'live collector API' : 'in-memory mock'}
            <br />
            {db ? `${db.versionShort} · ${db.databaseName}` : 'Backend unreachable'}
          </p>
        </div>
      </aside>
    </>
  );
}
