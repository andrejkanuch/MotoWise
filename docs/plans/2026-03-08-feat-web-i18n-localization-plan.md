---
title: "feat: Add i18n localization to web app"
type: feat
status: active
date: 2026-03-08
---

# feat: Add i18n Localization to Web App

## Overview

Add multi-language support (English, Spanish, German) to the Next.js 16 web app (`apps/web`), matching the mobile app's existing locale support. Use `next-intl` for App Router-native i18n with Server Component support, URL-based locale routing, and full SEO compliance (hreflang, localized metadata, sitemap alternates).

## Problem Statement / Motivation

The mobile app already supports EN/ES/DE via i18next. The web marketing site is English-only with ~80-100 hardcoded strings across 12 files. International users see English regardless of their browser language. Search engines can only index English content. This limits reach in Spanish and German-speaking markets.

## Proposed Solution

Use `next-intl` (v4.x) with Next.js 16 App Router:

- **URL-based routing** via `[locale]` dynamic segment with `localePrefix: 'as-needed'` (English at `/`, Spanish at `/es`, German at `/de`)
- **Server-first translations** — most marketing pages are Server Components (zero client JS for translations)
- **Proxy-based locale detection** — extend existing `proxy.ts` to handle locale negotiation alongside admin auth
- **Separate web translation files** — web has different content than mobile; maintain independent `messages/{en,es,de}.json` files
- **Locale-aware SEO** — hreflang alternates, localized OG metadata, sitemap with language alternates

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | `next-intl` (not i18next) | Purpose-built for App Router, RSC support, ~4KB client, built-in routing/middleware |
| URL strategy | `localePrefix: 'as-needed'` | English keeps clean `/` URLs (no breaking change), ES/DE get `/es`, `/de` prefixes |
| Translation format | ICU MessageFormat (`{variable}`) | next-intl native format; mobile uses `{{variable}}` but content is different anyway |
| Translation sharing | Independent files | Only ~3 keys overlap with mobile (appName, tagline); rest is web-specific marketing content |
| Legal pages | JSON keys per section | Privacy/terms have 4-5 short sections each; fits JSON key structure fine |
| Admin pages | NOT translated | YAGNI — team speaks English (consistent with mobile i18n decision) |
| Login page | NOT translated | Admin-facing; stays outside `[locale]` segment |
| Locale persistence | Cookie via next-intl default | `NEXT_LOCALE` cookie preserves user's explicit language choice |

## Technical Approach

### Architecture

```
apps/web/src/
  i18n/
    routing.ts              # defineRouting({ locales, defaultLocale })
    request.ts              # getRequestConfig — loads messages per locale
    navigation.ts           # createNavigation — locale-aware Link, useRouter, usePathname
  messages/
    en.json                 # ~80-100 keys, namespaced
    es.json
    de.json
  proxy.ts                  # Composed: next-intl locale detection + admin auth guard
  app/
    [locale]/
      layout.tsx            # Root locale layout with NextIntlClientProvider, <html lang={locale}>
      (marketing)/
        layout.tsx          # Marketing layout (navbar, footer, dark theme)
        page.tsx            # Homepage with translated JSON-LD
        privacy/page.tsx    # Translated privacy policy
        terms/page.tsx      # Translated terms of service
        error.tsx           # Translated error boundary
      not-found.tsx         # Translated 404 page
    admin/                  # UNCHANGED — stays outside [locale]
      layout.tsx
      page.tsx
    login/                  # UNCHANGED — stays outside [locale]
      page.tsx
    layout.tsx              # Minimal root layout (fonts, globals.css only — NO <html> tag)
    not-found.tsx           # Global catch-all 404 (for /admin 404s etc.)
```

### Translation Key Structure (messages/en.json)

```json
{
  "Metadata": {
    "title": "MotoWise — AI-Powered Motorcycle Learning & Diagnostics",
    "titleTemplate": "{title} | MotoWise",
    "description": "Master motorcycle maintenance, diagnose issues with AI photos, and track your bike's health."
  },
  "Navbar": {
    "features": "Features",
    "faq": "FAQ",
    "download": "Download App",
    "openMenu": "Open navigation menu",
    "closeMenu": "Close navigation menu"
  },
  "Hero": {
    "line1": "LEARN YOUR BIKE.",
    "line2": "FIX",
    "line3": "YOUR BIKE.",
    "subtitle": "AI-powered motorcycle diagnostics & learning — all in one app.",
    "downloadCta": "Download Free",
    "exploreFeatures": "Explore Features",
    "scrollDown": "Scroll down"
  },
  "Features": {
    "sectionTitle": "Built for Riders",
    "sectionSubtitle": "Everything you need to learn, maintain, and master your motorcycle.",
    "diag": { "title": "AI Diagnostics", "tagline": "Snap a photo. Get answers.", "description": "..." },
    "learn": { "title": "Learning Paths", "tagline": "...", "description": "..." },
    "garage": { "title": "Garage Management", "tagline": "...", "description": "..." },
    "progress": { "title": "Progress Tracking", "tagline": "...", "description": "..." },
    "community": { "title": "Community", "tagline": "...", "description": "..." }
  },
  "Cta": {
    "headline": "Ready to Master Your Motorcycle?",
    "subtitle": "Join thousands of riders already learning with AI.",
    "appStorePrefix": "Download on the",
    "appStore": "App Store",
    "playStorePrefix": "Get it on",
    "playStore": "Google Play",
    "disclaimer": "Free to download. No credit card required."
  },
  "Faq": {
    "sectionTitle": "Frequently Asked Questions",
    "items": [
      { "question": "What is MotoWise?", "answer": "..." },
      { "question": "Is MotoWise free?", "answer": "..." },
      { "question": "What motorcycles are supported?", "answer": "..." },
      { "question": "How does AI diagnostics work?", "answer": "..." },
      { "question": "Is my data safe?", "answer": "..." },
      { "question": "What's included in MotoWise Pro?", "answer": "..." }
    ]
  },
  "Footer": {
    "product": "Product",
    "company": "Company",
    "connect": "Connect",
    "tagline": "Learn your bike. Fix your bike.",
    "copyright": "© 2026 MotoWise. All rights reserved.",
    "features": "Features",
    "download": "Download",
    "faq": "FAQ",
    "privacy": "Privacy",
    "terms": "Terms",
    "admin": "Admin"
  },
  "Privacy": {
    "title": "Privacy Policy",
    "lastUpdated": "Last updated: March 8, 2026",
    "infoCollectTitle": "Information We Collect",
    "infoCollect": "When you create a MotoWise account...",
    "howWeUseTitle": "How We Use Your Information",
    "howWeUse": "We use your information to provide and improve...",
    "securityTitle": "Data Security",
    "security": "MotoWise uses Supabase with row-level security...",
    "rightsTitle": "Your Rights",
    "rights": "You can export or delete your data..."
  },
  "Terms": {
    "title": "Terms of Service",
    "lastUpdated": "Last updated: March 8, 2026",
    "acceptanceTitle": "Acceptance of Terms",
    "acceptance": "By accessing or using MotoWise...",
    "useTitle": "Use of Service",
    "use": "MotoWise provides AI-powered motorcycle learning...",
    "accountsTitle": "User Accounts",
    "accounts": "You are responsible for maintaining...",
    "ipTitle": "Intellectual Property",
    "ip": "All content, features, and functionality...",
    "liabilityTitle": "Limitation of Liability",
    "liability": "MotoWise is provided \"as is\"..."
  },
  "NotFound": {
    "code": "404",
    "message": "This page doesn't exist.",
    "backHome": "Back to Home"
  },
  "Error": {
    "title": "Something went wrong",
    "retry": "Try again"
  },
  "LanguageSwitcher": {
    "en": "English",
    "es": "Espanol",
    "de": "Deutsch"
  }
}
```

### Implementation Phases

#### Phase 1: Foundation (next-intl setup + route restructuring)

- [ ] Install `next-intl` — `pnpm --filter web add next-intl`
- [ ] Create `apps/web/src/i18n/routing.ts` — `defineRouting({ locales: ['en', 'es', 'de'], defaultLocale: 'en', localePrefix: 'as-needed' })`
- [ ] Create `apps/web/src/i18n/request.ts` — `getRequestConfig` that loads `messages/{locale}.json`
- [ ] Create `apps/web/src/i18n/navigation.ts` — `createNavigation(routing)` exporting `Link`, `useRouter`, `usePathname`, `redirect`
- [ ] Wrap `next.config.ts` with `createNextIntlPlugin` from `next-intl/plugin`
- [ ] Rewrite `proxy.ts` — compose next-intl's `createMiddleware` with existing admin auth logic; matcher covers all routes except `_next`, `api`, static files
- [ ] Restructure routes — move `(marketing)/` and `not-found.tsx` under `app/[locale]/`; keep `admin/` and `login/` at root
- [ ] Create `app/[locale]/layout.tsx` — `NextIntlClientProvider`, `<html lang={locale}>`, `setRequestLocale(locale)`, `generateStaticParams`
- [ ] Simplify `app/layout.tsx` — remove `<html>` tag (now in `[locale]/layout.tsx`), keep only font imports and `globals.css`
- [ ] Create `apps/web/messages/en.json` with all ~80-100 keys extracted from current hardcoded strings

#### Phase 2: Translate components (Server Components first, then Client)

**Server Components (zero client JS):**
- [ ] `features-grid.tsx` — import `getTranslations('Features')`, replace hardcoded strings
- [ ] `cta-section.tsx` — import `getTranslations('Cta')`, replace hardcoded strings
- [ ] `footer.tsx` — import `getTranslations('Footer')`, replace hardcoded links/text; use `Link` from `@/i18n/navigation` for internal links
- [ ] `privacy/page.tsx` — import `getTranslations('Privacy')`, replace content + `generateMetadata` with localized title/description
- [ ] `terms/page.tsx` — import `getTranslations('Terms')`, replace content + localized metadata
- [ ] `page.tsx` (homepage) — localized JSON-LD schema (organization name, FAQ answers), localized metadata

**Client Components (pass translated props from server parents, or use useTranslations):**
- [ ] `hero.tsx` — convert to Server Component if possible (Motion dependency may prevent this); if not, use `useTranslations('Hero')`
- [ ] `navbar.tsx` — use `useTranslations('Navbar')`; replace `<a href="/">` with `Link` from `@/i18n/navigation`; add language switcher
- [ ] `faq.tsx` — use `useTranslations('Faq')` for section title; FAQ items from translations
- [ ] `not-found.tsx` (under `[locale]`) — use `useTranslations('NotFound')`
- [ ] `error.tsx` — use `useTranslations('Error')`

#### Phase 3: Language switcher UI

- [ ] Create `apps/web/src/components/marketing/language-switcher.tsx` — Client Component
- [ ] Use `useLocale()` + `useRouter()` + `usePathname()` from `@/i18n/navigation`
- [ ] Show locale names in native script: English, Espanol, Deutsch
- [ ] Style: subtle dropdown or segmented control in navbar, matching dark theme
- [ ] Accessible: proper `aria-label`, keyboard navigable

#### Phase 4: SEO + localized metadata

- [ ] `generateMetadata` in `[locale]/(marketing)/layout.tsx` — localized title, description, OG locale, `alternates.languages` with hreflang for all 3 locales + x-default
- [ ] `sitemap.ts` — generate all pages x all locales with `alternates.languages`
- [ ] `robots.ts` — update sitemap URL reference
- [ ] JSON-LD on homepage — translate organization description, FAQ content per locale
- [ ] Verify `<html lang={locale}>` is set correctly per route

#### Phase 5: Translations (ES + DE)

- [ ] Create `apps/web/messages/es.json` — translate all ~80-100 keys to Spanish
- [ ] Create `apps/web/messages/de.json` — translate all ~80-100 keys to German
- [ ] Verify proper diacritics: Spanish (n, accented vowels), German (umlauts, ss)
- [ ] Verify Plus Jakarta Sans covers all required characters (latin subset should suffice)

#### Phase 6: Link audit + quality pass

- [ ] Audit ALL internal links across navbar, footer, CTA, 404, error pages — ensure they use `Link` from `@/i18n/navigation` (not `next/link` or `<a>`)
- [ ] Verify hash links (`#features`, `#faq`, `#cta`) work correctly under locale routing
- [ ] Test admin routes remain unaffected by locale routing
- [ ] Test unsupported locale (e.g., `/fr`) redirects to English
- [ ] Test locale cookie persistence — switch to DE, revisit root URL, should redirect to `/de`
- [ ] Run `pnpm lint` to verify Biome compliance
- [ ] Run `pnpm --filter web build` to verify production build

## System-Wide Impact

- **Proxy (proxy.ts):** Expands from `/admin/*` only to all routes. Composes locale detection with admin auth. Admin routes excluded from locale processing.
- **Route structure:** Marketing pages move under `app/[locale]/(marketing)/`. Admin and login stay at root. Root layout simplified.
- **Internal links:** All `<Link href="/privacy">` become locale-aware via `Link` from `@/i18n/navigation`.
- **Metadata:** All `generateMetadata` calls become locale-aware with hreflang alternates.
- **JSON-LD:** Translated per locale on homepage.
- **Build output:** 3x more static pages (each page pre-rendered for EN/ES/DE via `generateStaticParams`).

## Acceptance Criteria

### Functional
- [ ] Visiting `motowise.app` with `Accept-Language: de` shows German content
- [ ] Visiting `motowise.app/es/privacy` shows Spanish privacy policy
- [ ] Language switcher changes locale and preserves current page
- [ ] Visiting `motowise.app/fr` redirects to English
- [ ] Admin pages (`/admin/*`) work unchanged, not affected by locale routing
- [ ] Login page works unchanged
- [ ] All ~80-100 strings translated in ES and DE
- [ ] FAQ accordion works with translated content in all 3 locales

### SEO
- [ ] Each page has `<link rel="alternate" hreflang="en|es|de|x-default">` in head
- [ ] Sitemap includes all locale variants with alternates
- [ ] `<html lang={locale}>` is correct per route
- [ ] JSON-LD FAQ schema uses translated Q&A
- [ ] OG metadata uses localized title/description/locale

### Performance
- [ ] Server Component translations add 0 bytes to client bundle
- [ ] Client-side next-intl runtime is ~4KB (verify with bundle analyzer)
- [ ] Marketing pages remain statically renderable via `generateStaticParams`

### Quality
- [ ] `pnpm lint` passes
- [ ] `pnpm --filter web build` succeeds
- [ ] No hardcoded English strings remain in marketing components (except brand name "MotoWise")

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| proxy.ts composition complexity | Test admin auth + locale detection independently before composing |
| Route restructuring breaks imports | Use find-and-replace, verify build after restructuring |
| Hero component is Client Component (Motion dep) | Use `useTranslations` hook; consider CSS-only parallax migration (todo #065) to make it server-renderable |
| Legal text translation quality | Professional review recommended; machine translation acceptable for MVP |
| `faq-data.ts` static array conflicts with translations | Delete `faq-data.ts`, move FAQ content to `messages/*.json` |

## Sources & References

- [next-intl App Router Setup](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl Routing](https://next-intl.dev/docs/routing/setup)
- [next-intl Server/Client Components](https://next-intl.dev/docs/environments/server-client-components)
- [Next.js 16 Proxy Migration](https://nextjs.org/docs/messages/middleware-to-proxy)
- Mobile i18n implementation: `apps/mobile/src/i18n/` (PR #2)
- Shared types: `packages/types/src/constants/enums.ts:58` (`SUPPORTED_LOCALES`)
- Existing todo: `todos/037-p2-auth-store-locale-not-persisted.md`
- Existing todo: `todos/040-p3-spanish-german-translations-missing-diacritics.md`
