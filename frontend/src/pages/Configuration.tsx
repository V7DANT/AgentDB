import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import type { ConfigCategory } from '@/types';
import { PageHeader, SearchInput } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, KeyValue, KeyValueList, SectionLabel } from '@/components/ui/Panel';
import { DataTable, type Column } from '@/components/ui/Table';
import { Badge, ConfigStatusBadge, DataSourceBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, TableSkeleton } from '@/components/ui/States';
import { ConfidenceBar, GainBar } from '@/components/ui/Progress';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useDebouncedValue, useServiceQuery } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/format';

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  MEMORY: 'Memory',
  CONNECTIONS: 'Connections',
  PLANNER: 'Planner',
  PARALLELISM: 'Parallelism',
  MAINTENANCE: 'Maintenance',
  WAL: 'WAL',
};

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

export function ConfigurationPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ConfigCategory | 'ALL'>('ALL');
  const debouncedSearch = useDebouncedValue(search);
  const navigate = useNavigate();

  const parameters = useServiceQuery((services) => services.schema.getParameters(), []);

  const rows = useMemo(() => {
    let all = parameters.data ?? [];
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      all = all.filter(
        (parameter) =>
          parameter.name.toLowerCase().includes(needle) ||
          parameter.description.toLowerCase().includes(needle),
      );
    }
    if (category !== 'ALL') all = all.filter((parameter) => parameter.category === category);
    return all;
  }, [parameters.data, debouncedSearch, category]);

  const withRecommendation = (parameters.data ?? []).filter(
    (parameter) => parameter.recommendation !== undefined,
  );

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Parameter',
      render: (row) => <span className="font-mono text-xs text-base-100">{row.name}</span>,
    },
    {
      key: 'currentValue',
      header: 'Current value',
      render: (row) => (
        <span className="mono-num text-xs text-base-100">{row.currentValue}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge tone="neutral">{CATEGORY_LABELS[row.category]}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="line-clamp-2 max-w-lg text-xs leading-relaxed text-base-300">
          {row.description}
        </span>
      ),
    },
    {
      key: 'recommendation',
      header: 'Proposal',
      render: (row) =>
        row.recommendation ? (
          <span className="flex items-center gap-2">
            <span className="mono-num text-xs text-accent-300">
              {row.recommendation.recommendedValue}
            </span>
            <GainBar value={row.recommendation.expectedImprovement} showSign={false} />
          </span>
        ) : (
          <span className="text-2xs text-base-500">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ConfigStatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="PostgreSQL configuration"
        description="The parameters the Memory / Configuration Expert reasons about, with their current values and the Configuration Expert's proposals."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={parameters.reload}
            loading={parameters.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              {withRecommendation.length} parameters have a pending proposal
            </span>
          </>
        }
      />

      <Notice tone="info">
        The <span className="font-medium">current values</span> below are read live from{' '}
        <span className="font-mono">pg_settings</span> on the running instance. The{' '}
        <span className="font-medium">recommendations</span> column is the output of the Configuration
        Expert; no tuning model has been trained yet, so it is empty.
      </Notice>

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-base-400" />
            Parameters
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search parameters…"
              width="w-full sm:w-64"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
              className="h-9 rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
            >
              <option value="ALL">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <AsyncBoundary
          state={parameters}
          skeleton={<TableSkeleton rows={10} columns={5} />}
          loadingLabel="Loading configuration…"
        >
          {() => (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.name}
              onRowClick={(row) => navigate(`/configuration/${row.name}`)}
              emptyMessage="No parameters match these filters."
            />
          )}
        </AsyncBoundary>
      </PanelSection>
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function ParameterDetailPage() {
  const { parameterName = '' } = useParams();
  const parameter = useServiceQuery(
    (services) => services.schema.getParameter(parameterName),
    [parameterName],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={parameter.data?.name ?? parameterName}
        description="Current value, semantics, and the Configuration Expert's proposal for this parameter."
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Database', to: '/configuration' },
              { label: 'Configuration', to: '/configuration' },
              { label: parameterName },
            ]}
          />
        }
        actions={
          <LinkButton
            to="/configuration"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Back to configuration
          </LinkButton>
        }
      />

      <AsyncBoundary
        state={parameter}
        skeleton={<TableSkeleton rows={5} columns={3} />}
        loadingLabel="Loading parameter…"
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>Semantics</SectionLabel>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-base-200">
                      {data.description}
                    </p>
                  </div>
                  <ConfigStatusBadge status={data.status} />
                </div>
              </Panel>

              <Panel>
                <SectionLabel>Current value</SectionLabel>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="mono-num text-3xl font-semibold text-base-50">
                    {data.currentValue}
                  </span>
                  <Badge tone={data.requiresRestart ? 'warn' : 'ok'}>
                    {data.requiresRestart ? 'restart required' : 'reload only'}
                  </Badge>
                </div>
                <KeyValueList className="mt-3">
                  <KeyValue label="Category" mono>
                    {CATEGORY_LABELS[data.category]}
                  </KeyValue>
                  <KeyValue label="Setting name" mono>
                    {data.name}
                  </KeyValue>
                  <KeyValue label="Applies to">Server-wide (per-operation for work_mem)</KeyValue>
                </KeyValueList>
              </Panel>

              <Panel>
                <SectionLabel>How the backend will read this</SectionLabel>
                <pre className="mt-2 overflow-x-auto rounded border border-base-700/60 bg-base-950/60 p-2.5 font-mono text-2xs leading-relaxed text-base-300">
{`SELECT name, setting, unit, context, short_desc
FROM pg_settings
WHERE name = '${data.name}';`}
                </pre>
                <p className="mt-2 text-2xs text-base-400">
                  <span className="font-mono">SchemaService.getParameter(name)</span> returns exactly
                  the object rendered on this page.
                </p>
              </Panel>
            </div>

            <div className="space-y-4">
              {data.recommendation ? (
                <Panel>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>Proposed change</SectionLabel>
                    <Badge tone="warn" dot>
                      Simulated
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-base-700/70 bg-base-950/50 px-3 py-2.5">
                      <p className="text-2xs uppercase tracking-wider text-base-400">Current</p>
                      <p className="mono-num mt-1 text-lg text-base-50">
                        {data.recommendation.currentValue}
                      </p>
                    </div>
                    <div className="rounded-md border border-accent-500/40 bg-accent-500/[0.07] px-3 py-2.5">
                      <p className="text-2xs uppercase tracking-wider text-accent-300">Recommended</p>
                      <p className="mono-num mt-1 text-lg text-accent-200">
                        {data.recommendation.recommendedValue}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-2xs uppercase tracking-wider text-base-400">
                        Expected improvement
                      </p>
                      <div className="mt-1.5">
                        <GainBar value={data.recommendation.expectedImprovement} showSign={false} />
                      </div>
                    </div>
                    <div>
                      <p className="text-2xs uppercase tracking-wider text-base-400">Confidence</p>
                      <div className="mt-1.5">
                        <ConfidenceBar value={data.recommendation.confidence} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-2xs uppercase tracking-wider text-base-400">Rationale</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-base-200">
                      {data.recommendation.rationale}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <LinkButton
                      to="/recommendations"
                      variant="primary"
                      size="sm"
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                    >
                      Review in optimization centre
                    </LinkButton>
                  </div>
                </Panel>
              ) : (
                <Panel>
                  <SectionLabel>Proposed change</SectionLabel>
                  <p className="mt-3 text-xs leading-relaxed text-base-300">
                    The Configuration Expert has no proposal for this parameter. Its current value is
                    consistent with the recorded workload.
                  </p>
                </Panel>
              )}

              <Panel>
                <SectionLabel>Feedback loop</SectionLabel>
                <ol className="mt-3 space-y-2 text-xs leading-relaxed text-base-300">
                  {[
                    'Collect current GUC values and host limits',
                    'Observe workload metrics for one window',
                    'Propose a parameter set with confidence',
                    'Validate against a re-run of the same workload',
                    'Store the outcome in the Experience Repository',
                  ].map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span
                        className={cn(
                          'mono-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs',
                          index < 2
                            ? 'border-status-ok/40 bg-status-ok/10 text-status-ok'
                            : 'border-base-600/70 bg-base-850 text-base-300',
                        )}
                      >
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-2xs text-base-400">
                  Step 1 is produced by the State Collector; the recommendation itself is the
                  Configuration Expert's output, which is not implemented yet.
                </p>
              </Panel>

              {data.recommendation ? (
                <Notice tone="neutral">
                  Confidence {formatPercent(data.recommendation.confidence, 0)} · expected gain{' '}
                  {formatPercent(data.recommendation.expectedImprovement, 1)} · requires{' '}
                  {data.requiresRestart ? 'a restart' : 'only a configuration reload'}.
                </Notice>
              ) : null}
            </div>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
