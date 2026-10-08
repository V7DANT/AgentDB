import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RefreshCw, Sigma } from 'lucide-react';
import type { IndexSortKey } from '@/types';
import { PageHeader, SearchInput } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, KeyValue, KeyValueList, SectionLabel } from '@/components/ui/Panel';
import { DataTable, type Column, type SortState } from '@/components/ui/Table';
import { Badge, DataSourceBadge, IndexUsageBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { Meter } from '@/components/ui/Progress';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useDebouncedValue, useServiceQuery } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatBytes, formatCompactNumber, formatDate, formatNumber } from '@/utils/format';

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

const SORT_KEYS: IndexSortKey[] = ['name', 'table', 'sizeBytes', 'scans'];

export function IndexesPage() {
  const [search, setSearch] = useState('');
  const [usage, setUsage] = useState<'ALL' | 'USED' | 'RARELY_USED' | 'UNUSED'>('ALL');
  const [sort, setSort] = useState<SortState>({ key: 'sizeBytes', direction: 'desc' });
  const debouncedSearch = useDebouncedValue(search);
  const navigate = useNavigate();

  const indexes = useServiceQuery((services) => services.schema.getIndexes(), []);

  const rows = useMemo(() => {
    let all = indexes.data ?? [];
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      all = all.filter(
        (index) =>
          index.name.toLowerCase().includes(needle) ||
          index.table.toLowerCase().includes(needle) ||
          index.columns.some((column) => column.toLowerCase().includes(needle)),
      );
    }
    if (usage !== 'ALL') all = all.filter((index) => index.usage === usage);

    if (!SORT_KEYS.includes(sort.key as IndexSortKey)) return all;
    const key = sort.key as IndexSortKey;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...all].sort((a, b) => {
      if (typeof a[key] === 'string') {
        return String(a[key]).localeCompare(String(b[key])) * direction;
      }
      return ((a[key] as number) - (b[key] as number)) * direction;
    });
  }, [indexes.data, debouncedSearch, usage, sort]);

  const unused = (indexes.data ?? []).filter((index) => index.usage === 'UNUSED');

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Index',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-base-100">{row.name}</span>
      ),
    },
    {
      key: 'table',
      header: 'Table',
      sortable: true,
      render: (row) => <span className="text-xs text-base-200">{row.table}</span>,
    },
    {
      key: 'columns',
      header: 'Columns',
      render: (row) => (
        <span className="font-mono text-xs text-base-200">({row.columns.join(', ')})</span>
      ),
    },
    {
      key: 'sizeBytes',
      header: 'Size',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatBytes(row.sizeBytes)}</span>,
    },
    {
      key: 'scans',
      header: 'Scans',
      align: 'right',
      sortable: true,
      tooltip: 'idx_scan from pg_stat_user_indexes',
      render: (row) => (
        <span className={cn('mono-num text-xs', row.scans === 0 && 'text-status-danger')}>
          {formatNumber(row.scans)}
        </span>
      ),
    },
    {
      key: 'share',
      header: 'Share',
      align: 'right',
      tooltip: 'Percentage of index scans on the table served by this index',
      render: (row) => (
        <span className="mono-num text-xs text-base-200">{formatNumber(row.usageShare, 1)}%</span>
      ),
    },
    {
      key: 'usage',
      header: 'Status',
      render: (row) => <IndexUsageBadge usage={row.usage} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Indexes"
        description="pg_stat_user_indexes — every index, its size, how often the planner selects it, and whether it earns its write cost."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={indexes.reload}
            loading={indexes.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              {rows.length} indexes ·{' '}
              {formatBytes(rows.reduce((sum, index) => sum + index.sizeBytes, 0))} total
            </span>
          </>
        }
      />

      {unused.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-md border border-status-warn/25 bg-status-warn/[0.06] px-3 py-2.5 text-xs text-status-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            <span className="font-medium">
              {unused.length} index{unused.length > 1 ? 'es have' : ' has'} recorded zero scans
            </span>{' '}
            since the statistics were last reset:{' '}
            <span className="font-mono">{unused.map((index) => index.name).join(', ')}</span>. They
            still incur write cost on every insert and update.
          </p>
        </div>
      ) : null}

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <Sigma className="h-4 w-4 text-base-400" />
            Index inventory
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search index, table or column…"
            />
            <select
              value={usage}
              onChange={(event) => setUsage(event.target.value as typeof usage)}
              className="h-9 rounded-md border border-base-700/70 bg-base-900/80 px-2.5 text-sm text-base-50 focus:border-accent-500/70 focus:outline-none"
            >
              <option value="ALL">All usage</option>
              <option value="USED">Used</option>
              <option value="RARELY_USED">Rarely used</option>
              <option value="UNUSED">Unused</option>
            </select>
          </div>
        }
      >
        <AsyncBoundary
          state={indexes}
          skeleton={<TableSkeleton rows={8} columns={6} />}
          loadingLabel="Loading index statistics…"
        >
          {() => (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.name}
              sort={sort}
              onSortChange={setSort}
              onRowClick={(row) => navigate(`/indexes/${row.name}`)}
              emptyMessage="No indexes match these filters."
            />
          )}
        </AsyncBoundary>
      </PanelSection>

      <Notice tone="neutral">
        “Unused” means zero recorded scans over the statistics window — it is not a permanent
        judgement. Rarely-used indexes may serve an infrequent but critical query.
      </Notice>
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function IndexDetailPage() {
  const { indexName = '' } = useParams();
  const index = useServiceQuery((services) => services.schema.getIndex(indexName), [indexName]);
  const allIndexes = useServiceQuery((services) => services.schema.getIndexes(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={index.data?.name ?? indexName}
        description="Index definition, usage statistics and the queries that depend on it."
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Database', to: '/indexes' },
              { label: 'Indexes', to: '/indexes' },
              { label: indexName },
            ]}
          />
        }
        actions={
          <LinkButton
            to="/indexes"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Back to indexes
          </LinkButton>
        }
      />

      <AsyncBoundary state={index} skeleton={<TableSkeleton rows={5} columns={3} />} loadingLabel="Loading index…">
        {(data) => {
          const siblings = (allIndexes.data ?? []).filter(
            (candidate) => candidate.table === data.table,
          );
          const tableScans = siblings.reduce((sum, candidate) => sum + candidate.scans, 0);

          return (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Panel>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SectionLabel>Definition</SectionLabel>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-base-700/70 bg-base-950/70 px-3 py-2.5 font-mono text-xs leading-relaxed text-base-100">
{`CREATE ${data.unique ? 'UNIQUE ' : ''}INDEX ${data.name}
  ON ${data.schema}.${data.table} USING ${data.indexType}
  (${data.columns.join(', ')});`}
                      </pre>
                    </div>
                    <IndexUsageBadge usage={data.usage} />
                  </div>
                  {data.notes ? (
                    <p className="mt-3 rounded-md border border-base-700/60 bg-base-950/50 px-2.5 py-2 text-xs leading-relaxed text-base-200">
                      {data.notes}
                    </p>
                  ) : null}
                </Panel>

                <Panel>
                  <SectionLabel>Usage</SectionLabel>
                  <div className="mt-3 space-y-4">
                    <Meter
                      label="Share of index scans on this table"
                      value={data.usageShare}
                      display={`${formatNumber(data.usageShare, 1)}%`}
                      tone={data.usageShare === 0 ? 'danger' : data.usageShare < 10 ? 'warn' : 'ok'}
                      hint={
                        tableScans > 0
                          ? `${formatNumber(data.scans)} of ${formatNumber(tableScans)} scans on ${data.table}`
                          : 'No sibling index scans recorded'
                      }
                    />
                    <Meter
                      label="Disk footprint"
                      value={data.sizeBytes}
                      max={Math.max(
                        ...siblings.map((candidate) => candidate.sizeBytes),
                        1,
                      )}
                      display={formatBytes(data.sizeBytes)}
                      tone="accent"
                      hint={`${(data.sizeBytes / siblings.reduce((sum, c) => sum + c.sizeBytes, 1) * 100).toFixed(1)}% of the indexes on ${data.table}`}
                    />
                  </div>
                </Panel>

                <PanelSection
                  title="Related queries"
                  description="Statements whose access path uses this index"
                >
                  {data.relatedQueries.length === 0 ? (
                    <EmptyState
                      compact
                      title="No query currently uses this index"
                      description="The planner has not selected it in the observed workload."
                    />
                  ) : (
                    <ul className="divide-y divide-base-800/70">
                      {data.relatedQueries.map((query) => (
                        <li key={query} className="px-4 py-2.5 text-xs text-base-200">
                          {query}
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              </div>

              <div className="space-y-4">
                <Panel>
                  <SectionLabel>Statistics</SectionLabel>
                  <KeyValueList className="mt-2.5">
                    <KeyValue label="Table" mono>
                      <Link to={`/tables/${data.table}`} className="text-accent-300 hover:text-accent-200">
                        {data.schema}.{data.table}
                      </Link>
                    </KeyValue>
                    <KeyValue label="Columns" mono>
                      ({data.columns.join(', ')})
                    </KeyValue>
                    <KeyValue label="Type" mono>
                      {data.indexType}
                      {data.unique ? ' · unique' : ''}
                    </KeyValue>
                    <KeyValue label="Size" mono>
                      {formatBytes(data.sizeBytes)}
                    </KeyValue>
                    <KeyValue label="Scan count" mono>
                      {formatNumber(data.scans)}
                    </KeyValue>
                    <KeyValue label="Tuples read" mono>
                      {formatNumber(data.tuplesRead)}
                    </KeyValue>
                    <KeyValue label="Tuples fetched" mono>
                      {formatNumber(data.tuplesFetched)}
                    </KeyValue>
                    <KeyValue label="Created">{formatDate(data.created)}</KeyValue>
                  </KeyValueList>
                </Panel>

                <Panel>
                  <SectionLabel>Indexes on {data.table}</SectionLabel>
                  <ul className="mt-2.5 space-y-1.5">
                    {siblings.map((sibling) => (
                      <li key={sibling.name}>
                        <Link
                          to={`/indexes/${sibling.name}`}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-colors',
                            sibling.name === data.name
                              ? 'border-accent-500/50 bg-accent-500/[0.07]'
                              : 'border-base-700/60 bg-base-950/40 hover:border-base-600',
                          )}
                        >
                          <span className="truncate font-mono text-2xs text-base-100">
                            {sibling.name}
                          </span>
                          <span className="mono-num shrink-0 text-2xs text-base-400">
                            {formatBytes(sibling.sizeBytes)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>

                {data.usage === 'UNUSED' ? (
                  <Notice tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                    This index has never been used in the observed window. Dropping it would reduce
                    write amplification, but confirm the query pattern still exists before acting —
                    the Index Expert never proposes a drop without a usage window.
                  </Notice>
                ) : null}
              </div>
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
