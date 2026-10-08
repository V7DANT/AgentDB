import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Columns3, KeyRound, RefreshCw, Table2 } from 'lucide-react';
import type { TableSortKey } from '@/types';
import { PageHeader, SearchInput, SqlSnippet } from '@/components/ui/Inputs';
import { Panel, PanelSection, Notice, KeyValue, KeyValueList, SectionLabel } from '@/components/ui/Panel';
import { DataTable, type Column, type SortState } from '@/components/ui/Table';
import { Badge, DataSourceBadge, HealthBadge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { AsyncBoundary, EmptyState, TableSkeleton } from '@/components/ui/States';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useDebouncedValue, useServiceQuery } from '@/hooks';
import { cn } from '@/utils/cn';
import { formatBytes, formatCompactNumber, formatDateTime, formatNumber } from '@/utils/format';

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

const SORT_KEYS: TableSortKey[] = ['rows', 'seqScans', 'indexScans', 'deadTuples', 'sizeBytes'];

export function TablesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'sizeBytes', direction: 'desc' });
  const debouncedSearch = useDebouncedValue(search);
  const navigate = useNavigate();

  const tables = useServiceQuery((services) => services.schema.getTables(), []);
  const rows = useMemo(() => {
    const all = tables.data ?? [];
    const filtered = debouncedSearch
      ? all.filter((table) => table.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
      : all;
    if (!SORT_KEYS.includes(sort.key as TableSortKey)) return filtered;
    const key = sort.key as TableSortKey;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => (a[key] - b[key]) * direction);
  }, [tables.data, debouncedSearch, sort]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Table',
      render: (row) => (
        <div>
          <span className="text-xs text-base-50">{row.name}</span>
          <span className="ml-2 font-mono text-2xs text-base-500">{row.schema}</span>
        </div>
      ),
    },
    {
      key: 'rows',
      header: 'Rows',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatCompactNumber(row.rows)}</span>,
    },
    {
      key: 'seqScans',
      header: 'Seq scans',
      align: 'right',
      sortable: true,
      tooltip: 'seq_scan from pg_stat_user_tables',
      render: (row) => (
        <span
          className={cn('mono-num text-xs', row.seqScans > 5_000 && 'text-status-warn')}
        >
          {formatCompactNumber(row.seqScans)}
        </span>
      ),
    },
    {
      key: 'indexScans',
      header: 'Index scans',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatCompactNumber(row.indexScans)}</span>,
    },
    {
      key: 'deadTuples',
      header: 'Dead tuples',
      align: 'right',
      sortable: true,
      render: (row) => {
        const ratio = row.liveTuples > 0 ? row.deadTuples / row.liveTuples : 0;
        return (
          <span className={cn('mono-num text-xs', ratio > 0.05 && 'text-status-warn')}>
            {formatCompactNumber(row.deadTuples)}
          </span>
        );
      },
    },
    {
      key: 'sizeBytes',
      header: 'Size',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono-num text-xs">{formatBytes(row.sizeBytes)}</span>,
    },
    {
      key: 'health',
      header: 'Health',
      render: (row) => <HealthBadge status={row.health.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tables"
        description="pg_stat_user_tables joined with on-disk size, column metadata and an interpretable health assessment."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={tables.reload}
            loading={tables.refreshing}
          >
            Refresh
          </Button>
        }
        meta={
          <>
            <DataSourceBadge />
            <span className="text-2xs text-base-400">
              {rows.length} tables ·{' '}
              {formatBytes(rows.reduce((sum, table) => sum + table.sizeBytes, 0))} data +{' '}
              {formatBytes(rows.reduce((sum, table) => sum + table.indexSizeBytes, 0))} indexes
            </span>
          </>
        }
      />

      <PanelSection
        title={
          <span className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-base-400" />
            User tables
          </span>
        }
        actions={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter tables…"
            width="w-full sm:w-56"
          />
        }
      >
        <AsyncBoundary
          state={tables}
          skeleton={<TableSkeleton rows={8} columns={6} />}
          loadingLabel="Loading table statistics…"
        >
          {() => (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.name}
              sort={sort}
              onSortChange={setSort}
              onRowClick={(row) => navigate(`/tables/${row.name}`)}
              emptyMessage={debouncedSearch ? 'No tables match that filter.' : 'No tables found.'}
            />
          )}
        </AsyncBoundary>
      </PanelSection>

      <Notice tone="neutral">
        Health is derived from observable signals only — dead-tuple ratio above 5%, sequential scans
        on large relations, and missing statistics. No synthetic score is invented.
      </Notice>
    </div>
  );
}

/* ================================================================== */
/* Detail                                                              */
/* ================================================================== */

export function TableDetailPage() {
  const { tableName = '' } = useParams();
  const table = useServiceQuery((services) => services.schema.getTable(tableName), [tableName]);
  const indexes = useServiceQuery((services) => services.schema.getIndexes(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={table.data?.name ?? tableName}
        description="Table statistics, columns, indexes and tuple-level health."
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Database', to: '/tables' },
              { label: 'Tables', to: '/tables' },
              { label: tableName },
            ]}
          />
        }
        actions={
          <LinkButton
            to="/tables"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Back to tables
          </LinkButton>
        }
      />

      <AsyncBoundary state={table} skeleton={<TableSkeleton rows={6} columns={4} />} loadingLabel="Loading table…">
        {(data) => {
          const tableIndexes = (indexes.data ?? []).filter((index) => index.table === data.name);
          const deadRatio = data.liveTuples > 0 ? data.deadTuples / data.liveTuples : 0;

          return (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <Stat label="Rows" value={formatNumber(data.rows)} hint="reltuples estimate" />
                <Stat label="Table size" value={formatBytes(data.sizeBytes)} hint="heap only" />
                <Stat label="Index size" value={formatBytes(data.indexSizeBytes)} hint={`${data.indexNames.length} indexes`} />
                <Stat
                  label="Dead tuple ratio"
                  value={`${(deadRatio * 100).toFixed(1)}%`}
                  hint={deadRatio > 0.05 ? 'above 5% threshold' : 'within threshold'}
                  tone={deadRatio > 0.05 ? 'warn' : 'ok'}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <Panel>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>Columns</SectionLabel>
                      <Badge tone="neutral">{data.columns.length}</Badge>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Type</th>
                            <th className="text-center">Nullable</th>
                            <th className="text-center">Indexed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.columns.map((column) => (
                            <tr key={column.name}>
                              <td>
                                <span className="flex items-center gap-1.5 font-mono text-xs text-base-100">
                                  {column.isPrimaryKey ? (
                                    <KeyRound className="h-3 w-3 text-status-warn" aria-label="Primary key" />
                                  ) : null}
                                  {column.name}
                                </span>
                              </td>
                              <td className="font-mono text-xs text-base-300">{column.type}</td>
                              <td className="text-center text-xs text-base-300">
                                {column.nullable ? 'yes' : 'no'}
                              </td>
                              <td className="text-center">
                                {column.indexed ? (
                                  <Badge tone="ok">indexed</Badge>
                                ) : (
                                  <span className="text-base-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>

                  <PanelSection
                    title={
                      <span className="flex items-center gap-2">
                        <Columns3 className="h-4 w-4 text-base-400" />
                        Indexes on this table
                      </span>
                    }
                  >
                    <AsyncBoundary state={indexes} skeleton={<TableSkeleton rows={3} columns={3} />}>
                      {() =>
                        tableIndexes.length === 0 ? (
                          <EmptyState compact title="No indexes on this table" />
                        ) : (
                          <ul className="divide-y divide-base-800/70">
                            {tableIndexes.map((index) => (
                              <li key={index.name}>
                                <Link
                                  to={`/indexes/${index.name}`}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-base-800/40"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-xs text-base-100">
                                      {index.name}
                                    </span>
                                    <span className="text-2xs text-base-400">
                                      ({index.columns.join(', ')}) · {formatBytes(index.sizeBytes)}
                                    </span>
                                  </span>
                                  <span className="mono-num shrink-0 text-2xs text-base-300">
                                    {formatCompactNumber(index.scans)} scans
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )
                      }
                    </AsyncBoundary>
                  </PanelSection>
                </div>

                <div className="space-y-4">
                  <Panel>
                    <SectionLabel>Scan statistics</SectionLabel>
                    <KeyValueList className="mt-2.5">
                      <KeyValue label="Sequential scans" mono>
                        {formatNumber(data.seqScans)}
                      </KeyValue>
                      <KeyValue label="Sequential tuples read" mono>
                        {formatNumber(data.seqTuplesRead)}
                      </KeyValue>
                      <KeyValue label="Index scans" mono>
                        {formatNumber(data.indexScans)}
                      </KeyValue>
                      <KeyValue label="Index tuples fetched" mono>
                        {formatNumber(data.indexTuplesFetched)}
                      </KeyValue>
                    </KeyValueList>
                  </Panel>

                  <Panel>
                    <SectionLabel>Tuple activity</SectionLabel>
                    <KeyValueList className="mt-2.5">
                      <KeyValue label="Live tuples" mono>
                        {formatNumber(data.liveTuples)}
                      </KeyValue>
                      <KeyValue label="Dead tuples" mono>
                        {formatNumber(data.deadTuples)}
                      </KeyValue>
                      <KeyValue label="Inserts" mono>
                        {formatNumber(data.inserts)}
                      </KeyValue>
                      <KeyValue label="Updates" mono>
                        {formatNumber(data.updates)}
                      </KeyValue>
                      <KeyValue label="Deletes" mono>
                        {formatNumber(data.deletes)}
                      </KeyValue>
                    </KeyValueList>
                  </Panel>

                  <Panel>
                    <SectionLabel>Maintenance</SectionLabel>
                    <KeyValueList className="mt-2.5">
                      <KeyValue label="Last vacuum">{formatDateTime(data.lastVacuum)}</KeyValue>
                      <KeyValue label="Last analyze">{formatDateTime(data.lastAnalyze)}</KeyValue>
                      <KeyValue label="Schema" mono>
                        {data.schema}
                      </KeyValue>
                    </KeyValueList>
                  </Panel>

                  <Panel>
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>Table health</SectionLabel>
                      <HealthBadge status={data.health.status} />
                    </div>
                    <ul className="mt-2.5 space-y-2">
                      {data.health.notes.map((note) => (
                        <li
                          key={note}
                          className="rounded-md border border-base-700/60 bg-base-950/50 px-2.5 py-2 text-xs leading-relaxed text-base-200"
                        >
                          {note}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>
              </div>

              <Notice tone="neutral">
                <span className="font-mono text-2xs">TableStat</span> — this page renders the exact
                object the State Collector will return from pg_stat_user_tables.
                <SqlSnippet
                  sql="SELECT ... FROM pg_stat_user_tables JOIN pg_class ON ..."
                  className="mt-1 block text-base-400"
                />
              </Notice>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div className="panel p-4">
      <p className="text-2xs uppercase tracking-wider text-base-400">{label}</p>
      <p
        className={cn(
          'mono-num mt-1.5 text-xl font-semibold',
          tone === 'warn' ? 'text-status-warn' : tone === 'ok' ? 'text-status-ok' : 'text-base-50',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-2xs text-base-400">{hint}</p>
    </div>
  );
}
