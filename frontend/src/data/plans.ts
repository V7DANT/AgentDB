import type { ExecutionPlan, PlanNode } from '@/types';

/**
 * Simulated EXPLAIN (ANALYZE, FORMAT JSON) trees.
 *
 * The shapes follow PostgreSQL's plan node structure so the renderer can accept
 * real EXPLAIN JSON later without changes: a node carries the planner estimate,
 * the actual measurements, the loop count and its children.
 */

const seqScanWarning = (relation: string, rowsRemoved: number) => [
  {
    severity: 'HIGH' as const,
    message: `Sequential scan on ${relation} examined ${rowsRemoved.toLocaleString('en-US')} rows that were discarded by the filter`,
  },
];

const PLANS: Record<string, ExecutionPlan> = {
  'q-001': {
    queryId: 'q-001',
    query: 'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
    planningTimeMs: 0.412,
    executionTimeMs: 42.05,
    totalCost: 38421.9,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p1-3',
        nodeType: 'Seq Scan',
        relation: 'orders',
        severity: 'HIGH',
        message: 'Sequential scan on orders examined 1,200,000 rows',
        rowsExamined: 1_200_000,
      },
    ],
    root: {
      id: 'p1-1',
      nodeType: 'Limit',
      estimatedCost: 0.42,
      totalCost: 38421.9,
      actualTimeMs: 42.05,
      estimatedRows: 20,
      actualRows: 20,
      loops: 1,
      children: [
        {
          id: 'p1-2',
          nodeType: 'Sort',
          estimatedCost: 38041.5,
          totalCost: 38420.5,
          actualTimeMs: 41.55,
          estimatedRows: 1523,
          actualRows: 24,
          loops: 1,
          conditions: ['Sort Key: created_at DESC', 'Sort Method: top-N heapsort  Memory: 28kB'],
          children: [
            {
              id: 'p1-3',
              nodeType: 'Seq Scan',
              relation: 'orders',
              alias: 'orders',
              estimatedCost: 0,
              totalCost: 37675.44,
              actualTimeMs: 41.12,
              estimatedRows: 1523,
              actualRows: 24,
              loops: 1,
              rowsRemovedByFilter: 1_199_976,
              conditions: ['Filter: (customer_id = $1)'],
              warnings: seqScanWarning('orders', 1_199_976),
              children: [],
            },
          ],
        },
      ],
    },
  },

  'q-002': {
    queryId: 'q-002',
    query:
      'SELECT o.id, o.total_amount, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = $1 AND o.created_at >= $2',
    planningTimeMs: 0.668,
    executionTimeMs: 88.42,
    totalCost: 79312.4,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p2-3',
        nodeType: 'Seq Scan',
        relation: 'orders',
        severity: 'HIGH',
        message: 'Sequential scan re-reads orders after a low-selectivity status index lookup',
        rowsExamined: 1_200_000,
      },
      {
        nodeId: 'p2-2',
        nodeType: 'Hash Join',
        severity: 'MEDIUM',
        message: 'Hash join builds a 50,000-row side for every call',
        rowsExamined: 50_000,
      },
    ],
    root: {
      id: 'p2-1',
      nodeType: 'Hash Join',
      estimatedCost: 45210.0,
      totalCost: 79312.4,
      actualTimeMs: 88.42,
      estimatedRows: 155_800,
      actualRows: 155_860,
      loops: 1,
      conditions: ['Hash Cond: (o.customer_id = c.id)'],
      children: [
        {
          id: 'p2-3',
          nodeType: 'Bitmap Heap Scan',
          relation: 'orders',
          alias: 'o',
          estimatedCost: 8420.0,
          totalCost: 41220.0,
          actualTimeMs: 61.88,
          estimatedRows: 155_800,
          actualRows: 155_860,
          loops: 1,
          conditions: ['Recheck Cond: (status = $1)', 'Filter: (created_at >= $2)'],
          rowsRemovedByFilter: 204_140,
          warnings: [
            {
              severity: 'MEDIUM',
              message: 'Bitmap heap scan re-reads 1,148,220 blocks because the status index is not selective',
            },
          ],
          children: [
            {
              id: 'p2-4',
              nodeType: 'Bitmap Index Scan',
              relation: 'orders_status_idx',
              estimatedCost: 0,
              totalCost: 8184.0,
              actualTimeMs: 12.34,
              estimatedRows: 360_000,
              actualRows: 360_000,
              loops: 1,
              conditions: ['Index Cond: (status = $1)'],
              children: [],
            },
          ],
        },
        {
          id: 'p2-2',
          nodeType: 'Hash',
          estimatedCost: 2140.0,
          totalCost: 2140.0,
          actualTimeMs: 21.4,
          estimatedRows: 50_000,
          actualRows: 50_000,
          loops: 1,
          children: [
            {
              id: 'p2-5',
              nodeType: 'Seq Scan',
              relation: 'customers',
              alias: 'c',
              estimatedCost: 0,
              totalCost: 2140.0,
              actualTimeMs: 18.9,
              estimatedRows: 50_000,
              actualRows: 50_000,
              loops: 1,
              children: [],
            },
          ],
        },
      ],
    },
  },

  'q-013': {
    queryId: 'q-013',
    query:
      "SELECT date_trunc('day', created_at) AS day, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1",
    planningTimeMs: 0.914,
    executionTimeMs: 128.62,
    totalCost: 108420.0,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p13-4',
        nodeType: 'Seq Scan',
        relation: 'orders',
        severity: 'HIGH',
        message: 'Sequential scan on orders examined 1,200,000 rows for a 30-day window',
        rowsExamined: 1_200_000,
      },
      {
        nodeId: 'p13-3',
        nodeType: 'Sort',
        severity: 'MEDIUM',
        message: 'External merge sort spilled 4,096 kB to a temporary file',
        rowsExamined: 960_000,
      },
    ],
    root: {
      id: 'p13-1',
      nodeType: 'GroupAggregate',
      estimatedCost: 102410.0,
      totalCost: 108420.0,
      actualTimeMs: 128.62,
      estimatedRows: 30,
      actualRows: 30,
      loops: 1,
      conditions: ['Group Key: date_trunc(\'day\'::text, created_at)'],
      children: [
        {
          id: 'p13-3',
          nodeType: 'Sort',
          estimatedCost: 91240.0,
          totalCost: 100120.0,
          actualTimeMs: 118.44,
          estimatedRows: 960_000,
          actualRows: 962_140,
          loops: 1,
          conditions: ['Sort Key: (date_trunc(...))', 'Sort Method: external merge  Disk: 4096kB'],
          children: [
            {
              id: 'p13-4',
              nodeType: 'Seq Scan',
              relation: 'orders',
              alias: 'orders',
              estimatedCost: 0,
              totalCost: 79420.0,
              actualTimeMs: 62.18,
              estimatedRows: 960_000,
              actualRows: 962_140,
              loops: 1,
              rowsRemovedByFilter: 237_860,
              conditions: ["Filter: (created_at >= (now() - '30 days'::interval))"],
              warnings: seqScanWarning('orders', 237_860),
              children: [],
            },
          ],
        },
      ],
    },
  },

  'q-004': {
    queryId: 'q-004',
    query: "SELECT COUNT(*) FROM orders WHERE status = 'pending'",
    planningTimeMs: 0.281,
    executionTimeMs: 11.24,
    totalCost: 8420.0,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p4-2',
        nodeType: 'Index Only Scan',
        severity: 'LOW',
        message: 'Index-only scan executed 24,890 times per observation window',
        rowsExamined: 60_000,
      },
    ],
    root: {
      id: 'p4-1',
      nodeType: 'Aggregate',
      estimatedCost: 8420.0,
      totalCost: 8420.0,
      actualTimeMs: 11.24,
      estimatedRows: 1,
      actualRows: 1,
      loops: 1,
      children: [
        {
          id: 'p4-2',
          nodeType: 'Index Only Scan',
          relation: 'orders_status_idx',
          alias: 'orders',
          estimatedCost: 0,
          totalCost: 8412.0,
          actualTimeMs: 10.02,
          estimatedRows: 60_000,
          actualRows: 60_240,
          loops: 1,
          conditions: ["Index Cond: (status = 'pending'::text)", 'Heap Fetches: 0'],
          warnings: [
            {
              severity: 'LOW',
              message: 'High call frequency (24,890/window) on a constant predicate — a partial index would be smaller',
            },
          ],
          children: [],
        },
      ],
    },
  },

  'q-016': {
    queryId: 'q-016',
    query: 'SELECT * FROM order_items WHERE product_id = $1 LIMIT 50',
    planningTimeMs: 0.322,
    executionTimeMs: 19.42,
    totalCost: 118420.0,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p16-2',
        nodeType: 'Seq Scan',
        relation: 'order_items',
        severity: 'MEDIUM',
        message: 'Sequential scan on order_items examined 3,640,000 rows for a 50-row result',
        rowsExamined: 3_640_000,
      },
    ],
    root: {
      id: 'p16-1',
      nodeType: 'Limit',
      estimatedCost: 0.32,
      totalCost: 118420.0,
      actualTimeMs: 19.42,
      estimatedRows: 50,
      actualRows: 50,
      loops: 1,
      children: [
        {
          id: 'p16-2',
          nodeType: 'Seq Scan',
          relation: 'order_items',
          alias: 'order_items',
          estimatedCost: 0,
          totalCost: 118420.0,
          actualTimeMs: 19.38,
          estimatedRows: 30,
          actualRows: 50,
          loops: 1,
          rowsRemovedByFilter: 3_639_950,
          conditions: ['Filter: (product_id = $1)'],
          warnings: [
            {
              severity: 'MEDIUM',
              message: 'Sequential scan on order_items examined 3,640,000 rows to satisfy LIMIT 50',
            },
          ],
          children: [],
        },
      ],
    },
  },

  'q-015': {
    queryId: 'q-015',
    query:
      'SELECT c.segment, COUNT(*) AS customers, AVG(o.total_amount) AS avg_order FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.segment',
    planningTimeMs: 0.742,
    executionTimeMs: 96.31,
    totalCost: 86420.0,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p15-4',
        nodeType: 'Seq Scan',
        relation: 'orders',
        severity: 'HIGH',
        message: 'Sequential scan on orders examined 1,200,000 rows to build the join hash',
        rowsExamined: 1_200_000,
      },
    ],
    root: {
      id: 'p15-1',
      nodeType: 'HashAggregate',
      estimatedCost: 84210.0,
      totalCost: 86420.0,
      actualTimeMs: 96.31,
      estimatedRows: 6,
      actualRows: 6,
      loops: 1,
      conditions: ['Group Key: c.segment'],
      children: [
        {
          id: 'p15-2',
          nodeType: 'Hash Left Join',
          estimatedCost: 62140.0,
          totalCost: 81240.0,
          actualTimeMs: 94.88,
          estimatedRows: 1_200_000,
          actualRows: 1_200_024,
          loops: 1,
          conditions: ['Hash Cond: (o.customer_id = c.id)'],
          children: [
            {
              id: 'p15-3',
              nodeType: 'Seq Scan',
              relation: 'customers',
              alias: 'c',
              estimatedCost: 0,
              totalCost: 2140.0,
              actualTimeMs: 4.12,
              estimatedRows: 50_000,
              actualRows: 50_000,
              loops: 1,
              children: [],
            },
            {
              id: 'p15-5',
              nodeType: 'Hash',
              estimatedCost: 41240.0,
              totalCost: 41240.0,
              actualTimeMs: 42.18,
              estimatedRows: 1_200_000,
              actualRows: 1_200_000,
              loops: 1,
              children: [
                {
                  id: 'p15-4',
                  nodeType: 'Seq Scan',
                  relation: 'orders',
                  alias: 'o',
                  estimatedCost: 0,
                  totalCost: 41240.0,
                  actualTimeMs: 41.02,
                  estimatedRows: 1_200_000,
                  actualRows: 1_200_000,
                  loops: 1,
                  warnings: [
                    {
                      severity: 'HIGH',
                      message: 'Full scan of orders is repeated for every invocation of the analytics query',
                    },
                  ],
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  'q-003': {
    queryId: 'q-003',
    query:
      'SELECT product_id, SUM(quantity) FROM order_items WHERE order_id = ANY($1) GROUP BY product_id',
    planningTimeMs: 0.518,
    executionTimeMs: 23.71,
    totalCost: 28420.0,
    source: 'SIMULATED',
    bottlenecks: [],
    root: {
      id: 'p3-1',
      nodeType: 'HashAggregate',
      estimatedCost: 28420.0,
      totalCost: 28420.0,
      actualTimeMs: 23.71,
      estimatedRows: 120,
      actualRows: 142,
      loops: 1,
      conditions: ['Group Key: product_id'],
      children: [
        {
          id: 'p3-2',
          nodeType: 'Index Scan',
          relation: 'order_items_order_id_idx',
          alias: 'order_items',
          estimatedCost: 0,
          totalCost: 27640.0,
          actualTimeMs: 18.42,
          estimatedRows: 4_820,
          actualRows: 4_914,
          loops: 1,
          conditions: ['Index Cond: (order_id = ANY($1))'],
          children: [],
        },
      ],
    },
  },

  'q-005': {
    queryId: 'q-005',
    query:
      'SELECT id, sku, name, price FROM products WHERE category = $1 AND price < $2 ORDER BY price ASC LIMIT 100',
    planningTimeMs: 0.334,
    executionTimeMs: 16.88,
    totalCost: 4820.0,
    source: 'SIMULATED',
    bottlenecks: [],
    root: {
      id: 'p5-1',
      nodeType: 'Limit',
      estimatedCost: 0.33,
      totalCost: 4820.0,
      actualTimeMs: 16.88,
      estimatedRows: 100,
      actualRows: 100,
      loops: 1,
      children: [
        {
          id: 'p5-2',
          nodeType: 'Index Scan',
          relation: 'products_category_price_idx',
          alias: 'products',
          estimatedCost: 0,
          totalCost: 4600.0,
          actualTimeMs: 16.42,
          estimatedRows: 100,
          actualRows: 100,
          loops: 1,
          conditions: ['Index Cond: ((category = $1) AND (price < $2))'],
          children: [],
        },
      ],
    },
  },

  'q-010': {
    queryId: 'q-010',
    query: 'SELECT c FROM sbtest1 WHERE c LIKE $1',
    planningTimeMs: 0.196,
    executionTimeMs: 2.61,
    totalCost: 4218.0,
    source: 'SIMULATED',
    bottlenecks: [
      {
        nodeId: 'p10-2',
        nodeType: 'Seq Scan',
        relation: 'sbtest1',
        severity: 'LOW',
        message: 'Sequential scan on sbtest1 examined 100,000 rows — the LIKE pattern is not index-eligible',
        rowsExamined: 100_000,
      },
    ],
    root: {
      id: 'p10-1',
      nodeType: 'Aggregate',
      estimatedCost: 4218.0,
      totalCost: 4218.0,
      actualTimeMs: 2.61,
      estimatedRows: 1,
      actualRows: 1,
      loops: 1,
      children: [
        {
          id: 'p10-2',
          nodeType: 'Seq Scan',
          relation: 'sbtest1',
          alias: 'sbtest1',
          estimatedCost: 0,
          totalCost: 4212.0,
          actualTimeMs: 2.44,
          estimatedRows: 1_000,
          actualRows: 1_000,
          loops: 1,
          rowsRemovedByFilter: 99_000,
          conditions: ['Filter: (c ~~ $1)'],
          warnings: [
            {
              severity: 'LOW',
              message: 'Leading-wildcard LIKE cannot use the c_1 index',
            },
          ],
          children: [],
        },
      ],
    },
  },
};

/** Query ids that have a simulated plan available. */
export const PLAN_QUERY_IDS = Object.keys(PLANS);

export const MOCK_PLAN_BY_QUERY: Record<string, ExecutionPlan> = PLANS;

/** Flattens a plan tree into a list, depth-first — useful for counting nodes. */
export function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...node.children.flatMap(flattenPlan)];
}

export function countPlanNodes(plan: ExecutionPlan): number {
  return flattenPlan(plan.root).length;
}
