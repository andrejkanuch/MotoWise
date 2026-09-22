/**
 * Typed error for a non-OK HTTP response from a THIRD-PARTY service we call
 * directly (not our own GraphQL API, which carries `extensions.code`).
 *
 * Exists so the global TanStack Query handler (`query-client.ts`) can tell
 * "the provider failed" apart from "our code threw" WITHOUT matching on
 * message text or host names. A bare `new Error('Open-Meteo 503')` is
 * indistinguishable from a real bug once it reaches the handler — that is
 * Sentry MOTO-VAULT-REACT-NATIVE-35, where a free weather API's 503 both
 * raised an error-severity event and interrupted the rider with a modal.
 *
 * Dependency-free on purpose: `query-client.ts` is imported very early and
 * must not pull feature modules in behind this.
 */

/** Third-party services this app calls directly over plain `fetch`. */
export const UPSTREAM_SERVICE = {
  OPEN_METEO: 'Open-Meteo',
  MAPBOX: 'Mapbox',
} as const;

export type UpstreamService = (typeof UPSTREAM_SERVICE)[keyof typeof UPSTREAM_SERVICE];

export class UpstreamHttpError extends Error {
  readonly isUpstreamHttpError = true;

  constructor(
    readonly service: UpstreamService,
    readonly status: number,
  ) {
    super(`${service} ${status}`);
    this.name = 'UpstreamHttpError';
  }
}

/**
 * Instance check that also survives a structured clone / re-thrown copy — the
 * same defensive shape as `isMissingGqlSessionError`.
 */
export function isUpstreamHttpError(error: unknown): error is UpstreamHttpError {
  if (error instanceof UpstreamHttpError) return true;
  if (error && typeof error === 'object' && 'isUpstreamHttpError' in error) {
    return (error as { isUpstreamHttpError?: unknown }).isUpstreamHttpError === true;
  }
  return false;
}

/**
 * Statuses that mean THE PROVIDER failed and we could not have prevented it:
 * any 5xx, plus 429 (their rate limit) and 408 (their timeout).
 *
 * Every OTHER 4xx is OURS: a 400 means we built a malformed URL, a 401/403
 * means a key is dead or unrotated, a 404 means we call a retired endpoint.
 * Those are bugs that would break the feature for EVERY user and must never
 * be filtered. This distinction is the whole point of the module.
 */
export const UPSTREAM_PROVIDER_SIDE_STATUS = {
  TOO_MANY_REQUESTS: 429,
  REQUEST_TIMEOUT: 408,
} as const;

const SERVER_ERROR_FLOOR = 500;

export function isProviderSideFailure(status: number): boolean {
  return (
    status >= SERVER_ERROR_FLOOR ||
    status === UPSTREAM_PROVIDER_SIDE_STATUS.TOO_MANY_REQUESTS ||
    status === UPSTREAM_PROVIDER_SIDE_STATUS.REQUEST_TIMEOUT
  );
}
