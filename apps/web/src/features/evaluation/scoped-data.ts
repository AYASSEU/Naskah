'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
/** Invalidate old requests when the data scope, case or participant changes. */
export function useScopedData<T>(load: () => Promise<T>, dependencies: unknown[]) {
  const generation = useRef(0),
    [cached, setCached] = useState<{ value: T; dependencies: unknown[] }>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setError(undefined);
    try {
      const result = await load();
      if (current === generation.current)
        setCached({ value: result, dependencies: [...dependencies] });
    } catch (error) {
      if (current === generation.current) setError(error);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, dependencies);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  const matches =
    cached?.dependencies.length === dependencies.length &&
    dependencies.every((value, index) => Object.is(value, cached.dependencies[index]));
  return {
    data: matches ? cached?.value : undefined,
    previousData: cached?.value,
    error,
    busy,
    refresh,
  };
}
