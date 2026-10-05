'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';
import { readExplicitConsent, useCookieConsent } from '@/components/cookie-consent';
import { identifyUser, resetUser } from '@/lib/analytics';
import { consentMetadataUpdate } from '@/lib/signup-consent';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Ties PostHog to the signed-in Supabase user on every page, for every sign-in
 * method. The login and signup forms only identify after an email/password
 * submit, so Google/Apple OAuth (which lands via /auth/callback) and returning
 * visitors with a stored session stayed anonymous — and their web checkouts
 * could not be joined to the RevenueCat events keyed by the same Supabase id.
 *
 * Waits for analytics consent: identifying while PostHog is opted out would
 * switch the distinct id without sending the `$identify` that merges this
 * browser's anonymous history into the person.
 *
 * Resets on a real sign-out (a user → no user transition), so the next person
 * on a shared browser does not inherit this one's distinct id. A page load with
 * no session never resets — that would split every anonymous visitor.
 *
 * Also keeps the signed-in account's `analytics_consent` in step with the
 * cookie banner — only a decision the visitor actually made, never the
 * automatic grant outside the EU. The API reads it to decide whether a
 * web purchase may be sent to PostHog identified; sign-up metadata alone is a
 * one-time snapshot and is never set by a Google/Apple sign-in. Best effort:
 * a failed write is ignored, and the server treats a missing decision on a web
 * purchase as "no".
 */
/**
 * Auth events that sync the banner decision to the account: a session starting
 * (page load, OAuth return) or a sign-in. A banner change in this tab re-runs
 * the effect, whose new subscription gets INITIAL_SESSION. Never USER_UPDATED:
 * Supabase broadcasts it to every tab, so reacting to it would let two tabs
 * write back and forth.
 */
const CONSENT_SYNC_EVENTS: ReadonlySet<string> = new Set(['INITIAL_SESSION', 'SIGNED_IN']);

export function AnalyticsIdentity() {
  const { consent } = useCookieConsent();

  useEffect(() => {
    if (consent !== true) return;
    const supabase = getSupabaseBrowserClient();
    let signedInUserId: string | null = null;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (userId && posthog.get_distinct_id() !== userId) identifyUser(userId);
      if (!userId && signedInUserId) resetUser();
      signedInUserId = userId;
    });
    return () => subscription.unsubscribe();
  }, [consent]);

  useEffect(() => {
    if (typeof consent !== 'boolean') return;
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || !CONSENT_SYNC_EVENTS.has(event)) return;
      // Read the shared cookie now, not the `consent` this effect captured: a
      // stale tab must not write back an answer another tab already replaced.
      const data = consentMetadataUpdate(readExplicitConsent(), session.user.user_metadata);
      if (!data) return;
      // Never await a Supabase call inside this callback (it can deadlock the
      // auth lock); defer it.
      setTimeout(() => {
        supabase.auth.updateUser({ data }).catch(() => {});
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [consent]);

  return null;
}
