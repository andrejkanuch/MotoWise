---
title: "feat: Web Pro Status Hook & Pro-Gated UI"
type: feat
status: active
date: 2026-05-07
origin: docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md
---

# feat: Web Pro Status Hook & Pro-Gated UI

## Enhancement Summary

**Deepened on:** 2026-05-07
**Sections enhanced:** All
**Research agents used:** RevenueCat SDK types, GPX button props, codebase learnings, security sentinel, performance oracle, code simplicity reviewer, SpecFlow analyzer

### Key Improvements
1. Replaced Context/Provider with standalone hook + sessionStorage cache — simpler, no layout modification needed
2. Fixed GPX button prop mismatch — uses `routeId`/`routeName`/`isAuthenticated`, not `tripSlug`/`tripName`
3. Added `visibilitychange` re-check and cache-busting after checkout for cross-tab consistency
4. Parallelized Supabase session + RevenueCat SDK import to cut ~200ms from load
5. Use `getSession()` instead of `getUser()` to avoid unnecessary network round-trip

### New Considerations Discovered
- Web SDK has NO `addCustomerInfoUpdateListener` — must poll manually
- `periodType` is lowercase `'trial'` (not `'TRIAL'` as mobile code uses — mobile has a bug)
- `GpxDownloadButton` expects `routeId`, not `tripSlug` — need to verify trip detail page has route ID available or use trip ID with correct mutation

---

## Overview

The MotoVault web app has RevenueCat Web Billing integrated for checkout but has **zero client-side Pro status awareness** outside the checkout success page. The mobile app has `useProGate` + Zustand store, but the web has no equivalent. This means:

- Trip detail pages show "Try Pro free" CTA to everyone, including Pro users
- No GPX download button on trip detail pages (component exists but isn't wired)
- No Pro badge or subscription info in user profiles
- After successful checkout, navigating elsewhere shows no Pro state

This plan wires Pro status awareness across the web app using a standalone `useProStatus` hook that checks RevenueCat entitlements via the Web Billing SDK with sessionStorage caching.

## Problem Statement / Motivation

Users who pay for Pro on web see no difference in the UI after purchasing. The trip detail page still shows upgrade CTAs, GPX download is hidden, and the profile has no Pro indicator. This undermines confidence in the purchase and reduces the value of Pro on web.

(see brainstorm: docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md — "Activate the existing MotoWise Pro entitlement on web")

## Proposed Solution

### 1. `useProStatus` standalone hook

A React hook (no Context/Provider needed) that:
- Checks if the user is authenticated via Supabase `getSession()` (local cache, no network call)
- If authenticated, configures RevenueCat with the user's ID and fetches entitlements
- Caches result in `sessionStorage` with 5-minute TTL to avoid redundant API calls on navigation
- Re-checks on `visibilitychange` (tab becomes visible) for cross-tab consistency
- Exposes `{ isPro, isTrialing, trialDaysLeft, isLoading }`
- Falls back gracefully: unauthenticated = not Pro, SDK failure = not Pro (with `isLoading: false`)

### 2. Conditional trip detail UI

- **Pro users**: Hide the "Try Pro free" CTA section, show GPX download button inline
- **Free/anon users**: Show Pro CTA (existing), show GPX button with quota indicator (existing component handles gating internally)

### 3. Pro badge on profile (inlined)

- Show a small "Pro" badge next to the user's name on the profile page when `isPro` is true
- Show "Trial — X days left" variant when `isTrialing` is true
- Inlined directly in the profile page — no separate component file needed

## Technical Approach

### Architecture

```
useProStatus()               ← NEW standalone hook (no provider)
  ├─ sessionStorage cache    ← 5min TTL, cleared after checkout
  ├─ Supabase getSession()   ← local session read, no network
  ├─ RevenueCat SDK          ← dynamic import, getCustomerInfo()
  └─ visibilitychange        ← re-check when tab becomes visible

trip-pro-section.tsx         ← NEW client component (conditional CTA + GPX)
profile/page.tsx             ← MODIFY (inline Pro badge)
checkout/success/page.tsx    ← MODIFY (clear cache on activation)
```

### Implementation

#### File 1: `apps/web/src/hooks/use-pro-status.ts` (NEW)

```tsx
'use client';

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type ProStatus = {
  isPro: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  isLoading: boolean;
};

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
  sessionStorage.removeItem(CACHE_KEY);
}

function readCache(): ProStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { checkedAt, ...status } = JSON.parse(raw);
    if (Date.now() - checkedAt > CACHE_TTL_MS) return null;
    return { ...status, isLoading: false };
  } catch {
    return null;
  }
}

function writeCache(status: ProStatus) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...status, checkedAt: Date.now() }),
    );
  } catch {
    // sessionStorage unavailable (private browsing, etc.)
  }
}

export function useProStatus(): ProStatus {
  const [status, setStatus] = useState<ProStatus>(() => readCache() ?? INITIAL);

  const check = useCallback(async () => {
    // 1. Read from cache first
    const cached = readCache();
    if (cached) {
      setStatus(cached);
      return;
    }

    // 2. Parallel: get session + import RevenueCat SDK
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

    // 3. Configure RevenueCat + fetch entitlements
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

    const entitlement =
      customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
    const isPro = entitlement !== undefined;
    const isTrialing = entitlement?.periodType === 'trial';
    let trialDaysLeft: number | null = null;

    if (isTrialing && entitlement?.expirationDate) {
      trialDaysLeft = Math.ceil(
        (new Date(entitlement.expirationDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
    }

    const result = { isPro, isTrialing, trialDaysLeft, isLoading: false };
    setStatus(result);
    writeCache(result);
  }, []);

  useEffect(() => {
    let cancelled = false;

    check().catch(() => {
      if (!cancelled) setStatus({ ...INITIAL, isLoading: false });
    });

    // Re-check when tab becomes visible (cross-tab sync after purchase)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear cache to force fresh check
        clearProStatusCache();
        check().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [check]);

  return status;
}
```

**Key decisions:**
- **Standalone hook, no Context/Provider** — only 2 consumers (trip detail, profile), never rendered simultaneously. Context adds complexity without benefit.
- **sessionStorage cache with 5min TTL** — eliminates RevenueCat calls on page navigation. First load pays ~300ms, subsequent loads are instant.
- **`getSession()` not `getUser()`** — reads local session cache, avoids network round-trip to Supabase auth server.
- **Parallel `Promise.all`** — session check and SDK import run concurrently, saving ~200ms.
- **Uses existing `getSupabaseBrowserClient()`** — no duplicate Supabase client creation. `@supabase/ssr` is already in the shared bundle.
- **`visibilitychange` listener** — re-checks when tab becomes visible, handling cross-tab purchase scenario.
- **`clearProStatusCache()` export** — called from checkout success page after activation to force fresh check.
- **`periodType === 'trial'`** — lowercase per SDK types (web SDK uses `"normal" | "intro" | "trial" | "prepaid"`).

### Research Insights — RevenueCat Web SDK

- Web SDK has **NO `addCustomerInfoUpdateListener`** — polling or manual re-check is the only option
- `periodType` values are **lowercase**: `"trial"`, not `"TRIAL"` (mobile code at `subscription.ts:92` has a bug using uppercase)
- `configure()` is a singleton — calling it twice with a different `appUserId` is a no-op. Logout/user-switch requires a page reload (acceptable for web).
- EntitlementInfo shape: `{ identifier, isActive, willRenew, store, periodType, expirationDate, ... }`

#### File 2: `apps/web/src/components/trip-detail/trip-pro-section.tsx` (NEW)

```tsx
'use client';

import { Crown, Download, Route, Sparkles, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useProStatus } from '@/hooks/use-pro-status';
import { GpxDownloadButton } from '@/components/gpx-download-button';

type Props = {
  routeId: string;       // trip.id — passed to GpxDownloadButton as routeId
  routeName: string;     // trip.title
  isAuthenticated: boolean;
};

export function TripProSection({ routeId, routeName, isAuthenticated }: Props) {
  const { isPro, isLoading } = useProStatus();

  if (isLoading) return null; // Don't flash either state

  if (isPro) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <GpxDownloadButton
          routeId={routeId}
          routeName={routeName}
          isAuthenticated={isAuthenticated}
        />
      </section>
    );
  }

  // Free/anon user: show existing Pro CTA
  // (Move the JSX from trip detail page lines 803-860 here)
  return (
    <section className="relative mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-warm-500/20 bg-gradient-to-br from-warm-500/5 via-neutral-900/50 to-neutral-900/80 px-6 py-10 sm:px-10">
      {/* ... existing Pro CTA content ... */}
    </section>
  );
}
```

**Note on props:** `GpxDownloadButton` expects `routeId: string`, `routeName: string`, `isAuthenticated: boolean`. The trip detail page must pass `trip.id` as `routeId` and `trip.title` as `routeName`. Verify the GraphQL query returns an `id` field on the trip — if not, add it to the query.

#### File 3: `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` (MODIFY)

Replace the static Pro CTA section (lines 803-860) with:

```tsx
<TripProSection
  routeId={trip.id}
  routeName={trip.title}
  isAuthenticated={!!session}
/>
```

Ensure the `WebTripBySlugQuery` includes `id` in the selection set.

#### File 4: `apps/web/src/app/(community)/profile/page.tsx` (MODIFY)

Add inline Pro badge to the profile header. Wrap the badge portion in a small client component or convert the header to a client island:

```tsx
// Inline in profile header, next to username
const { isPro, isTrialing, trialDaysLeft } = useProStatus();

{isPro && (
  <span className="inline-flex items-center gap-1 rounded-full bg-warm-500/15 px-2.5 py-0.5 text-xs font-semibold text-warm-400">
    <Crown className="size-3" />
    {isTrialing && trialDaysLeft != null
      ? `Trial · ${trialDaysLeft}d left`
      : 'Pro'}
  </span>
)}
```

#### File 5: `apps/web/src/app/pro/checkout/success/page.tsx` (MODIFY)

After entitlement is confirmed (in the `activated` state), clear the cache:

```tsx
import { clearProStatusCache } from '@/hooks/use-pro-status';

// In the activated handler:
clearProStatusCache();
```

This ensures the next navigation fetches fresh entitlements from RevenueCat.

## System-Wide Impact

- **Bundle size**: RevenueCat SDK (~190KB gzipped) only loads via dynamic import on pages that call `useProStatus()`. Not in the shared bundle.
- **Network**: With sessionStorage cache, only 1 RevenueCat API call per 5 minutes per session. `getSession()` is a local read (no network).
- **No API changes**: All data comes from RevenueCat client SDK, not our GraphQL API.
- **No DB changes**: No migrations needed.
- **SSR**: Hook is `'use client'` — server components unaffected. Only the Pro CTA extraction to `TripProSection` changes the SSR boundary.
- **Security**: Client-side Pro check is purely cosmetic. All security-critical operations (GPX export, quota enforcement) are enforced server-side by `EntitlementsService.can()` and `getGPXQuotaStatus()`. Fail-closed: SDK failure = free state.
- **Logout**: RevenueCat `configure()` is a singleton. On logout + re-login as different user, a full page reload resets the SDK (standard web auth pattern).

## Acceptance Criteria

- [ ] `useProStatus()` hook available, returns `{ isPro, isTrialing, trialDaysLeft, isLoading }`
- [ ] Trip detail page hides "Try Pro free" CTA for Pro users
- [ ] Trip detail page shows GPX download button for Pro users (using existing `GpxDownloadButton`)
- [ ] Free/anon users see the existing Pro CTA (no regression)
- [ ] Profile page shows "Pro" badge next to username for Pro users
- [ ] Profile page shows "Trial · Xd left" badge for trialing users
- [ ] Unauthenticated users see `isPro: false, isLoading: false` (no loading spinner forever)
- [ ] RevenueCat SDK failure degrades gracefully to free state
- [ ] Checkout success page clears Pro status cache on activation
- [ ] `visibilitychange` triggers re-check for cross-tab purchase sync
- [ ] sessionStorage cache prevents redundant RevenueCat calls on navigation
- [ ] `GpxDownloadButton` receives correct props (`routeId`, `routeName`, `isAuthenticated`)

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| CREATE | `apps/web/src/hooks/use-pro-status.ts` | Standalone hook with sessionStorage cache |
| CREATE | `apps/web/src/components/trip-detail/trip-pro-section.tsx` | Conditional Pro CTA / GPX download section |
| MODIFY | `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` | Replace static Pro CTA with TripProSection |
| MODIFY | `apps/web/src/app/(community)/profile/page.tsx` | Add inline Pro badge to header |
| MODIFY | `apps/web/src/app/pro/checkout/success/page.tsx` | Clear Pro status cache on activation |

## Edge Cases

- **Post-purchase navigation**: Checkout success page calls `clearProStatusCache()`. Next page load fetches fresh entitlements from RevenueCat. If entitlement hasn't propagated yet (~rare, <5s), user sees free state briefly — acceptable since server-side GPX export still works.
- **Multiple tabs**: `visibilitychange` listener clears cache and re-checks when a tab becomes visible. Purchase in Tab A → switch to Tab B → fresh check runs.
- **Expired subscription**: RevenueCat removes the entitlement from `active` — hook returns `isPro: false` on next check after cache expires.
- **No RevenueCat key configured**: Hook resolves to free state immediately. No error thrown.
- **SDK load failure / network down**: Catch block sets `isPro: false, isLoading: false`. Fail-closed — safe for revenue, Pro users can still use GPX via server-side quota (they just see the CTA banner).
- **Logout + different user login**: Page reload during auth flow resets the RevenueCat singleton. sessionStorage cache is cleared by the auth redirect.
- **Private browsing / sessionStorage unavailable**: Cache read/write silently fails. Hook always fetches fresh — slightly more API calls but fully functional.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md](docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md) — Key decisions: two-tier CTA model, activate MotoWise Pro on web
- **Checkout success pattern:** `apps/web/src/app/pro/checkout/success/page.tsx:56-74`
- **Mobile equivalent:** `apps/mobile/src/hooks/useProGate.ts`, `apps/mobile/src/stores/subscription.store.ts`
- **Supabase browser client:** `apps/web/src/lib/supabase-browser.ts`
- **GPX button:** `apps/web/src/components/gpx-download-button.tsx` — props: `routeId`, `routeName`, `isAuthenticated`
- **Trip detail Pro CTA:** `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx:803-860`
- **Entitlement constant:** `packages/types/src/constants/subscription.ts` — `REVENUECAT_ENTITLEMENT_PRO = 'MotoWise Pro'`
- **RevenueCat Web SDK types:** `node_modules/@revenuecat/purchases-js/dist/Purchases.es.d.ts` — `PeriodType = "normal" | "intro" | "trial" | "prepaid"`
- **Next.js 16 PPR learning:** `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md` — confirmed `cacheComponents: false` is set
