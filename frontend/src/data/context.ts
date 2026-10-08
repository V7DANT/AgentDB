import type { DatabaseInfo } from '@/types';

/**
 * Static environment facts used throughout the dashboard.
 *
 * These mirror the machine fingerprint committed under
 * `machines/vedant-bothra/environment.txt` and the PostgreSQL metadata recorded
 * in `results/vedant-bothra/sysbench/S2/experiment.json`.
 */
export const ENVIRONMENT = {
  machineId: 'vedant-bothra',
  label: 'Development',
  os: 'Ubuntu 24.04.5 LTS',
  kernel: '6.8.0 generic',
  cpu: '11th Gen Intel Core i7-1165G7',
  logicalCpus: 8,
  physicalCpus: 4,
  memoryBytes: 16_519_188_480,
  storage: 'NVMe (MTFDHBA1T0QFD)',
  docker: 'Docker Compose · agentdb-postgres',
  canonical: false,
} as const;

/** PostgreSQL version string exactly as recorded by the benchmark runner. */
export const PG_VERSION_FULL = '16.15 (Debian 16.15-1.pgdg13+2)';

export const DB_INFO: DatabaseInfo = {
  status: 'ONLINE',
  version: PG_VERSION_FULL,
  versionShort: 'PostgreSQL 16.15',
  databaseName: 'agentdb',
  host: '127.0.0.1',
  port: 5432,
  sizeBytes: 1_153_993_984,
  uptimeSeconds: 1_284_320,
  pgStatStatements: true,
};

/** Git commit associated with the most recent recorded experiment. */
export const LATEST_EXPERIMENT_COMMIT = 'af7902a5';
export const S1_EXPERIMENT_COMMIT = 'cdc72d65';
