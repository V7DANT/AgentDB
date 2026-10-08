/**
 * Benchmark domain model.
 *
 * The shapes mirror the JSON artefacts produced by
 * `benchmarks/sysbench/run_s1.py` and `run_s2.py`, stored under
 * `results/<machine-id>/sysbench/<experiment>/`, so the backend can return the
 * files directly without transformation.
 */

export type BenchmarkId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export type BenchmarkStatus = 'COMPLETED' | 'RUNNING' | 'QUEUED' | 'FAILED' | 'PLANNED';

export interface BenchmarkRun {
  id: string;
  runNumber: number;
  /** Present for concurrency experiments (S2). */
  concurrency?: number;
  tps: number;
  qps: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  errors: number;
  cpuPercent?: number;
  memoryPercent?: number;
  startedAt: string;
}

export interface MetricSummary {
  mean: number;
  min: number;
  max: number;
  stddev?: number;
}

export interface ConcurrencyLevelSummary {
  concurrency: number;
  runs: number;
  tps: MetricSummary;
  qps: MetricSummary;
  avgLatencyMs: MetricSummary;
  p95LatencyMs: MetricSummary;
  maxLatencyMs: MetricSummary;
  errors: number;
}

export interface BenchmarkExperiment {
  id: BenchmarkId;
  name: string;
  question: string;
  purpose: string;
  status: BenchmarkStatus;
  workload: string;
  tool: string;
  machineId: string;
  gitCommit: string;
  configuration: Record<string, string | number>;
  runsCount: number;
  durationSeconds: number;
  startedAt: string;
  completedAt?: string;
  /** Aggregate metrics across runs (S1-style experiments). */
  summary?: {
    tps: MetricSummary;
    qps: MetricSummary;
    avgLatencyMs: MetricSummary;
    p95LatencyMs: MetricSummary;
    maxLatencyMs: MetricSummary;
    errors: number;
  };
  runs: BenchmarkRun[];
  /** Concurrency breakdown keyed by level (S2-style experiments). */
  concurrencyLevels?: ConcurrencyLevelSummary[];
  observations: string[];
  /** Documents whether the figures come from the result files or a mock. */
  dataSource: 'MOCK' | 'RESULTS_DIR';
}

/* ------------------------------------------------------------------ */
/* Workload runner                                                     */
/* ------------------------------------------------------------------ */

export interface WorkloadOption {
  id: string;
  label: string;
  /** Which command-line tool drives it. */
  tool: string;
  available: boolean;
}

export interface RunnerStatus {
  busy: boolean;
  activeRunId: string | null;
  sysbench: boolean;
  pgbench: boolean;
  workloads: WorkloadOption[];
}

export interface ExperimentRunRequest {
  workload: string;
  durationSeconds: number;
  concurrency: number;
  /** 'run' executes the measured workload; 'prepare' creates the dataset. */
  mode?: 'run' | 'prepare';
}

export interface ExperimentRunMetrics {
  tps: number;
  qps: number;
  avgLatencyMs: number;
  /** pgbench does not publish percentiles, so these are null for pgbench runs. */
  p95LatencyMs: number | null;
  maxLatencyMs: number | null;
  errors: number;
}

export interface ExperimentRun {
  id: string;
  request: {
    workload: string;
    experiment?: string;
    durationSeconds: number;
    concurrency: number;
    tables?: number;
    tableSize?: number;
  };
  status: BenchmarkStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  message: string;
  result?: ExperimentRunMetrics | null;
  durationSeconds?: number;
  output?: string;
}
