---
title: Fix web session friction — hydration mismatch (#418) + download CTA
type: fix
status: active
date: 2026-06-09
---

# 🐛 Fix web session friction — React hydration mismatch (#418) + App Store CTA

## Enhancement Summary (deepen-plan review — 2026-06-09)

Reviewed by three expert agents (frontend-races, TypeScript, simplicity). **These revisions OVERRIDE the body below where they conflict** — `/ce:work` should implement the revised approach:

**Cuts (over-engineering / test theater):**
- ❌ **Drop `initialProStatus()`** — a zero-arg function returning a constant can't read storage, so the "spy asserts getItem not called" test proves nothing. Just `export const INITIAL` and keep `useState(INITIAL)`. Real regression coverage = testing **`readCache()`** (TTL boundary, malformed JSON, missing, valid).
- ❌ **Drop the `opening` flag + spinner + 2500ms timer** in `useStoreLink`. Two reviewers: a spinner still showing "Opening…" 2.5s after the store tab already opened is *lying UI* that **re-invites the exact double-click** we're killing. The new tab opening **is** the feedback. Replace with a CSS `:active` press affordance (instant, no JS, no unmount/setState-after-unmount hazard).
- ❌ **Drop the i18n `opening` key (8 locales) + hero label-swap.** Parity, not a user need; removes locale churn + translation-fallback risk.
- ❌ **Drop the `storeLinkProps` extraction-for-testing.** href/target/rel are static constants off `STORE_LINKS`; a test asserting them tests constants against themselves. Keep `STORE_LINKS` as the single source.

**Adds (real bugs found during review):**
- ✅ **Cancellation guard in the `check()` effect** (`use-pro-status.ts`). `check()` is 4 awaits with no in-flight guard; on fast nav (/garage↔/profile — the exact error pages) it `setStatus` after unmount, and `visibilitychange` fires a *second* `check()` that can resolve out-of-order → badge flickers Upgrade→Pro→Upgrade. Add a per-effect cancellation token (supersede prior chain on visibilitychange; guard the `setStatus`). Cleanest: refactor `check()` to **return** `ProStatus` and do one guarded `setStatus` at the call site.
- ✅ **Gate the nav "Upgrade" link on `!isLoading`** (`community-nav.tsx:77` — confirmed it currently is NOT). Otherwise every first paint shows "Upgrade", flashing an upsell at paying users for one tick on every navigation. Pull `isLoading` from `useProStatus`; render the upgrade slot only when `!isLoading && !isPro && !isTrialing`.

**Typing / convention tightening (no magic strings — repo rule):**
- `StorePlatform` (`'ios'|'android'`) hoisted to one shared `as const` (currently duplicated across `store-buttons.tsx` + `analytics.ts`).
- `trackAppStoreClick(platform, location?: StoreLocation)` where `StoreLocation` is an `as const` union (`cta`/`hero`/`feature_cta`), not a bare `string`. Promote `APP_STORE_CLICK` to a typed event in `WebEventProperties`.
- `useStoreLink` routes through `trackAppStoreClick` (not inlined `trackEvent`); `cta-section.tsx` uses `<ExternalLink>`.

**Revised test set (all `*.test.ts`, jsdom where needed — no new devDeps):** `readCache` (valid/expired/malformed/missing) + `trackAppStoreClick` payload (mock `trackEvent`). Drop the `initialProStatus` and `storeLinkProps` tests.

Net effect: ~40% less surface area, removes test theater + a lying-UI spinner, and **fixes two additional real defects** (the `check()` race and the Pro-user upsell flash) on the same pages.

---

## Overview

PostHog session replays + `$exception` data surfaced two distinct friction sources on the public web app. This plan confirms both root causes, locks in the (already-drafted) fixes, reconciles them with existing repo conventions discovered during research, and — most importantly — adds **regression tests** that fit the repo's actual test harness without dependency bloat.

Both fixes already exist in the working tree (typecheck + lint + 58 tests passing). This plan exists to validate the approach against Next.js 16 / React 19 best practices, harden it against the conventions the first draft missed, and add the tests that prove the bugs stay fixed.

## Problem Statement / Motivation

### Friction A — React hydration mismatch (minified error #418)
Real `$exception` events (host `motovault.app`, last 30d):

| Page | Error | Count |
|---|---|---|
| `/garage` | React #418 (hydration mismatch) | 4 |
| `/profile` | React #418 | 2 |
| `/profile/edit` | React #418 | 1 |

**Root cause:** `apps/web/src/hooks/use-pro-status.ts:122` read `sessionStorage` inside the `useState` lazy initializer:
```ts
const [status, setStatus] = useState<ProStatus>(() => readCache() ?? INITIAL);
```
On the server there is no `sessionStorage` → `readCache()` returns `null` → `INITIAL` (`isLoading:true`, `isPro:false`). On a returning client with a warm 5-min cache, the **first** client render reads the cache → `isPro:true`. The shared `community-nav.tsx` (rendered on all three routes) renders **"Upgrade"** (`!isPro`) vs a **Crown "Pro" badge** (`isPro`) — so server HTML and first client render diverge → React #418. React discards the server tree and re-renders → visible flicker, which is the friction behind the reported confusion. Intermittent counts match: only warm-cache returning users hit it.

> Note: a prior design doc (`docs/plans/2026-05-07-001-feat-web-pro-status-hook-and-gated-ui-plan.md:342`) asserted "Hook is `'use client'` — server components unaffected." That is the misconception that caused this bug: **`'use client'` components still server-render during hydration.**

### Friction B — App Store / download CTA drop-off
Session replays: users **double-click** the "App Store" link (uncertainty — no feedback the click registered) and **abandon** after the tab navigates away from the landing page.

**Root cause:** every store CTA was a bare `<a href>` that navigated the **whole tab** to the store with **zero click feedback** and (on the homepage hero) **no click tracking at all** — the PostHog audit (`docs/PostHog-Audit-2026-05-30.md:144`) flags `app_store_click` as nearly dark (~1 user), so the acquisition funnel is unobserved.

## Proposed Solution

### Fix A — deterministic first render in `useProStatus`
Initialize state to `INITIAL` on **both** server and client; apply the cached value **after mount** (the existing `check()` already reads the cache first, so warm-cache users still skip the loading flash — one tick later, post-hydration). This is the canonical React/Next pattern (see Sources: context7 `/vercel/next.js` "preventing-flash-before-hydration"). The heavier inline-script + `suppressHydrationWarning` pattern is **not** warranted for a nav badge (a one-tick update is acceptable; no FOUC concern).

For **testability**, extract the initializer into a pure function so the "no storage read on first render" invariant is enforceable by a unit test:
```ts
// apps/web/src/hooks/use-pro-status.ts
export const INITIAL: ProStatus = { isPro: false, isTrialing: false, trialDaysLeft: null, isLoading: true };
/** Deterministic first-render state — MUST NOT touch sessionStorage (would desync SSR → React #418). */
export function initialProStatus(): ProStatus {
  return INITIAL;
}
// ...
const [status, setStatus] = useState<ProStatus>(initialProStatus);
```
Keep the existing `try/catch` guards in `readCache`/`writeCache`/`clearProStatusCache` (private-browsing safety).

### Fix B — `useStoreLink` hook + convention reconciliation
A shared `useStoreLink(platform, location)` hook (already drafted in `store-buttons.tsx`):
- opens the store in a **new tab** (`target="_blank" rel="noopener noreferrer"`) so the landing page stays put,
- tracks the click,
- exposes an `opening` flag so callers can show a loading state.

`StoreButtons` (used by `feature-cta.tsx`, incl. `/es/features/ai-diagnostics`) shows a **spinner + "Opening…"** on click. `hero.tsx` uses the hook (gaining the click tracking it never had).

**Reconcile with conventions found in research (changes vs the current draft):**
1. **Analytics:** route tracking through the existing helper rather than raw `trackEvent`. Extend it to carry the funnel dimension the audit wants:
   ```ts
   // apps/web/src/lib/analytics.ts:144
   export function trackAppStoreClick(platform: 'ios' | 'android', location?: string) {
     trackEvent(WebEvent.APP_STORE_CLICK, location ? { platform, location } : { platform });
   }
   ```
   `useStoreLink` calls `trackAppStoreClick(platform, location)` instead of inlining `trackEvent`.
2. **External-link convention:** the server component `cta-section.tsx` should use the existing `<ExternalLink>` (`apps/web/src/components/marketing/external-link.tsx`, which already enforces `target=_blank rel=noopener noreferrer`) instead of hand-written `target`/`rel` attributes. Interactive buttons (hero, StoreButtons) keep the hook because they need the `opening` state; the hook's `anchorProps` encode the same `target`/`rel` contract, so behavior is consistent.
3. **No UA/platform detection** — show both App Store + Google Play badges (already satisfied; this is an explicitly rejected anti-pattern per `docs/plans/2026-03-08-feat-stunning-landing-page-plan.md` — UA detection forces dynamic rendering + CLS).
4. **Shared `STORE_LINKS` constant** — already used (no hardcoded URLs).

### Fix B2 — homepage CTA label parity (i18n)
The homepage hero currently only gets new-tab feedback. For parity with `StoreButtons`' "Opening…", add an `opening` key to the **Hero** namespace in all 8 active locales and wire the hero buttons to swap the label when `iosLink.opening` / `androidLink.opening`:
```ts
// apps/web/messages/{en,de,fr,es,it,ja,pl,pt-BR}.json  → "Hero" block, after "downloadIos"
"opening": "Opening…"   // translated per-locale
```
```tsx
// hero.tsx
<span ...>{iosLink.opening ? t('opening') : t('downloadIos')}</span>
// Google Play is a brand name — keep literal, swap only on opening:
<span>{androidLink.opening ? t('opening') : 'Google Play'}</span>
```

## Technical Considerations

- **`'use client'` ≠ server-exempt** — the core lesson; client components SSR during hydration.
- **Next.js 16 PPR is off** (`cacheComponents` disabled, see `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`) because next-intl reads cookies per request. Do not introduce per-request dynamic data; the fixes here don't.
- **Test harness reality** (`apps/web/vitest.config.ts`): `environment: 'node'`, `include: ['src/**/*.test.ts']` — **`.test.ts` only (not `.tsx`)**; per-file `// @vitest-environment jsdom` works (template: `src/lib/__tests__/meta-pixel.test.ts`). **No `@testing-library/react`/`renderHook`/declared `jsdom`.** → Tests target **pure, extracted logic** (no new devDeps); `renderHook`-style state/timer behavior is left to the browser test (LFG step 7).

## System-Wide Impact

- **Interaction graph:** `useProStatus` → consumed by `community-nav.tsx`, `garage/page.tsx`, `profile/page.tsx`. Fix changes only the *first* render value (now `INITIAL` everywhere); post-mount behavior unchanged. Nav badge updates one tick after hydration instead of during it.
- **Error propagation:** `readCache`/`writeCache` keep try/catch; private browsing still degrades to `INITIAL` → free tier. No new throw paths.
- **State lifecycle:** no persisted state changes; sessionStorage cache key (`mv_pro_status`, 5-min TTL) untouched.
- **API surface parity:** all store CTAs (hero ×2, cta-section ×2, StoreButtons via feature-cta) get consistent new-tab + tracking. `public-navbar.tsx`, `explore/app-promo.tsx`, `route/.../open-in-app-cta.tsx` also contain store links — **document as follow-up** (not in the reported sessions; out of scope for this fix but listed for parity).

## Acceptance Criteria

- [ ] `useProStatus` first render is deterministic (`INITIAL`) on server and client; no `sessionStorage` read during initial render. React #418 no longer fires on `/garage`, `/profile`, `/profile/edit`.
- [ ] Warm-cache returning users still see Pro state without a loading flash (applied post-mount via `check()`).
- [ ] All store CTAs open in a new tab and keep the landing page; clicks fire `app_store_click` with `platform` (+ `location`).
- [ ] `useStoreLink` uses `trackAppStoreClick(platform, location)`; `cta-section.tsx` uses `<ExternalLink>`.
- [ ] Homepage hero buttons show the localized "Opening…" label on click (8 locales).
- [ ] **Tests (all `*.test.ts` under `src/**/__tests__/`, `// @vitest-environment jsdom` where DOM is touched):**
  - [ ] `initialProStatus()` returns `INITIAL` **and** does not call `sessionStorage.getItem` (spy assertion) — the #418 regression lock.
  - [ ] cache logic: valid cache → parsed status `isLoading:false`; expired (> TTL) → `null`; malformed JSON → `null`; missing → `null`.
  - [ ] store-link props per platform: correct `href` (ios→appStore, android→googlePlay), `target:'_blank'`, `rel:'noopener noreferrer'`.
  - [ ] `trackAppStoreClick(platform, location)` forwards the right payload (mock `trackEvent`).
- [ ] `pnpm precheck` (lint + typecheck + test) green; no new devDependencies added.

## Success Metrics
- #418 `$exception` count on `/garage`, `/profile`, `/profile/edit` → **0** in the 7 days after deploy.
- `app_store_click` events with a `location` dimension begin populating (funnel no longer dark).
- Reduced rapid double-clicks on store CTAs in session replays.

## Dependencies & Risks
- **Risk:** extracting `initialProStatus` / cache logic must not change runtime behavior — covered by the new tests + existing 58.
- **Risk:** i18n label across 8 locales — use accurate translations of "Opening…"; low risk (transient micro-copy). If a translation is uncertain, fall back to the English string for that locale rather than blocking.
- **No new dependencies** — explicit constraint to avoid adding `@testing-library/react`/`jsdom` to `apps/web`.

## Out of Scope (documented, intentionally not fixed)
- `"Script error."` on `/`, `/compare`, `/tools/cost-calculator` (1× each) — opaque cross-origin third-party script errors; not actionable without source maps.
- `DOMException "Lock was stolen by another request"` on `/` (1×) — benign Supabase auth `LockManager` contention.
- `/es/features/ai-diagnostics` 96-clicks-in-75s — **no `$exception`**; the "console errors" were `console.error` logs. Most likely download-CTA mashing, which Fix B addresses (that page's CTA is `feature-cta` → `StoreButtons`). Re-check session replays after deploy.
- Store links in `public-navbar.tsx`, `explore/app-promo.tsx`, `route/.../open-in-app-cta.tsx` — parity follow-up, not in the reported sessions.

## MVP / Pseudocode

### apps/web/src/hooks/__tests__/use-pro-status.test.ts (jsdom)
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL, initialProStatus } from '../use-pro-status';

describe('initialProStatus (React #418 regression)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns INITIAL', () => {
    expect(initialProStatus()).toEqual(INITIAL);
    expect(initialProStatus().isLoading).toBe(true);
  });

  it('does NOT read sessionStorage during the initial render', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    initialProStatus();
    expect(spy).not.toHaveBeenCalled(); // reading here would desync SSR → #418
  });
});
// + cache round-trip / TTL / malformed / missing tests (extract readCache/writeCache or test via sessionStorage)
```

### apps/web/src/components/marketing/__tests__/store-buttons.test.ts (or store-links.test.ts)
```ts
import { describe, expect, it, vi } from 'vitest';
import { storeLinkProps } from '../store-links'; // pure helper extracted from useStoreLink

describe('storeLinkProps', () => {
  it('points iOS to the App Store, opening in a new tab', () => {
    const p = storeLinkProps('ios');
    expect(p.href).toContain('apps.apple.com');
    expect(p.target).toBe('_blank');
    expect(p.rel).toBe('noopener noreferrer');
  });
  it('points Android to Google Play', () => {
    expect(storeLinkProps('android').href).toContain('play.google.com');
  });
});
```

## Sources & References

### Origin
- PostHog session-replay friction analysis (AI chat) + `$exception` query (this session).

### Internal
- Bug site: `apps/web/src/hooks/use-pro-status.ts:122`; consumer `apps/web/src/components/community-nav.tsx:21,77,88`.
- CTA components: `apps/web/src/components/marketing/store-buttons.tsx`, `hero.tsx`, `cta-section.tsx`, `feature-cta.tsx`.
- Analytics helper: `apps/web/src/lib/analytics.ts:144` (`trackAppStoreClick`), `:30` (`APP_STORE_CLICK`).
- External-link convention: `apps/web/src/components/marketing/external-link.tsx`.
- i18n: `apps/web/src/i18n/routing.ts:6` (8 locales), messages `apps/web/messages/*.json` ("Hero" block `en.json:33`).
- Test template: `apps/web/src/lib/__tests__/meta-pixel.test.ts:1` (jsdom); harness `apps/web/vitest.config.ts`.
- Prior art / conventions: `docs/plans/2026-05-07-001-feat-web-pro-status-hook-and-gated-ui-plan.md`, `docs/homepage-redesign-plan.md:68`, `docs/plans/2026-03-08-feat-stunning-landing-page-plan.md`, `docs/PostHog-Audit-2026-05-30.md:144`, `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`.

### External (context7)
- Next.js `/vercel/next.js` — "App Router → Guides → Preventing flash before hydration": render the server value first and apply client-only (storage) values after mount; reserve inline-script + `suppressHydrationWarning` for FOUC-sensitive cases (theme), not nav state.

### Follow-up
- After fix lands, document via `/ce:compound`: "React #418 from sessionStorage in useState initializer" (no `docs/solutions/` entry names hydration/#418 yet).
</content>
</invoke>
