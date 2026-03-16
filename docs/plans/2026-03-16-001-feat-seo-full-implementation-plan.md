---
title: "feat: Full SEO Implementation — CSP, GA4, MDX Blog, Content, Tools & Localization"
type: feat
status: active
date: 2026-03-16
deepened: 2026-03-16
---

# Full SEO Implementation — CSP, GA4, MDX Blog, Content, Interactive Tools & Localization

## Enhancement Summary

**Deepened on:** 2026-03-16
**Sections enhanced:** 6 phases + infrastructure
**Research agents used:** repo-research-analyst, learnings-researcher, security-sentinel, performance-oracle, architecture-strategist, best-practices-researcher, framework-docs-researcher, spec-flow-analyzer

### Key Improvements
1. **Performance**: Add article caching layer to avoid re-reading 27+ MDX files on every request; use `unstable_cache` or module-level memoization
2. **Security**: CSP nonce-based approach for GA4 scripts instead of domain allowlisting; XML entity escaping in RSS feed
3. **Architecture**: Content directory should live at project root or use a content manifest for build-time validation
4. **MDX Rendering**: Use `next-mdx-remote/rsc` `compileMDX` function (not `MDXRemote` component) for better type safety
5. **Sitemap**: Next.js 16 `MetadataRoute.Sitemap` supports `images` array natively — no custom XML needed

### Critical Findings from Research
- **next-mdx-remote/rsc** exports `compileMDX<Frontmatter>()` which returns `{ content: ReactElement, frontmatter: Frontmatter }` — use this typed generic
- **GA4 with @next/third-parties**: The `GoogleAnalytics` component auto-handles CSP by using Next.js script injection — but `connect-src` must still allow `*.google-analytics.com`
- **RSS route**: Must be at `app/blog/feed.xml/route.ts` (not `app/feed.xml`) for correct URL path
- **setRequestLocale**: MUST be called before any `useTranslations()` or `getTranslations()` in EVERY new page/layout (PPR constraint)
- **JSON-LD XSS**: The `.replace(/</g, '\\u003c')` pattern is mandatory for ALL new structured data

## Overview

Comprehensive SEO overhaul for `motovault.app` covering 24 code-implementable tasks across infrastructure fixes (CSP, GA4, sitemap), content system migration (MDX blog), 20+ new articles, interactive tools, and multi-locale content. Organized into 6 implementation phases with clear dependencies.

## Problem Statement

MotoVault has strong SEO foundations (JSON-LD, hreflang, sitemap, robots.txt) but lacks:
- **Content infrastructure**: 5 articles hardcoded as HTML strings in a 700-line TS file — impossible to scale
- **Analytics**: No GA4 — Vercel Analytics alone doesn't provide organic search insights
- **CSP compatibility**: `connect-src 'self'` and `script-src 'self'` may block Googlebot rendering and will block GA4
- **Content volume**: Only 5 articles. Competitors have 50+. Targeting 25+ indexed pages within 90 days
- **Interactive tools**: No linkable assets that earn backlinks naturally
- **Localized content**: Blog only serves English despite 5-locale support

## Proposed Solution

Six sequential phases, each building on the previous:

1. **Infrastructure** (SEO-002, 003, 004, 024) — Fix CSP, add GA4, enhance sitemap, add smart banner
2. **Content System** (SEO-006, 007, 025) — Migrate blog to MDX, add hero images, build RSS feed
3. **Homepage & Feature SEO** (SEO-005, 010) — Optimize H1/meta, enrich feature pages across locales
4. **Content Production** (SEO-008–014, 016, 026) — Write 20+ MDX articles
5. **Interactive Tools & Pages** (SEO-015, 020, 022, 023) — Cost calculator, TCLOCS, press kit, related articles
6. **Localization** (SEO-019) — Translate top articles to ES/DE/FR/IT

## Technical Approach

### Phase 1: Infrastructure (SEO-002, 003, 004, 024)

#### SEO-002: Fix CSP Headers for Googlebot
**File**: `apps/web/next.config.ts`

Update CSP directives:
```
script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com
connect-src 'self' https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://vitals.vercel-insights.com
img-src 'self' data: https:
font-src 'self' https://fonts.gstatic.com
```

- Keep `'unsafe-eval'` conditional for dev only
- Keep `style-src 'self' 'unsafe-inline'` (needed for Tailwind)
- Verify HSTS header remains intact (per docs/solutions finding)

#### SEO-003: Add GA4 Integration
**File**: `apps/web/src/app/layout.tsx`

```tsx
import { GoogleAnalytics } from '@next/third-parties/google'

// In layout return, after <body>:
<GoogleAnalytics gaId="G-XXXXXXXXXX" />
```

- Install `@next/third-parties` package
- GA measurement ID from env var `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- The `@next/third-parties/google` component handles script loading correctly with Next.js
- Add conversion event helpers in `src/lib/analytics.ts`:
  - `trackAppStoreClick(platform: 'ios' | 'android')`
  - `trackWaitlistSignup()`
  - `trackBlogRead(slug: string)`

#### SEO-004: Enhance Sitemap with Image Data
**File**: `apps/web/src/app/sitemap.ts`

Add `images` array to sitemap entries per the [Image Sitemaps spec](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps):
```ts
{
  url: `${BASE_URL}/`,
  lastModified: new Date(),
  alternates: { languages },
  images: [`${BASE_URL}/og-image.png`],
}
```

- Homepage: `og-image.png`
- Feature pages: app screenshot images (create placeholder images if needed)
- Blog articles: hero images (after Phase 2 adds them)
- Fix: Use actual article `date` for `lastModified` instead of `new Date()`

#### SEO-024: Apple Smart App Banner
**File**: `apps/web/src/app/layout.tsx`

Add to `<head>`:
```tsx
<meta name="apple-itunes-app" content="app-id=YOUR_APP_ID" />
```

### Phase 2: Content System (SEO-006, 007, 025)

#### SEO-006: Migrate Blog to MDX
**New dependencies**: `next-mdx-remote`, `gray-matter`, `rehype-slug`, `rehype-autolink-headings`, `remark-gfm`

**Directory structure**:
```
apps/web/content/blog/
  en/
    motorcycle-maintenance-checklist-2026.mdx
    diagnose-motorcycle-problems-with-ai.mdx
    best-motorcycle-maintenance-apps-2026.mdx
    motorcycle-warning-lights-guide.mdx
    motorcycle-maintenance-for-beginners.mdx
  es/  (later, Phase 6)
  de/
  fr/
  it/
```

**MDX frontmatter schema**:
```yaml
---
slug: motorcycle-maintenance-checklist-2026
title: "Motorcycle Maintenance Checklist 2026"
excerpt: "Keep your bike in top shape..."
keywords: ["motorcycle maintenance", "checklist"]
author: "MotoVault Team"
date: "2026-01-15"
readingTime: "8 min"
locale: "en"
heroImage: "/images/blog/maintenance-checklist-hero.webp"
heroAlt: "Motorcycle maintenance tools laid out on a workbench"
category: "maintenance"
---
```

**Updated `src/lib/blog.ts`**:
```ts
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const CONTENT_DIR = path.join(process.cwd(), 'content/blog')

export function getArticles(locale: string = 'en'): Article[] {
  const localeDir = path.join(CONTENT_DIR, locale)
  if (!fs.existsSync(localeDir)) return locale === 'en' ? [] : getArticles('en')

  const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.mdx'))
  return files.map(file => {
    const source = fs.readFileSync(path.join(localeDir, file), 'utf-8')
    const { data, content } = matter(source)
    return { ...data, content, slug: data.slug } as Article
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
```

**Updated `blog/[slug]/page.tsx`**:
- Use `compileMDX<Frontmatter>()` from `next-mdx-remote/rsc` (typed Server Component API):
  ```tsx
  import { compileMDX } from 'next-mdx-remote/rsc'
  import remarkGfm from 'remark-gfm'
  import rehypeSlug from 'rehype-slug'

  const { content, frontmatter } = await compileMDX<Article>({
    source: article.content,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] },
      parseFrontmatter: false, // already parsed by gray-matter
    },
    components: mdxComponents,
  })
  ```
- Pass custom components for headings, links (use `Link` from `@/i18n/navigation`!), images (use `next/image`), code blocks
- Maintain existing JSON-LD BlogPosting schema
- Use shared `JsonLd` component from `@/components/marketing/json-ld.tsx` (fix duplication)
- Remember: call `setRequestLocale(locale)` in both component and `generateMetadata`
- Use `BASE_URL` constant for all URLs (per learnings)
- Apply `.replace(/</g, '\\u003c')` for JSON-LD XSS prevention (per learnings)

**Performance: Article caching** (critical for 27+ articles):
```ts
// In blog.ts — module-level cache to avoid re-reading filesystem on every request
let articlesCache: Map<string, { articles: Article[], timestamp: number }> = new Map()
const CACHE_TTL = 60_000 // 1 minute in dev, longer in prod

export function getArticles(locale: string = 'en'): Article[] {
  const cached = articlesCache.get(locale)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.articles
  // ... filesystem read ...
  articlesCache.set(locale, { articles, timestamp: Date.now() })
  return articles
}
```
In production, Next.js module caching handles this naturally since modules persist across requests in the same worker.

**Article interface update** (add to existing):
```ts
interface Article {
  slug: string
  title: string
  excerpt: string
  content: string  // MDX source string
  author: string
  date: string
  readingTime: string
  keywords: string[]
  locale: string
  heroImage?: string
  heroAlt?: string
  category?: string
}
```

#### SEO-007: Blog Hero Images System
**New directory**: `apps/web/public/images/blog/`

- Add `heroImage` and `heroAlt` to Article interface (done in SEO-006)
- Update `blog/[slug]/page.tsx` to render hero image above article
- Update `generateMetadata` to use article-specific `heroImage` for `openGraph.images`
- Create/source hero images for existing 5 articles (WebP format, 1200x630)
- Fallback to `/og-image.png` if no `heroImage`

#### SEO-025: RSS Feed
**New file**: `apps/web/src/app/blog/feed.xml/route.ts`

```ts
import { getArticles } from '@/lib/blog'
import { BASE_URL } from '@/lib/constants'

export async function GET() {
  const articles = getArticles('en')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MotoVault Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Motorcycle maintenance tips, AI diagnostics, and riding guides</description>
    <atom:link href="${BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    ${articles.map(a => `<item>
      <title>${escapeXml(a.title)}</title>
      <link>${BASE_URL}/blog/${a.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${a.slug}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } })
}
```

Add RSS link to root layout `<head>`:
```tsx
<link rel="alternate" type="application/rss+xml" title="MotoVault Blog" href="/blog/feed.xml" />
```

### Phase 3: Homepage & Feature SEO (SEO-005, 010)

#### SEO-005: Optimize Homepage H1 & Meta
**Files**: All 5 locale message files in `apps/web/messages/`

**English (`en.json`)**:
```json
{
  "Hero": {
    "seoTitle": "AI Motorcycle Maintenance App — Diagnose, Learn & Track Your Bike"
  },
  "Metadata": {
    "title": "MotoVault — AI Motorcycle Maintenance & Diagnostics App",
    "description": "The smart motorcycle maintenance app with AI diagnostics, expense tracking, learning paths, and garage management. Keep your bike running perfectly."
  }
}
```

- Translate equivalents to es.json, de.json, fr.json, it.json
- Keep visual H1 as brand tagline ("Learn Your Bike. Fix Your Bike.")
- Render `seoTitle` as a prominent subtitle or `<p>` below the H1 (not sr-only — Google needs to see it)

#### SEO-010: Enrich Feature Pages
**Files**: All 5 locale message files + 4 feature page components

For each feature page, add to locale files:
- `longDescription`: 800–1,500 words of unique SEO content
- `faq`: Array of 4–6 Q&A pairs for FAQPage JSON-LD
- `howItWorks`: Detailed step-by-step (for HowTo schema where applicable)

Add `FAQPage` JSON-LD schema to each feature page using the shared `JsonLd` component.

Target keywords per page:
- **AI Diagnostics**: "AI motorcycle diagnostic app", "motorcycle diagnostic app without OBD"
- **Learning Paths**: "learn motorcycle mechanics online", "motorcycle maintenance course"
- **Garage Management**: "motorcycle garage management app", "digital motorcycle logbook"
- **Progress Tracking**: "motorcycle maintenance tracker", "motorcycle mileage tracker"

### Phase 4: Content Production (SEO-008, 009, 011–014, 016, 026)

All articles as `.mdx` files in `apps/web/content/blog/en/`.

#### Pillar Content (SEO-008)
- `complete-motorcycle-maintenance-guide-2026.mdx` — 3,000–4,000 words
- HowTo JSON-LD for step-by-step sections
- Internal links to all supporting articles + feature pages

#### Comparison (SEO-009)
- `best-motorcycle-maintenance-apps-2026.mdx` — 2,500+ words
- Feature comparison table (MotoVault, MotorManage, MyBikes.App, RideLog, AUTOsist, Moto Shed, Drivvo)
- ItemList JSON-LD schema

#### Troubleshooting (SEO-011, 012)
7 articles total:
- `motorcycle-wont-start-troubleshooting-guide.mdx` — 2,000+ words (SEO-011)
- `motorcycle-check-engine-light-guide.mdx`
- `motorcycle-leaking-oil-causes-fixes.mdx`
- `motorcycle-clicking-noise-diagnosis.mdx`
- `motorcycle-overheating-causes-solutions.mdx`
- `motorcycle-stalling-at-idle-fix.mdx`
- `motorcycle-battery-keeps-dying-fix.mdx`

#### DIY Tutorials (SEO-013)
4 articles:
- `how-to-change-motorcycle-oil-diy.mdx` — 2,000+ words
- `motorcycle-chain-adjustment-lubrication.mdx`
- `motorcycle-brake-pad-replacement-diy.mdx`
- `spring-motorcycle-prep-checklist.mdx`

#### Cost Content (SEO-014)
3 articles:
- `true-cost-motorcycle-ownership.mdx` — 2,500+ words (pillar)
- `motorcycle-maintenance-cost-per-year.mdx`
- `best-motorcycle-expense-tracker-apps.mdx`

#### Brand Guides (SEO-016)
6 articles:
- `honda-cbr-cb-maintenance-schedule.mdx`
- `yamaha-mt-r-series-maintenance-schedule.mdx`
- `kawasaki-ninja-z-maintenance-schedule.mdx`
- `harley-davidson-maintenance-schedule-costs.mdx`
- `bmw-gs-r-maintenance-schedule.mdx`
- `ducati-monster-panigale-maintenance-schedule.mdx`

#### Seasonal (SEO-026)
- `how-to-winterize-motorcycle-guide.mdx` — 2,000+ words

**Total new articles**: 22 MDX files

### Phase 5: Interactive Tools & Pages (SEO-015, 020, 022, 023)

#### SEO-015: Motorcycle Cost Calculator
**New route**: `apps/web/src/app/[locale]/(marketing)/tools/cost-calculator/page.tsx`

Client component with:
- Inputs: bike type (dropdown), annual mileage, fuel price, insurance cost, maintenance tier (basic/moderate/premium)
- Output: annual cost breakdown (pie chart via CSS), cost-per-mile, 5-year projection
- Shareable results via URL query params
- JSON-LD: `WebApplication` schema
- SEO metadata targeting "motorcycle cost of ownership calculator"

#### SEO-022: TCLOCS Pre-Ride Checklist
**New route**: `apps/web/src/app/[locale]/(marketing)/tools/tclocs-checklist/page.tsx`

Interactive step-by-step checklist:
- 6 categories: Tires, Controls, Lights, Oil, Chassis, Stands
- Each with 3–5 check items
- Progress indicator
- Print/PDF export via `window.print()` with print stylesheet
- CTA: "Get reminders in MotoVault" → app download
- JSON-LD: `HowTo` schema

#### SEO-020: Related Articles & Visual Breadcrumbs
**New components**:
- `apps/web/src/components/marketing/related-articles.tsx` — Shows 2–3 related articles based on `category` field
- `apps/web/src/components/marketing/breadcrumbs.tsx` — Visual breadcrumb nav (complements existing BreadcrumbList JSON-LD)

Add to `blog/[slug]/page.tsx` and all feature pages.

#### SEO-023: Press Kit Page
**New route**: `apps/web/src/app/[locale]/(marketing)/press/page.tsx`

Static page with:
- App description (short + long)
- Key stats
- High-res screenshots grid
- Logo download kit
- Press contact info
- JSON-LD: `Organization` schema (enhanced)

### Phase 6: Localization (SEO-019)

Translate top 5 performing articles into ES/DE/FR/IT:
- Create `content/blog/{es,de,fr,it}/` directories
- Add translated `.mdx` files with localized frontmatter
- Update `getArticles(locale)` to serve locale-specific content (already done in Phase 2)
- Verify hreflang links between translated articles
- Localize keywords in frontmatter

## Acceptance Criteria

### Phase 1 — Infrastructure
- [ ] CSP allows Google Analytics and Googlebot resource loading — `apps/web/next.config.ts`
- [ ] GA4 fires on all pages with correct measurement ID — `apps/web/src/app/layout.tsx`
- [ ] Conversion events track app store clicks, waitlist signups, blog reads — `apps/web/src/lib/analytics.ts`
- [ ] Sitemap includes image URLs and uses actual article dates — `apps/web/src/app/sitemap.ts`
- [ ] Apple Smart App Banner meta tag present — `apps/web/src/app/layout.tsx`

### Phase 2 — Content System
- [ ] MDX blog infrastructure works with `next-mdx-remote/rsc` as Server Component
- [ ] All 5 existing articles migrated to `.mdx` with frontmatter
- [ ] `getArticles(locale)` reads from filesystem, falls back to English
- [ ] Blog article pages render MDX with custom components
- [ ] Hero images display on articles with proper alt text
- [ ] `generateMetadata` uses article-specific OG images
- [ ] RSS feed renders at `/blog/feed.xml` with all articles
- [ ] RSS link tag in layout head
- [ ] Shared `JsonLd` component used everywhere (no duplication)

### Phase 3 — Homepage & Feature SEO
- [ ] Homepage seoTitle contains target keywords in all 5 locales
- [ ] Metadata description contains "motorcycle maintenance app", "AI diagnostics"
- [ ] Feature pages have 800–1,500 words of content per locale
- [ ] FAQPage JSON-LD on each feature page with 4–6 questions

### Phase 4 — Content Production
- [ ] 22 new MDX articles written and rendering correctly
- [ ] Each article has: proper frontmatter, target keywords, internal links, CTA
- [ ] HowTo JSON-LD on tutorial/troubleshooting articles
- [ ] ItemList JSON-LD on comparison articles

### Phase 5 — Interactive Tools & Pages
- [ ] Cost calculator at `/tools/cost-calculator` with shareable URL params
- [ ] TCLOCS checklist at `/tools/tclocs-checklist` with print support
- [ ] Related Articles component on blog posts
- [ ] Visual breadcrumbs on blog posts and feature pages
- [ ] Press kit page at `/press` with downloadable assets

### Phase 6 — Localization
- [ ] Top 5 articles translated to ES/DE/FR/IT
- [ ] Locale-aware blog routing works
- [ ] Hreflang links between translated articles

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSP too restrictive blocks GA4 | GA4 won't load | Test with Chrome DevTools console for CSP violations |
| MDX rendering breaks SSR | Blog pages fail to render | Use `next-mdx-remote/rsc` which is Server Component native |
| Large content volume slows build | Long build times | Next.js 16 handles this well; content is read at request time with ISR |
| Locale fallback missing | Non-English users see 404 | `getArticles()` falls back to English if locale dir is empty |
| JSON-LD XSS | Security vulnerability | Use `.replace(/</g, '\\u003c')` pattern (per docs/solutions) |

## Key Technical Constraints (from docs/solutions)

1. **`setRequestLocale(locale)`** must be called in every page component AND `generateMetadata` (PPR/next-intl compatibility)
2. **Use `BASE_URL` constant** from `src/lib/constants.ts` — never hardcode URLs
3. **Use `<Link>` from `@/i18n/navigation`** for all internal links (recurring review finding)
4. **JSON-LD XSS prevention**: Always `.replace(/</g, '\\u003c')` in `dangerouslySetInnerHTML`
5. **Keep blog pages as Server Components** — use CSS animations, avoid client-side JS animation libraries
6. **`cacheComponents: false`** must remain — do not enable PPR while next-intl uses cookies
7. **Use shared `JsonLd` component** — stop duplicating inline

## File Manifest

### New Files
- `apps/web/content/blog/en/*.mdx` — 27 MDX article files (5 migrated + 22 new)
- `apps/web/public/images/blog/*.webp` — Hero images for articles
- `apps/web/src/lib/analytics.ts` — GA4 event helpers
- `apps/web/src/app/blog/feed.xml/route.ts` — RSS feed endpoint
- `apps/web/src/app/[locale]/(marketing)/tools/cost-calculator/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/tools/tclocs-checklist/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/press/page.tsx`
- `apps/web/src/components/marketing/related-articles.tsx`
- `apps/web/src/components/marketing/breadcrumbs.tsx`
- `apps/web/content/blog/{es,de,fr,it}/*.mdx` — Translated articles (Phase 6)

### Modified Files
- `apps/web/next.config.ts` — CSP header updates
- `apps/web/src/app/layout.tsx` — GA4, RSS link, Apple Smart Banner
- `apps/web/src/app/sitemap.ts` — Image data, fix lastModified dates
- `apps/web/src/lib/blog.ts` — Complete rewrite for filesystem-based MDX
- `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` — MDX rendering, hero images, related articles
- `apps/web/src/app/[locale]/(marketing)/blog/page.tsx` — Use shared JsonLd
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — Use shared JsonLd
- `apps/web/messages/en.json` — SEO titles, feature page content, FAQ
- `apps/web/messages/es.json` — Translated SEO content
- `apps/web/messages/de.json` — Translated SEO content
- `apps/web/messages/fr.json` — Translated SEO content
- `apps/web/messages/it.json` — Translated SEO content
- `apps/web/src/app/[locale]/(marketing)/features/*/page.tsx` — FAQ JSON-LD, long content
- `apps/web/package.json` — New dependencies

### New Dependencies
- `@next/third-parties` — Google Analytics integration
- `next-mdx-remote` — MDX rendering (Server Component compatible)
- `gray-matter` — Frontmatter parsing
- `rehype-slug` — Auto-generate heading IDs
- `rehype-autolink-headings` — Linkable headings
- `remark-gfm` — GitHub Flavored Markdown (tables, strikethrough)

## Sources & References

### Internal References
- CSP config: `apps/web/next.config.ts:1-50`
- Blog system: `apps/web/src/lib/blog.ts` (entire file — to be rewritten)
- Sitemap: `apps/web/src/app/sitemap.ts`
- Root layout: `apps/web/src/app/layout.tsx`
- Marketing layout: `apps/web/src/app/[locale]/(marketing)/layout.tsx`
- Shared JsonLd: `apps/web/src/components/marketing/json-ld.tsx`
- Constants: `apps/web/src/lib/constants.ts`

### Institutional Learnings
- `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md` — setRequestLocale requirement
- `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md` — CSP patterns, JSON-LD XSS prevention, BASE_URL usage
- `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — Link component, HSTS

### Previous SEO Plan
- `docs/plans/2026-03-15-001-feat-seo-implementation-content-marketing-plan.md`
