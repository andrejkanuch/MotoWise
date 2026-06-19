import { Injectable, Logger } from '@nestjs/common';

const REVALIDATE_TIMEOUT_MS = 4000;

/**
 * Generic client for the web app's on-demand revalidation endpoint
 * (`POST ${WEB_URL}/api/revalidate`). Domain-agnostic: callers pass the tags +
 * paths to invalidate (e.g. trips build theirs in `trip-revalidation.ts`).
 *
 * Best-effort and non-fatal: it never throws, so a web outage or missing config
 * can't fail the mutation that triggered it. No-ops unless both WEB_URL and
 * REVALIDATE_SECRET are set.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly webUrl = process.env.WEB_URL?.replace(/\/+$/, '');
  private readonly secret = process.env.REVALIDATE_SECRET;

  /** Fire-and-forget POST to the web revalidation endpoint. Never rejects. */
  revalidate(payload: { tags?: string[]; paths?: string[] }): void {
    if (!this.webUrl || !this.secret) {
      this.logger.debug('Revalidation skipped — WEB_URL/REVALIDATE_SECRET not configured');
      return;
    }

    void fetch(`${this.webUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': this.secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.warn(
            `Revalidation returned ${res.status} ${res.statusText} for ${JSON.stringify(payload)}`,
          );
        }
      })
      .catch((err: unknown) => {
        this.logger.warn(`Revalidation request failed: ${(err as Error).message}`);
      });
  }
}
