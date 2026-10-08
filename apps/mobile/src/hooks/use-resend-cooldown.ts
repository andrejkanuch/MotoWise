import { differenceInSeconds } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { RESEND_COOLDOWN_MS } from '../config/auth';

const TICK_MS = 1000;

export interface ResendCooldown {
  /** Whole seconds left, rounded up. 0 when not cooling down. */
  remainingSeconds: number;
  isCoolingDown: boolean;
  /**
   * Start a wait. Call only after a successful send (default 60 s), or with the
   * wait the server reported when it refused a send.
   */
  start: (ms?: number) => void;
}

function secondsUntil(endsAt: number | null, now: number): number {
  if (endsAt === null) return 0;
  return Math.max(0, differenceInSeconds(endsAt, now, { roundingMethod: 'ceil' }));
}

/**
 * A countdown that stores when it ends, not a ticking counter: the remaining
 * time is derived from the clock on each 1 s tick, so it stays right after the
 * app was backgrounded or a tick was dropped.
 */
export function useResendCooldown(initialMs?: number): ResendCooldown {
  const [endsAt, setEndsAt] = useState<number | null>(() =>
    initialMs && initialMs > 0 ? Date.now() + initialMs : null,
  );
  const [now, setNow] = useState(() => Date.now());

  const remainingSeconds = secondsUntil(endsAt, now);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= endsAt) setEndsAt(null);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt]);

  const start = useCallback((ms: number = RESEND_COOLDOWN_MS) => {
    const startedAt = Date.now();
    setNow(startedAt);
    setEndsAt(startedAt + ms);
  }, []);

  return { remainingSeconds, isCoolingDown: remainingSeconds > 0, start };
}
