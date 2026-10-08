import type { ActiveQuery, DatabaseInfo, DatabaseState } from '@/types';
import type { StateService } from '../contracts';
import { DB_INFO } from '@/data/context';
import { MOCK_ACTIVE_QUERIES, MOCK_DATABASE_STATE } from '@/data/databaseState';
import { delay } from './runtime';

/**
 * Mock {@link StateService}.
 * Backed by the static observation window in `data/databaseState.ts`.
 */
export class MockStateService implements StateService {
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    await delay(90, 180);
    return { ...DB_INFO };
  }

  async getCurrentState(): Promise<DatabaseState> {
    await delay();
    // The series are pre-generated; only the collection timestamp moves so the
    // dashboard always looks like a live observation window.
    return { ...MOCK_DATABASE_STATE, collectedAt: new Date().toISOString() };
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    await delay();
    return MOCK_ACTIVE_QUERIES.map((query) => ({ ...query }));
  }
}
