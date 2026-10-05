'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';
import { useCookieConsent } from '@/components/cookie-consent';
import { identifyUser } from '@/lib/analytics';
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
 */
export function AnalyticsIdentity() {
  const { consent } = useCookieConsent();

  useEffect(() => {
    if (consent !== true) return;
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id;
      if (userId && posthog.get_distinct_id() !== userId) identifyUser(userId);
    });
    return () => subscription.unsubscribe();
  }, [consent]);

  return null;
}
