import type { Severity } from './common';

/**
 * A single node of a PostgreSQL EXPLAIN (ANALYZE, FORMAT JSON) plan tree.
 * `raw` retains the original node payload so a real planner output can be
 * attached later without changing this interface.
 */
export interface PlanNode {
  id: string;
  nodeType: string;
  /** Relation/index/alias the node operates on, when applicable. */
  relation?: string;
  alias?: string;
  /** Planner cost estimate for this node (exclusive of children). */
  estimatedCost: number;
  /** Total planner cost estimate including children. */
  totalCost: number;
  /** Actual total time in ms (present when ANALYZE data is available). */
  actualTimeMs?: number;
  estimatedRows: number;
  actualRows?: number;
  loops: number;
  /** Any of: Filter, Index Cond, Hash Cond, Join Filter, ... */
  conditions?: string[];
  /** Rows removed by a filter — a strong signal of a missing index. */
  rowsRemovedByFilter?: number;
  /** Detected issues attached to this node. */
  warnings?: PlanWarning[];
  children: PlanNode[];
}

export interface PlanWarning {
  severity: Severity;
  message: string;
}

export interface ExecutionPlan {
  queryId: string;
  query: string;
  planningTimeMs: number;
  executionTimeMs: number;
  totalCost: number;
  /** Top-level bottlenecks detected across the tree. */
  bottlenecks: {
    nodeId: string;
    nodeType: string;
    relation?: string;
    severity: Severity;
    message: string;
    rowsExamined: number;
  }[];
  root: PlanNode;
  /** Source of the plan data. */
  source: 'SIMULATED' | 'EXPLAIN_ANALYZE';
}
