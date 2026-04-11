---
title: SEO Audit Implementation — 30 Action Items Across Technical, Content, Schema, GEO, Performance, Visual
type: feat
status: active
date: 2026-04-11
deepened: 2026-04-11
---

# SEO Audit Implementation — 30 Action Items

## Enhancement Summary (Deepened)

**Deepened on:** 2026-04-11
**Research agents:** framework-docs (next-intl), best-practices (Schema.org), framework-docs (web-vitals + PostHog), best-practices (GDPR cookie consent)

### Corrections applied after research
1. **`localeDetection: false` lives in `defineRouting`, not `createMiddleware`.** Added the exact next-intl v3.26+/v4 location. Confirmed static-export compatible and eliminates the `Accept-Language` 307 cascade.
2. **next-intl has no `getAlternateLinks` helper** — the recommended pattern uses `getPathname` from `@/i18n/navigation` + manual iteration over `routing.locales`. Updated Phase 1's canonical helper accordingly.
3. **Drop `WebSite.potentialAction` / `SearchAction` entirely (finding #20 → skip).** Google removed sitelinks search box support in November 2024; emitting it no longer triggers the feature and we have no `/search` page. Removing from acceptance criteria.
4. **Schema type: use `SoftwareApplication` with `operatingSystem: "iOS, ANDROID"`, NOT `MobileApplication`.** Google's Software App doc treats them as interchangeable for rich results; `SoftwareApplication` is more portable and avoids Google-Play-Games heuristic confusion.
5. **`aggregateRating` rule tightened:** only publish if the exact number is also displayed as visible text on the marked-up page, with source caption ("4.8 from X reviews — App Store + Google Play"). Otherwise skip — fabricated structured data is an explicit manual-action trigger.
6. **`FAQPage` kept for LLM/AI citation only** — confirmed zero Google rich-result benefit on commercial sites (Aug 2023 restriction still in force) but no penalty. ChatGPT/Perplexity/AI Overviews still parse it.
7. **BreadcrumbList @id must be namespaced per locale** (`#/en/breadcrumb`, `#/de/breadcrumb`) to prevent Google merging locale variants in SERP breadcrumbs.
8. **Cookie banner: bottom edge-anchored bar, NOT corner toast** — corner fails WCAG 2.4.11 on mobile and the legal equal-prominence rule (EDPB 03/2022). Three equal buttons (Reject all / Preferences / Accept all), `role="region"` with `aria-live="polite"` — NOT a modal dialog, no focus trap, no auto-focus. Only the Preferences sub-panel becomes `role="dialog" aria-modal="true"`.
9. **Persistence via first-party cookie, not localStorage** — GDPR Art. 7(1) audit requirement. Cookie format: `mv_consent=v1:rejected:{epoch}:EU`, `Max-Age=15552000` (6 months, CNIL).
10. **web-vitals v5 + `useReportWebVitals` + `web-vitals/attribution` dual pattern** — ready-to-paste component below. FID fully removed in v4; INP is the canonical interactivity metric. Sample 20% deterministically per session to control PostHog event cost.

### Key unchanged decisions (validated by research)
- Keep `localePrefix: 'as-needed'` — correct for English-default sites.
- Keep `cacheComponents: false` — PPR incompatibility with next-intl cookie reads is still open (prior learning validated).
- Use `@graph` consolidation with stable `@id` fragments for Organization/WebSite/SoftwareApplication.
- Dropped-locale handling: `next.config.ts` `redirects()` with 308 permanent — correct per next-intl docs (config redirects run before middleware).

### New findings / risks surfaced
- **R7**: `trailingSlash: true` + `localePrefix: 'as-needed'` causes double-redirects. Current Next.js default (`trailingSlash: false`) is correct — verify and lock.
- **R8**: Even with `localeDetection: false`, a request to `/en/about` (default locale *with* explicit prefix) is auto-307ed to `/about` by next-intl. Canonicalize to unprefixed for default locale everywhere.
- **R9**: `useReportWebVitals` uses the standard web-vitals build (no attribution). For INP debugging we need direct `web-vitals/attribution` imports in parallel — dual-pipeline is intentional.

## Overview

Implement all 30 findings from the 2026-04-11 MotoVault SEO audit conducted by a 7-subagent team (technical, content, schema, GEO, sitemap, performance, visual). Current SEO Health Score: **72/100** — strong fundamentals undermined by a single Critical canonical/locale mismatch that cascades into 4 other findings, plus thin compare pages and E-E-A-T gaps.

**Primary goal:** ship a single cohesive PR that fixes all Critical + High items, addresses Medium items where the data exists, and queues Low items as follow-ups. Target: score > 90 after merge.

## Problem Statement

The MotoVault web app (`apps/web`, Next.js 16 App Router, next-intl `localePrefix: 'as-needed'`) just shipped a new motorcycle trip-planning feature page. An audit revealed:

1. **Canonical/sitemap/locale mismatch** — pages declare `canonical=https://motovault.app/features/trip-planning` (un-prefixed) but that URL 307-redirects to `/en/features/trip-planning` via `Accept-Language` detection. Google indexes a canonical that then varies by browser locale → split signals, wrong-language SERPs in DE/FR/ES, CrUX data split across URL forms. This is the load-bearing bug.
2. **Trip-planning page missing from sitemap** — the whole reason for the audit.
3. **Google-Extended blocked in robots.txt** — excludes MotoVault from Google AI Overviews + Gemini grounding.
4. **Thin compare pages** (500–530 words each across 4 `vs-*` templates) — helpful-content algorithm risk.
5. **Locale cluster bloat** — sitemap declares 12 hreflang locales (`en/es/de/fr/it/pt-BR/ja/hi/th/id/tr/pl`) but only 5 ship. Contradicts Europe+Americas-only market rule.
6. **E-E-A-T ceiling** — no author bylines anywhere, stale "Last updated: March 2026" strings, stats with no attribution.
7. **No cache on marketing routes** — TTFB 1.6s on `/en`, `/ai-diagnostics`, `/cost-calculator`. Pure waste.
8. **JSON-LD gaps** — `MobileApplication` missing on trip-planning + ai-diagnostics, no `SearchAction`, no `dateModified`, `@id` graph linking broken.
9. **GEO gaps** — proper `/llms.txt` index missing (only `llms-full.txt` ships), home hero first 60 words is a tagline not an entity definition.
10. **Above-the-fold issues** — cookie banner consumes 15–25% of mobile viewport, trip-planning H1 doesn't target the money keyword, feature pages lack hero visuals.

## Chosen Approach

### Architectural decisions

**Locale strategy — keep `localePrefix: 'as-needed'` but disable auto-detect.**

Root cause of finding #1: `createIntlMiddleware` has `localeDetection: true` by default. When a browser sends `Accept-Language: en-US`, it *still* redirects `/features/trip-planning` → `/en/features/trip-planning` → which is an illegal redirect for `as-needed` mode (English must live at un-prefixed paths). Fix: set `localeDetection: false` in `apps/web/src/proxy.ts`. English default stays at `/`, other locales live at `/{locale}`, no redirects, canonical matches the served URL 1:1. This aligns sitemap, canonicals, and hreflang without rewriting any page metadata.

**Locale list — shrink to 5.**

Drop `pt-BR, ja, hi, th, id, tr, pl` from `routing.ts`. Ships only `en, de, fr, es, it` (matches existing blog MDX coverage + the Europe-Americas market policy). Sitemap `alternates.languages` auto-shrinks because it reads `routing.locales`.

**Canonical construction — use a single helper, call it everywhere.**

`getCanonicalUrl(locale, path)` already exists in `apps/web/src/lib/constants.ts:8-10`. Add `getHreflangMap(path)` that returns `{ [locale]: url, 'x-default': enUrl }` for all shipping locales. Every `generateMetadata` in `[locale]/(marketing)/**` must call both and produce:
```ts
alternates: {
  canonical: getCanonicalUrl(locale, path),
  languages: getHreflangMap(path),
}
```
No more per-page inline `Object.fromEntries` logic.

**Cache strategy — `revalidate = 3600` on marketing route segments.**

Set at the route segment level for `[locale]/(marketing)/page.tsx`, `features/[page].tsx`, `compare/**`, `tools/**`, `blog/**`. Middleware adds `s-maxage=3600, stale-while-revalidate=86400` to GET HTML responses under the `(marketing)` matcher. Skip cache for `/t/` and `/r/` share routes (already explicitly `no-store`). Skip cache for authenticated routes (`/admin`, `/account`, etc.) — they're outside the marketing group.

**JSON-LD — consolidate into `@graph` with shared constructors.**

Create `apps/web/src/lib/seo/schema.ts` exporting pure builders: `buildOrganization()`, `buildWebSite()`, `buildMobileApplication(feature?)`, `buildFAQPage(items)`, `buildBreadcrumbList(trail)`, `buildArticle(article)`. Each returns a schema fragment with stable `@id` so feature pages can reference the home `MobileApplication` via `{"@id": "https://motovault.app/#app"}`. Home page emits one `@graph` with all four. Feature pages emit one `@graph` with `BreadcrumbList + MobileApplication(feature-specific featureList) + FAQPage`.

All schema output uses the `<script type="application/ld+json">` wrapper in `apps/web/src/components/marketing/json-ld.tsx` and escapes `<` as `\u003c` per the prior solution in `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`.

**Author byline system.**

New data file `apps/web/src/lib/authors.ts` — hardcoded author records (id, name, avatarUrl, bio, credentials, socials). Ship with one author: founder. New components `apps/web/src/components/marketing/author-byline.tsx` (inline compact) and `apps/web/src/components/marketing/author-bio.tsx` (bottom-of-page full card). Blog posts get `AuthorByline` in header + `AuthorBio` at footer. Feature + compare pages get `AuthorByline` in the updated-at strip + `AuthorBio` above the FAQ. Blog `Article` JSON-LD `author` field references the Person via `@id`.

**Image strategy — reuse existing marketing assets, Gemini MCP for gaps.**

The `marketing/screenshots/` folder already contains everything we need for feature/compare heroes and "Real Trip" walkthroughs. Map:

| Page | Asset(s) from `marketing/screenshots/` |
|---|---|
| `/features/trip-planning` | `trip-planning-new.png`, `trip-planning-edit.png`, `trip-detail-hero.png`, `trip-detail-itinerary.png`, `trip-detail-full.png`, `trip-discover-feed.png` |
| `/features/ai-diagnostics` | `diagnose-hub.png`, `flow-diagnosis-step1-select-bike.png`, `flow-diagnosis-step2-symptoms.png`, `diagnostic-result.png`, `diagnostic-result-medium.png` |
| `/features/garage-management` | `garage.png`, `bike-details-hero.png`, `flow-add-bike.png`, `flow-add-maintenance.png`, `flow-add-expense.png` |
| `/features/progress-tracking` | `home-dashboard.png`, `home-rides-expenses.png`, `home-alerts-articles.png` |
| `/features/learning-paths` | `home-alerts-articles.png`, `profile.png` |
| `/en` (home hero visual) | `screenshots/desktop-above-fold.png`, `screenshots/mobile-above-fold.png`, `screenshots/showcase.png`, ASO set in `screenshots/01-*` through `04-*` |
| `/tools/cost-calculator` | (hero visual from ASO `01-track-every-expense`) |

Process: copy chosen files into `apps/web/public/screenshots/` (kebab-case, with a manifest file documenting source), import via `next/image` with `priority` + explicit width/height. File sizes: all sources are PNG — convert to WebP at build (`next/image` handles AVIF/WebP negotiation automatically) to shave LCP.

**Gemini MCP fallback** — use `mcp__gemini__generate_image` for the following only when no existing asset fits:
- Author avatar placeholder (1 image) — stylized motorcycle rider portrait
- vs Rever / vs Calimoto / vs RideLog "comparison card" hero illustrations (3 images) — stylized side-by-side app cards avoiding trademark infringement (no real competitor logos)
- Any missing entity-definition hero on `/en` if `desktop-above-fold.png` doesn't meet quality bar

Never fabricate screenshots of competitor products; use stylized neutral illustrations.

### Content strategy

**Compare pages padding (finding #4).** Target: 900+ words each. Add per page:
- Dated test preamble: "Tested April 2026 on iOS 18.3 / [Competitor] v[x.x]"
- Pricing table with sourced prices + date retrieved
- Feature parity matrix (15–20 rows) with citations
- "When to choose X over MotoVault" honest section (earns trust)
- Specific friction notes from hands-on use
- Disambiguation note on `vs-ridelog` (multiple apps share the name)

**Trip-planning keyword alignment (finding #5).**
- Add `<h2>` directly under hero: "Motorcycle Trip Planner for Multi-Day Routes"
- First paragraph under H2: "MotoVault's motorcycle trip planning app builds multi-day routes with typed waypoints (fuel, food, hotels, passes, ferries), turn-by-turn navigation, and rider RSVPs — all offline-capable."
- Keep existing poetic H1 ("Plan Every Mile of the Ride") and add `eyebrow` badge: "MULTI-DAY ROUTES · OFFLINE MAPS"
- Add stat strip above hero gallery: "11 waypoint types · 15–16 stops/day · 6 real-world test trips · 412 km sample route"

**Home entity definition (finding #18).**
- Rewrite `Hero.title` + `Hero.subtitle` in `messages/en.json` lines 29-38 so first 60 words contain: "MotoVault is a free iOS and Android motorcycle companion app that combines maintenance tracking, expense logging, GPS ride recording, multi-day trip planning, and AI photo diagnostics — no OBD hardware required."
- This single sentence unlocks LLM entity extraction for every AI search surface.

**AI Diagnostics source attribution (finding #23).**
- Replace bare stats with "per MotoVault internal telemetry, 2026-Q1" framing on `FeaturesDiagnostics` namespace (lines 407–467).

**updatedAt bump (stale signal).**
- Replace all 6 instances of `"Last updated: March 2026"` (en.json lines 717, 873, 961, 1052, 1101, 1150) with `"Last updated: April 2026"`.
- Translate to de/fr/es/it equivalents.
- Add git-commit-driven `dateModified` to blog `Article` schema.

**Prior learning — Next.js 16 PPR gotcha.**

Per `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`, Next.js 16 `cacheComponents: true` (PPR) breaks routes because next-intl reads cookies per-request. Current `next.config.ts` has `cacheComponents: false` — DO NOT flip this. Use route-segment `revalidate` instead of PPR.

**Prior learning — CSP + JSON-LD.**

Per `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`:
- Gate `'unsafe-eval'` via `NODE_ENV` in CSP builder (currently correct — proxy.ts:57-82 uses `isDevelopment` flag). Just verify the localhost leak (audit H2) is actually in `connect-src` and strip it.
- Every JSON-LD block must escape `<` as `\u003c`. The existing `json-ld.tsx` wrapper does this — ensure all new schema builders route through it.

## Technical Approach

### Phase 1 — Infrastructure (Critical + core High)

**1.1 Locale fix (findings #1, #10, #13)**

Files to edit:

- `apps/web/src/i18n/routing.ts` — trim `locales` and **add `localeDetection: false` directly to `defineRouting`** (per next-intl docs, it lives on routing config, not on `createMiddleware`):

  ```ts
  import { defineRouting } from 'next-intl/routing';

  export const routing = defineRouting({
    locales: ['en', 'de', 'fr', 'es', 'it'] as const,
    defaultLocale: 'en',
    localePrefix: 'as-needed',
    localeDetection: false, // ignore Accept-Language + NEXT_LOCALE cookie
  });
  ```

- `apps/web/src/proxy.ts` — no functional change required here; `createMiddleware(routing)` consumes the flag automatically. Verify the matcher still excludes `api|_next|_vercel|.*\\..*`.
- `apps/web/messages/` — verify only `{en,de,fr,es,it}.json` exist; delete leftover locale files (`pt-BR.json`, `ja.json`, etc.) if present. Non-English files must mirror `en.json` structure to avoid i18n-missing-keys CI failure (see `docs/solutions/integration-issues/i18n-missing-keys-ci-failure.md`). Placeholder English copy in de/fr/es/it is acceptable for first merge — queue real translations as a follow-up task.
- `apps/web/src/lib/constants.ts` — add `getHreflangMap(path)` helper:

  ```ts
  import { getPathname } from '@/i18n/navigation';
  import { routing } from '@/i18n/routing';

  export function getHreflangMap(href: string): Record<string, string> {
    const languages = Object.fromEntries(
      routing.locales.map((l) => [l, BASE_URL + getPathname({ locale: l, href })]),
    );
    return {
      ...languages,
      'x-default': BASE_URL + getPathname({ locale: routing.defaultLocale, href }),
    };
  }
  ```

- All `generateMetadata` functions under `[locale]/(marketing)/**` use:

  ```ts
  alternates: {
    canonical: getCanonicalUrl(locale, path),
    languages: getHreflangMap(path),
  }
  ```

- `apps/web/next.config.ts` — add a 308 redirect table for the 7 dropped locales (90-day grace — queue removal task for 2026-07-11):

  ```ts
  async redirects() {
    const dropped = ['pt-BR', 'ja', 'hi', 'th', 'id', 'tr', 'pl'];
    return [
      ...dropped.flatMap((l) => [
        { source: `/${l}`, destination: '/', permanent: true },
        { source: `/${l}/:path*`, destination: '/:path*', permanent: true },
      ]),
    ];
  }
  ```

  Next.js config redirects run **before** the next-intl middleware, so these take precedence.

**Gotcha (R8)**: next-intl auto-redirects `/en/about` → `/about` because `as-needed` strips the default-locale prefix. Always construct canonicals with `getPathname({ locale: 'en', href })` (which returns the unprefixed form) — never manually `${BASE_URL}/en${path}`.

**Gotcha (R7)**: Verify `apps/web/next.config.ts` does NOT set `trailingSlash: true`. Combined with `localePrefix: 'as-needed'` it causes double-redirects (`/de/about/` → `/de/about` → `/about`). Next.js default is `false` — lock it explicitly.

Acceptance:
- `curl -I https://localhost:3000/features/trip-planning` returns 200.
- `curl -I -H 'Accept-Language: de-DE' https://localhost:3000/` returns 200 (English, not 307 to `/de`).
- `curl -I https://localhost:3000/en/about` still 307-redirects to `/about` (this is correct default-locale cleanup, not a bug).
- `curl -I https://localhost:3000/pt-BR/features/trip-planning` → 308 → `/features/trip-planning`.
- `canonical` on every marketing page === served URL.

**1.2 Sitemap + hreflang (findings #2, #16)**

File: `apps/web/src/app/sitemap.ts`
- Append to `pages[]`: `'/features'`, `'/features/trip-planning'`
- Append to `PAGE_LAST_EDITED`: `'/features': '2026-04-11'`, `'/features/trip-planning': '2026-04-11'`
- Append to `featureImages`: `'/features/trip-planning': ${host}/screenshots/trip-planning-hero.webp` (use asset copied in Phase 3)
- Blog loop: before emitting per-locale alternate, check `getArticles(locale).some(a => a.slug === article.slug)`. Only emit alternates for locales with real MDX.
- Hreflang alternates already iterate `routing.locales`, which auto-shrinks in Phase 1.1.
- Default fallback `lastModified`: bump from `'2026-03-01'` to `'2026-04-11'`.

Acceptance: `curl https://localhost:3000/sitemap.xml | grep trip-planning` returns 2+ hits (one main entry + hreflang alternates). Zero `<xhtml:link>` for `hi/th/id/ja/tr/pl/pt-BR`.

**1.3 Robots (finding #3)**

File: `apps/web/src/app/robots.ts`
- Change `Google-Extended` from `disallow: '/'` to `allow: '/'`.
- Add explicit allow for `Applebot-Extended, Meta-ExternalAgent, Google-CloudVertexBot`.
- Keep `CCBot: disallow` (training crawl, not search).

Acceptance: `curl https://localhost:3000/robots.txt | grep -A1 Google-Extended` shows `Allow: /`.

**1.4 Middleware hardening (findings #7, #8, #24)**

File: `apps/web/src/proxy.ts`
- In `buildCspHeader` (lines 57-82): grep for `127.0.0.1` and strip entirely from the production branch. Keep in dev branch if required for Supabase local.
- In `applySecurityHeaders` (lines 84-91): add for matcher paths under `(marketing)`:
  ```ts
  if (isMarketingPath(pathname) && !isShareLink) {
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }
  ```
- Ensure `NEXT_LOCALE` cookie is NOT set unless user explicitly switches locale (look for `response.cookies.set('NEXT_LOCALE', ...)`). If next-intl sets it unconditionally, wrap with an intent check.
- Verify HSTS already includes `includeSubDomains; preload` (audit L1 said robots.txt/sitemap.xml were missing it — extend the HSTS branch to apply unconditionally, not just to HTML responses).

**1.5 next.config.ts (finding #21)**

File: `apps/web/next.config.ts`
- Add top-level `poweredByHeader: false`.

Acceptance: `curl -I https://localhost:3000/` no longer returns `x-powered-by: Next.js`.

### Phase 2 — JSON-LD consolidation (findings #9, #26, #30 — #20 dropped)

**Finding #20 (WebSite.potentialAction / SearchAction) is now SKIPPED** — Google removed sitelinks search box support in November 2024 and archived `nositelinkssearchbox`. Emitting SearchAction no longer triggers the feature and adding a fake URL template would be inaccurate structured data.

**2.1 Create schema builders**

New file: `apps/web/src/lib/seo/schema.ts` — exports:

```ts
// Pure builders, each returns a plain object ready for @graph inclusion.
// Stable @ids: https://motovault.app/#org, #website, #app
// Uses SoftwareApplication (NOT MobileApplication) per Google's Software App doc.

export function buildOrganization(): Organization { /* ... */ }
export function buildWebSite(locale: string): WebSite { /* NO potentialAction */ }
export function buildSoftwareApplication(feature?: FeatureContext): SoftwareApplication {
  return {
    '@type': 'SoftwareApplication',
    '@id': 'https://motovault.app/#app',
    name: 'MotoVault',
    operatingSystem: 'iOS, ANDROID',
    applicationCategory: 'TravelApplication',
    applicationSubCategory: feature?.subCategory ?? 'Motorcycle',
    url: 'https://motovault.app/',
    publisher: { '@id': 'https://motovault.app/#org' },
    downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: feature?.featureList,
    // aggregateRating omitted unless real visible count passed in
  };
}
export function buildFAQPage(items: FaqItem[]): FAQPage { /* ... */ }
export function buildBreadcrumbList(trail: Crumb[], locale: string): BreadcrumbList {
  // IMPORTANT: @id namespaced per locale to prevent SERP breadcrumb merging
  return { '@id': `https://motovault.app/#/${locale}/breadcrumb`, /* ... */ };
}
export function buildArticle(article: BlogArticle): Article { /* with dateModified */ }
export function buildProfilePage(user: PublicRider): ProfilePage { /* ... */ }
```

New file: `apps/web/src/components/marketing/json-ld-graph.tsx` — wrapper that emits `{"@context": "https://schema.org", "@graph": [...]}` in a single `<script type="application/ld+json">` tag. Escapes `<` as `\u003c` per `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`.

**2.2 Update home** (`apps/web/src/app/[locale]/(marketing)/page.tsx:36-134`)

Replace 4 separate `<JsonLd>` blocks with one `<JsonLdGraph>` containing:
- `Organization` (`@id: #org`, logo, sameAs links to socials + stores)
- `WebSite` (`@id: #website`, publisher refs Organization, inLanguage, **NO potentialAction**)
- `SoftwareApplication` (`@id: #app`, operatingSystem "iOS, ANDROID", refs Organization as publisher)
- `FAQPage` (`@id: #faq`, isPartOf refs website, about refs app)

**aggregateRating rule:** only include in `SoftwareApplication` if both:
1. Real combined App Store + Google Play review count is available (pulled from App Store Connect / Play Console APIs or hand-sourced)
2. The same number is displayed as **visible text** on the home page (e.g., a trust strip "4.8 stars · 412 reviews · App Store + Google Play")

If either condition fails — **omit entirely**. Fabricated aggregateRating is an explicit manual-action trigger.

**2.3 Feature pages** — edit:
- `apps/web/src/app/[locale]/(marketing)/features/trip-planning/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/ai-diagnostics/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/garage-management/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/learning-paths/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/progress-tracking/page.tsx`

Each emits `<JsonLdGraph>` with:
- `WebPage` (`@id: #/{locale}/features/{slug}`, `isPartOf: { "@id": "https://motovault.app/#website" }`, `about: { "@id": "https://motovault.app/#app" }`, `inLanguage: locale`) — **do NOT redeclare Organization/SoftwareApplication**, reference them by `@id`
- `BreadcrumbList` (`@id: #/{locale}/features/{slug}/breadcrumb` — namespaced per locale)
- `FAQPage` (`@id: #/{locale}/features/{slug}/faq`)

This is the Google-rewarded consolidation pattern: one graph per site, sub-pages reference, never redefine.

**2.4 Blog Article dateModified (finding #22)**

File: `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx:136-177`
- Replace inline `BlogPosting` with `buildArticle(article)` call
- `dateModified` logic: prefer `article.dateModified` frontmatter; fallback to git commit date via a build-time script (`scripts/blog-dates.ts` that reads `git log -1 --format=%cI <file>` and emits a JSON map at build). Add to `pnpm build` turbo task.

### Phase 3 — Content + visuals (findings #4, #5, #6, #11, #17, #18, #19, #23, #29)

**3.1 Copy marketing screenshots into `apps/web/public/screenshots/`**

```bash
mkdir -p apps/web/public/screenshots
cp marketing/screenshots/{trip-planning-new,trip-planning-edit,trip-detail-hero,trip-detail-itinerary,trip-detail-full,trip-discover-feed}.png apps/web/public/screenshots/
cp marketing/screenshots/{diagnose-hub,flow-diagnosis-step1-select-bike,flow-diagnosis-step2-symptoms,diagnostic-result,diagnostic-result-medium}.png apps/web/public/screenshots/
cp marketing/screenshots/{garage,bike-details-hero,flow-add-bike,flow-add-maintenance,flow-add-expense}.png apps/web/public/screenshots/
cp marketing/screenshots/{home-dashboard,home-rides-expenses,home-alerts-articles,profile}.png apps/web/public/screenshots/
cp screenshots/{desktop-above-fold,mobile-above-fold,showcase}.png apps/web/public/screenshots/
```

Add `apps/web/public/screenshots/README.md` documenting source + license.

**3.2 Trip-planning page (findings #5, #9, #17)**

File: `apps/web/src/app/[locale]/(marketing)/features/trip-planning/page.tsx`
- Add H2 + intro paragraph below hero with target keywords (see "Content strategy" above).
- Add stat strip component above the gallery.
- Replace placeholder images with real `next/image` components pointing at `/screenshots/trip-planning-*`.
- First gallery image gets `priority` prop for LCP.

Messages: `apps/web/messages/en.json` — `FeaturesTripPlanning` namespace (line 1211). Add `subheading`, `introParagraph`, `statStrip` keys. Mirror in de/fr/es/it.

**3.3 Four compare pages (finding #4)**

For each of `VsRever (1095)`, `VsCalimoto (1144)`, `VsRideLog (1046)`, `CompareAlternatives (867)` namespaces in `en.json`:

- Add `testingPreamble` (1 paragraph, dated)
- Add `pricingTable` (4 columns: Feature, MotoVault, Competitor, Advantage)
- Add `parityMatrix` (15–20 rows: Feature name / MV / Competitor / Notes)
- Add `whenToChooseCompetitor` (1 paragraph — honest)
- Expand existing paragraphs by ~300 words each

Target ~1000 words per page namespace. Ridelog page adds `disambiguation` note (finding #29) clarifying which RideLog app we compare to.

Then reflect structural changes in page `.tsx` files:
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-rever/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-calimoto/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-ridelog/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/alternatives/page.tsx`

Translate to de/fr/es/it — placeholder EN content with TODO markers is acceptable for the first merge if time-constrained (create a follow-up translation task).

**3.4 Home hero entity definition (finding #18)**

File: `apps/web/messages/en.json` lines 29-38 (`Hero` namespace)
- `title`: keep brand line
- `subtitle`: rewrite to start with "MotoVault is a free iOS and Android motorcycle companion app that combines maintenance tracking, expense logging, GPS ride recording, multi-day trip planning, and AI photo diagnostics — no OBD hardware required."
- `supportingCopy`: move existing tagline here if needed for visual balance

**3.5 Hero image preload (finding #19)**

Pages needing `priority` hero images:
- `[locale]/(marketing)/page.tsx` → `/screenshots/showcase.png` or `desktop-above-fold.png`
- `[locale]/(marketing)/compare/*/page.tsx` → side-by-side hero (use Gemini MCP to generate 3 stylized VS illustrations at 1600×900)
- `[locale]/(marketing)/tools/cost-calculator/page.tsx` → use `screenshots/01-track-every-expense/` asset

Use `next/image` with `priority`, explicit `width`/`height`, `sizes` prop. Next handles AVIF/WebP negotiation.

**3.6 Cookie banner refactor (finding #11)** — REVISED per EDPB 03/2022 + WCAG 2.2 research

**Corrected from original plan:** the rewrite is a **bottom edge-anchored slim bar**, not a corner toast. Corner toasts fail WCAG 2.4.11 "Focus Not Obscured" on mobile and commonly overlap App Store badges.

File: `apps/web/src/components/cookie-consent.tsx`

**Layout**
- Mobile: `position: fixed; inset: auto 8px 8px 8px; max-height: 8vh; border-radius: 16px; border-curve: continuous;` — stays under 72px / ~8.5vh on a 390×844 viewport.
- Desktop: `max-width: 720px; left: 50%; transform: translateX(-50%); bottom: 16px; height: 64px;`
- Padding 12/16, gap 8. Stack text + buttons on viewports < 380px.

**Accessibility (NOT a modal dialog)**
- Container: `role="region"`, `aria-label="Cookie consent"`, `aria-live="polite"`. Rendered last in `<body>` so Tab order reaches it naturally — **do not trap focus, do not auto-move focus** (this is a persistent region per WAI-ARIA APG, not an alert dialog).
- Only the **Preferences sub-panel** becomes `role="dialog" aria-modal="true"` with focus trap + Esc-to-close.
- Three `<button>` elements with **identical visual weight** (same bg, padding, font-size) — Reject all / Preferences / Accept all. EDPB 03/2022 equal-prominence rule.
- Min tap target 44×44px (WCAG 2.5.8).
- Focus ring: 2px solid `palette.accent`, 2px offset (WCAG 2.4.11, 2.4.13).
- No hardcoded `#FF6B35` — import `palette` from `@motovault/design-system`.

**State machine**
```
undecided  ──Accept──▶ accepted  (persist, unmount, posthog.opt_in_capturing())
           ──Reject──▶ rejected  (persist, unmount, posthog.opt_out_capturing())
           ──Prefs───▶ preferences_open (modal sub-panel)
                          ├─Save──▶ accepted | rejected
                          └─Esc───▶ undecided
```

Hydration: read persistence in `useEffect` (not during SSR) to avoid hydration mismatch. Render `null` until resolved.

**Persistence — first-party cookie, not localStorage**

GDPR Art. 7(1) requires the ability to **demonstrate** consent, which needs a server-auditable mechanism. Cookies are sent with requests; localStorage is not.

```
Name:     mv_consent
Format:   v1:{decision}:{epoch}:{region}   e.g. "v1:rejected:1744329600:EU"
Max-Age:  15552000  (6 months, CNIL Deliberation 2020-091)
Path:     /
SameSite: Lax
Secure:   true
```

**Required first-layer copy (≤ 180 chars)**
> "We use a cookie for privacy-friendly analytics (PostHog) to improve MotoVault. No ads, no cross-site tracking. [Privacy policy]"
>
> [Reject all] [Preferences] [Accept all]

**Wire to PostHog**
- Accept → `posthog.opt_in_capturing()` + `posthog.capture('$consent_granted')`
- Reject → `posthog.opt_out_capturing()` + do not capture anything
- `posthog.init({ opt_out_capturing_by_default: true })` — set in existing `instrumentation-client.ts`

**Citations**
- EDPB Guidelines 03/2022 rev.2 (Feb 2023) — deceptive design patterns, equal prominence
- WCAG 2.2 — SC 2.4.11 Focus Not Obscured, SC 2.5.8 Target Size Minimum
- WAI-ARIA APG — Dialog pattern applies only to Preferences sub-panel
- CNIL Deliberation 2020-091 — 6-month consent lifetime, reject-all one click

**3.7 AI Diagnostics source attribution (finding #23)**

File: `apps/web/messages/en.json` — `FeaturesDiagnostics` (407–466)
- Reframe stats as "per MotoVault internal telemetry, 2026-Q1".
- Add a footnote/disclaimer paragraph.

**3.8 Author byline system (finding #6)**

New files:
- `apps/web/src/lib/authors.ts` — exports `authors` record keyed by id.
- `apps/web/src/components/marketing/author-byline.tsx` — inline (name + avatar + date).
- `apps/web/src/components/marketing/author-bio.tsx` — full card (bio, credentials, socials).

Mount on:
- Blog slug page header + footer
- Feature pages above FAQ
- Compare pages above FAQ

Gemini MCP: generate 1 author avatar (stylized portrait) if no real photo exists. Save to `apps/web/public/authors/founder.webp`.

**3.9 Feature page "Real Trip"-style examples (finding #17)**

Mirror the `walkthroughP1–P4` narrative pattern from trip-planning onto:
- `garage-management` — "Real Garage: 3 Bikes, 47 Service Records, 18 Months"
- `progress-tracking` — "Real Rider: 6,800 km, 12 rides, MoM cost-per-mile trend"
- `learning-paths` — "Real Curriculum: First-year rider completing 24 lessons"

Each with 2–3 screenshots + named context. Copy lives in respective messages namespaces.

### Phase 4 — GEO + misc (findings #12, #14, #15, #25, #27, #28)

**4.1 llms.txt index rewrite (finding #12)**

File: `apps/web/public/llms.txt` (73 lines currently — stale, malformed)

Replace with proper index:
```
# MotoVault

> Free AI-powered motorcycle companion app for iOS and Android combining maintenance tracking, expense logging, GPS ride recording, multi-day trip planning with typed waypoints, and Claude-powered photo diagnostics — no OBD hardware required.

## Core features
- [Trip Planning](https://motovault.app/features/trip-planning)
- [AI Diagnostics](https://motovault.app/features/ai-diagnostics)
- [Garage Management](https://motovault.app/features/garage-management)
- [Progress Tracking](https://motovault.app/features/progress-tracking)
- [Learning Paths](https://motovault.app/features/learning-paths)

## Comparisons
- [vs Rever](https://motovault.app/compare/motovault-vs-rever)
- [vs Calimoto](https://motovault.app/compare/motovault-vs-calimoto)
- [vs RideLog](https://motovault.app/compare/motovault-vs-ridelog)
- [Alternatives](https://motovault.app/compare/alternatives)

## Tools
- [Cost Calculator](https://motovault.app/tools/cost-calculator)
- [TCLOCS Checklist](https://motovault.app/tools/tclocs-checklist)

## Full reference
- [llms-full.txt](https://motovault.app/llms-full.txt)
```

Also bump `llms-full.txt` `Last-Updated` to 2026-04-11 and remove references to non-shipping locales.

**4.2 IndexNow (finding #14)**

- Generate UUID key, save as `apps/web/public/${key}.txt` containing the key text.
- Add `apps/web/scripts/indexnow-submit.ts` — reads `sitemap.xml`, POSTs changed URLs to `https://api.indexnow.org/indexnow`.
- Wire into deploy hook (or `postbuild` npm script gated on `CI` env).

**4.3 aggregateRating (finding #15)**

- Check App Store Connect / Play Console for real counts.
- If real counts available (>50 reviews on either store), add `aggregateRating` to home `MobileApplication` with sourced numbers.
- **If not available — SKIP. Do not fabricate.**

**4.4 Font preload (finding #27)**

File: `apps/web/src/app/layout.tsx`
- Add `<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/fonts/[primary-weight].woff2">` in `<head>` via metadata or a dedicated `<head>` component.

**4.5 Web-vitals beacon (finding #28)** — REVISED with ready component

- `pnpm add web-vitals@^5` in `apps/web` (FID fully removed in v4; INP is canonical interactivity metric).
- Use **dual pipeline**: `useReportWebVitals` from `next/web-vitals` for Next-internal timings (hydration, route-change-to-render) AND direct `web-vitals/attribution` imports for rich CWV debugging (LCP target element, INP interactionTarget + longestScript, CLS largestShiftTarget).
- **Sample 20% deterministically per session** — CWV fires 5 metrics per session → 5x event multiplier. Deterministic sampling keeps per-session analysis valid.
- Mount once in `apps/web/src/app/layout.tsx` inside `<body>` after the PostHog provider.

New file: `apps/web/src/components/web-vitals-reporter.tsx`

```tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import {
  onCLS, onFCP, onINP, onLCP, onTTFB,
  type Metric,
} from 'web-vitals/attribution';

const SAMPLE_RATE = 0.2;

function isSampled(): boolean {
  if (typeof window === 'undefined') return false;
  const key = '__mv_wv_sampled';
  const cached = sessionStorage.getItem(key);
  if (cached !== null) return cached === '1';
  const sampled = Math.random() < SAMPLE_RATE;
  sessionStorage.setItem(key, sampled ? '1' : '0');
  return sampled;
}

type AttrMetric = Metric & { attribution: Record<string, unknown> };

function sendAttribution(metric: AttrMetric) {
  if (!isSampled()) return;
  const a = (metric.attribution ?? {}) as Record<string, any>;
  posthog.capture('web_vitals_attribution', {
    metric_name: metric.name,
    metric_value: metric.value,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    metric_id: metric.id,
    navigation_type: metric.navigationType,
    lcp_target: a.target,
    lcp_url: a.url,
    lcp_resource_load_delay: a.resourceLoadDelay,
    lcp_element_render_delay: a.elementRenderDelay,
    inp_target: a.interactionTarget,
    inp_type: a.interactionType,
    inp_input_delay: a.inputDelay,
    inp_processing_duration: a.processingDuration,
    inp_presentation_delay: a.presentationDelay,
    inp_longest_script: a.longestScript?.entry?.sourceURL,
    cls_largest_shift_target: a.largestShiftTarget,
    cls_largest_shift_value: a.largestShiftValue,
    cls_load_state: a.loadState,
    ttfb_waiting: a.waitingDuration,
    ttfb_dns: a.dnsDuration,
    ttfb_connection: a.connectionDuration,
    ttfb_request: a.requestDuration,
    path: window.location.pathname,
  });
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!isSampled()) return;
    posthog.capture('$web_vitals', {
      $web_vitals_metric: metric.name,
      $web_vitals_value: metric.value,
      $web_vitals_rating: (metric as Metric).rating,
      $web_vitals_id: metric.id,
      $web_vitals_navigation_type: (metric as Metric).navigationType,
      path: window.location.pathname,
    });
  });

  useEffect(() => {
    const cb = (m: Metric) => sendAttribution(m as AttrMetric);
    onLCP(cb);
    onINP(cb, { durationThreshold: 40 });
    onCLS(cb);
    onTTFB(cb);
    onFCP(cb);
  }, []);

  return null;
}
```

**Versions cited:** `web-vitals@^5`, `posthog-js@^1.2xx`, Next.js 16 `next/web-vitals`. The `$web_vitals` event name matches PostHog's built-in Web Vitals dashboard schema so charts work without config.

**4.6 HSTS consistency (finding #25)**

Already addressed in 1.4 — extend HSTS to all responses under matcher, not just HTML.

## System-Wide Impact

### Interaction graph
- `proxy.ts` middleware runs on every non-api/_next route → `createIntlMiddleware` (locale detect disabled) → locale-prefix rewrite → `applySecurityHeaders` → `buildCspHeader` with nonce → response.
- Route segments under `[locale]/(marketing)` get `revalidate = 3600` → ISR at the edge.
- `generateMetadata` per page calls `getCanonicalUrl` + `getHreflangMap` (both pure, no IO).
- Schema builders are pure; emission happens inside server components during RSC render.

### Error propagation
- Sitemap generation: missing locale in blog MDX check → skip alternate silently. Missing page in `PAGE_LAST_EDITED` → fallback `'2026-04-11'`.
- IndexNow submission failure → log warning, do not block deploy.
- Missing author avatar → fallback to initials.

### State lifecycle risks
- `revalidate` on marketing routes + middleware `s-maxage` — CDN caches server response. On deploy, `next build` produces new static HTML; ISR revalidation at most 1 hour behind. Acceptable for marketing copy.
- Cookie banner rework: users with existing `motovault_cookie_consent` cookie keep their choice (cookie name unchanged). New users see the smaller toast.
- Locale list shrink: users landing on a dropped locale URL (`/pt-BR/...`) will 404. Add `redirects()` in `next.config.ts` mapping dropped locale prefixes → English equivalent for 90-day grace period.

### API surface parity
- Admin routes (`/admin/*`) do NOT need cache-control (not under marketing matcher).
- API routes unchanged (middleware `api|_next|_vercel` excludes them).
- Share-link routes (`/t/`, `/r/`) unchanged — already explicit `no-store, noindex`.

### Integration test scenarios
1. Request `/features/trip-planning` with `Accept-Language: de-DE` → 200 English (was 307 to `/de/features/trip-planning`).
2. Request `/de/features/trip-planning` → 200 German with canonical `/de/features/trip-planning`.
3. Request `/sitemap.xml` → includes trip-planning + features index, only 5 locale alternates per URL.
4. Request `/robots.txt` → Google-Extended allowed.
5. Request `/en` with cookie `motovault_cookie_consent=accepted` → no banner rendered.
6. Request `/features/trip-planning` → HTTP header `Cache-Control: public, s-maxage=3600, ...`.
7. Page source on `/features/trip-planning` contains `<script type="application/ld+json">` with `"@type": "MobileApplication"` and `"@id": "https://motovault.app/#app"`.
8. Page source on `/` contains a single `@graph` script with 4 nested `@type`s.

## Acceptance Criteria

### Critical (must ship)
- [ ] `curl -I` on all Canonical URLs returns 200 (no 307 chain).
- [ ] `/features/trip-planning` + `/features` present in `sitemap.xml`.
- [ ] `robots.txt` allows `Google-Extended`.
- [ ] 4 compare page namespaces ≥ 900 words each (measured by `wc -w` on rendered HTML body text).
- [ ] Sitemap hreflang alternates list only 5 locales.

### High
- [ ] Trip-planning page H2 contains "motorcycle trip planner" + intro contains "multi-day motorcycle route planning".
- [ ] Author byline visible on every blog post and every feature/compare page.
- [ ] CSP no longer contains `127.0.0.1:54321` in prod.
- [ ] Marketing routes serve `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- [ ] `SoftwareApplication` JSON-LD (operatingSystem "iOS, ANDROID") present on trip-planning + ai-diagnostics pages, referenced by `@id` (not redeclared).
- [ ] Cookie banner max-height ≤ 8vh on 390×844 viewport; three equal buttons (Reject/Preferences/Accept); `role="region"`; persistence via `mv_consent` first-party cookie with 6-month max-age.
- [ ] `/llms.txt` contains valid index format.

### Medium
- [ ] IndexNow key file served at `/[key].txt`.
- [ ] Blog `Article` schema has `dateModified` from git or frontmatter.
- [ ] Feature pages (garage, progress, learning) have "Real X" walkthrough sections.
- [ ] Home hero `subtitle` first sentence matches entity-definition pattern.
- [ ] Hero image preloaded via `next/image priority` on home + compare + cost-calculator.
- [ ] ~~`WebSite` JSON-LD has `potentialAction` SearchAction.~~ **SKIPPED** — deprecated Nov 2024, no SEO value.
- [ ] `X-Powered-By` header absent.
- [ ] AI diagnostics stats include source attribution ("per MotoVault internal telemetry, 2026-Q1").
- [ ] `NEXT_LOCALE` cookie not written by next-intl (disabled via `localeDetection: false`).

### Low
- [ ] HSTS `includeSubDomains; preload` on all responses.
- [ ] Home JSON-LD consolidated into single `@graph`.
- [ ] Font preload `<link rel="preload" as="font">` present.
- [ ] web-vitals beacon reporting to PostHog.
- [ ] `vs-ridelog` disambiguation note present.
- [ ] `MobileApplication` `@id` linked to Organization graph on all feature pages.

### Quality gates
- [ ] `pnpm lint` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm test` passes (existing).
- [ ] Schema validated via https://validator.schema.org/ on 3 representative pages.
- [ ] PageSpeed Insights re-run on /en + /features/trip-planning (CWV after cache rollout).
- [ ] Visual diff check: cookie banner on mobile < 100px tall at 390×844.

## Dependencies & Risks

### Dependencies
- `next-intl` v3+ for `localeDetection` option (verify installed version).
- `web-vitals` package (new dependency).
- Gemini MCP access (user confirmed — for author avatar + 3 compare hero illustrations).
- App Store Connect + Play Console access (optional, for aggregateRating).

### Risks
- **R1: Locale list shrink breaks existing SEO for pt-BR/ja traffic.** Mitigation: 90-day redirect mapping in `next.config.ts`, drop redirects after.
- **R2: `localeDetection: false` changes UX for non-English browsers landing on `/`.** Mitigation: add a soft language-suggestion toast (non-redirecting) that offers the detected locale. Queue for follow-up.
- **R3: Cache on marketing routes could stale author/blog updates.** Mitigation: `revalidatePath` call in blog publish workflow. Blog is MDX → happens at build anyway, so post-deploy is fresh.
- **R4: New JSON-LD schema builders could regress rich results.** Mitigation: validate each schema via validator.schema.org before merging, keep existing schema blocks behind a feature flag for 1 deploy, then remove.
- **R5: Compare page padding content could be AI-generated and flagged as low-quality.** Mitigation: human-authored test notes, real pricing pulls with dates. No LLM slop.
- **R6: Next.js 16 PPR gotcha** — documented prior learning — must NOT enable `cacheComponents: true` or next-intl will break.

## Resource Requirements

- 1 engineer, focused.
- Phase 1 (infrastructure) — 1 day.
- Phase 2 (schema) — 0.5 day.
- Phase 3 (content + visuals) — 2 days (compare page copy is the long pole).
- Phase 4 (GEO + misc) — 0.5 day.
- QA + validation — 0.5 day.
- **Total: ~4.5 days.**

## Execution Order

1. Phase 1.1 locale fix (foundational — unblocks canonical/sitemap/hreflang cascade)
2. Phase 1.2 sitemap
3. Phase 1.3 robots
4. Phase 1.4 middleware
5. Phase 1.5 next.config
6. Phase 2 schema consolidation
7. Phase 3.1 screenshot copy
8. Phase 3.2 trip-planning page + H2
9. Phase 3.3 compare page padding (parallelizable — 4 subagents)
10. Phase 3.4 home hero rewrite
11. Phase 3.5 hero image preload
12. Phase 3.6 cookie banner refactor
13. Phase 3.7 ai-diagnostics source attribution
14. Phase 3.8 author byline system
15. Phase 3.9 "Real X" walkthroughs (parallelizable — 3 feature pages)
16. Phase 4.1 llms.txt
17. Phase 4.2 IndexNow
18. Phase 4.3 aggregateRating (conditional)
19. Phase 4.4 font preload
20. Phase 4.5 web-vitals beacon
21. QA: lint, build, test, schema validate, PSI re-run

## Files to Touch

- `apps/web/src/i18n/routing.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/next.config.ts`
- `apps/web/src/lib/constants.ts` (add `getHreflangMap`)
- `apps/web/src/lib/seo/schema.ts` (new)
- `apps/web/src/lib/authors.ts` (new)
- `apps/web/src/components/marketing/json-ld.tsx` (verify escape)
- `apps/web/src/components/marketing/json-ld-graph.tsx` (new)
- `apps/web/src/components/marketing/author-byline.tsx` (new)
- `apps/web/src/components/marketing/author-bio.tsx` (new)
- `apps/web/src/components/cookie-consent.tsx`
- `apps/web/src/components/web-vitals-reporter.tsx` (new)
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/[locale]/(marketing)/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/trip-planning/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/ai-diagnostics/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/garage-management/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/learning-paths/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/progress-tracking/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-rever/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-calimoto/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-ridelog/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/compare/alternatives/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/tools/cost-calculator/page.tsx`
- `apps/web/messages/en.json` (all namespaces listed in research findings)
- `apps/web/messages/{de,fr,es,it}.json` (mirror key additions)
- `apps/web/public/llms.txt`
- `apps/web/public/llms-full.txt`
- `apps/web/public/screenshots/` (new directory with ~20 PNGs)
- `apps/web/public/authors/founder.webp` (new, Gemini-generated)
- `apps/web/public/[indexnow-key].txt` (new)
- `apps/web/scripts/indexnow-submit.ts` (new)
- `apps/web/scripts/blog-dates.ts` (new)

## Sources & References

### Audit source
- 7-subagent audit conducted 2026-04-11 (this conversation) — findings memorized in MotoVault SEO Audit unified report above.

### Internal references
- `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md` — DO NOT flip `cacheComponents: true`.
- `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md` — CSP `unsafe-eval` env gating + JSON-LD `\u003c` escaping.
- `CLAUDE.md` — type conventions, design system palette rule, Biome-only lint, no hardcoded colors.

### External references
- Google AI Overviews + Google-Extended: https://blog.google/technology/ai/an-update-on-web-publisher-controls/
- next-intl localeDetection: https://next-intl-docs.vercel.app/docs/routing/middleware#locale-detection
- Schema.org MobileApplication: https://schema.org/MobileApplication
- IndexNow: https://www.indexnow.org/
- web-vitals library: https://github.com/GoogleChrome/web-vitals
