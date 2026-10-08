/**
 * Small deterministic "clock" helpers for the mock data layer.
 * Timestamps are expressed relative to page load so the console always looks
 * like a running system. Nothing here touches the network.
 */

export function now(): Date {
  return new Date();
}

export function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A stable "today at HH:MM:SS" timestamp. */
export function todayAt(hours: number, minutes: number, seconds: number): string {
  const d = new Date();
  d.setHours(hours, minutes, seconds, 0);
  return d.toISOString();
}

export const ISO = {
  secondsAgo,
  minutesAgo,
  hoursAgo,
  daysAgo,
  minutesFromNow,
  todayAt,
};
