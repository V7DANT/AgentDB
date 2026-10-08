import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/Dashboard';
import { QueriesPage, QueryDetailPage } from '@/pages/Queries';
import { ExecutionPlansPage } from '@/pages/ExecutionPlans';
import { TableDetailPage, TablesPage } from '@/pages/Tables';
import { IndexDetailPage, IndexesPage } from '@/pages/Indexes';
import { ConfigurationPage, ParameterDetailPage } from '@/pages/Configuration';
import { RecommendationDetailPage, RecommendationsPage } from '@/pages/Recommendations';
import { OptimizationHistoryPage, OptimizationRecordDetailPage } from '@/pages/OptimizationHistory';
import { AgentActivityPage } from '@/pages/AgentActivity';
import { BenchmarkDetailPage, BenchmarksPage } from '@/pages/Benchmarks';
import { NotFoundPage } from '@/pages/NotFound';

/**
 * Route table.
 *
 * Every route corresponds to data that is readable from PostgreSQL (or from the
 * committed benchmark result files). Pages for components that cannot be built
 * yet — retrieval, expert models, agent controls — are deliberately absent.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* OVERVIEW */}
        <Route index element={<DashboardPage />} />

        {/* WORKLOAD */}
        <Route path="queries" element={<QueriesPage />} />
        <Route path="queries/:queryId" element={<QueryDetailPage />} />
        <Route path="plans" element={<ExecutionPlansPage />} />
        <Route path="plans/:queryId" element={<ExecutionPlansPage />} />

        {/* DATABASE */}
        <Route path="tables" element={<TablesPage />} />
        <Route path="tables/:tableName" element={<TableDetailPage />} />
        <Route path="indexes" element={<IndexesPage />} />
        <Route path="indexes/:indexName" element={<IndexDetailPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="configuration/:parameterName" element={<ParameterDetailPage />} />

        {/* OPTIMIZATION */}
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="recommendations/:optimizationId" element={<RecommendationDetailPage />} />
        <Route path="agent" element={<Navigate to="/agent/activity" replace />} />
        <Route path="agent/activity" element={<AgentActivityPage />} />
        <Route path="history" element={<OptimizationHistoryPage />} />
        <Route path="history/:recordId" element={<OptimizationRecordDetailPage />} />

        {/* EXPERIMENTS */}
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="benchmarks/:experimentId" element={<BenchmarkDetailPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
