# it3 — /animate lens (research only, 2026-10-30)

Scope: `lens/SCOPE.md`. Rules applied: `DIRECTION.md` Motion line, craft-floor Motion line, and the engineering rule
*load-time entrances animate transform only; scroll-driven reveals may fade*. Paths are `apps/web/src/` unless noted.

## Motion thesis

One material carries the site: things **settle into place** (scale / translate, `var(--mv-ease-expo)`), never fade in on the
clock. The one recognisable motion is the **Bike Plate settle with its livery stripe laid through the corner** (spec in §4).
Everything else is feedback ≤240ms or a state change ≤300ms. Loops exist only inside loaders.

## 1. Inventory (what exists)

- Load entrances: `.hero-content` rise 0.8s + `.hero-photo` settle 1.6s (design-system.css:1144-1159); `.mv-plate` settle 240ms on
  every plate (:721-727, 7 mount sites); `.xp-rise` 0.6s ×3 staggered 80ms (explore.css:155-170; hero-bold.tsx:26-33, explore/search/page.tsx:126).
- Scroll reveals: `.mv-reveal` (design-system.css:234-249) on 26 files; `.mv-reveal-stagger` defined, used nowhere.
- Loops (all loaders, allowed): `mv-loader` ×4 (design-system.css:942-1005), spinners mvp/mva/xp/prof/`animate-spin` (gpx-download-button.tsx:202,247,280),
  shimmers (trackside-read.css:783, garage-ui.css:90), `mv-navprogress-slide` (globals.css:38).
- State transitions (all ≤300ms, colour or ≤3px nudges): buttons, chips, rows, crumbs, fields, nav menu (navbar.tsx:157), cookie switch, choice/check boxes,
  five disclosure chevrons, map pins (mapbox-map.tsx:144, trip-detail-map.tsx:47), gpx toast/dialog (gpx-download-button.css:8-19,56,73,83).
- No GSAP, framer-motion or motion-library remnants. No `transition: all`. No parallax / magnetic / scroll-scrub.
- Reduced motion: blanket `0.01ms !important` on `.mv-marketing *` (design-system.css:1009-1015) plus per-file guards of three different policies.

## 2. Violations

| # | File | Line | Issue | Fix |
|---|---|---|---|---|
| V1 | components/marketing/design-system.css | 1149 | `.hero-content` rise 0.8s > 700ms; it also wraps the plate settle, so one block runs two clock entrances at once | Delete the `.hero-content` animation; the hero's sequence is photo settle → plate stripe (§4) |
| V2 | design-system.css | 1158 | `.hero-photo` settle 1.6s > 700ms | `animation: hero-photo-settle 700ms var(--mv-ease-expo) both;` |
| V3 | design-system.css | 725 | `.mv-plate` settle fires on every mount: auth panel (decoration beside a form), app-promo, features-grid, garage list — four of seven sites are off-screen at load, so it plays unseen; features-grid.tsx:95 wraps it in `.mv-reveal` (two moves on one object) | Make the settle opt-in: `.mv-plate[data-settle]` (§4); default plate is still |
| V4 | design-system.css | 1009-1015 | Blanket reduced-motion `animation-duration: 0.01ms !important` on `.mv-marketing *` turns the infinite loaders (:942, :950, :961, :986), the skeleton shimmer (trackside-read.css:783) and `.mv-dots` `steps(4)` content into ~100k-iteration/s strobes; the `transition-duration` half also kills colour feedback (reduced ≠ none) | Replace with the targeted block in §5 |
| V5 | design-system.css | 252-288 | Orphan keyframes `mv-rise`, `mv-pulse`, `mv-chip-float` (loop), `mv-scan` (loop, animates `top`), `mv-result-in`, `mv-pulse-dot`, `spin` — zero users, two are old-site loop remnants | Delete all seven (owner) |
| V6 | design-system.css | 234-249 | `.mv-reveal` from `opacity: 0` is fine (scroll-driven), but `.mv-reveal-stagger` is dead | Delete `.mv-reveal-stagger` rule |
| V7 | 22 Read pages: `[locale]/(marketing)/{about,press,privacy,terms,support,account-deletion,blog,blog/[slug],guides,guides/[slug],bikes,bikes/…/[pageType],compare,compare/alternatives,compare/maintenance-vs-ride-apps,explore,explore/[country],explore/[country]/[region],tools/cost-calculator,tools/tclocs-checklist}/page.tsx`, `trips/[country]/page.tsx`, `trips/[country]/[region]/[slug]/page.tsx` | the `<header className="mv-reveal">` / first-block line in each | The reveal sits in the first viewport; `animation-range: entry 0% entry 30%` is already past at load, so the page's "one authored moment" never plays (and would fade the H1 if it did) | Remove `mv-reveal` from the header. Read/Operate pages get no load choreography; keep compare-page.tsx:440 (below the fold) |
| V8 | components/marketing/navbar.tsx | 56 | `transition: … padding .3s` animates a layout property on every scroll-hysteresis flip | `transition: background .3s var(--mv-ease), border-color .3s var(--mv-ease);` (padding snaps; the 8px step is invisible under the blur) |
| V9 | components/marketing/sticky-app-bar.tsx · components/garage-ui/garage-ui.css · components/trip-detail/trip-detail.css | 37 · 429 · 546 | `transition: bottom .25s` — layout property driven by `--mv-cookie-banner-h` | Pin `bottom: 0` and offset with `translate` (R-bars below) |
| V10 | components/marketing/trackside-read.css + tools/tclocs-checklist/tclocs-checklist.tsx | 1261 · 322 | `.mv-progress > div { transition: width 0.4s }` + inline `width: N%` | `transform: scaleX(var(--mv-p))` (R-trackside) |
| V11 | components/marketing/feature-content-page.tsx | 476 | Tailwind `transition-transform duration-300` (Tailwind ease, 300ms) is the fifth disclosure-chevron implementation (faq.tsx:79 0.3s/45°, compare-page.tsx:172, pro.css:404, trackside-read.css:331/410 at 0.25s) | One `.mv-disclosure` rule (R-ds-4); every `<details>` takes the class |
| V12 | components/marketing/design-system.css | 305, 318-322 | `:active` press goes through the 0.2s hover transition — the press reads late | `.mv-btn:active { transition-duration: 60ms; }` |
| V13 | design-system.css | 447-456 | `.mv-segmented` selection flips `font-weight` 500→600: the label reflows and neighbours jitter on every switch (pro plan toggle, followers tabs, explore filters) | Constant `font-weight: 500`; selection = surface-3 + ink only; 160ms expo |
| V14 | app/pro/pro.css · components/auth-ui/auth-ui.css · components/explore/explore.css · app/(community)/garage/garage.css | 617 · 496 · 801 · 295 | Three reduced-motion policies for the same spinner (slow to 2.4s / stop / stop + static arc) | One policy: stop, keep the accent arc static (R-pro, R-auth) |
| V15 | components/trip-detail/trip-detail-map.tsx · components/explore/mapbox-map.tsx | 47 · 144 | Pin selection uses `ease` 0.15s in one map and `--mv-ease` 0.2s in the other | Both `160ms var(--mv-ease-expo)` |
| V16 | components/gpx-download-button.css | 56, 73, 83 | Toast/scrim/dialog enter on `--mv-ease` (the only entrances not on the expo curve) | `var(--mv-ease-expo)`; durations stay |
| V17 | components/download-app-button.tsx | 38 | `transition-opacity hover:opacity-90` + raw `palette.signature500`; the component has no importers | Delete the file (deadcode) |
| V18 | Home `[locale]/(marketing)/page.tsx` | 89-98 | Three clock entrances in the first viewport (V1, V2, V3) + two scroll reveals (manifesto, features-grid plate) | After V1-V3 the home has one sequence + two reveals — within "one or two" |

## 3. Recommendations by file (exact CSS)

### components/marketing/design-system.css — OWNER ONLY, report for the owner

| # | What | CSS |
|---|---|---|
| R-ds-1 | Hero timings (V1, V2) | Delete `.hero-content { animation }` + `hero-content-rise`. `.hero-photo { animation: hero-photo-settle 700ms var(--mv-ease-expo) both; }` |
| R-ds-2 | Signature plate settle, opt-in (V3, §4) | `@keyframes mv-plate-stripe-lay { from { transform: rotate(45deg) translateX(120%); } to { transform: rotate(45deg) translateX(0); } }` `.mv-plate[data-settle] { animation: mv-plate-settle 240ms var(--mv-ease-expo) both; }` `.mv-plate[data-settle] .mv-plate-stripe { animation: mv-plate-stripe-lay 420ms var(--mv-ease-expo) 120ms both; }` `.mv-plate[data-settle='late'] { animation-delay: 240ms; } .mv-plate[data-settle='late'] .mv-plate-stripe { animation-delay: 360ms; }` Remove the unconditional `.mv-plate { animation }` at :725 |
| R-ds-3 | Plate state change (garage: ready → due once the schedule loads; success page) | `.mv-plate { transition: background-color 240ms var(--mv-ease-expo); }` |
| R-ds-4 | One disclosure (V11) — chevron + height; `interpolate-size`/`::details-content` is progressive (Chrome 131+, Safari 26); elsewhere the body snaps as today. Height is the one layout property earned here: the state *is* the height | `.mv-disclosure > summary svg, .mv-disclosure > summary .mv-disclosure-mark { transition: transform 240ms var(--mv-ease-expo), color 160ms; }` `.mv-disclosure[open] > summary svg { transform: rotate(180deg); }` `.mv-disclosure.is-plus[open] > summary .mv-disclosure-mark { transform: rotate(45deg); }` `.mv-disclosure::details-content { height: 0; overflow: clip; transition: height 240ms var(--mv-ease-expo), content-visibility 240ms allow-discrete; }` `.mv-disclosure[open]::details-content { height: auto; }` |
| R-ds-5 | Press feedback (V12) | `.mv-btn:active, .mv-icon-btn:active, .mv-chip:active { transition-duration: 60ms; }` `.mv-icon-btn:active, .mv-chip:active { scale: 0.97; }` |
| R-ds-6 | Segmented selection (V13) | In `.mv-segmented > *`: `transition: background-color 160ms var(--mv-ease-expo), color 160ms var(--mv-ease-expo);` and drop `font-weight: 600` from the selected rule |
| R-ds-7 | Enter utilities for things that mount after hydration (popovers, sheets, bars, toasts, errors). Transitions, not animations: the resting state is the default, so a stall shows the final frame. Uses the `translate` property so it composes with any existing `transform` | `.mv-enter-down, .mv-enter-up { transition: opacity 200ms var(--mv-ease-expo), translate 200ms var(--mv-ease-expo); }` `@starting-style { .mv-enter-down { opacity: 0; translate: 0 -6px; } .mv-enter-up { opacity: 0; translate: 0 8px; } }` |
| R-ds-8 | List that appears as a list (sheet links, unlocked rows): sibling stagger capped at 210ms; children set `--i` | `.mv-enter-list > * { transition: opacity 200ms var(--mv-ease-expo), translate 200ms var(--mv-ease-expo); transition-delay: min(calc(var(--i, 0) * 30ms), 210ms); }` `@starting-style { .mv-enter-list > * { opacity: 0; translate: 0 6px; } }` |
| R-ds-9 | Form error appearing (auth, checkout) | `.mv-field-error, .mv-alert[role='alert'] { transition: opacity 160ms var(--mv-ease-expo), translate 160ms var(--mv-ease-expo); }` `@starting-style { .mv-field-error, .mv-alert[role='alert'] { opacity: 0; translate: 0 -4px; } }` |
| R-ds-10 | Theme cross-fade (whole page; a root-only `background-color, color` transition fades the ground while every surface, hairline and plate snaps, which reads as a glitch — the view transition fades all of it) | `::view-transition-old(root), ::view-transition-new(root) { animation-duration: 200ms; animation-timing-function: var(--mv-ease-expo); mix-blend-mode: normal; }` |
| R-ds-11 | Dead CSS (V5, V6) | Delete `mv-rise`, `mv-pulse`, `mv-chip-float`, `mv-scan`, `mv-result-in`, `mv-pulse-dot`, `spin`, `.mv-reveal-stagger` |
| R-ds-12 | Reduced motion (V4) | Replace :1009-1015 and :1212-1218 with the block in §5 |

### app/globals.css

| # | What | CSS |
|---|---|---|
| R-glob-1 | Enable keyword interpolation for R-ds-4 (no effect where unsupported) | `:root { interpolate-size: allow-keywords; }` |

### providers/theme-provider.tsx · lib/theme-init-script.ts

| # | What | Change |
|---|---|---|
| R-theme-1 | Cross-fade only on the user's click. The pre-paint script (`theme-init-script.ts`) toggles the class before first style resolution, so no transition can fire at first paint; the mount effect re-applies the same class (no change); OS `change` stays instant. Script and CSP hash untouched | In `setTheme` replace `applyTheme(resolved)` with `applyThemeAnimated(resolved)`: `function applyThemeAnimated(r: ResolvedTheme) { const vt = document.startViewTransition?.bind(document); if (!vt \|\| window.matchMedia('(prefers-reduced-motion: reduce)').matches) { applyTheme(r); return; } vt(() => applyTheme(r)); }` |
| R-theme-2 | Toggle icon acknowledges the click (theme-toggle.tsx) | `[data-theme-toggle] svg { transition: transform 240ms var(--mv-ease-expo); } [data-theme-toggle]:active svg { transform: rotate(-30deg) scale(0.9); }` (goes in design-system.css next to `.mv-icon-btn`) |

### components/marketing/bike-plate.tsx — OWNER ONLY

| # | What | Change |
|---|---|---|
| R-plate-1 | Opt-in settle | Add `settle?: boolean \| 'late'` → `data-settle={settle === true ? '' : settle}` (omit when falsy). Default: no motion |

### Pages that take the settle (after R-plate-1)

| # | File | Change |
|---|---|---|
| R-hero-1 | components/marketing/hero.tsx:105 | `<BikePlate … settle="late" />` — the stripe lays down at 360ms, while the photo is still settling: one rehearsed sequence |
| R-pro-1 | app/pro/checkout/success/page.tsx:243 | `settle` on the activated plate (state-earned: polling → activated) |
| R-pro-2 | app/pro/checkout/success/page.tsx:252 + app/pro/pro.css `.mvp-unlocked` | `<ul className="mv-rows mvp-unlocked mv-enter-list">`, each `<li style={{ '--i': i } as CSSProperties}>` |
| R-garage-1 | app/(community)/garage/garage-cards.tsx:329 | `settle` on the first bike only (`index === 0`) — the plate replaces a skeleton, which is a state change; later plates stay still so the moment is not repeated down the page |
| R-feat-1 | [locale]/(marketing)/features/garage-management/page.tsx:117 | `settle` (feature-page family: the hero plate is its moment; `FeatureScreenshotPair` keeps the scroll reveal) |
| — | auth-ui.tsx:98, explore/app-promo.tsx:39, features-grid.tsx:96 | No prop: still by design (§4 "where not") |

### components/marketing/navbar.tsx

| # | What | CSS |
|---|---|---|
| R-nav-1 | Dropdown: expo in, faster out (V8 too) | `.mv-nav-menu { transition: opacity 120ms var(--mv-ease), transform 120ms var(--mv-ease), visibility 0s linear 120ms; }` `.mv-nav-menu[data-open] { transition: opacity 200ms var(--mv-ease-expo), transform 200ms var(--mv-ease-expo), visibility 0s; }` |
| R-nav-2 | Mobile sheet pops in (`{mobileOpen && …}` :530) | `className="mv-nav-sheet mv-enter-down"`; the first group `mv-nav-sheet-group mv-enter-list` with `--i` per link (≤7 links → ≤210ms) |
| R-nav-3 | Remove `padding` from the bar transition (V8) | see V8 |
| R-nav-4 | Reduced-motion guard (:282) stays; add `.mv-nav-menu { transform: none; }` under it so the menu only fades |

### components/cookie-consent.tsx

| # | What | CSS |
|---|---|---|
| R-cc-1 | Bar enters after mount with no motion (:487) | `.mv-cc-bar { transition: opacity 240ms var(--mv-ease-expo), translate 240ms var(--mv-ease-expo); } @starting-style { .mv-cc-bar { opacity: 0; translate: 0 12px; } }` (transition, so a stall still shows the consent bar) |
| R-cc-2 | Settled toast (:690-700) | `className="mv-cc mv-cc-toast mv-enter-up"`; exit is the unmount (fine: exits faster than entrances) |
| R-cc-3 | Switch knob already right (0.2s); align the curve | `transition: transform 160ms var(--mv-ease-expo), background .2s;` |

### Fixed bottom bars (V9)

| # | File:line | CSS |
|---|---|---|
| R-bars-1 | components/marketing/sticky-app-bar.tsx:27-37 | `bottom: 0; translate: 0 calc(-1 * var(--mv-cookie-banner-h, 0px)); transition: translate 250ms var(--mv-ease-expo), opacity 240ms var(--mv-ease-expo);` `@starting-style { .mv-appbar { opacity: 0; translate: 0 calc(8px - var(--mv-cookie-banner-h, 0px)); } }` |
| R-bars-2 | components/garage-ui/garage-ui.css:418-447 | same pattern; delete `mvg-bar-in` (the starting-style enter replaces it) |
| R-bars-3 | components/trip-detail/trip-detail.css:538-546 | `bottom: 0; translate: 0 calc(-1 * var(--mv-cookie-banner-h, 0px)); transition: translate 250ms var(--mv-ease-expo);` |

### components/explore/explore.css · mapbox-map.tsx · trip-detail-map.tsx

| # | What | CSS |
|---|---|---|
| R-xp-1 | Typeahead dropdown pops (explore-search-bar.tsx:360) | `<div … className="xp-dropdown mv-enter-down">`; in explore.css `.xp-option { transition: background-color 120ms var(--mv-ease-expo); }` |
| R-xp-2 | Pin selection (V15) — mapbox-map.tsx:144 | `transition: transform 160ms var(--mv-ease-expo), background-color 160ms, color 160ms, border-color 160ms;` |
| R-xp-3 | trip-detail-map.tsx:47 | `transition: transform 160ms var(--mv-ease-expo), background-color 160ms, color 160ms;` |
| R-xp-4 | `.xp-tile` hover (:255) | `transition: background-color 160ms var(--mv-ease-expo);` |

### components/marketing/trackside-read.css · tools/tclocs-checklist/tclocs-checklist.tsx

| # | What | CSS |
|---|---|---|
| R-tr-1 | Progress (V10) | `.mv-progress > div { width: 100%; transform-origin: left; transform: scaleX(var(--mv-p, 0)); transition: transform 400ms var(--mv-ease-expo), background-color 300ms; }`; tclocs-checklist.tsx:322 `style={{ '--mv-p': overallPercent / 100 } as CSSProperties}` |
| R-tr-2 | TOC + FAQ chevrons (:329-334, :406-414) | Delete both local rules; `<details className="mv-read-toc mv-disclosure">`, `.mv-read-faq details` → add `mv-disclosure is-plus` with the svg as `.mv-disclosure-mark` |
| R-tr-3 | Check box / choice (:1027-1036, :1343-1348) | Keep; change `var(--mv-ease)` → `var(--mv-ease-expo)` (same 180-200ms) |
| R-tr-4 | Skeleton guard (:1436) | Delete; covered by §5 |

### Disclosure call sites (R-ds-4)

| # | File:line | Change |
|---|---|---|
| R-faq-1 | components/marketing/faq.tsx:35, 79-84 | `<details className="faq-item mv-disclosure is-plus">`, `.faq-mark` → add `mv-disclosure-mark`; delete the inline `.faq-mark { transition }` and `[open]` rule |
| R-cmp-1 | components/marketing/compare-page.tsx:172-178 | Delete the two svg rules + the reduced-motion line; `<details className="mv-disclosure">` |
| R-fcp-1 | components/marketing/feature-content-page.tsx:447-476 | `<details className="group mv-disclosure">`; drop `transition-transform duration-300 group-open:rotate-180` from the svg |
| R-pro-3 | app/pro/pro.css:401-407 + the `.mvp-faq` `<details>` | Delete the svg rules; `<details className="mv-disclosure">` |

### Reduced-motion per file (V14)

| # | File:line | CSS |
|---|---|---|
| R-pro-4 | app/pro/pro.css:617-620 | `.mvp-spinner { animation: none; }` (the arc stays as the static mark) |
| R-auth-1 | components/auth-ui/auth-ui.css:496-499 | `.mva-spinner { animation: none; }` |
| R-gpx-1 | components/gpx-download-button.tsx:202,247,280 + .css | `animate-spin` has no guard: `.gpx-spin { animation: xp-spin 0.7s linear infinite; } @media (prefers-reduced-motion: reduce) { .gpx-spin { animation: none; } }` (own keyframe `gpx-spin`, class replaces `animate-spin`) |
| R-gpx-2 | components/gpx-download-button.css:56,73,83 | `var(--mv-ease)` → `var(--mv-ease-expo)` (V16) |

### Community nav

| # | File:line | Change |
|---|---|---|
| R-cn-1 | components/community-nav.tsx:163 | `<div … className="nav-mobile-menu mv-enter-down">` |
| R-sp-1 | components/share-page.css:225 | `.sp-tabs a { transition: color 160ms var(--mv-ease-expo), border-color 160ms var(--mv-ease-expo); }` so the underline hands over instead of snapping |

## 4. The signature moment — the stripe is laid down

The plate scales 0.98 → 1 (240ms, exists) and, 120ms in, its livery stripe slides along its own 45° axis from off the
top-right corner into place (420ms). `translateX(120%)` in the rotated frame puts the band entirely past the plate's right edge,
where `.mv-plate { overflow: hidden }` clips it, so a stalled first frame is a plate without its stripe — decoration missing,
content intact (the rule: shift, never hide). Whole sequence ≤540ms; `data-settle="late"` shifts it 240ms so the home hero
reads photo-settles → stripe-lays, one rehearsed moment.

Where it appears (one per page family): home hero (late), feature-page hero plate, checkout success on `activated`, garage first
plate when data replaces the skeleton. Where it must NOT appear: the auth panel plate (Operate surface, aria-hidden decoration
beside a form), app-promo and features-grid plates (off-screen at load; features-grid already has the scroll reveal — never
combine a reveal and a settle on one object), second and later garage bikes (a repeated moment is a loop), any plate inside
`.mv-reveal`, 404/error pages, and anywhere the plate is a static spec illustration (bike-detail/compare tables).

## 5. Reduced-motion policy (replaces design-system.css:1009-1015 and :1212-1218)

```css
@media (prefers-reduced-motion: reduce) {
  /* Entrances: none. Content is visible by default, so nothing is lost. */
  .mv-reveal, .hero-photo, .hero-content,
  .mv-plate[data-settle], .mv-plate[data-settle] .mv-plate-stripe,
  .mv-enter-up, .mv-enter-down, .mv-enter-list > *,
  .mv-field-error, .mv-alert[role='alert'] {
    animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; translate: none !important;
  }
  /* Loops still signal activity, without motion. */
  .mv-loader::after, .mv-loader-tread, .mv-loader-hub, .mv-loader-text .mv-dots::after,
  .mv-skeleton-rows > div, .mv-navprogress-bar { animation: none; }
  .mv-loader-text .mv-dots::after { content: "…"; }
  /* Feedback keeps its colour; spatial movement goes. */
  .mv-btn-primary:hover { translate: 0 0; }
  .mv-btn:active, .mv-btn-ghost:active { scale: 1; }
  a.mv-row:hover svg, .hero-hook:hover svg { transform: none; }
  .mv-disclosure::details-content { transition: none; }
  .mv-disclosure > summary svg, .mv-disclosure > summary .mv-disclosure-mark { transition: color 160ms; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```
Colour transitions (≤300ms) are left running: they carry state and are not motion. Per-file guards that only duplicate this
block (navbar.tsx:282, cookie-consent.tsx:405, sticky-app-bar.tsx:50, trackside-read.css:1436, compare-page.tsx:176) can go once
the page is inside `.mv-marketing`; explore.css:797-809 and garage-ui.css:100/444 stay (outside the marketing wrapper).
