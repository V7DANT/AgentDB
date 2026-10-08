import type { IndexInfo, PgParameter, TableStat } from '@/types';
import type { SchemaService } from '../contracts';
import { MOCK_INDEXES } from '@/data/indexes';
import { MOCK_PARAMETERS } from '@/data/configuration';
import { MOCK_TABLES } from '@/data/tables';
import { delay, requireFound } from './runtime';

/**
 * Mock {@link SchemaService} — tables, indexes and configuration.
 * Everything with a live database counterpart is simulated here; the UI labels
 * it accordingly.
 */
export class MockSchemaService implements SchemaService {
  async getTables(): Promise<TableStat[]> {
    await delay();
    return JSON.parse(JSON.stringify(MOCK_TABLES)) as TableStat[];
  }

  async getTable(name: string): Promise<TableStat> {
    await delay(120, 260);
    const table = requireFound(
      MOCK_TABLES.find((row) => row.name === name),
      'Table',
      name,
    );
    return JSON.parse(JSON.stringify(table)) as TableStat;
  }

  async getIndexes(): Promise<IndexInfo[]> {
    await delay();
    return JSON.parse(JSON.stringify(MOCK_INDEXES)) as IndexInfo[];
  }

  async getIndex(name: string): Promise<IndexInfo> {
    await delay(100, 220);
    const index = requireFound(
      MOCK_INDEXES.find((row) => row.name === name),
      'Index',
      name,
    );
    return { ...index };
  }

  async getParameters(): Promise<PgParameter[]> {
    await delay();
    return JSON.parse(JSON.stringify(MOCK_PARAMETERS)) as PgParameter[];
  }

  async getParameter(name: string): Promise<PgParameter> {
    await delay(90, 200);
    const parameter = requireFound(
      MOCK_PARAMETERS.find((row) => row.name === name),
      'Parameter',
      name,
    );
    return JSON.parse(JSON.stringify(parameter)) as PgParameter;
  }
}
