import { Injectable, Logger } from '@nestjs/common';

/** Cache tags the web app attaches to DB-sourced reads (mirror of web `CACHE_TAGS`). */
const WEB_CACHE_TAGS = {
  places: 'places',
  trips: 'trips',
} as const;

const REVALIDATE_TIMEOUT_MS = 4000;

/**
 * Triggers on-demand revalidation of the web app's DB-sourced static pages
 * (explore + trip detail) so a publish/unpublish is reflected immediately
 * instead of waiting out the page's `revalidate` window.
 *
 * Best-effort and non-fatal: it never throws, so a web outage or missing config
 * can't fail the mutation that triggered it. No-ops unless both WEB_URL and
 * REVALIDATE_SECRET are set. Talks to web `POST /api/revalidate`.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly webUrl = process.env.WEB_URL?.replace(/\/+$/, '');
  private readonly secret = process.env.REVALIDATE_SECRET;

  /** Paths affected when a trip template is published or unpublished. */
  tripTemplatePaths(
    countryCode?: string | null,
    regionCode?: string | null,
    slug?: string | null,
  ): string[] {
    const cc = countryCode?.toLowerCase();
    const rc = regionCode?.toLowerCase();
    const paths = ['/explore'];
    if (cc) paths.push(`/explore/${cc}`);
    if (cc && rc) paths.push(`/explore/${cc}/${rc}`);
    if (cc && rc && slug) paths.push(`/trips/${cc}/${rc}/${slug.toLowerCase()}`);
    return paths;
  }

  /** Revalidate the explore + trip pages touched by a trip-template change. */
  revalidateTripTemplate(
    countryCode?: string | null,
    regionCode?: string | null,
    slug?: string | null,
  ): void {
    this.revalidate({
      tags: [WEB_CACHE_TAGS.trips, WEB_CACHE_TAGS.places],
      paths: this.tripTemplatePaths(countryCode, regionCode, slug),
    });
  }

  /** Fire-and-forget POST to the web revalidation endpoint. Never rejects. */
  private revalidate(payload: { tags?: string[]; paths?: string[] }): void {
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
          this.logger.warn(`Revalidation returned ${res.status} for ${JSON.stringify(payload)}`);
        }
      })
      .catch((err: unknown) => {
        this.logger.warn(`Revalidation request failed: ${(err as Error).message}`);
      });
  }
}
