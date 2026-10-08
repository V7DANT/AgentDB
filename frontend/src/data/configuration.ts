import type { PgParameter } from '@/types';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * Current PostgreSQL 16.15 settings — copied verbatim from the values recorded
 * by `benchmarks/sysbench/run_s2.py` in `results/vedant-bothra/sysbench/S2/experiment.json`.
 *
 * The `recommendation` blocks are SIMULATED proposals representing the output
 * the Configuration Expert is expected to produce. No model is trained yet.
 */
export const MOCK_PARAMETERS: PgParameter[] = [
  {
    name: 'shared_buffers',
    currentValue: '128MB',
    bytesValue: 128 * MB,
    category: 'MEMORY',
    description:
      "PostgreSQL's main shared memory cache. Default is 128MB; a common starting point for a dedicated host is 25% of system RAM.",
    status: 'SUBOPTIMAL',
    requiresRestart: true,
    recommendation: {
      currentValue: '128MB',
      recommendedValue: '512MB',
      expectedImprovement: 0.15,
      confidence: 0.79,
      rationale:
        'Buffer cache is small relative to the observed working set; the workload reports 462K shared blocks read per period on orders alone. Raising shared_buffers should reduce physical reads.',
      source: 'SIMULATED',
    },
  },
  {
    name: 'work_mem',
    currentValue: '4MB',
    bytesValue: 4 * MB,
    category: 'MEMORY',
    description:
      'Memory available per sort or hash operation before spilling to temporary files. Applies per operation, per connection.',
    status: 'SUBOPTIMAL',
    requiresRestart: false,
    recommendation: {
      currentValue: '4MB',
      recommendedValue: '16MB',
      expectedImprovement: 0.11,
      confidence: 0.87,
      rationale:
        'Sort and hash nodes in the observed plans report external merge activity. 16MB is a conservative increase that stays safe for max_connections = 100.',
      source: 'SIMULATED',
    },
  },
  {
    name: 'maintenance_work_mem',
    currentValue: '64MB',
    bytesValue: 64 * MB,
    category: 'MAINTENANCE',
    description:
      'Memory used by VACUUM, CREATE INDEX and ALTER TABLE ADD FOREIGN KEY operations.',
    status: 'DEFAULT',
    requiresRestart: false,
    recommendation: {
      currentValue: '64MB',
      recommendedValue: '256MB',
      expectedImprovement: 0.04,
      confidence: 0.71,
      rationale:
        'The orders table carries an 86K dead-tuple backlog. A larger maintenance_work_mem speeds up index rebuilds and autovacuum cycles.',
      source: 'SIMULATED',
    },
  },
  {
    name: 'effective_cache_size',
    currentValue: '4GB',
    bytesValue: 4 * GB,
    category: 'PLANNER',
    description:
      'Planner estimate of the total memory available for caching including the OS page cache. Does not allocate memory.',
    status: 'TUNED',
    requiresRestart: false,
  },
  {
    name: 'max_connections',
    currentValue: '100',
    category: 'CONNECTIONS',
    description: 'Maximum number of concurrent connections allowed to the server.',
    status: 'DEFAULT',
    requiresRestart: true,
  },
  {
    name: 'max_worker_processes',
    currentValue: '8',
    category: 'PARALLELISM',
    description:
      'Maximum number of background worker processes the system can support (parallel workers, logical replication, etc.).',
    status: 'DEFAULT',
    requiresRestart: true,
  },
  {
    name: 'max_parallel_workers',
    currentValue: '8',
    category: 'PARALLELISM',
    description: 'Maximum number of workers available for parallel operations.',
    status: 'DEFAULT',
    requiresRestart: false,
  },
  {
    name: 'max_parallel_workers_per_gather',
    currentValue: '2',
    category: 'PARALLELISM',
    description:
      'Maximum number of parallel workers a single Gather node may launch. Higher values help long analytical scans.',
    status: 'DEFAULT',
    requiresRestart: false,
    recommendation: {
      currentValue: '2',
      recommendedValue: '4',
      expectedImprovement: 0.06,
      confidence: 0.62,
      rationale:
        'The analytical rollup and segment queries are single-worker. The host has 8 logical CPUs and the transactional workload leaves headroom.',
      source: 'SIMULATED',
    },
  },
  {
    name: 'random_page_cost',
    currentValue: '4',
    category: 'PLANNER',
    description:
      'Estimated cost of a non-sequential page fetch relative to a sequential fetch. The default 4.0 assumes rotational storage.',
    status: 'SUBOPTIMAL',
    requiresRestart: false,
    recommendation: {
      currentValue: '4',
      recommendedValue: '1.1',
      expectedImprovement: 0.08,
      confidence: 0.83,
      rationale:
        'The machine uses an NVMe SSD. The default 4.0 biases the planner toward sequential scans on the orders and order_items tables.',
      source: 'SIMULATED',
    },
  },
  {
    name: 'seq_page_cost',
    currentValue: '1',
    category: 'PLANNER',
    description: 'Estimated cost of a sequentially fetched page. Reference value for the cost model.',
    status: 'DEFAULT',
    requiresRestart: false,
  },
];

export const MOCK_PARAMETER_BY_NAME: Record<string, PgParameter> = Object.fromEntries(
  MOCK_PARAMETERS.map((parameter) => [parameter.name, parameter]),
);
