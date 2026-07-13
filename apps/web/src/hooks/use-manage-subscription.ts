'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { getRevenueCatCustomerInfo } from '@/lib/revenuecat';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Resolve the RevenueCat Web Billing management URL for the current user.
 *
 * RevenueCat exposes `customerInfo.managementURL` only when the user has an
 * active *Web Billing* subscription (i.e. they subscribed through the web
 * checkout, which is backed by Stripe). Store subscriptions (App Store /
 * Google Play) return `null` here — those are managed in the respective store,
 * not from the web. So a non-null value is exactly the set of users we can
 * offer a self-serve cancel/manage link to on the web.
 *
 * Re-resolves when the tab regains visibility (mirrors use-pro-status), so a
 * user who just finished checkout and landed on /profile, or who returns after
 * managing their plan in the portal, gets a fresh value without a full reload —
 * the web SDK has no customer-info update listener.
 *
 * Returns `null` while loading and for store-billed / free users.
 */
export function useManageSubscription(): string | null {
  const [managementURL, setManagementURL] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // Each run gets a token; only the newest may commit. Guards against
    // setState-after-unmount and out-of-order resolves across visibility runs.
    let latest = 0;

    const run = () => {
      const token = ++latest;
      (async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          const { data } = await supabase.auth.getSession();
          const user = data.session?.user;
          if (!user) return;

          const customerInfo = await getRevenueCatCustomerInfo(user.id);
          if (mounted && token === latest) {
            setManagementURL(customerInfo?.managementURL ?? null);
          }
        } catch (err) {
          // A real RC/network failure otherwise looks identical to "no web
          // subscription" (link hidden) — report it so a fleet-wide outage on
          // the cancel path is detectable.
          Sentry.captureException(err, {
            tags: { area: 'subscription', op: 'resolveManagementURL' },
          });
        }
      })();
    };

    run();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return managementURL;
}
