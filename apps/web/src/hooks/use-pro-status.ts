'use client';

import { type ProStatus, REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useEffect, useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export const INITIAL: ProStatus = {
  isPro: false,
  isTrialing: false,
  trialDaysLeft: null,
  isLoading: true,
};

export const CACHE_KEY = 'mv_pro_status';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Clear cached Pro status — call after checkout success */
export function clearProStatusCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export function readCache(): ProStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.checkedAt > CACHE_TTL_MS) return null;
    return {
      isPro: parsed.isPro,
      isTrialing: parsed.isTrialing,
      trialDaysLeft: parsed.trialDaysLeft,
      isLoading: false,
    };
  } catch {
    return null;
  }
}

function writeCache(status: ProStatus) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        isPro: status.isPro,
        isTrialing: status.isTrialing,
        trialDaysLeft: status.trialDaysLeft,
        checkedAt: Date.now(),
      }),
    );
  } catch {
    // sessionStorage unavailable (private browsing, etc.)
  }
}

// Lightweight GraphQL query to check subscription tier from the DB.
// Used as fallback when RevenueCat JS SDK fails or isn't configured.
const TIER_QUERY = /* GraphQL */ `
  query GetGPXQuotaStatus {
    getGPXQuotaStatus {
      limit
    }
  }
` as never;

interface TierData {
  getGPXQuotaStatus: { limit: number };
}

/** Check Pro via RevenueCat JS SDK */
async function checkViaRevenueCat(userId: string): Promise<ProStatus | null> {
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
  if (!apiKey) return null;

  try {
    const { Purchases } = await import('@revenuecat/purchases-js');

    if (!Purchases.isConfigured()) {
      Purchases.configure({ apiKey, appUserId: userId });
    }

    const purchases = Purchases.getSharedInstance();
    const customerInfo = await purchases.getCustomerInfo();

    const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
    const isPro = entitlement !== undefined;
    const isTrialing = entitlement?.periodType === 'trial';
    let trialDaysLeft: number | null = null;

    if (isTrialing && entitlement?.expirationDate) {
      trialDaysLeft = Math.ceil(
        (new Date(entitlement.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
    }

    return { isPro, isTrialing, trialDaysLeft, isLoading: false };
  } catch {
    return null; // RevenueCat failed — fall through to DB check
  }
}

/**
 * Fallback: check Pro via the GraphQL API (reads subscription_tier from DB).
 * Uses getGPXQuotaStatus which returns limit=-1 for Pro users.
 */
async function checkViaGraphQL(): Promise<ProStatus | null> {
  try {
    const data = await gqlFetcher<TierData, Record<string, never>>(TIER_QUERY);
    // limit=-1 means unlimited (Pro), anything else is free tier
    const isPro = data.getGPXQuotaStatus.limit === -1;
    return { isPro, isTrialing: false, trialDaysLeft: null, isLoading: false };
  } catch {
    return null;
  }
}

/**
 * Resolve current Pro status: cache → Supabase session → RevenueCat → DB.
 * Returns the status (and warms the cache) instead of calling setState, so the
 * caller can commit it under a cancellation guard (see `useProStatus`).
 */
async function resolveProStatus(): Promise<ProStatus> {
  const cached = readCache();
  if (cached) return cached;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  // Don't cache "no session" — the user might log in at any moment.
  if (!user) return { ...INITIAL, isLoading: false };

  // Strategy 1: RevenueCat (has trial info, but only covers web billing).
  const rcResult = await checkViaRevenueCat(user.id);
  if (rcResult?.isPro) {
    writeCache(rcResult);
    return rcResult;
  }

  // Strategy 2: GraphQL/DB fallback (covers all sources — App Store, Play Store, web).
  const dbResult = await checkViaGraphQL();
  if (dbResult) {
    writeCache(dbResult);
    return dbResult;
  }

  // Both failed — treat as free, don't cache so it retries next time.
  return { ...INITIAL, isLoading: false };
}

export function useProStatus(): ProStatus {
  // INITIAL on both the server and the client's FIRST render. Reading the
  // sessionStorage cache during the initial render would desync server/client
  // HTML and throw React hydration error #418 (the flicker behind the rage
  // clicks on /garage, /profile, /profile/edit). The cached value is applied
  // one tick later, post-mount — warm-cache users still skip the loading flash.
  const [status, setStatus] = useState<ProStatus>(INITIAL);

  useEffect(() => {
    let mounted = true;
    let latest = 0;

    // Each run gets a token; only the newest run may commit, and only while
    // mounted. Guards against (a) setState after unmount on fast route changes
    // and (b) an older in-flight resolve overwriting a newer one after the
    // cache is cleared on tab refocus (out-of-order resolve → badge flicker).
    const run = () => {
      const token = ++latest;
      resolveProStatus().then((next) => {
        if (mounted && token === latest) setStatus(next);
      });
    };

    run();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearProStatusCache();
        run();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return status;
}
