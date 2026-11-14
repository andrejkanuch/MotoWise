import { useCallback, useEffect, useState } from 'react';
import { DISCOVER_LOAD_TIMEOUT_MS } from './use-discover-analytics';

/**
 * FS-PO7 (issue 365): a load still pending after `ms` counts as failed, so the
 * rider gets an error and Retry instead of an endless spinner. `restart` starts
 * a fresh window for the Retry attempt.
 */
export function useLoadDeadline(pending: boolean, ms: number = DISCOVER_LOAD_TIMEOUT_MS) {
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the window on Retry.
  useEffect(() => {
    if (!pending) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(timer);
  }, [pending, ms, attempt]);

  const restart = useCallback(() => {
    setTimedOut(false);
    setAttempt((n) => n + 1);
  }, []);

  return { timedOut: pending && timedOut, restart };
}
