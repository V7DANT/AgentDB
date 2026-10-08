import type { ActiveQuery, DatabaseState, PerformanceIndicators } from '@/types';
import { DB_INFO } from './context';
import { MOCK_QUERIES } from './queries';
import { generateSeries } from '@/utils/series';

/**
 * The canonical "current database state" object.
 *
 * The future State Collector will produce exactly this shape. Until then the
 * dashboard labels it as a simulated observation window.
 */

const SERIES_END = new Date();

const tpsSeries = generateSeries({
  count: 24,
  base: 1712,
  volatility: 92,
  min: 1180,
  max: 2140,
  seed: 20261006,
  startTime: SERIES_END,
  stepMinutes: 5,
});

const p95Series = generateSeries({
  count: 24,
  base: 24.8,
  volatility: 3.1,
  min: 13.2,
  max: 58.4,
  seed: 771002,
  startTime: SERIES_END,
  stepMinutes: 5,
});

const avgLatencySeries = generateSeries({
  count: 24,
  base: 9.4,
  volatility: 0.9,
  min: 5.1,
  max: 18.6,
  seed: 445120,
  startTime: SERIES_END,
  stepMinutes: 5,
});

const cpuSeries = generateSeries({
  count: 24,
  base: 41.6,
  volatility: 6.4,
  min: 12,
  max: 89,
  seed: 918273,
  startTime: SERIES_END,
  stepMinutes: 5,
});

const memorySeries = generateSeries({
  count: 24,
  base: 38.2,
  volatility: 1.5,
  min: 30,
  max: 47,
  seed: 556677,
  startTime: SERIES_END,
  stepMinutes: 5,
});

export const MOCK_PERFORMANCE: PerformanceIndicators = {
  tps: 1712.4,
  qps: 9_877.2,
  p95LatencyMs: 24.8,
  avgLatencyMs: 9.4,
  maxLatencyMs: 141.2,
  activeQueries: 6,
  activeConnections: 23,
  maxConnections: 100,
  cpuPercent: 41.6,
  memoryPercent: 38.2,
  cacheHitRatio: 0.947,
};

export const MOCK_ACTIVE_QUERIES: ActiveQuery[] = [
  {
    pid: 38214,
    database: 'agentdb',
    username: 'app_rw',
    state: 'active',
    query:
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
    queryStart: new Date(Date.now() - 1_820).toISOString(),
    waitEventType: null,
    waitEvent: null,
    durationMs: 1820,
  },
  {
    pid: 38219,
    database: 'agentdb',
    username: 'app_rw',
    state: 'active',
    query:
      'SELECT o.id, o.total_amount, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = $1 AND o.created_at >= $2',
    queryStart: new Date(Date.now() - 640).toISOString(),
    waitEventType: null,
    waitEvent: null,
    durationMs: 640,
  },
  {
    pid: 38226,
    database: 'agentdb',
    username: 'analytics',
    state: 'active',
    query:
      "SELECT date_trunc('day', created_at) AS day, COUNT(*) FROM orders WHERE created_at >= now() - interval '30 days' GROUP BY 1",
    queryStart: new Date(Date.now() - 3_140).toISOString(),
    waitEventType: 'IO',
    waitEvent: 'DataFileRead',
    durationMs: 3140,
  },
  {
    pid: 38231,
    database: 'agentdb',
    username: 'app_rw',
    state: 'active',
    query: 'SELECT * FROM order_items WHERE product_id = $1 LIMIT 50',
    queryStart: new Date(Date.now() - 280).toISOString(),
    waitEventType: null,
    waitEvent: null,
    durationMs: 280,
  },
  {
    pid: 38237,
    database: 'agentdb',
    username: 'app_rw',
    state: 'idle in transaction',
    query: 'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2',
    queryStart: new Date(Date.now() - 12_400).toISOString(),
    waitEventType: 'Client',
    waitEvent: 'ClientRead',
    durationMs: 12_400,
  },
  {
    pid: 38241,
    database: 'agentdb',
    username: 'analytics',
    state: 'active',
    query:
      'SELECT c.segment, COUNT(*), AVG(o.total_amount) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.segment',
    queryStart: new Date(Date.now() - 1_120).toISOString(),
    waitEventType: 'IO',
    waitEvent: 'DataFileRead',
    durationMs: 1120,
  },
];

const topQueries = [...MOCK_QUERIES]
  .sort((a, b) => b.totalExecTimeMs - a.totalExecTimeMs)
  .slice(0, 8);

export const MOCK_DATABASE_STATE: DatabaseState = {
  info: DB_INFO,
  performance: MOCK_PERFORMANCE,
  series: {
    tps: tpsSeries,
    p95Latency: p95Series,
    avgLatency: avgLatencySeries,
    cpu: cpuSeries,
    memory: memorySeries,
  },
  topQueries,
  activeQueries: MOCK_ACTIVE_QUERIES,
  collectedAt: new Date().toISOString(),
};
