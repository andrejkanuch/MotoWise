/**
 * Thrown by the public share-page fetchers (`fetchProfile`, `fetchRide`,
 * `fetchTripByToken`, the /share history fetch) when the API never gave a
 * definitive answer: a network failure, a timeout, a non-200 status, or a
 * GraphQL error other than "not found" (see lib/public-graphql.ts). A
 * `null` result from those fetchers means the API answered and the thing is
 * absent; this error means "we don't know", so the page must say it didn't
 * load and offer a retry instead of a 404 or an "expired" message.
 */
export class UpstreamError extends Error {
  constructor(message = 'upstream unavailable') {
    super(message);
    this.name = 'UpstreamError';
  }
}

export function isUpstreamError(err: unknown): err is UpstreamError {
  return err instanceof UpstreamError || (err instanceof Error && err.name === 'UpstreamError');
}

/** Re-throw any failure of `promise` as an UpstreamError naming `what`. */
export async function asUpstream<T>(promise: Promise<T>, what: string): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(`${what} fetch failed: ${reason}`);
  }
}

/** Resolve a share-page fetch to its value, `null` (absent) or `undefined` (didn't load). */
export async function settleUpstream<T>(promise: Promise<T | null>): Promise<T | null | undefined> {
  try {
    return await promise;
  } catch (err) {
    if (isUpstreamError(err)) return undefined;
    throw err;
  }
}
