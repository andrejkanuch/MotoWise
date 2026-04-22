---
title: "feat: Redesign Web Marketing Pages to Match MotoVault Design System"
type: feat
status: active
date: 2026-04-18
---

# Redesign Web Marketing Pages to Match MotoVault Design System

## Enhancement Summary

**Deepened on:** 2026-04-18
**Sections enhanced:** All
**Research sources:** Project learnings (web-landing-page-review, oklch-runtime-bug, i18n-keys, nextjs16-ppr), marketing HTML prototype analysis

### Key Constraints
1. **1:1 PIXEL-PERFECT MATCH** — Every page must exactly replicate the marketing HTML prototypes. No interpretation, no "inspired by" — identical layout, colors, typography, spacing, animations.
2. **Preserve all business logic** — Auth flows, GraphQL queries, SEO metadata, i18n translations must remain functional.
3. **CSS-first animations** — Use CSS `animation-timeline: scroll()` and `view()` instead of JS animation libraries (per learning from previous landing page review).

### Critical Learnings Applied
- **Grain overlay**: Do NOT use `mix-blend-mode: overlay` — causes paint storms. Use `isolation: isolate` + `will-change: auto` instead.
- **Animations**: Prefer CSS scroll-driven animations over JS libraries. This keeps components as Server Components (better performance).
- **i18n**: When modifying any page that uses `next-intl` translations, verify all translation keys exist across all locale files.
- **PPR disabled**: `cacheComponents: false` in next.config.ts — incompatible with next-intl. Don't re-enable.
- **JSON-LD XSS**: Always use `.replace(/</g, '\\u003c')` on `dangerouslySetInnerHTML` in script tags.

## Overview

**1:1 pixel-perfect redesign** of all public-facing web pages to match the marketing HTML prototypes at `marketing/Moto vault/`. The prototypes use a cohesive design system built on oklch colors, Geist + Instrument Serif typography, glassmorphic surfaces, and cinematic hero sections with motion effects. The current Next.js pages use basic Tailwind utility classes that don't match this polished aesthetic.

## Problem Statement / Motivation

The marketing prototypes represent the approved brand identity — a premium, dark, editorial feel with:
- **oklch color palette**: `--bg`, `--surface`, `--ink`, `--warm-500` (amber accent)
- **Typography**: Geist (body), Instrument Serif (italic accents), Geist Mono (labels/tags)
- **Design language**: Film grain overlays, glassmorphic nav, scroll-reveal animations, phone mockups with perspective, motion streak effects
- **Layout**: 1240px container, generous padding (160px sections), sophisticated grid layouts

The current Next.js pages use standard Tailwind patterns that lack the premium feel, visual depth, and brand consistency of the prototypes.

## Pages to Redesign (in order)

### Phase 1: Core Pages

1. **Home Page** (`apps/web/src/app/[locale]/(marketing)/page.tsx` + components)
   - Source: `marketing/Moto vault/index.html`
   - Sections: Hero (bg slideshow + motion streaks), Manifesto (scroll-reveal text), Features (pinned storytelling + phone mockup), Proof (stat counters), Diagnostics demo, Testimonial, FAQ, CTA, Footer
   - Key components to create/update:
     - `hero.tsx` → Full-viewport hero with bg slideshow, eyebrow badge, giant title (Instrument Serif italics), trust indicators, ticker strip
     - `features-grid.tsx` → Replace with pinned storytelling: feature rows (accordion) + sticky phone preview
     - `cta-section.tsx` → Cinematic CTA with background image, centered layout
     - `faq.tsx` → New accordion style with warm-500 rotating icon
     - `footer.tsx` → 4-column grid footer with giant outlined wordmark
     - `navbar.tsx` → Glassmorphic pill nav with dropdown menus, scroll state
     - NEW: `manifesto-section.tsx` — scroll-triggered word reveal
     - NEW: `proof-section.tsx` — 4-stat grid with serif accent numbers
     - NEW: `diagnostics-demo.tsx` — phone mockup with scan animation

2. **Login Page** (`apps/web/src/app/login/page.tsx`)
   - Source: `marketing/Moto vault/login.html`
   - Split layout: left visual panel (sticky, full-height, bg image, testimonial quote, stats strip) + right form panel
   - Auth form with glassmorphic card, social buttons (Google, Apple), divider, email/password fields
   - Bottom app-store links, ambient warm glow

3. **Sign Up Page** (`apps/web/src/app/signup/page.tsx`)
   - Source: `marketing/Moto vault/login.html` (same layout, different form)
   - Same split layout as login, with sign-up form variant (email, password, confirm password)

4. **Explore Page** (`apps/web/src/app/explore/page.tsx`)
   - Source: `marketing/Moto vault/explore.html`
   - New hero with searchbar (search field + country select + duration select, with glassmorphic popovers)
   - Filter chips row
   - Route card grid with hover effects
   - Featured route large card
   - Country sections with tab navigation

### Phase 2: Feature Pages

5. **Trip Planning** (`apps/web/src/app/[locale]/(marketing)/features/trip-planning/page.tsx`)
   - Source: `marketing/Moto vault/features/trip-planning.html`
   - Feature page layout: hero section, animated route map SVG, capability grid, feature detail cards

6. **AI Diagnostics** (`apps/web/src/app/[locale]/(marketing)/features/ai-diagnostics/page.tsx`)
   - Source: `marketing/Moto vault/features/ai-diagnostics.html`

7. **Garage Management** (`apps/web/src/app/[locale]/(marketing)/features/garage-management/page.tsx`)
   - Source: `marketing/Moto vault/features/garage-management.html`

8. **Learning Paths** (`apps/web/src/app/[locale]/(marketing)/features/learning-paths/page.tsx`)
   - Source: `marketing/Moto vault/features/learning-paths.html`

### Phase 3: Route Pages

9. **Route Detail** (`apps/web/src/app/route/[country]/[region]/[slug]/page.tsx`)
   - Source: `marketing/Moto vault/routes/pacific-coast-highway.html`
   - Full-viewport hero with bg image, breadcrumbs, tags, giant title
   - Stats grid (distance, elevation, curvature, time)
   - Action buttons (Download GPX, Open in App, Save, Share)
   - Route overview section
   - Interactive map section (existing, restyle)
   - Reviews section (restyle)
   - Related routes

10. **Routes Listing** (`apps/web/src/app/routes/[id]/page.tsx` — if applicable)

## Technical Approach

### Design System Integration

The marketing prototypes define CSS custom properties that map to the existing design-system package. We'll bridge them:

| Marketing Var | Purpose | Implementation |
|---|---|---|
| `--bg` (oklch 0.12) | Page background | Add to `tokens.css` or use Tailwind arbitrary values |
| `--surface` (oklch 0.15) | Card/panel bg | Same |
| `--ink` (oklch 0.98) | Primary text | Map to existing neutral tokens |
| `--warm-500` (oklch 0.76 0.18 60) | Amber accent | Already exists as `warm-*` in design system |
| `--line` (oklch 1 0 0 / 0.07) | Borders | Tailwind arbitrary |

### Typography

Add fonts via `next/font/google` in the root marketing layout:

```tsx
// apps/web/src/app/[locale]/(marketing)/layout.tsx
import { Instrument_Serif } from 'next/font/google';
import { Geist, Geist_Mono } from 'next/font/google'; // or use next/font/local if bundled

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});
```

Apply CSS variables globally so Tailwind + raw CSS can both access them:
- `font-family: var(--font-geist), system-ui, sans-serif` — body text
- `font-family: var(--font-instrument-serif), serif` — `.serif` accent text (italic headings)
- `font-family: var(--font-geist-mono), monospace` — labels, tags, badges, stats

The marketing prototypes use `font-family: 'Josefin Sans'` on the body (visible in the HTML), but the CSS specifies `'Geist'` — use Geist as the primary since that's in the CSS variables.

### Shared Components to Create

```
apps/web/src/components/marketing/
├── design-system.css          # Marketing page CSS vars + shared styles
├── film-grain.tsx             # Film grain overlay (body::before equivalent)
├── scroll-reveal.tsx          # IntersectionObserver scroll reveal wrapper
├── phone-mockup.tsx           # Reusable phone frame with perspective + halo
├── section-header.tsx         # section-meta + section-title pattern
├── glassmorphic-card.tsx      # Backdrop-blur card pattern
├── stat-counter.tsx           # Animated number counter
├── ticker-strip.tsx           # Infinite horizontal scroll ticker
```

### Image Assets

Copy needed assets from `marketing/Moto vault/assets/` to `apps/web/public/images/marketing/`:
- Hero background images (hero-rider.jpg, hero-d.jpg, hero-h.jpg, hero-night.jpg, hero-street.jpg, hero-bg.jpg, hero-explore.jpg)
- App screenshots (garage.png, maintenance.png, diagnose.png, home-dashboard.png, trip-planning.png, etc.)
- Logo (MotoVault.png)

**Image Strategy:**
- **Hero bg slideshow**: Use CSS `background-image` (not `next/image`) since these are decorative backgrounds with `filter` and `mix-blend-mode`. Preload the first slide via `<link rel="preload" as="image">` in metadata. Lazy-load remaining slides.
- **Phone mockup screenshots**: Use `next/image` with `fill` + `sizes` for responsive optimization. These are content images that benefit from Next.js optimization.
- **Optimization**: Run images through `sharp` or equivalent before copying — target max 200KB per hero image, max 400KB per screenshot. Convert PNGs to WebP where possible.
- **CLS prevention**: Set explicit `aspect-ratio` on all image containers (e.g., phone mockup `aspect-ratio: 9/19.5`)

### Animation Approach (CSS-First — No JS Libraries)

Per project learning (finding #065): **Use CSS scroll-driven animations, NOT JS animation libraries.** This removed ~30-50KB (motion/react) previously and kept Hero as a Server Component.

- **Scroll reveals**: CSS `animation-timeline: view()` with `animation-range: entry 0% entry 35%` (already in globals.css). For staggered children, use `nth-child` with `animation-delay`.
- **Hero bg slideshow**: Minimal client component — `useEffect` interval cycling through images with CSS `opacity` + `transition: opacity 1.6s ease`. Keep surrounding hero markup as Server Component.
- **Motion streaks**: Pure CSS — `repeating-linear-gradient` + `@keyframes streakFlow` (CSS-only, no JS)
- **Manifesto word reveal**: CSS `animation-timeline: scroll()` with individual `span` elements. Each word gets `animation-range` based on position. Fallback: all words visible for browsers without support.
- **Phone mockup**: CSS `perspective` + `transform: rotateY(-6deg) rotateX(2deg)` with `:hover` transition
- **Floating chips**: CSS `@keyframes chipFloat` — translateY oscillation
- **Film grain overlay**: `body::before` with SVG noise texture. **CRITICAL**: Do NOT use `mix-blend-mode: overlay` — causes forced compositing on every scroll frame (paint storm). Use `opacity: 0.025` + `pointer-events: none` + `isolation: isolate`.
- **`@media (prefers-reduced-motion: reduce)`**: Set `animation-duration: 0.01ms !important; transition-duration: 0.01ms !important` on `*, *::before, *::after` (already in marketing CSS)

### Responsive Strategy

Following the marketing prototypes:
- Desktop: Full layout, all effects
- Tablet (≤960px): Single-column features, hidden nav links → hamburger
- Mobile (≤720px): Reduced padding (100px → 24px), simplified hero, stacked grids

## Acceptance Criteria

### Global
- [ ] oklch color system matches marketing prototypes exactly
- [ ] Geist + Instrument Serif + Geist Mono fonts loaded and applied correctly
- [ ] Film grain overlay on all marketing pages
- [ ] Glassmorphic navbar with scroll state (transparent → blurred bg)
- [ ] Footer matches marketing design (4-column grid, outlined wordmark)
- [ ] All pages responsive down to 360px
- [ ] `prefers-reduced-motion` disables all animations

### Home Page
- [ ] Full-viewport hero with rotating bg images + motion streaks + overlay gradients
- [ ] Eyebrow badge, giant serif/sans title, sub text, dual CTAs, trust indicator
- [ ] Bottom ticker strip with stats
- [ ] Manifesto section with scroll-triggered word highlighting
- [ ] Feature storytelling: row list (accordion) + sticky phone mockup with floating chips
- [ ] Proof section: 4-stat grid with serif numbers
- [ ] AI diagnostics demo: phone mockup with scan line animation
- [ ] Testimonial: large Instrument Serif quote, author pill
- [ ] FAQ: accordion with warm-500 rotating + icons
- [ ] CTA: cinematic bg image, centered text, dual buttons

### Login/Signup
- [ ] Split layout: left visual panel (sticky, bg image, quote, stats) + right form
- [ ] Glassmorphic form card with social auth buttons
- [ ] Smooth transitions, proper focus states

### Explore
- [ ] Search hero with glassmorphic searchbar (input + country select + duration)
- [ ] Popover selects with search functionality
- [ ] Filter chips
- [ ] Route card grid matching marketing design

### Feature Pages
- [ ] Consistent feature page layout matching marketing prototypes
- [ ] Animated illustrations (route map SVG, phone mockups)
- [ ] Capability grids

### Route Detail
- [ ] Full-viewport hero with breadcrumbs, tags, giant title
- [ ] Stats grid bar
- [ ] Action buttons row
- [ ] Redesigned reviews section

## Implementation Order

Execute in this order, each building on shared components from previous:

1. **Shared foundation** — CSS variables, fonts, `film-grain.tsx`, `scroll-reveal.tsx`, `section-header.tsx`, `phone-mockup.tsx`
2. **Navbar** — glassmorphic nav with dropdowns and scroll state
3. **Footer** — 4-column grid footer with wordmark
4. **Home page** — all sections (hero, manifesto, features, proof, diagnostics, testimonial, FAQ, CTA)
5. **Login page** — split layout with visual panel
6. **Sign up page** — reuse login layout with different form
7. **Explore page** — search hero, cards, filters
8. **Feature pages** (4 pages) — shared layout + per-page content
9. **Route detail** — hero, stats, actions, reviews

## Dependencies & Risks

- **Font loading**: Instrument Serif from Google Fonts — add to `layout.tsx` via `next/font/google`
- **Image assets**: Must copy from marketing folder to public/images; verify file sizes are optimized
- **Existing SEO**: Preserve all existing metadata, JSON-LD schemas, and `generateMetadata` functions
- **Existing functionality**: Login/signup auth logic, explore data fetching, route detail GraphQL — must preserve all business logic
- **i18n**: Home page uses `next-intl` translations — redesign must keep translation keys working
- **Performance**: Heavy use of backdrop-filter and animations — test on lower-end devices

## Sources & References

### Design Source Files
- Home: `marketing/Moto vault/index.html` (1500+ lines of CSS + HTML)
- Explore: `marketing/Moto vault/explore.html`
- Login: `marketing/Moto vault/login.html`
- Features: `marketing/Moto vault/features/*.html`
- Route detail: `marketing/Moto vault/routes/pacific-coast-highway.html`
- Shared CSS: `marketing/Moto vault/assets/feature.css`
- Shared JS: `marketing/Moto vault/assets/nav.js`, `feature.js`

### Current Implementation
- Home: `apps/web/src/app/[locale]/(marketing)/page.tsx`
- Components: `apps/web/src/components/marketing/*.tsx`
- Login: `apps/web/src/app/login/page.tsx`
- Signup: `apps/web/src/app/signup/page.tsx`
- Explore: `apps/web/src/app/explore/page.tsx`
- Route detail: `apps/web/src/app/route/[country]/[region]/[slug]/page.tsx`
- Global CSS: `apps/web/src/app/globals.css`
