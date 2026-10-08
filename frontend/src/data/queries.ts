import type { QueryStat } from '@/types';
import { createRng, severityFromLatency } from '@/utils/series';

/**
 * Mock pg_stat_statements workload.
 *
 * The values are deliberately plausible for the 4 × 100,000 row Sysbench
 * dataset plus a small application schema, and are kept internally consistent:
 * `totalExecTimeMs ≈ calls × meanExecTimeMs` and the cache hit ratio is derived
 * from the shared-block counters rather than invented.
 */

function mkTrend(base: number, seed: number, volatility = 0.14, count = 14): number[] {
  const rng = createRng(seed);
  let value = base * (1 - volatility * 1.5);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    value += (base - value) * 0.22 + (rng() - 0.5) * base * volatility;
    out.push(Number(Math.max(0, value).toFixed(3)));
  }
  return out;
}

interface QuerySeed {
  id: string;
  queryId: string;
  fingerprint: string;
  label: string;
  query: string;
  calls: number;
  meanExecTimeMs: number;
  rows: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  trendSeed: number;
  trendVolatility?: number;
}

const SEEDS: QuerySeed[] = [
  {
    id: 'q-001',
    queryId: '4817239542',
    fingerprint: 'a4f19c7e0b31',
    label: 'Customer recent orders',
    query:
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
    calls: 15_230,
    meanExecTimeMs: 42.1,
    rows: 296_840,
    sharedBlksHit: 1_184_320,
    sharedBlksRead: 462_180,
    trendSeed: 101,
    trendVolatility: 0.18,
  },
  {
    id: 'q-002',
    queryId: '3920147788',
    fingerprint: '9be21a44d7c0',
    label: 'Order lookup by status and date',
    query:
      'SELECT o.id, o.total_amount, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = $1 AND o.created_at >= $2',
    calls: 8_420,
    meanExecTimeMs: 88.4,
    rows: 1_312_400,
    sharedBlksHit: 2_041_870,
    sharedBlksRead: 1_148_220,
    trendSeed: 202,
    trendVolatility: 0.22,
  },
  {
    id: 'q-003',
    queryId: '5571033219',
    fingerprint: '31c8ff092a7d',
    label: 'Order line aggregation',
    query:
      'SELECT product_id, SUM(quantity) FROM order_items WHERE order_id = ANY($1) GROUP BY product_id',
    calls: 6_110,
    meanExecTimeMs: 23.7,
    rows: 812_300,
    sharedBlksHit: 903_410,
    sharedBlksRead: 211_780,
    trendSeed: 303,
  },
  {
    id: 'q-004',
    queryId: '7712045583',
    fingerprint: 'b2074d9ce115',
    label: 'Pending order count',
    query: "SELECT COUNT(*) FROM orders WHERE status = 'pending'",
    calls: 24_890,
    meanExecTimeMs: 11.2,
    rows: 24_890,
    sharedBlksHit: 1_402_660,
    sharedBlksRead: 105_420,
    trendSeed: 404,
  },
  {
    id: 'q-005',
    queryId: '2298113374',
    fingerprint: '5d3ab8e4106f',
    label: 'Product catalog filter',
    query:
      'SELECT id, sku, name, price FROM products WHERE category = $1 AND price < $2 ORDER BY price ASC LIMIT 100',
    calls: 4_120,
    meanExecTimeMs: 16.9,
    rows: 412_000,
    sharedBlksHit: 618_240,
    sharedBlksRead: 84_310,
    trendSeed: 505,
  },
  {
    id: 'q-013',
    queryId: '6402817750',
    fingerprint: 'e91d4c0a7752',
    label: 'Daily revenue rollup',
    query:
      "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1",
    calls: 1_180,
    meanExecTimeMs: 128.6,
    rows: 35_400,
    sharedBlksHit: 842_190,
    sharedBlksRead: 344_020,
    trendSeed: 606,
    trendVolatility: 0.2,
  },
  {
    id: 'q-015',
    queryId: '8103772914',
    fingerprint: '22fa70b8c93e',
    label: 'Segment analytics',
    query:
      'SELECT c.segment, COUNT(*) AS customers, AVG(o.total_amount) AS avg_order FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.segment',
    calls: 720,
    meanExecTimeMs: 96.3,
    rows: 4_320,
    sharedBlksHit: 508_660,
    sharedBlksRead: 228_470,
    trendSeed: 707,
  },
  {
    id: 'q-016',
    queryId: '1739042265',
    fingerprint: '7c51d0fa388a',
    label: 'Product order lines',
    query: 'SELECT * FROM order_items WHERE product_id = $1 LIMIT 50',
    calls: 9_840,
    meanExecTimeMs: 19.4,
    rows: 492_000,
    sharedBlksHit: 741_880,
    sharedBlksRead: 120_940,
    trendSeed: 808,
  },
  {
    id: 'q-010',
    queryId: '9001128834',
    fingerprint: 'dd40c7a1926b',
    label: 'Sysbench LIKE scan',
    query: 'SELECT c FROM sbtest1 WHERE c LIKE $1',
    calls: 520_300,
    meanExecTimeMs: 2.61,
    rows: 520_300,
    sharedBlksHit: 2_884_120,
    sharedBlksRead: 88_240,
    trendSeed: 909,
  },
  {
    id: 'q-011',
    queryId: '3355810927',
    fingerprint: '0f7be2c645aa',
    label: 'Sysbench ordered range',
    query: 'SELECT id, c FROM sbtest1 WHERE id BETWEEN $1 AND $2 ORDER BY c',
    calls: 528_100,
    meanExecTimeMs: 3.14,
    rows: 3_168_600,
    sharedBlksHit: 3_102_440,
    sharedBlksRead: 41_260,
    trendSeed: 1010,
  },
  {
    id: 'q-012',
    queryId: '6618392071',
    fingerprint: '84e1a9d0735c',
    label: 'Sysbench distinct range',
    query: 'SELECT DISTINCT c FROM sbtest1 WHERE id BETWEEN $1 AND $2 ORDER BY c',
    calls: 512_400,
    meanExecTimeMs: 4.72,
    rows: 3_074_400,
    sharedBlksHit: 2_996_310,
    sharedBlksRead: 55_880,
    trendSeed: 1111,
  },
  {
    id: 'q-007',
    queryId: '7701234589',
    fingerprint: '1a5c93fe04d2',
    label: 'Sysbench range select',
    query: 'SELECT c FROM sbtest1 WHERE id BETWEEN $1 AND $2',
    calls: 1_638_200,
    meanExecTimeMs: 0.34,
    rows: 16_382_000,
    sharedBlksHit: 8_201_330,
    sharedBlksRead: 12_440,
    trendSeed: 1212,
  },
  {
    id: 'q-008',
    queryId: '4402917736',
    fingerprint: '3d9e71b0ac58',
    label: 'Sysbench SUM(k)',
    query: 'SELECT SUM(k) FROM sbtest1 WHERE id BETWEEN $1 AND $2',
    calls: 1_640_100,
    meanExecTimeMs: 0.41,
    rows: 16_401_000,
    sharedBlksHit: 7_884_910,
    sharedBlksRead: 14_770,
    trendSeed: 1313,
  },
  {
    id: 'q-009',
    queryId: '1180239944',
    fingerprint: 'c6b24e8d1057',
    label: 'Sysbench IN list',
    query: 'SELECT c FROM sbtest1 WHERE k IN ($1, $2, $3, $4, $5)',
    calls: 1_637_500,
    meanExecTimeMs: 0.28,
    rows: 1_637_500,
    sharedBlksHit: 6_402_180,
    sharedBlksRead: 9_180,
    trendSeed: 1414,
  },
  {
    id: 'q-006',
    queryId: '2201948371',
    fingerprint: 'f8a0c3b5162e',
    label: 'Sysbench point select',
    query: 'SELECT c FROM sbtest1 WHERE id = $1',
    calls: 1_820_400,
    meanExecTimeMs: 0.11,
    rows: 1_820_400,
    sharedBlksHit: 5_461_200,
    sharedBlksRead: 1_820,
    trendSeed: 1515,
  },
  {
    id: 'q-014',
    queryId: '8841205567',
    fingerprint: '45ce09afb7d1',
    label: 'Order status update',
    query: 'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2',
    calls: 31_600,
    meanExecTimeMs: 1.9,
    rows: 31_600,
    sharedBlksHit: 2_211_400,
    sharedBlksRead: 6_320,
    trendSeed: 1616,
  },
];

export const MOCK_QUERIES: QueryStat[] = SEEDS.map((seed) => {
  const totalBlocks = seed.sharedBlksHit + seed.sharedBlksRead;
  return {
    id: seed.id,
    queryId: seed.queryId,
    query: seed.query,
    label: seed.label,
    calls: seed.calls,
    totalExecTimeMs: Number((seed.calls * seed.meanExecTimeMs).toFixed(2)),
    meanExecTimeMs: seed.meanExecTimeMs,
    rows: seed.rows,
    sharedBlksHit: seed.sharedBlksHit,
    sharedBlksRead: seed.sharedBlksRead,
    cacheHitRatio: Number((seed.sharedBlksHit / totalBlocks).toFixed(4)),
    severity: severityFromLatency(seed.meanExecTimeMs),
    trend: mkTrend(seed.meanExecTimeMs, seed.trendSeed, seed.trendVolatility ?? 0.14),
    fingerprint: seed.fingerprint,
  };
});

export const MOCK_QUERY_BY_ID: Record<string, QueryStat> = Object.fromEntries(
  MOCK_QUERIES.map((query) => [query.id, query]),
);
