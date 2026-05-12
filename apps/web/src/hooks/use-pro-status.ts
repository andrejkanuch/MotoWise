'use client';

import { type ProStatus, REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useCallback, useEffect, useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const INITIAL: ProStatus = {
  isPro: false,
  isTrialing: false,
  trialDaysLeft: null,
  isLoading: true,
};

const CACHE_KEY = 'mv_pro_status';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Clear cached Pro status — call after checkout success */
export function clearProStatusCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

function readCache(): ProStatus | null {
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

export function useProStatus(): ProStatus {
  const [status, setStatus] = useState<ProStatus>(() => readCache() ?? INITIAL);

  const check = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setStatus(cached);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const sessionResult = await supabase.auth.getSession();
    const user = sessionResult.data.session?.user;

    if (!user) {
      const free = { ...INITIAL, isLoading: false };
      setStatus(free);
      // Don't cache "no session" — user might log in any moment
      return;
    }

    // Strategy 1: RevenueCat (has trial info, but only covers web billing)
    const rcResult = await checkViaRevenueCat(user.id);
    if (rcResult?.isPro) {
      setStatus(rcResult);
      writeCache(rcResult);
      return;
    }

    // Strategy 2: GraphQL / DB fallback (covers all subscription sources — App Store, Play Store, web)
    const dbResult = await checkViaGraphQL();
    if (dbResult) {
      setStatus(dbResult);
      writeCache(dbResult);
      return;
    }

    // Both failed — show as free, don't cache so it retries
    setStatus({ ...INITIAL, isLoading: false });
  }, []);

  useEffect(() => {
    check();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearProStatusCache();
        check();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [check]);

  return status;
}
