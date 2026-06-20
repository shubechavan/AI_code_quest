import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal data-fetching hook: runs an async function, tracks {data, loading, error}, and
 * exposes `reload`. Deliberately tiny — the app's data needs are read-mostly and don't
 * warrant a query library for this slice. Re-runs when `deps` change.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFn = useCallback(fn, deps);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await memoFn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, [memoFn]);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
