/**
 * Reject `promise` if it hasn't settled within `ms` milliseconds. Used to bound
 * network calls (uploads, signed-URL signing, downloads) so a stalled request
 * surfaces a retryable error state instead of hanging the UI indefinitely.
 *
 * The timer is cleared as soon as `promise` settles, so a call that finished in
 * time leaves nothing armed (it used to keep a Jest worker alive for `ms`).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'timeout'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
