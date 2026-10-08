import type { HealthStatus, Severity } from '@/types';

/** Deterministic pseudo-random generator so mock series are stable across reloads. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Generates a natural-looking time series with drift and bounded noise.
 * Used only by the mock data layer.
 */
export function generateSeries(options: {
  count: number;
  base: number;
  volatility: number;
  drift?: number;
  min?: number;
  max?: number;
  seed: number;
  startTime: Date;
  stepMinutes: number;
}): { timestamp: string; value: number }[] {
  const { count, base, volatility, drift = 0, min, max, seed, startTime, stepMinutes } = options;
  const rng = createRng(seed);
  const points: { timestamp: string; value: number }[] = [];
  let current = base;
  const start = startTime.getTime() - (count - 1) * stepMinutes * 60_000;
  for (let i = 0; i < count; i += 1) {
    const noise = (rng() - 0.5) * 2 * volatility;
    current = current + drift + noise;
    if (min !== undefined) current = Math.max(min, current);
    if (max !== undefined) current = Math.min(max, current);
    points.push({
      timestamp: new Date(start + i * stepMinutes * 60_000).toISOString(),
      value: Number(current.toFixed(3)),
    });
  }
  return points;
}

export function severityFromLatency(meanExecTimeMs: number): Severity {
  if (meanExecTimeMs >= 25) return 'HIGH';
  if (meanExecTimeMs >= 8) return 'MEDIUM';
  return 'LOW';
}

export function columnMinMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function severityRank(severity: Severity): number {
  return { HIGH: 0, MEDIUM: 1, LOW: 2 }[severity];
}

export function healthFromSeverity(severities: Severity[]): HealthStatus {
  if (severities.includes('HIGH')) return 'WARNING';
  if (severities.includes('MEDIUM')) return 'GOOD';
  return 'GOOD';
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
