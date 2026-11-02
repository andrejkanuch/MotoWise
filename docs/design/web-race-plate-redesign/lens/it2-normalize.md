# /normalize lens — iteration 2 (2026-10-30)

Scope: `docs/design/web-race-plate-redesign/lens/SCOPE.md`. Research only; nothing in `apps/web` was edited.
Sanctioned and NOT listed: TCLOCS `PRINT_*` constants, `.hero-scrim` / `cta-section.tsx` scrims, `.mv-dark-scene` and the
floating-navbar override in `design-system.css` (mirror `palette.plate*`), `--mv-qr-*` and `--mv-google-*`, the
`theme-color` meta hex in `app/layout.tsx` / `providers/theme-provider.tsx` (meta tags cannot read CSS vars), the devtools
`console.log` colours in the marketing layout, `.mv-cc-row-name` in Geist Mono (cookie names are genuine data).
Out of scope but rendered on in-scope pages: `lib/guides.tsx` (16 Tailwind palette classes inside guide MDX components) and
`app/piel/**` (a separate product with its own palette).

## Summary

The colour system is in good shape: every in-scope `.css` file is token-only except `globals.css`. The literals that
remain live in TSX: the two Mapbox components (old oklch/amber "warm" world, Geist Mono, uppercase, drop shadows), the two
`opengraph-image.tsx` files (old blue-gradient brand), `app/u/[handle]/layout.tsx` (an untouched Tailwind `neutral-*`
page) and `components/guides/trip-card.tsx`. Deprecated aliases are nearly gone (6 sites). The real debt is
**duplication**: nine agents each re-declared the copper button (11 copies), the ghost button (11), the icon button (6),
the copper text link (17), the segmented control (3), the input field (3), the hairline row list (10), the breadcrumb
(4) and the section H2 (15). `trackside-read.css` already holds good `.mv-crumbs`, `.mv-chip`, `.mv-rows`, `.mv-field`,
`.mv-field-input` classes, but only the read pages import that file — and it redefines `.mv-link` differently from
`design-system.css` (underline vs none), so the link style depends on import order. Radii: 35 off-scale CSS values,
mostly 4 px "focus radius" on text links, 6–10 px on small marks/chips, and two sub-control radii inside segmented
tracks. Type: no unloaded Barlow weights anywhere; the only letter-spaced uppercase and mono labels are the Mapbox popups.
Focus/selection: five surfaces re-declare `::selection` (compare page uses copper, the rest ink) and nine re-declare
`:focus-visible` with offsets of 2 or 3 px; the explore submit uses an ink ring.

Counts: (1) hardcoded 9 files / ~75 literals + 33 Tailwind palette classes · (2) deprecated 6 sites · (3) duplicates
~75 classes in 21 files · (4) radii 35 CSS + 4 TSX, shells 6 gutter variants · (5) type 4 sites · (6) focus/selection/
scrollbar 17 declarations.

## Findings by file

Columns: file · line/selector · issue · exact fix. Owner-only files (`design-system.css`, `mv-tokens.css`, `hero.tsx`,
`globals.css`) are listed first as "report only".

### Owner-only — `packages/design-system/src/mv-tokens.css`

| line/selector | issue | exact fix |
|---|---|---|
| 92–94 `--mv-radius-field`, `--mv-radius-inner`, `--mv-radius` | three aliases of 12/12/16 that invite a fourth radius scale | delete after migrating the 4 call sites below; add `--mv-radius-small: 6px` (≤32 px marks, checkboxes, kbd, inline code) and `--mv-radius-track: 2px` (≤4 px bars) so the small radii below have ONE home |
| 110–128 deprecated block | `--mv-warm-*`, `--mv-success/warning/danger`, `--mv-font-sans/serif`, `--mv-on-accent`, `--mv-copper-400/500/600`, `--mv-page`, `--mv-card` | zero consumers remain in scope (verified by grep) — delete the block |

### Owner-only — `apps/web/src/components/marketing/design-system.css`

| line/selector | issue | exact fix |
|---|---|---|
| 45 `.mv-serif` | deprecated alias, no consumer left | delete the selector (keep `.mv-display`) |
| 64 `.mv-mono` | `var(--font-geist-mono, 'Geist Mono', monospace)` bypasses the token | `font-family: var(--mv-font-mono)` |
| 169 `.mv-plate-chip` | `border-radius: 8px` off scale | `var(--mv-radius-small)` (6) or document the chip as a plate-world exception |
| 341–350 `.mv-link` | no underline here, underline + `--mv-copper-border` in `trackside-read.css:646` — two definitions, cascade by import order | keep ONE: the trackside-read version (underlined, copper-border decoration) moved here; delete the copy in trackside-read.css |
| 469, 486 `.mv-plate-edge`, `.mv-plate-edge-identity` | `rgba(18, 19, 21, 0.16/0.68)` literals | `color-mix(in srgb, var(--mv-plate-ink) 16%, transparent)` / `68%` |
| 547 `.mv-footer-brand-mark img` | `border-radius: 6px` | `var(--mv-radius-small)` |
| 569 `.mv-footer-store` | `padding: 9px 14px` off the 4 px grid | `padding: 8px 14px` (min-height 44 already holds the target) |
| 126–141 `.mv-phone-mockup` | `padding: 9px` / `7px` | `8px` / `8px` |
| 287–297 `.mv-btn-primary, .hero-btn-copper` | `.hero-btn-copper` is a second name for the primary button | drop the alias; hero.tsx uses `.mv-btn .mv-btn-primary` |
| (missing) | no block/full-width button variant — `pro.css` overrides `.mv-btn` three times identically, auth/welcome/garage re-declare 52–56 px submits | add `.mv-btn-block` (see Proposed shared classes) |
| (missing) | `.mv-crumbs`, `.mv-rows`, `.mv-chip`, `.mv-field`, `.mv-field-input`, `.mv-select` live in `trackside-read.css`, which only read pages import | promote those blocks here (fixed per the trackside-read rows below) so explore/trips/pro/auth/garage can drop their copies |
| (missing) | no shared H3-scale condensed title; 15 local 26–34 px display headings | add `.mv-h3` (see Proposed shared classes) |
| (missing) | no shared segmented control; 3 local copies | add `.mv-segmented` (see Proposed shared classes) |
| (missing) | selection + focus live on `.mv-marketing` only; auth, welcome, garage, share re-declare them | add `.mv-root` (see Proposed shared classes); make `.mv-marketing` extend it |
| 946–948 `.hero-strip-inner` scrollbar hide | same two lines in `explore.css:403–408` and `trip-detail.css:216–221` | add `.mv-scroll-row` (see Proposed shared classes) |

### Owner-only — `apps/web/src/app/globals.css`

| line/selector | issue | exact fix |
|---|---|---|
| 54–70 `.cta-glow` | `oklch(0.76 0.13 70 / 0.35)` literal AND a copper glow (banned); no consumer in scope | delete |
| 85–100 `.faq-accent-line` | `var(--color-warm-500)` deprecated token; no consumer | delete |
| 42–51, 102–111 `.cta-primary`, `.cta-secondary`; 73–79 `.success-enter`; 8–33 `.reveal-on-scroll` | unused pre-Trackside helpers duplicating `.mv-btn` motion and `.mv-reveal` | delete (keep the `fadeIn`/`fadeInUp`/`scaleIn` keyframes — `gpx-download-button.tsx` uses them — or move them next to that component) |
| 36–39 `:root { --ease-out-quart; --ease-out-expo }` | second easing token set beside `--mv-ease` / `--mv-ease-expo` | delete once the helpers above are gone |

### Owner-only — `components/marketing/hero.tsx`

| line/selector | issue | exact fix |
|---|---|---|
| 39 inline `padding: '120px 40px 120px'` | hero shell differs from `.mv-section-hero` (180/40/100) | use `className="mv-section-hero"` or align the numbers; `design-system.css:971` then stops needing `!important` |

### `components/marketing/trackside-read.css` (lens-typeset owns the type; these are system rows)

| line/selector | issue | exact fix |
|---|---|---|
| 645–657 `.mv-link` | second definition of a shared class (see design-system row) | delete here once the underlined version lives in design-system.css |
| 883 `.mv-chip` | `border-radius: 10px` | `var(--mv-radius-control)` — it is a 36 px control |
| 884 `.mv-chip` | `border: 1.5px` hairline weight unique on the site | `1px` |
| 280 `.mv-read-body code` | `border-radius: 6px` | `var(--mv-radius-small)` |
| 954 `.mv-skeleton-rows > div` | `border-radius: 8px` on a 96 px skeleton row | `var(--mv-radius-control)` |
| 1449, 1455 `.mv-progress`, `.mv-progress > div` | `999px` pill on a 4 px bar | `var(--mv-radius-track)` |
| 1533 `.mv-check-box` | `border-radius: 7px`, `border: 1.5px` | `var(--mv-radius-small)`, `1px` |
| 1222 `.mv-choice input` | `border: 1.5px` | `1px` |
| 1511 `.mv-check-item` | `padding: 13px 0` | `12px 0` |
| 470 `.mv-read-avatar` | `letter-spacing: 0.01em` on the display face | `0.002em` (the display standard) |
| 9 occurrences, e.g. 493, 1078, 1199, 1300 | `13.5px` font sizes (plus `16.5`, `17.5`) off the type scale used everywhere else | `14px` / `16px` / `17px` |
| 13–27 `.mv-read`, `.mv-index`, `.mv-wide` | 24 px desktop gutter while `.mv-section*` use 40 px | `padding: 128px 40px 112px` (phone branch already 20) |

### `components/explore/explore.css`

| line/selector | issue | exact fix |
|---|---|---|
| 42–51 `.xp-h2` | duplicate of `.mv-h2` (same face/weight/size family) | delete; use `.mv-h2` |
| 53–61 `.xp-h3` | local 28 px condensed title | `.mv-h3` |
| 89–98 `.xp-link` (0 users) | dead copper-link copy | delete |
| 449–465 `.xp-text-btn` | copper text action, duplicate of `.mv-text-action` (trackside-read) | `.mv-link` (button reset via `.mv-link` on `<button>`) |
| 473–494 `.xp-crumbs` | duplicate breadcrumb | `.mv-crumbs` |
| 231–259 `.xp-rows`, `.xp-row` | hairline row list; `.xp-row` also carries `border-radius: var(--mv-radius-control)` + negative margins on a hairline row (rows are radius 0) | `.mv-rows` + `.mv-rows-hover` modifier; drop the radius and the `-12px` margins |
| 296–311 `.xp-crow` | same (radius on hairline row) | `.mv-rows` row; radius 0 |
| 417–447 `.xp-seg`, `.xp-seg-btn` | segmented control copy; inner radius `10px` | `.mv-segmented` |
| 563–579 `.xp-icon-btn` | 44 px icon control with surface-2 + border (raised variant of `.mv-icon-btn`) | `.mv-icon-btn` (add `.is-raised` only if the border is needed on the map) |
| 608–656 `.xp-field`, `.xp-input` | third input-field copy | `.mv-field-input` (promoted); keep `.xp-field` only as the composite wrapper |
| 703–728 `.xp-field-submit` | copper button copy with `border-radius: 8px` and an **ink** focus ring | `.mv-btn .mv-btn-primary`; delete the local `:focus-visible` (root copper ring applies) |
| 824–835 `.xp-kbd` | `border-radius: 6px` | `var(--mv-radius-small)` |
| 910–915 `.xp-skel` | `border-radius: 6px` on a 14 px bar | `var(--mv-radius-track)` or 0 |
| 778 `.xp-option` | `--mv-radius-inner` (alias) | `var(--mv-radius-control)` |
| 616–622 `.xp-field:focus-within` | `box-shadow: inset 0 0 0 1px var(--mv-copper)` — a second focus grammar | `outline: 2px solid var(--mv-copper); outline-offset: 2px` like every other field |
| 7 occurrences, e.g. 270, 432, 546, 782, 820 | `13.5 / 14.5 / 12.5px` sizes | `14 / 14 / 12px` |
| 403–408 `.xp-filters` | scrollbar hide copy | `.mv-scroll-row` |

### `components/explore/mapbox-map.tsx`

| line/selector | issue | exact fix |
|---|---|---|
| 135–143 pin `cssText` | `oklch(0.13 0.01 55 / 0.95)`, `oklch(0.84 0.15 68)` (old amber), `oklch(0.92 0.16 68)`, drop shadow `0 6px 14px -4px oklch(0 0 0 / 0.6)`, `'Geist Mono'` label | `background: var(--mv-surface-2); border: 1px solid var(--mv-line-step); color: var(--mv-ink); font-family: var(--mv-font-display); font-weight: 600; box-shadow: none` |
| 178–179 active pin | `oklch(0.84 0.15 68)` fill, `#1a1410` ink | selection is copper: `background: var(--mv-copper); color: var(--mv-on-copper)` |
| 191 container | `var(--mv-bg-2, oklch(0.10 0.009 55))` fallback literal | `var(--mv-bg-2)` |

### `components/trip-detail/trip-detail-map.tsx`

| line/selector | issue | exact fix |
|---|---|---|
| 24–31 `DAY_COLORS` | 8 hex literals for the day legend | import `palette` from `@motovault/design-system` and build the list from it (the sanctioned JS colour source) |
| 140, 152 `'line-color': '#e0a040'` | old warm gold route line | `palette.plateCopper` (JS) — the route is the one highlighted object |
| 220–229 pin `cssText` | `oklch(0.13 0.01 55 / 0.95)`, `border: 1.5px`, `'Geist Mono'`, drop shadow | as mapbox-map: surface-2 / line-step / display face / no shadow; `border: 1px` |
| 237, 242 hover | `#1a1410`, oklch literal | `var(--mv-on-copper)` on copper fill; `var(--mv-surface-2)` |
| 257–286 popup HTML | `'Geist'` font, 6 oklch literals, drop shadow, `'Geist Mono'` 10 px **uppercase, letter-spacing 0.06em** tag strip, `border-radius: 4px` tags | `font-family: var(--mv-font-body); background: var(--mv-surface-2); color: var(--mv-ink); border: 1px solid var(--mv-line); box-shadow: none;` tags: body face 12 px, sentence case, `letter-spacing: 0`, `background: var(--mv-surface-3)`, `border-radius: var(--mv-radius-small)` |
| 360 fallback | `'oklch(0.10 0.009 55)'` | `var(--mv-bg-2)` |

### `components/trip-detail/trip-detail.css`

| line/selector | issue | exact fix |
|---|---|---|
| 157–185 `.rh-icon-btn` | ghost button copy (`gpx-download-button.tsx` depends on it); `padding: 11px 18px` | `.mv-btn .mv-btn-ghost` in both files; delete the class |
| 240–258 `.tabnav-cta` | copper button copy (36 px tall) | `.mv-btn .mv-btn-primary` (min-height 36 via a `.is-compact` modifier if needed) |
| 57–82 `.rh-crumb` | breadcrumb copy | `.mv-crumbs` |
| 276–286 `.rsec-title`, 564–572 `.sib-title`, 617–627 `.end-cta-title` | three section-H2 copies | `.mv-h2` (keep size overrides as one-line modifiers if the 64/52/88 px scales are intentional) |
| 319–343 `.rfacts*`, 574–608 `.sib-list/.sib-row`, 495–502 `.review-list/.review` | hairline row lists | `.mv-rows` (+ `.mv-defs` for key/value facts) |
| 216–221 `.tabnav-inner` | scrollbar hide copy | `.mv-scroll-row` |
| 261–265 `.rsec` 96/40 → 64/24; 611 `.end-cta` 140/40 → 88/24 | phone gutter 24 while the shells use 20 | `64px 20px`, `88px 20px` |

### `components/gpx-download-button.tsx`

| line/selector | issue | exact fix |
|---|---|---|
| 196 `className="rh-icon-btn"` | depends on the trip-detail ghost copy | `mv-btn mv-btn-ghost` |
| 360 `backgroundColor: 'rgba(17, 18, 20, 0.6)'` | scrim literal | `color-mix(in srgb, var(--mv-bg) 60%, transparent)` |
| 327, 371 `rounded-xl`, `rounded-2xl` | Tailwind radii (12/16 — right values, wrong source) | `style={{ borderRadius: 'var(--mv-radius-control)' }}` / `card` |
| 327–333 Toast | fourth local toast/notice style | `.xp-notice`-like notice should become shared `.mv-notice` (surface, hairline, control radius) — or reuse `.mva-banner` grammar |

### `components/share-page.css`

| line/selector | issue | exact fix |
|---|---|---|
| 48 `.sp-brand img` | `border-radius: 8px` | `var(--mv-radius-small)` |
| 181–189 `.sp-section-title`, 354–363 `.sp-cta-title` | condensed title copies | `.mv-h3` / `.mv-h2` |
| 210–226 `.sp-list`, `.sp-row` | hairline row list copy | `.mv-rows` |
| 386–396 `.sp-cta-foot a`, `.sp-link` (0 users) | copper link copy | `.mv-link`; delete `.sp-link` |
| 11–18 `.sp` | re-declares font/colour/bg already on `.mv-marketing` (pages wrap both) | drop those three declarations |
| 80–85 `.sp-main` 40/24 → 32/20 | desktop gutter 24 | `40px 40px 64px` on desktop; phone 20 already |

### `components/auth-ui/auth-ui.css`

| line/selector | issue | exact fix |
|---|---|---|
| 16–42 `.mva-root`, `::selection`, `:focus-visible` | root grammar copy; focus offset 3 px vs 2 px on marketing | `.mv-root` |
| 69 `.mva-brand-logo` | `border-radius: 7px` | `var(--mv-radius-small)` |
| 344–367 `.mva-btn-secondary`, 376–407 `.mva-oauth-btn` | two ghost-button copies | `.mv-btn .mv-btn-ghost` (+ `.mv-btn-block` for the OAuth row) |
| 495–523 `.mva-input` | input copy; `--mv-radius-field` alias; focus `outline-offset: 1px; border-color: transparent` differs from the field grammar | `.mv-field-input` (promoted); delete the local focus rule |
| 530–547 `.mva-toggle` | icon-button copy | `.mv-icon-btn` |
| 573–608 `.mva-submit` | copper button copy (52 px) | `.mv-btn .mv-btn-primary .mv-btn-block` |
| 723–737 `.mva-link-btn`, 299–305 `.mva-banner-link`, 483–491 `.mva-label-link` | copper text-link copies | `.mv-link` |
| 229–239 `.mva-title`, 681–692 `.mva-check-title`, 772–780 `.mva-modal-title` | condensed title copies | `.mv-section-title` scale override / `.mv-h3` |
| 190–201 `.mva-main` | `padding: 64px 120px` — a gutter no other surface uses | `64px 40px` with `max-width` on `.mva-stack` doing the centring |
| 596–598 `.mva-submit:disabled`, same in `pro.css:629` | identical disabled recipe in two files | add `.mv-btn:disabled` to design-system.css |

### `app/welcome/welcome.css`

| line/selector | issue | exact fix |
|---|---|---|
| 14–26 `.wl-page`, `::selection` | root grammar copy | `.mv-root` |
| 48, 175 `.wl-brand`, `.wl-continue` | `border-radius: 4px` "focus radius" on text links | remove (outline follows the box; 44 px inline-flex links take `--mv-radius-control` if a radius is wanted) |
| 54 `.wl-brand-mark` | `7px` | `var(--mv-radius-small)` |
| 164–182 `.wl-continue` | copper link copy | `.mv-link` |
| 277–300 `.wl-get` | copper button copy (56 px) | `.mv-btn .mv-btn-primary .mv-btn-block` |
| 214–221 `.wl-card-title` | condensed 30 px title | `.mv-h3` |
| 368 `.wl-card .mvg-qr--spotlight` | `border-radius: 14px` | `var(--mv-radius-card)` |
| 75–86 `.wl-main` | `96px 48px` desktop / `40px 16px` phone — gutters 48 and 16 | `96px 40px` / `40px 20px` |
| 267 `.wl-signin--box` | `13.5px` | `14px` |

### `app/pro/pro.css`

| line/selector | issue | exact fix |
|---|---|---|
| 78–85 `.mvp-h2` | `.mv-h2` copy | `.mv-h2` |
| 108–115 `.mvp-link`, 510–523 `.mvp-back`, 605–620 `.mvp-alert-action` | copper link copies | `.mv-link` |
| 178–224 `.mvp-seg`, `.mvp-seg-btn` | segmented copy; inner radius `9px` | `.mv-segmented` |
| 290–295, 716–721 `.mvp-card .mv-btn`, `.mvp-actions .mv-btn`, 622–627 `.mvp-pay` | three identical full-width overrides | `.mv-btn-block` |
| 629–633 `.mvp-pay:disabled` | disabled recipe copy | `.mv-btn:disabled` (shared) |
| 586–603 `.mvp-alert` | identical to `.mva-banner` (auth-ui.css 273–288) | promote ONE `.mv-alert` to design-system.css |
| 691–705 `.mvp-unlocked`, 265–288 `.mvp-benefits`, 543–572 `.mvp-summary-row` | hairline row lists | `.mv-rows` / `.mv-defs` |
| 352–437 `.mvp-compare` | spec table copy of `.mv-table` with a card-wrapped Pro column | `.mv-table` + `.is-pro` column modifier |
| 11–64 `.mvp-section--*` | six bespoke vertical paddings (150/96, 32/112, 128, 128, 24/160, 140/140) | map to `.mv-section-hero`, `.mv-section-inner`, `.mv-section-cta`; keep at most one local override |

### `app/(community)/garage/garage.css`

| line/selector | issue | exact fix |
|---|---|---|
| 139, 314, 393, 470, 488, 528 `.prof-banner-manage`, `.prof-person`, `.app-hint`, `.nav-brand`, `.nav-link`, `.nav-upgrade` | `border-radius: 4px` focus radius ×6 | remove; 44 px inline-flex controls take `var(--mv-radius-control)` (as `.nav-icon-btn` already does) |
| 281 `.prof-tab` | `border-radius: 8px` inside the track | `.mv-segmented` |
| 416 `.skeleton` | `8px` | `var(--mv-radius-control)` |
| 125–151 `.prof-banner-manage`, 384–411 `.app-hint`, 518–533 `.nav-upgrade` | copper link copies | `.mv-link` |
| 268–295 `.prof-tabs`, `.prof-tab` | segmented copy | `.mv-segmented` |
| 536–553 `.nav-icon-btn` | identical to `.mv-icon-btn` | `.mv-icon-btn` |
| 605–623 `.nav-signout-btn`, 738–752 (garage-view) `.gv-retry` | ghost copies | `.mv-btn .mv-btn-ghost` |
| 296–305 `.prof-list` | hairline list | `.mv-rows` |
| 456–459 `.community-nav :focus-visible` | focus copy, offset 3 | `.mv-root` on `.garage-page` / `.gv-page` |
| 10–31 `.garage-page` | `40px 16px` / `48px 32px` gutters | `40px 20px` / `48px 40px` |
| 456–459 `.community-nav`, 10 `.garage-page` | font/antialias/colour re-declared | `.mv-root` |

### `app/(community)/garage/garage-view.css`

| line/selector | issue | exact fix |
|---|---|---|
| 346 `.gv-thumb-photo` | `10px` | `var(--mv-radius-control)` (40 px tile) |
| 509, 515 `.gv-cat-track`, `.gv-cat-fill` | `2px` literal | `var(--mv-radius-track)` |
| 904 `.gv-preview-bar` | `6px` | `var(--mv-radius-track)` |
| 144–151 `.gv-h2` | section title in the **body** face at 20 px — the only surface whose H2 is not condensed | `.mv-h3` (display 600) or document as the signed-in exception |
| 423–432 `.gv-lead-title`, 790–800 `.gv-start-title` | condensed title copies | `.mv-h3` / `.mv-h2` |
| 180–223 `.gv-rows`, `.gv-row`, 332–340 `.gv-thumb`, 492–501 `.gv-cat` | hairline row lists | `.mv-rows` |
| 684–693 `.gv-linkbtn` | copper link-as-button | `.mv-link` |
| 42–81 `.gv-page` | `28px 16px` / `40px 32px` / `48px 48px` — three gutters | `32px 20px` / `40px 40px` / `48px 40px` |

### `components/garage-ui/garage-ui.css` (+ `primitives.tsx`)

| line/selector | issue | exact fix |
|---|---|---|
| 18–27, 52–55 `.mvg-scope` focus/selection, `.mvg-link:focus-visible` | root grammar copy, offset 3 | `.mv-root`; delete the per-link focus |
| 59–64 `.mvg-serif` + `primitives.tsx:124` | deprecated serif alias name | rename to `.mv-display` (class already exists) and delete |
| 41, 280, 397 `.mvg-link`, `.mvg-linkfield-url`, `.mvg-reason--promoted` | `border-radius: 4px` | remove |
| 179 `.mvg-qr--hero` | `14px` | `var(--mv-radius-card)` |
| 261 `.mvg-linkfield` | `--mv-radius-field` alias | `var(--mv-radius-control)` |
| 30–51 `.mvg-link`, 388–393 `.mvg-reason-cta` | copper link copies | `.mv-link` |
| 286–314 `.mvg-copy`, 427–457 `.mvg-store-btn` | ghost + copper button copies | `.mv-btn .mv-btn-ghost` / `.mv-btn-primary` (`.mv-btn-block` for the 52 px store rows) |
| 589–621 `.mvg-bar-open`, `.mvg-bar-dismiss` | copper button + icon button copies | `.mv-btn .mv-btn-primary` / `.mv-icon-btn` |
| 495–503 `.mvg-handoff-title` | condensed 30 px title | `.mv-h3` |
| 340–363 `.mvg-reasons`, `.mvg-reason` | hairline row list | `.mv-rows` |
| 70–85 `.mvg-eyebrow` | name says eyebrow (banned concept) though the style is a sentence-case caption | rename `.mvg-caption`; `.mvg-eyebrow--copper` colours a label copper (copper is a verb) → `--mv-ink-2` |
| 89–96 `.mvg-card` | card with a hairline border; `.mv-read-cta`/`.mvp-card`/`.xp-tile` cards are borderless surface steps | drop the `border` (the ramp is the shadow) |

### `components/marketing/navbar.tsx` (inline CSS)

| line/selector | issue | exact fix |
|---|---|---|
| 89 `.mv-nav-brand img` | `border-radius: 9px` | `var(--mv-radius-small)` |
| 195–210 `.mv-nav-icon` | identical to `.mv-icon-btn` | `.mv-icon-btn` |
| 229–240 `.mv-nav-cta` | copper button copy | `.mv-btn .mv-btn-primary` (`.is-compact`) |
| 213–227 `.mv-nav-signin` | ink text link with copper hover — fine, but duplicates `.mv-nav-link` | merge into `.mv-nav-link` |

### `components/marketing/compare-page.tsx` (inline CSS)

| line/selector | issue | exact fix |
|---|---|---|
| 115 `.mv-cmp-page ::selection` | **copper** selection — every other surface uses ink/bg | delete (inherits `.mv-marketing`) |
| 116 `:focus-visible` | offset 3 + `border-radius: 4px` | delete (root ring applies) |
| 119–121 `.mv-cmp-h1/h2/h3` | title copies | `.mv-section-title` / `.mv-h2` / `.mv-h3` |
| 129, 147 `.mv-cmp-figure`, `.is-figure` | `.mv-figure` copies at weight 500 | `.mv-figure` |
| 130–133 `.mv-cmp-link` | copper link copy | `.mv-link` |
| 134–139 `.mv-cmp-crumbs` | breadcrumb copy | `.mv-crumbs` |
| 140–152 `.mv-cmp-table` | `.mv-table` copy (13 px padding) | `.mv-table` |
| 156–160 `.mv-cmp-list`, `.mv-cmp-faq` | hairline list / FAQ copies | `.mv-rows` / `.mv-read-faq` |

### `components/cookie-consent.tsx` (inline CSS)

| line/selector | issue | exact fix |
|---|---|---|
| 242 `.mv-cc :focus-visible` | focus copy | delete (inside `.mv-marketing`) |
| 295–298 `.mv-cc-primary`, `.mv-cc-ghost` | copper + ghost button copies (ghost here is transparent with `--mv-field-line`, a third ghost recipe) | `.mv-btn .mv-btn-primary` / `.mv-btn-ghost` |
| 349–355 `.mv-cc-sheet-title` | condensed 26 px title | `.mv-h3` |
| 398 `.mv-cc-switch` | `border-radius: 13px` pill (44×26 switch) | `999px` is correct for a switch — add `--mv-radius-pill: 999px` to the tokens and use it; this is the one legitimate pill on the site |
| 380 `.mv-cc-row-tag` | `font-weight: 400` declared explicitly | drop (inherits) |

### Other marketing TSX

| file · line | issue | exact fix |
|---|---|---|
| `components/marketing/features-grid.tsx:230, 255, 267, 285`; `diagnostics-demo.tsx:145` | screen/cut corners `35px`, `28px` ×4 — device-chrome depictions on no scale | pick ONE depiction radius token `--mv-radius-screen: 28px` (document as the device-chrome exception next to `.mv-phone-mockup`) |
| `diagnostics-demo.tsx:165` | `--mv-radius-inner` | `var(--mv-radius-control)` |
| `store-buttons.tsx:98–125` `.mv-store-btn`, `.mv-store-primary`, `.mv-store-secondary`, `:focus-visible` | copper + ghost + focus copies (differs from `.mv-footer-store`, a fourth store-button recipe) | `.mv-btn .mv-btn-primary` / `.mv-btn-ghost`; delete the focus rule |
| `sticky-app-bar.tsx:48–80` `.mv-appbar-cta`, `.mv-appbar-dismiss`, `:focus-visible` | copper button, icon button and focus copies | `.mv-btn .mv-btn-primary`, `.mv-icon-btn`; delete the focus rule |
| `faq.tsx:62–63` `.faq-link`; 64 `.faq-item`; 82 `.faq-mark` | link copy; FAQ copy of `.mv-read-faq` | `.mv-link`; `.mv-read-faq` (promote to design-system.css) |
| `language-switcher.tsx:64–67` `:focus-visible` | focus copy | delete |
| `feature-content-page.tsx:314–467, 509–622` (9 sites) | hairline rows and copper links built from inline `style` props | `.mv-rows` / `.mv-defs` / `.mv-link` classes |
| `app/[locale]/(marketing)/features/page.tsx:210–295`; `features/*/page.tsx` | same inline-style rows + copper links | `.mv-rows` / `.mv-link` |
| `manifesto-section.tsx:16` | `padding: '120px 40px'` inline shell | `className="mv-section-inner"` |
| `app/[locale]/(marketing)/layout.tsx:77` skip link | `focus:rounded-lg` (8 px) | `focus:rounded-[var(--mv-radius-control)]` |
| `app/[locale]/(marketing)/error.tsx:14, 26`; `app/error.tsx:18`; `app/not-found.tsx`; `app/[locale]/not-found.tsx:12` | `140px 40px 96px` / `110px 24px 64px` / `120px 40px 80px` / `100px 24px 64px` — four hero-ish shells | `.mv-section-hero` (180/40/100 → 120/20/60) |
| `app/not-found.tsx:45–56` `.nf-btn`, `.nf-btn-ghost` | ghost copy | `.mv-btn .mv-btn-ghost` |
| `app/not-found.tsx:59–67` `.nf-link` | hairline row list | `.mv-rows` |
| `app/get/page.tsx:79` `brandMark` | `borderRadius: 7` | `var(--mv-radius-small)` |
| `app/get/page.tsx:105–109` `noteLink` | copper link via style prop | `.mv-link` |
| `app/get/page.tsx:63` `main` | `64px 24px` | `64px 40px` desktop / phone 20 via class |

### Root-only pages outside the Trackside build

| file · line | issue | exact fix |
|---|---|---|
| `app/u/[handle]/layout.tsx:25–93` | 25 Tailwind palette classes (`bg-neutral-50`, `from-neutral-950`, `text-white`, `border-neutral-200`, …), `rounded-xl` buttons in `bg-neutral-900` — the old world, both schemes broken | rebuild on `.mv-marketing` + `.sp`: header `var(--mv-bg-2)`, footer `.mv-footer` grammar, buttons `.mv-btn .mv-btn-primary` / `.mv-btn-ghost` |
| `components/guides/trip-card.tsx:34–43` | `rounded-xl border-neutral-800 bg-neutral-900/60 hover:border-amber-500/40`, `bg-amber-500/10`, `text-amber-400`, `text-neutral-100/500` | one `.mv-rows` row: surface step on hover, `--mv-ink` / `--mv-ink-3`, arrow in `--mv-copper-text`; no icon tile |
| `app/rider/[username]/opengraph-image.tsx:29–85`, `app/ride/[id]/opengraph-image.tsx:37–97` | old blue gradients (`#0a1540 → #3366e6`), `#3cb88c`, `rgba(255,255,255,…)` ×8 — Satori cannot read CSS vars but can read JS | import `palette` from `@motovault/design-system`: `plateG0` ground, `plateBone` ink, `plateCopper` figures; condensed face via the loaded font buffer |

### Type checks (category 5) — summary row

| file | result |
|---|---|
| all 12 CSS files + inline CSS | every `--mv-font-display` rule carries weight 500/600/700 — no unloaded Barlow weight anywhere; body weights stay 400–700 |
| `trip-detail-map.tsx:271–283`, `mapbox-map.tsx:141` | the only letter-spaced uppercase (`0.06em`) and the only mono labels (pin numbers, tag strip) — fixed in the rows above |
| `trackside-read.css:226` `.mv-read-body em { font-style: italic }` | prose emphasis, not display — allowed |

### Focus / selection / scrollbar (category 6) — summary

| treatment | declarations | fix |
|---|---|---|
| `::selection` | `design-system.css:25` (ink/bg), `welcome.css:23`, `auth-ui.css:25`, `garage-ui.css:24` (same), `compare-page.tsx:115` (**copper/on-copper**) | one `.mv-root ::selection`; delete the four copies |
| `:focus-visible` | `design-system.css:35` (copper, offset 2); offset **3** in `auth-ui.css:39`, `garage.css:456`, `garage-ui.css:18–55`, `compare-page.tsx:116` (+ radius 4); copper offset 2 copies in `cookie-consent.tsx:242`, `store-buttons.tsx:115`, `sticky-app-bar.tsx:81`, `language-switcher.tsx:64`; **ink** ring on `explore.css:725`; inset box-shadow ring on `explore.css:619`; `auth-ui.css:519` offset 1 + transparent border | one `.mv-root :focus-visible { outline: 2px solid var(--mv-focus); outline-offset: 2px }`; delete all local copies |
| scrollbar hide | `design-system.css:946–948`, `explore.css:403–408`, `trip-detail.css:216–221` | `.mv-scroll-row` |

## Proposed shared classes (add to `design-system.css`)

Tokens to add in `mv-tokens.css` first: `--mv-radius-small: 6px`, `--mv-radius-track: 2px`, `--mv-radius-pill: 999px`,
`--mv-radius-screen: 28px`; then delete `--mv-radius-field`, `--mv-radius-inner`, `--mv-radius`.

```css
/* ── Root grammar: every Trackside surface (marketing, auth, welcome, garage, share) ── */
.mv-root {
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
  background: var(--mv-bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.mv-root ::selection { background: var(--mv-ink); color: var(--mv-bg); }
.mv-root :focus-visible { outline: 2px solid var(--mv-focus); outline-offset: 2px; }
/* .mv-marketing keeps its name and adds overflow-x: hidden; mark it up as `mv-root mv-marketing`. */

/* ── Button modifiers (the base .mv-btn / .mv-btn-primary / .mv-btn-ghost stay as they are) ── */
.mv-btn-block { width: 100%; justify-content: center; padding: 16px 22px; font-size: 15px; }
.mv-btn.is-compact { min-height: 36px; padding: 0 16px; font-size: 13px; }
.mv-btn:disabled,
.mv-btn[aria-disabled='true'] {
  cursor: not-allowed;
  translate: 0 0;
  scale: 1;
}
.mv-btn-primary:disabled {
  background: color-mix(in oklch, var(--mv-copper) 60%, var(--mv-bg));
  color: color-mix(in oklch, var(--mv-on-copper) 80%, transparent);
}
.mv-btn-ghost:disabled { color: var(--mv-ink-3); background: var(--mv-surface-2); }
.mv-btn[aria-busy='true'] { cursor: progress; }

/* ── Text link (ONE definition; replaces the trackside-read copy) ── */
.mv-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 500;
  color: var(--mv-copper-text);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: var(--mv-copper-border);
  cursor: pointer;
  transition: color 0.2s, text-decoration-color 0.2s;
}
.mv-link:hover { color: var(--mv-copper-hover); text-decoration-color: currentColor; }
.mv-link.is-quiet { text-decoration: none; }           /* action links in rows and nav */
.mv-link.is-quiet:hover { text-decoration: underline; }
.mv-link.is-tall { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
.mv-link:disabled { color: var(--mv-ink-3); cursor: progress; text-decoration: none; }

/* ── H3-scale condensed title (sub-section, card, sheet) ── */
.mv-h3 {
  margin: 0;
  font-family: var(--mv-font-display);
  font-weight: 600;
  font-size: 30px;
  line-height: 1.05;
  letter-spacing: 0.002em;
  color: var(--mv-ink);
  text-wrap: balance;
}

/* ── Segmented control: raised track, selection one step higher, never copper ── */
.mv-segmented {
  display: inline-flex;
  gap: 2px;
  margin: 0;
  padding: 2px;
  border: 0;
  border-radius: var(--mv-radius-control);
  background: var(--mv-surface-2);
}
.mv-segmented > button,
.mv-segmented > a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: calc(var(--mv-radius-control) - 2px);
  background: transparent;
  color: var(--mv-ink-2);
  font-family: var(--mv-font-body);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s var(--mv-ease), color 0.15s var(--mv-ease);
}
.mv-segmented > :hover { color: var(--mv-ink); }
.mv-segmented > [aria-pressed='true'],
.mv-segmented > [aria-selected='true'],
.mv-segmented > [aria-current] {
  background: var(--mv-surface-3);
  color: var(--mv-ink);
  font-weight: 600;
}

/* ── Field: label wrapper + input (promoted from trackside-read.css) ── */
.mv-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.mv-field > label,
.mv-field > span { font-size: 15px; font-weight: 500; line-height: 1.4; color: var(--mv-ink-2); }
.mv-field-hint { font-size: 14px; color: var(--mv-ink-3); }
.mv-field-error { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--mv-overdue-ink); }
.mv-field-input {
  width: 100%;
  min-width: 0;
  height: 48px;
  box-sizing: border-box;
  padding: 0 14px;
  border-radius: var(--mv-radius-control);
  border: 1px solid var(--mv-field-line);
  background: var(--mv-surface-2);
  color: var(--mv-ink);
  caret-color: var(--mv-copper);
  font-family: var(--mv-font-body);
  font-size: 16px;          /* never below 16: iOS Safari zooms */
  line-height: 1;
  appearance: none;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.mv-field-input::placeholder { color: var(--mv-ink-3); opacity: 1; }
.mv-field-input:hover:not(:disabled) { border-color: var(--mv-line-step); }
.mv-field-input:focus-visible { border-color: var(--mv-copper); outline: 2px solid var(--mv-copper); outline-offset: 2px; }
.mv-field-input[aria-invalid='true'] { border-color: var(--mv-overdue-ink); }
.mv-field-input:disabled { color: var(--mv-ink-3); }
.mv-field-input.is-tall { height: 52px; }   /* phone auth fields */
.mv-select { position: relative; }
.mv-select .mv-field-input { padding-right: 44px; cursor: pointer; }
.mv-select > svg { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--mv-ink-3); }

/* ── Hairline row list (promoted + generalised from .mv-rows) ── */
.mv-rows { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--mv-line); }
.mv-rows.is-open { border-top: 0; }                       /* no rule at the top (garage, pro cards) */
.mv-rows > li,
.mv-rows > .mv-row { border-bottom: 1px solid var(--mv-line); }
.mv-rows.is-open > :last-child { border-bottom: 0; }
.mv-row,
.mv-rows > li > a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 12px 0;
  color: var(--mv-ink);
  text-decoration: none;
  border-radius: 0;
  transition: color 0.2s;
}
.mv-row-title { font-size: 16px; font-weight: 500; line-height: 1.4; color: var(--mv-ink); transition: color 0.2s; }
.mv-row-sub { display: block; margin-top: 4px; font-size: 14px; line-height: 1.5; color: var(--mv-ink-3); }
.mv-row-aside { flex-shrink: 0; font-size: 14px; color: var(--mv-ink-3); white-space: nowrap; text-align: right; }
.mv-row-aside.mv-figure { font-size: 17px; color: var(--mv-ink-2); }
a.mv-row:hover .mv-row-title,
.mv-rows > li > a:hover { color: var(--mv-copper-text); }
.mv-row svg { flex-shrink: 0; color: var(--mv-ink-4); transition: color 0.2s, transform 0.2s var(--mv-ease); }
a.mv-row:hover svg { color: var(--mv-copper-text); transform: translateX(2px); }

/* ── Breadcrumb (promoted from trackside-read.css, unchanged) ── */
.mv-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 0 0 28px; padding: 0; list-style: none; font-size: 14px; line-height: 1.4; color: var(--mv-ink-3); }
.mv-crumbs li { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.mv-crumbs a { color: var(--mv-ink-3); text-decoration: none; transition: color 0.2s; }
.mv-crumbs a:hover { color: var(--mv-ink); }
.mv-crumbs svg { color: var(--mv-ink-4); flex-shrink: 0; }
.mv-crumbs [aria-current='page'] { color: var(--mv-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 42ch; }

/* ── Chip (promoted; radius corrected to the control scale) ── */
.mv-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mv-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--mv-radius-control);
  border: 1px solid var(--mv-line);
  background: var(--mv-surface-2);
  color: var(--mv-ink-2);
  font-family: var(--mv-font-body);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.mv-chip:hover { background: var(--mv-surface-3); border-color: var(--mv-line-step); color: var(--mv-ink); }
.mv-chip[aria-pressed='true'],
.mv-chip[data-active='true'] { border-color: var(--mv-copper); color: var(--mv-copper-text); }
.mv-chip.is-tall { min-height: 44px; }    /* explore filter chips */

/* ── Alert (auth banner + pro alert; overdue ink on the danger tint, never copper) ── */
.mv-alert {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--mv-radius-control);
  background: var(--mv-danger-tint);
  border: 1px solid var(--mv-danger-border);
  font-size: 14px;
  line-height: 1.45;
  color: var(--mv-ink);
}
.mv-alert > svg { color: var(--mv-overdue-ink); margin-top: 1px; }
.mv-alert p { margin: 0; }

/* ── Horizontal scroll row without a visible scrollbar (strips, tab bars, filter rows) ── */
.mv-scroll-row { overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.mv-scroll-row::-webkit-scrollbar { display: none; }
```

Apply order that keeps the site rendering at every step: (1) tokens + `design-system.css` additions (owner); (2) delete
the `.mv-link` copy and promote the five blocks out of `trackside-read.css`; (3) one apply agent per file group above,
replacing local classes with the shared ones and deleting the local CSS; (4) `globals.css` cleanup last, after
`gpx-download-button.tsx` has taken its keyframes.
