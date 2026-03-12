---
title: "feat: Stunning MotoVault Landing Page with Animations & SEO"
type: feat
status: active
date: 2026-03-08
deepened: 2026-03-08
---

# Stunning MotoVault Landing Page with Animations & SEO

## Enhancement Summary

**Deepened on:** 2026-03-08
**Research agents used:** 8 (architecture-strategist, performance-oracle, security-sentinel, pattern-recognition-specialist, code-simplicity-reviewer, kieran-typescript-reviewer, julik-frontend-races-reviewer, frontend-design-skill)
**Context7 docs queried:** Motion for React, Next.js 16.1.6

### Key Improvements
1. **Hybrid animation strategy:** Motion only for hero parallax; CSS `animation-timeline: view()` for all other scroll reveals — reduces client JS by ~40-60%
2. **4 critical architecture fixes:** Delete existing `page.tsx`, `metadataBase` in root layout only, dark class on `<div>` (not `<html>`), keep admin routes in place
3. **Race condition mitigations:** Navbar scroll hysteresis, CSS grid-rows FAQ (no AnimatePresence), mobile drawer state machine, server-side platform detection
4. **Creative design uplift:** Grain texture overlay, amber CTA color break, frosted glass nav, two-column FAQ, pseudo-element glow hovers
5. **Security hardening:** CSP header, ExternalLink component, JSON-LD via `JSON.stringify()` only

### Scope Adjustment (from simplicity review)
The original plan was over-scoped for an MVP. Key cuts:
- **Cut:** Logo Bar (no real logos), Testimonials (no real testimonials), How It Works (overlaps Features)
- **Deferred:** `/features`, `/pricing`, `/about` pages → add when traffic data justifies
- **Removed:** `blog/` routes (content source undefined), `schema-dts` dependency (overkill for 1-2 JSON-LD blocks)
- **Kept:** Homepage (4 sections: Hero, Features, CTA, FAQ), `/privacy`, `/terms`, SEO infrastructure
- **Result:** ~50% scope reduction, 8-10 files instead of ~20

---

## Overview

Build a visually stunning, high-converting marketing landing page for MotoVault — the AI-powered motorcycle learning & diagnostics platform. Replace the current placeholder homepage with a dark-themed, motion-rich experience that conveys speed, trust, and motorcycle culture. Built with Next.js 16 App Router, Tailwind CSS v4, and Motion (for hero parallax only — CSS animations handle everything else).

**Brand identity:** "Trusted Guide" — Deep Blue (trust), Teal Green (growth), Amber (encouragement). Dark theme default for the motorcycle/automotive aesthetic.

**Design philosophy:** Not a SaaS template. This should feel like walking into a showroom — grain texture for photographic warmth, an amber CTA section that breaks the dark monotony like a gear shift, frosted glass navigation, and spatial composition that uses asymmetry and scale contrasts to feel genuinely designed.

## Problem Statement / Motivation

The current web app (`apps/web`) has only a placeholder homepage with a centered title and "Sign In" link. There is no public marketing presence, no SEO, no app store conversion funnel, and no way for potential users to discover MotoVault through search. The mobile app is feature-rich but invisible on the web.

A stunning landing page is critical for:
- **User acquisition:** Drive app downloads via organic search and direct visits
- **Brand credibility:** Establish MotoVault as a premium, trustworthy platform
- **SEO foundation:** Rank for motorcycle maintenance, diagnostics, and learning queries
- **Conversion:** Convert visitors into app downloads with clear CTAs

## Proposed Solution

### Architecture: `(marketing)` Route Group

Create a `(marketing)` route group to isolate public pages from the admin dashboard. **Do NOT move admin routes** — they already work at `/admin/*` with middleware scoping.

```
apps/web/src/app/
├── (marketing)/
│   ├── layout.tsx          # Dark theme layout with nav + footer
│   ├── page.tsx            # Homepage (hero, features, CTA, FAQ)
│   ├── error.tsx           # Dark-themed error boundary
│   ├── privacy/
│   │   └── page.tsx        # Privacy policy
│   └── terms/
│       └── page.tsx        # Terms of service
├── admin/                  # KEEP AS-IS — do not move to route group
│   ├── layout.tsx
│   └── ...
├── login/
│   └── page.tsx            # Standalone login — receives root layout only (intentional)
├── layout.tsx              # Root layout (shared fonts, metadataBase)
├── globals.css
├── sitemap.ts
├── robots.ts
└── not-found.tsx           # Branded 404
```

> **CRITICAL:** Delete existing `apps/web/src/app/page.tsx` when creating `(marketing)/page.tsx`. Both resolve to `/` — the build will fail with ambiguous routing if both exist.

### Research Insights: Architecture

- **Why NOT `(admin)` route group:** Admin routes already have URL-based isolation (`/admin/*`) and middleware scoping. Wrapping in `(admin)/admin/` adds indirection for zero benefit and risks breaking existing links/middleware.
- **Login route isolation is intentional:** `/login` receives only the root layout (no navbar/footer, no dark theme). This is correct for a standalone auth page.
- **`error.tsx` in marketing group:** Ensures animation failures render a dark-themed error, not the root light-themed fallback.

### Tech Stack Additions

| Package | Purpose | Size |
|---------|---------|------|
| `motion` (v12.x) | Hero parallax only (`useScroll`, `useTransform`) | ~10-12KB gzipped (tree-shaken) |

> **Dropped:** `schema-dts` — overkill for 1-2 JSON-LD blocks. Type the objects inline.

### Design Direction

- **Dark theme** via `<div className="dark">` wrapper in marketing layout (NOT on `<html>` — child layouts cannot modify the root element)
- **Hero parallax** with Motion `useScroll`/`useTransform` (the one section that justifies the library)
- **CSS scroll-driven reveals** via `animation-timeline: view()` on all other sections — zero JS, compositor-driven, sections stay as Server Components
- **Grain/noise texture overlay** — fixed `::after` on the marketing wrapper, `mix-blend-mode: overlay`, 3-4% opacity. Kills digital flatness.
- **Amber CTA color break** — one section inverts to Amber background with Deep Blue text. The visual disruption forces attention.
- **Frosted glass navbar** — `backdrop-filter: blur(16px) saturate(180%)` with Deep Blue at 60% opacity on scroll
- **Asymmetric bento grid** with cursor-tracking card tilt and pseudo-element glow hovers
- **Two-column FAQ** — questions left, answers right. CSS `grid-template-rows: 0fr → 1fr` for accordion (no AnimatePresence).
- **Reduced-motion fallback** — `prefers-reduced-motion` disables all animations; content renders statically
- **Mobile-first responsive** using Tailwind breakpoints; parallax disabled below `md`

### Research Insights: Design (from frontend-design skill)

**What makes it memorable vs. template-like:**
1. **Grain texture** — single biggest contributor to a "designed, not generated" feel
2. **Amber CTA section** — one dramatic color shift prevents dark-mode monotony (like a gear shift)
3. **Editorial scale contrasts** — massive hero text (`clamp(3.5rem, 8vw, 7rem)`), tiny legal text (11-12px, 40% opacity)
4. **Motorcycle metaphors** — instrument gauges (progress bars), garage door (hero reveal), contour maps (journey)
5. **Split-screen hero** — left 55% text, right 45% motorcycle image bleeding behind text at partial opacity
6. **Bento hover effect** — cards tilt 3-5 degrees toward cursor using `perspective(1000px)` + `rotateX/rotateY`

**What to actively avoid:**
- Phone mockups floating in purple/blue gradient space
- Perfectly centered, symmetrical layouts for every section
- Generic gradient orbs/blobs in the background
- Uniform card sizes in the bento grid
- Overly polished 3D renders — photography and typography carry more brand weight

## Technical Approach

### Phase 1: Foundation & Layout

**Goal:** Set up routing, install Motion, create marketing layout with navbar and footer, delete placeholder homepage.

#### Tasks

- [ ] **Delete `apps/web/src/app/page.tsx`** — prevents route conflict with `(marketing)/page.tsx`
- [ ] **Install Motion:** `pnpm add motion --filter @motovault/web`
- [ ] **Update root `layout.tsx`** — add `metadataBase: new URL("https://motovault.app")` (set ONCE here, not in marketing layout)
- [ ] **Add CSP header** to `next.config.ts`:
  ```typescript
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
  }
  ```
- [ ] **Create `(marketing)/layout.tsx`** (Server Component — no `'use client'`)
  - Wrapper `<div className="dark min-h-screen bg-neutral-950 text-neutral-50">`
  - Grain texture `::after` pseudo-element on the wrapper (CSS only)
  - Render `<Navbar />` and `<Footer />`
  - Note: intentionally uses Tailwind utility classes directly (not `--color-surface` semantic variables) for fixed dark theme
- [ ] **Create `(marketing)/error.tsx`** — dark-themed error boundary
- [ ] **Build `Navbar`** (`components/marketing/navbar.tsx`) — `'use client'`
  - Initial: fully transparent, logo + links in white
  - Scrolled: frosted glass (`backdrop-filter: blur(16px) saturate(180%)`, primary at 60% opacity, 1px bottom border at 10% white)
  - **Hysteresis:** activate at 80px scroll, deactivate at 20px (prevents flicker at threshold)
  - Nav link hover: underline slides in from left via `scaleX(0→1)` with `transform-origin: left`, 2px Teal Green, 4px below text
  - CTA button: only Amber element in the navbar, pill-shaped, small
  - Mobile: full-screen overlay (not drawer) with staggered links. Close on `usePathname()` change.
  - Use `position: sticky` (not `fixed`) to avoid layout shifts
- [ ] **Build `Footer`** (`components/marketing/footer.tsx`) — Server Component (static links, no interactivity)
  - 4-column grid with Admin link preserved
  - All external links use `<ExternalLink>` component (enforces `rel="noopener noreferrer" target="_blank"`)
  - Copyright, social icons (monochrome → brand color on hover)
  - Legal links at 11-12px, 40% opacity
- [ ] **Build `ExternalLink`** utility component (`components/marketing/external-link.tsx`) — Server Component

```tsx
// apps/web/src/app/(marketing)/layout.tsx
import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: {
    default: "MotoVault — AI-Powered Motorcycle Learning & Diagnostics",
    template: "%s | MotoVault",
  },
  description:
    "Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health. Learn your bike. Fix your bike.",
  openGraph: {
    siteName: "MotoVault",
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
```

> **Note:** `metadataBase` is in the ROOT layout (`apps/web/src/app/layout.tsx`), not here. This layout only sets marketing-specific defaults.

#### Client/Server Component Map

| File | Boundary | Why |
|------|----------|-----|
| `(marketing)/layout.tsx` | Server | Static metadata + layout |
| `(marketing)/page.tsx` | Server | Composes sections, renders JSON-LD |
| `(marketing)/error.tsx` | Client | Error boundaries must be client |
| `navbar.tsx` | **Client** | Scroll listener, mobile menu state |
| `footer.tsx` | Server | Static links |
| `external-link.tsx` | Server | Simple `<a>` wrapper |
| `hero.tsx` | **Client** | Motion `useScroll`/`useTransform` |
| `features-grid.tsx` | Server | CSS scroll reveals (no JS) |
| `cta-section.tsx` | Server | Static content + links |
| `faq.tsx` | **Client** | Accordion open/close state |

#### Files

| File | Action |
|------|--------|
| `apps/web/src/app/page.tsx` | **Delete** |
| `apps/web/package.json` | Add `motion` |
| `apps/web/next.config.ts` | Add CSP header |
| `apps/web/src/app/layout.tsx` | Add `metadataBase` |
| `apps/web/src/app/(marketing)/layout.tsx` | Create |
| `apps/web/src/app/(marketing)/error.tsx` | Create |
| `apps/web/src/components/marketing/navbar.tsx` | Create |
| `apps/web/src/components/marketing/footer.tsx` | Create |
| `apps/web/src/components/marketing/external-link.tsx` | Create |

### Research Insights: Navbar Race Conditions

**Scroll flicker prevention (hysteresis):**
```tsx
const ACTIVATE_THRESHOLD = 80;
const DEACTIVATE_THRESHOLD = 20;
const [isScrolled, setIsScrolled] = useState(false);

useMotionValueEvent(scrollY, "change", (latest) => {
  if (!isScrolled && latest > ACTIVATE_THRESHOLD) setIsScrolled(true);
  else if (isScrolled && latest < DEACTIVATE_THRESHOLD) setIsScrolled(false);
});
```

**Mobile menu state machine:**
```tsx
// Close menu on navigation to prevent stale drawer on new page
const pathname = usePathname();
useEffect(() => { setMenuOpen(false); }, [pathname]);

// Add `inert` attribute to page content behind open menu
```

---

### Phase 2: Homepage — 4 Sections

**Goal:** Build the homepage with Hero, Features Grid, Download CTA, and FAQ.

#### Section 1: Hero (`components/marketing/hero.tsx`) — `'use client'`

```
┌─────────────────────────────────────────────────┐
│  [Background: dark gradient + grain texture]     │
│                                                   │
│  ┌─────────── 55% ──────────┬──── 45% ─────┐    │
│  │                           │               │    │
│  │  LEARN YOUR BIKE.        │  [motorcycle   │    │
│  │  FIX YOUR BIKE.          │   silhouette   │    │
│  │                           │   bleeding     │    │
│  │  AI-powered diagnostics   │   behind text  │    │
│  │  & learning — one app.    │   at 30%       │    │
│  │                           │   opacity]     │    │
│  │  [Download Free] [See ↓]  │               │    │
│  │                           │               │    │
│  └───────────────────────────┴───────────────┘    │
│                                                   │
│         ↓ scroll indicator (CSS animate-bounce)   │
└─────────────────────────────────────────────────┘
```

**Implementation details:**
- Full viewport height (`h-screen`)
- **Split-screen layout:** Left 55% text, right 45% motorcycle SVG bleeding behind text via absolute positioning + `z-index: -1` + partial opacity
- **Headline:** `font-size: clamp(3.5rem, 8vw, 7rem)`, `letter-spacing: -0.04em`, `font-weight: 800`. Text gradient on "FIX" using Deep Blue → Teal Green with `background-clip: text`.
- **DO NOT animate the headline text.** Render at full opacity immediately — this is the LCP element. Only animate decorative elements.
- **Parallax (Motion):** `useScroll({ target: heroRef, offset: ["start start", "end start"] })` — scoped to hero ref so the listener detaches after hero exits viewport. Motorcycle SVG drifts slightly upward (counter-intuitive direction creates magnetic tension).
- **Speed lines:** CSS `@keyframes` with `translateX`, NOT `background-position`. Add `will-change: transform`. Pause via `animation-play-state: paused` when hero exits viewport.
- **Scroll indicator:** Plain DOM element with CSS `animate-bounce`. NOT wrapped in any `motion.div`. Fade out with CSS `opacity` transition at `scrollY > 100`.
- **Mobile (< md):** Disable parallax entirely via CSS media query at render time. Single-column layout. Simple fade-in only.
- **CTA buttons:** Primary has "liquid fill" hover (pseudo-element `scaleX(0→1)` from left in Amber). Secondary is ghost button with 1px → 2px border thickening on hover.
- **Explicit dimensions:** Hero section `h-screen`, motorcycle SVG has explicit `width`/`height` — prevents CLS during hydration and scroll restoration.

**Performance (from performance-oracle):**
- `will-change: transform` on all parallax layers (GPU-composited)
- Motorcycle SVG: keep under 20 path elements
- Import Motion from `motion/react` exclusively (tree-shaking)
- Gate parallax behind `useReducedMotion` — if reduced motion, don't set up scroll listeners at all

**Race condition mitigation (from frontend-races):**
- Parallax + scroll restore: explicit dimensions ensure layout is stable before hydration. Parallax transforms compute from zero offset if page is scrolled (no visual jump).

#### Section 2: Features Grid (`components/marketing/features-grid.tsx`) — Server Component

**CSS scroll reveal — zero JavaScript:**
```css
.reveal-on-scroll {
  animation: reveal 0.5s ease both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}
@keyframes reveal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- Asymmetric bento grid with `grid-template-areas` — one hero card (AI Diagnostics, 2x size), four smaller cards
- CSS stagger via `nth-child()` with incremental `animation-delay` (50ms increments)
- **Hero card (AI Diagnostics):** Largest card with inner radial gradient glow at 5% opacity of Deep Blue
- **Card hover glow:** Use `::after` pseudo-element with pre-applied `box-shadow` and animate only `opacity: 0→1` on hover (compositor-only, no paint). Never transition `box-shadow` directly.
- **Card tilt on hover:** `perspective(1000px)` with `rotateX`/`rotateY` calculated from cursor position (3-5 degrees max). Requires a small inline `<script>` or thin client wrapper for the hover effect only.
- **Card borders:** `border-image` gradient matching feature accent color at 20% opacity, rising to 60% on hover
- Brand color accents: Blue for Diagnostics, Teal for Learning, Amber for Garage, Green for Progress
- `@supports not (animation-timeline: view())` fallback: elements render at full opacity (no animation). Progressive enhancement.

#### Section 3: Download CTA (`components/marketing/cta-section.tsx`) — Server Component

**The amber color break:**
- Full-width section with **Amber background** (not the dark theme) — the ONE section that inverts the color scheme
- Text in Deep Blue (dark on warm) — impossible to scroll past without noticing
- Large headline: "Ready to Master Your Motorcycle?" — heaviest font weight, tight tracking (`letter-spacing: -0.03em`)
- **Both** App Store and Google Play badges shown (not platform-aware detection — showing both is better for shared URLs and avoids CLS from UA detection)
- QR code: styled with rounded modules and brand mark in center, Deep Blue on Amber
- Phone mockup with subtle white glow halo (`box-shadow: 0 0 60px rgba(255,255,255,0.1)`)
- App store badges: `scale(0.96)` on click for 100ms "press" effect (CSS transition)
- CSS scroll reveal animation (same as features grid)

> **Why not platform detection:** Server-side UA detection requires dynamic rendering (can't use ISR/static). Showing both store links is better UX anyway — users share URLs cross-platform. Eliminates CLS from wrong-button flash.

#### Section 4: FAQ (`components/marketing/faq.tsx`) — `'use client'` (minimal — only accordion state)

**Two-column layout with CSS accordion (no AnimatePresence):**
- Left column (40%): Questions list with numbered prefixes ("01.", "02.", etc.) in Teal Green
- Right column (60%): Expanded answer content
- Stacked single-column on mobile
- Active question: left border accent (3px Teal Green, `scaleY(0→1)` from top), text shifts to white
- **CSS accordion animation:**
  ```css
  .faq-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 200ms ease-out;
  }
  .faq-content[data-open="true"] {
    grid-template-rows: 1fr;
  }
  .faq-content > div { overflow: hidden; }
  ```
- Answer text fades in (`opacity 0→1`) 100ms after height animation starts (sequenced CSS transitions)
- FAQ data extracted to a **shared constant** consumed by both the FAQ component AND the JSON-LD script in `page.tsx` (Server Component)

**Race condition mitigation:** CSS `grid-template-rows` transitions are interruptible by design — rapid clicking gracefully reverses from current position. No AnimatePresence timing issues.

**FAQ Questions:**
1. What is MotoVault?
2. Is MotoVault free?
3. What motorcycles are supported?
4. How does AI diagnostics work?
5. Is my data safe?
6. What's included in MotoVault Pro?

#### Homepage Composition (`(marketing)/page.tsx`) — Server Component

```tsx
// Server Component — no 'use client'
import { Hero } from "@/components/marketing/hero";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { FAQ_DATA } from "@/components/marketing/faq-data";

// JSON-LD rendered in server component, NOT inside client components
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MotoVault",
  url: "https://motovault.app",
  description: "AI-powered motorcycle learning & diagnostics platform",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_DATA.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <FeaturesGrid />
      <CtaSection />
      <Faq />
    </>
  );
}
```

> **Security:** Always use `JSON.stringify()` for JSON-LD. Never template literals with interpolated strings. `JSON.stringify()` handles `</script>` injection. When Phase 6 (blog) adds dynamic content, sanitize all API-sourced strings before inclusion.

#### Tasks

- [ ] **Create Hero section** with parallax layers (Motion), split-screen layout, grain texture
- [ ] **Create motorcycle SVG** — abstract silhouette, < 20 paths, explicit dimensions
- [ ] **Create Features Grid** — asymmetric bento, CSS scroll reveals, pseudo-element glow hovers
- [ ] **Create Download CTA** — amber color break, both store badges, QR code
- [ ] **Create FAQ** — two-column layout, CSS grid-rows accordion, shared data constant
- [ ] **Create FAQ data constant** (`components/marketing/faq-data.ts`) — shared by FAQ component + JSON-LD
- [ ] **Compose homepage** (`(marketing)/page.tsx`) — Server Component with JSON-LD scripts
- [ ] **Add CSS scroll reveal styles** to `globals.css`

#### Files

| File | Action |
|------|--------|
| `apps/web/src/app/(marketing)/page.tsx` | Create |
| `apps/web/src/components/marketing/hero.tsx` | Create |
| `apps/web/src/components/marketing/features-grid.tsx` | Create |
| `apps/web/src/components/marketing/cta-section.tsx` | Create |
| `apps/web/src/components/marketing/faq.tsx` | Create |
| `apps/web/src/components/marketing/faq-data.ts` | Create |
| `apps/web/src/app/globals.css` | Update (add scroll reveal + grain styles) |

---

### Phase 3: Legal Pages & SEO Infrastructure

**Goal:** Add required legal pages, sitemap, robots.txt, OG image, and branded 404.

#### Legal Pages

- `/privacy` — Privacy Policy with proper structure (placeholder content). Clean typography, minimal dark theme, no animations.
- `/terms` — Terms of Service with same treatment.
- Both are Server Components with static metadata.

#### SEO

- [ ] **Create `app/sitemap.ts`** — homepage, privacy, terms (expand when adding pages)
- [ ] **Create `app/robots.ts`** — allow `/`, disallow `/admin/`, `/api/`, `/login`
- [ ] **Create static OG image** (`public/og-image.png` — 1200x630, branded)
- [ ] **Add canonical URLs** via metadata `alternates.canonical` on all pages
- [ ] **Branded 404** — dark theme, "Lost on the road?" headline, link to homepage

```tsx
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/login"] },
    sitemap: "https://motovault.app/sitemap.xml",
  };
}
```

#### Files

| File | Action |
|------|--------|
| `apps/web/src/app/(marketing)/privacy/page.tsx` | Create |
| `apps/web/src/app/(marketing)/terms/page.tsx` | Create |
| `apps/web/src/app/sitemap.ts` | Create |
| `apps/web/src/app/robots.ts` | Create |
| `apps/web/public/og-image.png` | Create |
| `apps/web/src/app/not-found.tsx` | Update (dark branded) |

---

### Phase 4: Polish & Performance

**Goal:** Responsive audit, accessibility, performance verification.

#### Tasks

- [ ] **Responsive audit** at 320px, 640px, 768px, 1024px, 1280px, 2560px
- [ ] **Mobile:** parallax disabled, single-column hero, touch-friendly CTAs (44x44px min)
- [ ] **Accessibility:**
  - `prefers-reduced-motion`: all animations disabled, content renders statically
  - WCAG AA contrast on all text (especially on dark + amber backgrounds)
  - Semantic HTML: heading hierarchy, landmarks, alt text on SVGs
  - Keyboard nav: all interactive elements focusable, FAQ accordion operable with Enter/Space
  - Mobile menu: `inert` attribute on page content when menu is open
- [ ] **Performance:**
  - Verify Motion tree-shaking with `@next/bundle-analyzer`
  - Confirm only hero ships Motion JS; other sections are CSS-only Server Components
  - LCP: hero headline renders at full opacity immediately (not animated)
  - CLS: all images/SVGs have explicit dimensions; animations use only `opacity`/`transform`
  - Import from `motion/react` exclusively
- [ ] **Preserve admin access** — "Admin" link in footer, `/login` route functional
- [ ] **Verify build:** `pnpm build --filter @motovault/web` succeeds with no TS errors

---

## System-Wide Impact

### Interaction Graph

- **Marketing pages → no backend interaction.** All pages are static/server-rendered. No GraphQL, no auth.
- **Admin dashboard unaffected.** Routes stay at `/admin/*`, middleware unchanged.
- **Login route unaffected.** Receives root layout only (intentional).

### Error Propagation

- Static pages — only build-time errors possible.
- `(marketing)/error.tsx` catches client-side animation failures with dark-themed fallback.
- Failed animations degrade to static rendering — content always visible.

### State Lifecycle Risks

- **No persistent state.** No sessions, no forms, no database writes.
- **Theme:** Dark class on wrapper `<div>`, no runtime switching.
- **Body background:** Root layout's `<body>` remains light-themed. The marketing wrapper's `bg-neutral-950 min-h-screen` covers the viewport. On overscroll, a light background may briefly show — acceptable for MVP.

## Acceptance Criteria

### Functional Requirements

- [ ] Homepage loads with parallax hero, features grid, amber CTA section, and FAQ
- [ ] Navigation bar: transparent on hero, frosted glass on scroll, mobile full-screen overlay
- [ ] Features grid reveals on scroll via CSS `animation-timeline: view()`
- [ ] FAQ accordion works with CSS grid-rows transition (no JS animation library)
- [ ] CTA section uses amber color inversion with both app store badges
- [ ] Privacy and Terms pages render with proper structure
- [ ] Footer includes nav links, social links, legal links, and admin link
- [ ] Admin dashboard remains fully functional at `/admin`
- [ ] Grain texture overlay visible across all marketing pages

### Non-Functional Requirements

- [ ] LCP < 2.5s (hero headline renders immediately, not animated)
- [ ] CLS < 0.1 (explicit dimensions on all images/SVGs, transform-only animations)
- [ ] INP < 200ms (CSS transitions for hovers/accordions, no React re-renders)
- [ ] All animations respect `prefers-reduced-motion`
- [ ] WCAG AA color contrast on all text
- [ ] Responsive: 320px to 2560px
- [ ] Lighthouse SEO > 95
- [ ] JSON-LD validates at Schema.org validator
- [ ] Only hero section ships Motion JS; all other sections are Server Components

### Quality Gates

- [ ] Biome lint passes (`pnpm lint`)
- [ ] Next.js build succeeds (`pnpm build --filter @motovault/web`)
- [ ] No TypeScript errors
- [ ] Lighthouse performance > 90
- [ ] Bundle analysis confirms Motion tree-shaking

## Dependencies & Prerequisites

- **`motion` v12.x** — only new runtime dependency
- **No backend changes** required
- **No database changes** required
- **Design assets:** Abstract motorcycle SVG (CSS-only or inline SVG, < 20 paths)
- **Content:** Headlines, descriptions, and FAQ answers defined in this plan

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Motion bundle too large | Slower loads | Use Motion ONLY for hero parallax; CSS for everything else. Verify with bundle analyzer. |
| Dark theme breaks admin | Admin unusable | `(marketing)` route group isolates completely. Admin routes untouched. |
| Parallax janky on mobile | Poor UX | Disable via CSS media query at render time (not `useEffect`). |
| Navbar flicker at scroll threshold | Visual glitch | Hysteresis: activate at 80px, deactivate at 20px. |
| FAQ rapid-click race condition | Janky accordion | CSS `grid-template-rows` transitions are interruptible by design. |
| Mobile menu stale on navigation | Broken UX | Close menu on `usePathname()` change. |
| CTA platform detection CLS | Layout shift | Show both app store badges. No client-side UA detection. |
| Route conflict with existing page.tsx | Build failure | Delete existing `page.tsx` in Phase 1 (first task). |
| JSON-LD XSS via `dangerouslySetInnerHTML` | Security | Always use `JSON.stringify()`. Never template literals. |
| Body background flash (overscroll) | Minor visual | `bg-neutral-950 min-h-screen` on wrapper covers viewport. |
| Social proof numbers misleading | Trust damage | Use real numbers only. Mark placeholder content clearly. |

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Animation library scope | Motion for hero ONLY, CSS for rest | Reduces client JS ~50%, keeps 5/6 sections as Server Components |
| FAQ implementation | CSS `grid-template-rows` | Eliminates AnimatePresence, race-free, zero-JS |
| `schema-dts` | Dropped | Overkill for 1-2 JSON-LD blocks; inline types suffice |
| Dark class placement | `<div>` wrapper (not `<html>`) | Child layouts can't modify root element in Next.js App Router |
| `metadataBase` | Root layout only | All routes (marketing + admin) benefit from single source |
| Admin route group | NOT created | Admin already isolated by URL + middleware; moving adds risk |
| Platform CTA buttons | Show both stores | Avoids CLS, works for shared URLs, no dynamic rendering needed |
| Sub-pages (features/pricing/about) | Deferred | No traffic data to justify; add when analytics show demand |
| Blog routes | Removed from plan | Content source undefined; add when decided |
| Logo bar | Cut | No real partner logos; fabricated logos damage credibility |
| Testimonials | Cut | No real user testimonials; add when real feedback exists |
| How It Works section | Cut | Overlaps with features grid |
| Scroll reveals | CSS `animation-timeline: view()` | Zero JS, compositor-driven, progressive enhancement |
| Box-shadow hovers | `::after` pseudo-element opacity | Compositor-only, avoids paint operations |
| Product name | "MotoVault" | Matches codebase, CLAUDE.md, existing metadata |
| OG images | Static PNG for MVP | Dynamic `opengraph-image.tsx` is future optimization |

## Future Work (post-launch, data-driven)

Add these when analytics/user feedback justifies:

- [ ] `/features` page — when homepage features section isn't sufficient
- [ ] `/pricing` page — when Pro tier launches and needs comparison
- [ ] `/about` page — when brand story matters for conversion
- [ ] Blog (`/blog`, `/blog/[slug]`) — when content source is decided (CMS, MDX, or articles API)
- [ ] Testimonials section — when real user quotes exist
- [ ] Logo/partner bar — when real partnerships are established
- [ ] Dynamic OG images via `opengraph-image.tsx` — when per-page social previews matter
- [ ] `schema-dts` — when JSON-LD appears on 5+ pages
- [ ] Cookie consent banner — when analytics/tracking is integrated
- [ ] i18n (`/es/`, `/de/`) — when international user base grows
- [ ] Newsletter signup / email capture — for desktop conversion funnel

## Sources & References

### Internal References

- Root CLAUDE.md: `/Users/andrej/MotoVault/CLAUDE.md`
- Web layout: `/Users/andrej/MotoVault/apps/web/src/app/layout.tsx`
- Current homepage (to delete): `/Users/andrej/MotoVault/apps/web/src/app/page.tsx`
- Design tokens CSS: `/Users/andrej/MotoVault/packages/design-system/src/tokens.css`
- Semantic CSS (theme): `/Users/andrej/MotoVault/packages/design-system/src/semantic.css`
- Color palette (hex): `/Users/andrej/MotoVault/packages/design-system/src/palette.ts`
- Typography: `/Users/andrej/MotoVault/packages/design-system/src/typography.ts`
- Web middleware: `/Users/andrej/MotoVault/apps/web/src/middleware.ts`
- Globals CSS dark variant: `/Users/andrej/MotoVault/apps/web/src/app/globals.css` line 5: `@custom-variant dark (&:where(.dark, .dark *))`

### External References

- [Motion for React docs](https://motion.dev/docs/react)
- [Motion useScroll API](https://motion.dev/docs/react-use-scroll)
- [Next.js 16 Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js JSON-LD Guide](https://nextjs.org/docs/app/guides/json-ld)
- [Next.js Sitemap Convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Next.js OG Image Generation](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [CSS animation-timeline: view()](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline/view)
- [Tailwind CSS v4 Animation Utilities](https://tailwindcss.com/docs/animation)
- [Core Web Vitals 2026](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
- [CSS grid-template-rows accordion technique](https://css-tricks.com/css-grid-and-custom-shapes/#aa-the-expand-collapse-animation)

### Deepening Research

- Architecture review: route group isolation, admin migration risk, metadataBase placement
- Performance review: CSS scroll reveals vs Motion, LCP protection, compositor-only animations
- Security review: CSP headers, JSON-LD XSS, ExternalLink component, GDPR considerations
- Frontend races review: navbar hysteresis, FAQ rapid-click, mobile drawer state machine
- Design review: grain texture, amber break, frosted glass, editorial scale contrasts
- Simplicity review: scope reduction from ~20 files to ~10, deferred sub-pages
- TypeScript review: client/server boundaries, React 19 compatibility, params Promise pattern
- Pattern review: dark class placement, semantic CSS divergence, error boundaries
