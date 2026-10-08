import type {
  ActivityEvent,
  ActiveQuery,
  ApproveOptimizationInput,
  BenchmarkExperiment,
  DatabaseInfo,
  DatabaseState,
  DataSource,
  ExecutionPlan,
  ExperimentRun,
  ExperimentRunRequest,
  IndexInfo,
  Optimization,
  OptimizationRecord,
  OptimizationSummary,
  PgParameter,
  QueryAnalysis,
  QueryFilter,
  QuerySort,
  QueryStat,
  RejectOptimizationInput,
  RunnerStatus,
  TableStat,
  TimeSeriesPoint,
} from '@/types';
/**
 * Service contracts.
 *
 * The React application depends only on these interfaces. Two implementations
 * exist: the mock services under `services/mock` (default) and the REST-backed
 * services under `services/api`. Swapping them is one line in `.env.local`.
 *
 * Every method returns a Promise, exactly as a real HTTP call would, so no
 * component changes when the FastAPI backend arrives.
 *
 * Every service here corresponds to data that is genuinely readable from
 * PostgreSQL today (pg_stat_*, pg_catalog, EXPLAIN, and the benchmark result
 * files). Nothing that requires a trained model is part of this contract.
 */

export interface StateService {
  /** PostgreSQL server metadata: version, database name, size. */
  getDatabaseInfo(): Promise<DatabaseInfo>;
  /** The observation-window snapshot consumed by the dashboard. */
  getCurrentState(): Promise<DatabaseState>;
  /** Rows from pg_stat_activity. */
  getActiveQueries(): Promise<ActiveQuery[]>;
}

export interface QueryService {
  /** Rows from pg_stat_statements, optionally filtered and sorted. */
  getQueries(options?: { filter?: QueryFilter; sort?: QuerySort; limit?: number }): Promise<QueryStat[]>;
  getQuery(id: string): Promise<QueryStat>;
  getTopQueries(limit?: number): Promise<QueryStat[]>;
  /** Mean execution time over recent observations. */
  getQueryTrend(id: string): Promise<TimeSeriesPoint[]>;
  /** Requests an analysis of a statement. */
  analyzeQuery(id: string): Promise<QueryAnalysis>;
}

export interface PlanService {
  /** Returns null when no plan has been captured for the statement yet. */
  getPlan(queryId: string): Promise<ExecutionPlan | null>;
  getPlans(): Promise<ExecutionPlan[]>;
  /** Query ids that currently have a captured plan. */
  getPlannedQueryIds(): Promise<string[]>;
}

export interface SchemaService {
  /** Rows from pg_stat_user_tables joined with size and column metadata. */
  getTables(): Promise<TableStat[]>;
  getTable(name: string): Promise<TableStat>;
  /** Rows from pg_stat_user_indexes joined with pg_index. */
  getIndexes(): Promise<IndexInfo[]>;
  getIndex(name: string): Promise<IndexInfo>;
  /** Selected GUCs from pg_settings. */
  getParameters(): Promise<PgParameter[]>;
  getParameter(name: string): Promise<PgParameter>;
}

export interface DetectionResult {
  /** How many candidate relations the detector looked at. */
  examined: number;
  /** Targets of the proposals created by this scan. */
  created: string[];
  queued: number;
}

export interface OptimizationService {
  /** Runs the detector and queues any new proposals. */
  runDetection(): Promise<DetectionResult>;
  /** Recommendations awaiting a decision. */
  getRecommendations(): Promise<Optimization[]>;
  /** All recommendations regardless of status. */
  getAllOptimizations(): Promise<Optimization[]>;
  getOptimization(id: string): Promise<Optimization>;
  getSummary(): Promise<OptimizationSummary>;
  /** Approves a recommendation and appends it to the history. */
  approve(input: ApproveOptimizationInput): Promise<Optimization>;
  /** Rejects a recommendation with a mandatory reason. */
  reject(input: RejectOptimizationInput): Promise<Optimization>;
  /** Completed and in-flight optimization records. */
  getHistory(): Promise<OptimizationRecord[]>;
  getRecord(id: string): Promise<OptimizationRecord>;
  /**
   * Runs the validation benchmark for an applied change and fills in
   * `actualGain` and `validationStatus`.
   */
  runValidation(recordId: string): Promise<OptimizationRecord>;
}

export interface ActivityService {
  /** Newest first. */
  getEvents(options?: { limit?: number; types?: string[] }): Promise<ActivityEvent[]>;
  /** Convenience for the dashboard "recent activity" panel. */
  getRecent(limit?: number): Promise<ActivityEvent[]>;
}

export interface BenchmarkService {
  getExperiments(): Promise<BenchmarkExperiment[]>;
  getExperiment(id: string): Promise<BenchmarkExperiment>;

  /** Workload runs submitted in this session. */
  getRuns(): Promise<ExperimentRun[]>;
  getRun(id: string): Promise<ExperimentRun>;
  /** Queues a workload run. The backend validates the parameters. */
  runExperiment(request: ExperimentRunRequest): Promise<ExperimentRun>;

  /** Which CLI tools are present and whether a run is already in progress. */
  getRunnerStatus(): Promise<RunnerStatus>;
  /** Clears cumulative pg_stat counters so a measurement is attributable. */
  resetStatistics(): Promise<void>;
  /** Drops or recreates a sysbench index, for demonstrating index detection. */
  mutateIndex(name: string, action: 'drop' | 'recreate'): Promise<void>;
}

/**
 * The service container injected through React context.
 * `subscribe`/`getRevision` let views refetch after a mutation without any
 * component-to-component wiring.
 */
export interface AgentDbServices {
  source: DataSource;
  state: StateService;
  queries: QueryService;
  plans: PlanService;
  schema: SchemaService;
  optimizations: OptimizationService;
  activity: ActivityService;
  benchmarks: BenchmarkService;

  /** Notifies subscribers that the underlying data changed. */
  subscribe(listener: () => void): () => void;
  /** Monotonic counter; changes whenever data changes. */
  getRevision(): number;
  /**
   * Optional explicit invalidation, used by the API container where change
   * notifications cannot be observed automatically.
   */
  invalidate?(): void;
}
