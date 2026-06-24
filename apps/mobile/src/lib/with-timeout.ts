/**
 * Reject `promise` if it hasn't settled within `ms` milliseconds. Used to bound
 * network calls (uploads, signed-URL signing, downloads) so a stalled request
 * surfaces a retryable error state instead of hanging the UI indefinitely.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
