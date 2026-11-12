import { ServiceUnavailableException } from '@nestjs/common';

/**
 * A third-party API we depend on is down (timed out, unreachable, answered
 * 5xx) — an expected outage, not a bug in our code. Clients still get a 503
 * (SERVICE_UNAVAILABLE, retryable), but AllExceptionsFilter logs it at warn
 * instead of reporting it to Sentry, so an upstream incident does not page as
 * an API error (MOTO-VAULT-NODE-NESTJS-T: a 17-minute NHTSA outage filed 10
 * Sentry errors). Throw a plain ServiceUnavailableException for failures that
 * point at our own code (e.g. an upstream 4xx from a malformed request).
 */
export class UpstreamUnavailableException extends ServiceUnavailableException {
  constructor(
    /** Short upstream name for the warn log, e.g. "NHTSA". */
    readonly upstream: string,
    message: string,
  ) {
    super(message);
  }
}
