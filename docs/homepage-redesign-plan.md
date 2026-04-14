# Homepage Redesign Plan

Reduce from 7 sections to 3. Strip decorative complexity (speed lines, tachometer, bento grid, phone frame, carousel). Keep it clean, fast, and conversion-focused.

---

## Page Component Tree (new)

```
page.tsx
  <JsonLdGraph />          (KEEP — unchanged)
  <Hero />                 (REWRITE — photo bg + floating screenshots)
  <FeaturesTestimonial />  (NEW — replaces FeaturesGrid, SocialProofBar, HowItWorks, AppShowcase)
  <CtaFaq />               (NEW — merges CtaSection + Faq)
```

---

## Section 1: Hero

**File**: `apps/web/src/components/marketing/hero.tsx` (rewrite in place)

### Component structure

```
<section>  (full viewport height, relative, overflow-hidden)
  <div>  background layer
    <Image src="/images/hero-explore.jpg" fill priority />  (Next.js Image, object-cover)
    <div>  dark overlay (bg-neutral-950/70 + gradient-to-t from-neutral-950)
  </div>

  <div>  content container (max-w-7xl, z-10, flex column center or left-aligned)
    <h1>  "TRACK YOUR BIKE." / "OWN YOUR RIDE."
    <p>   ONE subtitle sentence (rewrite Hero.subtitle to a single sentence)
    <div>  store buttons row
      <StoreButtons />  (reuse existing component, both same primary style)
    </div>
  </div>

  <div>  floating screenshots (absolute positioned, right side, md+ only)
    <Image src="/screenshots/trip-detail-hero.png" />   PRIMARY — larger, slight rotateZ(-3deg)
    <Image src="/screenshots/bike-details-hero.png" />  SECONDARY — smaller, offset, rotateZ(2deg), overlapping
  </div>
</section>
```

### What changes

| Aspect | Current | New |
|--------|---------|-----|
| Background | CSS gradient + radial glow | `hero-explore.jpg` photo with CSS dark overlay |
| Headline | 3-span gradient text | Same words, simpler styling (white text, warm accent on "OWN") |
| Subtitle | Full paragraph (40+ words) | One sentence (~15 words) |
| Pre-title | `seoTitle` label ("Motorcycle Maintenance Tracker...") | REMOVED |
| Accent line | `accent-line-enter` div | REMOVED |
| Explore routes link | Hardcoded `/explore` link with arrow SVG | REMOVED |
| Download tagline | "Start Tracking Free — iOS & Android" with download icon | REMOVED |
| Store buttons | Two different styles (white primary, bordered secondary) | Both use same primary pill style (reuse `StoreButtons`) |
| Phone mockup | `AppPreview` + `HeroCarousel` (phone frame, carousel, dot indicators) | 2 raw screenshots with CSS transforms (tilt/overlap) |
| Speed lines | 4 animated divs + SPEED_LINES config | REMOVED |
| Wind lines | 3 animated divs + WIND_LINES config | REMOVED |
| Tachometer SVG | Full tach-sweep SVG with arc, needle, redline | REMOVED |
| Scroll indicator | Animated chevron SVG | REMOVED |
| Parallax | scroll-driven animations (hero-bg-parallax, hero-moto-parallax, hero-text-fade) | REMOVED |

### Server vs Client

Change hero to a **server component** (remove `'use client'`). No more carousel state, no posthog click tracking inline (move analytics to store-buttons or a thin client wrapper if needed).

---

## Section 2: Features + Testimonial

**File**: `apps/web/src/components/marketing/features-testimonial.tsx` (NEW file)

### Component structure

```
<section id="features">
  <div>  section header
    <h2>  "Everything Your Bike Needs" (keep Features.sectionTitle)
    <p>   keep Features.sectionSubtitle
  </div>

  <div>  3-column grid (grid-cols-1 md:grid-cols-3, gap-8)

    <!-- Feature 1: Trip Planning -->
    <div>  feature block
      <div>  icon (map-pin SVG, reuse from current trip feature)
      <h3>  "Trip Planning"
      <p>   one-sentence description
      <div>  screenshot container (rounded-xl, overflow-hidden)
        <Image src="/screenshots/trip-detail-hero.png" />
      </div>
    </div>

    <!-- Feature 2: Maintenance Tracker -->
    <div>  feature block
      <div>  icon (wrench SVG, reuse from current maintenance feature)
      <h3>  "Maintenance Tracker"
      <p>   one-sentence description
      <div>  screenshot container
        <Image src="/screenshots/flow-add-maintenance.png" />
      </div>
    </div>

    <!-- Feature 3: Expense Tracker -->
    <div>  feature block
      <div>  icon (dollar SVG, reuse from current expenses feature)
      <h3>  "Expense Tracker"
      <p>   one-sentence description
      <div>  screenshot container
        <Image src="/screenshots/home-rides-expenses.png" />
      </div>
    </div>
  </div>

  <!-- AI Diagnostics bonus line -->
  <p>  "Plus AI-powered photo diagnostics — snap a photo, get answers in seconds."
       (single centered line below the grid, subtle styling, not a card)

  <!-- Testimonial -->
  <blockquote>  single testimonial quote
    <p>  quote text (pick best from Testimonials.items — Alex R. or Sarah K.)
    <footer>  name + bike
  </blockquote>
</section>
```

### Screenshot mapping

| Feature | Primary screenshot | Fallback |
|---------|-------------------|----------|
| Trip Planning | `/screenshots/trip-detail-hero.png` | `/screenshots/trip-planning-edit.png` |
| Maintenance Tracker | `/screenshots/flow-add-maintenance.png` | `/screenshots/bike-details-hero.png` |
| Expense Tracker | `/screenshots/home-rides-expenses.png` | `/screenshots/flow-add-expense.png` |

All from `apps/web/public/screenshots/`. Use Next.js `<Image>` with explicit width/height based on the screenshot dimensions. Serve at `sizes="(max-width: 768px) 100vw, 33vw"`.

### Design notes

- No bento grid — simple 3-column with equal cards
- No radial glows, no gradient overlaps, no metric badges
- No hover glow effects or bottom accent bars
- Cards are simple: light border (`border-neutral-800/40`), subtle `bg-neutral-900/30`
- Screenshot sits inside a rounded container at the bottom of each card
- Testimonial is a simple blockquote with left border accent, centered below the grid
- Server component (async, uses `getTranslations`)

---

## Section 3: CTA + FAQ

**File**: `apps/web/src/components/marketing/cta-faq.tsx` (NEW file)

### Component structure

```
<section id="cta">
  <div>  CTA block (text-center, max-w-2xl)
    <h2>  "Stop Guessing. Start Tracking." (keep Cta.headline)
    <p>   keep Cta.subtitle
    <StoreButtons />
    <p>   trust line ("Free to start" + "No spam, ever")
  </div>

  <div>  FAQ block (max-w-3xl, mt-16)
    <h3>  "Frequently Asked Questions"
    <FaqAccordion items={0..3} />  (4 items, not 8)
  </div>
</section>
```

### FAQ items to keep (4 of 8)

Keep indices 0, 1, 3, 5 from current `Faq.items`:
1. "What is MotoVault?" (index 0) — essential intro
2. "Is MotoVault free?" (index 1) — conversion critical
3. "How does AI diagnostics work?" (index 3) — differentiator
4. "What's included in MotoVault Pro?" (index 5) — upsell

Drop indices 2 (motorcycle support), 4 (data safety), 6 (best app SEO), 7 (comparison SEO).

### Accordion approach

Extract the accordion logic from current `faq.tsx` into the new component. The accordion is client-side (`useState`), so either:
- Make `CtaFaq` a server component that renders a client `<FaqAccordion />` child
- Or make the whole section client-side (simpler, FAQ is small)

Prefer option A: server component with a client accordion child.

**File**: `apps/web/src/components/marketing/faq-accordion.tsx` (NEW — extracted client component)

---

## Components: KEEP, MODIFY, DELETE

### KEEP (no changes)
- `store-buttons.tsx` — reuse `StoreButtons` + `STORE_LINKS`
- `json-ld-graph.tsx` — unchanged

### MODIFY
- `hero.tsx` — full rewrite (photo bg, floating screenshots, no carousel/phone frame)
- `page.tsx` — update imports, reduce to 3 sections, reduce FAQ items for JSON-LD to 4

### DELETE (files to remove)
- `social-proof-bar.tsx` — stats bar removed entirely
- `how-it-works.tsx` — 3-step section removed
- `app-showcase.tsx` — replaced by inline screenshots in features
- `showcase-image.tsx` — only used by app-showcase
- `hero-carousel.tsx` — carousel replaced by static screenshots
- `app-preview.tsx` — phone frame wrapper removed

### NEW (files to create)
- `features-testimonial.tsx` — Section 2
- `cta-faq.tsx` — Section 3 (server component shell)
- `faq-accordion.tsx` — client accordion extracted from old `faq.tsx`, hardcoded to 4 items

### DELETABLE AFTER MIGRATION
- `features-grid.tsx` — replaced by features-testimonial
- `faq.tsx` — replaced by faq-accordion inside cta-faq
- `cta-section.tsx` — merged into cta-faq

---

## Translation Keys (en.json)

### KEEP as-is
- `Hero.line1`, `Hero.line2`, `Hero.line3` — headline words
- `Hero.downloadCta` — used by store buttons context
- `Features.sectionTitle`, `Features.sectionSubtitle`
- `Features.trip.title`, `Features.maintenance.title`, `Features.expenses.title`
- `Features.diag.title` — referenced in bonus line
- `Cta.headline`, `Cta.subtitle`, `Cta.trustFree`, `Cta.trustNoCard`
- `Faq.sectionTitle`
- `Faq.items[0]`, `Faq.items[1]`, `Faq.items[3]`, `Faq.items[5]` — the 4 kept FAQs
- `Testimonials.items[0]` or `Testimonials.items[3]` — single testimonial quote
- All `JsonLd.*` keys

### MODIFY
- `Hero.subtitle` — rewrite from paragraph to one sentence. New value: "Free maintenance tracking, expense logging, ride recording, and AI diagnostics for every motorcycle."
- `Features.trip.description`, `Features.maintenance.description`, `Features.expenses.description` — shorten each to one sentence

### ADD
- `Features.aiBonusLine` — "Plus AI-powered photo diagnostics — snap a photo, get answers in seconds."

### REMOVE (unused after redesign)
- `Hero.seoTitle` — pre-title label removed
- `Hero.exploreFeatures` — button removed
- `Hero.scrollDown` — scroll indicator removed
- `Features.sectionLabel` — "Features" pre-title removed
- `Features.*.tagline` — all 6 taglines (trip, maintenance, expenses, rides, diag, garage)
- `Features.*.badge` — all 6 badge texts
- `Features.rides.*` — ride logger card removed (not in top 3)
- `Features.diag.tagline`, `Features.diag.description`, `Features.diag.badge` — AI diag is bonus line only
- `Features.garage.*` — garage card removed (not in top 3)
- `SocialProof.*` — entire section removed
- `HowItWorks.*` — entire section removed
- `AppShowcase.*` — entire section removed
- `Faq.sectionLabel` — pre-title label removed
- `Faq.items[2]`, `Faq.items[4]`, `Faq.items[6]`, `Faq.items[7]` — dropped FAQ items
- `Testimonials.sectionLabel`, `Testimonials.sectionTitle`, `Testimonials.badge` — section header removed (only one inline quote)

### Translation files affected
All 12 locale files need the same key additions/removals:
`en.json`, `de.json`, `es.json`, `fr.json`, `hi.json`, `id.json`, `it.json`, `ja.json`, `pl.json`, `pt-BR.json`, `th.json`, `tr.json`

---

## globals.css Cleanup

### REMOVE these CSS blocks (line references from current file)

| Lines | Class/Keyframe | Reason |
|-------|---------------|--------|
| 34-50 | `@keyframes speed-line` | Speed lines removed from hero |
| 52-128 | Hero scroll-driven parallax block (`hero-scroll-root`, `hero-bg-parallax`, `hero-moto-parallax`, `hero-text-fade`, `hero-scroll-indicator`, all related keyframes, reduced-motion override) | No parallax in new hero |
| 156-173 | `.cta-glow`, `@keyframes glow-pulse` | No ambient glow on buttons |
| 286-305 | `.accent-line-enter`, `@keyframes accent-grow` | Accent line removed from hero |
| 307-316 | `.features-bento` grid-template-areas | Bento grid replaced by simple 3-col |
| 318-331 | `@keyframes phone-float`, `.phone-float` | Phone mockup removed |
| 333-345 | `@keyframes scroll-hint`, `.scroll-hint` | Scroll indicator removed |
| 377-401 | `.badge-pop`, `@keyframes badge-pop-in` | Feature badges removed |
| 423-442 | `.maintenance-hero-glow`, `@keyframes maintenance-glow` | Maintenance glow removed |
| 457-469 | `.star-earned` stagger-fill | Testimonial stars stagger removed (single quote, no star hover) |
| 471-492 | `.icon-spin-hover`, `.icon-flip-hover`, `.icon-rev-hover` | Feature icon hover animations removed |
| 525-541 | `@keyframes speed-line-slow` | Secondary wind lines removed |
| 543-579 | `.tach-sweep`, `.tach-sweep-arc`, `.tach-needle`, `.tach-redline`, all related keyframes | Tachometer removed |
| 581-638 | `prefers-reduced-motion` block — remove references to deleted classes only; keep overrides for classes still in use (`cta-primary`, `cta-secondary`, `card-lift`, `faq-accent-line`) |

### KEEP these CSS blocks
- `.logo-glow` — used in navbar
- `:root` custom easings
- `.cta-primary` hover/active transitions — used by StoreButtons
- `.cta-secondary` — used by StoreButtons
- `.faq-accent-line` — used in new FAQ accordion
- `.card-lift` — may still be useful, keep for now
- `.grain-overlay` — used on body
- `.scroll-progress` — used site-wide
- Modal animations (`fadeIn`, `fadeInUp`, `scaleIn`)
- Route page animations (`animate-hero-scale`, `animate-fade-in-up`, `animate-pulse-once`)
- `content-visibility: auto` optimization
- `.animate-fade-in` — used elsewhere
- `.btn-shimmer` — used by forms
- `.success-enter`, `.check-animate` — used by success states
- `.logo-needle` — used in navbar

### UPDATE reduced-motion block
After removing deleted classes, the `@media (prefers-reduced-motion: reduce)` block (lines 581-638) should be trimmed to only reference classes that still exist.

---

## Image Assets

### Already available
- `/images/hero-explore.jpg` (732 KB) — hero background photo, already in `public/images/`
- `/screenshots/trip-detail-hero.png` (594 KB) — trip planning screenshot
- `/screenshots/bike-details-hero.png` (1.3 MB) — bike details screenshot
- `/screenshots/flow-add-maintenance.png` (500 KB) — maintenance flow
- `/screenshots/home-rides-expenses.png` (51 KB) — rides/expenses tab
- `/screenshots/flow-add-expense.png` (958 KB) — expense flow (fallback)
- `/screenshots/trip-planning-edit.png` (412 KB) — trip edit (fallback)

### Optimization notes
- `bike-details-hero.png` at 1.3 MB is large for a floating screenshot — compress or serve via Next.js Image optimization
- `hero-explore.jpg` at 732 KB should use `priority` + `fetchPriority="high"` as LCP element
- All screenshots should use Next.js `<Image>` with explicit `width`/`height` to avoid CLS

---

## page.tsx Changes

```tsx
// BEFORE
import { AppShowcase } from '@/components/marketing/app-showcase';
import { CtaSection } from '@/components/marketing/cta-section';
import { Faq } from '@/components/marketing/faq';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { SocialProofBar } from '@/components/marketing/social-proof-bar';

// AFTER
import { Hero } from '@/components/marketing/hero';
import { FeaturesTestimonial } from '@/components/marketing/features-testimonial';
import { CtaFaq } from '@/components/marketing/cta-faq';
```

### JSON-LD FAQ update

Change `faqItems` from 8 items to 4 items (indices 0, 1, 3, 5). Since the FAQ items array in translations will be restructured to only have 4 items, update the `Array.from({ length: 8 })` to `Array.from({ length: 4 })`.

### Render

```tsx
<>
  <JsonLdGraph nodes={graph} />
  <Hero />
  <FeaturesTestimonial />
  <CtaFaq />
</>
```

---

## Implementation Order

1. Create `faq-accordion.tsx` (extract client accordion from `faq.tsx`, limit to 4 items)
2. Create `features-testimonial.tsx` (new server component)
3. Create `cta-faq.tsx` (server shell + FaqAccordion child)
4. Rewrite `hero.tsx` (photo bg, floating screenshots, remove client directive)
5. Update `page.tsx` (swap imports, update JSON-LD)
6. Update `en.json` (modify subtitle, add bonus line, restructure FAQ to 4 items)
7. Update all 11 other locale files with same structural changes
8. Clean `globals.css` (remove dead CSS)
9. Delete unused component files (6 files)
10. Run `pnpm precheck` to verify build
