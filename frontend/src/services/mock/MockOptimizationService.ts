import type {
  ApproveOptimizationInput,
  Optimization,
  OptimizationRecord,
  OptimizationSummary,
  PerformanceSnapshot,
  RejectOptimizationInput,
} from '@/types';
import type { DetectionResult, OptimizationService } from '../contracts';
import { MOCK_PERFORMANCE } from '@/data/databaseState';
import { mockRuntime, delay, requireFound } from './runtime';

/**
 * Mock {@link OptimizationService}.
 *
 * Implements the full recommendation lifecycle against the in-memory runtime:
 *
 *   approve  → status APPROVED, record appended as APPLIED, activity emitted
 *   validate → record becomes VALIDATED, actualGain measured, experience stored
 *   reject   → status REJECTED with a mandatory reason, record appended
 *
 * Every mutation calls `mockRuntime.notify()`, which is what keeps the
 * dashboard, pending count, history and activity feed in sync.
 */
export class MockOptimizationService implements OptimizationService {
  async runDetection(): Promise<DetectionResult> {
    await delay(200, 400);
    // The mock dataset is static: nothing new is discovered in memory.
    return { examined: mockRuntime.optimizations.length, created: [], queued: 0 };
  }

  async getRecommendations(): Promise<Optimization[]> {
    await delay();
    return mockRuntime.optimizations
      .filter((optimization) => optimization.status === 'PENDING' || optimization.status === 'DRAFT')
      .map((optimization) => ({ ...optimization }));
  }

  async getAllOptimizations(): Promise<Optimization[]> {
    await delay();
    return mockRuntime.optimizations.map((optimization) => ({ ...optimization }));
  }

  async getOptimization(id: string): Promise<Optimization> {
    await delay(90, 200);
    const found = mockRuntime.optimizations.find((optimization) => optimization.id === id);
    return { ...requireFound(found, 'Optimization', id) };
  }

  async getSummary(): Promise<OptimizationSummary> {
    await delay(70, 160);
    return buildSummary(mockRuntime.optimizations);
  }

  async approve(input: ApproveOptimizationInput): Promise<Optimization> {
    await delay(320, 620);
    const optimization = requireFound(
      mockRuntime.optimizations.find((row) => row.id === input.id),
      'Optimization',
      input.id,
    );

    if (optimization.status !== 'PENDING' && optimization.status !== 'DRAFT') {
      throw new Error(
        `Optimization ${optimization.id} cannot be approved from status ${optimization.status}.`,
      );
    }

    const now = new Date().toISOString();
    optimization.status = 'APPROVED';
    optimization.reviewedAt = now;
    optimization.reviewedBy = input.reviewer ?? 'operator';
    optimization.updatedAt = now;

    const before = latestSnapshot();
    const record: OptimizationRecord = {
      id: mockRuntime.nextId('rec'),
      optimizationId: optimization.id,
      timestamp: now,
      type: optimization.type,
      action: optimization.action,
      target: optimization.target,
      statement: optimization.statement,
      // The executor is simulated: the statement is "applied" immediately.
      status: 'APPLIED',
      expert: optimization.expert,
      confidence: optimization.confidence,
      expectedGain: optimization.expectedGain,
      validationStatus: 'PENDING',
      before,
      executionTimeMs: simulatedExecutionTime(optimization),
      queryId: optimization.queryId,
      note: input.note,
    };
    mockRuntime.records.unshift(record);

    mockRuntime.recordActivity({
      type: 'APPROVAL',
      level: 'SUCCESS',
      message: `Optimization approved — ${optimization.title}`,
      detail: `Approved by ${input.reviewer ?? 'operator'}; expected improvement ${(optimization.expectedGain * 100).toFixed(0)}%.`,
      actor: 'operator',
      relatedId: optimization.id,
      relatedLabel: optimization.title,
    });
    mockRuntime.recordActivity({
      type: 'EXECUTION',
      level: 'INFO',
      message:
        optimization.type === 'CONFIGURATION'
          ? `Configuration applied — ${optimization.target}`
          : `Statement executed — ${optimization.action} ${optimization.target}`,
      detail: optimization.statement,
      actor: 'executor',
      relatedId: record.id,
      relatedLabel: optimization.target,
    });

    mockRuntime.notify();
    return { ...optimization };
  }

  async reject(input: RejectOptimizationInput): Promise<Optimization> {
    await delay(260, 520);
    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new Error('A rejection reason is required.');
    }

    const optimization = requireFound(
      mockRuntime.optimizations.find((row) => row.id === input.id),
      'Optimization',
      input.id,
    );

    if (optimization.status !== 'PENDING' && optimization.status !== 'DRAFT') {
      throw new Error(
        `Optimization ${optimization.id} cannot be rejected from status ${optimization.status}.`,
      );
    }

    const now = new Date().toISOString();
    optimization.status = 'REJECTED';
    optimization.reviewedAt = now;
    optimization.reviewedBy = input.reviewer ?? 'operator';
    optimization.rejectionReason = reason;
    optimization.updatedAt = now;

    const record: OptimizationRecord = {
      id: mockRuntime.nextId('rec'),
      optimizationId: optimization.id,
      timestamp: now,
      type: optimization.type,
      action: optimization.action,
      target: optimization.target,
      statement: optimization.statement,
      status: 'REJECTED',
      expert: optimization.expert,
      confidence: optimization.confidence,
      expectedGain: optimization.expectedGain,
      validationStatus: 'NOT_RUN',
      before: latestSnapshot(),
      rejectionReason: reason,
      queryId: optimization.queryId,
    };
    mockRuntime.records.unshift(record);

    mockRuntime.recordActivity({
      type: 'REJECTION',
      level: 'WARNING',
      message: `Optimization rejected — ${optimization.title}`,
      detail: `Reason: ${reason}`,
      actor: 'operator',
      relatedId: optimization.id,
      relatedLabel: optimization.title,
    });

    mockRuntime.notify();
    return { ...optimization };
  }

  async getHistory(): Promise<OptimizationRecord[]> {
    await delay();
    return mockRuntime.records
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map((record) => ({ ...record }));
  }

  async getRecord(id: string): Promise<OptimizationRecord> {
    await delay(90, 200);
    const found = mockRuntime.records.find((record) => record.id === id);
    return { ...requireFound(found, 'Optimization record', id) };
  }

  /**
   * Simulated validation run.
   *
   * Produces an "after" measurement whose improvement is a noisy draw around the
   * expected gain — the same property a real benchmark would have. When the
   * measured change falls inside the S1 run-to-run variability band the record
   * is left as PENDING rather than claiming a win.
   */
  async runValidation(recordId: string): Promise<OptimizationRecord> {
    await delay(1400, 2400);
    const record = requireFound(
      mockRuntime.records.find((row) => row.id === recordId),
      'Optimization record',
      recordId,
    );
    if (record.status === 'REJECTED') {
      throw new Error('Rejected recommendations cannot be validated.');
    }

    const before = record.before;
    const draw = 0.55 + Math.random() * 0.75; // 0.55× – 1.30× the expected gain
    const measured = record.expectedGain * draw;
    const after = applyGain(before, measured);

    record.after = after;
    record.actualGain = Number(measured.toFixed(4));
    // Below ~1.5% the change cannot be distinguished from S1 variability.
    record.validationStatus = measured >= 0.015 ? 'CONFIRMED' : 'PENDING';
    record.status = measured >= 0.015 ? 'VALIDATED' : 'APPLIED';
    record.executionTimeMs = record.executionTimeMs ?? simulatedExecutionTimeMs(record);

    const optimization = mockRuntime.optimizations.find(
      (row) => row.id === record.optimizationId,
    );
    if (optimization) {
      optimization.status = record.status;
      optimization.updatedAt = new Date().toISOString();
    }

    mockRuntime.recordActivity({
      type: 'BENCHMARK',
      level: 'INFO',
      message: 'Validation workload completed',
      detail: '3 × 60s oltp_read_only runs at 4 threads; compared against the pre-change snapshot.',
      actor: 'validator',
      relatedId: record.id,
      relatedLabel: record.target,
    });

    if (record.validationStatus === 'CONFIRMED') {
      mockRuntime.recordActivity({
        type: 'LEARNING',
        level: 'SUCCESS',
        message: `Performance improvement confirmed — TPS ${delta(before.tps, after.tps)}`,
        detail: `Expected ${(record.expectedGain * 100).toFixed(1)}%, measured ${(record.actualGain * 100).toFixed(1)}%.`,
        actor: 'validator',
        relatedId: record.id,
      });
      mockRuntime.recordActivity({
        type: 'LEARNING',
        level: 'INFO',
        message: 'Experience stored in the repository',
        actor: 'agent',
        relatedId: record.id,
      });
    } else {
      mockRuntime.recordActivity({
        type: 'VALIDATION',
        level: 'WARNING',
        message: 'Measured change is within run-to-run variability',
        detail: `Measured ${(record.actualGain * 100).toFixed(2)}% — below the 1.5% significance threshold. No improvement is claimed.`,
        actor: 'validator',
        relatedId: record.id,
      });
    }

    mockRuntime.notify();
    return { ...record };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function buildSummary(optimizations: Optimization[]): OptimizationSummary {
  const pending = optimizations.filter(
    (row) => row.status === 'PENDING' || row.status === 'DRAFT',
  );
  return {
    pending: pending.length,
    approved: optimizations.filter((row) => row.status === 'APPROVED').length,
    rejected: optimizations.filter((row) => row.status === 'REJECTED').length,
    validated: optimizations.filter((row) => row.status === 'VALIDATED').length,
    total: optimizations.length,
    projectedGain: pending.reduce((sum, row) => sum + row.expectedGain, 0),
  };
}

/** Snapshot of the current performance state, used as the "before" measurement. */
function currentSnapshot(): PerformanceSnapshot {
  const performance = MOCK_PERFORMANCE;
  return {
    tps: performance.tps,
    qps: performance.qps,
    p95LatencyMs: performance.p95LatencyMs,
    avgLatencyMs: performance.avgLatencyMs,
  };
}

/** Chains snapshots so the history reads as a continuous time series. */
function latestSnapshot(): PerformanceSnapshot {
  const withAfter = mockRuntime.records
    .filter((record) => record.after !== undefined)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return withAfter[0]?.after ?? currentSnapshot();
}

function applyGain(before: PerformanceSnapshot, gain: number): PerformanceSnapshot {
  return {
    tps: Number((before.tps * (1 + gain)).toFixed(2)),
    qps: Number((before.qps * (1 + gain)).toFixed(2)),
    // Latency moves in the opposite direction and with a damped magnitude.
    p95LatencyMs: Number((before.p95LatencyMs * (1 - gain * 0.6)).toFixed(3)),
    avgLatencyMs: Number((before.avgLatencyMs * (1 - gain * 0.6)).toFixed(3)),
  };
}

function delta(before: number, after: number): string {
  const change = (after - before) / before;
  const sign = change > 0 ? '+' : '';
  return `${sign}${(change * 100).toFixed(1)}%`;
}

function simulatedExecutionTime(optimization: Optimization): number {
  switch (optimization.type) {
    case 'INDEX':
      return optimization.action === 'DROP' ? 180 : 3_100;
    case 'CONFIGURATION':
      return 420;
    case 'QUERY_REWRITE':
      return 0;
    case 'VACUUM':
      return 12_400;
    case 'STATISTICS':
      return 6_200;
    default:
      return 500;
  }
}

function simulatedExecutionTimeMs(record: OptimizationRecord): number {
  switch (record.type) {
    case 'INDEX':
      return record.action === 'DROP' ? 180 : 3_100;
    case 'CONFIGURATION':
      return 420;
    case 'QUERY_REWRITE':
      return 0;
    case 'VACUUM':
      return 12_400;
    default:
      return 500;
  }
}

