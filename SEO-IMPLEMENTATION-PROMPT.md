# MotoVault SEO Implementation Prompt

> **Date:** March 15, 2026
> **Based on:** Full SEO audit + competitive intelligence analysis of motovault.app
> **Goal:** Make MotoVault visible on Google and outrank competitors (MotorManage, MotoMind) for motorcycle learning, diagnostics, and maintenance keywords.

---

## Context

MotoVault (motovault.app) is an AI-powered motorcycle learning & diagnostics platform built with Next.js 16 (apps/web), Expo (apps/mobile), and NestJS (apps/api). The web app has excellent technical SEO infrastructure (JSON-LD structured data, robots.txt, dynamic sitemap, i18n for 5 languages, Open Graph/Twitter cards, Google Search Console verification) but **only 5 indexable pages** and **zero Google search visibility**.

Our two main competitors are:

- **MotorManage** (motormanage.app) — ~65/100 SEO score. Has dedicated feature pages (/features/parts-tracking, /features/service-log, etc.), active blog with comparison articles ("Best Motorcycle Maintenance App 2026"), 600+ brands, 45,000+ models. Keyword-rich title: "Free Motorcycle Maintenance App | Track Parts, Service & Reminders | MotorManage". Published on both app stores.

- **MotoMind** (motomind.xyz) — ~55/100 SEO score. Has dedicated feature pages, blog, maintenance guides, AI mechanic page. SoftwareApplication schema with 4.8/5 rating (127 reviews). Ranks for "AI motorcycle maintenance" terms.

MotoVault's competitive advantages that need to be made visible: (1) AI photo diagnostics + structured learning paths + quizzes (no competitor combines all three), (2) i18n support for 5 languages (competitors are English-only), (3) 18,000+ bikes via NHTSA vPIC API.

---

## Phase 1: Quick Wins (This Week)

### 1.1 Fix Google Indexation
- Log into Google Search Console for motovault.app
- Check Coverage/Indexing report for errors, warnings, or manual actions
- Submit sitemap.xml manually if not already submitted
- Request indexing for all 5 existing pages
- Verify the domain "motovault.app" is correctly claimed (not confused with motovault.com which is an Indian superbike dealership)

### 1.2 Fix Homepage Title Tag (10 min)

**File:** `apps/web/messages/en.json` (and es.json, de.json, fr.json, it.json)

The current title is "MotoVault — AI-Powered Motorcycle Learning & Diagnostics" which combines with the titleTemplate `%s | MotoVault` to produce "MotoVault — AI-Powered Motorcycle Learning & Diagnostics | MotoVault" (73 chars, brand name duplicated).

**Change in en.json:**
```json
{
  "Metadata": {
    "title": "MotoVault — AI Motorcycle Diagnostics & Learning App",
    "titleTemplate": "%s | MotoVault",
    "description": "Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health. Free on iOS & Android.",
    "ogDescription": "Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health. Free on iOS & Android."
  }
}
```

**Why:** Title must be under 60 chars. The homepage should NOT use the titleTemplate (it appends "| MotoVault" again). Either the title shouldn't trigger the template, or the layout metadata needs adjustment so the homepage sets an absolute title rather than using the template.

**Layout fix in** `apps/web/src/app/[locale]/(marketing)/layout.tsx`: The homepage's `generateMetadata` in `page.tsx` should return `title: { absolute: t('title') }` to prevent the template from appending "| MotoVault" again. All subpages can continue using the template.

Apply equivalent changes to all 5 locale files (es.json, de.json, fr.json, it.json).

### 1.3 Add Keywords to H1 (10 min)

**File:** `apps/web/messages/en.json` → Hero section

Current H1 is assembled from `Hero.line1` + `Hero.line2` + `Hero.line3` = "LEARN YOUR BIKE. FIX YOUR BIKE." — catchy but contains zero target keywords.

**Option A (recommended):** Keep the visual tagline but restructure the HTML so the semantic `<h1>` contains keywords:
```
<h1>AI-Powered Motorcycle Diagnostics & Learning Platform</h1>
<p class="tagline">Learn your bike. Fix your bike.</p>
```

**Option B:** Add a visually hidden (sr-only) H1 with keywords and make the tagline a styled `<p>`:
```
<h1 class="sr-only">AI-Powered Motorcycle Diagnostics & Learning App</h1>
<p aria-hidden="true" class="tagline">LEARN YOUR BIKE. FIX YOUR BIKE.</p>
```

The hero component is in `apps/web/src/components/marketing/hero.tsx`.

### 1.4 Keyword-Optimize H2 Tags (15 min)

**File:** `apps/web/messages/en.json`

| Current H2 | New H2 | Section Key |
|---|---|---|
| "Built for Riders" | "Motorcycle Diagnostics & Maintenance Features" | `Features.sectionTitle` |
| "How It Works" | "How AI Motorcycle Diagnostics Works" | `HowItWorks.sectionTitle` |
| "What Riders Say" | "What Motorcycle Riders Say" | `Testimonials.sectionTitle` |
| "Be First to Master Your Motorcycle" | "Start Learning Motorcycle Maintenance Today" | `Cta.headline` |

Apply equivalent keyword-rich translations in all locale files.

### 1.5 Add Meta Description CTA (5 min)

**File:** `apps/web/messages/en.json` → `Metadata.description`

Add "Free on iOS & Android." to the end of the description to improve CTR from search results. (Already shown in 1.2 above.)

---

## Phase 2: Feature Landing Pages (Week 1-2)

Create 4 dedicated feature pages under `apps/web/src/app/[locale]/(marketing)/features/`:

### 2.1 /features/ai-diagnostics
**Target keywords:** "motorcycle AI diagnostics app", "motorcycle photo diagnostics", "AI motorcycle mechanic"
**Content:** How the AI diagnostics work (photo → analysis → diagnosis), supported issue types, confidence scoring, example screenshots, FAQ, CTA to download.
**Structured data:** Add HowTo JSON-LD schema for the diagnostic process.
**Competitors covering this:** MotoMind (/ai-mechanic), MotoDoc (app stores only)

### 2.2 /features/learning-paths
**Target keywords:** "motorcycle learning app", "learn motorcycle maintenance", "motorcycle quiz app"
**Content:** List of all courses (Engine Internals, Suspension Tuning, Electrical Systems, Routine Maintenance), sample lessons, quiz format, progress tracking, badge system. THIS IS UNIQUE — no competitor has structured learning.
**Structured data:** Add Course JSON-LD schema.
**Competitors covering this:** None (competitive advantage!)

### 2.3 /features/garage-management
**Target keywords:** "motorcycle garage management app", "motorcycle maintenance tracker", "motorcycle service reminder app"
**Content:** Multi-bike management, maintenance history, service reminders, NHTSA integration (18,000+ bikes), make/model/year search. Screenshots.
**Structured data:** SoftwareApplication with feature list.
**Competitors covering this:** MotorManage (/features/parts-tracking, /features/service-log), Moto Shed

### 2.4 /features/progress-tracking
**Target keywords:** "motorcycle knowledge quiz", "motorcycle learning progress"
**Content:** Badges, scores, leaderboards, streak tracking, module completion. Gamification angle.

### Implementation Notes for All Feature Pages:
- Each page needs its own `generateMetadata()` with unique title (under 60 chars), description (under 160 chars), canonical URL, and hreflang alternates
- Add translations to all 5 locale files
- Update sitemap.ts to include the new pages with `priority: 0.8` and `changeFrequency: 'monthly'`
- Link from the homepage Features section cards to these individual pages instead of just anchor links
- Add breadcrumb JSON-LD on each page
- Each page should have a clear CTA (waitlist form or app store link)

---

## Phase 3: Blog & Content Hub (Week 2-4)

### 3.1 Blog Infrastructure
Create a blog system at `apps/web/src/app/[locale]/(marketing)/blog/`:
- `/blog` — blog index page listing all articles
- `/blog/[slug]` — individual article pages
- Articles can be stored as MDX files or fetched from the API (Supabase already has articles table)
- Each article needs: generateMetadata with unique title/description, Article JSON-LD schema, author info, publishDate, canonical URL, hreflang alternates
- Add blog to sitemap.ts (dynamically generate entries for each article)
- Add blog link to navbar and footer

### 3.2 Seed Articles (5 articles to publish first)

**Article 1: "The Complete Motorcycle Maintenance Checklist for 2026"**
- Target keywords: "motorcycle maintenance checklist", "motorcycle maintenance guide 2026"
- 2000+ words covering: pre-ride checks, oil changes, chain maintenance, brake inspection, tire pressure, coolant, electrical, suspension, winter storage
- Include interactive checklist component
- CTA: "Track all this automatically with MotoVault's Garage Management"
- Competitors: MotorManage published "Spring Motorcycle Prep Checklist 2026"

**Article 2: "How to Diagnose Motorcycle Problems with AI in 2026"**
- Target keywords: "how to diagnose motorcycle problems", "motorcycle AI diagnostics", "motorcycle photo diagnostics"
- Cover: Traditional diagnostics vs AI-assisted, how MotoVault's AI works, example diagnoses with screenshots, accuracy considerations
- CTA: "Try MotoVault's AI Diagnostics — snap a photo, get answers in seconds"

**Article 3: "Best Motorcycle Maintenance Apps in 2026: An Honest Comparison"**
- Target keywords: "best motorcycle maintenance app 2026", "motorcycle app comparison"
- Compare: MotoVault vs MotorManage vs MotoMind vs Moto Shed vs BikeQuiz
- Highlight MotoVault's unique combination of AI diagnostics + learning + garage management
- Be fair to competitors but emphasize where MotoVault is uniquely strong
- IMPORTANT: MotorManage already published this exact type of article — we need to outrank them

**Article 4: "Understanding Motorcycle Warning Lights: A Complete Visual Guide"**
- Target keywords: "motorcycle warning lights meaning", "motorcycle dashboard symbols"
- Visual guide with icons/illustrations for: oil pressure, temperature, battery, ABS, engine check, fuel, turn signals, high beam, neutral, side stand
- CTA: "Not sure what that light means? Snap a photo with MotoVault's AI Diagnostics"
- High organic search potential — lots of people Google warning light meanings

**Article 5: "Motorcycle Maintenance for Beginners: Everything You Need to Know"**
- Target keywords: "motorcycle maintenance for beginners", "learn motorcycle maintenance"
- Pillar page structure — link to future cluster articles (oil change guide, chain guide, brake guide, etc.)
- Cover: Why maintenance matters, essential tools, frequency schedule, when to DIY vs shop
- CTA: "Learn all this step-by-step with MotoVault's Learning Paths"

---

## Phase 4: Programmatic SEO — Per-Model Pages (Month 2-3)

### 4.1 Concept
MotoVault already integrates with the NHTSA vPIC API and supports 18,000+ bike models. Auto-generate SEO pages for popular motorcycle models:

**URL structure:** `/motorcycles/[make]/[model]` (e.g., `/motorcycles/honda/cb500f`)

**Each page includes:**
- Make, model, year range
- Common maintenance intervals (oil change, chain, brakes, tires)
- Typical issues owners report
- "Diagnose issues on your [Make Model] with MotoVault's AI" CTA
- "Track your [Make Model] maintenance in MotoVault's Garage" CTA
- Related models from the same make
- Article JSON-LD + Product JSON-LD

**Why this is powerful:**
- Creates hundreds of long-tail keyword-targeted pages automatically
- Targets searches like "Honda CB500F maintenance schedule", "Yamaha MT-07 common problems"
- No competitor has this — MotorManage lists 45,000+ models but doesn't have dedicated model pages
- Uses data MotoVault already has

### 4.2 Implementation
- Create a Next.js dynamic route: `apps/web/src/app/[locale]/(marketing)/motorcycles/[make]/[model]/page.tsx`
- Use `generateStaticParams()` to pre-build the top 200-500 most popular models at build time
- Use ISR (Incremental Static Regeneration) for the rest
- Fetch model data from NHTSA API or from MotoVault's own database
- Generate `generateMetadata()` with model-specific title/description
- Add to sitemap.ts dynamically

---

## Phase 5: Ongoing Content & Localization (Month 3+)

### 5.1 Topic Cluster: Motorcycle Maintenance
Build a "Motorcycle Maintenance" pillar page linking to cluster articles:
- Motorcycle oil change guide (how-to, intervals, oil types)
- Motorcycle chain maintenance (cleaning, lubing, tension adjustment)
- Motorcycle brake inspection guide (pads, fluid, rotors)
- Motorcycle tire pressure guide (checking, correct PSI by model)
- Motorcycle electrical system troubleshooting (battery, fuses, starter)
- Motorcycle suspension tuning guide (preload, rebound, compression)

Each cluster article links back to the pillar page and to relevant MotoVault features.

### 5.2 Competitor Comparison Pages
Write comparison articles targeting competitor brand searches:
- "MotoVault vs MotorManage: Which Motorcycle App Is Better?"
- "MotoVault vs MotoMind: AI Motorcycle Diagnostics Compared"
- "MotoVault vs MotoDoc: Photo Diagnostics Face-Off"

### 5.3 Leverage i18n Advantage
MotoVault is the ONLY competitor with multi-language support. Create localized blog content for:
- **Spanish:** "app de diagnóstico de motocicletas" (virtually zero competition)
- **German:** "Motorrad Wartung App" (virtually zero competition)
- **French:** "application diagnostic moto"
- **Italian:** "app manutenzione moto"

Translate the top 5 seed articles first, then expand.

### 5.4 Add AggregateRating Schema (Post-Launch)
Once MotoVault has App Store ratings, update the SoftwareApplication JSON-LD in `apps/web/src/app/[locale]/(marketing)/page.tsx` to include:
```json
{
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "150",
    "bestRating": "5"
  }
}
```
MotoMind already shows 4.8/5 (127 reviews) as rich snippets — this dramatically improves CTR.

### 5.5 Create /pricing Page
Even though MotoVault is free/freemium, a dedicated pricing page captures "motovault pricing" and "free motorcycle app" queries. Both MotorManage and MotoMind have pricing pages.

### 5.6 Create /download Page
Dedicated download page with app store badges, QR codes, and device-specific instructions. MotorManage has this at /download.

---

## Success Metrics

| Metric | Current | 1 Month Target | 3 Month Target | 6 Month Target |
|---|---|---|---|---|
| Indexed pages | ~0-5 | 15-20 | 50+ | 200+ |
| Organic keywords ranked | 0 | 10-20 | 50-100 | 200+ |
| Monthly organic visits | 0 | 100-300 | 1,000-3,000 | 5,000+ |
| Google position for "motorcycle AI diagnostics app" | Not ranked | Top 20 | Top 10 | Top 5 |
| Google position for "motorcycle maintenance app" | Not ranked | Top 50 | Top 20 | Top 10 |
| Blog articles published | 0 | 5 | 15 | 30+ |
| Feature pages | 0 | 4 | 4 | 4+ |
| Model pages (programmatic) | 0 | 0 | 200+ | 500+ |

---

## File Reference

| What | Where |
|---|---|
| Root layout (viewport, icons) | `apps/web/src/app/layout.tsx` |
| Marketing layout (metadata, OG, robots) | `apps/web/src/app/[locale]/(marketing)/layout.tsx` |
| Homepage (JSON-LD, hero, features) | `apps/web/src/app/[locale]/(marketing)/page.tsx` |
| Hero component (H1 tag) | `apps/web/src/components/marketing/hero.tsx` |
| English translations (titles, descriptions, H1/H2) | `apps/web/messages/en.json` |
| Other locale translations | `apps/web/messages/{es,de,fr,it}.json` |
| Sitemap generator | `apps/web/src/app/sitemap.ts` |
| Robots.txt | `apps/web/src/app/robots.ts` |
| Base URL constant | `apps/web/src/lib/constants.ts` |
| Next.js config (headers, plugins) | `apps/web/next.config.ts` |
| i18n routing config | `apps/web/src/i18n/routing.ts` |
| Public assets (og-image, icons) | `apps/web/public/` |
| Google verification | `apps/web/public/google2cfdfd4cab394901.html` |
