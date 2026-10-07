import type { ConfigService } from '@nestjs/config';

/** Default PostHog capture host. EU project (155556), matching the mobile client. */
export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

const CAPTURE_TIMEOUT_MS = 10_000;

/**
 * Properties every server-side event carries. `$geoip_disable`: PostHog would
 * otherwise geolocate the API server's IP (Render, US), stamping every rider's
 * country as US. Country is left to the client-side events on the same person.
 */
export const SERVER_EVENT_PROPERTIES = {
  $geoip_disable: true,
} as const;

/** One event in a PostHog `/batch/` request. */
export interface PostHogCaptureEvent {
  event: string;
  distinct_id: string;
  timestamp?: string;
  /** Lets PostHog collapse a re-sent copy of the same event. */
  uuid?: string;
  properties: Record<string, unknown>;
}

/**
 * Where and with what token server-side events go. `null` when
 * `POSTHOG_PROJECT_TOKEN` is unset — callers must then send nothing.
 */
export function postHogCaptureTarget(config: ConfigService): { url: string; token: string } | null {
  const token = config.get<string>('POSTHOG_PROJECT_TOKEN');
  if (!token) return null;
  const host = config.get<string>('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST;
  return { url: `${host.replace(/\/+$/, '')}/batch/`, token };
}

/**
 * POST one batch. Never throws: resolves to `null` when PostHog accepted it,
 * else to a short reason for the caller's log line.
 */
export async function sendPostHogBatch(
  target: { url: string; token: string },
  batch: PostHogCaptureEvent[],
): Promise<string | null> {
  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: target.token, batch }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    return response.ok ? null : `returned ${response.status}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
