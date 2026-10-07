// -------------------------------------------------------------------
// Consent-independent counters (server only)
// -------------------------------------------------------------------
// Forwards a server-side PostHog event under a SINGLE anonymous bucket with
// $process_person_profile:false — no person profile is ever created, so the
// distinct_id is a constant label, not an identifier. No cookies, no stored IP,
// no user id: a counter tick that survives the cookie banner's opt-out.
// -------------------------------------------------------------------

const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const ANON_DISTINCT_ID = 'cta-counter-anon';
const CAPTURE_TIMEOUT_MS = 2000;

/** Best-effort: never throws and never waits more than 2 s on PostHog. */
export async function captureAnonymousCount(
  event: string,
  properties: Record<string, string>,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  try {
    await fetch(POSTHOG_CAPTURE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: ANON_DISTINCT_ID,
        properties: { ...properties, $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
  } catch {
    // best-effort counter — swallow network errors and the abort
  }
}
