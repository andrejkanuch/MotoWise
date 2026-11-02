# it3 · colorize lens — web Race Plate (both schemes)

Research only. Ratios computed with the WCAG 2.x formula from `packages/design-system/src/mv-tokens.css` (alpha tokens blended onto their ground). Rendered DOM read from the running dev server (`curl localhost:3000`). Floors: 4.5:1 text <24px, 3:1 display ≥24px and glyphs/bars/borders.

## 1. Contrast table (pair · dark · light · verdict)

| Pair | Dark | Light | Verdict |
|---|---|---|---|
| ink-2 on bg / surface / surface-2 / surface-3 | 9.49 / 8.72 / 7.86 / 6.69 | 8.42 / 9.43 / 7.77 / 6.82 | pass |
| ink-3 on bg | 5.46 | 4.68 | pass |
| ink-3 on surface | 5.01 | 5.24 | pass |
| ink-3 on surface-2 and bg-2 | 4.52 | **4.32** | light FAIL (placeholders, bg-2 band meta, map-popup notes) |
| ink-3 on surface-3 | **3.85** | **3.79** | FAIL as text (explore selected option kind); pass as glyph |
| ink-4 on bg / surface / surface-2 | **2.82 / 2.59 / 2.33** | **2.42 / 2.71 / 2.23** | FAIL even the 3:1 glyph floor — must never be text |
| copper-text on bg / surface / surface-2 / surface-3 | 7.45 / 6.85 / 6.17 / 5.26 | 5.34 / 5.98 / 4.93 / **4.32** | light fails only on surface-3 (active chip hovered) |
| copper-text on copper-tint (10%) | 6.76 | 4.70 | pass |
| copper (fill) on bg / surface-2 | 4.99 / 4.13 | 4.46 / 4.12 | fine as a fill; never use `--mv-copper` as text |
| on-copper on copper / copper-hover | 4.94 / 6.11 | 4.99 / 5.98 | pass (light white-on-copper was the right call; plate-ink would be 3.72) |
| `.mv-btn-primary:disabled` text on its mixed fill | **2.21** | **2.22** | exempt but illegible |
| due-ink on bg / surface / surface-2 / danger-tint | 11.2 / 10.3 / 9.26 / 10.5 | 4.67 / 5.22 / **4.30 / 4.17** | light fails off the page ground |
| overdue-ink on bg / surface / surface-2 / surface-3 | 4.75 / **4.36 / 3.93 / 3.35** | 4.69 / 5.25 / **4.33 / 3.80** | FAIL on every raised step |
| overdue-ink on danger-tint (over bg / over surface) | **4.45 / 4.04** | **4.19** / 4.67 | FAIL inside `.mv-alert` |
| go on bg / surface / surface-2 | 7.27 / 6.68 / 6.02 | **3.84 / 4.30 / 3.54** | light FAIL for every green word |
| info on bg / surface / surface-2 | 6.79 / 6.24 / 5.62 | 4.97 / 5.56 / 4.58 | pass (unused as text today) |
| plate-ink on bone / signal / red | 14.96 / 11.10 / 4.71 | same | pass; red plate has no headroom |
| plate-ink 68% (edge identity, 13px) on bone / signal / red | 5.81 / 5.10 / **3.19** | same | FAIL on the overdue plate |
| ink-3 progress fill on surface-2 track | 4.52 | 4.32 | pass (3:1 bar) |
| ink-4 spend bars on bg | **2.82** | **2.42** | FAIL 3:1 bar |
| surface on bg (card lift) | 1.09 | 1.12 | the ramp step; needs a hairline where the card edge carries meaning |
| line (9–10%) on bg / surface | 1.22 / 1.25 | 1.22 / 1.23 | separators only |
| field-line (16/18%) on bg · field fill surface-2 on bg | **1.51 · 1.21** | **1.46 · 1.08** | FAIL 1.4.11 input boundary (3:1) |
| copper route on dark-v11 ground (#1a1a1a) / light-v11 (#f2efea) | 4.63 | plateCopper 3.28, plateLightCopper 4.35 | pass; prefer light copper on a light map |
| hubCat* day lines on a light map ground | — | **1.5–2.2** | would FAIL if the map goes light; use plateLightCat* |

## 2. Findings by file (file · line · issue · exact fix)

### packages/design-system/src/mv-tokens.css (owner-only) — see "Token changes".

### apps/web/src/components/marketing/design-system.css (owner-only)
| Line | Issue | Fix |
|---|---|---|
| 367–370 | disabled primary: text 2.2:1 on the 60% copper mix | `.mv-btn-primary:disabled { background: var(--mv-copper); color: var(--mv-on-copper); opacity: .5; }` — the dim is the whole control, the intra-button pair stays 4.9 |
| 483 | placeholder ink-3 on surface-2 field: light 4.32 | token 2 (light ink-3) |
| 518 | `.mv-row svg` chevron ink-4: 2.8 / 2.4, below the 3:1 glyph floor | token 1, or `color: var(--mv-ink-3)` |
| 551 | active chip + hover = copper-text on surface-3: light 4.32 | `.mv-chip[data-active='true']:hover { background: var(--mv-surface-2); }` |
| 561–567 | `.mv-alert` text is ink (ok); icon overdue on tint 4.2–4.5 is fine as a glyph; the **13px `.mv-field-error` (464) inside `.mva-check`/cards** is overdue on surface 4.36 dark | token 3 |
| 714–718 | `.mv-plate-edge-identity` plate-ink at 68% on the red plate: 3.19 at 13px | `.mv-plate[data-state='overdue'] .mv-plate-edge-identity { color: var(--mv-plate-ink); }` (4.71) |
| 1078–1092, 1103–1125 | the navbar-over-hero and `.mv-dark-scene` blocks redeclare the dark tokens; they must track every token change below (1113 ink-4, 1122–1123 due/overdue) | update the four values in both blocks in the same commit as the token file |

### apps/web/src/components/marketing/bike-plate.tsx (owner-only)
| 31–37 | state is colour only (`data-state`); the caption is free text, no guaranteed word for ready / due soon / overdue (colorblind + sunlight) | render `<span className="sr-only">{STATE_WORD[state]}</span>` after the caption and set `aria-label` on the plate; pages that pass a caption should name the state in it ("Service due in 300 km") |

### apps/web/src/components/marketing/hero.tsx
| 136 | 6px **go** dot before "Free · iOS + Android" — nothing succeeded; status colour as decoration (Rule 2 spirit, "never decoration") | delete the dot, or `background: 'var(--mv-ink-3)'` |

### apps/web/src/components/marketing/diagnostics-demo.tsx
| 100 | `.diag-step-num` ink-4 as 20px text (2.8 / 2.4) | `color: var(--mv-ink-3)` |
| 127 | go dot beside "Scan complete" inside the depicted screen | ok — a real depicted status |

### apps/web/src/components/marketing/compare-page.tsx
| 150 | `.mv-cmp-meta` ink-4 as 13px text | `color: var(--mv-ink-3)` |
| 165–166 | yes = ink check (2.5 stroke), partial = ink-3 minus, no = ink-3 X, each with `sr-only` label | ok — shape + text, not colour |
| 175 | `.mv-cmp-card` white on #f3f2ef (1.12) with no hairline: the card disappears in light | add `border: 1px solid var(--mv-line);` (the section's one card) |
| index page | 40 `.mv-link`s in one list (/compare) and 20 on /bikes: copper 3+ per viewport, the verb loses rarity | directory rows on the `.mv-rows` grammar in ink, copper on hover only |

### apps/web/src/components/marketing/trackside-read.css
| 203, 330, 409 | list markers and chevrons in ink-4 (< 3:1) | token 1 |
| 1078 | `.mv-tool-results` white sticky panel, no hairline (light 1.12) | add `border: 1px solid var(--mv-line);` |
| 1215, 1231, 1248, 1285, 1301 | go as 13–20px text: light 3.84 on bg | token 4 |
| 1260–1264 | progress fill ink-3 → go when done | ok (3:1 bar; "done" is a real state) |
| 1281 | `.mv-check-letter` ink-4 at 40px: 2.82 / 2.42 < 3:1 display floor | `color: var(--mv-ink-3)` |

### apps/web/src/app/[locale]/(marketing)/tools/tclocs-checklist/tclocs-checklist.tsx
| 311 | "0s" figure in ink-4 (28px, 2.8 / 2.4) | `color: 'var(--mv-ink-3)'` |

### apps/web/src/app/[locale]/(marketing)/features/*
| garage-management/page.tsx 42–43 | go / due-ink inside the depicted service table: semantics ok; "Done" in light go on bg = 3.84 | token 4 |
| learning-paths/page.tsx 52 | "Read" in go, 15px inside a surface card: light 4.30 | token 4 |
| ai-diagnostics/page.tsx 83 | "Moderate" in due-ink inside the depiction | ok (10.3 / 5.22) |
| page.tsx 207 | `.mv-row-sub` ink-3 on the bg-2 band: light 4.32 | token 2 |
| page.tsx hero + both row sections | no copper verb until the closing CTA (two viewports); rows are ink, copper only on hover | give the hero the primary store button (Persuade page) or end each group with one `.mv-link` |

### apps/web/src/components/marketing/feature-content-page.tsx · feature-cta.tsx · features-grid.tsx
| feature-cta.tsx 63 | 13px ink-3 social proof on bg-2: light 4.32 | token 2 |
| features-grid.tsx 188, 215, 234 | `.fx-muted / .fx-proof / .fx-figure-label` ink-3 inside `.fx-band` (bg-2): light 4.32 | token 2 |
| features-grid.tsx (whole) | **no `href` in the file**: home sections 2–5 (manifesto, proof row, features grid, diagnostics band) carry zero verbs for ~3 viewports | one `.mv-link` per `.fx-block` to its feature page; one link in the diag band to /features/ai-diagnostics |
| feature-content-page.tsx 334–420 | hero + bg-2 steps band: no verb for two viewports on every feature page | hero gets `.mv-btn.mv-btn-primary` (store) + `.mv-btn-ghost` |

### apps/web/src/app/pro/pro.css · page.tsx
| 145, 475 | `.mvp-card`, `.mvp-summary` white on paper, no hairline | `border: 1px solid var(--mv-line)` |
| page.tsx sections features/compare/FAQ | 3 sections (~2 viewports) with no verb between the hero and the final CTA | one `.mv-link` "Start the free trial" under the compare table |

### apps/web/src/app/(community)/garage/garage-view.css · garage-ui.css · welcome.css
| garage-view.css 462 | `.gv-cat-fill` spend bars in ink-4: 2.82 / 2.42 < 3:1 | `background: var(--mv-ink-3)` (5.46 / 4.68); keep ink-2 for the top category |
| garage-view.css 199–212 | overdue = triangle + word in overdue-ink on bg (4.75 / 4.69) | ok; token 3 lifts it further |
| garage-ui.css 43, welcome.css 133 | `.mvg-card`, `.wl-card` white on paper, no hairline | `border: 1px solid var(--mv-line)` |
| garage-ui.css 317 | promoted reason icon in copper-text | ok — the whole row is one link |

### apps/web/src/components/explore/mapbox-map.tsx · trip-detail/trip-detail-map.tsx
| mapbox-map.tsx 108, trip-detail-map.tsx 134 | `mapbox://styles/mapbox/dark-v11` hardcoded: a dark map in every light page | `const { resolvedTheme } = useTheme()` (providers/theme-provider.tsx:91); `style: resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'`; on change `map.setStyle(next)` and re-add sources/layers in `map.once('style.load')` |
| trip-detail-map.tsx 27–36 | `DAY_COLORS` are the dark hub hues (1.5–2.2 on a light map) | pick the set by scheme: `palette.hubCat*` dark, `palette.plateLightCat*` light; route `palette.plateCopper` dark / `palette.plateLightCopper` light (4.35) |
| trip-detail-map.tsx 287 | popup notes ink-3 on surface-2: light 4.32 | token 2 |
| mapbox-map.tsx 180–182, trip-detail-map.tsx 235–237 | copper only on the hovered/focused pin | ok — selection |

### apps/web/src/components/explore/explore.css
| 566–582 | selected option: ink-3 `.xp-option-kind` on surface-3 (3.85 / 3.79) | `.xp-option[aria-selected='true'] .xp-option-kind { color: var(--mv-ink-2); }` |
| 245 | `.xp-tile` white on paper, no hairline | `border: 1px solid var(--mv-line)` |

### apps/web/src/components/gpx-download-button.css · share-page.css · auth-ui.css · cookie-consent.tsx
| gpx 59–61 | toast error text overdue-ink on **surface-3**: 3.35 / 3.80 | text stays `--mv-ink`; prefix an icon in overdue-ink (3:1 glyph) |
| share-page.css 328 | `.sp-status-done` go 15px on bg: light 3.84 | token 4 |
| auth-ui.css 84–118 | fixed plate-ink scrim + plate-bone text over the dusk photo in both schemes | ok (not a dark-scene; the plate keyline lands on a dark photo — harmless) |
| cookie-consent.tsx 403 | go check icon on surface-2 (light 3.54) | ok as a glyph |

### Semantics summary (Rule 1 / Rule 2)
- Copper: every use is a button, link, selection (active pin, chip, radio, checkbox, nav dot), caret/focus, the plate stripe, or an activity ring (`.mv-loader`, `prof-spinner`, `globals.css:37` nav-progress) — no status, no gradient text, no glow. Clean.
- Triad/go/info: only inside depictions or on real page states, except **hero.tsx:136** (decorative go dot).

### 3. Monochrome dead zones (rendered DOM, dark and light alike)
- Home: sections 2–5 have 0 verbs (features-grid has no links). /features: hero + 2 row sections. Every /features/*: hero + steps band. /pro: 3 middle sections. Fix per file above.
- Copper 3+ in one viewport: /compare and /bikes link walls; mobile closing CTA + sticky app bar (`sticky-app-bar.tsx`) + cookie banner can show three copper buttons at once — hide the sticky bar while `#download` is in view.

### 4. Data colour rule (proposed for the web)
Charts are monochrome: leading series `--mv-ink-2`, the rest `--mv-ink-3` (never ink-4: < 3:1), track `--mv-fill`/`--mv-surface-2`. Copper on a map marks only the rider's own ridden trace or the selected pin. go/overdue only when the bar is itself a status (TCLOCS done). Category hues are allowed only beside the category name and only once both scheme sets exist as tokens (`--mv-cat-*` from `palette.hubCat*` / `plateLightCat*`, all ≥3:1 on their ground) — not tokenised today, so garage bars stay monochrome. The cost-calculator result is already monochrome and compliant.

### 5. Colourblind / sunlight
Plates: state in colour only until bike-plate.tsx carries the word (above). Table marks: shape + sr-only text, ok. Light-scheme plates: ink on signal 11.1, on red 4.71 — readable in sun; the keyline makes bone legible on paper.

### 6. Light-scheme specifics
Seven hairline-less white cards vanish on #f3f2ef (listed per file). Hairlines at 10% are fine as separators; the input boundary is not (token 6). Photos: hero and CTA via `.mv-dark-scene`, explore/blog heroes carry no text, trips hub `.rh-scrim` mixes from `--mv-bg` (scheme-aware), auth panel uses the fixed plate-ink scrim — all ok. Both Mapbox maps stay dark (fix above).

## Token changes (mv-tokens.css; dark → light), max 6

| # | Token | Dark now → new | Light now → new | Why |
|---|---|---|---|---|
| 1 | `--mv-ink-4` | `#5f5c57` → `#716e66` (bg 3.68, surface 3.38, surface-2 3.05) | `#9c9da1` → `#86878b` (bg 3.21, surface 3.59, surface-2 2.96) | glyph/bar floor 3:1; stays non-text |
| 2 | `--mv-ink-3` | unchanged (fix surface-3 uses at the site) | `#6b6c70` → `#606165` (bg 5.52, surface 6.19, surface-2/bg-2 5.10, surface-3 4.47) | every 13–15px ink-3 on a raised step |
| 3 | `--mv-overdue-ink` | `#e5483a` → `#f0675a` (bg 6.06, surface 5.57, surface-2 5.02, tint 5.05) | `#c8352a` → `#b13026` = `palette.plateLightLate` (5.65 / 6.32 / 5.21 / tint 4.99) | fills `--mv-plate-red` unchanged |
| 4 | `--mv-go` | unchanged | `#2e8a55` → `#246e44` = `palette.plateLightOk` (5.54 / 6.20 / 5.11) | every green word in light |
| 5 | `--mv-due-ink` | unchanged | `#8a6700` → `#7a5b00` = `palette.plateLightSoon` (5.64 / 6.32 / 5.21 / tint 5.04) | fills `--mv-plate-signal` unchanged |
| 6 | `--mv-field-line` | `rgba(236,230,218,.16)` → `.38` (3.12:1 on bg) | `rgba(20,21,23,.18)` → `.46` (3.0:1 on bg) | input boundary (WCAG 1.4.11); only inputs and the checklist box use it |

Mirror 1–5 in `palette.plateInk4 / plateLightInk4 / plateLightInk3 / plateRed-as-ink` per the file header ("change them there first"), and copy the dark values into both redeclaring blocks in design-system.css (1078–1125).
