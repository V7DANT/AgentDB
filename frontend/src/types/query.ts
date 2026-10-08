import type { HealthStatus, Severity, TimeSeriesPoint } from './common';

export type QuerySeverity = Severity;

/**
 * A row from pg_stat_statements as exposed to the frontend.
 * Field names map 1:1 to the State Collector's planned workload model.
 */
export interface QueryStat {
  id: string;
  /** pg_stat_statements.queryid */
  queryId: string;
  /** Normalized query text. */
  query: string;
  /** Optional human label, e.g. "Customer order history". */
  label?: string;
  calls: number;
  totalExecTimeMs: number;
  meanExecTimeMs: number;
  rows: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  /** Derived: sharedBlksHit / (sharedBlksHit + sharedBlksRead). */
  cacheHitRatio: number;
  severity: QuerySeverity;
  /** Short sparkline of mean execution time (ms) over recent observations. */
  trend: number[];
  /** First characters of a stable fingerprint. */
  fingerprint: string;
}

export interface QueryAnalysis {
  queryId: string;
  /**
   * SIMULATED  — produced by the mock repository.
   * RULE_BASED — derived from real statistics and the EXPLAIN plan, no model.
   * MODEL      — reserved for the Query/Planner Expert.
   */
  status: 'SIMULATED' | 'RULE_BASED' | 'MODEL';
  generatedAt: string;
  summary: string;
  observations: string[];
  suspectedIssues: {
    title: string;
    detail: string;
    severity: QuerySeverity;
  }[];
  planSummary: string;
  suggestedFocus: string[];
}

export interface QueryFilter {
  search?: string;
  severity?: QuerySeverity | 'ALL';
}

export type QuerySortKey =
  | 'calls'
  | 'totalExecTimeMs'
  | 'meanExecTimeMs'
  | 'rows'
  | 'cacheHitRatio';

export interface QuerySort {
  key: QuerySortKey;
  direction: 'asc' | 'desc';
}

export interface QueryHealthSummary {
  totalQueries: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  overallStatus: HealthStatus;
}

/** Convenience aggregate used by the dashboard. */
export interface QueryTrend {
  queryId: string;
  points: TimeSeriesPoint[];
}
