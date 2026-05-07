'use client';

import { type ProStatus, REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useCallback, useEffect, useState } from 'react';
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

export function useProStatus(): ProStatus {
  const [status, setStatus] = useState<ProStatus>(() => readCache() ?? INITIAL);

  const check = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setStatus(cached);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const [sessionResult, { Purchases }] = await Promise.all([
        supabase.auth.getSession(),
        import('@revenuecat/purchases-js'),
      ]);

      const user = sessionResult.data.session?.user;
      if (!user) {
        const free = { ...INITIAL, isLoading: false };
        setStatus(free);
        writeCache(free);
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
      if (!apiKey) {
        const free = { ...INITIAL, isLoading: false };
        setStatus(free);
        return;
      }

      if (!Purchases.isConfigured()) {
        Purchases.configure({ apiKey, appUserId: user.id });
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

      const result: ProStatus = { isPro, isTrialing, trialDaysLeft, isLoading: false };
      setStatus(result);
      writeCache(result);
    } catch {
      setStatus({ ...INITIAL, isLoading: false });
    }
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
