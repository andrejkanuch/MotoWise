# Iteration 4 apply — owner decisions (2026-10-30)

Same process rules as APPLY-DECISIONS.md / -3.md. Reports: it4-polish.md (adapt + polish), it4-onboard.md,
it4-optimize.md, it4-bolder.md. Apply EVERY row whose file or key is in your owned list; where a row conflicts
with a decision below, the decision wins. Root-only routes now live under `src/app/(root)/` (URLs unchanged).

## Owner-file agent (the only agent allowed to edit these files this round)
design-system.css, mv-tokens.css, hero.tsx, bike-plate.tsx, globals.css, root-shell.tsx, root-metadata.ts,
app/[locale]/layout.tsx, app/(root)/layout.tsx, app/[locale]/(marketing)/layout.tsx, theme-provider/toggle.

## Polish / adapt decisions
- `viewport-fit=cover` on the viewport (root-metadata.ts) so every env(safe-area-inset-*) works.
- One content edge: `.mv-section-hero` gets max-width + margin auto; `.hero-section { padding: 120px 0 }` with
  `.hero-content` carrying the 40/24/20 gutters; the navbar inner container already exists — align its gutters.
- `--mv-nav-h` is published ONCE as the truth (72 resting, 64 scrolled via :has) and explore/tabnav read it.
- `.mv-btn` gets `min-height: 44px; line-height: 1.2` so every button is 44 (block 52; compact 40); auth fields
  stay `.is-tall` 52 with `.mv-btn-block` 52.
- Duration tokens `--mv-dur-1: 160ms; --mv-dur-2: 200ms; --mv-dur-3: 240ms; --mv-dur-4: 420ms` in mv-tokens.css;
  the kit and every component map their transitions onto them (120/150/180/250/300/350/400 → nearest step).
- Print: kit `@media print` hides navbar, nav sheet, sticky app bar, cookie bar, nav progress, footer wordmark +
  toggle, hero/CTA scrims; the page ground is the print ramp (mv-tokens already flips tokens).
- `forced-colors: active`: hairlines → `CanvasText` borders, focus → `Highlight`, copper buttons keep a border.
- The livery stripe must not paint over the light-scheme plate keyline: clip it under the inset (the plate's
  `overflow: hidden` + the keyline is a box-shadow inset → draw the keyline as a `::after` ring above the stripe).
- `ch` measures: prose at `60ch`, ledes `52ch` (the system face runs ~90 chars at 70ch).
- Rename `--mv-radius-screen` 28 → `--mv-radius-crop`; add `--mv-radius-screen: 36px` for framed screens (and
  30/26 at the phone-frame breakpoints via the frame's own rule). Update call sites in your files.
- `content-visibility: auto` scoped to `.mv-marketing > main > section:not(:first-child)` with per-section
  `contain-intrinsic-size` estimates; never on the hero.
- Hero on 360×667: `padding-top: 88px`, plate/CTA margins 24 so the store buttons sit above the fold.
- Explore hero image: serve the right `sizes`, re-export is NOT possible this round (no source) — use the file's
  real 1376px width (`sizes` capped so it is not upscaled) and keep the bleed from B3 only where the width allows.
- Trip map on phones: height from aspect-ratio only (drop the inline 500px), markers fit bounds after resize.
- Sticky app bar on 360: one line, 44px dismiss, text clamps; it also waits for the consent decision (onboard ★5).
- Glyph sizes: Lucide 16 inline in text/rows/chips, 18 in icon buttons, 20 in list leads; store-button marks 16.

## Onboard decisions (apply all ★ rows)
- Hero + empty-garage store pair: detect the platform after mount (the `contextual-app-cta.tsx` pattern): the
  detected store is the copper button, the other the ghost; both labelled "Download for iOS/Android".
- Sticky app bar waits for the consent decision. `/login?error=link_expired` banner + the callback redirect.
- Checkout success: the "open the app, same account; Settings › Restore purchases" line + ghost "Get the app".
- `ride/[id]/not-found.tsx` and `rider/[username]/not-found.tsx` (clone of t/[token]/not-found).
- /share "Get the app" → `/get`. Zero-route region copy. `supabase/templates/confirmation.html` else-branch:
  EDIT the template file only (applying it in Supabase is the owner's runbook step; say so in your report).

## Optimize decisions (apply all ★ rows)
1. Every `NextIntlClientProvider` passes only the namespaces its client subtree uses (grep `'use client'` files
   under that tree for `useTranslations('X')`/`useFormatter`; include the namespaces of client components
   imported by server components in the tree). Add a vitest contract test that fails when a client component
   uses a namespace the provider does not pass (walk the tree with ts-morph as post-auth-contract does).
2. Hero image preloads move from the marketing layout into hero.tsx (only the home page preloads them); the
   hero `<img>` becomes a `<picture>` with AVIF + WebP sources at 1600/2000 widths generated with `sips`/`cwebp`
   /`ffmpeg` (whatever is installed — the owner's tools: cwebp, sips, magick, ffmpeg) into
   public/images/marketing/, `fetchPriority="high"` only on the home page.
3. Supabase client behind `next/dynamic`/lazy import in navbar.tsx and analytics-identity.tsx (session check
   after idle), Sentry Replay via lazyLoadIntegration, PostHog `no-external` build / loaded after consent.
4. Plus Jakarta Sans moves to the layouts that use it (piel/builder/admin) — if none in scope uses it, drop it
   from root-shell and let Tailwind's `font-sans` fall to the system stack; Geist Mono → `--mv-font-mono`
   system stack (ui-monospace, SF Mono, Menlo…) and the font is dropped.
5. Root `/explore` static (no `headers()` in the render path — move the country detection client-side or to a
   cookie read in a client component); `/trips/[country]` gets `force-static` + `revalidate`.
6. `listPublishedArticles` cache 604800; `/blog` index passes list props, not full articles.
7. `og-image.png` re-encoded under 300 KB; `hero-explore.jpg` OG variant 1200×630 under 300 KB.
8. Delete the 17 unused design-system.css classes the report lists (owner agent).

## Bolder decisions
B1 done (hero plate `size="hero"`). Apply B2 (feature pages: first screenshot cut by the hero edge when no
heroVisual; `priority` on that one image), B3 (explore photo bleeds — within the 1376px source), B4 (trip hero:
static Mapbox route map behind the title in `.mv-dark-scene`, only when waypoints exist), B5 (compare matrix:
the MotoVault column lifted one ramp step), and the OVERDRIVE (features-grid due plate: scroll-timeline settle +
stripe-lay, `@supports` gated, reduced-motion fallback, no `.mv-reveal` on that object).

## Verify before you report
tsc clean (apps/web), biome clean on your files, curl your routes (200 + H1), vitest for your area. Report ≤25
lines: rows applied per report, skipped + why, new keys, owner needs. Do not commit.
