import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  GitCommitHorizontal,
  ListChecks,
  Play,
  Settings2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ActivityEvent, ActivityType } from '@/types';
import { cn } from '@/utils/cn';
import { formatRelativeTime, formatTime } from '@/utils/format';

const TYPE_ICON: Record<ActivityType, typeof Activity> = {
  OBSERVATION: Database,
  ANALYSIS: ListChecks,
  EXPERT_INVOKED: Brain,
  RECOMMENDATION: Sparkles,
  VALIDATION: ShieldCheck,
  APPROVAL: CheckCircle2,
  REJECTION: XCircle,
  EXECUTION: Play,
  BENCHMARK: Settings2,
  LEARNING: BookOpen,
  SYSTEM: GitCommitHorizontal,
};

const LEVEL_STYLE = {
  INFO: 'border-base-600/70 bg-base-850 text-base-300',
  SUCCESS: 'border-status-ok/30 bg-status-ok/10 text-status-ok',
  WARNING: 'border-status-warn/30 bg-status-warn/10 text-status-warn',
  ERROR: 'border-status-danger/30 bg-status-danger/10 text-status-danger',
} as const;

/**
 * Timeline of agent events.
 *
 * Renders any `ActivityEvent[]`, so it works unchanged against the future
 * event-stream endpoint.
 */
export function ActivityFeed({
  events,
  compact = false,
  className,
}: {
  events: ActivityEvent[];
  compact?: boolean;
  className?: string;
}) {
  if (events.length === 0) {
    return <p className="px-4 py-8 text-center text-xs text-base-400">No activity recorded.</p>;
  }

  return (
    <ol className={cn('relative', compact ? 'px-4 py-2' : 'px-4 py-3', className)}>
      {/* Vertical rail */}
      <span
        className="absolute bottom-4 left-[1.4rem] top-4 w-px bg-base-800"
        aria-hidden
      />
      {events.map((event) => {
        const Icon = TYPE_ICON[event.type] ?? AlertTriangle;
        return (
          <li key={event.id} className="relative flex gap-3 py-2">
            <span
              className={cn(
                'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                LEVEL_STYLE[event.level],
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-xs font-medium text-base-50">{event.message}</p>
                <time
                  className="mono-num text-2xs text-base-400"
                  dateTime={event.timestamp}
                  title={new Date(event.timestamp).toLocaleString('en-US')}
                >
                  {compact ? formatRelativeTime(event.timestamp) : formatTime(event.timestamp)}
                </time>
              </div>
              {event.detail ? (
                <p className="mt-0.5 text-2xs leading-relaxed text-base-300">{event.detail}</p>
              ) : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-base-500">
                <span className="font-mono">{event.actor}</span>
                <span className="rounded border border-base-700/60 bg-base-850/70 px-1 py-px uppercase tracking-wide">
                  {event.type.replace('_', ' ')}
                </span>
                {event.relatedLabel ? <span>{event.relatedLabel}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
