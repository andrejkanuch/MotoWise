---
title: "fix: SEO Schema & Content Audit Fixes"
type: fix
status: completed
date: 2026-05-27
deepened: 2026-05-27
---

# fix: SEO Schema & Content Audit Fixes

## Enhancement Summary

**Deepened on:** 2026-05-27
**Agents used:** architecture-strategist, code-simplicity-reviewer, learnings-researcher, best-practices-researcher

### Key Improvements from Deepening
1. **Fix 2 simplified:** Removed unnecessary `imageWidth`/`imageHeight` interface fields — hardcode 1200x630 directly in builder
2. **Fix 4 simplified:** Dropped JsonLdGraph migration scope — just swap HowTo→Article using existing `<JsonLd>`
3. **Fix 6 downgraded:** Trip breadcrumbs are already valid — skip this fix entirely
4. **Fix 3 hardened:** Add `res.ok` check, move file to `lib/seo/`, document PPR compatibility
5. **Dependency flagged:** Fix 4 depends on Fix 1 (buildArticle @id must use canonical URL before TCLOCS can reuse it)

### Institutional Learnings Applied
- PPR is disabled (`cacheComponents: false`) so async iTunes fetch on homepage is safe (see `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`)
- XSS escape pattern (`.replace(/</g, '\\u003c')`) already handled by both `<JsonLd>` and `<JsonLdGraph>` components

## Overview

Comprehensive SEO audit of motovault.app revealed **zero rich results in Google Search Console** despite having Schema.org markup across all page types. Six specific schema bugs prevent rich result eligibility, and blog maintenance posts have 3,500+ impressions with ~0.3% CTR due to weak title tags and meta descriptions.

This plan covers 10 fixes across the Next.js web app (`apps/web/`), split into code changes and content changes.

## Problem Statement

- **GSC Search Appearance**: Completely empty — no rich results at all
- **Blog CTR**: 0.12%–0.62% on maintenance schedule posts ranking positions 7–11 (expected: 3–8%)
- **Schema bugs**: `@id` inconsistency, missing `ImageObject` dimensions, deprecated `HowTo`, duplicate FAQ content, broken breadcrumb URLs
- **Missing opportunities**: No `AggregateRating` on SoftwareApplication, no `wordCount` on articles

## Technical Approach

### Phase 1: Schema Code Fixes (Fixes 1–4, 6–7)

Pure code changes to `schema.ts`, page components, and the blog index. No content changes. Can be validated with Google's Rich Results Test.

### Phase 2: Content Fixes (Fixes 5, 8–10)

Content edits to MDX frontmatter and bike FAQ data. Requires quality review.

---

## Fix 1 — Fix `@id` Fragment Inconsistency in `buildArticle`

**File:** `apps/web/src/lib/seo/schema.ts:242`

**Problem:** `buildArticle` produces `@id` values like `${BASE_URL}/#/${article.locale}/blog/${article.slug}/article`. For the default English locale this yields `https://motovault.app/#/en/blog/slug/article`. The canonical URL is `https://motovault.app/blog/slug` (no `/en/`). The `@id` pattern uses the locale routing path, not the canonical URL.

**Fix:** Change `@id` to derive from the article's canonical URL:

```typescript
// schema.ts:242 — BEFORE
'@id': `${BASE_URL}/#/${article.locale}/blog/${article.slug}/article`,

// AFTER
// Article @id uses canonical URL (not locale-namespaced) because Google
// requires @id to match the canonical for Article rich result eligibility.
'@id': `${article.url}#article`,
```

The `article.url` is already the canonical URL (produced by `getArticleUrl`), which handles the English/non-English prefix correctly.

**Scope:** Only `buildArticle`. The `buildWebPage`, `buildBreadcrumbList`, and `buildFAQPage` functions use the locale-namespaced `@id` pattern intentionally (per the comment at `schema.ts:11–12`) to prevent Google from merging locale variants. The Article `@id` is the exception because it's the primary entity that needs to match the canonical URL for rich result eligibility.

**Important:** Add an inline comment at the `@id` line explaining why it diverges from the locale-namespaced pattern — prevents a future contributor from "fixing" it to match the other builders.

**Test update:** `apps/web/src/lib/seo/__tests__/jsonld.test.ts` — add/update test for `buildArticle` `@id` output.

---

## Fix 2 — Convert Article `image` to `ImageObject` with Dimensions + Add `wordCount`

**Files:**
- `apps/web/src/lib/seo/schema.ts:226–258` (ArticleInput interface + buildArticle function)
- `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx:155–165` (buildArticle call site)

**Problem:** `buildArticle` emits `image: [article.image]` (plain string in array). Google requires `ImageObject` with width ≥ 696px for Article rich result eligibility. Also, `wordCount` is parsed from frontmatter but never passed to the schema.

**Fix:**

```typescript
// schema.ts — ArticleInput interface: add wordCount only
export interface ArticleInput {
  // ... existing fields ...
  wordCount?: number;
}

// schema.ts — buildArticle: convert image string to ImageObject, add wordCount
image: [{
  '@type': 'ImageObject',
  url: article.image,
  width: 1200,
  height: 630,
}],
// Add wordCount conditionally
...(article.wordCount ? { wordCount: article.wordCount } : {}),
```

**Call site update** (`blog/[slug]/page.tsx`):
```typescript
buildArticle({
  // ... existing fields ...
  wordCount: article.wordCount, // Already parsed from frontmatter
}),
```

**Simplification note (from code-simplicity review):** All blog OG images are 1200x630 (confirmed at `blog/[slug]/page.tsx:63`). No need for optional `imageWidth`/`imageHeight` interface fields — hardcode the dimensions directly in the builder. If image dimensions change in the future, refactor then (YAGNI).

---

## Fix 3 — Add `AggregateRating` to SoftwareApplication on Homepage

**Files:**
- `apps/web/src/app/[locale]/(marketing)/page.tsx:62–65` (buildSoftwareApplication call)
- New: rating fetch utility or hardcoded values

**Problem:** `buildSoftwareApplication` already supports `aggregateRating` (schema.ts:105), but the homepage never passes one. This is the highest-impact missed rich result — star ratings in branded SERPs.

**Approach:** Use the iTunes Lookup API to fetch the real App Store rating at build/revalidation time. The `schema.ts` header comment is explicit: "aggregateRating is NEVER fabricated."

**Implementation:**

1. Create `apps/web/src/lib/seo/app-store-rating.ts` (co-located with schema builders since this is exclusively consumed by the SEO layer):
```typescript
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup?id=6760291360&country=us';

interface AppStoreRating {
  ratingValue: string;
  reviewCount: string;
}

export async function getAppStoreRating(): Promise<AppStoreRating | null> {
  try {
    const res = await fetch(ITUNES_LOOKUP_URL, { next: { revalidate: 86400 } }); // 24h cache
    if (!res.ok) return null; // Apple sometimes returns HTML error pages
    const data = await res.json();
    const app = data.results?.[0];
    if (!app?.averageUserRating || !app?.userRatingCount) return null;
    return {
      ratingValue: app.averageUserRating.toFixed(1),
      reviewCount: String(app.userRatingCount),
    };
  } catch {
    return null;
  }
}
```

2. Update homepage `page.tsx`:
```typescript
const rating = await getAppStoreRating();

buildSoftwareApplication({
  name: tJsonLd('app.name'),
  description: tJsonLd('app.description'),
  aggregateRating: rating ?? undefined,
}),
```

3. Add visible rating text on the homepage (per Google guidelines, the rating must match visible text). Add to the `ProofSection` stats grid or the social proof area:
```tsx
{rating && (
  <div className="...">
    <span className="text-2xl font-bold">{rating.ratingValue}</span>
    <span className="text-sm text-neutral-400">
      App Store ({rating.reviewCount} ratings)
    </span>
  </div>
)}
```

**Fallback:** If the API returns null (no ratings yet, fetch failure), omit `aggregateRating` entirely. No fabrication.

**Edge case:** The homepage has `revalidate = 3600` (1 hour). The rating fetch uses `revalidate: 86400` (24 hours) via Next.js cache. The rating updates less frequently than the page.

---

## Fix 4 — Replace Deprecated `HowTo` Schema on TCLOCS Checklist

**File:** `apps/web/src/app/[locale]/(marketing)/tools/tclocs-checklist/page.tsx:49–93`

**Problem:** `HowTo` rich results were removed by Google in September 2023. This schema will never produce a rich result.

**Fix:** Replace only the `HowTo` schema with `Article`. Keep the existing `<JsonLd>` component and breadcrumb as-is (simplicity review: migrating to `<JsonLdGraph>` is scope creep — the existing breadcrumb works fine).

**Dependency:** This fix must be applied AFTER Fix 1 (buildArticle @id must use canonical URL), otherwise the `@id` would reference a non-existent blog path.

```typescript
import { buildArticle } from '@/lib/seo/schema';
import { BASE_URL } from '@/lib/constants';

// Replace the howToSchema object (lines 49-93) with:
const articleUrl = `${BASE_URL}/${locale}/tools/tclocs-checklist`;
const articleSchema = buildArticle({
  url: articleUrl,
  headline: title,
  description: description,
  image: `${BASE_URL}/og-image.png`,
  datePublished: '2026-01-15',
  dateModified: '2026-05-27',
  authorName: 'Andrej Kanuch',
  authorUrl: `${BASE_URL}/about`,
  locale,
  slug: 'tclocs-checklist',
});

// Keep existing <JsonLd data={breadcrumbSchema}> as-is
// Replace <JsonLd data={howToSchema}> with:
<JsonLd data={articleSchema} />
```

Remove the `howToSchema` object (lines 49–93). Keep the `breadcrumbSchema` object and its `<JsonLd>` block unchanged.

---

## Fix 5 — De-duplicate Bike Page FAQ Content

**File:** `apps/web/src/lib/bikes/bike-data.ts`

**Problem:** All 5 Yamaha R1 page types share `R1_FAQS` (4 identical questions). All 5 BMW GS page types share `GS_FAQS`. Google sees identical FAQ structured data across 10 URLs.

**Fix:** Create page-type-specific FAQ arrays. Each page type gets 3–4 questions relevant to its topic:

| Page Type | FAQ Theme | Example Questions |
|-----------|-----------|-------------------|
| `overview` | General ownership | "Is the R1 reliable?", "Best use case?" |
| `maintenance-schedule` | Service intervals | "Oil change interval?", "Valve clearance schedule?" |
| `common-problems` | Known issues | "Common electrical issues?", "Chain wear rate?" |
| `cost-of-ownership` | Costs/value | "Annual maintenance cost?", "Insurance cost?" |
| `service-intervals` | Quick-reference | "When is first service?", "Break-in oil change?" |

**Implementation:**
```typescript
// Replace shared R1_FAQS with:
const R1_OVERVIEW_FAQS: BikeFaqItem[] = [/* overview-specific */];
const R1_MAINTENANCE_FAQS: BikeFaqItem[] = [/* maintenance-specific */];
const R1_PROBLEMS_FAQS: BikeFaqItem[] = [/* problems-specific */];
const R1_COST_FAQS: BikeFaqItem[] = [/* cost-specific */];
const R1_INTERVALS_FAQS: BikeFaqItem[] = [/* intervals-specific */];

// Same pattern for GS_*_FAQS
```

Some thematic overlap is acceptable (e.g. "oil change interval" can appear in both maintenance-schedule and service-intervals with different framing), but no question/answer pair should be identical across pages.

**Content:** 40+ FAQ items needed (5 page types × 2 bikes × 3–4 questions). Write these with real technical accuracy.

---

## ~~Fix 6 — Fix Trip Breadcrumb URLs~~ (SKIPPED)

**Verdict from simplicity review:** The non-locale `/explore/...` routes exist and resolve correctly. The last breadcrumb item correctly omits the `item` property per Schema.org spec. Google's own documentation shows the last breadcrumb without a URL. This fix is unnecessary and would not enable any rich result. **Skipped.**

---

## Fix 7 — Fix Blog Index Author Type

**File:** `apps/web/src/app/[locale]/(marketing)/blog/page.tsx:58–59`

**Problem:** Blog index emits `'@type': 'Organization'` for the author. Andrej Kanuch is a person, not an organization. Individual blog article pages correctly use `@type: 'Person'`.

**Fix:**
```typescript
// BEFORE (line 58-59)
author: { '@type': 'Organization', name: article.author },

// AFTER
author: { '@type': 'Person', name: article.author },
```

One-line change.

---

## Fix 8 — Rewrite Maintenance Blog Title Tags

**Files:** MDX frontmatter `title` field in `apps/web/content/blog/en/`:
- `honda-cbr-cb-maintenance-schedule.mdx`
- `yamaha-mt-r-series-maintenance-schedule.mdx`
- `kawasaki-ninja-z-maintenance-schedule.mdx`
- `harley-davidson-maintenance-schedule-costs.mdx`
- `ducati-monster-panigale-maintenance-schedule.mdx`
- `bmw-gs-r-maintenance-schedule.mdx`

**Problem:** Current titles like "Honda CBR500R & CB650R Service Schedule 2024–2026: Intervals, Costs & DIY Tips" are generic. SXO analysis shows competing titles that win clicks are model-specific and reference-format in tone.

**New titles (English only — localized versions as follow-up):**

| Slug | Current Title | New Title |
|------|--------------|-----------|
| `honda-cbr-cb-maintenance-schedule` | Honda CBR500R & CB650R Service Schedule 2024–2026: Intervals, Costs & DIY Tips | Honda CBR500R, CBR600RR & CB650R Maintenance Schedule — Service Intervals & Costs |
| `yamaha-mt-r-series-maintenance-schedule` | Yamaha MT-07, MT-09 & R Series Maintenance Schedule 2024–2026 | Yamaha MT-07, MT-09, R1 & R7 Maintenance Schedule — Intervals, Valve Specs & Costs |
| `kawasaki-ninja-z-maintenance-schedule` | Kawasaki Ninja & Z Series Maintenance Schedule 2024–2026 | Kawasaki Ninja 400, 650, ZX-6R & Z900 Maintenance Schedule — Service Intervals & Costs |
| `harley-davidson-maintenance-schedule-costs` | Harley-Davidson Maintenance Schedule & Service Costs: Complete Owner's Guide | Harley-Davidson Sportster, Softail & Touring Maintenance Schedule — Intervals & Costs |
| `ducati-monster-panigale-maintenance-schedule` | Ducati Monster & Panigale Maintenance Schedule: Service Intervals & Costs | Ducati Monster 937, Panigale V4 & Multistrada Maintenance — Desmo Intervals & Costs |
| `bmw-gs-r-maintenance-schedule` | BMW R1250GS & R Series Maintenance Schedule: Complete Service Guide | BMW R1250GS, R1250RT & S1000RR Maintenance Schedule — Intervals, Valve Specs & Costs |

**Pattern:** Include 3–4 specific model names. Replace "Complete Service Guide" / "Owner's Guide" with "Service Intervals & Costs". Drop year ranges from titles (the content body covers year ranges).

---

## Fix 9 — Rewrite Maintenance Blog Meta Descriptions

**Files:** Same MDX files as Fix 8, `excerpt` field.

**Problem:** Current descriptions summarize what the article covers. High-CTR descriptions promise the specific answer.

**Example rewrite for Honda:**

```yaml
# BEFORE
excerpt: "Complete Honda CBR and CB series maintenance schedule with oil change intervals, valve clearance specs, and cost breakdown. Covers CBR500R, CB650R, CB300R from 2020–2026."

# AFTER
excerpt: "Honda CBR500R oil changes every 12,000 km. CB650R valve clearance at 24,000 km. Full service interval tables, DIY vs dealer cost comparison, and model-specific schedules for 2020–2026."
```

**Pattern:** Lead with a specific data point (oil change interval), then list what the page delivers (tables, costs, model coverage). Keep under 155 characters.

---

## Fix 10 — Add Source Citations to Blog Statistical Claims

**Files:** MDX content body in maintenance schedule posts and cost-related posts.

**Scope (English only):** Focus on the 6 maintenance schedule posts + `motorcycle-maintenance-cost-per-year.mdx` + `true-cost-motorcycle-ownership.mdx`.

**Citation format:** Inline hyperlinks where claims are made, plus a "Sources" section at the bottom.

**Example additions:**

```markdown
<!-- Inline citation -->
Honda specifies oil changes every 12,000 km ([Honda CBR500R Owner's Manual](https://www.honda.co.uk/motorcycles/range/sport/cbr500r/owners-manuals.html), Section 6).

<!-- Sources section at bottom -->
## Sources

- Honda CBR500R Owner's Manual (2024), Section 6: Maintenance Schedule
- Yamaha YZF-R1 Service Manual (2023), Chapter 3: Periodic Maintenance
- [NHTSA Motorcycle Safety Statistics](https://www.nhtsa.gov/road-safety/motorcycles)
```

**Target:** Each article should cite at least 2–3 named external sources (manufacturer manuals, industry reports, or authoritative reference sites).

---

## Acceptance Criteria

### Phase 1 — Schema Code Fixes
- [x] Fix 1: `buildArticle` `@id` uses canonical URL with inline comment explaining divergence — `schema.ts:242`
- [x] Fix 2: Article `image` is `ImageObject` with hardcoded 1200x630; `wordCount` emitted when present — `schema.ts:246`
- [x] Fix 3: Homepage passes `AggregateRating` from iTunes API when available; rating visible on page; file at `lib/seo/app-store-rating.ts` — `page.tsx`
- [x] Fix 4: TCLOCS uses `Article` schema via `buildArticle` + existing `<JsonLd>`; no `HowTo` — `tclocs-checklist/page.tsx` (apply AFTER Fix 1)
- [x] ~~Fix 6: Skipped — breadcrumbs already valid~~
- [x] Fix 7: Blog index author type is `Person` not `Organization` — `blog/page.tsx:58`
- [x] Tests updated in `apps/web/src/lib/seo/__tests__/jsonld.test.ts` (7 new tests: buildArticle @id, ImageObject, wordCount, buildSoftwareApplication aggregateRating)
- [ ] All schema changes pass Google Rich Results Test on representative URLs
- [x] `pnpm precheck` passes (lint + typecheck + test)

### Phase 2 — Content Fixes
- [x] Fix 5: Each bike page type has unique FAQ content — `bike-data.ts`
- [x] Fix 8: All 6 maintenance blog posts have rewritten title tags — MDX frontmatter
- [x] Fix 9: All 6 maintenance blog posts have rewritten meta descriptions — MDX frontmatter
- [x] Fix 10: At least 2–3 source citations added to each maintenance + cost blog post

## Dependencies & Risks

- **App Store rating availability:** If the app has 0 ratings, Fix 3 gracefully degrades (no rating shown). No risk.
- **iTunes API reliability:** The lookup API is free and stable, but we cache for 24h and handle failures. No risk.
- **Bike FAQ quality:** Fix 5 requires 40+ unique FAQ items with real technical accuracy. Risk of thin content if rushed.
- **i18n:** Fixes 1–4, 6–7 work across all locales automatically (code changes). Fixes 8–10 are English-only; localized versions are a follow-up.
- **No breaking changes:** All schema `@id` changes are internal identifiers, not user-facing URLs. No redirect needed.

## Sources & References

- **Schema code:** `apps/web/src/lib/seo/schema.ts` — all builders
- **Blog content:** `apps/web/content/blog/{locale}/*.mdx` — MDX with gray-matter frontmatter
- **Bike data:** `apps/web/src/lib/bikes/bike-data.ts` — FAQ fixtures
- **Trip pages:** `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` — inline JSON-LD
- **Blog article page:** `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`
- **Blog index page:** `apps/web/src/app/[locale]/(marketing)/blog/page.tsx`
- **Homepage:** `apps/web/src/app/[locale]/(marketing)/page.tsx`
- **TCLOCS page:** `apps/web/src/app/[locale]/(marketing)/tools/tclocs-checklist/page.tsx`
- **Author registry:** `apps/web/src/lib/authors.ts`
- **JSON-LD components:** `apps/web/src/components/marketing/json-ld-graph.tsx`, `json-ld.tsx`
- **Existing tests:** `apps/web/src/lib/seo/__tests__/jsonld.test.ts`
- **Institutional learning:** XSS prevention in JSON-LD (`.replace(/</g, '\\u003c')`) — `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`
