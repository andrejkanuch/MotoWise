---
title: "feat: Comprehensive SEO Strategy Implementation"
type: feat
status: active
date: 2026-03-22
---

# feat: Comprehensive SEO Strategy Implementation

## Enhancement Summary

**Deepened on:** 2026-03-22
**Sections enhanced:** 7
**Research agents used:** Schema best practices, IndexNow implementation, Security sentinel, TOC patterns, Performance oracle

### Key Improvements
1. **HowTo schema REMOVED** — deprecated by Google (Sept 2023), zero rich result benefit. Keep procedural content structure but skip the schema markup.
2. **IndexNow hardened** — URL origin validation against BASE_URL, `crypto.timingSafeEqual` for secret, rate limiting added.
3. **Performance optimized** — wordCount stored in frontmatter (not computed at runtime), headings extracted via rehype plugin during compileMDX (not regex).
4. **Breadcrumb locale fix** — URLs must use current locale via `getCanonicalUrl(locale, path)`, not hardcoded English BASE_URL.
5. **Type safety** — added `schema-dts` dev dependency for compile-time JSON-LD validation.
6. **Security** — SSRF prevention on IndexNow, consolidated duplicate JsonLd components, enhanced XSS escaping.

### Critical Changes from Original Plan
- **REMOVED Phase 2c (HowTo schema)** — Google deprecated HowTo rich results. Not worth implementing.
- **CHANGED wordCount** — from runtime `content.split()` to frontmatter field (zero runtime cost)
- **CHANGED TOC headings** — from regex extraction to rehype plugin piggybacking on compileMDX
- **ADDED** URL origin validation and timing-safe secret comparison to IndexNow
- **ADDED** `schema-dts` for type-safe structured data
- **ADDED** breadcrumb locale awareness (was hardcoded to English)

## Overview

Implement a comprehensive SEO strategy for motovault.app based on a full-site audit. The audit revealed: Technical SEO 87/100, Content Quality 72/100, GEO (AI Search) 61/100. The primary gaps are conflicting robots.txt directives, missing schema enhancements, weak E-E-A-T signals, and content not optimized for AI citation.

## Problem Statement / Motivation

MotoVault targets three keyword clusters: **motorcycle maintenance tracking** (highest volume), **AI-powered diagnostics** (differentiator), and **motorcycle expense tracking** (cost of ownership). The site has strong technical foundations but critical gaps that prevent it from ranking for these terms and being cited by AI search engines.

Key issues:
- Cloudflare injects AI crawler blocks that contradict our explicit Allow rules — GPTBot and ClaudeBot may be entirely blocked
- MobileApplication schema uses wrong category and lacks Pro offer, featureList, screenshots
- Procedural blog articles (oil change, brake pads) lack HowTo schema for featured snippets
- No About page hurts E-E-A-T for YMYL-adjacent motorcycle safety content
- Blog headings are declarative, not question-based — poor match for AI citation queries
- No table of contents on 3,000+ word articles
- llms.txt lacks citation license
- No IndexNow for fast indexing of new blog content

## Technical Approach

### Architecture

All changes are in `apps/web/` (Next.js 16 App Router). Key conventions:
- Use `BASE_URL` from `apps/web/src/lib/constants.ts` for all absolute URLs
- Use shared `<JsonLd>` component from `@/components/marketing/json-ld`
- Escape JSON-LD with `.replace(/</g, '\\u003c')` for XSS prevention
- Do NOT enable `cacheComponents` (PPR disabled due to next-intl conflict)
- Translations via `next-intl` `getTranslations()` in server components

### Implementation Phases

#### Phase 1: Critical Fixes (robots.txt + testimonials)

**1a. Fix robots.txt** `apps/web/src/app/robots.ts`

The Cloudflare-managed bot blocking at the CDN level injects Disallow rules that conflict with our code-generated robots.txt. Since our `robots.ts` generates the correct rules but Cloudflare overrides them at the edge:

- Go to **Cloudflare Dashboard > Security > Bots > Bot Fight Mode** and disable AI bot blocking for GPTBot, ClaudeBot (keep blocking CCBot, Google-Extended, Bytespider, etc.)
- Alternatively, configure Cloudflare to not modify robots.txt responses
- Verify by curling `https://motovault.app/robots.txt` and confirming no duplicate user-agent blocks
- The existing `robots.ts` code is correct and needs no changes

**1b. Fix testimonial inconsistency** `apps/web/messages/*.json` (all 12 locales)

- Change `socialProof` CTA text from "Trusted by thousands of riders worldwide" to use the specific "2,400+" figure
- Update all 12 locale files: en, es, de, fr, it, pt-BR, ja, hi, th, id, tr, pl

#### Phase 2: Schema Enhancements

**2a. Update MobileApplication schema** `apps/web/src/app/[locale]/(marketing)/page.tsx`

```typescript
// Replace the softwareAppSchema object
const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  '@id': `${BASE_URL}/#app`,
  name: 'MotoVault',
  applicationCategory: 'UtilitiesApplication',
  applicationSubCategory: 'Motorcycle Maintenance',
  operatingSystem: ['iOS', 'Android'],
  description: t('JsonLd.appDescription'),
  url: BASE_URL,
  downloadUrl: [
    'https://apps.apple.com/us/app/motovault/id6760291360',
    'https://play.google.com/store/apps/details?id=com.motovault.app',
  ],
  screenshot: [
    {
      '@type': 'ImageObject',
      url: `${BASE_URL}/images/propagation-images/motovault-home-1206x2622.png`,
      caption: 'MotoVault home screen showing garage and diagnostics',
    },
  ],
  featureList: [
    'AI motorcycle diagnostics from photos',
    'Digital garage management',
    'Structured learning paths and quizzes',
    'Maintenance tracking and reminders',
    'Expense management',
  ],
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'Free',
      description: 'Basic learning, 1 bike, limited AI diagnostics',
    },
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'MotoVault Pro',
      description: 'Unlimited diagnostics, all content, unlimited bikes',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '0',
        priceCurrency: 'USD',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: '7',
          unitCode: 'DAY',
        },
        description: 'Free trial, then subscription pricing in-app',
      },
    },
  ],
  creator: { '@id': `${BASE_URL}/#organization` },
};
```

Also consolidate the homepage's inline `JsonLd` function (lines 29-38) to use the shared `<JsonLd>` component from `@/components/marketing/json-ld`.

**2b. Enrich BlogPosting schema** `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`

Add to the `articleSchema` object:
- `wordCount`: Read from MDX frontmatter (pre-computed, zero runtime cost). Add `wordCount` field to each MDX file's frontmatter.
- `articleSection`: Map from `article.category` (e.g., `"diy"` → `"DIY Tutorials"`, `"maintenance"` → `"Maintenance"`, `"troubleshooting"` → `"Troubleshooting"`)
- `inLanguage`: Use the current `locale` parameter

Add optional `dateModified` support:
- Add `dateModified` to the `Article` interface in `apps/web/src/lib/blog.ts`
- Read from frontmatter if present, otherwise fall back to `date`
- Update the schema's `dateModified` to use this field

Category mapping constant:

```typescript
const CATEGORY_LABELS: Record<string, string> = {
  diy: 'DIY Tutorials',
  maintenance: 'Maintenance',
  troubleshooting: 'Troubleshooting',
  'brand-specific': 'Brand-Specific Guides',
  'cost-analysis': 'Cost Analysis',
  safety: 'Safety',
} as const;
```

**~~2c. Add HowTo schema to procedural articles~~ — REMOVED**

> **Research finding:** Google deprecated HowTo rich results in September 2023 (mobile) and shortly after on desktop. HowTo schema markup is entirely ignored by Google Search as of 2026. Adding it provides zero rich result benefit. The procedural content (oil change, brake pads, etc.) should rely on well-structured headings and content for ranking — no schema needed.

**2d. Fix feature page BreadcrumbList** — 4 feature page files + create Features index page

Files to modify:
- `apps/web/src/app/[locale]/(marketing)/features/ai-diagnostics/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/garage-management/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/learning-paths/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/features/progress-tracking/page.tsx`

Changes per file:
1. Update BreadcrumbList from 2-level to 3-level: `Home > Features > [Feature Name]`
2. Fix `generateMetadata` to use all 12 locales from `routing.locales` instead of hardcoded 5

Create new file:
- `apps/web/src/app/[locale]/(marketing)/features/page.tsx` — minimal features index page listing all 4 features with links, so the breadcrumb "Features" item resolves to a real page

Add translations for the Features index page in all 12 `messages/*.json` files.

Add `/features` to the sitemap `pages` array and `PAGE_LAST_EDITED` map in `apps/web/src/app/sitemap.ts`.

#### Phase 3: Content & AI Optimization

**3a. Update llms.txt** `apps/web/public/llms.txt` and `apps/web/public/llms-full.txt`

Add to both files:
```
Last-Updated: 2026-03-22

## License
Content on motovault.app may be cited and referenced with attribution.
Attribution format: "Source: MotoVault (motovault.app)"
```

**3b. Convert blog headings to question-based format**

Target the 5 highest-value procedural articles:
1. `complete-motorcycle-maintenance-guide-2026.mdx`
2. `how-to-change-motorcycle-oil-diy.mdx`
3. `motorcycle-brake-pad-replacement-diy.mdx`
4. `motorcycle-wont-start-troubleshooting-guide.mdx`
5. `diagnose-motorcycle-problems-with-ai.mdx`

Convert declarative H2/H3 headings to question format where appropriate:
- "Step 1: Diagnose the Battery" → "How Do I Know If My Motorcycle Battery Is Dead?"
- "Understanding Motorcycle Oil Types" → "What Type of Oil Should I Use in My Motorcycle?"
- "Cold Weather Starting Tips" → "How Do I Start a Motorcycle in Cold Weather?"

Restructure the first 40-60 words of each section to contain a direct, self-contained answer before elaborating.

**3c. Add Table of Contents component** for blog articles

Create `apps/web/src/components/marketing/table-of-contents.tsx`:
- Extract headings from raw MDX content by parsing `##` and `###` lines (before compileMDX)
- Render as an inline, collapsible section at the top of the article (below hero, above content)
- Use anchor links to heading IDs generated by `rehype-slug`
- Style to match existing dark theme (neutral colors, amber accents)
- Collapsed by default on mobile, expanded on desktop

Add heading extraction via a custom **rehype plugin** that piggybacks on the existing `compileMDX` pass (which already runs `rehype-slug`). This avoids a separate regex scan of the content:

```typescript
// apps/web/src/lib/rehype-extract-headings.ts
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root } from 'hast';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function rehypeExtractHeadings(headings: TocHeading[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (['h2', 'h3'].includes(node.tagName)) {
        headings.push({
          id: (node.properties?.id as string) || '',
          text: toString(node),
          level: Number(node.tagName[1]),
        });
      }
    });
  };
}
```

In `blog.ts`, pass the headings array to `compileMDX` alongside `rehype-slug`:

```typescript
const headings: TocHeading[] = [];
const { content } = await compileMDX({
  source: rawContent,
  options: {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug, rehypeExtractHeadings(headings)],
    },
  },
});
// headings is now populated — return alongside article data
```

This is zero additional parsing cost since rehype-slug already visits every heading node. Install `hast-util-to-string` and `unist-util-visit` as dev dependencies (or check if already available through rehype).

#### Phase 4: New Pages

**4a. Create About page** `apps/web/src/app/[locale]/(marketing)/about/page.tsx`

Content:
- Founder section: "Andrej" — role, motorcycle background, vision for MotoVault
- Mission statement: making motorcycle knowledge accessible through AI
- Company info: Founded 2025, based in Slovakia, EU
- Stats: 2,400+ riders, 18,000+ bikes, 8,500+ AI diagnoses
- Schema: `Organization` with `founder` Person property

Add translations to all 12 `messages/*.json` files under `About` namespace.

Add to sitemap `pages` array and `PAGE_LAST_EDITED` in `apps/web/src/app/sitemap.ts`.

Add "About" link to footer navigation in the marketing layout.

**4b. Create Features index page** `apps/web/src/app/[locale]/(marketing)/features/page.tsx`

Minimal page listing all 4 features with icons, descriptions, and links. Serves as the breadcrumb target for the "Features" level.

#### Phase 5: IndexNow & ASO

**5a. Add IndexNow support**

Create key file: `apps/web/public/{generated-key}.txt` containing the key value.

Create API route: `apps/web/src/app/api/indexnow/route.ts`
- POST endpoint that accepts `{ url: string }` with `Authorization: Bearer <secret>` header
- Validates secret using `crypto.timingSafeEqual()` (prevents timing attacks)
- **SSRF prevention**: Validates URL origin matches `BASE_URL` (`new URL(url).origin === BASE_URL`)
- Rate limiting: max 50 requests per minute (simple in-memory counter)
- Submits to `https://api.indexnow.org/indexnow` with the key
- Returns identical error responses for invalid/missing auth (don't reveal secret existence)

Document usage: After deploying new content, call:
```bash
curl -X POST https://motovault.app/api/indexnow \
  -H "Content-Type: application/json" \
  -d '{"url":"https://motovault.app/blog/new-article","secret":"YOUR_SECRET"}'
```

Add `INDEXNOW_KEY` and `INDEXNOW_SECRET` to `apps/web/.env.example`.

**5b. Update ASO metadata** `apps/mobile/app.config.ts`

- App name remains "MotoVault" (short, branded)
- Add description field: "AI-powered motorcycle maintenance, diagnostics & expense tracking"
- iOS `infoPlist.keywords`: "motorcycle,maintenance,diagnostic,expense,tracker,AI,OBD2,fault code,garage,service log"

Update `apps/web/public/site.webmanifest`:
- description: "AI-powered motorcycle maintenance tracking, photo diagnostics, and expense management"

## System-Wide Impact

- **Interaction graph**: Schema changes affect how Google/Bing parse pages → rich results display. robots.txt affects all crawler access.
- **Error propagation**: JSON-LD errors silently fail (no runtime impact, just lost rich results). IndexNow API failures are isolated.
- **State lifecycle risks**: None — all changes are stateless rendering changes.
- **API surface parity**: No API changes except the new IndexNow route (admin-only).

## Acceptance Criteria

### Functional Requirements

- [ ] `curl https://motovault.app/robots.txt` shows no duplicate user-agent blocks
- [ ] Homepage MobileApplication schema passes Google Rich Results Test with `UtilitiesApplication` category
- [ ] BlogPosting schema includes `wordCount`, `articleSection`, `inLanguage`, `isAccessibleForFree`, `timeRequired`
- [ ] Breadcrumb URLs use current locale (not hardcoded English)
- [ ] Feature pages have 3-level breadcrumbs: Home > Features > [Name]
- [ ] Feature pages include all 12 locale alternates in metadata
- [ ] `/features` route renders a page listing all features
- [ ] llms.txt includes citation license and last-updated date
- [ ] 5 blog articles have question-based headings
- [ ] Blog articles display a table of contents
- [ ] `/about` route renders with founder info and Organization schema
- [ ] Testimonial text is consistent across all 12 locale files
- [ ] IndexNow API route accepts POST and submits to IndexNow
- [ ] `site.webmanifest` has updated description

### Quality Gates

- [ ] All JSON-LD validates at https://validator.schema.org/
- [ ] No XSS vectors in JSON-LD output (escaped `<` characters)
- [ ] No broken breadcrumb links (all `item` URLs resolve to real pages)
- [ ] Biome lint passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Heading changes on indexed articles may disrupt rankings | Phase the rollout: do 2 articles first, monitor 1 week, then the rest |
| Cloudflare may re-inject robots.txt blocks after config change | Verify with curl after Cloudflare config change; set up monitoring |
| HowTo schema steps may not match Google's expectations | Validate with Rich Results Test before deploying |
| IndexNow route could be abused | Protected with secret token; rate limiting optional |

## File Change Summary

| File | Change Type |
|---|---|
| `apps/web/src/app/robots.ts` | Verify (Cloudflare config change) |
| `apps/web/src/app/[locale]/(marketing)/page.tsx` | Modify (schema + consolidate JsonLd) |
| `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` | Modify (BlogPosting + HowTo schema + TOC) |
| `apps/web/src/lib/blog.ts` | Modify (Article interface + extractHeadings) |
| `apps/web/src/app/[locale]/(marketing)/features/*/page.tsx` | Modify (breadcrumbs + locales) x4 |
| `apps/web/src/app/[locale]/(marketing)/features/page.tsx` | **Create** (features index) |
| `apps/web/src/app/[locale]/(marketing)/about/page.tsx` | **Create** (about page) |
| `apps/web/src/components/marketing/table-of-contents.tsx` | **Create** (TOC component) |
| `apps/web/src/app/api/indexnow/route.ts` | **Create** (IndexNow API) |
| `apps/web/public/llms.txt` | Modify |
| `apps/web/public/llms-full.txt` | Modify |
| `apps/web/public/{key}.txt` | **Create** (IndexNow key) |
| `apps/web/public/site.webmanifest` | Modify |
| `apps/web/src/app/sitemap.ts` | Modify (add /about, /features) |
| `apps/web/messages/*.json` | Modify x12 (testimonials, About, Features index) |
| `apps/mobile/app.config.ts` | Modify (ASO metadata) |
| `apps/web/content/blog/en/*.mdx` | Modify x5 (headings) + x4 (HowTo frontmatter) |

## Sources & References

- SEO audit results (2026-03-22): Technical 87/100, Content 72/100, GEO 61/100
- Keyword research: 86 keywords across 4 clusters (maintenance, diagnostics, expenses, brand)
- Competitor analysis: MotorManage, MotoScanAI, MotoDoc, MotoMind, Fuelly
- Existing JSON-LD XSS fix: `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`
- PPR disabled: `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/
- IndexNow Protocol: https://www.indexnow.org/documentation
