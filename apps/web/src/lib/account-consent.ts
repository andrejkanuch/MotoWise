import { SIGNUP_CONSENT_METADATA_KEY } from '@/lib/signup-consent';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Every write of the account's `analytics_consent` from the web goes through
 * this one queue, so writes land in the order the visitor acted (Undo then
 * Decline must end at "no", never at whatever finished last). Best effort: a
 * failed write is swallowed and the queue moves on.
 */
let queue: Promise<void> = Promise.resolve();

export function enqueueAccountConsentWrite(task: () => Promise<unknown>): Promise<void> {
  const run = queue.then(task).then(
    () => undefined,
    () => undefined,
  );
  queue = run;
  return run;
}

/**
 * A banner click, written straight to a signed-in account: the only web path
 * that may turn a stored "no" into "yes" (the background sync never does).
 * Reads the user fresh from the server; no write when signed out or equal.
 */
export function writeAccountConsent(value: boolean): Promise<void> {
  return enqueueAccountConsentWrite(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.user_metadata?.[SIGNUP_CONSENT_METADATA_KEY] === value) return;
    await supabase.auth.updateUser({ data: { [SIGNUP_CONSENT_METADATA_KEY]: value } });
  });
}

/**
 * Withdraw an undone "yes" (the banner's Undo), so it stops identifying the
 * rider's web purchases. Only a stored TRUE is cleared: a stored "no" must
 * survive, because NULL can read as consent on the server.
 */
export function clearAccountConsent(): Promise<void> {
  return enqueueAccountConsentWrite(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.[SIGNUP_CONSENT_METADATA_KEY] !== true) return;
    await supabase.auth.updateUser({ data: { [SIGNUP_CONSENT_METADATA_KEY]: null } });
  });
}
