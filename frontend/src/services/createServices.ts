import type { AgentDbServices } from './contracts';
import { createApiServices } from './api/ApiServices';
import { createMockServices } from './mock/createMockServices';

/**
 * Service factory — the single place that decides whether the application
 * talks to the in-memory mock repository or to the FastAPI backend.
 *
 * Switching implementations:
 *
 *   VITE_AGENTDB_DATA_SOURCE=api
 *   VITE_AGENTDB_API_BASE_URL=http://localhost:8000/api
 *
 * No component needs to change.
 */
export function createServices(): AgentDbServices {
  if (DATA_SOURCE === 'api') {
    return createApiServices();
  }
  return createMockServices();
}

/**
 * The active data source, resolved once at module load from the Vite env.
 * Exposed so the layout can state plainly where the numbers come from.
 */
export const DATA_SOURCE: 'mock' | 'api' =
  import.meta.env.VITE_AGENTDB_DATA_SOURCE === 'api' ? 'api' : 'mock';

export type { AgentDbServices };
