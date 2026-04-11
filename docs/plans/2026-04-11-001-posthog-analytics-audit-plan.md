# PostHog Analytics Audit & Improvement Plan

**Date:** 2026-04-11
**Scope:** `apps/mobile` (Expo 54) + `apps/web` (Next.js 16 App Router) + `apps/api` (NestJS)
**PostHog project:** EU cloud (`https://eu.i.posthog.com`), project 155556

---

## Executive Summary

MotoVault has **strong event coverage on mobile** (50+ custom events, centralized `analytics.ts` registry, typed event names, ride/trip/maintenance/subscription funnels) but **four critical gaps** that should be fixed before acting on any of the data:

| # | Issue | Severity | Surface |
|---|---|---|---|
| 1 | **Web App Router has no `$pageview` tracking** | 🔴 P0 | web |
| 2 | **Web PostHog is not gated by cookie consent** (GDPR) | 🔴 P0 | web |
| 3 | **Email PII leaked into `posthog.identify`** on web | 🔴 P0 | web |
| 4 | **Default PostHog host in code/`.env.example` is US**, but prod is on EU | 🟠 P1 | mobile |

Once those are fixed, the rest is enrichment: server-side revenue events via the RevenueCat webhook, person properties on identify, and closing the ~12 missing product events below.

---

## 1. Current State — Mobile (`apps/mobile`)

### Strengths
- `apps/mobile/src/lib/analytics.ts` centralizes PostHog + Sentry with a typed `AnalyticsEvent` registry (~50 constants).
- `posthogClient` is eagerly initialized and fed into `<PostHogProvider>` in `apps/mobile/src/app/_layout.tsx:397`.
- `identifyUser` / `resetUser` are wired to Supabase `onAuthStateChange` (`_layout.tsx:246`).
- `trackScreen(pathname)` fires on every route change (`_layout.tsx:220`).
- Privacy screen at `apps/mobile/src/app/(tabs)/(profile)/privacy.tsx` toggles `posthog.optIn/optOut` and is synced from server preferences.
- ATT prompt is requested before Meta SDK init (`_layout.tsx:281`).
- Sentry errors carry `Sentry.setUser({ id })`.

### Mobile gaps

| # | Severity | File:Line | Issue |
|---|---|---|---|
| M1 | 🟠 P1 | `apps/mobile/src/lib/analytics.ts:18`, `apps/mobile/app.config.ts:171`, `apps/mobile/.env.example:18` | Default host is `https://us.i.posthog.com`. Prod sends to EU. Any env/dev without the override silently ships events to the wrong region → GDPR risk + split datasets. |
| M2 | 🟡 P2 | `_layout.tsx:220` (`trackScreen`) | Screen tracking uses raw `pathname`. Dynamic routes (`/bike/[id]`, `/article/[slug]`) explode into hundreds of unique screens. Normalize to route pattern (`/bike/:id`). |
| M3 | 🟡 P2 | `analytics.ts:89` `identifyUser` | Only sets `distinctId`, no person properties. Cannot cohort by plan, bike count, platform, locale. |
| M4 | 🟡 P2 | `analytics.ts:28` `analyticsEnabled = true` | Default is opt-IN before the user ever sees the privacy screen. EU users should be opt-out by default until they see the Privacy screen or onboarding consent prompt. Currently the Privacy screen syncs AFTER first mount, so initial boot events fire regardless. |
| M5 | 🟡 P2 | `analytics.ts:22` `enableSessionReplay: false` | Session replay is disabled everywhere. Biggest qualitative UX signal you're leaving on the table. Needs proper masking before enabling. |
| M6 | 🟡 P2 | `_layout.tsx:290` Meta SDK | `Settings.initializeSDK()` runs unconditionally before ATT result is known on Android (fine) and before analytics consent is checked (not fine). |
| M7 | 🟢 P3 | — | No `posthog.feature_flag` usage anywhere. No A/B tests possible. |
| M8 | 🟢 P3 | `trip-share-sheet.tsx:119,132` | `TRIP_SHARED` fires with `method`. Good. But `RIDE_SHARED` fires twice in `ride-summary.tsx:199` and again on `ride-detail.tsx:200` without a `method` prop — hard to distinguish surfaces. |

### Mobile — missing events (product gap)

These actions happen in the app but aren't instrumented:

- `fuel_log_added` — fuel tracking flow (TODO 105 references it).
- `reminder_set`, `reminder_triggered`, `reminder_tapped` — MOT-139 reminder rework has no write path yet; add events when it lands.
- `photo_added` — expense / bike / receipt photo uploads.
- `notification_opened`, `notification_action_tapped` (Mark Done / Snooze) — `_layout.tsx:352` handles these silently.
- `deep_link_opened` — share-link arrivals into the app.
- `recalls_viewed` — NHTSA recalls screen.
- `search_performed` — any search bar.
- `feed_post_viewed`, `kudos_given` — mobile has no kudos event (web does).
- `follow_added`, `follow_removed`.
- `subscription_renewed`, `subscription_cancelled` — currently only `purchase_completed` at click time; real lifecycle events come from RevenueCat webhooks server-side.
- `retention_offer_shown`, `retention_offer_accepted` — RevenueCat retention offers skill is configured; wire it up.

---

## 2. Current State — Web (`apps/web`)

### Strengths
- Initialized via `apps/web/instrumentation-client.ts` (Next.js 15.3+ pattern). ✓
- Reverse proxy `/ingest` rewrites configured in `apps/web/next.config.ts:28-37` (survives ad blockers). ✓
- `capture_exceptions: true` for error monitoring. ✓
- EU host. ✓
- Auth events present in `login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`.

### Web gaps

| # | Severity | File:Line | Issue |
|---|---|---|---|
| W1 | 🔴 **P0** | `apps/web/src/app/layout.tsx` (missing) | **Next.js App Router does NOT auto-capture pageviews on soft navigation.** `instrumentation-client.ts` initializes PostHog but nothing hooks `usePathname`/`useSearchParams` to fire `$pageview`. **Result: every funnel on web is broken.** Need a `<PostHogPageView />` client component mounted in the root layout that calls `posthog.capture('$pageview', { $current_url })` on pathname change. |
| W2 | 🔴 **P0** | `apps/web/src/components/analytics-consent.tsx:13` | `AnalyticsWithConsent` only gates **Google Analytics**. PostHog is initialized unconditionally in `instrumentation-client.ts` and fires events for every EU visitor without consent. **GDPR violation.** Fix: init PostHog with `opt_out_capturing_by_default: true, persistence: 'memory'`, then call `posthog.opt_in_capturing()` from the accept handler in `cookie-consent.tsx:27`. |
| W3 | 🔴 **P0** | `login/page.tsx:36`, `signup/page.tsx:41`, `signup/page.tsx:46` | `posthog.identify(userId, { email })` — email is PII. Mobile doesn't do this; web does. Either drop the email property or hash it. Keep distinct_id = user id only. |
| W4 | 🟠 P1 | — | No `posthog.reset()` on sign-out anywhere. Logout → next anonymous visit keeps prior `distinct_id` → broken sessionization and merged anonymous + identified traffic. Hook into Supabase `signOut` (e.g. in `apps/web/src/components/marketing/navbar.tsx:68`). |
| W5 | 🟠 P1 | — | No typed event name registry — raw strings across 8 files. Typo risk. Create `apps/web/src/lib/analytics.ts` mirroring mobile's pattern. |
| W6 | 🟠 P1 | `apps/api/src/modules/webhooks/revenuecat.service.ts` | No `posthog-node` usage in the API. Subscription *lifecycle* events (renewal, cancellation, billing failure, grace period) exist on the RevenueCat webhook but never reach PostHog. This is where retention/LTV insights live. |
| W7 | 🟡 P2 | — | No pageview tracking → no blog-post funnel. Previously had `blog-view-tracker.tsx`; it was removed in the merge with main. Replace with a generic `<PostHogPageView />` + a per-blog-post `blog_post_viewed` capture. |
| W8 | 🟡 P2 | — | No session replay. |
| W9 | 🟡 P2 | — | No feature flag usage for marketing A/B. |
| W10 | 🟡 P2 | — | No `PostHogProvider` wrapping the app. Direct `import posthog from 'posthog-js'` works but no `usePostHog()` hook for client components; the upstream Next.js pattern recommends a provider. |

### Web — missing events
- `$pageview` (critical — see W1)
- `blog_post_viewed { slug, locale, reading_time }`
- `cta_clicked { location, label }` — beyond hero app-download
- `sign_up_completed` (web has `sign_up_submitted` but no success-side event distinct from error)
- `signup_started` (form focus)
- `newsletter_submitted`
- `tool_opened { tool: 'cost_calculator' | 'tclocs' }`

---

## 3. Privacy & Compliance Review

| # | Risk | Severity | Where |
|---|---|---|---|
| P1 | PostHog fires for all EU web visitors without consent | 🔴 High | web — see W2 |
| P2 | Email PII attached to PostHog person profiles | 🔴 High | web — see W3 |
| P3 | Mobile analytics default-on before first open of Privacy screen | 🟠 Medium | mobile — see M4 |
| P4 | Default host mismatch (US fallback) risks sending events to wrong region | 🟠 Medium | mobile — see M1 |
| P5 | ATT prompt does not explicitly cover PostHog identification | 🟢 Low | mobile. PostHog is typically exempt (first-party product analytics, no cross-app tracking), but document the decision in the privacy policy. |
| P6 | Cookie banner copy mentions "analytics and advertising" but not PostHog by name | 🟢 Low | `cookie-consent.tsx:73`. Not strictly required, but list sub-processors in the privacy policy. |
| P7 | Session replay is off (no PII in recordings right now) | 🟢 Low | — |

---

## 4. Event Taxonomy — target state

### Person properties (set via `identify` / `$set`)
On sign-in, set:
```
plan:                  'free' | 'pro'
platform:              'ios' | 'android' | 'web'
locale:                string
country:               (auto from IP)
bike_count:            number
has_active_subscription: boolean
signup_method:         'email' | 'google' | 'apple'
created_at:            ISO date
pro_since:             ISO date | null
```
Update `bike_count` and `has_active_subscription` whenever those mutations succeed.

### Core funnels to monitor
1. **Onboarding**: `user_signed_up → onboarding_started → onboarding_completed → garage_bike_added`
2. **First ride**: `garage_bike_added → ride_started → ride_completed`
3. **Subscription**: `paywall_viewed → purchase_started → purchase_completed → subscription_renewed` (server)
4. **Retention churn save**: `subscription_cancel_requested → retention_offer_shown → retention_offer_accepted`
5. **Trip share attribution**: `trip_shared → (web) $pageview(/t/:token) → trip_share_opened → user_signed_up`
6. **Diagnostics**: `diagnostic_started → diagnostic_completed → article_viewed`
7. **Activation** (7-day): unique users hitting ≥1 of {ride_completed, maintenance_task_completed, expense_added, fuel_log_added}

### Groups (PostHog group analytics)
Optional but recommended: use `group_type: 'motorcycle'` keyed on motorcycle_id for per-bike retention & maintenance cadence analysis.

---

## 5. Workstreams — prioritized

### 🔴 Phase 0 — Compliance & correctness (do first)

**W1. Fix web pageview tracking.** ~30 min.
- Create `apps/web/src/components/posthog-pageview.tsx` (client component):
  ```tsx
  'use client';
  import { usePathname, useSearchParams } from 'next/navigation';
  import posthog from 'posthog-js';
  import { useEffect } from 'react';

  export function PostHogPageView() {
    const pathname = usePathname();
    const search = useSearchParams();
    useEffect(() => {
      if (!pathname) return;
      const url = search?.toString() ? `${pathname}?${search}` : pathname;
      posthog.capture('$pageview', { $current_url: window.location.origin + url });
    }, [pathname, search]);
    return null;
  }
  ```
- Mount in `apps/web/src/app/layout.tsx` (wrap in `<Suspense>` because of `useSearchParams`).
- Reference: PostHog Next.js App Router docs (fetch via context7 `/posthog/posthog-js` → "Next.js App Router pageview").

**W2. Gate PostHog behind cookie consent.** ~1h.
- Update `instrumentation-client.ts`:
  ```ts
  posthog.init(TOKEN, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    opt_out_capturing_by_default: true, // NEW
    persistence: 'memory', // NEW — until consent
  });
  ```
- In `cookie-consent.tsx` `accept()` handler: call `posthog.opt_in_capturing()` and then `posthog.set_config({ persistence: 'localStorage+cookie' })`.
- In `deny()` handler: `posthog.opt_out_capturing()`.
- Move `AnalyticsWithConsent` to also conditionally init PostHog alongside GA.

**W3. Drop email from identify (web).** ~15 min.
- `login/page.tsx:36` → `posthog.identify(data.user.id)` (no properties).
- Same for `signup/page.tsx:41,46`.
- Set non-PII person properties (plan, signup_method) via a follow-up `posthog.setPersonProperties({...})` call after the Supabase profile query returns.

**W4. Call `posthog.reset()` on web sign-out.** ~15 min.
- Find Supabase `signOut` calls in `apps/web/src` (likely in `navbar.tsx` or an account menu); after the call, invoke `posthog.reset()`.

**M1. Align mobile PostHog host defaults to EU.** ~10 min.
- `apps/mobile/src/lib/analytics.ts:18` — change fallback to `'https://eu.i.posthog.com'`.
- `apps/mobile/app.config.ts:171` — same.
- `apps/mobile/.env.example:18` — same.

**M4 + P3. Mobile consent default.** ~30 min.
- On first launch (no `preferences.privacy` yet), default `analyticsEnabled` to **`false`** for users whose `country` (from Supabase geolocation or device locale) is in EEA/UK, otherwise `true`. Show an explicit consent card in onboarding step 1.
- Persist the choice in `meQuery.data.me.preferences.privacy` and keep the Privacy screen as the after-the-fact control.

### 🟠 Phase 1 — Enrichment (high leverage)

**W6. Server-side subscription lifecycle events via RevenueCat webhook.** ~3h.
- Install `posthog-node` in `apps/api`.
- Create `apps/api/src/modules/analytics/posthog.service.ts` with `capture({ distinctId, event, properties })`.
- In `apps/api/src/modules/webhooks/revenuecat.service.ts`, map RC event types to PostHog events:
  - `INITIAL_PURCHASE` → `subscription_started`
  - `RENEWAL` → `subscription_renewed`
  - `CANCELLATION` → `subscription_cancel_requested`
  - `EXPIRATION` → `subscription_expired`
  - `BILLING_ISSUE` → `subscription_billing_issue`
  - `PRODUCT_CHANGE` → `subscription_plan_changed`
- Include `product_id`, `price_in_purchased_currency`, `period_type`, `store`.

**M3. Mobile person properties.** ~1h.
- Expand `identifyUser(userId)` → `identifyUser(user, properties)` and pass `{ plan, locale, platform, country, bike_count, pro_since }` from the `me` query.
- Call `posthog.setPersonProperties(...)` also from:
  - `add-bike.tsx` on success → `$set: { bike_count: newCount }`
  - `upgrade.tsx` purchase complete → `$set: { plan: 'pro', pro_since: now }`

**W5. Typed event registry on web.** ~1h.
- Mirror `apps/mobile/src/lib/analytics.ts`: create `apps/web/src/lib/analytics.ts` exporting `AnalyticsEvent` constants and a thin `trackEvent(name, props)` wrapper that checks consent before calling `posthog.capture`.
- Refactor the 8 call sites to use it.

**W7. Blog post view tracking.** ~30 min.
- In `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`, add a small client child component that fires `blog_post_viewed` with `{ slug, locale, reading_time_estimate }` once on mount.

**M2. Normalize mobile screen names.** ~30 min.
- In `_layout.tsx:220`, replace raw `pathname` with a normalized route (use `segments.join('/')` or pattern-match `[id]` / `[slug]` back to `:id` / `:slug`). Pass the original ids as properties.

**Close product event gaps.** ~4h distributed.
- Instrument the missing events listed in §1/§2 above (fuel log, reminders, photos, notifications, deep links, follows, feed posts, web tool events). Each is a 3-line change.

### 🟡 Phase 2 — Qualitative & growth (optional, high value)

1. **Enable PostHog session replay on mobile** with `maskAllInputs: true`, `maskAllImages: true`. Whitelist non-sensitive screens. Reference: `posthog-react-native` session replay docs.
2. **Enable session replay on web** with `session_recording: { maskAllInputs: true }`. Exclude `/login`, `/signup`, `/admin`.
3. **Feature flags.** Wire one kill-switch flag (`kill_ai_diagnostics`) and one experiment (`hero_copy_variant`) to validate the plumbing.
4. **Group analytics** — register groups on motorcycle_id for per-bike cohort analysis.
5. **PostHog dashboards**: build four dashboards aligned with the funnels above. Already have some (see `apps/mobile/posthog-setup-report.md`).

---

## 6. Acceptance checklist

Phase 0 is complete when:

- [ ] Opening a web page in a private window with no consent cookie → **zero** PostHog network requests to `/ingest`
- [ ] Clicking "Accept" → PostHog fires `$pageview` on every subsequent route change
- [ ] Clicking "Decline" → no PostHog events for the rest of the session, persisted across reload
- [ ] `posthog.identify` calls pass only `user.id` (grep confirms no `email:` property)
- [ ] Signing out → `posthog.reset()` invoked, next anonymous pageview has a fresh `distinct_id`
- [ ] `grep -r "us.i.posthog.com" apps/mobile` → only matches are in migration/history, not in active config
- [ ] EU test device fresh install: no events sent until user toggles analytics ON in the onboarding consent card
- [ ] RevenueCat webhook test event → corresponding PostHog event visible in project 155556 within 10s

---

## 7. References (for implementation)

Use **context7** (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) to fetch current docs before implementing. Key queries:

- `posthog-js` → "Next.js App Router pageview tracking"
- `posthog-js` → "opt_out_capturing_by_default and consent"
- `posthog-node` → "capture server-side event from webhook"
- `posthog-react-native` → "identify with person properties + $set"
- `posthog-react-native` → "session replay masking"

PostHog dashboards already built (from setup reports):
- Mobile: https://eu.posthog.com/project/155556/dashboard/610133
- Web: https://eu.posthog.com/project/155556/dashboard/611941

---

## 8. What NOT to do

- **Do not** enable session replay before masking is verified on auth + payment screens.
- **Do not** store email or VIN as PostHog person properties.
- **Do not** migrate the project to a different PostHog instance — the EU project already has history.
- **Do not** roll your own consent mechanism in addition to the existing `cookie-consent.tsx` — extend it.
- **Do not** bypass the TypedDocumentNode pattern when adding server-side `posthog-node` calls; keep the analytics service in its own module so it can be mocked in tests.
