import type { Severity } from './common';
import type { ExpertId } from './expert';

export type OptimizationType =
  | 'INDEX'
  | 'CONFIGURATION'
  | 'QUERY_REWRITE'
  | 'VACUUM'
  | 'STATISTICS';

export type OptimizationAction =
  | 'CREATE'
  | 'DROP'
  | 'ALTER'
  | 'REWRITE'
  | 'TUNE'
  | 'REINDEX'
  | 'ANALYZE';

/**
 * Lifecycle:
 *   PENDING ──approve──▶ APPROVED ──execute──▶ APPLIED ──validate──▶ VALIDATED
 *      │                                     └────────regress──────▶ FAILED
 *      └──reject──▶ REJECTED
 *   DRAFT: generated but not yet surfaced for review.
 */
export type OptimizationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'VALIDATED'
  | 'FAILED';

export interface DetectedProblem {
  summary: string;
  /** e.g. "Sequential scan" */
  kind: string;
  relation?: string;
  /** Query call count that triggered detection. */
  queryFrequency: number;
  averageLatencyMs: number;
  detail: string;
  severity: Severity;
}

/**
 * The core optimization recommendation object.
 * The future FastAPI backend is expected to return exactly this shape.
 */
export interface Optimization {
  id: string;
  type: OptimizationType;
  action: OptimizationAction;
  /** Human-readable target, e.g. "orders(customer_id)". */
  target: string;
  title: string;
  description: string;
  /** DDL or configuration statement to be executed. */
  statement: string;
  /** Reference to the query that motivated this optimization. */
  queryId?: string;
  /** Normalized form of the motivating query, for display. */
  queryText?: string;
  severity: Severity;
  expert: ExpertId;
  confidence: number;
  expectedGain: number;
  status: OptimizationStatus;
  problem: DetectedProblem;
  rationale: string[];
  risks: string[];
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface OptimizationSummary {
  pending: number;
  approved: number;
  rejected: number;
  validated: number;
  total: number;
  /** Aggregate expected gain across pending recommendations. */
  projectedGain: number;
}

export interface ApproveOptimizationInput {
  id: string;
  reviewer?: string;
  note?: string;
}

export interface RejectOptimizationInput {
  id: string;
  reason: string;
  reviewer?: string;
}
