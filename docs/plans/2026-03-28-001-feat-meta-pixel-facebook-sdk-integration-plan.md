---
title: "feat: Meta Pixel & Facebook SDK Integration"
type: feat
status: active
date: 2026-03-28
deepened: 2026-03-28
---

# Meta Pixel & Facebook SDK Integration

## Enhancement Summary

**Deepened on:** 2026-03-28
**Sections enhanced:** 8
**Research agents used:** security-sentinel, performance-oracle, architecture-strategist, code-simplicity-reviewer, best-practices-researcher (x2), repo-research-analyst, learnings-researcher, spec-flow-analyzer, framework-docs-researcher

### Key Improvements
1. **Suspense boundary required** — `useSearchParams()` in MetaPixel component requires a `<Suspense>` wrapper in Next.js App Router to avoid client-rendering the entire layout
2. **`clientToken` is mandatory** — Facebook SDK v13+ crashes without it; must obtain from Meta Developer Dashboard before implementation
3. **`logPurchase()` not `logEvent()`** — Purchase events must use the dedicated `AppEventsLogger.logPurchase(amount, currency, params)` API for proper ROAS attribution
4. **ATT timing matters** — Show after onboarding (not at launch) for ~35% opt-in rate vs ~25% if shown immediately
5. **DNS prefetch** — Add `<link rel="dns-prefetch" href="https://connect.facebook.net" />` to reduce pixel load latency
6. **Duplicate PageView prevention** — `useRef` guard is critical; without it every session starts with doubled PageView inflating analytics

### New Considerations Discovered
- `useSearchParams()` may not be needed — Meta Pixel only cares about path changes, not query params. Removing it avoids the Suspense boundary requirement.
- `expo-tracking-transparency` is the recommended ATT package for Expo 54 (not `react-native-tracking-transparency`)
- `Settings.setAdvertiserTrackingEnabled()` can crash on iOS simulator — wrap in try-catch
- PPR conflict with cookie consent is already documented in institutional learnings — no new risk
- RevenueCat has a native server-to-server Meta integration for reliable purchase attribution (dashboard config, not code)

## Overview

Add Meta tracking across both MotoVault surfaces: **Meta Pixel** on the Next.js marketing website (apps/web) and **Facebook SDK** via `react-native-fbsdk-next` in the Expo mobile app (apps/mobile). This enables Meta Ads campaign optimization by tracking user actions across web and mobile.

## Problem Statement / Motivation

MotoVault runs Meta ad campaigns (Ads Account ID: `1413320533442531`) but has zero conversion tracking. Without client-side event data flowing back to Meta, campaigns cannot optimize for high-value actions (installs, subscriptions, content engagement). This integration closes that feedback loop.

## Proposed Solution

Two parallel workstreams:

1. **Web — Meta Pixel** (Pixel ID: `913433971307490`): Raw JS snippet via `next/script`, client component with SPA route tracking, typed utility functions, env-gated loading, GDPR consent TODO.
2. **Mobile — Facebook SDK** (App ID: `950678714025532`): `react-native-fbsdk-next` Expo config plugin, `expo-tracking-transparency` for iOS ATT, typed `MetaAnalytics` utility, event wiring in existing screens, privacy toggle integration.

## Technical Approach

### Phase 1: Web — Meta Pixel (`apps/web`)

#### 1.1 TypeScript Type Declarations

Create `apps/web/src/types/meta-pixel.d.ts`:

```typescript
type MetaPixelStandardEvent =
  | 'AddPaymentInfo' | 'AddToCart' | 'AddToWishlist'
  | 'CompleteRegistration' | 'Contact' | 'CustomizeProduct'
  | 'Donate' | 'FindLocation' | 'InitiateCheckout'
  | 'Lead' | 'PageView' | 'Purchase' | 'Schedule'
  | 'Search' | 'StartTrial' | 'SubmitApplication'
  | 'Subscribe' | 'ViewContent';

interface MetaPixelContentParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  currency?: string;
  value?: number;
  search_string?: string;
  status?: boolean;
  [key: string]: unknown;
}

interface Window {
  fbq: {
    (command: 'init', pixelId: string): void;
    (command: 'track', event: MetaPixelStandardEvent, params?: MetaPixelContentParams): void;
    (command: 'trackCustom', event: string, params?: Record<string, unknown>): void;
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    loaded: boolean;
    version: string;
    push: (...args: unknown[]) => void;
  };
  _fbq?: Window['fbq'];
}
```

#### 1.2 Meta Pixel Utility

Create `apps/web/src/lib/meta-pixel.ts`:

```typescript
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function trackPageView() {
  if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('track', 'PageView');
}

export function trackEvent(event: MetaPixelStandardEvent, params?: MetaPixelContentParams) {
  if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('track', event, params);
}

export function trackCustomEvent(event: string, params?: Record<string, unknown>) {
  if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('trackCustom', event, params);
}
```

#### 1.3 MetaPixel Client Component

Create `apps/web/src/components/meta-pixel.tsx`:

- `'use client'` component
- Renders `<Script id="meta-pixel" strategy="afterInteractive">` with the raw fbq snippet
- Uses `dangerouslySetInnerHTML` for the pixel init code
- `usePathname()` in a `useEffect` to fire `PageView` on SPA navigations
- **Critical**: Use `useRef` to skip the first effect run (prevents duplicate initial PageView — the inline script already fires it)
- Conditionally render `null` when `NEXT_PUBLIC_META_PIXEL_ID` is not set (dev environments)
- Include `<noscript>` fallback img tag

**Research Insights:**

- **Do NOT use `useSearchParams()`** — Meta Pixel only tracks path changes, not query params. Using `useSearchParams()` forces a Suspense boundary in Next.js App Router (it opts the component into client-side rendering). Use `usePathname()` alone.
- **DNS prefetch**: Add `<link rel="dns-prefetch" href="https://connect.facebook.net" />` in the root layout `<head>` to reduce script load latency (connect.facebook.net is a new origin).
- **Ad blocker resilience**: Always check `typeof window.fbq !== 'undefined'` before calling — ~30-40% of users have ad blockers that prevent `fbevents.js` from loading. The utility functions already handle this.
- **`afterInteractive` is correct** — confirmed as the recommended strategy for analytics scripts in Next.js 16. `lazyOnload` is too late (misses quick-bounce PageViews), `beforeInteractive` is too aggressive.
- **React 19 Strict Mode**: Effects fire twice in dev. The `useRef` guard handles this naturally. No issue in production.

```typescript
// Key implementation pattern — skip initial PageView to prevent double-fire
'use client';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  const pathname = usePathname();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!PIXEL_ID || typeof window.fbq === 'undefined') return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    window.fbq('track', 'PageView');
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
          n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
          s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)
          }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${PIXEL_ID}');fbq('track','PageView');
        `}} />
      <noscript>
        <img height="1" width="1" style={{ display: 'none' }}
          src={\`https://www.facebook.com/tr?id=\${PIXEL_ID}&ev=PageView&noscript=1\`} alt="" />
      </noscript>
    </>
  );
}
```

#### 1.4 Root Layout Integration

Modify `apps/web/src/app/layout.tsx`:

- Import `MetaPixel` from `@/components/meta-pixel`
- Render `<MetaPixel />` alongside existing `<Analytics />` and `<GoogleAnalytics />`

#### 1.5 Standard Event Wiring (Web)

Add event calls in existing web pages/components:

| Event | Where | Parameters |
|---|---|---|
| `ViewContent` | Feature pages, blog posts, landing pages | `content_name`, `content_category` |
| `Lead` | App Store / Google Play download links (onClick) | `content_name: 'App Download'` |

Key files to modify:
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — landing page download links → `Lead`
- `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` — article view → `ViewContent`
- Feature pages under `apps/web/src/app/[locale]/(marketing)/features/` — `ViewContent`
- Any component rendering App Store / Google Play badges → `Lead` on click

#### 1.6 Environment Variable

- Add `NEXT_PUBLIC_META_PIXEL_ID=913433971307490` to `.env` (production only)
- Add `NEXT_PUBLIC_META_PIXEL_ID=` to `.env.example`
- Pixel only loads when env var is set → safe for development

#### 1.7 GDPR / Consent

- **No cookie banner exists currently** — add TODO comments noting this is needed before EU launch
- The `MetaPixel` component should accept an optional `hasConsent` prop for future consent gating
- Note: existing Google Analytics also lacks consent gating — both need addressing together
- **Known constraint**: `cacheComponents: true` (PPR) is disabled per existing documented solution. Cookie-based consent checks in the layout would conflict with PPR if re-enabled.

---

### Phase 2: Mobile — Facebook SDK (`apps/mobile`)

#### 2.1 Package Installation

```bash
cd apps/mobile
pnpm add react-native-fbsdk-next expo-tracking-transparency
```

Both are native modules — require EAS Build, not Expo Go.

#### 2.2 App Config (`app.config.ts`)

Add to the `plugins` array:

```typescript
[
  'expo-tracking-transparency',
  {
    userTrackingPermission:
      'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
  },
],
[
  'react-native-fbsdk-next',
  {
    appID: '950678714025532',
    clientToken: process.env.FACEBOOK_CLIENT_TOKEN ?? '',
    displayName: 'MotoVault',
    scheme: 'fb950678714025532',
    advertiserIDCollectionEnabled: false,
    autoLogAppEventsEnabled: true,
    isAutoInitEnabled: true,
    iosUserTrackingPermission:
      'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
  },
],
```

Also add to `ios.infoPlist`:
```typescript
NSUserTrackingUsageDescription: 'MotoVault uses this identifier to deliver personalized ads and measure campaign effectiveness.',
```

**Important**: `clientToken` is required since Facebook SDK v13. Obtain from Meta Developer Dashboard > App > Settings > Advanced > Client Token. Store as `FACEBOOK_CLIENT_TOKEN` env var.

#### 2.3 ATT Initialization

In the root `_layout.tsx`, add ATT + Facebook SDK initialization:

```typescript
import { Settings } from 'react-native-fbsdk-next';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

// Inside useEffect in root layout:
async function initMetaSDK() {
  if (process.env.EXPO_OS === 'ios') {
    const { status } = await requestTrackingPermissionsAsync();
    Settings.initializeSDK();
    try {
      if (status === 'granted') {
        await Settings.setAdvertiserTrackingEnabled(true);
      }
    } catch {
      // setAdvertiserTrackingEnabled can crash on iOS simulator
    }
  } else {
    Settings.initializeSDK();
  }
}
```

**Timing**: Show ATT after onboarding completes but before the main app experience. This maximizes opt-in rates (users understand app value first).

**Research Insights:**

- **ATT opt-in rates (2025-2026)**: Industry average is 25-35%. Showing ATT after the user understands the app's value (post-onboarding) pushes toward the higher end.
- **Pre-prompt screen**: A "soft ask" screen before the system ATT dialog explaining why tracking helps ("Help us improve by allowing tracking") can increase opt-in rates by 10-15%. Consider adding this in a future iteration.
- **`setAdvertiserTrackingEnabled` crash**: This method can crash on iOS simulators (GitHub issue #190). The try-catch is essential for dev builds.
- **Android behavior**: `Settings.setAdvertiserTrackingEnabled()` is a no-op on Android — safe to call without platform check, but the ATT prompt itself (`requestTrackingPermissionsAsync`) should only run on iOS.
- **`isAutoInitEnabled: true` with ATT**: The SDK auto-initializes at app launch, before ATT response. Events logged before ATT consent still fire but without IDFA. This is acceptable — Meta uses probabilistic matching for pre-ATT events.
- **`expo-tracking-transparency`** is the correct package for Expo 54 (not the community `react-native-tracking-transparency`).

#### 2.4 Meta Analytics Utility

Create `apps/mobile/src/lib/meta-analytics.ts`:

```typescript
import { AppEventsLogger } from 'react-native-fbsdk-next';

export const MetaAnalytics = {
  trackCompleteTutorial: () =>
    AppEventsLogger.logEvent('fb_mobile_tutorial_completion'),

  trackViewContent: (contentType: string, contentId: string) =>
    AppEventsLogger.logEvent('fb_mobile_content_view', {
      fb_content_type: contentType,
      fb_content_id: contentId,
    }),

  trackSearch: (query: string) =>
    AppEventsLogger.logEvent('fb_mobile_search', {
      fb_search_string: query,
    }),

  trackAddToGarage: (make: string, model: string, year: number) =>
    AppEventsLogger.logEvent('fb_mobile_add_to_wishlist', {
      fb_content_type: 'motorcycle',
      fb_description: `${year} ${make} ${model}`,
    }),

  trackStartTrial: (offerId: string) =>
    AppEventsLogger.logEvent('fb_mobile_activate_app', {
      fb_content_id: offerId,
    }),

  trackSubscribe: (revenue: number, currency: string, packageId: string) =>
    AppEventsLogger.logPurchase(revenue, currency, {
      fb_content_id: packageId,
    }),

  trackStartDiagnostic: () =>
    AppEventsLogger.logEvent('fb_mobile_rate', {
      fb_content_type: 'ai_diagnostic',
    }),

  trackLogRide: (distanceKm: number) =>
    AppEventsLogger.logEvent('fb_mobile_achievement_unlocked', {
      fb_description: 'ride_logged',
      fb_content_type: 'ride',
    }),

  trackLogMaintenance: (maintenanceType: string) =>
    AppEventsLogger.logEvent('fb_mobile_spent_credits', {
      fb_content_type: 'maintenance',
      fb_description: maintenanceType,
    }),
};
```

**Note**: `trackSubscribe` uses `AppEventsLogger.logPurchase()` (not `logEvent`) — this is the correct API for purchase events with revenue/currency.

**Research Insights:**

- **AEM (Aggregated Event Measurement)**: For iOS 14+ SKAdNetwork attribution, also log purchase events via `AEMReporterIOS`:
  ```typescript
  import { AEMReporterIOS } from 'react-native-fbsdk-next';
  // After logPurchase, also call (no-ops on Android):
  AEMReporterIOS.logAEMEvent('fb_mobile_purchase', amount, currency, params);
  ```
- **Event initialization timing**: Never call `AppEventsLogger.logEvent()` in component body or during render. Always wrap in `useEffect` or event handlers. Calling before SDK initialization causes silent failures.
- **Events not appearing in Events Manager**: This is the most common issue (#542, #161). Root causes: SDK not initialized, missing `clientToken`, ATT not requested. Events can take 24-48h to appear — use Test Events tool for real-time debugging.
- **`flush()`**: Call `AppEventsLogger.flush()` after critical events (Purchase) to force-send immediately rather than waiting for the SDK's batch interval.
- **RevenueCat server-to-server**: RevenueCat has a native Meta integration (dashboard config, not code) that sends purchase events server-side. This handles app-kill scenarios and renewal attribution. Recommended as a complement to client-side tracking.

#### 2.5 Privacy Toggle Integration

Modify `apps/mobile/src/lib/analytics.ts` — extend `setAnalyticsEnabled()`:

```typescript
import { Settings } from 'react-native-fbsdk-next';

export function setAnalyticsEnabled(enabled: boolean) {
  // Existing PostHog toggle
  if (enabled) { posthog.optIn(); } else { posthog.optOut(); }
  // Add Facebook SDK toggle
  Settings.setAdvertiserTrackingEnabled(enabled);
}
```

#### 2.6 Event Wiring in Screens

| Screen | File | Event Call |
|---|---|---|
| Onboarding completion | `src/app/(onboarding)/index.tsx` (or final step) | `MetaAnalytics.trackCompleteTutorial()` |
| Article detail | `src/app/(tabs)/(learn)/article/[slug].tsx` | `MetaAnalytics.trackViewContent('article', slug)` |
| Add bike (onboarding) | `src/app/(onboarding)/bike-photo.tsx` (final step) | `MetaAnalytics.trackAddToGarage(make, model, year)` |
| Add bike (garage) | `src/app/(tabs)/(garage)/add-bike.tsx` | `MetaAnalytics.trackAddToGarage(make, model, year)` |
| Search (learn) | `src/app/(tabs)/(learn)/index.tsx` | `MetaAnalytics.trackSearch(query)` |
| Diagnostics | `src/app/(tabs)/(diagnose)/new.tsx` | `MetaAnalytics.trackStartDiagnostic()` |
| Ride summary | `src/app/(modals)/ride-summary.tsx` | `MetaAnalytics.trackLogRide(distanceKm)` |
| Add maintenance | `src/app/(tabs)/(garage)/add-maintenance-task.tsx` | `MetaAnalytics.trackLogMaintenance(type)` |
| Paywall purchase success | `src/app/(tabs)/(profile)/upgrade.tsx` | `MetaAnalytics.trackSubscribe(price, currency, packageId)` |
| Onboarding paywall | `src/app/(onboarding)/paywall.tsx` | `MetaAnalytics.trackSubscribe(price, currency, packageId)` |
| Trial start | upgrade.tsx / paywall.tsx | `MetaAnalytics.trackStartTrial(offerId)` |

---

## System-Wide Impact

### Interaction Graph

- **Web**: `MetaPixel` component renders → `fbevents.js` loads → `fbq('init')` + `fbq('track', 'PageView')` fire → on SPA navigation, `useEffect` fires additional `PageView`. Event utility functions fire standard events from page components.
- **Mobile**: App launch → ATT prompt (iOS) → `Settings.initializeSDK()` → `autoLogAppEventsEnabled` fires `app_install`/`app_launch`. Manual `AppEventsLogger.logEvent()` calls fire from screen components. `logPurchase()` fires from RevenueCat success callbacks.

### Error Propagation

- **Web**: If `fbevents.js` is blocked (ad blockers), `window.fbq` is undefined. All utility functions check for this and no-op silently. No error propagation.
- **Mobile**: If Facebook SDK fails to initialize (missing `clientToken`), `AppEventsLogger` calls silently fail. No crash, but events are lost. The `try-catch` around `Settings.setAdvertiserTrackingEnabled` prevents simulator crashes.

### State Lifecycle Risks

- **Purchase event loss**: If app is killed mid-purchase, the RevenueCat `customerInfoUpdateListener` fires on next launch, but the Meta purchase event may not fire retroactively. Acceptable for v1 — RevenueCat's server-to-server Meta integration can be added later for reliability.
- **Privacy toggle desync**: If user disables analytics while events are queued in the Facebook SDK buffer, queued events may still be sent. The SDK flushes asynchronously.

### API Surface Parity

- Web `meta-pixel.ts` and mobile `meta-analytics.ts` are independent utilities — no shared interface needed.
- The existing `analytics.ts` in mobile already has a dual-SDK pattern (PostHog + Sentry). Facebook SDK adds a third layer following the same pattern.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Meta Pixel loads on production web app when `NEXT_PUBLIC_META_PIXEL_ID` is set
- [ ] Meta Pixel does NOT load in development (env var unset)
- [ ] `PageView` fires on initial page load and on each SPA route change (no duplicate on initial load)
- [ ] `ViewContent` fires on feature pages and blog posts with content metadata
- [ ] `Lead` fires when user clicks App Store / Google Play download links
- [ ] Facebook SDK initializes on mobile app launch
- [ ] ATT prompt appears on iOS before IDFA collection
- [ ] All 9 mobile events fire at the correct screen/action
- [ ] Purchase events include revenue value and currency from RevenueCat
- [ ] Privacy toggle in mobile app controls Facebook SDK event logging
- [ ] TypeScript compiles with no errors (`pnpm build`)

### Non-Functional Requirements

- [ ] No third-party npm packages for web pixel (raw JS snippet only)
- [ ] All `fbq` calls are type-safe via `.d.ts` declarations
- [ ] No Facebook Login functionality added — analytics/events only
- [ ] No hardcoded colors (use palette tokens)
- [ ] Mobile integration requires new EAS Build (documented in test plan)

---

## Dependencies & Prerequisites

1. **Facebook Client Token**: Required for `react-native-fbsdk-next` v13+. Obtain from Meta Developer Dashboard > App Settings > Advanced.
2. **EAS Build**: Mobile changes include native modules — OTA updates cannot deliver them. A new native build is required.
3. **Meta Events Manager access**: Needed to verify events via Test Events tab.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ad blockers prevent pixel on web | High | Moderate | Accept for v1; add Conversions API later |
| Missing `clientToken` crashes mobile app | Medium | High | Validate at build time; fail gracefully |
| Duplicate PageView on web | Medium | Low | `useRef` guard in MetaPixel component |
| ATT denial reduces attribution | High | Moderate | Events still fire without IDFA; limited but functional |
| PPR conflict with future cookie consent | Low | Medium | PPR already disabled; document constraint |

## Test Plan

### Web
1. Set `NEXT_PUBLIC_META_PIXEL_ID` in `.env.local`
2. Open Meta Events Manager > Test Events tab
3. Visit the site — verify `PageView` fires once
4. Navigate to a blog post — verify `PageView` + `ViewContent` fire
5. Click an App Store link — verify `Lead` fires
6. Remove env var — verify pixel does not load

### Mobile
1. Run `eas build --profile development` to create a dev client with native modules
2. Open Meta Events Manager > Test Events tab
3. Launch app — verify ATT prompt appears (iOS)
4. Complete onboarding — verify `CompleteTutorial` event
5. View an article — verify `ViewContent` event
6. Purchase a subscription — verify `Purchase` event with revenue
7. Toggle analytics off in Privacy settings — verify events stop
8. Toggle analytics back on — verify events resume

## Sources & References

### Internal References
- `apps/web/src/app/layout.tsx` — root layout (add MetaPixel component)
- `apps/web/src/lib/analytics.ts` — existing analytics pattern to follow
- `apps/mobile/app.config.ts` — Expo config (add Facebook plugin)
- `apps/mobile/src/lib/analytics.ts` — existing dual-SDK analytics
- `apps/mobile/src/app/(tabs)/(profile)/privacy.tsx` — privacy toggle
- `apps/mobile/src/lib/subscription.ts` — RevenueCat integration

### External References
- [react-native-fbsdk-next](https://github.com/thebergamo/react-native-fbsdk-next)
- [Meta Pixel Conversion Tracking](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/)
- [expo-tracking-transparency](https://docs.expo.dev/versions/latest/sdk/tracking-transparency/)
- [Next.js Script Component](https://nextjs.org/docs/app/api-reference/components/script)

### Known Institutional Learnings
- PPR (`cacheComponents: true`) conflicts with cookie-based consent checks — currently disabled (see `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`)
- OTA updates cannot deliver native module changes — new EAS build required (see `docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`)
