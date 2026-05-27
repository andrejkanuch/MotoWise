---
title: "feat: SEO Content Cluster Architecture — Maintenance Topic Hub"
type: feat
status: active
date: 2026-05-27
---

# feat: SEO Content Cluster Architecture — Maintenance Topic Hub

## Overview

Cluster analysis of "motorcycle maintenance" identified 6 topic clusters, 2 active cannibalization issues, 3 missing pillar pages, and 5 new content opportunities. This plan implements all 8 prioritized actions from the analysis to build a hub-and-spoke content architecture that connects 26 existing blog posts into a coherent topic cluster.

## Problem Statement

- 26 maintenance blog posts generating 3,500+ impressions operate in isolation with no topic hierarchy
- 2 pairs of posts cannibalize each other (warning lights + CEL, battery + won't-start)
- 3 pillar pages are completely missing (diagnostics, DIY, seasonal)
- Brand schedule posts (3,435 combined impressions) have no hub connecting them to the root pillar
- Trip planner queries (50 impressions at position 60) have zero content

## Technical Approach

### Phase 1: Cannibalization Fixes (Actions 1-2)

Merge duplicate-intent posts and add 301 redirects. Zero new content needed.

### Phase 2: New Pillar Pages (Actions 3-4, 6-7)

Create 4 new pillar/hub pages that connect orphaned spokes.

### Phase 3: New Spoke Content (Action 5)

Create 1 new spoke page targeting proven GSC demand.

### Phase 4: Internal Link Architecture (Action 8)

Add cross-links between all posts to build the hub-and-spoke structure.

---

## Action 1 — Merge Warning Lights into Check Engine Light Guide

**Cannibalization:** 7 shared SERP URLs. `motorcycle-warning-lights-guide` (23 impr) splits intent with `motorcycle-check-engine-light-guide` (260 impr).

**Files:**
- `apps/web/content/blog/en/motorcycle-check-engine-light-guide.mdx` — absorb content
- `apps/web/content/blog/en/motorcycle-warning-lights-guide.mdx` — delete after merge
- Localized versions: `es/`, `fr/`, `de/`, `it/` if they exist
- `apps/web/next.config.ts` — add 301 redirect

**Implementation:**
1. Read both posts fully
2. Merge unique content from `motorcycle-warning-lights-guide` into `motorcycle-check-engine-light-guide`:
   - Add the dashboard symbols/visual guide content as a new H2 section
   - Keep the stronger post's structure as the base
   - Update title to encompass both topics: "Motorcycle Warning Lights & Check Engine Light: Complete Dashboard Guide"
   - Update excerpt, keywords, readingTime
   - Update wordCount in frontmatter
3. Delete `motorcycle-warning-lights-guide.mdx` from all locale directories
4. Add 301 redirect in `next.config.ts`:
   ```typescript
   { source: '/:locale/blog/motorcycle-warning-lights-guide', destination: '/:locale/blog/motorcycle-check-engine-light-guide', permanent: true },
   { source: '/blog/motorcycle-warning-lights-guide', destination: '/blog/motorcycle-check-engine-light-guide', permanent: true },
   ```
5. Remove the deleted post from any internal links in other posts

---

## Action 2 — Merge Battery Dying into Won't-Start Guide

**Cannibalization:** 5 shared SERP URLs. `motorcycle-battery-keeps-dying-fix` (19 impr) is a sub-cause of `motorcycle-wont-start-troubleshooting-guide` (28 impr).

**Files:**
- `apps/web/content/blog/en/motorcycle-wont-start-troubleshooting-guide.mdx` — absorb content
- `apps/web/content/blog/en/motorcycle-battery-keeps-dying-fix.mdx` — delete after merge
- `apps/web/next.config.ts` — add 301 redirect

**Implementation:**
1. Read both posts fully
2. Merge battery diagnostics content (parasitic draw testing, charging system faults, battery replacement guide) into the won't-start guide as an expanded H2 section
3. Update title: "Motorcycle Won't Start? Complete Troubleshooting & Battery Diagnosis Guide"
4. Update excerpt, keywords, readingTime, wordCount
5. Delete `motorcycle-battery-keeps-dying-fix.mdx`
6. Add 301 redirects (same pattern as Action 1)
7. Update internal links in other posts

---

## Action 3 — Create Diagnostics & Troubleshooting Pillar

**Gap:** 5 orphaned symptom posts (333 combined impressions) with no hub page. Highest-volume missing cluster.

**New file:** `apps/web/content/blog/en/motorcycle-troubleshooting-guide.mdx`

**Structure:**
```yaml
slug: motorcycle-troubleshooting-guide
title: "Motorcycle Troubleshooting Guide: Diagnose Any Problem Step by Step"
excerpt: "Systematic approach to diagnosing motorcycle problems — from engine issues and electrical faults to brake and suspension concerns. Covers symptoms, causes, and when to use AI diagnostics."
keywords: ["motorcycle troubleshooting", "motorcycle problems", "motorcycle diagnosis", "motorcycle not running right"]
author: "Andrej Kanuch"
date: "2026-05-27"
readingTime: "15"
locale: "en"
heroImage: "/images/blog/motorcycle-troubleshooting-guide-hero.webp"
heroAlt: "Rider diagnosing a motorcycle problem with diagnostic tools and a smartphone"
category: "troubleshooting"
wordCount: 3500
```

**Content sections:**
1. Introduction — systematic troubleshooting methodology
2. Engine Won't Start (link to: motorcycle-wont-start-troubleshooting-guide)
3. Strange Noises (link to: motorcycle-clicking-noise-diagnosis)
4. Engine Stalling (link to: motorcycle-stalling-at-idle-fix)
5. Overheating (link to: motorcycle-overheating-causes-solutions)
6. Oil Leaks (link to: motorcycle-leaking-oil-causes-fixes)
7. Warning Lights & Error Codes (link to: motorcycle-check-engine-light-guide)
8. When to Use AI Diagnostics — CTA for MotoVault's AI feature
9. Sources section

**CTA angle:** "Point your camera at the problem. MotoVault's AI diagnostics can identify issues from photos — no OBD hardware needed."

---

## Action 4 — Create Seasonal Maintenance Pillar

**Gap:** 8,100 monthly searches for "how to winterize a motorcycle". Existing winter and spring posts (5 impressions each at position 13-36) are orphaned.

**New file:** `apps/web/content/blog/en/motorcycle-seasonal-maintenance-guide.mdx`

**Structure:**
```yaml
slug: motorcycle-seasonal-maintenance-guide
title: "Motorcycle Seasonal Maintenance: Winterization, Spring Prep & Year-Round Care"
excerpt: "Complete guide to motorcycle seasonal maintenance — winterization checklist, spring de-winterization, summer heat management, and fall prep. Keep your bike ready every season."
keywords: ["motorcycle seasonal maintenance", "how to winterize motorcycle", "motorcycle spring prep", "motorcycle storage"]
author: "Andrej Kanuch"
date: "2026-05-27"
readingTime: "14"
locale: "en"
heroImage: "/images/blog/motorcycle-seasonal-maintenance-guide-hero.webp"
heroAlt: "Motorcycle in a garage with seasonal maintenance tools and storage supplies"
category: "maintenance"
wordCount: 3200
```

**Content sections:**
1. Why Seasonal Maintenance Matters
2. Fall: Preparing for Winter Storage (link to: how-to-winterize-motorcycle-guide)
3. Winter: Long-Term Storage Best Practices
4. Spring: De-Winterization Checklist (link to: spring-motorcycle-prep-checklist)
5. Summer: Heat Management & Extended Riding
6. Year-Round Quick Reference Calendar
7. Track It All in MotoVault — maintenance reminder CTA
8. Sources section

---

## Action 5 — Create Trip Planner Apps Post

**Opportunity:** 50 GSC impressions at position 59-62 with zero targeting content. "motorcycle trip planner" and "motorcycle route planner" share 8 SERP URLs.

**New file:** `apps/web/content/blog/en/best-motorcycle-trip-planner-apps.mdx`

**Structure:**
```yaml
slug: best-motorcycle-trip-planner-apps
title: "Best Motorcycle Trip Planner Apps in 2026: Route Planning, Navigation & Group Rides"
excerpt: "Compare the top motorcycle trip planner apps — MotoVault, REVER, Calimoto, Kurviger, and Scenic. Route planning features, offline maps, GPX support, and pricing compared."
keywords: ["motorcycle trip planner app", "motorcycle route planner", "best motorcycle navigation app", "motorcycle trip planning"]
author: "Andrej Kanuch"
date: "2026-05-27"
readingTime: "12"
locale: "en"
heroImage: "/images/blog/best-motorcycle-trip-planner-apps-hero.webp"
heroAlt: "Smartphone showing a motorcycle route planning app with a mountain road"
category: "comparison"
wordCount: 2800
```

**Content sections:**
1. What to Look for in a Motorcycle Trip Planner
2. MotoVault — Trip planning + maintenance + expenses in one app
3. REVER — Community routes and group ride coordination
4. Calimoto — Curvy road algorithm and offline navigation
5. Kurviger — European focus, avoid highways, GPX export
6. Scenic — CarPlay/Android Auto integration
7. Feature Comparison Table
8. Which App Is Right for You? (decision tree)
9. Sources section

**Internal links:** Cross-link with existing compare pages (vs-rever, vs-calimoto, vs-kurviger, vs-scenic) and `best-motorcycle-maintenance-apps-2026`.

---

## Action 6 — Create Brand Maintenance Schedules Hub Page

**Gap:** 6 brand schedule posts (3,435 combined impressions) have no connecting hub page to funnel authority to the root pillar.

**New file:** `apps/web/content/blog/en/motorcycle-maintenance-schedules-by-brand.mdx`

**Structure:**
```yaml
slug: motorcycle-maintenance-schedules-by-brand
title: "Motorcycle Maintenance Schedules by Brand: Honda, Yamaha, Kawasaki, Ducati, BMW & Harley"
excerpt: "Find your motorcycle's maintenance schedule by brand. Quick-reference service interval tables for Honda, Yamaha, Kawasaki, Harley-Davidson, Ducati, and BMW models."
keywords: ["motorcycle maintenance schedule", "motorcycle service intervals", "motorcycle maintenance by brand"]
author: "Andrej Kanuch"
date: "2026-05-27"
readingTime: "8"
locale: "en"
heroImage: "/images/blog/motorcycle-maintenance-schedules-by-brand-hero.webp"
heroAlt: "Six motorcycle brands logos with maintenance tools and service manual"
category: "maintenance"
wordCount: 2000
```

**Content sections:**
1. Introduction — why following your brand's schedule matters
2. Honda CBR & CB Series (summary table + link to full post)
3. Yamaha MT & R Series (summary table + link to full post)
4. Kawasaki Ninja & Z Series (summary table + link to full post)
5. Harley-Davidson (summary table + link to full post)
6. Ducati Monster & Panigale (summary table + link to full post)
7. BMW GS & R Series (summary table + link to full post)
8. Universal Maintenance Items (oil, chain, brakes, coolant)
9. Track Your Schedule with MotoVault — CTA

---

## Action 7 — Create DIY Maintenance Pillar

**Gap:** 3 DIY posts at positions 29-38 with near-zero clicks. No hub page connecting them.

**New file:** `apps/web/content/blog/en/motorcycle-diy-maintenance-guide.mdx`

**Structure:**
```yaml
slug: motorcycle-diy-maintenance-guide
title: "Motorcycle DIY Maintenance Guide: What You Can Do at Home vs What Needs a Mechanic"
excerpt: "Which motorcycle maintenance jobs can you safely do yourself? Complete DIY guide covering oil changes, chain adjustment, brake pads, and more — with difficulty ratings and tool lists."
keywords: ["motorcycle DIY maintenance", "motorcycle home maintenance", "motorcycle maintenance yourself", "motorcycle maintenance tools"]
author: "Andrej Kanuch"
date: "2026-05-27"
readingTime: "13"
locale: "en"
heroImage: "/images/blog/motorcycle-diy-maintenance-guide-hero.webp"
heroAlt: "Hands working on a motorcycle with basic tools in a home garage"
category: "maintenance"
wordCount: 3000
```

**Content sections:**
1. DIY vs Mechanic: How to Decide
2. Essential Tools Every Rider Needs
3. Easy DIY Jobs (oil change, chain adjustment, brake pads) — links to existing posts
4. Intermediate Jobs (coolant flush, spark plugs, air filter)
5. Leave It to the Pros (valve clearance, suspension, fuel injection)
6. Cost Savings: DIY vs Dealer (link to cost-per-year post)
7. Track Your DIY Work in MotoVault — CTA
8. Sources section

---

## Action 8 — Build Internal Link Architecture

**Files:** All existing + new blog posts need cross-links added.

**Links to add to existing posts:**

| Post | Add Link To | Anchor |
|------|------------|--------|
| Each brand schedule post | `motorcycle-maintenance-schedules-by-brand` | "See all brand schedules" |
| Each brand schedule post | `motorcycle-maintenance-cost-per-year` | "maintenance cost breakdown" |
| `complete-motorcycle-maintenance-guide-2026` | `motorcycle-maintenance-schedules-by-brand` | "brand-specific schedules" |
| `complete-motorcycle-maintenance-guide-2026` | `motorcycle-diy-maintenance-guide` | "DIY maintenance guide" |
| `complete-motorcycle-maintenance-guide-2026` | `motorcycle-seasonal-maintenance-guide` | "seasonal maintenance" |
| `complete-motorcycle-maintenance-guide-2026` | `motorcycle-troubleshooting-guide` | "troubleshooting guide" |
| Each symptom post (clicking, stalling, etc.) | `motorcycle-troubleshooting-guide` | "full troubleshooting guide" |
| `how-to-winterize-motorcycle-guide` | `motorcycle-seasonal-maintenance-guide` | "complete seasonal guide" |
| `spring-motorcycle-prep-checklist` | `motorcycle-seasonal-maintenance-guide` | "year-round seasonal care" |
| `how-to-change-motorcycle-oil-diy` | `motorcycle-diy-maintenance-guide` | "complete DIY guide" |
| `motorcycle-chain-adjustment-lubrication` | `motorcycle-diy-maintenance-guide` | "more DIY tasks" |
| `motorcycle-brake-pad-replacement-diy` | `motorcycle-diy-maintenance-guide` | "DIY maintenance guide" |
| `best-motorcycle-maintenance-apps-2026` | `best-motorcycle-trip-planner-apps` | "trip planner apps" |

---

## Acceptance Criteria

### Phase 1 — Cannibalization Fixes
- [ ] Warning lights content merged into check engine light guide
- [ ] `motorcycle-warning-lights-guide` deleted from all locale directories
- [ ] Battery dying content merged into won't-start guide
- [ ] `motorcycle-battery-keeps-dying-fix` deleted from all locale directories
- [ ] 301 redirects added in `next.config.ts` for both deleted slugs
- [ ] Internal links to deleted posts updated across all remaining posts

### Phase 2 — New Pillar Pages
- [ ] `motorcycle-troubleshooting-guide.mdx` created (3,500+ words)
- [ ] `motorcycle-seasonal-maintenance-guide.mdx` created (3,200+ words)
- [ ] `motorcycle-maintenance-schedules-by-brand.mdx` created (2,000+ words)
- [ ] `motorcycle-diy-maintenance-guide.mdx` created (3,000+ words)

### Phase 3 — New Spoke Content
- [ ] `best-motorcycle-trip-planner-apps.mdx` created (2,800+ words)

### Phase 4 — Internal Links
- [ ] Cross-links added to all existing posts per the link matrix
- [ ] New pillar pages link to their spokes
- [ ] All new pages have Sources sections

### Quality Gates
- [ ] `pnpm precheck` passes
- [ ] No broken internal links (all slugs resolve)
- [ ] Word counts meet minimums per post
- [ ] Each new post has proper frontmatter (slug, title, excerpt, keywords, author, date, heroImage, category, wordCount)

## Dependencies & Risks

- **Content quality:** 5 new posts totaling ~14,500 words. Must be technically accurate motorcycle content, not generic.
- **Hero images:** New posts reference hero images that don't exist yet on disk (they're likely generated via OG image generation). This is consistent with existing posts.
- **Redirect timing:** 301 redirects should be deployed before Google recrawls the deleted URLs (within days of deploy).
- **Localized versions:** Only English versions are created. Localized translations are a follow-up.

## Sources & References

- **Cluster analysis output:** `outputs/MotoVault/seo-cluster/cluster-plan.json`
- **Blog content directory:** `apps/web/content/blog/en/*.mdx`
- **Redirect config:** `apps/web/next.config.ts`
- **Blog reader:** `apps/web/src/lib/blog.ts`
- **Existing posts to merge:** `motorcycle-warning-lights-guide.mdx`, `motorcycle-battery-keeps-dying-fix.mdx`
- **Existing posts to link:** All 26 current maintenance/troubleshooting posts
