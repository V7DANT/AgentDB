import { Link } from 'react-router-dom';
import { Bell, Menu, RotateCcw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusDot } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { useServiceQuery } from '@/hooks';
import { DATA_SOURCE, resetMockData } from '@/services';
import { ENVIRONMENT } from '@/data/context';
import { formatBytes } from '@/utils/format';

interface HeaderProps {
  onOpenSidebar: () => void;
}

/**
 * Application header.
 *
 * Shows only the two things an operator needs at a glance: is PostgreSQL up,
 * and what is waiting for a decision.
 */
export function Header({ onOpenSidebar }: HeaderProps) {
  const dbInfo = useServiceQuery((services) => services.state.getDatabaseInfo(), []);
  const summary = useServiceQuery((services) => services.optimizations.getSummary(), []);

  const info = dbInfo.data;
  const pending = summary.data?.pending ?? 0;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-base-800/80 bg-base-925/95 px-3 backdrop-blur sm:px-4">
      <Button
        variant="ghost"
        size="sm"
        className="px-2 lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <Tooltip
          content={
            info
              ? `${info.version}\nDatabase: ${info.databaseName}\nSize: ${formatBytes(info.sizeBytes)}`
              : 'Loading PostgreSQL information…'
          }
        >
          <span className="flex items-center gap-2 rounded-md border border-base-700/70 bg-base-900/70 px-2.5 py-1.5">
            <Terminal className="h-3.5 w-3.5 text-base-400" aria-hidden />
            <span className="hidden text-xs text-base-200 sm:inline">PostgreSQL</span>
            <StatusDot
              tone={info?.status === 'ONLINE' ? 'ok' : 'warn'}
              label={info?.status ?? '…'}
              pulse={info?.status === 'ONLINE'}
            />
          </span>
        </Tooltip>

        <Tooltip content={`Machine fingerprint: ${ENVIRONMENT.machineId} · ${ENVIRONMENT.os}`}>
          <span className="hidden items-center gap-2 rounded-md border border-base-700/70 bg-base-900/70 px-2.5 py-1.5 md:flex">
            <span className="text-xs text-base-200">{ENVIRONMENT.label}</span>
            <span className="font-mono text-2xs text-base-400">{ENVIRONMENT.machineId}</span>
          </span>
        </Tooltip>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {DATA_SOURCE === 'mock' ? (
          <Tooltip content="Restore the seeded demo dataset (clears approvals and rejections)">
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => {
                resetMockData();
              }}
            >
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip content={`${pending} recommendation(s) awaiting review`}>
          <Link
            to="/recommendations"
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-base-700/70 bg-base-900/70 text-base-300 transition-colors hover:text-base-50"
            aria-label={`${pending} pending recommendations`}
          >
            <Bell className="h-3.5 w-3.5" />
            {pending > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-base-925 bg-status-warn px-1 text-[0.625rem] font-bold text-base-950">
                {pending}
              </span>
            ) : null}
          </Link>
        </Tooltip>

        <Tooltip content="Operator session">
          <div className="flex items-center gap-2 rounded-md border border-base-700/70 bg-base-900/70 px-2 py-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-base-700 text-2xs font-semibold text-base-100">
              OP
            </span>
            <span className="hidden text-xs text-base-200 sm:inline">operator</span>
          </div>
        </Tooltip>
      </div>
    </header>
  );
}
