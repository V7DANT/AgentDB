/**
 * Formatting helpers shared across the dashboard.
 * Centralised so numeric presentation stays consistent everywhere.
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes: number | undefined | null, decimals = 1): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const digits = exponent === 0 ? 0 : decimals;
  return `${value.toFixed(digits)} ${BYTE_UNITS[exponent]}`;
}

/** Compact integer formatting: 1234567 → 1.23M */
export function formatCompactNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value);
}

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatFixed(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toFixed(decimals);
}

export function formatMs(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(decimals)} s`;
  return `${value.toFixed(decimals)} ms`;
}

export function formatPercent(fraction: number | undefined | null, decimals = 1): string {
  if (fraction === undefined || fraction === null || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Formats a signed relative change, e.g. 0.38 → "+38.0%" */
export function formatSignedPercent(fraction: number | undefined | null, decimals = 1): string {
  if (fraction === undefined || fraction === null || Number.isNaN(fraction)) return '—';
  const sign = fraction > 0 ? '+' : '';
  return `${sign}${(fraction * 100).toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatTime(iso: string | null | undefined, withSeconds = true): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

/** "3 minutes ago" style relative formatting. */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const seconds = Math.round(abs / 1000);
  if (seconds < 45) return future ? 'in a few seconds' : 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  return formatDate(iso);
}

export function truncate(value: string, max = 96): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** Collapses whitespace in normalized SQL for single-line display. */
export function collapseWhitespace(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
