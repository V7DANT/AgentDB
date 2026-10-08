import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  /** Fixed width, e.g. "8rem" — keeps numeric columns from jumping. */
  width?: string;
  tooltip?: string;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Message shown when `rows` is empty — the caller handles the richer state. */
  emptyMessage?: string;
  /** Highlights the hovered row and shows a pointer cursor. */
  interactive?: boolean;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Generic, sortable data table.
 *
 * Sorting is controlled: the table reports a sort request and the caller decides
 * whether to sort client-side or ask the service for a sorted page.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  sort,
  onSortChange,
  rowClassName,
  emptyMessage = 'No rows',
  interactive,
}: DataTableProps<T>) {
  const clickable = interactive ?? Boolean(onRowClick);

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (sort?.key === key) {
      onSortChange({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, direction: 'desc' });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const header = (
                <span className="inline-flex items-center gap-1">
                  {column.header}
                  {column.sortable ? (
                    active ? (
                      sort?.direction === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-accent-400" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-accent-400" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 text-base-500" />
                    )
                  ) : null}
                </span>
              );

              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(ALIGN[column.align ?? 'left'], column.headerClassName)}
                >
                  {column.sortable && onSortChange ? (
                    <Tooltip content={column.tooltip}>
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex items-center transition-colors hover:text-base-100',
                          active && 'text-base-50',
                        )}
                        aria-label={`Sort by ${String(column.header)}`}
                      >
                        {header}
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip content={column.tooltip}>{header}</Tooltip>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-sm text-base-300">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  clickable && 'cursor-pointer',
                  onRowClick && 'hover:bg-base-800/50',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(ALIGN[column.align ?? 'left'], column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
