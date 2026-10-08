import { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { ActivityLevel, ActivityType } from '@/types';
import { PageHeader, SearchInput, Select } from '@/components/ui/Inputs';
import { PanelSection, Notice } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { useDebouncedValue, useServiceQuery } from '@/hooks';

const TYPE_LABELS: Record<ActivityType, string> = {
  OBSERVATION: 'Observation',
  ANALYSIS: 'Analysis',
  EXPERT_INVOKED: 'Expert invoked',
  RECOMMENDATION: 'Recommendation',
  VALIDATION: 'Validation',
  APPROVAL: 'Approval',
  REJECTION: 'Rejection',
  EXECUTION: 'Execution',
  BENCHMARK: 'Benchmark',
  LEARNING: 'Learning',
  SYSTEM: 'System',
};

/**
 * Agent activity — the decision-cycle event log.
 *
 * Rendered from `ActivityEvent[]`, which is the shape a REST endpoint or an
 * event stream will return, so this page can switch to streaming without a
 * rewrite.
 */
export function AgentActivityPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<ActivityLevel | 'ALL'>('ALL');
  const [type, setType] = useState<ActivityType | 'ALL'>('ALL');
  const debouncedSearch = useDebouncedValue(search);

  const activity = useServiceQuery((services) => services.activity.getEvents({ limit: 200 }), []);

  const events = useMemo(() => {
    let all = activity.data ?? [];
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      all = all.filter(
        (event) =>
          event.message.toLowerCase().includes(needle) ||
          (event.detail ?? '').toLowerCase().includes(needle),
      );
    }
    if (level !== 'ALL') all = all.filter((event) => event.level === level);
    if (type !== 'ALL') all = all.filter((event) => event.type === type);
    return all;
  }, [activity.data, debouncedSearch, level, type]);

  const counts = useMemo(() => {
    const all = activity.data ?? [];
    return {
      total: all.length,
      success: all.filter((event) => event.level === 'SUCCESS').length,
      warning: all.filter((event) => event.level === 'WARNING').length,
      error: all.filter((event) => event.level === 'ERROR').length,
    };
  }, [activity.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agent activity"
        description="Every stage of the decision cycle: observation, analysis, expert invocation, recommendation, decision, execution and validation."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={activity.reload}
            loading={activity.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <Badge tone="warn" dot>
              mock events
            </Badge>
            <span className="text-2xs text-base-400">
              {counts.total} events ·{' '}
              <span className="text-status-ok">{counts.success} success</span> ·{' '}
              <span className="text-status-warn">{counts.warning} warning</span> ·{' '}
              <span className="text-status-danger">{counts.error} error</span>
            </span>
          </>
        }
      />

      <Notice tone="neutral">
        The agent appends every state transition to the event log as it runs. Events recorded by the
        collector and events raised by your own approvals and rejections appear in the same timeline.
      </Notice>

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-base-400" />
            Timeline
            <span className="mono-num text-xs font-normal text-base-400">({events.length})</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search events…"
              width="w-full sm:w-56"
            />
            <Select
              value={level}
              onChange={setLevel}
              options={[
                { value: 'ALL', label: 'All levels' },
                { value: 'SUCCESS', label: 'Success' },
                { value: 'INFO', label: 'Info' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'ERROR', label: 'Error' },
              ]}
            />
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: 'ALL', label: 'All types' },
                ...(Object.keys(TYPE_LABELS) as ActivityType[]).map((key) => ({
                  value: key,
                  label: TYPE_LABELS[key],
                })),
              ]}
            />
          </div>
        }
      >
        <AsyncBoundary
          state={activity}
          skeleton={<TableSkeleton rows={10} columns={2} />}
          loadingLabel="Loading activity…"
          isEmpty={(data) => data.length === 0}
          emptyTitle="No agent activity recorded"
          emptyDescription="The event log is empty."
        >
          {() =>
            events.length === 0 ? (
              <EmptyState
                variant="search"
                title="No events match these filters"
                description="Clear the search term or select a different event type."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setLevel('ALL');
                      setType('ALL');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ActivityFeed events={events} />
            )
          }
        </AsyncBoundary>
      </PanelSection>
    </div>
  );
}
