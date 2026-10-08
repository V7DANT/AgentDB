import type { ActivityEvent } from '@/types';
import type { ActivityService } from '../contracts';
import { mockRuntime, delay } from './runtime';

/** Mock {@link ActivityService} — reads the live in-memory event stream. */
export class MockActivityService implements ActivityService {
  async getEvents(options?: { limit?: number; types?: string[] }): Promise<ActivityEvent[]> {
    await delay();
    let events = mockRuntime.activity.slice();
    if (options?.types && options.types.length > 0) {
      events = events.filter((event) => options.types!.includes(event.type));
    }
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (options?.limit !== undefined) events = events.slice(0, options.limit);
    return events.map((event) => ({ ...event }));
  }

  async getRecent(limit = 8): Promise<ActivityEvent[]> {
    return this.getEvents({ limit });
  }
}
