import type { TimeSeriesPoint } from './common';
import type { QueryStat } from './query';

export type DatabaseStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export interface DatabaseInfo {
  status: DatabaseStatus;
  version: string;
  versionShort: string;
  databaseName: string;
  host: string;
  port: number;
  sizeBytes: number;
  uptimeSeconds: number;
  /** Whether pg_stat_statements is currently available. */
  pgStatStatements: boolean;
}

export interface PerformanceSnapshotMetric {
  label: string;
  value: number;
  unit: string;
}

/**
 * Live-looking performance indicators surfaced on the dashboard.
 * These correspond to the metrics the Sysbench S1/S2 experiments measure.
 */
export interface PerformanceIndicators {
  tps: number;
  qps: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  activeQueries: number;
  activeConnections: number;
  maxConnections: number;
  cpuPercent: number;
  memoryPercent: number;
  cacheHitRatio: number;
}

export interface MetricsSeries {
  tps: TimeSeriesPoint[];
  p95Latency: TimeSeriesPoint[];
  avgLatency: TimeSeriesPoint[];
  cpu: TimeSeriesPoint[];
  memory: TimeSeriesPoint[];
}

export interface ActiveQuery {
  pid: number;
  database: string;
  username: string;
  state: string;
  query: string;
  queryStart: string;
  waitEventType: string | null;
  waitEvent: string | null;
  durationMs: number;
}

/**
 * The canonical "database state" object produced by the planned State Collector.
 * The dashboard and every observability page read from this shape.
 */
export interface DatabaseState {
  info: DatabaseInfo;
  performance: PerformanceIndicators;
  series: MetricsSeries;
  topQueries: QueryStat[];
  activeQueries: ActiveQuery[];
  collectedAt: string;
}
