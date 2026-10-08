import type { ExpertId } from './expert';
import type { OptimizationAction, OptimizationStatus, OptimizationType } from './optimization';

export interface PerformanceSnapshot {
  tps: number;
  qps: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
}

export type ValidationStatus = 'CONFIRMED' | 'PENDING' | 'REGRESSION' | 'NOT_RUN';

/**
 * A completed (or in-flight) optimization record. Approving a recommendation
 * produces one of these and appends it to the history.
 *
 * This maps directly to the planned Experience Repository entry.
 */
export interface OptimizationRecord {
  id: string;
  optimizationId: string;
  timestamp: string;
  type: OptimizationType;
  action: OptimizationAction;
  target: string;
  statement: string;
  status: OptimizationStatus;
  expert: ExpertId;
  confidence: number;
  expectedGain: number;
  actualGain?: number;
  validationStatus: ValidationStatus;
  before: PerformanceSnapshot;
  after?: PerformanceSnapshot;
  /** Wall-clock execution time of the change, in milliseconds. */
  executionTimeMs?: number;
  rejectionReason?: string;
  note?: string;
  queryId?: string;
}

export type HistorySortKey = 'timestamp' | 'actualGain' | 'expectedGain';
