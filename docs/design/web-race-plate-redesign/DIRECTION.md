# Trackside — direction contract for the web marketing redesign

The marketing site adopts the mobile app's Race Plate system (apps/mobile/DESIGN.md) at web scale: ride photography carries emotion, the Race Plate voice carries everything else. The shared object is the Bike Plate (`src/components/marketing/bike-plate.tsx`, CSS `.mv-plate*`).

## Tokens (defined in packages/design-system/src/mv-tokens.css, imported once by src/app/globals.css — do NOT redeclare a token anywhere else)
Dark (default) / light via `html:not(.dark)` — always use the var, never a literal:
- Ground ramp: `--mv-bg`, `--mv-bg-2` (deeper alternating step), `--mv-surface` (card), `--mv-surface-2` (raised), `--mv-surface-3` (option), `--mv-line-step`
- Ink: `--mv-ink`, `--mv-ink-2`, `--mv-ink-3`, `--mv-ink-4`; hairlines `--mv-line`, `--mv-line-2`
- Copper (the ONLY action colour): `--mv-copper`, `--mv-copper-hover`, `--mv-copper-text` (links/text actions), `--mv-on-copper` (ink on copper)
- Status (only inside app depictions): `--mv-plate-bone/signal/red`, `--mv-plate-ink`, `--mv-due-ink`, `--mv-overdue-ink`; general success `--mv-go`, info `--mv-info`
- Radii: `--mv-radius-control` 12 (buttons/controls), `--mv-radius-card` 16, `--mv-radius-plate` 20
- Type: `--mv-font-display` (Barlow Condensed — headlines + numbers, weights 500/600/700, use `.mv-display`/`.mv-figure` or the var), `--mv-font-body` (system stack — every sentence)
- DEPRECATED, do not use in new code: `--mv-warm-*`, `--mv-page`, `--mv-card`, `--mv-copper-400/500/600`, `--mv-font-sans/serif`, `.mv-serif` (aliases; replace with the canonical token when touching a line)

## Type scale (every size snaps to a step; 14px is not a step)
Display clamp(56,9.6vw,150) hero only · H1 `.mv-section-title` clamp(44,5.5vw,84) (Read pages clamp(38,5.4vw,62), Operate pages 44) · H2 `.mv-h2` clamp(34,4.2vw,56) (Read/Operate 34/1.05 600) · H3 `.mv-h3` 26 · Operate section head 20/1.25 body 600 · lede 18/1.55 · body 17/1.6 (compact 16) · small 15 · meta 13/18 · caption 12 · figures `.mv-figure` 64 / 40 / 28 / 20 tabular 600, units 0.5× display 500 ink-2. Exceptions: the manifesto statement and the home closing CTA may use the H1 size; the outlined footer wordmark (aria-hidden) is decoration, not type.

## Spacing
Scale 4/8/16/24/32/48/64/96/120/160; 40 only as the desktop gutter. Gutters 40 → 24 (≤900) → 20 (≤480). Every page container is `var(--mv-container)` (1240) unless it is a reading column (≤70ch). Two intervals per page: weight sections 96–128 above, prose sections 64–96. Crumbs → H1 40, H1 → lede 28, lede → meta 20. Hairline rows share one padding (`.mv-row`: 12px 0, min-height 44).

## Shared classes (src/components/marketing/design-system.css)
- Buttons: `.mv-btn .mv-btn-primary` (the copper verb), `.mv-btn .mv-btn-ghost`, `.mv-icon-btn` (44px ghost icon control, e.g. the ThemeToggle), `.mv-link` (copper text link)
- Type: `.mv-display`, `.mv-figure` (tabular numerals), `.mv-section-title` (H1-scale), `.mv-h2` (section headline)
- Tables: `.mv-table` — hairline spec table on the page surface
- Scenes: `.mv-dark-scene` keeps a band on a dark photograph in the graphite scene under the light scheme (hero, closing CTA); read the band's edge colours from a wrapper OUTSIDE the scene so it blends into the page ground
- Motion: `.mv-reveal` / `.mv-reveal-stagger` are scroll-timeline driven, visible by default, no JS; at most one or two per page
- The Bike Plate: `<BikePlate>` from `src/components/marketing/bike-plate.tsx`, states ready | due | overdue
- Theme: `<ThemeToggle labels>` from `src/components/theme-toggle.tsx`; the ThemeProvider toggles `html.dark`, the pre-paint script in the root layout resolves storage → OS preference
- Cross-component contract: the cookie banner publishes its height as `--mv-cookie-banner-h` on `<html>`; any fixed bottom bar (sticky app bar) offsets by it

## Named rules (binding)
1. **Copper is a verb** — primary action, link, or selection only. Never status, never decoration, never gradient text, never glows (box-shadow with copper is banned).
2. **Triad belongs to state** — bone/signal/red appear only where a Bike Plate or app UI is depicted.
3. **Both schemes** — anything you style must work in dark AND light (`html:not(.dark)`); check contrast on both.
4. **Condensed means number and headline** — `--mv-font-display` for H1/H2/figures (tabular-nums for figures); sentences/body/subheads in `--mv-font-body`. Never letter-spaced uppercase, never serif, never italic display, never Geist Mono for labels/eyebrows.
5. **Plain voice** — sentence case everywhere, incl. headings and buttons. No eyebrows/kickers/section numbers (one exception: `.mv-plate-chip` section marker, max one per section).
6. **The ramp is the shadow** — surfaces lift by stepping up the ramp (bg → surface → surface-2 → surface-3). No drop shadows on cards/rows; no backdrop-filter blur (budget: navbar only). Scene-lighting shadows allowed only under depicted objects (phone mockups use `.mv-phone-mockup`, already styled).
7. **One diagonal** — the plate's livery stripe is the only diagonal; max one stripe per viewport.

## Anti-slop guardrails (binding)
- No Tailwind palette colours in (marketing): `neutral-*`, `emerald-*`, `zinc-*`, `gray-*`, `primary-*` classes and raw hex/oklch are all banned — tokens only.
- Card budget ≤1 card-styled element per section. Content sits on the page; use spacing (48–96px) and alignment shifts, not borders. The gradient hairline divider and the `w-32` accent bar are banned.
- Left-align body content and section headers; center at most the final CTA.
- No identical icon-tile grids; no `size-10 rounded-xl` icon boxes. Icons inline next to text or none.
- Adjacent sections must differ in scale/treatment; vary vertical rhythm deliberately.
- Max one full device frame (`.mv-phone-mockup`) per page; other screenshots cropped or bled.
- One stat row max per page, honest numbers only.
- Motion: entrance reveals only (`.mv-reveal`/`.mv-reveal-stagger` exist), ≤700ms, transform/opacity only, honour prefers-reduced-motion. No infinite loops, parallax theatre, magnetic buttons, or scroll-scrubbed scenes.

## Voice (copy)
Positioning: the rider's logbook — records, service history, real costs. Specific and honest; never "beautifully simple", never claims a rider would call out (nobody reads a phone at 70 mph). Sentence case. Buttons are actions ("Download for iOS").

## Process rules for build agents
- Do NOT edit: design-system.css, bike-plate.tsx, hero.tsx, messages/*.json, packages/design-system/*. If you need a new i18n key or a copy change, keep the `t('…')` call pattern and REPORT the key + proposed English value in your final report instead of editing messages.
- Do not add fonts, npm packages, or new global CSS files. Component-scoped styles go inline (style props) or in existing per-component patterns.
- Keep all analytics (`storeAnchorProps`, CTA taxonomy), links, structured data (JSON-LD), and i18n calls intact.
- Server components stay server; add 'use client' only if you add interactivity that needs it.
