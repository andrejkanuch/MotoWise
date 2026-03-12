---
title: "fix: Pre-Launch Brand Review — Landing Page Fixes"
type: fix
status: completed
date: 2026-03-11
deepened: 2026-03-11
---

# fix: Pre-Launch Brand Review — Landing Page Fixes

## Enhancement Summary

**Deepened on:** 2026-03-11
**Research agents used:** best-practices-researcher, security-sentinel, kieran-typescript-reviewer, code-simplicity-reviewer, learnings-researcher

### Key Improvements from Deepening
1. **Simplified from 4 phases to 2 passes** (content strings, then component changes) per simplicity review
2. **Removed YAGNI items**: dynamic copyright year, custom language switcher, env var social toggle, grey-out store badges
3. **Prefer deletion over conditional rendering** — remove dead social links column, remove store badge buttons, remove admin link
4. **Colocate badge translations** with existing feature keys (not a separate `badges` namespace)
5. **Migrate FAQ from `t.raw()` to indexed key pattern** (matches existing testimonials pattern, unblocks precompilation)
6. **Security confirmed**: Admin route already protected by middleware; JSON-LD XSS already mitigated; no blocking security issues

### Critical Conventions (from learnings)
- Always use `<Link>` from `@/i18n/navigation` for internal links
- Always escape JSON-LD: `.replace(/</g, '\\u003c')` on `JSON.stringify()`
- Never ship placeholder `#` links — delete the element instead
- Keep `cacheComponents: false` in next.config.ts (PPR incompatible with next-intl)
- Use `BASE_URL` constant from `@/lib/constants`, never hardcode URLs

---

## Overview

Address findings from the MotoWise pre-launch brand audit. The web landing page at `apps/web/` has broken assets, dead CTAs, unsubstantiated claims, technical jargon, and i18n gaps. Fixes are structured as two passes: content strings first, then component changes.

## Problem Statement

- **Broken hero image** — phone mockup shows alt text (no `public/` directory exists)
- **Dead CTAs** — "Download" buttons link to `#` with no live app store listings
- **Unsubstantiated social proof** — "12,000+ Active Riders" for a pre-launch product
- **Technical jargon in FAQ** — mentions "Supabase with row-level security" to end users
- **Admin link exposed** — visible in public footer
- **Feature badges not translated** — hardcoded English in all locales
- **Dead social links** — social profiles may not exist yet

## Proposed Solution

Two passes, one PR:

### Pass 1: Content — i18n String Changes (all 3 locales)

All changes below apply to `apps/web/messages/{en,es,de}.json`.

#### 1. Soften social proof numbers

| Key | Before (en) | After (en) |
|-----|-------------|------------|
| `SocialProof.riders` | "Active Riders" | "Early Access Riders" |
| `SocialProof.diagnostics` | "AI Diagnostics Run" | "AI Diagnostics" |
| `SocialProof.bikes` | "Bikes Tracked" | "Bikes Supported" |
| `Cta.socialProof` | "Trusted by 12,000+ riders worldwide" | "Trusted by riders in early access" |

**es translations:**
| Key | After (es) |
|-----|------------|
| `SocialProof.riders` | "Usuarios en Acceso Anticipado" |
| `SocialProof.diagnostics` | "Diagnósticos de IA" |
| `SocialProof.bikes` | "Motos Compatibles" |
| `Cta.socialProof` | "Confiado por motociclistas en acceso anticipado" |

**de translations:**
| Key | After (de) |
|-----|------------|
| `SocialProof.riders` | "Early-Access-Fahrer" |
| `SocialProof.diagnostics` | "KI-Diagnosen" |
| `SocialProof.bikes` | "Unterstützte Bikes" |
| `Cta.socialProof` | "Vertraut von Fahrern im Early Access" |

#### 2. Replace all "Download" CTAs with "Get Early Access"

| Key | Before (en) | After (en) |
|-----|-------------|------------|
| `Navbar.download` | "Download App" | "Get Early Access" |
| `Hero.downloadCta` | "Download Free" | "Get Early Access" |
| `Hero.subtitle` | "AI-powered motorcycle diagnostics & learning — all in one app." | "AI-powered motorcycle diagnostics & learning — launching soon." |
| `Footer.download` | "Download" | "Early Access" |
| `Cta.headline` | "Ready to Master Your Motorcycle?" | "Be First to Master Your Motorcycle" |
| `Cta.subtitle` | "Join thousands of riders already learning with AI." | "Get early access when we launch on iOS and Android." |
| `Cta.appStorePrefix` | "Download on the" | "Coming soon to" |
| `Cta.playStorePrefix` | "Get it on" | "Coming soon on" |
| `Cta.disclaimer` | "Free to download. No credit card required." | "Launching soon on iOS and Android." |
| `Cta.trustFree` | "Free to start" | "Free at launch" |

**es/de**: Apply equivalent translations for each key.

#### 3. Remove Supabase from FAQ AND Privacy Policy

**FAQ item 5 (`Faq.items[4].answer`):**

| Locale | After |
|--------|-------|
| en | "Your data is protected with enterprise-grade encryption and strict access controls. Authentication tokens are stored using platform-native secure storage, and all communication is encrypted in transit. We never share your personal information or bike data with third parties." |
| es | "Tus datos están protegidos con cifrado de nivel empresarial y controles de acceso estrictos. Los tokens de autenticación se almacenan de forma segura utilizando almacenamiento seguro nativo de la plataforma, y toda la comunicación está cifrada en tránsito. Nunca compartimos tu información personal o datos de tu moto con terceros." |
| de | "Deine Daten sind durch Verschlüsselung auf Unternehmensniveau und strenge Zugriffskontrollen geschützt. Authentifizierungstoken werden sicher über plattformeigenen sicheren Speicher gespeichert, und alle Daten werden über HTTPS übertragen. Wir geben deine persönlichen Informationen oder Bike-Daten niemals an Dritte weiter." |

**Privacy Policy (`Privacy.security`):**

| Locale | After |
|--------|-------|
| en | "MotoWise uses enterprise-grade encryption with strict access control policies to protect your data. Authentication tokens are stored securely using platform-native secure storage. All data is transmitted over HTTPS." |
| es | "MotoWise utiliza cifrado de nivel empresarial con políticas estrictas de control de acceso para proteger tus datos. Los tokens de autenticación se almacenan de forma segura utilizando almacenamiento seguro nativo de la plataforma. Todos los datos se transmiten a través de HTTPS." |
| de | "MotoWise verwendet Verschlüsselung auf Unternehmensniveau mit strengen Zugriffskontrollrichtlinien, um deine Daten zu schützen. Authentifizierungstoken werden sicher über plattformeigenen sicheren Speicher gespeichert. Alle Daten werden über HTTPS übertragen." |

#### 4. Change "Built with AI" → "Powered by AI"

| Locale | Key | After |
|--------|-----|-------|
| en | `Footer.builtWithAi` | "Powered by AI" |
| es | `Footer.builtWithAi` | "Impulsado por IA" |
| de | `Footer.builtWithAi` | "Angetrieben von KI" |

#### 5. Add "Early Access" badge to Testimonials

Add new key `Testimonials.badge`:

| Locale | Value |
|--------|-------|
| en | "Early Access" |
| es | "Acceso Anticipado" |
| de | "Early Access" |

#### 6. Add feature badge translations (colocated with feature)

Add `badge` key to each feature in existing `Features` namespace:

```json
"Features": {
  "diag": { "title": "...", "tagline": "...", "description": "...", "badge": "< 5 sec" },
  "learn": { "title": "...", "tagline": "...", "description": "...", "badge": "50+ lessons" },
  "garage": { "title": "...", "tagline": "...", "description": "...", "badge": "Unlimited bikes" },
  "progress": { "title": "...", "tagline": "...", "description": "...", "badge": "Track progress" },
  "community": { "title": "...", "tagline": "...", "description": "...", "badge": "Coming soon" }
}
```

**es translations for badges:** `"< 5 seg"`, `"50+ lecciones"`, `"Motos ilimitadas"`, `"Sigue tu progreso"`, `"Próximamente"`

**de translations for badges:** `"< 5 Sek."`, `"50+ Lektionen"`, `"Unbegrenzte Bikes"`, `"Fortschritt verfolgen"`, `"Demnächst"`

#### 7. Remove dead i18n keys

Delete from all 3 locale files:
- `Footer.admin` (admin link being removed)

#### 8. Fix hero alt text (in AppPreview component, not i18n)

Change alt from `"MotoWise app home screen showing fleet health"` to `"MotoWise app showing your bike's diagnostics and maintenance"`

**File:** `apps/web/src/components/marketing/app-preview.tsx`

### Pass 2: Component Changes

#### A. Remove admin link from footer

**File:** `apps/web/src/components/marketing/footer.tsx`

- Delete the admin `<NextLink>` element (lines ~77-82)
- Remove `import NextLink from 'next/link'` if it becomes unused
- Verify `justify-between` layout still works with remaining elements

#### B. Remove social links column from footer

**File:** `apps/web/src/components/marketing/footer.tsx`

- Delete the `connectLinks` array and its `<FooterColumn>` rendering
- Remove unused social link URLs
- The footer grid goes from 3 columns to 2 — adjust grid styling if needed

> **Research insight:** Prefer deletion over conditional rendering. An env var toggle is YAGNI for a one-time event. When social profiles are created later, add the column back.

#### C. Remove store badge buttons from CTA section

**File:** `apps/web/src/components/marketing/cta-section.tsx`

- Delete the two `<ExternalLink href="#">` blocks with Apple/Play Store SVG icons
- Delete the `AppleIcon` and `PlayIcon` inline SVG components (now unused)
- Keep the CTA heading/subtitle (now says "Get Early Access" / "Launching soon on iOS and Android")
- Keep trust badges row

> **Research insight:** Don't grey out dead buttons — remove them entirely. A styled "Coming Soon" store badge still invites clicks and frustrates users. The text "Launching soon on iOS and Android" communicates the same information without false affordance.
>
> **Security insight:** Use `<button type="button">` instead of `<a href="#">` if any non-navigating elements remain. This is semantically correct and avoids href-related concerns.

#### D. Hide phone mockup on mobile

**File:** `apps/web/src/components/marketing/hero.tsx` (line ~86-87)

- Change the mockup container from `opacity-30` + `absolute` positioning to `hidden md:block`
- This removes the decorative overlap on mobile and avoids loading the (currently broken) image on small screens

#### E. Extract feature badges from hardcoded to i18n

**File:** `apps/web/src/components/marketing/features-grid.tsx`

- Delete the hardcoded `BADGES` constant
- Access badge via existing pattern: `t(`${feature.key}.badge`)`
- This matches the existing pattern on lines 178-185 where `t(`${feature.key}.title`)` is already used

```tsx
// Before:
const BADGES: Record<FeatureKey, string> = { diag: '< 5 sec', ... };
// ...
<span>{BADGES[feature.key]}</span>

// After:
<span>{t(`${feature.key}.badge`)}</span>
```

#### F. Render "Early Access" badge on testimonials

**File:** `apps/web/src/components/marketing/testimonials.tsx`

- Add small badge next to reviewer name: `<span className="text-xs bg-warm-500/10 text-warm-400 px-2 py-0.5 rounded-full">{t('badge')}</span>`

#### G. Migrate FAQ from `t.raw()` to indexed key pattern

**File:** `apps/web/src/components/marketing/faq.tsx`

> **Research insight:** `t.raw()` is on the path to deprecation and incompatible with next-intl's ahead-of-time precompilation (saves ~9KB). Your Testimonials component already uses the correct pattern with indexed keys.

```tsx
// Before:
const items = t.raw('items') as Array<{ question: string; answer: string }>;

// After:
const FAQ_KEYS = [0, 1, 2, 3, 4, 5] as const;
// ...
{FAQ_KEYS.map((index) => (
  <div key={index}>
    <span>{t(`items.${index}.question`)}</span>
    <div>{t(`items.${index}.answer`)}</div>
  </div>
))}
```

#### H. Create placeholder hero image

- Create `apps/web/public/images/` directory
- Add a placeholder `app-preview-home.png` — a branded gradient card (dark bg, MotoWise logo, "Coming Soon" text)
- Verify `og-image.png` and `icon.png` also exist or are needed

> **Deferred:** Real app screenshot to be provided by user later.

### Items Intentionally Deferred

| Item | Why | When to Address |
|------|-----|-----------------|
| Dynamic copyright year | It's 2026 now; hardcoded "2026" is correct for 9+ months | January 2027 |
| Custom language switcher | Native `<select>` is accessible, works cross-browser, and is functional | When there's a design spec |
| Full waitlist email capture | Requires backend, GDPR compliance, Supabase table | Separate feature plan |
| Real hero screenshot | Need actual mobile app screenshot | User provides asset |
| Social media profiles | Need to create actual accounts | User creates accounts, then re-adds footer column |
| Logo/logomark | Need design/brand asset | User provides or commissions |
| Testimonial authenticity | Binary decision: keep if real, remove if fabricated | User confirms |

## System-Wide Impact

- **i18n consistency**: All string changes applied to en, es, AND de simultaneously
- **SEO**: Alt text and JSON-LD changes affect search indexing
- **Accessibility**: Hero mockup `aria-hidden` already set; alt text fix is for SEO crawlers only
- **Bundle size**: Migrating FAQ from `t.raw()` to indexed keys enables precompilation (~9KB savings)
- **No backend changes**: All fixes are frontend content/copy/config

## Acceptance Criteria

### Content (Pass 1)
- [x] Social proof labels say "Early Access" in all 3 locales
- [x] All "Download" CTAs replaced with "Get Early Access" in all 3 locales
- [x] FAQ and Privacy Policy do not mention "Supabase" in any locale
- [x] Footer says "Powered by AI" instead of "Built with AI" in all 3 locales
- [x] Testimonial "Early Access" badge key exists in all 3 locales
- [x] Feature badges have i18n keys colocated with features in all 3 locales
- [x] `Footer.admin` key removed from all 3 locales

### Components (Pass 2)
- [x] Admin link removed from footer
- [x] Social links column removed from footer
- [x] Store badge buttons removed from CTA section
- [x] Phone mockup hidden on mobile (< md breakpoint)
- [x] Feature badges read from i18n, hardcoded `BADGES` deleted
- [x] Testimonial cards render "Early Access" badge
- [x] FAQ uses indexed key pattern, not `t.raw()`
- [x] Hero alt text uses consumer language
- [x] `apps/web/public/images/app-preview-home.png` exists (placeholder)

### Quality Gates
- [x] `pnpm --filter web build` passes with no errors
- [x] `pnpm --filter web dev` shows no MISSING_MESSAGE warnings
- [x] All 3 locales (en, es, de) render without errors
- [x] Mobile viewport (390px) shows no hero overlap
- [x] No console errors or warnings on any page

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missing hero image asset | High | User sees placeholder | Branded placeholder; user provides real screenshot later |
| Translation quality for es/de | Medium | Poor UX for non-English | AI-assisted translations; flag for native speaker review |
| FAQ `t.raw()` migration | Low | Rendering regression | Test all 3 locales; key indices match existing array |
| Footer layout after column removal | Low | Visual imbalance | Adjust grid from 3→2 columns |

## Sources & References

### Internal References
- Landing page: `apps/web/src/app/[locale]/(marketing)/page.tsx`
- Marketing components: `apps/web/src/components/marketing/*.tsx`
- Locale messages: `apps/web/messages/{en,es,de}.json`
- Previous landing page fixes: `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`
- PPR/next-intl incompatibility: `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`

### External References
- next-intl precompilation: https://next-intl.dev/blog/precompilation
- ICU MessageFormat spec: https://unicode-org.github.io/icu/userguide/format_parse/messages/

### Security Review
- Admin route protected by middleware in `apps/web/src/proxy.ts` (JWT + DB role check)
- JSON-LD XSS mitigated with `.replace(/</g, '\\u003c')` in `page.tsx`
- `NEXT_PUBLIC_*` env vars safe for non-sensitive config
- CSP headers comprehensive; plan nonce strategy before adding third-party scripts
