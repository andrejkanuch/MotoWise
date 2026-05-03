---
title: "feat: Implement SEO audit findings — LCP, CTR, schema, GEO"
type: feat
status: active
date: 2026-05-03
---

# Implement SEO Audit Findings

Implement the top-priority findings from the full SEO audit + GSC data analysis. Focuses on quick wins that directly impact Core Web Vitals (LCP), click-through rate on page-1 rankings, and AI search citability.

## Overview

GSC data (Mar 12 – May 1) shows:
- 112 pages indexed, 2,625 impressions, 51 clicks
- 7 blog posts on page 1 with **zero clicks** (CTR problem, not ranking problem)
- ES AI diagnostics page: 8.3% CTR at position 6.6 — EN version: 0% at position 6.2
- /compare: 462 impressions at position 19, 1 click
- Impressions growing 14x in 7 weeks — momentum is strong

## Phases

### Phase 1: Performance (LCP Fix) — Critical

**Goal:** LCP from ~3.5s → <2.5s

#### 1.1 Remove full-screen loading spinner

**File:** `apps/web/src/app/loading.tsx`

The root loading.tsx renders a `position: fixed; inset: 0; z-index: 50` overlay that blocks all visual content until hydration completes. This directly delays LCP.

**Action:** Replace with a skeleton/transparent overlay or remove entirely. The marketing pages are SSR — the shell renders meaningful content before JS hydrates.

```tsx
// apps/web/src/app/loading.tsx — replace full-screen blocker with minimal indicator
export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 50,
        background: 'linear-gradient(90deg, transparent, oklch(0.84 0.15 68), transparent)',
        animation: 'mv-load-slide 1.2s ease-in-out infinite',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: '@keyframes mv-load-slide{0%{transform:translateX(-100%)}to{transform:translateX(100%)}}' }} />
    </div>
  );
}
```

#### 1.2 Fix hero image loading strategy

**File:** `apps/web/src/components/marketing/hero.tsx`

The hero uses CSS `background-image` in a client component. The images are not preloaded and are discovered late by the browser.

**Action:**
- Add `<link rel="preload" as="image" fetchPriority="high">` for the first hero image in the marketing layout head
- OR convert first slide to a Next.js `<Image priority>` component (preferred)

```tsx
// In apps/web/src/app/[locale]/(marketing)/layout.tsx or head
// Add preload for first hero image
<link rel="preload" as="image" href="/images/marketing/hero-rider.jpg" fetchPriority="high" />
```

#### 1.3 Enable ISR caching for homepage

**File:** `apps/web/src/app/[locale]/(marketing)/page.tsx`

GSC shows the page already has `revalidate: 3600`. Verify the response header is `cache-control: public, s-maxage=3600, stale-while-revalidate=86400` and NOT `private, no-cache`. If Vercel/Cloudflare is overriding with no-cache, add explicit cache headers in `next.config.ts`.

---

### Phase 2: CTR Optimization — High Priority

**Goal:** Generate clicks from existing page-1 impressions

#### 2.1 Rewrite blog post titles for CTR

These posts rank page 1 but get 0 clicks. Rewrite titles in frontmatter + meta:

| Post | Current Title (inferred) | New Title |
|------|--------------------------|-----------|
| honda-cbr-cb-maintenance-schedule | Honda CBR & CB Maintenance Schedule | Honda CBR500R & CB650R Service Schedule 2024-2026: Intervals, Costs & DIY Guide |
| yamaha-mt-r-series-maintenance-schedule | Yamaha MT & R Series Maintenance | Yamaha MT-07, MT-09 & R1 Maintenance Schedule: Oil Change Intervals + Costs |
| kawasaki-ninja-z-maintenance-schedule | Kawasaki Ninja & Z Maintenance | Kawasaki Ninja 650 & Z900 Maintenance Schedule: Complete Service Guide 2026 |
| harley-davidson-maintenance-schedule-costs | Harley Maintenance Costs | Harley-Davidson Maintenance Costs 2026: Dealership vs DIY ($340–$1,200/yr) |
| ducati-monster-panigale-maintenance-schedule | Ducati Maintenance Schedule | Ducati Monster & Panigale Desmo Service: Intervals, Costs & When to DIY |
| true-cost-motorcycle-ownership | True Cost of Motorcycle Ownership | What Does a Motorcycle Really Cost? $3,400–$6,800/Year Breakdown (2026) |
| motorcycle-maintenance-cost-per-year | Maintenance Cost Per Year | Motorcycle Maintenance Cost Per Year: Budget by Bike Type (Sport vs Cruiser vs ADV) |

**Files:** `apps/web/src/content/blog/{slug}/en.mdx` — update `title` and `excerpt` in frontmatter.

Also update meta descriptions to include:
- A number (cost, time, count)
- The current year
- A benefit or differentiator

#### 2.2 Fix EN AI diagnostics title

**File:** `apps/web/messages/en.json` → `FeaturesDiagnostics.title`

Current: `"AI Motorcycle Diagnostics — No Hardware Needed"` (59 chars, technical)
ES version: `"Diagnóstico de Motos con IA"` (29 chars, simple, 8.3% CTR)

The EN title is too long and feature-focused. Shorter, benefit-oriented titles win in mobile SERPs.

**New EN title:** `"AI Motorcycle Diagnostics — Free Photo Scanner"`
**New EN description:** `"Point your camera at any motorcycle problem. Get an instant AI diagnosis with severity rating and fix steps. Free for all 18,000+ bike models."`

#### 2.3 Homepage meta description optimization

**File:** `apps/web/messages/en.json` → `Metadata.description`

Current: `"Plan multi-day motorcycle trips, discover routes worldwide, track maintenance and expenses, and diagnose issues with AI — all in one free app for iOS and Android."`

**New:** `"Free motorcycle app: plan multi-day trips, track maintenance costs, and diagnose issues with AI photo scanning. 12,000+ models supported. iOS & Android."`

Adds: number (12,000+), keeps "free" prominent, shorter (under 155 chars).

---

### Phase 3: Cookie Banner Fix — High Priority

**Goal:** Stop blocking 66% of mobile viewport on first visit

**File:** `apps/web/src/components/cookie-consent.tsx`

**Action:** Redesign the main banner view from centered modal to bottom-anchored slim bar:

- Max height: 80px on mobile (currently ~540px)
- Horizontal layout: text + "Accept" + "Settings" buttons
- No background overlay/backdrop
- Preserve all existing consent logic, just change presentation
- Keep the detailed "List View" as a slide-up panel when "Settings" is tapped

```tsx
// Conceptual layout for the banner (not the list/detail view)
<div style={{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  background: 'oklch(0.15 0.01 55 / 0.95)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid oklch(1 0 0 / 0.08)',
  zIndex: 9999,
}}>
  <p style={{ flex: 1, fontSize: '13px', margin: 0 }}>We use cookies for analytics.</p>
  <button>Settings</button>
  <button>Accept</button>
</div>
```

---

### Phase 4: Schema Fixes — Medium Priority

**File:** `apps/web/src/lib/seo/schema.ts`

#### 4.1 Fix operatingSystem (string → array)

```diff
- operatingSystem: 'iOS, ANDROID',
+ operatingSystem: ['iOS', 'Android'],
```

#### 4.2 Add aggregateRating (when real data available)

The schema already supports `aggregateRating` via the `AggregateRatingInput` interface. We need to:
1. Check actual App Store + Play Store ratings
2. Pass real values to `buildSoftwareApplication()` in the homepage
3. Display the same rating visibly on the page (Google requires visible text matching schema)

**File:** `apps/web/src/app/[locale]/(marketing)/page.tsx` — pass `aggregateRating` prop when calling schema builder.

#### 4.3 No SearchAction needed

The schema file correctly notes SearchAction was deprecated Nov 2024. Skip this recommendation from the audit.

---

### Phase 5: FAQ Expansion for GEO — Medium Priority

**Goal:** Expand from 5 to 15+ questions with 134-167 word answers for optimal AI citation.

**File:** `apps/web/src/components/marketing/faq.tsx`

Add these questions (answers should be 134-167 words, self-contained, with source citations):

1. What is MotoVault? (keep, expand to 150 words)
2. Is it really free? (keep, expand)
3. How does AI diagnostics work? (keep, expand with source: "powered by Claude Vision")
4. What bikes does it support? (keep, add "source: NHTSA vPIC Database")
5. Is my data safe? (keep, expand)
6. **NEW:** How does trip planning work?
7. **NEW:** Can I use MotoVault offline?
8. **NEW:** How is MotoVault different from REVER or Calimoto?
9. **NEW:** What maintenance reminders does MotoVault send?
10. **NEW:** Can I track expenses for multiple bikes?
11. **NEW:** Does MotoVault work with OBD scanners?
12. **NEW:** Can I export my ride data as GPX?
13. **NEW:** What countries are motorcycle routes available in?
14. **NEW:** How accurate is the AI diagnostic feature?
15. **NEW:** Is there a desktop/web version?

Update `buildFAQPage()` call on homepage to include all 15 items.

---

### Phase 6: Homepage Headings for AI Citability — Medium Priority

**Goal:** Add question-based H2s and a definitional opening paragraph.

**File:** `apps/web/src/app/[locale]/(marketing)/page.tsx` (or relevant section components)

**Action:**
1. Add a 30-word definitional paragraph above or within the hero subtitle area:
   > "MotoVault is a free motorcycle management app that combines trip planning, maintenance tracking, expense logging, and AI-powered diagnostics in a single platform for riders."

2. Replace/augment section headings:
   - "Four tools. One app." → keep as visual, but add an `<h2>` with "What can MotoVault do?"
   - Feature sections: Add question-based headings as `aria-label` or visually hidden H2s for crawlers

---

### Phase 7: Sitemap Cleanup — Low Priority

**File:** `apps/web/src/app/sitemap.ts`

#### 7.1 Deduplicate /explore entry
Check if `/explore` appears in both the static pages list AND the route discovery section. Remove one.

#### 7.2 Resolve -2 slug duplicates
These are data-layer issues in the routes API. Either:
- Fix at the API level (deduplicate route slugs in NestJS)
- Or filter `-2` suffix URLs from sitemap generation

---

### Phase 8: Touch Targets — Low Priority

**File:** `apps/web/src/components/cookie-consent.tsx` + navigation

- Increase all interactive element heights to minimum 48px
- Focus on: hamburger menu button, cookie banner buttons, privacy policy link
- Add `min-height: 48px` and appropriate padding

---

### Phase 9: IndexNow Integration — Low Priority

IndexNow API route already exists at `apps/web/src/app/api/indexnow/route.ts`. What's missing:
- Automatic triggering when new content is published
- The key file at `/.well-known/{key}.txt`

**Action:**
1. Create `apps/web/public/.well-known/{INDEXNOW_KEY}.txt` containing the key
2. Add IndexNow ping to the blog/route publish workflow (could be a webhook from Supabase or a build-time script)

---

## Acceptance Criteria

- [ ] LCP < 2.5s on mobile (measured via Lighthouse)
- [ ] No full-screen loading spinner blocking content
- [ ] Hero image preloaded with high priority
- [ ] Blog post titles include year + model specifics + numbers
- [ ] EN AI diagnostics title shortened and benefit-oriented
- [ ] Cookie banner max 80px height on mobile (slim bottom bar)
- [ ] `operatingSystem` is `['iOS', 'Android']` in schema
- [ ] FAQ expanded to 15+ questions with 134-167 word answers
- [ ] Homepage has a definitional paragraph for AI extraction
- [ ] No duplicate /explore in sitemap
- [ ] Touch targets ≥ 48px on all interactive elements

## Out of Scope (needs separate work)

- YouTube video creation (content/marketing task)
- Reddit/forum presence building (community task)
- Editorial roundup outreach (PR/marketing task)
- Blog content expansion (separate content calendar)
- /pricing page creation (new feature)
- Brand disambiguation / Knowledge Panel claim
- aggregateRating (blocked until sufficient real reviews)

## Sources

- GSC export: `/Users/andrejmacm5/Downloads/https___motovault.app_-Performance-on-Search-2026-05-03/`
- SEO audit: conducted 2026-05-03 with 8 parallel subagents
- Schema reference: `apps/web/src/lib/seo/schema.ts` (already supports aggregateRating)
- IndexNow already implemented: `apps/web/src/app/api/indexnow/route.ts`
- SearchAction deprecated Nov 2024 (documented in schema.ts comments)
