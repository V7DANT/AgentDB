import type { AgentDbServices } from '../contracts';
import { mockRuntime } from './runtime';
import { MockActivityService } from './MockActivityService';
import { MockBenchmarkService } from './MockBenchmarkService';
import { MockOptimizationService } from './MockOptimizationService';
import { MockPlanService } from './MockPlanService';
import { MockQueryService } from './MockQueryService';
import { MockSchemaService } from './MockSchemaService';
import { MockStateService } from './MockStateService';

/**
 * Builds the mock service container.
 *
 * All services share a single {@link mockRuntime} instance, which is what keeps
 * the simulated system coherent across pages.
 */
export function createMockServices(): AgentDbServices {
  return {
    source: 'MOCK',
    state: new MockStateService(),
    queries: new MockQueryService(),
    plans: new MockPlanService(),
    schema: new MockSchemaService(),
    optimizations: new MockOptimizationService(),
    activity: new MockActivityService(),
    benchmarks: new MockBenchmarkService(),
    subscribe: mockRuntime.subscribe,
    getRevision: mockRuntime.getRevision,
  };
}

/** Restores the seeded demo dataset and notifies every view. */
export function resetMockData(): void {
  mockRuntime.reset();
}
