'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { getRevenueCatCustomerInfo } from '@/lib/revenuecat';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Resolution state for the current user's subscription-management options.
 *
 * - `loading` — still resolving (haven't completed a lookup yet); render nothing
 *   or a placeholder rather than a misleading "no options" state.
 * - `web` — an active Web Billing subscription; `url` opens RevenueCat's hosted
 *   management/cancel page (self-serve cancel).
 * - `store` — resolved with no Web Billing management URL: a store-billed
 *   (App Store / Google Play) or otherwise non-web subscriber, who manages in
 *   the respective store rather than on the web.
 */
export type ManageSubscription =
  | { status: 'loading' }
  | { status: 'web'; url: string }
  | { status: 'store' };

/**
 * Resolve how the current user can manage their subscription.
 *
 * RevenueCat exposes `customerInfo.managementURL` only for active *Web Billing*
 * subscriptions (bought through the web checkout, backed by Stripe). Store
 * subscriptions return `null` — those are managed in the store. So a non-null
 * value is exactly the set of users we can offer a self-serve web cancel link to.
 *
 * Re-resolves when the tab regains visibility (mirrors use-pro-status), so a
 * user who just finished checkout and landed on /profile, or who returns after
 * managing their plan in the portal, gets a fresh value without a full reload —
 * the web SDK has no customer-info update listener. The first resolve flips the
 * status out of `loading`; later visibility refreshes update in place without
 * flashing back to `loading`.
 */
export function useManageSubscription(): ManageSubscription {
  const [state, setState] = useState<ManageSubscription>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    // Each run gets a token; only the newest may commit. Guards against
    // setState-after-unmount and out-of-order resolves across visibility runs.
    let latest = 0;

    const commit = (next: ManageSubscription, token: number) => {
      if (mounted && token === latest) setState(next);
    };

    const run = () => {
      const token = ++latest;
      (async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          const { data } = await supabase.auth.getSession();
          const user = data.session?.user;
          if (!user) {
            // Clear on logout — an in-tab sign-out (SPA nav, no reload) must not
            // leave the previous user's portal link in state.
            commit({ status: 'store' }, token);
            return;
          }

          const customerInfo = await getRevenueCatCustomerInfo(user.id);
          const url = customerInfo?.managementURL ?? null;
          commit(url ? { status: 'web', url } : { status: 'store' }, token);
        } catch (err) {
          // A real RC/network failure otherwise looks identical to "no web
          // subscription" — report it so a fleet-wide outage on the cancel
          // path is detectable, and fall back to store guidance in the UI.
          Sentry.captureException(err, {
            tags: { area: 'subscription', op: 'resolveManagementURL' },
          });
          commit({ status: 'store' }, token);
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

  return state;
}
