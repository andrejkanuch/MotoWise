# Adapt + Polish lenses — iteration 4 (research only, nothing edited)

Scope: `docs/design/web-race-plate-redesign/lens/SCOPE.md` (root-only routes now live under `src/app/(root)/`, same URLs). Method: Impeccable detector (`detect --json --no-config`) on 14 routes at 360/390/768/1024/1280/1440/1920; headless Chromium (Playwright, the repo's own install — not the shared browser pane) measuring bounding boxes, computed font sizes, hit targets, button/input heights, image boxes vs natural sizes, fixed/sticky chrome and `<meta>` at 320/360/390/768/1024/1280/1440/1920 and 844×390 landscape; `curl` of the DOM; a line-by-line read of every in-scope CSS file. Gaps: the cookie banner never mounted in headless Chromium (its stacking is reasoned from CSS); `/garage` and `/profile` are auth-gated and read from code only; gestures were not exercised; Safari/Firefox not run.

Headline numbers: no route scrolls horizontally at 320–1920 (`.mv-marketing { overflow-x: hidden }` hides two real overflows, rows 7 and 8). Button heights in the wild: 36 / 40 / 44 / 48 / 51 / 52 / 53 / 55 / 57 (row 51). Text under 15px at 360: 46 × 10px, 24 × 12px, 99 × 13px (13 is the meta step; 10 and 12 are not). Transition durations in use: 120 / 150 / 160 / 180 / 200 / 240 / 250 / 300 / 350 / 400 / 420 ms against a 160/200/240/420 map. `forced-colors` / `prefers-contrast`: zero rules in the whole app. `@media print`: two partial blocks (trackside-read.css, share-page.css), none in the kit.

Columns: # · file · line · breakpoint → issue · exact fix. ★ = the 12 most visible. Paths are `apps/web/src/` unless noted. Adapt rows (A) come first per file, polish rows (P) after.

## app/root-metadata.ts

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 1 ★ | 22–28 | every iOS phone, landscape and standalone → `rootViewport` has no `viewportFit: 'cover'`, so `env(safe-area-inset-*)` resolves to 0 and every `calc(… + env(safe-area-inset-bottom))` in the sticky app bar, trip bar, garage bar, cookie bar/sheet and nav sheet is inert; the bars sit under the home indicator. | `viewportFit: 'cover'`; then give the fixed bars side insets so the notch cannot eat them in landscape: `.mv-navbar, .mv-appbar, .trip-sticky, .mvg-bar, .mv-cc-bar-inner { padding-left: max(20px, env(safe-area-inset-left)); padding-right: max(20px, env(safe-area-inset-right)); }` (keep the 40/24/20 steps as the `max()` fallback). |
| 2 | 11–18 | favicon → `favicon.ico` + PNGs only; no scheme-aware mark, so the graphite tile sits on a light tab strip in light mode. | Add `/icon.svg` with `@media (prefers-color-scheme: dark)` inside the SVG and list it first: `icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, …]`. |
| 3 | 25–28 + providers/theme-provider.tsx 40–47 | theme-color → `applyTheme` writes the resolved ground into BOTH media-scoped metas (measured: both `#f3f2ef` in a light context), so after a manual toggle the metas disagree with their `media` and Safari can snap back on an OS change. | Keep the two media metas static and add a third media-less `<meta name="theme-color">` that the provider alone updates. |

## components/marketing/navbar.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 4 ★ | 41–46, 67–75 | ≥1280 → `.mv-navbar-inner { max-width: 1240 }` sits inside a 40px-padded bar, so the brand is at x=40 (1280) / 340 (1920) while every section H2 and the footer brand sit at 60 / 380 (measured on all 14 routes). Same defect in the home hero (row 9) and the feature hero (row 32): the three top-of-page objects are 20–40px left of the page's content edge. | Move the gutter inside the container like `.mv-section`: `.mv-navbar { padding: 14px 0 } .mv-navbar[data-scrolled] { padding: 10px 0 } .mv-navbar-inner { max-width: var(--mv-container); padding: 0 40px }` with `0 24px` ≤900 and `0 20px` ≤480 (replace the padding rules at 192–195). |
| 5 | 187–190 | 901–1024 → the bar collapses at `max-width: 1024px`, which hides the full bar on iPad landscape (1024) although three links fit from ~880px in every locale (brand 123 + de links ≈ 330 + de right group ≈ 360 + gaps 32 = 845). | `@media (max-width: 900px)` (the kit's gutter step); keep `.mv-nav-link { white-space: nowrap }`. |
| 6 | 136–186 | 844×390 landscape → the sheet's content is ≈480px (3×52 links + 76 row + 2×55 actions + padding) so the copper action is below the fold on open. | `@media (max-height: 500px) { .mv-nav-sheet { padding-top: 56px } .mv-nav-sheet-link { min-height: 44px; font-size: 18px; line-height: 24px } .mv-nav-sheet-actions { flex-direction: row } .mv-nav-sheet-actions > * { flex: 1 } }`. |
| 7 (P) | 41–45, 53–55; design-system.css 27 | the resting bar is 73px (72 + hairline) and 64 when scrolled, but `--mv-nav-h` is published as 64 and explore hard-codes `--xp-nav-h: 72px` (explore.css 15). | Publish the truth once: `.mv-root, .mv-marketing { --mv-nav-h: 72px } .mv-marketing:has(.mv-navbar[data-scrolled]) { --mv-nav-h: 64px }`; explore and `.tabnav` read `var(--mv-nav-h)`. |
| 8 (P) | 99–122 | hover → `.mv-nav-link` over the hero photo is ink-2 at 3.9–4.0:1 (detector, home and /de at 1280–1440: the left scrim is 0.32 where the links sit). | `.mv-navbar:not([data-scrolled]) .mv-nav-link, .mv-navbar:not([data-scrolled]) .mv-lang-select { color: var(--mv-ink) }`. |

## components/marketing/hero.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 9 (★ with row 4) | 62–70 + design-system.css 1151 | ≥1280 → `.hero-content { maxWidth: 1240 }` inside `.hero-section { padding: 120px 40px }`: H1 at 40/340 vs section H2s at 60/380 (see row 4). | `.hero-section { padding: 120px 0 }` and `.hero-content { max-width: var(--mv-container); padding: 0 40px }` (24 ≤820, 20 ≤480); move the 1152–1158 padding steps to `.hero-content`. |
| 10 | 39, 52 | 1024×1024–1366 (tablet portrait) → the portrait source switches only at `max-aspect-ratio: 4/5`; at 1:1 the 1.79 landscape is cover-cropped to its middle 56%: the sun and the road's sweep go, the H1 lands on the rider (rider sits at x≈62%, y≈30–85% of the frame). | `<source media="(max-aspect-ratio: 1/1)" srcSet={HERO_IMAGE_PORTRAIT} />` and `objectPosition: '62% 60%'` on the landscape so the crop keys on the rider at 1280×900 (box 1.42, 20% cropped). ≥1920 shows the full frame; no change. |
| 11 | 24–35, design-system.css 1156–1158 | 360×667 (iPhone SE/8) → hero content is 658px tall (measured) under 96px top padding: the store buttons start at y≈580 and the trust line is below the fold. | `@media (max-width: 480px) { .hero-section { padding-top: 88px } .hero-plate-slot { margin-top: 24px } .hero-cta-row { margin-top: 24px } }`. |
| 12 (P) | 82–83, components/explore/app-promo.tsx 38–40 | number formatting → `figure="24,318"`, `"1,882 km"` hard-code en-US grouping on localized/global pages (de reads "24.318"). | `const fmt = useFormatter(); figure={fmt.number(24318)}`; app-promo: `new Intl.NumberFormat('en').format(…)` until it is localized. |
| 13 ★ (P) | 93–101 vs store-buttons.tsx 129–138 vs feature-cta.tsx 44–52 | the same store-button pair has two icon sizes: Apple 15 / Play 14 in the home hero and feature CTA, Apple 18 / Play 16 in `StoreButtons` (feature heroes, CTA band); the bar's Lucide glyphs add four more sizes (row 88). | One `<StoreGlyph platform>` exported from store-buttons.tsx at 16×16 for both marks; the hero and feature-cta import it. |

## components/marketing/design-system.css

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 14 ★ | 95–103, 762–765; features-grid.tsx 176, 214 | 320–480 → every two-column grid is bare `1fr` (= `minmax(auto, 1fr)`), so one unbreakable token widens the column past the viewport: on `/de` the maintenance block's plate figure renders the missing-key path `Features.grid.maintenance.plateFigure` at 40px condensed (550px) and pushes `.fx-copy` to 440px — the H2, body and link are cut at the right edge (measured 360: right=460); the footer's `Footer.linkCostCalculator` key (178px) pushes the 2-col footer grid to 375px. English is safe only because no token is long. | `minmax(0, 1fr)` in `.mv-grid-hero`, `.mv-grid-2`, `.mv-grid-2-rev`, `.mv-grid-cards`, `.mv-footer-grid` and `.fx-block`, `.fx-band-grid`; guard the two text slots: `.mv-plate-figure, .mv-footer-link { overflow-wrap: anywhere }`; add the de/es/… keys (harden #2). |
| 15 | 870–883 | 320–360 → `.mv-footer-wordmark { font-size: clamp(80px, 16vw, 240px) }` is 80px at ≤500, i.e. "MotoVault" ≈ 324px: centred + `overflow: hidden` clips the M and t at 360 and ~22px each side at 320 (measured box 280/320). ≥1920 holds at 240px / 1160 wide. | `font-size: clamp(56px, 22vw, 240px); white-space: nowrap` (72px at 360 → 292px; 64px at 320 → 259px). |
| 16 | 1164–1182 | forced colors → no `forced-colors` rule anywhere: the selected segment (455–460, background only) and the pressed chip (553–554, copper border) become indistinguishable from their neighbours, `.mv-progress > div` (trackside-read.css 1265) loses its fill, the cookie switch (cookie-consent.tsx 370–392) loses on/off, the plate loses bone/signal/red (the sr-only state word saves it), the copper primary loses its fill (text survives). `prefers-contrast: more`: the 0.09-alpha hairlines vanish. | Append: `@media (forced-colors: active) { .mv-segmented > [aria-pressed='true'], .mv-segmented > [aria-current], .mv-chip[aria-pressed='true'], .mv-chip[data-active='true'] { outline: 2px solid ButtonText; outline-offset: -2px } .mv-progress > div, .mv-cc-switch, .mv-cc-switch-knob, .mv-plate { forced-color-adjust: none } .mv-btn-primary, .mv-btn-ghost { border: 1px solid ButtonText } } @media (prefers-contrast: more) { :root, html:not(.dark) { --mv-line: color-mix(in srgb, var(--mv-ink) 30%, transparent); --mv-line-2: color-mix(in srgb, var(--mv-ink) 18%, transparent) } }`. |
| 17 ★ | (none) | print of a blog post or /share → no `@media print` in the kit: the fixed `.mv-navbar` repeats on every printed page (Chromium prints fixed elements per page), plus the sticky app bar, the cookie bar, the 240px outlined wordmark, the theme toggle and the hero/CTA scrims; `content-visibility: auto` sections (globals.css 14–17) do print. | Add to the kit: `@media print { .mv-navbar, .mv-nav-sheet, .mv-appbar, .mv-cc, .mv-navprogress, .mv-footer-wordmark, .mv-footer-bottom-right, .hero-section, .cta-band, .mv-section-cta { display: none !important } .mv-marketing, .mv-root { overflow: visible } .mv-read, .mv-index, .mv-section, .mv-section-inner { padding-top: 0 } .mv-read-body a[href^='http']::after { content: ' (' attr(href) ')'; font-size: 13px; color: var(--mv-ink-3) } .mv-rows > li, .mv-read-body h2, .mv-read-body h3 { break-inside: avoid; break-after: avoid } @page { margin: 16mm } }`. trackside-read.css 1437–1445 and share-page.css 453–471 keep their page-specific hides. |
| 18 | 634–643, auth-ui.css 107–109 | 320 → `.mv-plate { min-width: 264px }` fits the 280px column at 320 only because the gutters are 20 (measured 264 at 320, 280 in the auth panel). Not an overflow today; it becomes one if a page keeps 24px gutters at 320. | `min-width: min(264px, 100%)`. |
| 19 | 497–522; garage-view.css 400–403; 128; trackside-read.css 1087–1090 | hairline doubles → `.mv-rows` draws `border-top` and its first row `border-bottom`; a list placed directly under a bordered head (`.gv-rows-label { border-top }` + `.mv-rows`, `.mv-section-stats` border-top + a first `.mv-rows`, `.mv-tool-rows` border-top inside the bordered results card) draws two hairlines 10–24px apart. | `.gv-rows-label + .mv-rows, .mv-section-stats > .mv-rows:first-child, .mv-tool-results > .mv-tool-rows:first-child { border-top: 0 }`; generally prefer `.mv-rows.is-open` under any element that already rules. |
| 20 | 525–530 | phones → breadcrumb links are 13px and measure 36×18 (hit target well under 44; every feature/compare page). | Keep 13px, grow the target: `.mv-crumbs a { display: inline-flex; align-items: center; min-height: 44px; margin: -13px 0 }` so the 40px crumbs→H1 interval holds. |
| 21 | 785–794 | `.mv-footer-brand` measures 119×28 (no min-height) while `.mv-nav-brand` is 44. | `min-height: 44px`. |
| 22 | 885–905 | `.mv-footer-bottom` and `.mv-footer-operator` are 12px — with `kbd.xp-kbd` the only 12px text on the site; 13 is the meta step. | `font-size: 13px; line-height: 18px` on both; `.xp-kbd { font-size: 13px }` (explore.css 693). |
| 23 ★ (P) | 257–272, 291–295, 362–363, 370–376 | button heights → `.mv-btn` sets neither `line-height` nor `min-height`, so it inherits preflight's `line-height: 1.5`: primary = 14+23+14 = 51px, ghost = 53 (its 1px border), block 55/57, `.is-compact` 40, inputs 48 / 52 (`.is-tall`), icon buttons 44, footer stores 44, chips 36 / 44, segmented 40. Side by side in the hero row the copper and the ghost button differ by 2px; next to a 48px field the submit is 51 (explore `.xp-field-submit`). | `.mv-btn { box-sizing: border-box; min-height: 48px; padding: 0 22px; line-height: 20px; border: 1px solid transparent } .mv-btn-ghost { border-color: var(--mv-line) } .mv-btn-block { min-height: 52px; padding: 0 22px } .mv-btn.is-compact { min-height: 40px }`; `.mv-chip { min-height: 40px }` and `@media (pointer: coarse) { .mv-chip, .mv-segmented > button, .mv-segmented > a { min-height: 44px } }`. Everything then sits on 40 / 44 / 48 / 52. |
| 24 (P) | 271, 307, 313, 319, 324, 326, 333, 354, 391, 451, 484, 513, 521, 550, 835, 862 | animation timing → the kit mixes 0.15s (icon button, nav link 117, language select 64, cookie text 301, gpx scrim 74), 0.18s (checklist 1354–1380), 0.2s (btn translate, link, row, chip, field, footer, tabnav 177, cookie switch 379/389), 0.25s (btn background/border), 250ms (the three bottom bars), 0.3s (navbar 51, check letter 1293, progress colour 1272), 0.35s (theme icon 333), 400ms (progress), 120ms (xp-option 633) against the 160/200/240/420 map. `transition: all` — none (verified). | Promote four durations to mv-tokens.css (owner): `--mv-dur-1: 160ms` colour/background/border, `--mv-dur-2: 200ms` translate/scale/opacity, `--mv-dur-3: 240ms` height/disclosure/theme icon, `--mv-dur-4: 420ms` the stripe; snap every value above to the nearest (the bars' 250 → 240, the navbar's 300 → 240, 120/150/180 → 160, 350/400 → 420). |
| 25 (P) | 488 | field focus → copper border + copper outline with a 2px gap reads as a double ring. | `.mv-field-input:focus-visible { border-color: var(--mv-copper); outline-offset: 0 }` (or keep the border on `--mv-field-line` and let the outline alone speak). |
| 26 (P) | 433–452 | segmented buttons take the root 2px outline at `outline-offset: 2px` inside a 2px-padded track, so the ring overlaps the neighbouring segment and the track edge. | `.mv-segmented > :focus-visible { outline-offset: -2px }`. |
| 27 (P) | 519–522; trackside-read.css 308–310, 658–661, 823–825, 885–887; share-page.css 244; faq.tsx 73; compare-page.tsx 151 | hover grammar → links in rows lift the title to copper (rows, feed, places, route rows, share rows, footer links, TOC, compare dir links), but the home FAQ `summary` also lifts to copper (`.faq-q:hover`) while the feature-page FAQ summary (feature-content-page.tsx 436, `summary.mv-row`), `.mv-cmp-faq summary`, `.mv-read-faq summary`, `.mvp-faq summary`, `.tabnav-tab` and `.sp-tabs a` lift to ink. | One rule: navigation lifts to copper, disclosure lifts to ink. Delete `.faq-q:hover { color: var(--mv-copper-text) }` and add to the kit `.mv-row:is(summary):hover, .mv-disclosure > summary:hover { color: var(--mv-ink) }`. |
| 28 ★ (P) | 646–648, 652–669 | the plate's livery stripe is painted above the light-scheme keyline (`box-shadow: inset 0 0 0 2px`), so at the top-right corner the copper band and its 4.5px ground band cross the 2px ink border — the ground band reads as a notch cut into the keyline, on every light-scheme plate (home hero in light, feature grid, auth panel, garage). | Draw the keyline on top: `.mv-plate::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 1 } html:not(.dark) .mv-plate::after { box-shadow: inset 0 0 0 2px var(--mv-plate-ink) } html:not(.dark) .mv-dark-scene .mv-plate::after { box-shadow: none }`; delete 646–648 and 1128–1130. |
| 29 (P) | 661–669 | the stripe's ground band is `--mv-bg`; inside a card host (pro success `.mvp-success-plate`, garage `.mvg-card`, the auth panel on `--mv-bg-2`) the band should be the host's surface, otherwise a lighter/darker notch shows. | `background: var(--mv-plate-ground, var(--mv-bg))` and set `--mv-plate-ground` on the hosts (`.mva-panel { --mv-plate-ground: var(--mv-bg-2) }`, `.mvg-card, .mvp-summary { --mv-plate-ground: var(--mv-surface) }`). |
| 30 (P) | 150–165; features-grid.tsx 203; feature-screenshot.tsx 9 | `.mv-phone-mockup` radius 44 (38 ≤900, 34 ≤480) with 8px padding, but the inner screen uses `--mv-radius-screen` 28 → the corner ring is 44 outside / 28 inside instead of concentric (36 / 30 / 26). The cut and bleed crops (no frame) are right at 28. | Inside a frame: `.mv-phone-mockup > * { border-radius: calc(var(--mv-radius-plate) + 16px - 8px) }`, i.e. `.fx-screen, .mv-shot-screen { border-radius: 36px }` with 30 ≤900 and 26 ≤480; keep 28 for `.fx-art-cut` / `.fx-art-bleed`. |
| 31 (P) | 1035–1044 | `.hero-headline` has no `text-wrap: balance`; English lines are forced by two block spans, but "de cada motociclista." (es) and "jedes Fahrers." (de) wrap inside their span at ≤420 and leave a one-word third line. | `.hero-headline > span { text-wrap: balance }`. |

## components/marketing/feature-content-page.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 32 | 235–236 + design-system.css 125 | ≥1280 → `.mv-section-hero` has padding but no `max-width`/`margin: 0 auto` (unlike every other shell), so the inner `maxWidth: 1240` div lands at x=40/340 while the first H2 of the same page sits at 60/380 (measured on /features/* and /de/features/*). | design-system.css 125: `.mv-section-hero { padding: 160px 40px 96px; max-width: var(--mv-container); margin: 0 auto }`; drop the inner `style={{ maxWidth }}` wrapper (236). |
| 33 | 253–256 | 768–900 → the hero grid is Tailwind `md:` (768) while the kit collapses at 900: at 768–900 the 440px visual column is ~290px wide beside a 3-line H1. | `min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]` (or move the pair to `.mv-grid-hero`, which already collapses at 900). |
| 34 | 379–380 | 320–560 → the spec table (`minWidth: 560px`) scrolls inside a plain div: not keyboard-scrollable, no sticky row header, no edge affordance; `.mv-table th[scope=row]` wraps to 3 lines at 360. | Reuse the compare pattern: `className="mv-tablewrap" tabIndex={0} role="region" aria-label={table.title}` and `th[scope=row] { position: sticky; left: 0; background: var(--mv-bg) }` (compare-page.tsx 161 already has `.is-sticky`). |
| 35 (P) | 84–91, 409–419 | ≥1024 → `BODY_STYLE { maxWidth: '68ch' }` and the long-form block's 820px column produce 88–96 characters per line (detector: 5 paragraphs on each feature page). `ch` is the width of "0" (≈0.55em); running text averages 0.45em, so 68ch ≈ 90 chars. Same arithmetic hits `.mv-read-body` 66ch (trackside-read.css 127), `.overview-text` 68ch (trip-detail.css 220/230), `.mv-cmp-body` 68ch (compare-page.tsx 141), `.review-text` 68ch. | One measure token: `--mv-measure: 60ch` (≈ 75–80 chars) and use it in all five places; the reading column stays 760. |
| 36 (P) | 436–446 | the FAQ `summary.mv-row` gets no hover at all (the kit's hover targets `a.mv-row`) while the home FAQ lifts to copper — see row 27. | covered by row 27. |

## components/marketing/features-grid.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 37 | 247–261 | 768–900 → `.fx-block` and `.fx-band-grid` go single-column at ≤900 although a 260px phone + 328px copy fits two-up from 768 (720 − 64 gap); at 768–900 a left-aligned 260px phone leaves ~460px of empty tablet width. | Collapse the two feature grids at `max-width: 767px` (keep the 900 step for gutters): move lines 250–260 into a `@media (max-width: 767px)` block, keep 248–249 in the 900 block. |
| 38 | 176, 214 | 320–480 → bare `1fr` (row 14). | `minmax(0, 1fr)`. |
| 39 (P) | 237 | `margin-right: calc(-1 * ((100vw − min(100vw, 1240)) / 2 + 40px))` — `100vw` includes the scrollbar on Windows/Linux, so the bleed overshoots by ~15px; harmless only because `.fx-section { overflow-x: clip }`. | `margin-right: calc(-1 * (max(0px, (100cqw - var(--mv-container)) / 2) + 40px))` with `container-type: inline-size` on `.fx-section` (container units exclude the scrollbar). |
| 40 (P) | 77–78, 112, 129 | the expenses phone screen and the cut/bleed crops use `objectPosition: 'center top'` on 9:19.5 captures, so the iOS status bar is the most prominent band of every crop. | `objectPosition: 'center 8%'` (the cut) / keep `top` only where the capture has no status bar. |

## components/marketing/sticky-app-bar.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 41 ★ | 29–57, 141–152 | 360 → the bar measures 113px (message wraps to 3 lines beside a 51px button; 90px on /de), 15% of a 740px viewport and 29% of a 390px landscape; the dismiss `.mv-icon-btn` is squeezed to 27×44 by the flex row (hit target under 44). | `.mv-appbar > .mv-icon-btn { flex: none } .mv-appbar .mv-btn { white-space: nowrap }`; `@media (max-width: 480px) { .mv-appbar-text { -webkit-line-clamp: 1 } }`; `@media (max-height: 500px) { .mv-appbar { display: none } }` and skip the body padding reserve in that case. |
| 42 | 39, 44 | 250ms vs the 240 step; the entrance already uses the kit's `.mv-enter-up` 200ms. | `translate 240ms`, `opacity 240ms`. |

## components/cookie-consent.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 43 | 251–281 | 844×390 landscape → the bar wraps body (`flex: 1 1 360px`) + three actions onto two rows ≈ 118px; with the 73px navbar and (on Android) the 68px app bar, 66% of the viewport is chrome. The settings sheet (`max-height: calc(100dvh − 24px)`) scrolls and is fine. | `@media (max-height: 500px) { .mv-cc-bar-inner { flex-wrap: nowrap; padding-top: 8px; padding-bottom: calc(8px + env(safe-area-inset-bottom)) } .mv-cc-body { font-size: 13px; line-height: 18px } .mv-cc-actions .mv-btn { min-height: 40px; padding: 0 14px } }`. |
| 44 | 306–310, 316–324, 395–396 | the ≥640 sheet (`bottom: 20px`) and the settled toast (`bottom: 20px`) carry no `env(safe-area-inset-bottom)`; the phone sheet does. | `bottom: calc(20px + env(safe-area-inset-bottom))` on both. |
| 45 | 340–348, 370–392 | the switch is 44×26: a 26px-tall target inside a 44px row, and the row name is not a `<label for>`, so only the knob toggles. | Make each `.mv-cc-row` a `<label>` wrapping the switch, or pad the switch: `.mv-cc-switch { padding: 9px 0; box-sizing: content-box; background-clip: content-box }`. |
| 46 (P) | 351–357 | `.mv-cc-row-name` is 13px Geist Mono for cookie names (`_ga`, `ph_*`): identifiers, so the mono exception holds — but the 13px/20px line sits 2px higher than the 13px/18px tag beside it. | `line-height: 18px`. |
| 47 (P) | 243 | `z-index: 9999` while the kit uses 50/60/99/100; the auth modal (50) and the gpx dialog (60) open under the cookie sheet. | `z-index: 110` (above the navbar's 100, below nothing else). |

## components/explore/explore.css

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 48 ★ | 99–104, 184–186 | every width → `.xp-figure-unit { font-size: 0.5em }` gives 10px "km", "m", "routes" on every 20px figure: 46 instances at 360 on /explore, 8 on /explore/at (detector flags all; smallest text on the site). | `font-size: max(13px, 0.5em)`; on the 20px chip figures set the unit to 13px explicitly. |
| 49 ★ | 444–492 | 360 phone results → three stacked sticky bars: navbar 73 + `.xp-mtop` 66 + `.xp-mfilters` 65 = 204px (28% of 740) before the first row, plus the 51px FAB at the bottom. | Stick only the top bar: `.xp-mfilters { position: static }` (keep it scrollable), and let `.xp-mtop` collapse to 48px once scrolled (`.xp-mresults:has(.xp-mlist:scrolled)` is not available — publish a `data-scrolled` from the existing scroll listener and set `.xp-mtop[data-scrolled] { min-height: 48px; padding: 4px 16px }`). |
| 50 | 502–510, 494–497 | iOS → `.xp-fab { bottom: calc(24px + cookie) }` and `.xp-mlist { padding-bottom: calc(112px + cookie) }` carry no safe-area inset (the only bottom-fixed control without one). | `bottom: calc(24px + env(safe-area-inset-bottom) + var(--mv-cookie-banner-h, 0px))`, same for the list padding. |
| 51 | 710–717 | 320 → `.xp-search-hint` "⌘K focuses the search…" is `white-space: nowrap` (clipped at 359 on a 320 viewport) and is a keyboard hint shown on touch phones. | `@media (hover: none) { .xp-search-hint { display: none } }` and drop `nowrap`. |
| 52 (P) | 15, 323–331, 449 | `--xp-nav-h: 72px` duplicates the navbar height (row 7). | read `var(--mv-nav-h)`. |
| 53 ★ (P) | hero-bold.tsx 47–52 + public/images/hero-explore.jpg | ≥1025 → the explore hero is a 1376×768 landscape rendered into a 4:5 box (517×647 at 1280) with `sizes="45vw"`: next/image serves the 640w candidate (576×321) and `cover` scales it 2.0× (4× on retina) — the page's lead photo is visibly soft. | Ship a portrait crop (`hero-explore-portrait.jpg`, 1080×1350, the rider at 58%/65% stays centred) via `<picture>`/`<source media="(min-width: 1025px)">`, or `sizes="(max-width: 1024px) 100vw, 1200px"` so the 1200w candidate's cover-scaled height (≈ 670) covers the box. |
| 54 (P) | 402–415 | `.xp-map-badge` is 36px tall with 15px text on the map (where the zoom controls are 29px): fine as a label, but it is a `<div>` that looks like a chip. | If it stays non-interactive, drop the hairline and the raised fill (`background: var(--mv-surface-2-glass)`, no border) so it reads as a caption, not a control. |

## components/trip-detail/trip-detail.css + app/(root)/trips/[country]/[region]/[slug]/page.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 55 ★ | page.tsx 619; css 270–274; trip-detail-map.tsx 447–458 | ≤900 → `.map-frame` has inline `height: 500` AND `aspect-ratio: 16/9`, so the frame resolves to 889px wide at 360 (clipped by `.map-card`): the canvas is 2.5× the viewport, markers 2–5 sit at x=422–717 (off-screen), the zoom controls at x=870 are unreachable (and are Mapbox's 29×29 defaults at every width — under the 44px floor), and the user cannot pan to them without fighting page scroll. | Remove the inline `height` (619) and `minHeight: 500` (447/458); `.map-frame { aspect-ratio: 16 / 9; min-height: 240px } @media (min-width: 901px) { .map-frame { aspect-ratio: auto; height: 500px } }`; the inner `.mapboxgl-map { height: 100% }`; size the controls `.mapboxgl-ctrl-group button { width: 44px; height: 44px }` (trip-detail.css 686 already styles the popup close). |
| 56 | 522–538, 562–564 | 360 → the bar measures 83px (title + 13px sub + 51px button) but the spacer reserves 72px: the last 11px of the end CTA sit under the bar. | Measure like the app bar (ResizeObserver → `--trip-bar-h` on `<html>`, spacer `height: var(--trip-bar-h)`), or make the bar one line: `.trip-sticky-sub { display: none }` ≤480 and the button `.is-compact`. |
| 57 | 149–156 | the `.tabnav` sticks at `var(--mv-nav-h, 64px)` — correct only once scrolled (row 7). | read the published variable. |
| 58 | 535–537 | 250ms (row 24). | 240ms. |
| 59 (P) | 636–643 (and share-page.css 439–441, garage-view.css 295–300) | ≤480 → `.rh-figure-value small { font-size: 14px }`, `.sp-figure-value small` 14px, `.gv-odo-unit` 14px — 14 is not a step; the unit rule is "0.5× the figure". | `font-size: 0.5em` on every unit (14 at 28 is then a ratio, not a step); or 13px. |
| 60 (P) | 103–117, 143–161 (share), 99–104 (explore), 687–692 (plate), garage-view.css 295–300, trackside-read.css 899–905 | unit spacing → figure→unit gaps are 8px (plate), 0.12em (explore), 5px (garage), 4px (trip/share), 3px (route rows), 4px right (places). | One `.mv-unit { margin-left: 0.15em; font: 500 0.5em/1 var(--mv-font-display); color: var(--mv-ink-2) }` in the kit (≈ 3px at 20, 6px at 40, 10px at 64) and use it everywhere. |
| 61 (P) | 326–352 | `.stop-icon` box 20px with a 16px glyph and `margin-top: 1px` beside 15px/1.45 text: glyph centre 11px vs first-line centre 10.9px — aligned; `.mv-alert > svg` (18px, `margin-top: 1px`) and `.mv-cmp-mark svg` (15px, `margin-top: 3px`) also land within 0.5px. Verified, no change. | — |

## components/marketing/compare-page.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 62 | 153–161, 435–437, 475–477 | 320–480 → the directory matrix sits in a Tailwind `div.mt-8.overflow-x-auto` (1360px wide at 360) while the vs-pages use `.mv-cmp-tablewrap`; both scroll with a sticky first column (good), neither is keyboard-focusable nor signals the overflow. | One wrapper: `<div className="mv-cmp-tablewrap" tabIndex={0} role="region" aria-label={…}>` for both, plus a right-edge fade `mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent)` toggled by a `data-overflow` attribute. |
| 63 (P) | 148 | ≥1280 → `.mv-cmp-grid-row > p.mv-cmp-body.is-compact` runs 116–125 characters per line (the grid's second column has no measure). | `.mv-cmp-grid-row > p { max-width: var(--mv-measure) }` (row 35). |
| 64 (P) | 146–147 | `.mv-cmp-meta` and `.mv-cmp-note` 13px: the detector's "/pro." straggler at 360. | add `text-wrap: pretty` to `.mv-cmp-meta` (note already has it). |

## components/marketing/trackside-read.css

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 65 | 1437–1445 | print → hides crumbs/CTA/search/chips but not the navbar, footer, app bar, cookie bar (row 17 covers it). | covered by row 17. |
| 66 (P) | 96–103 | `.mv-read-hero { aspect-ratio: 21 / 9 }` holds 1200×630 OG images (1.91): 18% of the image height is cropped; `.mv-feed-hero` uses 2 / 1. | `aspect-ratio: 1.91` on both (or 2 / 1 on both). |
| 67 (P) | 782–789 | `.mv-skeleton-rows > div` placeholders have `border-radius: 12px` for rows that render with radius 0 and hairlines. | `border-radius: 0; border-bottom: 1px solid var(--mv-line); height: 88px; margin: 0`. |
| 68 (P) | 620–625, 704–709 | 721–900 → the feed row keeps `180px minmax(0,1fr)` down to 720; verified fine. `.mv-feed-title` 34px at 721 next to a 180px meta column reads right. | — |

## components/marketing/footer.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 69 (P) | 79 + design-system.css 806–813 | 390 → `.mv-footer-brand-text` leaves "rider." alone on its third line (detector, 10 routes); de leaves "ENTWICKELT" in `.hero-trust`; `.mvp-footnote` "today". | `text-wrap: pretty` on `.mv-footer-brand-text`, `.hero-trust`, `.mvp-footnote`. |
| 70 (P) | 99–103 | the footer's theme toggle is the kit's 44px `.mv-icon-btn` beside 12px copyright text — right control, but it is the only toggle without a visible label; the navbar one has the sheet row's context. | Add `aria-describedby` → the copyright line is wrong; better: render `<ThemeToggle>` with a visible 13px label ("Theme") in `.mv-footer-bottom-right`. |

## components/auth-ui/auth-ui.css

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 71 | 21–26, 53–67 | 1024–1180 → the photo panel is `1fr` beside a fixed 640px column: at 1024 it is a 384×768 sliver with 40px side padding around a 280px plate and the brand. | `grid-template-columns: minmax(0, 1fr) minmax(480px, 640px)` and start the two-column shell at 1180 (`@media (min-width: 1180px)`), keeping the header bar to 1179. |
| 72 (P) | 491 (design-system.css) + 143 | inputs are 52px (`.is-tall`) on auth while every other field on the site is 48 (blog search, explore); the submit `.mv-btn-block` is 55/57 (row 23). | After row 23: auth fields `.is-tall` 52 + `.mv-btn-block` 52 match; or drop `.is-tall` and run auth at 48 like the rest. |
| 73 (P) | 302–315 | `.mva-divider` "or with email" 13px between hairlines — the only 13px sentence in a form; `.mva-legal` 13px is a 2-line paragraph with 16px-tall inline links (Terms, Privacy: measured 37×16 / 83×16). | Divider 15px; legal 13px stays but `.mva-legal a { display: inline-block; padding: 8px 0; margin: -8px 0 }` for a 32px line target (inline text links are exempt from 44, but 16px is thin). |

## app/(root)/pro/pro.css

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 74 | 103–114 | 768–1000 → `.mvp-hero-grid` collapses at ≤1000: the 400px pricing card becomes a 720px-wide card under the H1 with a 64px price on the left and 400px of empty card. | Keep two columns from 901 (`minmax(0,1fr) 360px`), collapse at ≤900 with `.mvp-card { max-width: 440px }` when stacked. |
| 75 | 225–311 | ≤640 → the Free-vs-Pro table (88/104px value columns + the row label) is ~460px at 360 and scrolls in `.mvp-compare-wrap` without a sticky row header, unlike `.mv-cmp-table`. | `.mvp-compare .mvp-compare-cell:first-child { position: sticky; left: 0; background: var(--mv-bg); z-index: 1 }`. |
| 76 (P) | 135–144 | `.mvp-seg > button { padding: 6px 10px; white-space: normal }` → the segmented buttons measure 40px with two-line labels at 320 ("Annual −30%" wraps) while every other segmented control is 40 single-line. | Shorten the label (`Annual · −30%` → "Annual" with the saving in `.mvp-seg-saving` on its own line only ≥400) or `min-height: 44px`. |
| 77 (P) | 265–269 | the Pro column's card corners use `--mv-radius-card` (16) on a table cell whose row height is 56: 16px radii on a 56px-tall end cell read as a pill end. | `--mv-radius-control` (12) on the head/last cells. |

## app/(root)/(community)/garage/garage-view.css + garage.css + components/garage-ui/garage-ui.css (from code; auth-gated)

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 78 | garage-view.css 47–52; garage.css 310–323 | ≥1320 → `.gv-page { max-width: calc(1240px + 80px) }` and `.nav-inner` give the signed-in pages a 1240 content width while every marketing shell a rider navigates to (/pro, /compare, the footer) has 1160: the garage is 40px wider on each side. | Decide once; the cheapest is `.gv-page { max-width: var(--mv-container) }` and `.community-nav { padding: 0 } .nav-inner { padding: 0 40px }` (24 ≤900, 20 ≤480), matching rows 4/9. |
| 79 | garage-view.css 332–341 | 768–1023 → `.gv-bike { 1fr 300px }` with `.gv-photo { height: 100% }` stretches the 4:3 bike photo to the plate + identity-rows height (≈ 300×330): a portrait crop of a landscape bike. | At 768–1279 keep `aspect-ratio: 4 / 3; align-self: start`; full-height only ≥1280 where the 440px column is wide enough. |
| 80 | garage-ui.css 413–441; garage.css 306–313 | phone → the bar (`mvg-bar`) stacks correctly over the cookie bar and reserves its height (verified); the community nav is `position: sticky; top: 0` with no safe-area side padding (row 1). | covered by row 1. |
| 81 (P) | garage-view.css 249–254, 256–272 | the garage plate overrides padding (20/24/18) and figure (56/64) while the kit's plate is 16/20/14 and 40 — intended (the page's one 64 figure), but the stripe geometry (top 14, right −46, width 140) was drawn for the 264px plate; on a 560px plate the band is proportionally short and sits too close to the corner. | `.gv-plate-slot .mv-plate-stripe { top: 18px; right: -52px; width: 168px; height: 10px } .gv-plate-slot .mv-plate-stripe::after { top: 15px; height: 5px }` (scale 1.2). |
| 82 (P) | garage.css 440–483 | the account menu (`.nav-mobile-menu`) is `position: absolute` under the sticky nav with no `max-height`/scroll: on 844×390 landscape with the name, three links, Pro and sign-out (≈ 320px) it runs off the bottom. | `max-height: calc(100dvh - 72px); overflow-y: auto`. |
| 83 (P) | garage.css 42–46 (`.prof-title`) + profile/page.tsx 61–130 | /profile renders four different H1s (title, failedToLoad, setupProfile, name) on the same `.mv-section-title.prof-title`; verified consistent with the garage's 44px Operate H1. | — |

## components/share-page.css (/share, /ride, /rider, /u)

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 84 | 46–51 | 844×390 landscape → `.sp-photo { height: clamp(220px, 42vh, 440px) }` + the 64px brand row put the H1 below the fold. | `@media (max-height: 500px) { .sp-photo { height: 140px } }`. |
| 85 | 453–471 | print → good (rows don't break, CTA/wall hidden); still prints the cookie bar, the photo's 440px band and the scrim. | add `.mv-cc, .sp-photo::after { display: none } .sp-photo { height: 160px }`; `@page { margin: 16mm }`. |
| 86 (P) | 213–228 | `.sp-tabs a` margin-right 20 + padding 0 4: the active 2px underline is 8px wider than the label while `.tabnav-tab` has no underline at all — two tab grammars on sibling pages. | Give `.tabnav-tab[aria-current]` the same 2px ink underline (`box-shadow: inset 0 -2px var(--mv-ink)`) and make `.sp-tabs a { padding: 0 12px; margin: 0 }` so the underline spans the label. |

## app/(root)/not-found.tsx + app/[locale]/not-found.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 87 | 27, 52–60 (both files) | 844×390 landscape → `.nf { min-height: 100svh }` with the stage ordered first at ≤900 (`min-height: 38vh`): the 404 message starts below the fold. | `@media (max-height: 500px) { .nf { grid-template-columns: 1.1fr 1fr } .nf-stage { order: 0; min-height: 0; border-left: 1px solid var(--mv-line); border-bottom: 0 } }`. |

## components/marketing/language-switcher.tsx + theme-toggle.tsx

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 88 (P) | language-switcher.tsx 51–65, 119; theme-toggle.tsx 33–34; navbar.tsx 338–340 | icon sizes in the bar: chevron 14, theme 18, burger 22/X 22, sticky-bar X 18, cookie X 20, compare chevrons 18/14, crumbs 14, row arrows 16 — six sizes for one 15px/44px grammar (counted with row 13's ★). | 16 for glyphs inline with 15px text (chevrons, arrows, crumb separators), 18 for 44px icon buttons (theme, dismiss, burger), 20 only for the sheet's X. Set `Menu`/`X` in navbar.tsx to 18. |
| 89 (P) | language-switcher.tsx 64 | `.mv-lang-select` is a native `<select>`: its popup inherits the OS, fine; its hover uses `.15s` (row 24) and its focus ring is the root 2px copper on a transparent control — on the dark hero the ring is the only affordance. | `transition: color 160ms, background 160ms`; add `border: 1px solid transparent` so forced-colors draws an edge (row 16). |

## globals.css + mv-tokens.css (owner — report only)

| # | line | breakpoint → issue | exact fix |
|---|---|---|---|
| 90 (P) | globals.css 14–17 | `section:not(:first-child) { content-visibility: auto; contain-intrinsic-size: auto 600px }` applies to every `<section>` in the app incl. the 1013px footer-adjacent CTA and the garage's `<section class="gv-bike">`: Chrome's scrollbar thumb jumps as sections resolve from 600px to their real height on first scroll (observed document height 7103 at 1280 on the home page vs ~5.3k estimated). | Scope it: `.mv-marketing > main > section:not(:first-child)` and set per-section estimates (`contain-intrinsic-size: auto 900px` for feature blocks, `auto 480px` for FAQ). |
| 91 (P) | mv-tokens.css 104–106 | no duration tokens (row 24). | `--mv-dur-1/2/3/4`. |
| 92 (P) | mv-tokens.css 95–98 | `--mv-radius-screen: 28px` documents "phone-screen crops inside a device frame" but the framed screens need 36/30/26 (row 30); 28 is right for the frameless cut/bleed crops. | Rename to `--mv-radius-crop: 28px` and add `--mv-radius-screen: 36px` for framed screens. |

## Verified, no change needed

Selection inverts ink/bg and the plate inverts to plate-ink/bone; caret and scrollbar are themed; `.mv-link` / `.mv-read-body a` / `.mv-cc-text` / `.mv-quiet-link` all underline at 1px / 3px offset; `.mv-figure`, `.mv-table td`, `.mv-row-aside`, `.rfacts dd`, `.sp-row-meta`, `.mv-defs dd` are tabular; H1s on compare/explore/pro/get/auth/welcome/garage balance and wrap 1–4 lines at 360 without overflow; the 14ch hero cap and the `.mv-section-title` 14ch cap hold German ("Deine Digitale Motorrad-Garage" 2 lines at 44px); the compare tables and the explore filter strip scroll horizontally with a sticky first column / `.mv-scroll-row`; every `fill` image sits in an aspect box (no layout shift measured); the hero's dual-source `<picture>` serves the portrait at phone aspect; the three bottom bars lift by `translate` over the cookie bar and reserve their height; `.mv-phone-mockup`, `.fx-art-cut`, `.fx-art-bleed` collapse at 900/480 with no overflow at 320; containers hold at 1240 up to 1920 (footer wordmark 240px / 1160).

## The 12 ★ in priority order

1 (safe areas inert) · 4+9 (nav brand / hero H1 / feature H1 20–40px off the content edge; row 32 is the same fix) · 14 (bare `1fr` grids let the German plate figure and footer cut the page at 360) · 55 (trip map 889px wide on phones, markers off-screen) · 41 (113px sticky app bar, 27px dismiss) · 49 (204px of sticky chrome on phone results) · 48 (10px units) · 23 (51 vs 53 vs 55 button heights) · 28 (stripe over the light keyline) · 53 (soft explore hero) · 13 (store-glyph and Lucide size spread, with row 88) · 17 (print). Next in line, unstarred: 16 (forced colors / prefers-contrast), 35 (the `ch` measure runs 90 characters), 24 (eleven transition durations against a four-step map).

Evidence files (session scratch, not committed): detector JSON per route × width in `…/scratchpad/detect/`, Playwright measurements in `…/scratchpad/pw/results.json`, `results3.json`, `extra.json`.
