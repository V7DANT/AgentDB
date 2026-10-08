import type {
  BenchmarkExperiment,
  ExperimentRun,
  ExperimentRunRequest,
  RunnerStatus,
} from '@/types';
import type { BenchmarkService } from '../contracts';
import { BENCHMARK_BY_ID, BENCHMARK_EXPERIMENTS } from '@/data/benchmarks';
import { delay, requireFound } from './runtime';

/**
 * Mock {@link BenchmarkService}.
 *
 * Real experiments are transcribed from the committed result artefacts under
 * `results/<machine>/sysbench/`, so this already matches the API response shape.
 *
 * The runner is simulated here (no shell command is executed). In API mode the
 * FastAPI backend executes sysbench/pgbench for real — the UI is identical.
 */
export class MockBenchmarkService implements BenchmarkService {
  private runs: ExperimentRun[] = [];

  async getExperiments(): Promise<BenchmarkExperiment[]> {
    await delay();
    return BENCHMARK_EXPERIMENTS.map(
      (experiment) => JSON.parse(JSON.stringify(experiment)) as BenchmarkExperiment,
    );
  }

  async getExperiment(id: string): Promise<BenchmarkExperiment> {
    await delay(120, 280);
    const experiment = requireFound(BENCHMARK_BY_ID[id], 'Benchmark experiment', id);
    return JSON.parse(JSON.stringify(experiment)) as BenchmarkExperiment;
  }

  async getRuns(): Promise<ExperimentRun[]> {
    await delay(60, 140);
    return this.runs.map((run) => ({ ...run, request: { ...run.request } }));
  }

  async getRun(id: string): Promise<ExperimentRun> {
    await delay(60, 140);
    const found = requireFound(this.runs.find((run) => run.id === id), 'Experiment run', id);
    return { ...found, request: { ...found.request } };
  }

  async runExperiment(request: ExperimentRunRequest): Promise<ExperimentRun> {
    await delay(200, 400);
    const run: ExperimentRun = {
      id: `run-${Date.now().toString(36)}`,
      request: { ...request },
      status: 'QUEUED',
      queuedAt: new Date().toISOString(),
      progress: 0,
      message: 'Queued — mock mode. Start the FastAPI backend to run real workloads.',
    };
    this.runs.unshift(run);
    return { ...run, request: { ...run.request } };
  }

  async getRunnerStatus(): Promise<RunnerStatus> {
    await delay(60, 140);
    return {
      busy: false,
      activeRunId: null,
      sysbench: false,
      pgbench: false,
      workloads: [
        {
          id: 'oltp_read_only',
          label: 'Sysbench read-only OLTP',
          tool: 'sysbench',
          available: false,
        },
        {
          id: 'app_mixed',
          label: 'pgbench application workload',
          tool: 'pgbench',
          available: false,
        },
      ],
    };
  }

  async resetStatistics(): Promise<void> {
    await delay(80, 160);
  }

  async mutateIndex(): Promise<void> {
    await delay(80, 160);
  }
}
