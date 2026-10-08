import type { ExecutionPlan } from '@/types';
import type { PlanService } from '../contracts';
import { MOCK_PLAN_BY_QUERY, PLAN_QUERY_IDS } from '@/data/plans';
import { delay } from './runtime';

/** Mock {@link PlanService} backed by the simulated EXPLAIN trees in `data/plans.ts`. */
export class MockPlanService implements PlanService {
  async getPlan(queryId: string): Promise<ExecutionPlan | null> {
    await delay(200, 420);
    const plan = MOCK_PLAN_BY_QUERY[queryId];
    if (!plan) return null;
    return JSON.parse(JSON.stringify(plan)) as ExecutionPlan;
  }

  async getPlans(): Promise<ExecutionPlan[]> {
    await delay();
    return PLAN_QUERY_IDS.map(
      (id) => JSON.parse(JSON.stringify(MOCK_PLAN_BY_QUERY[id])) as ExecutionPlan,
    );
  }

  async getPlannedQueryIds(): Promise<string[]> {
    await delay(60, 140);
    return [...PLAN_QUERY_IDS];
  }
}
