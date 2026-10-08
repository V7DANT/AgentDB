import { useCallback, useEffect, useState } from 'react';

/** Small persisted-state helper used for UI preferences (sidebar, table prefs). */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // Storage can be unavailable (private mode); preferences are non-critical.
    }
  }, [key, stored]);

  const update = useCallback((value: T) => setStored(value), []);

  return [stored, update];
}
