import type {
  ActivityEvent,
  ActivityLevel,
  ActivityType,
  Optimization,
  OptimizationRecord,
} from '@/types';
import { MOCK_ACTIVITY } from '@/data/activity';
import { MOCK_OPTIMIZATIONS, MOCK_RECORDS } from '@/data/optimizations';

/**
 * In-memory mutable store backing the mock services.
 *
 * Holds the two collections that change while the frontend runs: recommendation
 * status and the optimization history. Both are read and written through this
 * object, which is what keeps the pages consistent with one another — approve a
 * recommendation and the dashboard, history and activity feed all update.
 *
 * When the FastAPI backend is available this object disappears entirely; the
 * `ApiXService` implementations already satisfy the same contracts.
 */

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Simulated network latency so loading states are exercised realistically. */
export function delay(minMs = 120, maxMs = 280): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class MockRuntime {
  optimizations: Optimization[] = clone(MOCK_OPTIMIZATIONS);
  records: OptimizationRecord[] = clone(MOCK_RECORDS);
  activity: ActivityEvent[] = clone(MOCK_ACTIVITY).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  private listeners = new Set<() => void>();
  private revision = 0;
  private sequence = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getRevision = (): number => this.revision;

  /** Broadcasts a change to every subscribed view. */
  notify(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${Date.now().toString(36)}${this.sequence.toString(36)}`;
  }

  recordActivity(input: {
    type: ActivityType;
    level: ActivityLevel;
    message: string;
    detail?: string;
    actor?: string;
    relatedId?: string;
    relatedLabel?: string;
  }): ActivityEvent {
    const event: ActivityEvent = {
      id: this.nextId('evt'),
      timestamp: new Date().toISOString(),
      actor: 'agent',
      ...input,
    };
    this.activity.unshift(event);
    return event;
  }

  /** Restores the seeded dataset. */
  reset(): void {
    this.optimizations = clone(MOCK_OPTIMIZATIONS);
    this.records = clone(MOCK_RECORDS);
    this.activity = clone(MOCK_ACTIVITY).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    this.notify();
  }
}

export const mockRuntime = new MockRuntime();

/** Finds a value or throws an error shaped like an HTTP 404. */
export function requireFound<T>(value: T | undefined, entity: string, id: string): T {
  if (value === undefined) {
    throw new Error(`${entity} "${id}" not found (404)`);
  }
  return value;
}
