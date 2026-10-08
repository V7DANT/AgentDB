export type IndexUsageStatus = 'USED' | 'RARELY_USED' | 'UNUSED';

export interface IndexInfo {
  name: string;
  schema: string;
  table: string;
  columns: string[];
  indexType: string;
  unique: boolean;
  sizeBytes: number;
  /** pg_stat_user_indexes.idx_scan */
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  usage: IndexUsageStatus;
  /** Percentage of table index scans served, derived for display. */
  usageShare: number;
  created: string;
  relatedQueries: string[];
  notes?: string;
}

export type IndexSortKey = 'name' | 'table' | 'sizeBytes' | 'scans';
