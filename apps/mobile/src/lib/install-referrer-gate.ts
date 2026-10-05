/**
 * A one-way latch between the Play install-referrer read and the first-install
 * attribution emit.
 *
 * `install_attribution_captured` writes `install_source` with `$set_once`, so
 * whatever it sends first is permanent. On Android a bio-link install's source
 * lives in the Play referrer, which is read asynchronously at cold start — if
 * the emit won the race, every such install would be stamped
 * `organic_unknown` forever. The emit therefore waits for this latch (bounded),
 * and the referrer reader opens it once it has settled on any path.
 *
 * Its own module so meta-attribution.ts and pending-intent-reader.ts can both
 * use it without importing each other.
 */

/** Upper bound on the wait. The reader already caps itself at 4 s. */
const REFERRER_WAIT_MS = 5000;

let settle: (() => void) | null = null;
const settled = new Promise<void>((resolve) => {
  settle = resolve;
});

/** Called by the referrer reader when it has finished, whatever the outcome. */
export function markReferrerSettled(): void {
  settle?.();
}

/**
 * Resolves once the referrer has been read, or after {@link REFERRER_WAIT_MS}.
 * Immediate on platforms without an install referrer (iOS).
 */
export function whenReferrerSettled(): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, REFERRER_WAIT_MS);
  });
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}
