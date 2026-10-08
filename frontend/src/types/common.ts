/**
 * Shared primitives for the AgentDB domain model.
 *
 * These types intentionally mirror the shape of the future FastAPI responses
 * so that mock services can be swapped for API services without UI changes.
 */

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export type HealthStatus = 'GOOD' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export type DataSource = 'MOCK' | 'API';

/** Every data-bearing response is wrapped so the UI can reason about provenance. */
export interface ResultMeta {
  source: DataSource;
  /** ISO timestamp of when the data was produced. */
  generatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TimeSeriesPoint {
  /** ISO timestamp. */
  timestamp: string;
  value: number;
}
