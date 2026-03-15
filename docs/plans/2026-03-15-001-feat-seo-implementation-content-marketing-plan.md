---
title: "feat: SEO Implementation & Content Marketing"
type: feat
status: active
date: 2026-03-15
---

# feat: SEO Implementation & Content Marketing

## Overview

MotoVault has excellent technical SEO infrastructure (JSON-LD, robots.txt, dynamic sitemap, i18n for 5 languages, OG/Twitter cards, GSC verification) but only 5 indexable pages and zero Google search visibility. This plan implements a comprehensive SEO strategy across 3 phases: quick wins (on-page optimization), feature landing pages, and blog infrastructure with seed content.

**Competitive landscape:**
- **MotorManage** (~65/100 SEO): dedicated feature pages, active blog, 45k+ models, comparison articles
- **MotoMind** (~55/100 SEO): feature pages, blog, AI mechanic page, AggregateRating schema (4.8/5)
- **MotoVault** (current): 5 pages, no blog, no feature pages, but unique combination of AI diagnostics + learning + quizzes + i18n (5 languages)

## Problem Statement

Zero organic search visibility despite having the best product in the space. The web app is a landing page with legal pages — no content that targets high-intent search queries like "motorcycle AI diagnostics app", "learn motorcycle maintenance", or "best motorcycle maintenance app 2026".

## Proposed Solution

Three implementation phases, all frontend-only (zero backend changes):

1. **Phase 1 — Quick Wins**: Fix homepage title duplication, add keyword-rich H1/H2s, optimize meta descriptions
2. **Phase 2 — Feature Pages**: 4 dedicated landing pages with JSON-LD, breadcrumbs, i18n
3. **Phase 3 — Blog**: Infrastructure + 5 seed articles targeting high-value keywords

## Technical Approach

### Architecture

All new pages follow existing patterns:
- Server Components by default (no `'use client'` unless required)
- `next-intl` for i18n with `setRequestLocale(locale)` in every page + `generateMetadata`
- `Link` from `@/i18n/navigation` for internal links (never `next/link` directly)
- JSON-LD via `dangerouslySetInnerHTML` with `.replace(/</g, '\\u003c')` XSS prevention
- `BASE_URL` from `apps/web/src/lib/constants.ts` for canonical URLs
- `cacheComponents: false` remains (PPR incompatible with next-intl cookie detection)
- CSS animations over JS libraries (Server Component compatible)
- Biome for linting/formatting

### Implementation Phases

#### Phase 1: Quick Wins (On-Page SEO)

**1.1 Fix Homepage Title Tag Duplication**

Current: `"MotoVault — AI-Powered Motorcycle Learning & Diagnostics | MotoVault"` (73 chars, brand duplicated)
Fix: Use `title: { absolute: t('title') }` in homepage `generateMetadata` to bypass template.

- [ ] `apps/web/src/app/[locale]/(marketing)/page.tsx` — change `generateMetadata` to return `title: { absolute: t('title') }`
- [ ] `apps/web/messages/en.json` — update `Metadata.title` to `"MotoVault — AI Motorcycle Diagnostics & Learning App"` (54 chars)
- [ ] `apps/web/messages/en.json` — update `Metadata.description` to `"Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health. Free on iOS & Android."` (116 chars)
- [ ] `apps/web/messages/en.json` — update `Metadata.ogDescription` to match
- [ ] `apps/web/messages/es.json` — equivalent Spanish translations
- [ ] `apps/web/messages/de.json` — equivalent German translations
- [ ] `apps/web/messages/fr.json` — equivalent French translations
- [ ] `apps/web/messages/it.json` — equivalent Italian translations

**1.2 Add Keyword-Rich H1**

Current H1: `"LEARN YOUR BIKE. FIX YOUR BIKE."` — zero target keywords.
Fix: Add sr-only H1 with keywords, keep visual tagline as `<p>`.

- [ ] `apps/web/src/components/marketing/hero.tsx` — add `<h1 className="sr-only">{t('seoTitle')}</h1>`, change current `<h1>` to `<p role="presentation">`
- [ ] `apps/web/messages/en.json` — add `Hero.seoTitle`: `"AI-Powered Motorcycle Diagnostics & Learning App"`
- [ ] All locale files — add equivalent `Hero.seoTitle` translations

**1.3 Keyword-Optimize H2 Tags**

| Current H2 | New H2 | Translation Key |
|---|---|---|
| "Built for Riders" | "Motorcycle Diagnostics & Maintenance Features" | `Features.sectionTitle` |
| "How It Works" | "How AI Motorcycle Diagnostics Works" | `HowItWorks.sectionTitle` |
| "What Riders Say" | "What Motorcycle Riders Say" | `Testimonials.sectionTitle` |
| "Be First to Master Your Motorcycle" | "Start Learning Motorcycle Maintenance Today" | `Cta.headline` |

- [ ] `apps/web/messages/en.json` — update all 4 H2 translation keys
- [ ] `apps/web/messages/es.json` — update Spanish equivalents
- [ ] `apps/web/messages/de.json` — update German equivalents
- [ ] `apps/web/messages/fr.json` — update French equivalents
- [ ] `apps/web/messages/it.json` — update Italian equivalents

**1.4 Add Organization sameAs**

- [ ] `apps/web/src/app/[locale]/(marketing)/page.tsx` — populate `sameAs` array in Organization JSON-LD (add app store URLs when available)

---

#### Phase 2: Feature Landing Pages

Create 4 feature pages under `apps/web/src/app/[locale]/(marketing)/features/`.

**Shared infrastructure:**

- [ ] `apps/web/src/app/[locale]/(marketing)/features/layout.tsx` — optional shared layout for feature pages (or rely on parent marketing layout)
- [ ] `apps/web/src/components/marketing/breadcrumb-jsonld.tsx` — shared BreadcrumbList JSON-LD component
- [ ] `apps/web/src/components/marketing/feature-cta.tsx` — shared CTA section (waitlist form + "Coming to iOS & Android")
- [ ] `apps/web/src/app/sitemap.ts` — add 4 feature page entries with `priority: 0.8`, `changeFrequency: 'monthly'`
- [ ] `apps/web/src/components/marketing/navbar.tsx` — add Features dropdown or link
- [ ] `apps/web/src/components/marketing/footer.tsx` — add feature page links under Product section

**2.1 /features/ai-diagnostics**
Target keywords: "motorcycle AI diagnostics app", "motorcycle photo diagnostics", "AI motorcycle mechanic"

- [ ] `apps/web/src/app/[locale]/(marketing)/features/ai-diagnostics/page.tsx`
  - `generateMetadata()` with title `"AI Motorcycle Diagnostics"` (uses template → "AI Motorcycle Diagnostics | MotoVault")
  - Description: `"Snap a photo of your motorcycle issue and get an AI-powered diagnosis in seconds. Supports 18,000+ bike models."`
  - HowTo JSON-LD schema (3 steps: snap photo → AI analyzes → get diagnosis)
  - BreadcrumbList JSON-LD
  - Sections: hero, how it works, supported issues, FAQ, CTA
- [ ] `apps/web/messages/en.json` — add `FeaturesDiagnostics.*` translation keys
- [ ] All locale files — add translations

**2.2 /features/learning-paths**
Target keywords: "motorcycle learning app", "learn motorcycle maintenance", "motorcycle quiz app"

- [ ] `apps/web/src/app/[locale]/(marketing)/features/learning-paths/page.tsx`
  - `generateMetadata()` with title `"Motorcycle Learning Paths & Quizzes"`
  - Description: `"Master motorcycle maintenance with structured courses, interactive quizzes, and progress tracking. From basics to advanced."`
  - Course JSON-LD schema
  - BreadcrumbList JSON-LD
  - Sections: hero, course list, quiz preview, progress tracking, CTA
- [ ] `apps/web/messages/en.json` — add `FeaturesLearning.*` translation keys
- [ ] All locale files — add translations

**2.3 /features/garage-management**
Target keywords: "motorcycle garage management app", "motorcycle maintenance tracker"

- [ ] `apps/web/src/app/[locale]/(marketing)/features/garage-management/page.tsx`
  - `generateMetadata()` with title `"Motorcycle Garage Management"`
  - Description: `"Track multiple bikes, log maintenance, set service reminders. Supports 18,000+ models via NHTSA database."`
  - SoftwareApplication JSON-LD with feature list
  - BreadcrumbList JSON-LD
  - Sections: hero, multi-bike management, maintenance history, reminders, NHTSA integration, CTA
- [ ] `apps/web/messages/en.json` — add `FeaturesGarage.*` translation keys
- [ ] All locale files — add translations

**2.4 /features/progress-tracking**
Target keywords: "motorcycle knowledge quiz", "motorcycle learning progress"

- [ ] `apps/web/src/app/[locale]/(marketing)/features/progress-tracking/page.tsx`
  - `generateMetadata()` with title `"Track Your Motorcycle Knowledge"`
  - Description: `"Earn badges, track quiz scores, build learning streaks. Gamified motorcycle education that keeps you motivated."`
  - BreadcrumbList JSON-LD
  - Sections: hero, badges, streaks, leaderboard, module completion, CTA
- [ ] `apps/web/messages/en.json` — add `FeaturesProgress.*` translation keys
- [ ] All locale files — add translations

**Homepage linking:**

- [ ] `apps/web/src/components/marketing/features.tsx` — update feature cards to link to individual feature pages instead of anchor links
- [ ] Use `Link` from `@/i18n/navigation` for all internal links

---

#### Phase 3: Blog Infrastructure & Seed Content

**3.1 Blog Infrastructure**

- [ ] `apps/web/src/app/[locale]/(marketing)/blog/page.tsx` — blog index page
  - Lists all articles as cards (title, excerpt, date, reading time)
  - `generateMetadata()` with title `"Motorcycle Maintenance Blog"`
  - CollectionPage JSON-LD
  - Pagination if >10 articles
- [ ] `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` — individual article page
  - `generateMetadata()` with article-specific title/description
  - Article JSON-LD (headline, author, datePublished, dateModified, image)
  - BreadcrumbList JSON-LD
  - Reading time estimate
  - Related articles section
  - CTA section
  - `generateStaticParams()` to pre-render all articles
- [ ] `apps/web/src/lib/blog.ts` — blog data layer
  - Article type: `{ slug, title, excerpt, content, author, date, readingTime, keywords, locale }`
  - Load articles from MDX files or static data (start with static JSON/TS, migrate to MDX later)
  - Helper: `getArticlesByLocale(locale)`, `getArticleBySlug(locale, slug)`
- [ ] `apps/web/src/app/sitemap.ts` — dynamically add blog article entries
- [ ] `apps/web/src/components/marketing/navbar.tsx` — add Blog link
- [ ] `apps/web/src/components/marketing/footer.tsx` — add Blog link
- [ ] `apps/web/messages/en.json` — add `Blog.*` translation keys (index page titles, UI labels)
- [ ] All locale files — add blog UI translations

**3.2 Seed Articles (English first)**

Store as TypeScript data files in `apps/web/src/content/articles/en/`:

- [ ] `apps/web/src/content/articles/en/motorcycle-maintenance-checklist-2026.ts`
  - Title: "The Complete Motorcycle Maintenance Checklist for 2026"
  - Keywords: "motorcycle maintenance checklist", "motorcycle maintenance guide 2026"
  - ~2000 words: pre-ride checks, oil, chain, brakes, tires, coolant, electrical, suspension, storage
  - CTA: "Track all this automatically with MotoVault's Garage Management"

- [ ] `apps/web/src/content/articles/en/diagnose-motorcycle-problems-with-ai.ts`
  - Title: "How to Diagnose Motorcycle Problems with AI in 2026"
  - Keywords: "how to diagnose motorcycle problems", "motorcycle AI diagnostics"
  - Traditional vs AI-assisted diagnostics, how MotoVault works, examples
  - CTA: "Try MotoVault's AI Diagnostics"

- [ ] `apps/web/src/content/articles/en/best-motorcycle-maintenance-apps-2026.ts`
  - Title: "Best Motorcycle Maintenance Apps in 2026: An Honest Comparison"
  - Keywords: "best motorcycle maintenance app 2026", "motorcycle app comparison"
  - Compare: MotoVault vs MotorManage vs MotoMind vs Moto Shed
  - Fair but highlight MotoVault's unique AI + learning + garage combo

- [ ] `apps/web/src/content/articles/en/motorcycle-warning-lights-guide.ts`
  - Title: "Understanding Motorcycle Warning Lights: A Complete Visual Guide"
  - Keywords: "motorcycle warning lights meaning", "motorcycle dashboard symbols"
  - Visual guide for 10+ warning light types
  - CTA: "Snap a photo with MotoVault's AI Diagnostics"

- [ ] `apps/web/src/content/articles/en/motorcycle-maintenance-for-beginners.ts`
  - Title: "Motorcycle Maintenance for Beginners: Everything You Need to Know"
  - Keywords: "motorcycle maintenance for beginners", "learn motorcycle maintenance"
  - Pillar page: why maintenance matters, tools, frequency, DIY vs shop
  - CTA: "Learn step-by-step with MotoVault's Learning Paths"

---

## Acceptance Criteria

### Phase 1 — Quick Wins
- [ ] Homepage `<title>` is exactly `"MotoVault — AI Motorcycle Diagnostics & Learning App"` (no duplication)
- [ ] Homepage has a semantic H1 containing "motorcycle diagnostics" keywords
- [ ] All 4 section H2s contain target keywords
- [ ] Meta description is under 160 chars and ends with CTA
- [ ] All changes are translated across 5 locales (en, es, de, fr, it)
- [ ] `setRequestLocale(locale)` called in all modified pages

### Phase 2 — Feature Pages
- [ ] 4 feature pages render at `/features/ai-diagnostics`, `/features/learning-paths`, `/features/garage-management`, `/features/progress-tracking`
- [ ] Each page has unique `generateMetadata()` with title under 60 chars, description under 160 chars
- [ ] Each page has BreadcrumbList JSON-LD
- [ ] Feature-specific JSON-LD on diagnostics (HowTo), learning (Course), garage (SoftwareApplication)
- [ ] All 4 pages appear in sitemap.xml with priority 0.8
- [ ] Hreflang alternates for all 5 locales on each page
- [ ] Homepage feature cards link to individual feature pages
- [ ] Navbar and footer include links to feature pages
- [ ] All content translated across 5 locales

### Phase 3 — Blog
- [ ] Blog index renders at `/blog` with article cards
- [ ] Individual articles render at `/blog/[slug]` with full content
- [ ] Each article has Article JSON-LD with headline, author, datePublished
- [ ] Each article has BreadcrumbList JSON-LD
- [ ] 5 seed articles published with 1500+ words each
- [ ] All articles appear in sitemap.xml
- [ ] Blog link added to navbar and footer
- [ ] Blog pages work across all 5 locales (UI translated, articles English-first)

### Quality Gates
- [ ] `pnpm --filter web build` succeeds with zero errors
- [ ] `pnpm lint` passes (Biome)
- [ ] No `'use client'` on new pages (all Server Components)
- [ ] JSON-LD validates via Google's Rich Results Test
- [ ] All internal links use `Link` from `@/i18n/navigation`
- [ ] No hardcoded URLs — use `BASE_URL` constant

## Success Metrics

| Metric | Current | 1 Month | 3 Month |
|---|---|---|---|
| Indexed pages | ~5 | 15-20 | 25+ |
| Organic keywords ranked | 0 | 10-20 | 50+ |
| Monthly organic visits | 0 | 100-300 | 1,000+ |
| "motorcycle AI diagnostics app" position | Not ranked | Top 20 | Top 10 |
| Blog articles published | 0 | 5 | 10+ |
| Feature pages | 0 | 4 | 4 |

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Translations quality for 4 non-English locales | Use AI translation, mark as draft, refine later |
| Blog content quality for SEO ranking | Focus on depth (2000+ words), unique angle (AI diagnostics), structured data |
| Sitemap growing large with blog articles | Use dynamic sitemap generation already in place |
| PPR incompatibility with next-intl | Keep `cacheComponents: false` (established constraint) |
| CSP blocking inline JSON-LD | Already working on homepage — follow same pattern |

## Technical Notes from Research

1. **JSON-LD XSS prevention**: Always use `.replace(/</g, '\\u003c')` on stringified JSON-LD (established pattern from `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`)
2. **PPR disabled**: `cacheComponents: false` in `next.config.ts` — required while using next-intl v4.x cookie-based locale detection
3. **setRequestLocale**: Must be called in every page component and `generateMetadata` function
4. **Link component**: Always import from `@/i18n/navigation`, not `next/link`
5. **CSS animations**: Prefer CSS `animation-timeline: scroll()` over JS libraries for Server Component compatibility
6. **Alternates pattern**: Follow existing pattern in marketing layout for hreflang — maps all 5 locales + x-default
7. **JsonLd component**: Currently duplicated in homepage and support page — extract to shared component

## Sources & References

### Internal References
- Marketing layout metadata: `apps/web/src/app/[locale]/(marketing)/layout.tsx`
- Homepage JSON-LD: `apps/web/src/app/[locale]/(marketing)/page.tsx`
- Hero H1: `apps/web/src/components/marketing/hero.tsx`
- English translations: `apps/web/messages/en.json`
- Sitemap: `apps/web/src/app/sitemap.ts`
- Robots: `apps/web/src/app/robots.ts`
- i18n routing: `apps/web/src/i18n/routing.ts`
- Base URL: `apps/web/src/lib/constants.ts`
- Next.js config: `apps/web/next.config.ts`

### Institutional Learnings
- PPR + next-intl incompatibility: `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`
- JSON-LD XSS + CSP patterns: `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`
