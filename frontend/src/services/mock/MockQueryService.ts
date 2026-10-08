import type { QueryAnalysis, QueryFilter, QuerySort, QueryStat, TimeSeriesPoint } from '@/types';
import type { QueryService } from '../contracts';
import { MOCK_QUERIES } from '@/data/queries';
import { MOCK_PLAN_BY_QUERY } from '@/data/plans';
import { delay, requireFound } from './runtime';
import { severityRank } from '@/utils/series';

/**
 * Mock {@link QueryService}.
 *
 * Filtering and sorting are applied here rather than in components so that the
 * backend can take over the same responsibility later without touching the UI.
 */
export class MockQueryService implements QueryService {
  async getQueries(options?: {
    filter?: QueryFilter;
    sort?: QuerySort;
    limit?: number;
  }): Promise<QueryStat[]> {
    await delay();
    const { filter, sort, limit } = options ?? {};
    let rows = [...MOCK_QUERIES];

    if (filter?.search) {
      const needle = filter.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.query.toLowerCase().includes(needle) ||
          (row.label ?? '').toLowerCase().includes(needle) ||
          row.queryId.includes(needle),
      );
    }

    if (filter?.severity && filter.severity !== 'ALL') {
      rows = rows.filter((row) => row.severity === filter.severity);
    }

    if (sort) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => (a[sort.key] - b[sort.key]) * direction);
    } else {
      rows.sort((a, b) => b.totalExecTimeMs - a.totalExecTimeMs);
    }

    if (limit !== undefined) rows = rows.slice(0, limit);
    return rows.map((row) => ({ ...row }));
  }

  async getQuery(id: string): Promise<QueryStat> {
    await delay(90, 200);
    const found = MOCK_QUERIES.find((row) => row.id === id || row.queryId === id);
    return { ...requireFound(found, 'Query', id) };
  }

  async getTopQueries(limit = 8): Promise<QueryStat[]> {
    await delay();
    return [...MOCK_QUERIES]
      .sort((a, b) => b.totalExecTimeMs - a.totalExecTimeMs)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async getQueryTrend(id: string): Promise<TimeSeriesPoint[]> {
    await delay(80, 180);
    const query = requireFound(
      MOCK_QUERIES.find((row) => row.id === id || row.queryId === id),
      'Query',
      id,
    );
    const stepMs = 5 * 60_000;
    const end = Date.now();
    return query.trend.map((value, index) => ({
      timestamp: new Date(end - (query.trend.length - 1 - index) * stepMs).toISOString(),
      value,
    }));
  }

  /**
   * Simulated analysis.
   *
   * The shape of the response mirrors what the Query/Planner Expert is expected
   * to return: a summary, observations, suspected issues and a suggested focus.
   * It is derived from the statement's own statistics and plan, not from a model.
   */
  async analyzeQuery(id: string): Promise<QueryAnalysis> {
    await delay(600, 1100);
    const query = requireFound(
      MOCK_QUERIES.find((row) => row.id === id || row.queryId === id),
      'Query',
      id,
    );
    const plan = MOCK_PLAN_BY_QUERY[query.id];

    const observations: string[] = [
      `Executed ${query.calls.toLocaleString('en-US')} times, consuming ${(query.totalExecTimeMs / 1000).toFixed(1)}s of total execution time.`,
      `Mean execution time is ${query.meanExecTimeMs.toFixed(2)} ms; cache hit ratio is ${(query.cacheHitRatio * 100).toFixed(1)}%.`,
      `Returned ${query.rows.toLocaleString('en-US')} rows overall (${(query.rows / query.calls).toFixed(1)} rows per call).`,
    ];

    if (query.cacheHitRatio < 0.85) {
      observations.push(
        `Cache hit ratio is below 85% — ${query.sharedBlksRead.toLocaleString('en-US')} blocks are being read from disk.`,
      );
    }

    const suspectedIssues = (plan?.bottlenecks ?? []).map((bottleneck) => ({
      title: `${bottleneck.nodeType}${bottleneck.relation ? ` on ${bottleneck.relation}` : ''}`,
      detail: bottleneck.message,
      severity: bottleneck.severity,
    }));

    if (suspectedIssues.length === 0) {
      suspectedIssues.push({
        title: 'No structural bottleneck detected',
        detail:
          'The captured plan uses index access paths and reports no filter discards above the configured threshold.',
        severity: 'LOW',
      });
    }

    const suggestedFocus: string[] = [];
    if (query.severity === 'HIGH') {
      suggestedFocus.push('Prioritise this statement — it is in the highest latency band.');
    }
    if (suspectedIssues.some((issue) => issue.title.includes('Seq Scan'))) {
      suggestedFocus.push('Evaluate a supporting index for the filtered columns.');
    }
    if (plan && plan.root.children.some((child) => child.nodeType.includes('Sort'))) {
      suggestedFocus.push('Consider whether the sort can be satisfied by an index order.');
    }
    if (suggestedFocus.length === 0) {
      suggestedFocus.push('No action required; continue monitoring for distribution drift.');
    }

    return {
      queryId: query.queryId,
      status: 'SIMULATED',
      generatedAt: new Date().toISOString(),
      summary: `${query.label ?? 'Statement'} classified ${query.severity} severity with a mean execution time of ${query.meanExecTimeMs.toFixed(2)} ms across ${query.calls.toLocaleString('en-US')} calls.`,
      observations,
      suspectedIssues: suspectedIssues.sort(
        (a, b) => severityRank(a.severity) - severityRank(b.severity),
      ),
      planSummary: plan
        ? `Plan root is a ${plan.root.nodeType} node with a total cost of ${plan.totalCost.toLocaleString('en-US')} and ${plan.bottlenecks.length} flagged node(s).`
        : 'No plan has been captured for this statement yet.',
      suggestedFocus,
    };
  }
}
