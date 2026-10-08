import type {
  ActivityEvent,
  ActiveQuery,
  ApproveOptimizationInput,
  BenchmarkExperiment,
  DatabaseInfo,
  DatabaseState,
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
  RunnerStatus,
  QueryStat,
  RejectOptimizationInput,
  TableStat,
  TimeSeriesPoint,
} from '@/types';
import type {
  ActivityService,
  AgentDbServices,
  BenchmarkService,
  DetectionResult,
  OptimizationService,
  PlanService,
  QueryService,
  SchemaService,
  StateService,
} from '../contracts';
import { api, buildQuery } from './http';

/**
 * REST-backed service implementations.
 *
 * These are the drop-in replacements for the mock services. They are complete
 * and type-safe; they simply have no server to talk to yet. Point
 * `VITE_AGENTDB_API_BASE_URL` at the FastAPI instance and set
 * `VITE_AGENTDB_DATA_SOURCE=api` to use them.
 *
 * The endpoint paths below are the contract the FastAPI backend must satisfy.
 */

class ApiStateService implements StateService {
  getDatabaseInfo = () => api.get<DatabaseInfo>('/database/info');
  getCurrentState = () => api.get<DatabaseState>('/state');
  getActiveQueries = () => api.get<ActiveQuery[]>('/state/activity');
}

class ApiQueryService implements QueryService {
  getQueries = (options?: { filter?: QueryFilter; sort?: QuerySort; limit?: number }) =>
    api.get<QueryStat[]>(
      `/queries${buildQuery({
        search: options?.filter?.search,
        severity: options?.filter?.severity === 'ALL' ? undefined : options?.filter?.severity,
        sort: options?.sort?.key,
        direction: options?.sort?.direction,
        limit: options?.limit,
      })}`,
    );
  getQuery = (id: string) => api.get<QueryStat>(`/queries/${encodeURIComponent(id)}`);
  getTopQueries = (limit = 8) => api.get<QueryStat[]>(`/queries/top${buildQuery({ limit })}`);
  getQueryTrend = (id: string) =>
    api.get<TimeSeriesPoint[]>(`/queries/${encodeURIComponent(id)}/trend`);
  analyzeQuery = (id: string) =>
    api.post<QueryAnalysis>(`/queries/${encodeURIComponent(id)}/analyze`);
}

class ApiPlanService implements PlanService {
  getPlan = (queryId: string) =>
    api.get<ExecutionPlan | null>(`/plans/${encodeURIComponent(queryId)}`);
  getPlans = () => api.get<ExecutionPlan[]>('/plans');
  getPlannedQueryIds = () => api.get<string[]>('/plans/query-ids');
}

class ApiSchemaService implements SchemaService {
  getTables = () => api.get<TableStat[]>('/schema/tables');
  getTable = (name: string) => api.get<TableStat>(`/schema/tables/${encodeURIComponent(name)}`);
  getIndexes = () => api.get<IndexInfo[]>('/schema/indexes');
  getIndex = (name: string) => api.get<IndexInfo>(`/schema/indexes/${encodeURIComponent(name)}`);
  getParameters = () => api.get<PgParameter[]>('/schema/configuration');
  getParameter = (name: string) =>
    api.get<PgParameter>(`/schema/configuration/${encodeURIComponent(name)}`);
}

class ApiOptimizationService implements OptimizationService {
  runDetection = () => api.post<DetectionResult>('/optimizations/detect');
  getRecommendations = () => api.get<Optimization[]>('/optimizations/recommendations');
  getAllOptimizations = () => api.get<Optimization[]>('/optimizations');
  getOptimization = (id: string) =>
    api.get<Optimization>(`/optimizations/${encodeURIComponent(id)}`);
  getSummary = () => api.get<OptimizationSummary>('/optimizations/summary');
  approve = (input: ApproveOptimizationInput) =>
    api.post<Optimization>(`/optimizations/${encodeURIComponent(input.id)}/approve`, {
      reviewer: input.reviewer,
      note: input.note,
    });
  reject = (input: RejectOptimizationInput) =>
    api.post<Optimization>(`/optimizations/${encodeURIComponent(input.id)}/reject`, {
      reason: input.reason,
      reviewer: input.reviewer,
    });
  getHistory = () => api.get<OptimizationRecord[]>('/optimizations/history');
  getRecord = (id: string) =>
    api.get<OptimizationRecord>(`/optimizations/history/${encodeURIComponent(id)}`);
  runValidation = (recordId: string) =>
    api.post<OptimizationRecord>(
      `/optimizations/history/${encodeURIComponent(recordId)}/validate`,
    );
}

class ApiActivityService implements ActivityService {
  getEvents = (options?: { limit?: number; types?: string[] }) =>
    api.get<ActivityEvent[]>(
      `/activity${buildQuery({ limit: options?.limit, types: options?.types?.join(',') })}`,
    );
  getRecent = (limit = 8) => api.get<ActivityEvent[]>(`/activity/recent${buildQuery({ limit })}`);
}

class ApiBenchmarkService implements BenchmarkService {
  getExperiments = () => api.get<BenchmarkExperiment[]>('/benchmarks');
  getExperiment = (id: string) =>
    api.get<BenchmarkExperiment>(`/benchmarks/${encodeURIComponent(id)}`);

  getRuns = () => api.get<ExperimentRun[]>('/benchmarks/runs');
  getRun = (id: string) => api.get<ExperimentRun>(`/benchmarks/runs/${encodeURIComponent(id)}`);
  runExperiment = (request: ExperimentRunRequest) =>
    api.post<ExperimentRun>('/benchmarks/runs', request);

  getRunnerStatus = () => api.get<RunnerStatus>('/runner/status');
  resetStatistics = () => api.post<void>('/runner/reset-statistics');
  mutateIndex = (name: string, action: 'drop' | 'recreate') =>
    api.post<void>('/runner/index', { name, action });
}

/**
 * Builds the API-backed service container.
 *
 * Mutations cannot know when server-side data changed, so the container exposes
 * an explicit `invalidate()` that bumps the revision and makes every mounted view
 * refetch. Call it after a successful mutation.
 */
export function createApiServices(): AgentDbServices {
  const listeners = new Set<() => void>();
  let revision = 0;

  return {
    source: 'API',
    state: new ApiStateService(),
    queries: new ApiQueryService(),
    plans: new ApiPlanService(),
    schema: new ApiSchemaService(),
    optimizations: new ApiOptimizationService(),
    activity: new ApiActivityService(),
    benchmarks: new ApiBenchmarkService(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getRevision() {
      return revision;
    },
    invalidate() {
      revision += 1;
      listeners.forEach((listener) => listener());
    },
  };
}
