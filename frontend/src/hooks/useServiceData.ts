import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentDbServices } from '@/services/contracts';
import { useDataRevision, useServices } from '@/services/ServiceProvider';

/**
 * Data-access hooks.
 *
 * These are the only place in the application that knows how service data is
 * fetched and re-fetched. Components describe *what* they need; the hooks deal
 * with loading, error and staleness.
 */

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  /** First load, with nothing to display yet. */
  loading: boolean;
  /** Re-fetching while previous data is still on screen. */
  refreshing: boolean;
}

interface InternalState<T> {
  data: T | null;
  error: Error | null;
  pending: boolean;
  hasLoaded: boolean;
}

const initialState = <T,>(): InternalState<T> => ({
  data: null,
  error: null,
  pending: true,
  hasLoaded: false,
});

/**
 * Runs an async loader against the service container.
 *
 * The loader re-runs when the data revision changes (i.e. after any mutation),
 * when the component remounts, or when `deps` change. Previous data is kept on
 * screen during a refresh so approvals do not cause a flash of empty content.
 */
export function useServiceQuery<T>(
  loader: (services: AgentDbServices) => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> & { reload: () => void } {
  const services = useServices();
  const revision = useDataRevision();

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = useState<InternalState<T>>(initialState<T>());
  const [manualTick, setManualTick] = useState(0);

  // Serialised so array/object literals passed inline do not retrigger forever.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({
      data: previous.data,
      error: null,
      pending: true,
      hasLoaded: previous.hasLoaded,
    }));

    loaderRef
      .current(services)
      .then((data) => {
        if (cancelled) return;
        setState({ data, error: null, pending: false, hasLoaded: true });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState((previous) => ({
          data: previous.data,
          error: error instanceof Error ? error : new Error(String(error)),
          pending: false,
          hasLoaded: previous.hasLoaded,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [services, revision, depsKey, manualTick]);

  const reload = useCallback(() => setManualTick((tick) => tick + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: state.pending && !state.hasLoaded,
    refreshing: state.pending && state.hasLoaded,
    reload,
  };
}

export interface MutationResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult>;
  pending: boolean;
  error: Error | null;
  result: TResult | null;
  reset: () => void;
}

/**
 * Wraps a mutating service call with pending/error state.
 * Errors are re-thrown so callers can decide how to surface them.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  mutation: (...args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const mutationRef = useRef(mutation);
  mutationRef.current = mutation;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const run = useCallback(async (...args: TArgs): Promise<TResult> => {
    setPending(true);
    setError(null);
    try {
      const value = await mutationRef.current(...args);
      setResult(value);
      return value;
    } catch (caught) {
      const normalised = caught instanceof Error ? caught : new Error(String(caught));
      setError(normalised);
      throw normalised;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { run, pending, error, result, reset };
}

/** Debounces a rapidly changing value (search boxes, filters). */
export function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
