---
title: Programmatic SEO — Bike make/model/year pages + competitor compare backfill
type: feat
status: active
date: 2026-04-11
---

# Programmatic SEO — Bike Make/Model/Year Pages + Competitor Compare Backfill

## Enhancement Summary

**Deepened on:** 2026-04-11
**Sections enhanced:** URL architecture, sitemap tiering, quality gate, NHTSA caching, internal linking, compare scaffolding
**Research agents used:** best-practices-researcher (Next 16 + programmatic SEO), repo-research-analyst

### Key Improvements (corrections to v1)

1. **Native `generateSitemaps()` replaces route handlers.** Next 16 has first-class multi-sitemap support in `app/sitemap.ts` — we use it instead of hand-rolling sub-sitemap route handlers. Simpler, correct, and emits `/sitemap.xml` index + `/sitemap/[id].xml` children automatically.
2. **NHTSA cache NOT in `.next/cache/`.** Turbopack owns that directory for its incremental graph. Snapshots live in a tracked `apps/web/data/nhtsa/2026-Q2/` folder loaded once via a server-only singleton — Turbopack tree-shakes server-only per-route so a module-level cache is mandatory.
3. **Quality-gate thresholds raised.** Post-HCU + March 2024 core update, practical floors are **500 words unique + uniqueness ratio ≥ 0.4 + ≥5 unique data points**. Not 600 total. Failing pages: `noindex,follow` with explicit `googleBot` override.
4. **MinHash + LSH for duplicate detection.** O(n²) Jaccard on 10k pages is 50M comparisons. MinHash/LSH at threshold 0.7 with 128 permutations runs in seconds — spec'd in the quality gate section.
5. **Locale scope corrected.** `routing.locales` is now `['en', 'de', 'fr', 'es', 'it']` after the 2026-04-11 Europe+Americas pruning (pt-BR, ja, hi, th, id, tr, pl were removed). Bike pages stay English-only for MVP; compare pages follow the full 5-locale matrix.
6. **Drop `priority` and `changefreq` from sitemap entries.** Google has confirmed (multiple times, most recently 2023) both fields are ignored. Keep `lastMod` honest — don't bump on every build.
7. **`dynamicParams = false` + `force-static`.** Any unknown (make, model, year, pageType) combo 404s instead of on-demand rendering — protects against index-bloat from crawler probing.
8. **Batched rollout, not big-bang.** Publish in waves of 50–100 indexable pages, 2–4 week GSC monitoring window between waves. Tier 1 ramp-up takes ~3 months, not one launch.
9. **Lean compare-page template for bikes.** Full VsRever namespace is ~110 keys × 5 locales = 550 strings per competitor. Bike/model compare variants use a stripped template (~35 keys) without parity matrix or pricing table.
10. **Compare page mirroring verified.** Exact pattern documented from VsRever: `revalidate = 3600`, `setRequestLocale` in both `generateMetadata` and default export, 4 FAQs indexed 0–3, `Link` from `@/i18n/navigation`, `getCanonicalUrl` (no `/en/` prefix), breadcrumb per-locale `@id`.

### New Considerations Discovered

- `apps/web` has **no `vitest.config.ts` and no existing tests** — this feature introduces the first test files in the web app. We need a minimal vitest config scaffolded, and the first test suite must avoid Next runtime dependencies (pure functions only for MVP).
- `VsRideLog` namespace uses capital `L` in messages/en.json while URL slug is `motovault-vs-ridelog`. New compare pages must pick a consistent casing convention — **use exact PascalCase matching the competitor brand** (`VsKurviger`, `VsEatSleepRide`, `VsScenic`, `VsMotoScan`).
- NHTSA service is **NestJS-only** in `apps/api`. Web cannot import it directly. The plan's parallel web-side fetcher remains the right call — it avoids coupling the web build to a running API and avoids adding a GraphQL resolver for build-time data.
- `robots.ts` already allows all major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) — no changes needed for AI discoverability on bike pages.

---

## Overview

Capture high-intent "I own a specific bike" traffic by launching a programmatic SEO surface at
`/bikes/[make]/[model]/[year]/<page-type>` on `apps/web` (Next.js 16), backed by the NHTSA vPIC
API and MotoVault's own aggregate maintenance telemetry. Each (make, model, year) tuple gets up
to 5 page variants: `maintenance-schedule`, `common-problems`, `cost-of-ownership`,
`service-intervals`, and `vs-[competitor]`.

Ship in a **tightly gated, tiered rollout** — start with the top 30 most-searched makes, enforce
a hard content-quality gate before indexing, tier the sitemap by confidence, and noindex any page
that fails the gate. Ship alongside four new competitor compare pages
(`vs-kurviger`, `vs-eatsleepride`, `vs-scenic`, `vs-motoscan`) stacking on the existing
`motovault-vs-rever` template from PR #46.

## Problem Statement / Motivation

The SEO audit (see `docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md`) identified
two untapped opportunities:

1. **Long-tail bike queries are wide open.** Queries like "Yamaha R1 2023 maintenance schedule"
   and "BMW R1250GS common problems" have high commercial intent and no one covering them with a
   combined maintenance + diagnostics + trip-planning offering. MotoVault already integrates NHTSA
   vPIC (see `apps/api/src/modules/motorcycles/nhtsa.service.ts:117-204`) — the data pipeline
   exists.
2. **Compare-page template is under-used.** The audit explicitly called out missing
   `vs-Kurviger` and `vs-EatSleepRide` pages. PR #46 established a proven template
   (`apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-rever/page.tsx`) that costs
   ~1 day per new competitor.

The audit also set a **hard stop**: do not ship templated pages without unique per-page content.
30–50 thin pages get index-bloated and hurt site quality signals. This plan must respect that.

## Proposed Solution

### High-level approach

1. **Pre-build NHTSA snapshot, not a runtime client.** Rather than fetching NHTSA during
   `next build`, we run a dedicated script (`pnpm --filter web generate:nhtsa`) that writes
   `apps/web/data/nhtsa/2026-Q2/{makes,models-by-make-year,refreshed-at}.json` and commits them.
   Build reads these JSON files via a **module-level server-only singleton** (`bike-cache.ts`)
   so Turbopack doesn't re-parse per route. Rationale: Turbopack owns `.next/cache/` for its own
   graph and does not persist ad-hoc files there; it also tree-shakes `server-only` modules per
   route, so without the singleton we'd re-read the snapshots 10,000 times.
2. **Curated make/model list** — Do NOT programmatically generate for all 200+ NHTSA makes. Start
   with 30 curated "popular" makes already encoded in
   `apps/api/src/modules/motorcycles/nhtsa.service.ts:52-89` (`POPULAR_MAKES`). Share this list via
   `packages/types`.
3. **Year coverage** — Only generate for model years `2018–2026` (9 years). Older bikes have
   thinner NHTSA data and lower search volume.
4. **Template strategy** — 5 page types, each with 600+ words of unique content driven by a
   combination of NHTSA specs, internal telemetry stats, and structured data (service intervals
   from OEM owner's manuals where scraped, common recall data from NHTSA recalls API already
   integrated at `nhtsa.service.ts:216-283`).
5. **Quality gate** — A build-time scorer that checks each page against hard criteria (min word
   count, required data fields present, no duplicate paragraphs across pages). Pages that fail
   are emitted with `<meta name="robots" content="noindex,follow">` and excluded from the
   sitemap.
6. **Sitemap tiering** — Split sitemap into `/sitemap.xml` (index), `/sitemap-core.xml` (static +
   blog + compare), `/sitemap-bikes-tier1.xml` (popular makes + recent years, highest confidence),
   `/sitemap-bikes-tier2.xml` (remaining). Tier 1 gets higher `priority` and `changefreq`.
7. **Internal linking** — Each bike page auto-links to: (a) related models from same make,
   (b) the other 4 page-types for the same bike, (c) the most-relevant feature page
   (`/features/garage-management`, `/features/ai-diagnostics`). A new `BikeLinkHub` component
   handles this consistently.
8. **Competitor compare pages** — Copy the `motovault-vs-rever` structure, feed new translations
   via `messages/en.json` namespaces (`VsKurviger`, `VsEatSleepRide`, `VsScenic`, `VsMotoScan`),
   add canonical URLs to `getHreflangMap` and extend `apps/web/src/app/sitemap.ts`.

## Technical Approach

### URL architecture

```
/bikes                                                   → index: popular makes grid (tier 1 only)
/bikes/[make]                                            → make landing (e.g. "Yamaha motorcycles")
/bikes/[make]/[model]                                    → model landing (year-agnostic)
/bikes/[make]/[model]/[year]                             → year landing (overview hub)
/bikes/[make]/[model]/[year]/maintenance-schedule        → 5 page-type leaves
/bikes/[make]/[model]/[year]/common-problems
/bikes/[make]/[model]/[year]/cost-of-ownership
/bikes/[make]/[model]/[year]/service-intervals
/bikes/[make]/[model]/[year]/vs-[competitor-model]       → intra-brand vs (phase 2, not MVP)
```

**Slug normalization:** lowercase, hyphenated, strip diacritics.
`Harley-Davidson → harley-davidson`, `Moto Guzzi → moto-guzzi`, `Royal Enfield → royal-enfield`.
Slug map lives in `apps/web/src/lib/bikes/slug-map.ts` with bidirectional resolution.

**next-intl routing:** Route files live under
`apps/web/src/app/[locale]/(marketing)/bikes/...`. English is the canonical locale. For MVP,
hreflang is **English-only** on bike pages — translating 1500+ templated pages is not worth it
yet. `getHreflangMap` gains a `localesOverride` parameter so bike routes return only `en` +
`x-default`.

### Files to create

```
apps/web/data/nhtsa/2026-Q2/           # tracked JSON snapshots (NOT .next/cache/)
├── makes.json                          # 30 popular makes
├── models-by-make-year.json            # keyed by `${makeId}-${year}`
└── refreshed-at.json                   # metadata + commit hash

apps/web/data/telemetry/2026-Q2/        # anonymized aggregate stats
└── bike-stats.json

apps/web/src/lib/bikes/
├── popular-makes.ts                    # 30-make list (mirrors api POPULAR_MAKES from nhtsa.service.ts:52-89)
├── slug-map.ts                         # make/model name ↔ slug resolution
├── bike-cache.ts                       # server-only singleton loader — avoids Turbopack per-route re-reads
├── bike-data.ts                        # composes NHTSA + telemetry → BikePageData
├── quality-gate.ts                     # scoring + MinHash/LSH dedup
├── minhash.ts                          # MinHash/LSH implementation (or wrap `minhash` npm pkg)
└── internal-linking.ts                 # BikeLinkHub graph builder

apps/web/src/components/marketing/bikes/
├── bike-hero.tsx
├── bike-link-hub.tsx
├── service-interval-table.tsx
├── cost-of-ownership-breakdown.tsx
├── common-problems-list.tsx
└── telemetry-callout.tsx               # "per MotoVault internal data" stat blocks

apps/web/src/app/[locale]/(marketing)/bikes/
├── page.tsx                            # /bikes index
├── [make]/page.tsx                     # /bikes/yamaha
├── [make]/[model]/page.tsx             # /bikes/yamaha/yzf-r1
├── [make]/[model]/[year]/page.tsx      # /bikes/yamaha/yzf-r1/2023 (hub)
└── [make]/[model]/[year]/[pageType]/page.tsx   # one file, validated pageType union

apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-kurviger/page.tsx
apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-eatsleepride/page.tsx
apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-scenic/page.tsx
apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-motoscan/page.tsx

apps/web/vitest.config.ts               # NEW — first vitest config in apps/web
apps/web/src/lib/bikes/__tests__/
├── slug-map.test.ts
├── quality-gate.test.ts
├── minhash.test.ts
└── bike-data.test.ts
```

**Note on route consolidation:** All 5 page-types collapse into a single `[pageType]/page.tsx` with a validated union (`'maintenance-schedule' | 'common-problems' | 'cost-of-ownership' | 'service-intervals' | 'overview'`). Cuts 80% of the route-file boilerplate and keeps `generateStaticParams` in one place.

### Files to modify

- `apps/web/src/app/sitemap.ts` — convert from single-sitemap to sitemap-index strategy OR keep
  and add bike entries through tier-aware generators. Preferred: new route handlers (see above).
- `apps/web/src/lib/constants.ts` — add `getHreflangMap(pathname, { localesOverride?: readonly string[] })`.
- `apps/web/src/app/robots.ts` — add explicit sitemap references.
- `apps/web/messages/en.json` — four new compare namespaces.
- `apps/web/src/lib/seo/schema.ts` — add `buildProduct` for bike detail pages (Product schema with
  NHTSA make/model/year), and `buildHowTo` for maintenance-schedule pages.

### Data sources per template

| Template | Primary data | Secondary data | Unique content hook |
|---|---|---|---|
| `maintenance-schedule` | NHTSA vPIC specs (engine type/displacement) | OEM interval table (seeded fixtures keyed by displacement class) | "Yamaha R1 2023 owners in MotoVault log chain adjustments at **N km median** vs the OEM 10,000 km schedule" (pulled from `telemetry-stats.ts`) |
| `common-problems` | NHTSA recalls API (`getRecalls(make, model, year)`) | Open issues from MotoVault diagnostic sessions (aggregate) | Recall count + recalled components table + "most-diagnosed issue from **N** MotoVault sessions for this bike" |
| `cost-of-ownership` | NHTSA specs (displacement class → insurance tier) | Telemetry: median annual maintenance spend, median service-interval cost | Breakdown block with real median spend, year-over-year |
| `service-intervals` | OEM interval table | Telemetry: median actual interval vs OEM | Gap analysis ("owners actually service at 8,200km, 18% earlier than OEM") |
| `vs-[competitor-model]` | NHTSA vPIC specs both bikes | Aggregate fuel economy, maintenance cost deltas | Head-to-head stat block |

**Critical:** `telemetry-stats.ts` starts as **static seeded JSON** derived from anonymized
aggregate counts of real MotoVault user data (query to be run by Andrej manually pre-launch and
committed as a fixture). This removes runtime DB dependency from the build and sidesteps privacy
concerns from live data. Refresh cadence: quarterly.

### Quality gate (hard rules — post-HCU thresholds)

A page is eligible for indexing **only if all** are true:

1. NHTSA returned non-empty model data for the (make, model, year) tuple.
2. Rendered main content has **≥ 500 words** of unique prose (excluding template chrome).
3. **Uniqueness ratio ≥ 0.4** — unique tokens (not shared with template boilerplate) must be ≥ 40% of total.
4. **≥ 5 unique data points** per page (specific numbers: displacement, maintenance interval, telemetry median, recall count, cost figure, etc.). Placeholder "—" or "N/A" does NOT count.
5. MinHash/LSH dedup: no sibling page has Jaccard similarity ≥ 0.7 on 5-gram shingles of the main content. MinHash with 128 permutations.

Implementation: `apps/web/src/lib/bikes/quality-gate.ts` exposes:

```ts
export interface QualityResult {
  passes: boolean;
  reasons: string[];
  wordCount: number;
  uniquenessRatio: number;
  dataPointCount: number;
  maxSiblingJaccard: number;
}

export function scoreBikePage(data: BikePageData, corpus: MinHashLSHIndex): QualityResult;
```

Called during `generateStaticParams` in a two-pass flow:
1. **Pass 1:** enumerate tuples, fetch NHTSA, compose `BikePageData`, insert MinHash signature into the LSH index.
2. **Pass 2:** score each page against the populated index. Failing pages are still rendered (so internal links and breadcrumbs don't 404), but `generateMetadata` returns:
   ```ts
   robots: {
     index: false, follow: true,
     googleBot: { index: false, follow: true },
   }
   ```
   and the page is excluded from the sitemap output. The `googleBot` override is required — without it, Googlebot ignores nuances like `max-snippet`.

**Anti-structured-data-compensation rule:** Schema.org Product/HowTo markup does NOT offset thin prose in Google's quality classifier post-2023 HowTo deprecation for desktop. Rich results are additive, never compensatory. Keep the gate strict even on schema-heavy pages.

### Sitemap tiering — using Next 16 native `generateSitemaps()`

Next 16 supports multi-sitemap emission via the metadata-file convention in `app/sitemap.ts`. We use it instead of hand-rolling sub-sitemap route handlers. Output is automatic: `/sitemap.xml` (index) + `/sitemap/[id].xml` (children).

```ts
// apps/web/src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { loadIndexablePages } from '@/lib/bikes/bike-cache';
import { buildCoreEntries, buildBlogEntries } from './sitemap-builders';

const PER_SITEMAP = 5_000; // well under 50k Google limit; paces crawl

export async function generateSitemaps() {
  const bikeCount = await loadIndexablePages.count();
  const bikeChunks = Math.ceil(bikeCount / PER_SITEMAP);
  // id 0 is reserved for core (static + blog + compare)
  return Array.from({ length: bikeChunks + 1 }, (_, id) => ({ id }));
}

export default async function sitemap(
  { id }: { id: number },
): Promise<MetadataRoute.Sitemap> {
  if (id === 0) return [...buildCoreEntries(), ...buildBlogEntries()];

  const chunk = id - 1;
  const rows = await loadIndexablePages.slice(chunk * PER_SITEMAP, PER_SITEMAP);
  return rows.map((r) => ({
    url: `${BASE_URL}/bikes/${r.makeSlug}/${r.modelSlug}/${r.year}/${r.pageType}`,
    lastModified: new Date(r.dataUpdatedAt), // real NHTSA refresh date — NOT build timestamp
    // Intentionally NO `priority` / `changeFrequency` — Google ignores both.
  }));
}
```

**Tiering strategy (content-level, not sitemap-level):**

- **Tier 1 (indexable):** 30 popular makes × top 8 models/make × years 2022–2026 × 5 page types = **~6,000 URLs** max. After quality gate, expect 60–70% to pass = ~4,000 indexed.
- **Tier 2 (noindex,follow):** older years (2018–2021), less-popular models, failing quality gate. Rendered but not sitemap'd. Kept for internal linking.

The sitemap only contains indexable (tier 1 that passes gate). Tier 2 URLs never appear. This is stricter than v1 of the plan — no "tier 2 sitemap" because Google treats sitemap inclusion as a quality signal.

### Index-bloat prevention

1. **Quality gate** → `noindex,follow` + sitemap exclusion.
2. **`dynamicParams = false`** in every bike route: unknown combos return 404 at the Next layer, so crawler probing can't discover phantom URLs.
3. **Canonical strategy:**
   - Year hub `/bikes/yamaha/yzf-r1/2023` is self-canonical.
   - Leaf `/bikes/yamaha/yzf-r1/2023/maintenance-schedule` is **self-canonical** when uniqueness ratio ≥ 0.4 vs the year hub, else canonicals UP to the hub.
   - Never canonical across years (`2023` ≠ `2024`).
4. `robots.ts` already disallows admin; no change needed. Do NOT disallow `/bikes/` (we want crawling; failing pages use noindex so Google can see the directive).
5. GSC coverage monitoring: post-launch dashboard alert if `Excluded by noindex` > 30% of submitted URLs OR `Crawled — currently not indexed` > 15%.
6. **Batched rollout:** publish in waves of 50–100, wait 2–4 weeks, check GSC, proceed if healthy. Never publish the full set at once.

### Internal linking automation

**Density targets from research:**
- **3–5 contextual in-body links per 1,000 words** (counted separately from structured blocks).
- **Structured "related bikes" block:** 5 siblings by same make + 5 by same displacement class.
- **Hub → leaf fan-out:** each model page links to all its year children (≤15); each year hub links to all 5 page types (≤6 links).
- **Link-graph in-degree ≥ 3:** every indexable leaf must be reachable from at least 3 other pages.
- **Varied anchor text:** rotate between `{make} {model} {year} specs`, `the {year} {model}`, and bare `{model}` — no single-template anchors.

`BikeLinkHub` component emits:

```tsx
<BikeLinkHub make="Yamaha" model="YZF-R1" year={2023} current="maintenance-schedule" />
```

which renders:
- Other 4 page types for the same bike
- 5 sibling models from the same make (by displacement proximity)
- 5 cross-make siblings in the same displacement class
- Link back to `/bikes/yamaha/yzf-r1` (model landing)
- Contextual link to the most relevant feature page (`/features/garage-management` for maintenance-schedule/service-intervals, `/features/ai-diagnostics` for common-problems, `/tools/cost-calculator` for cost-of-ownership)

The link graph is **computed at build time** from the NHTSA snapshot, not hand-authored.
A post-build script (`pnpm --filter web verify:link-graph`) walks the generated HTML to assert the in-degree ≥ 3 invariant and fails CI if orphans exist.

### Next.js 16 page boilerplate pattern

Every leaf page follows this exact shape (mirrors the verified compare-page pattern):

```ts
// apps/web/src/app/[locale]/(marketing)/bikes/[make]/[model]/[year]/[pageType]/page.tsx
import 'server-only';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildGraph, buildWebPage, buildFAQPage } from '@/lib/seo/schema';
import { loadIndexablePages, loadAllPages } from '@/lib/bikes/bike-cache';
import { scoreBikePage } from '@/lib/bikes/quality-gate';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 3600; // mirrors compare pages

const PAGE_TYPES = ['overview', 'maintenance-schedule', 'common-problems', 'cost-of-ownership', 'service-intervals'] as const;
type PageType = (typeof PAGE_TYPES)[number];

interface PageProps {
  params: Promise<{ locale: string; make: string; model: string; year: string; pageType: string }>;
}

export async function generateStaticParams() {
  // English only for MVP — next-intl static params are merged with [locale]
  const rows = await loadAllPages.all();
  return rows.flatMap((r) =>
    PAGE_TYPES.map((pageType) => ({
      make: r.makeSlug, model: r.modelSlug, year: String(r.year), pageType,
    })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await params;
  setRequestLocale(p.locale);
  if (!(PAGE_TYPES as readonly string[]).includes(p.pageType)) return {};
  const page = await loadAllPages.find(p);
  if (!page) return {};

  const gate = page.qualityScore; // computed in bike-cache during snapshot build
  const canonical = gate.canonicalUrl; // may point UP to year hub

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical, languages: getHreflangMap(page.path) },
    robots: gate.passes
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export default async function BikePage({ params }: PageProps) {
  const p = await params;
  setRequestLocale(p.locale);
  if (!(PAGE_TYPES as readonly string[]).includes(p.pageType)) notFound();
  const page = await loadAllPages.find(p);
  if (!page) notFound();

  const graph = buildGraph(
    buildWebPage({ /* … */ }),
    buildBreadcrumbList(/* trail */, p.locale, page.pageKey),
    page.faqItems.length ? buildFAQPage(page.faqItems, `${p.locale}${page.pageKey}/faq`) : null,
  );

  return <>
    <JsonLdGraph nodes={graph} />
    {/* render page-type-specific component */}
  </>;
}
```

Key requirements codified from the VsRever convention:
- `setRequestLocale` in BOTH `generateMetadata` and the default export.
- `Link` from `@/i18n/navigation`, never `next/link`.
- `getCanonicalUrl` handles `as-needed` prefix — never hand-prepend `/en/`.
- `buildBreadcrumbList` requires both `locale` and `pageKey` for per-locale `@id` namespacing.
- JSON-LD always flows through `<JsonLdGraph>`, never inline `<script>`.

### Competitor compare pages (Phase 1 item)

Four new pages, identical structure to `motovault-vs-rever`:

| Slug | Competitor angle | Primary differentiator |
|---|---|---|
| `motovault-vs-kurviger` | Curvy-road routing (EU-centric) | MotoVault combines routing + maintenance; Kurviger is routing-only |
| `motovault-vs-eatsleepride` | Community / social feed | MV has ride logging + AI diagnostics; ESR lacks maintenance depth |
| `motovault-vs-scenic` | iOS-only route planner | MV is cross-platform with garage/expenses layer |
| `motovault-vs-motoscan` | OBD-II hardware diagnostics | MV is hardware-free AI diagnostics, direct foil to MotoScan's dongle dependency |

Each needs: a `Vs{Competitor}` PascalCase translations namespace in `messages/en.json` (exact casing: `VsKurviger`, `VsEatSleepRide`, `VsScenic`, `VsMotoScan` — matches existing `VsRideLog` convention), a FAQ block (exactly 4 questions indexed 0–3), and entries in `sitemap.ts` core chunk, `getHreflangMap`, and `PAGE_LAST_EDITED`.

**Translation budget:** VsRever has ~110 leaf keys across the full template (title, hero, testingPreamble, quickVerdict, 10 feature labels, 8 wins, 13 pricing-table, 45 parity-matrix, 4 FAQ). Four new compare pages × 110 keys × 5 locales = **2,200 new localized strings**. This is a meaningful translation cost. Two options:

- **Option A (recommended):** Ship English-only first (440 new en keys), add DE/FR/ES/IT in a follow-up with AI-assisted translation + human review.
- **Option B:** Slim template — drop `parityMatrix` and `pricingTable` sections, keep hero/wins/FAQ → ~35 keys per competitor × 5 locales = 700 strings. Faster but visually different from the existing three.

Plan default: **Option A**. Ship the full-fidelity template in English, translate in a second PR.

### Interaction graph

- `sitemap.xml` (index) → references three sub-sitemaps → referenced by `robots.ts`
- Each bike page build → `getBikeData(make, model, year)` → NHTSA client (cached on disk in
  `.next/cache/nhtsa`) + telemetry fixture → quality-gate scorer → either indexed render or
  noindex render
- `generateStaticParams` for each route enumerates (make, model, year) tuples from
  `popular-makes.ts` × model list (from NHTSA) × year range

### Error & failure propagation

- NHTSA API down at build time: cached responses from previous build used; if no cache, the
  `popular-makes.ts` list is considered a hard fallback and any model fetch that fails yields an
  empty model list for that make (pages for that make are skipped with a build warning).
- Unit tested in `bike-data.test.ts`.
- Runtime errors are not a concern — all pages are statically generated.

### State lifecycle risks

- Stale NHTSA cache: TTL of 7 days on disk cache (matches existing `MODELS_TTL`).
- Stale telemetry fixture: manually refreshed quarterly; include a "last updated" date in
  `telemetry-stats.ts` and surface it on the page ("Based on MotoVault usage data through Q1
  2026").
- Schema drift: if NHTSA renames a field, `nhtsa-client.ts` has a strict Zod parser that fails
  the build loudly rather than silently dropping data.

### API surface parity

- No user-facing API changes. Existing mobile NHTSA flow (`apps/mobile/src/hooks/use-motorcycle-*`)
  is untouched.
- The web-side client is a **parallel** implementation, not a refactor of `apps/api`'s service.
  Duplication is intentional — web needs no auth/GraphQL, just a cacheable fetcher.

## System-Wide Impact

### Integration test scenarios (cross-layer)

1. **Sitemap end-to-end:** After build, fetch `/sitemap.xml` → fetch each referenced sub-sitemap →
   assert every URL returns 200 and its `<head>` contains the expected canonical + hreflang +
   robots tag. Catches: broken slug generation, missed quality-gate inclusions, robots mismatch.
2. **Quality-gate enforcement:** Force-feed a synthetic `BikePageData` with 300 words → assert the
   rendered page has `noindex` and is absent from sitemap. Catches: gate regressions.
3. **Slug round-tripping:** For every generated (make, model) in tier 1, slug → page load → page
   should resolve and display the correct make/model name. Catches: normalization bugs
   (Harley-Davidson, accents).
4. **Internal linking graph reachability:** Starting from `/bikes` and crawling 2 hops, verify we
   can reach ≥ 80% of tier-1 bike pages. Catches: orphan pages.
5. **Competitor compare rendering:** All 4 new compare pages return 200, include hreflang, FAQ
   JSON-LD, and breadcrumbs. Catches: translation namespace typos.

## Acceptance Criteria

### Functional Requirements

- [ ] Route handlers exist for `/bikes`, `/bikes/[make]`, `/bikes/[make]/[model]`,
      `/bikes/[make]/[model]/[year]` and four leaf page types.
- [ ] `popular-makes.ts` contains exactly the 30 curated makes (mirrors `POPULAR_MAKES` in
      `apps/api/src/modules/motorcycles/nhtsa.service.ts:52`).
- [ ] `generateStaticParams` produces tuples only from the curated list × years 2022–2026.
- [ ] NHTSA client caches responses on disk under `.next/cache/nhtsa` with 7-day TTL.
- [ ] Quality gate runs at build time; failing pages render with `robots: noindex,follow` and are
      excluded from sitemap submission.
- [ ] Sitemap is split into `sitemap.xml` (index) + `sitemap-core.xml` +
      `sitemap-bikes-tier1.xml` + `sitemap-bikes-tier2.xml`.
- [ ] `robots.ts` references the sitemap index.
- [ ] Each bike page includes: H1 with `{Make} {Model} {Year}`, unique data block, BikeLinkHub,
      breadcrumb JSON-LD, Product JSON-LD.
- [ ] `maintenance-schedule` pages include `HowTo` schema.
- [ ] Each page has ≥ 600 words of indexable content OR is `noindex`.
- [ ] Four new competitor compare pages (`vs-kurviger`, `vs-eatsleepride`, `vs-scenic`,
      `vs-motoscan`) exist with the same structure as `motovault-vs-rever`.
- [ ] New compare pages are added to `sitemap-core.xml`, `PAGE_LAST_EDITED`, and `getHreflangMap`.

### Non-Functional Requirements

- [ ] Full production build completes in under 8 minutes (measure baseline, add budget).
- [ ] Disk cache hit rate > 90% on second consecutive build.
- [ ] `apps/web` bundle size does not grow by more than 5 kB gzipped (components are
      server-only).
- [ ] Lighthouse performance on a representative bike page ≥ 90 mobile.
- [ ] All rendered pages pass `rich-results.google.com` validation for Product + BreadcrumbList
      + FAQPage schema.

### Quality Gates

- [ ] `pnpm --filter web build` green.
- [ ] `pnpm --filter web test` green including new `bikes/` test suite.
- [ ] `pnpm lint` green (Biome).
- [ ] Manual smoke test: `/bikes/yamaha/yzf-r1/2023/maintenance-schedule` renders with real
      NHTSA data and the telemetry callout.
- [ ] Sitemap index + sub-sitemaps validate against Google's XML schema.
- [ ] No duplicate H1/canonical pairs across the generated corpus (checked via post-build
      script).

## Success Metrics

- **Build-time:** 100% of tier-1 pages pass quality gate OR are explicitly excluded (no silent
  noindex surprises).
- **Week 1 after launch:** GSC registers > 5,000 submitted URLs, < 10% "Crawled — currently not
  indexed".
- **Month 1:** ≥ 100 bike pages receive ≥ 1 impression in GSC.
- **Month 3:** Bike surface drives ≥ 5% of organic traffic to apps/web.
- **Compare pages:** Each new compare page receives ≥ 1 indexed position for
  `motovault vs {competitor}` within 30 days of publish.

## Dependencies & Risks

- **NHTSA API rate limiting:** The snapshot script (`generate:nhtsa`) is run manually/quarterly,
  not on every build. That's ~30 makes × 9 years = 270 API calls, once per quarter. The build
  itself reads only the committed JSON snapshot — zero NHTSA calls during `next build`.
- **Turbopack cache isolation:** snapshots live in `apps/web/data/nhtsa/...` (tracked), NOT in
  `.next/cache/`. A server-only singleton in `bike-cache.ts` ensures the file is read once per
  build, not once per route. Verified gotcha from Next 16 docs.
- **Build-time memory ceiling:** 10k static pages on Turbopack can OOM 16GB machines if the
  worker count isn't capped. Set `experimental.workerThreads = true` and cap `experimental.cpus`
  in `next.config.ts` if needed. Monitor build memory on first full run; raise the cap only if
  CI is comfortably over 16GB.
- **Telemetry fixture freshness:** Manual quarterly refresh. Add a TODO in
  `telemetry-stats.ts` with next refresh date.
- **Model catalog drift:** NHTSA sometimes splits/merges model names. Slug map must remain stable
  across builds — add a snapshot test that fails loudly on unrecognized slugs.
- **Thin-content penalty:** This is THE risk. Mitigation: start tier 1 only, watch GSC coverage
  closely, hold tier 2 until tier 1 is cleanly indexed.
- **Translation debt:** Bike pages are English-only for MVP. Audit team will want this revisited
  — acknowledged, punted.

## Alternative Approaches Considered

1. **Runtime generation via ISR instead of SSG.** Rejected: rebuilding on-demand complicates the
   quality gate and makes sitemap generation stateful.
2. **GraphQL proxy to `apps/api` for NHTSA data.** Rejected: adds a build-time dependency on a
   running API instance, coupling the web build to backend deploys.
3. **Generate all 200+ NHTSA makes.** Rejected: audit's hard stop at 30/50 thin pages. Quality
   > quantity.
4. **Ship competitor compare pages separately.** Rejected: they share the same review/QA cycle
   and it's cheaper to bundle.

## Future Considerations

- **Vs-competitor-model pages** (`/bikes/yamaha/yzf-r1/2023/vs-yamaha-yzf-r6`): held as phase 2,
  once tier-1 is validated in GSC.
- **Translated bike pages:** add top-5 locales (DE, FR, ES, IT, PT-BR) after English tier-1 is
  traffic-proven. Will need per-locale telemetry for European markets.
- **Owner Q&A widget:** embed real MotoVault user questions (moderated) on bike pages for
  UGC-boosted uniqueness.
- **Real-time recall alerts:** integrate live NHTSA recalls feed on the page with "last checked"
  timestamp (already have `getRecalls` in the NestJS service; could call at build time + add ISR
  revalidation).

## Documentation Plan

- Update `apps/web/CLAUDE.md` — add "Programmatic bike pages" section explaining the data flow,
  slug rules, and how to regenerate the telemetry fixture.
- Add `apps/web/src/lib/bikes/README.md` — explain the module layout and how to add a new page
  template.
- Update `docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md` status to reference
  this follow-up.

## Sources & References

### Internal References

- NHTSA integration: `apps/api/src/modules/motorcycles/nhtsa.service.ts:52-284`
- Popular makes list: `apps/api/src/modules/motorcycles/nhtsa.service.ts:52-89`
- Existing compare template: `apps/web/src/app/[locale]/(marketing)/compare/motovault-vs-rever/page.tsx`
- Current sitemap: `apps/web/src/app/sitemap.ts`
- Schema builders: `apps/web/src/lib/seo/schema.ts`
- SEO audit plan: `docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md`

### Related Work

- PR #46: `motovault-vs-rever`, `motovault-vs-calimoto`, `motovault-vs-ridelog` compare template
- Merged SEO phase 4: `45a286b feat(web): SEO phase 4 — llms.txt, web-vitals, screenshots, font preload`

### External References

- NHTSA vPIC API: `https://vpic.nhtsa.dot.gov/api/`
- NHTSA recalls API: `https://api.nhtsa.gov/recalls`
- Google Search Central — Sitemap indexes: `https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps`
- Google Search Central — Thin content: `https://developers.google.com/search/docs/essentials/spam-policies#scraped-content`
