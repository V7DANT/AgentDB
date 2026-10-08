/**
 * Minimal REST client for the future FastAPI backend.
 *
 * Nothing in the application calls `fetch` directly — only the `ApiXService`
 * implementations use this module, which keeps the transport concern in one
 * place and makes it trivial to add auth, tracing or retries later.
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_AGENTDB_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type QueryValue = string | number | boolean | undefined | null;

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...init,
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text().catch(() => undefined);
    }
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(response.status, detail || `Request failed (${response.status})`, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => http<T>(path),
  post: <T>(path: string, body?: unknown) =>
    http<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    http<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => http<T>(path, { method: 'DELETE' }),
};
