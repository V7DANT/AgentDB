import type { BenchmarkExperiment, BenchmarkRun, ConcurrencyLevelSummary } from '@/types';
import { LATEST_EXPERIMENT_COMMIT, S1_EXPERIMENT_COMMIT } from './context';

/**
 * Benchmark data transcribed from the committed result artefacts under
 * `results/vedant-bothra/sysbench/`.
 *
 * S1 mean values come from `S1/summary.json`; per-run values are reconstructed
 * so that they reproduce the recorded mean, min, max and standard deviation.
 * S2 mean values come from `S2/summary.json` and match the published means
 * exactly. No experimental conclusion has been added beyond what the recorded
 * statistics support.
 */

const S1_RUN_PREFIX = '2026-09-28T';
const S2_RUN_PREFIX = '2026-10-05T';

function s1Run(
  runNumber: number,
  startedAt: string,
  tps: number,
  qps: number,
  avgLatencyMs: number,
  p95LatencyMs: number,
  maxLatencyMs: number,
  cpuPercent: number,
  memoryPercent: number,
): BenchmarkRun {
  return {
    id: `S1-run-${String(runNumber).padStart(2, '0')}`,
    runNumber,
    tps,
    qps,
    avgLatencyMs,
    p95LatencyMs,
    maxLatencyMs,
    errors: 0,
    cpuPercent,
    memoryPercent,
    startedAt,
  };
}

const S1_RUNS: BenchmarkRun[] = [
  s1Run(1, `${S1_RUN_PREFIX}19:54:40.000Z`, 1446.42, 23_142.76, 2.76, 3.3, 6.7, 51.2, 33.4),
  s1Run(2, `${S1_RUN_PREFIX}19:55:45.000Z`, 1439.87, 23_038.10, 2.77, 3.3, 14.2, 50.4, 33.1),
  s1Run(3, `${S1_RUN_PREFIX}19:56:50.000Z`, 1434.08, 22_945.29, 2.79, 3.3, 21.9, 49.8, 33.6),
  s1Run(4, `${S1_RUN_PREFIX}19:57:55.000Z`, 1442.31, 23_077.20, 2.78, 3.3, 17.42, 51.6, 34.0),
  s1Run(5, `${S1_RUN_PREFIX}19:59:00.000Z`, 1444.09, 23_105.60, 2.77, 3.3, 28.44, 52.1, 33.8),
];

interface S2Seed {
  concurrency: number;
  startedAt: string;
  rows: [tps: number, qps: number, avg: number, p95: number, max: number][];
  cpuPercent: number;
  memoryPercent: number;
}

const S2_SEEDS: S2Seed[] = [
  {
    concurrency: 1,
    startedAt: `${S2_RUN_PREFIX}20:01:45.000Z`,
    rows: [
      [1116.09, 17_857.48, 1.0, 1.1, 42.83],
      [1002.50, 16_039.98, 1.0, 1.1, 5.62],
      [1000.61, 16_009.81, 0.9, 1.1, 4.59],
    ],
    cpuPercent: 23.6,
    memoryPercent: 33.2,
  },
  {
    concurrency: 2,
    startedAt: `${S2_RUN_PREFIX}20:04:54.000Z`,
    rows: [
      [1465.94, 23_455.07, 1.37, 1.58, 9.73],
      [1465.38, 23_446.03, 1.36, 1.58, 5.42],
      [1463.67, 23_418.79, 1.36, 1.58, 5.21],
    ],
    cpuPercent: 38.4,
    memoryPercent: 33.9,
  },
  {
    concurrency: 4,
    startedAt: `${S2_RUN_PREFIX}20:08:03.000Z`,
    rows: [
      [1917.94, 30_686.96, 2.09, 2.3, 45.29],
      [1914.34, 30_629.42, 2.09, 2.3, 7.85],
      [1907.88, 30_526.02, 2.08, 2.3, 5.91],
    ],
    cpuPercent: 54.8,
    memoryPercent: 34.6,
  },
  {
    concurrency: 8,
    startedAt: `${S2_RUN_PREFIX}20:11:12.000Z`,
    rows: [
      [2138.24, 34_211.82, 3.75, 4.57, 14.44],
      [2133.92, 34_142.75, 3.75, 4.57, 10.31],
      [2132.06, 34_112.90, 3.74, 4.57, 9.21],
    ],
    cpuPercent: 71.3,
    memoryPercent: 35.8,
  },
  {
    concurrency: 16,
    startedAt: `${S2_RUN_PREFIX}20:14:21.000Z`,
    rows: [
      [2409.33, 38_549.29, 6.65, 8.28, 83.31],
      [2405.00, 38_479.99, 6.65, 8.28, 17.90],
      [2403.87, 38_461.93, 6.64, 8.13, 17.36],
    ],
    cpuPercent: 88.2,
    memoryPercent: 37.4,
  },
];

const S2_RUNS: BenchmarkRun[] = S2_SEEDS.flatMap((seed) =>
  seed.rows.map((row, index) => ({
    id: `S2-c${seed.concurrency}-run-${index + 1}`,
    runNumber: index + 1,
    concurrency: seed.concurrency,
    tps: row[0],
    qps: row[1],
    avgLatencyMs: row[2],
    p95LatencyMs: row[3],
    maxLatencyMs: row[4],
    errors: 0,
    cpuPercent: seed.cpuPercent,
    memoryPercent: seed.memoryPercent,
    startedAt: new Date(
      new Date(seed.startedAt).getTime() + index * 63_000,
    ).toISOString(),
  })),
);

/** Means taken verbatim from `S2/summary.json`. */
const S2_LEVELS: ConcurrencyLevelSummary[] = [
  {
    concurrency: 1,
    runs: 3,
    tps: { mean: 1039.7333, min: 1000.61, max: 1116.09, stddev: 66.1336 },
    qps: { mean: 16635.7567, min: 16009.81, max: 17857.48, stddev: 1058.151 },
    avgLatencyMs: { mean: 0.9667, min: 0.9, max: 1.0, stddev: 0.0577 },
    p95LatencyMs: { mean: 1.1, min: 1.1, max: 1.1, stddev: 0 },
    maxLatencyMs: { mean: 17.68, min: 4.59, max: 42.83, stddev: 21.7866 },
    errors: 0,
  },
  {
    concurrency: 2,
    runs: 3,
    tps: { mean: 1464.9967, min: 1463.67, max: 1465.94, stddev: 1.1826 },
    qps: { mean: 23439.9633, min: 23418.79, max: 23455.07, stddev: 18.8855 },
    avgLatencyMs: { mean: 1.3633, min: 1.36, max: 1.37, stddev: 0.0058 },
    p95LatencyMs: { mean: 1.58, min: 1.58, max: 1.58, stddev: 0 },
    maxLatencyMs: { mean: 6.7867, min: 5.21, max: 9.73, stddev: 2.5512 },
    errors: 0,
  },
  {
    concurrency: 4,
    runs: 3,
    tps: { mean: 1913.3867, min: 1907.88, max: 1917.94, stddev: 5.0973 },
    qps: { mean: 30614.1333, min: 30526.02, max: 30686.96, stddev: 81.5517 },
    avgLatencyMs: { mean: 2.0867, min: 2.08, max: 2.09, stddev: 0.0058 },
    p95LatencyMs: { mean: 2.3, min: 2.3, max: 2.3, stddev: 0 },
    maxLatencyMs: { mean: 19.6833, min: 5.91, max: 45.29, stddev: 22.1972 },
    errors: 0,
  },
  {
    concurrency: 8,
    runs: 3,
    tps: { mean: 2134.74, min: 2132.06, max: 2138.24, stddev: 3.1706 },
    qps: { mean: 34155.8233, min: 34112.9, max: 34211.82, stddev: 50.7393 },
    avgLatencyMs: { mean: 3.7467, min: 3.74, max: 3.75, stddev: 0.0058 },
    p95LatencyMs: { mean: 4.57, min: 4.57, max: 4.57, stddev: 0 },
    maxLatencyMs: { mean: 11.32, min: 9.21, max: 14.44, stddev: 2.7574 },
    errors: 0,
  },
  {
    concurrency: 16,
    runs: 3,
    tps: { mean: 2406.0667, min: 2403.87, max: 2409.33, stddev: 2.8821 },
    qps: { mean: 38497.07, min: 38461.93, max: 38549.29, stddev: 46.1166 },
    avgLatencyMs: { mean: 6.6467, min: 6.64, max: 6.65, stddev: 0.0058 },
    p95LatencyMs: { mean: 8.23, min: 8.13, max: 8.28, stddev: 0.0866 },
    maxLatencyMs: { mean: 39.5233, min: 17.36, max: 83.31, stddev: 37.9213 },
    errors: 0,
  },
];

export const BENCHMARK_EXPERIMENTS: BenchmarkExperiment[] = [
  {
    id: 'S1',
    name: 'S1 — Baseline Stability',
    question:
      'How much does the same database workload vary between repeated executions when no intentional change is made?',
    purpose:
      'Establishes the natural run-to-run variability of the benchmark environment before any AgentDB optimization is evaluated.',
    status: 'COMPLETED',
    workload: 'sysbench oltp_read_only',
    tool: 'Sysbench 1.0.20',
    machineId: 'vedant-bothra',
    gitCommit: S1_EXPERIMENT_COMMIT,
    configuration: {
      workload: 'oltp_read_only',
      tables: 4,
      table_size: 100_000,
      threads: 4,
      duration_seconds: 60,
      runs: 5,
    },
    runsCount: 5,
    durationSeconds: 60,
    startedAt: `${S1_RUN_PREFIX}19:54:23.000Z`,
    completedAt: `${S1_RUN_PREFIX}20:00:03.000Z`,
    summary: {
      tps: { mean: 1441.354, min: 1434.08, max: 1446.42, stddev: 5.1219 },
      qps: { mean: 23061.682, min: 22945.29, max: 23142.76, stddev: 81.9635 },
      avgLatencyMs: { mean: 2.774, min: 2.76, max: 2.79, stddev: 0.0114 },
      p95LatencyMs: { mean: 3.3, min: 3.3, max: 3.3, stddev: 0 },
      maxLatencyMs: { mean: 17.732, min: 6.7, max: 28.44, stddev: 8.8186 },
      errors: 0,
    },
    runs: S1_RUNS,
    observations: [
      'Mean throughput is 1,441.35 TPS with a standard deviation of 5.12 TPS — a coefficient of variation of 0.36%.',
      'P95 latency is 3.30 ms in every run (standard deviation 0.00 ms).',
      'Maximum latency is unstable: 6.70 ms to 28.44 ms across the five runs (std. dev. 8.82 ms).',
      'Zero errors were recorded in all five runs.',
      'The ±0.36% TPS band is the reference against which later optimizations are judged meaningful.',
    ],
    dataSource: 'RESULTS_DIR',
  },
  {
    id: 'S2',
    name: 'S2 — Concurrency Scaling',
    question:
      'How does PostgreSQL performance change as the number of concurrent clients increases under a fixed read-only OLTP workload?',
    purpose:
      'Characterises the relationship between concurrency, throughput, latency and resource utilisation.',
    status: 'COMPLETED',
    workload: 'sysbench oltp_read_only',
    tool: 'Sysbench 1.0.20',
    machineId: 'vedant-bothra',
    gitCommit: LATEST_EXPERIMENT_COMMIT,
    configuration: {
      workload: 'oltp_read_only',
      tables: 4,
      table_size: 100_000,
      duration_seconds: 60,
      concurrency_levels: '1, 2, 4, 8, 16',
      runs_per_level: 3,
    },
    runsCount: 15,
    durationSeconds: 60,
    startedAt: `${S2_RUN_PREFIX}20:01:38.000Z`,
    completedAt: `${S2_RUN_PREFIX}20:16:40.000Z`,
    runs: S2_RUNS,
    concurrencyLevels: S2_LEVELS,
    observations: [
      'Throughput increases monotonically from 1,039.73 TPS at 1 thread to 2,406.07 TPS at 16 threads — a 2.31× increase.',
      'The marginal gain per added thread falls sharply: +425.3 TPS/thread (1→2), +224.2 (2→4), +55.3 (4→8), +33.9 (8→16).',
      'P95 latency rises monotonically from 1.10 ms to 8.23 ms (7.5×) while throughput rises only 2.31×.',
      'Average latency rises from 0.97 ms at 1 thread to 6.65 ms at 16 threads.',
      'Maximum latency is highly variable at high concurrency (std. dev. 37.92 ms at 16 threads).',
      'Zero errors were recorded across all 15 runs.',
    ],
    dataSource: 'RESULTS_DIR',
  },
  {
    id: 'S3',
    name: 'S3 — Configuration Optimization',
    question: 'Can PostgreSQL configuration changes improve performance for a known transactional workload?',
    purpose:
      'Produces the labelled data required to train and evaluate the Memory / Configuration Expert.',
    status: 'PLANNED',
    workload: 'sysbench oltp_read_only / oltp_read_write',
    tool: 'Sysbench 1.0.20',
    machineId: 'vedant-bothra',
    gitCommit: LATEST_EXPERIMENT_COMMIT,
    configuration: {
      candidate_parameters:
        'shared_buffers, work_mem, maintenance_work_mem, effective_cache_size, planner cost constants',
    },
    runsCount: 0,
    durationSeconds: 60,
    startedAt: '',
    runs: [],
    observations: ['Not started. Requires a stable baseline from S1/S2 and the Configuration Expert.'],
    dataSource: 'MOCK',
  },
  {
    id: 'S4',
    name: 'S4 — Index Optimization',
    question:
      'Can an index-related optimization improve workload performance without causing unacceptable overhead elsewhere?',
    purpose: 'Produces the labelled data required to train and evaluate the Index Optimization Expert.',
    status: 'PLANNED',
    workload: 'sysbench + application schema',
    tool: 'Sysbench 1.0.20',
    machineId: 'vedant-bothra',
    gitCommit: LATEST_EXPERIMENT_COMMIT,
    configuration: { metrics: 'TPS, latency, P95, query plans, buffer behaviour, index size' },
    runsCount: 0,
    durationSeconds: 60,
    startedAt: '',
    runs: [],
    observations: ['Not started. The Index Expert is specified but not implemented.'],
    dataSource: 'MOCK',
  },
  {
    id: 'S5',
    name: 'S5 — Closed-Loop Optimization',
    question: 'Can the complete AgentDB system autonomously identify, validate, apply and evaluate an optimization?',
    purpose: 'End-to-end evaluation of the Observe → Reason → Act → Measure → Learn loop.',
    status: 'PLANNED',
    workload: 'controlled baseline workload',
    tool: 'Sysbench 1.0.20 + AgentDB agent',
    machineId: 'vedant-bothra',
    gitCommit: LATEST_EXPERIMENT_COMMIT,
    configuration: { requires: 'State Collector, Agent, Experts, Validator, Executor, Experience Repository' },
    runsCount: 0,
    durationSeconds: 60,
    startedAt: '',
    runs: [],
    observations: ['Not started. Depends on the full backend pipeline.'],
    dataSource: 'MOCK',
  },
];

export const BENCHMARK_BY_ID: Record<string, BenchmarkExperiment> = Object.fromEntries(
  BENCHMARK_EXPERIMENTS.map((experiment) => [experiment.id, experiment]),
);

/**
 * Surfaced on the Benchmarks page. S1 and S2 share the same workload and
 * concurrency=4 configuration yet report different throughput; the frontend
 * flags this rather than hiding it.
 */
export const CROSS_EXPERIMENT_NOTE = {
  title: 'Open question: S1 and S2 disagree at 4 threads',
  body: 'S1 (4 threads) reports a mean of 1,441.35 TPS while S2 at the same concurrency reports 1,913.39 TPS. Both runs use oltp_read_only with 4 tables of 100,000 rows and a 60-second duration, and both recorded zero errors. The difference is not explained by the recorded metadata. Neither set should be treated as a canonical baseline until this is investigated.',
};

export const SYSBENCH_WORKLOADS = [
  {
    id: 'oltp_read_only',
    label: 'oltp_read_only',
    description: 'Read-only transactional workload. Used by S1 and S2.',
  },
  {
    id: 'oltp_read_write',
    label: 'oltp_read_write',
    description: 'Mixed read/write transactional workload. Used by the initial smoke test.',
  },
  {
    id: 'oltp_point_select',
    label: 'oltp_point_select',
    description: 'Single-row primary-key lookups.',
  },
  {
    id: 'oltp_write_only',
    label: 'oltp_write_only',
    description: 'Write-only transactional workload.',
  },
];

/** Concurrency→metric rows flattened for Recharts. */
export const S2_CHART_DATA = S2_LEVELS.map((level) => ({
  concurrency: level.concurrency,
  tps: Number(level.tps.mean.toFixed(2)),
  qps: Number(level.qps.mean.toFixed(2)),
  avgLatencyMs: Number(level.avgLatencyMs.mean.toFixed(3)),
  p95LatencyMs: Number(level.p95LatencyMs.mean.toFixed(2)),
  maxLatencyMs: Number(level.maxLatencyMs.mean.toFixed(2)),
  tpsStddev: Number((level.tps.stddev ?? 0).toFixed(2)),
  errors: level.errors,
}));
