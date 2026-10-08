import type { HealthStatus } from './common';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  /** Present when the column is part of an index. */
  indexed?: boolean;
}

/**
 * A row from pg_stat_user_tables joined with table size and column metadata.
 */
export interface TableStat {
  name: string;
  schema: string;
  /** Live + dead tuple estimate; mirrors pg_class.reltuples semantics. */
  rows: number;
  seqScans: number;
  seqTuplesRead: number;
  indexScans: number;
  indexTuplesFetched: number;
  inserts: number;
  updates: number;
  deletes: number;
  liveTuples: number;
  deadTuples: number;
  sizeBytes: number;
  indexSizeBytes: number;
  lastVacuum: string | null;
  lastAnalyze: string | null;
  columns: ColumnInfo[];
  indexNames: string[];
  health: TableHealth;
}

export interface TableHealth {
  status: HealthStatus;
  notes: string[];
}

export type TableSortKey = 'rows' | 'seqScans' | 'indexScans' | 'deadTuples' | 'sizeBytes';
