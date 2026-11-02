# Typeset lens — iteration 2 (research only, 2026-10-30)

Scope: `docs/design/web-race-plate-redesign/lens/SCOPE.md`. Method: every `font-size` / `fontSize` / `text-*` / `clamp()` / `font-family` / `font-weight` / `line-height` / `letter-spacing` / `text-transform` / `font-variant-numeric` / `text-wrap` / `max-width` declaration in the 12 in-scope stylesheets and 150 in-scope `.tsx` files was dumped with its selector (380 `font-size` rules in CSS, 122 inline `fontSize`, 13 Tailwind `text-*`), and every `<h1>`/`<h2>`/`<h3>` was mapped to its class. No file other than this report was edited.

## The system today, in one sentence

The faces and weights are right everywhere (Barlow Condensed 500/600/700 for headlines and figures, the system stack for sentences, no uppercase strips, no serif, no italic display), but the **sizes** are a collection: 46 distinct heading sizes, 13 body/meta sizes between 10 and 19.5px, and the canonical `.mv-h2` is used by **zero** `<h2>` elements — every section headline is an inline clone with its own clamp.

## Proposed scale (one modular ramp, web px)

| Role | Size / leading | Face · weight · colour | Class | Used for |
|---|---|---|---|---|
| Display | `clamp(56px, 9.6vw, 150px)` / 0.94 | display 700 | `.hero-headline` | Landing hero only. Nothing else may exceed H1. |
| H1 | `clamp(44px, 5.5vw, 84px)` / 0.96 | display 700, ink | `.mv-section-title` | Every page title: index, explore, compare, pro, trips, share, garage, welcome, auth, /get, errors. The manifesto statement and the final CTA on the landing page may borrow this size (the one "H2 at H1 scale" exception, max one per page). |
| H1-read | `clamp(38px, 5.4vw, 62px)` / 1 | display 700 | `.mv-read-h1` | Article, legal, bike and tool pages (Read). |
| H1-operate | 44px / 0.98 fixed | display 700 | new `.mv-h1-operate` (or `.mv-section-title` capped) | Checkout, auth, garage, results pages — Operate surfaces stay spatially predictable. |
| H2 | `clamp(34px, 4.2vw, 56px)` / 0.98 | display 700, `text-wrap: balance` | `.mv-h2` | Section headlines on Persuade pages (landing, features, compare, pro, trips, explore). |
| H2-read | 34px / 1.05 | display 600, balance | `.mv-read-h2`, `.mv-read-body h2` | Chapter titles, feed titles, tool/CTA titles, share-page sections, modal titles. |
| H3 | 26px / 1.1 | display 600 | `.mv-read-body h3`, `.xp-h3`, `.mv-cmp-h3` | Sub-sections, card and tile titles, the lead bike. |
| Section head | 20px / 1.25 | **body** 600, ink | `.gv-h2` | Operate in-page heads ("Up next", "Your bikes", day titles) — mirrors mobile Section title 20/25. |
| Lede | 18px / 1.55, −0.01em | body 400, ink-2, ≤60ch, `pretty` | `.mv-section-sub`, `.mv-read-lede`, `.mvp-lead`, `.xp-lede` | The one sentence under a title. 17px on phones (`.hero-desc`). |
| Body | 17px / 1.6 | body 400, ink-2, 60–70ch, `pretty` | `.mv-read-body`, `.sp-prose`, `.overview-text` | Reading copy. |
| Body-compact | 16px / 1.55 | body 400 | rows, FAQ answers, inputs, review text | 16 is also the iOS input-zoom floor. |
| Small | 15px / 1.45 | body 400 or 500 | `.mv-table`, meta lines, button labels, plate captions, link lists | The compact text step (mobile Subhead 15/20). |
| Meta | 13px / 18px | body 500, ink-3 | labels, crumbs, footnotes, chips, timestamps | Mobile Label 13/18. **14px is not a step** — it is the most-used off-scale value (≈70 rules) and splits into 15 (readable text) or 13 (labels). |
| Caption | 12px / 16px | body 400, ink-3 | footer legal line, kbd | Mobile Caption 12/16. Nothing under 12. |
| Figure-plate | 64px / 64px | display 600, tabular | `.gv-plate-slot .mv-plate-figure`, `.reviews-score-num`, `.mvp-price-figure` | The one plate figure on a page. 56 on phones. |
| Figure-lg | 40px / 42px | display 600, tabular | `.mv-plate-figure`, stat rows, totals | Mobile plate-compact 40/42. |
| Figure | 28px / 30px | display 600, tabular | tool stats, final price, odometer | Mobile Figure 28/30. |
| Figure-sm | 20px / 22px | display 600, tabular | row figures, chips, hero strip, counts | Mobile small figure 20/22. Figures **inside a sentence** take the sentence's size (1em), never 1.15em. |
| Unit | 0.5× its figure (64→32, 40→20, 28→14, 20→10→use 13) | display 500, ink-2 | `.mv-plate-unit`, `small` in figures, price period | Mobile plate unit 20/22 under 40. |

Tracking: headlines/figures `0.002em` / `0` as today; body `0` (drop the −0.005em/−0.02em sprinkles); ledes may keep −0.01em. Weights: H1/H2 700 on Persuade, 600 on Read/Operate; H3 and figures always 600; units 500. Barlow ships only 500/600/700 and the layout loads exactly those — no missing weight found.

### Steps that are too close today (<1.2×) and what they collapse into

- Body: 17.5 / 17 / 16.5 / 16 → **17** (reading) and **16** (compact). `.mv-read-body` 17.5, `.mv-read-faq-answer` 16.5, `.mv-values dd` 16.5.
- Meta: 14.5 / 14 / 13.5 / 13 / 12.5 → **15** or **13**. 13.5 appears 9×, 14.5 3×, 12.5 2×.
- H2-read: 28 (`.mv-read-cta p`, `.sp-section-title`) / 30 (`.mv-feed-title`, `.mv-tool-h2`, `.mv-tool-cta h2`, `.gv-lead-title`, `.wl-card-title`, `.mva-modal-title`, `.mvg-handoff-title`, learning-paths) / 32 (`.mv-read-h2`, `.mv-bike-name`, `.mva-check-title`, ai-diagnostics) / 34 (`.mv-read-body h2`) → **34**.
- H3: 24 (`.mv-cmp-h3`) / 26 / 28 (`.xp-h3`) → **26**.
- Lede: 19 (`.mv-read-lede`, H3_STYLE) / 18 / 17 → **18**.
- Figures: 22 (`.xp-figure-value`, `.mv-tool-row dd`, `.gv-ride-date`, `.mvp-summary-row`) / 24 (`.gv-odo-value`, trip-planning) → **20** or **28**; 36 (`.gv-ride-num`, `.prof-stat-num`, `.fx-figure-value`) / 44 (`.rh-figure-value`, `.gv-spend-total`, `.mv-tool-row.is-total dd`, `.mv-check-summary`) / 48 / 56 → **40**.
- H1 family: clamp caps of 62 / 72 / 80 / 84 / 88 / 104 / 112 / 128 across pages → **84** (H1) with 62 for Read; only the hero reaches 150.

### Headings at or below body size (hierarchy inversions)

- `.mv-read-label` 15/600 body on three `<h2>` (trackside-read.css:157) — an H2 smaller than the 17.5px prose under it.
- `.mv-cmp-sub` 16/600 body on five `<h3>` (compare-page.tsx:122) — equal to `.mv-cmp-body` 16.
- feature-content-page.tsx:322 `<h3>` at 17px (= body) and :597 `<h3>` at 15px ink-3 500 (a label dressed as a heading).
- `app/u/[handle]/layout.tsx:43` `<h1 class="text-xl font-bold">` — the page H1 is 20px in the body face; the footer line (`text-lg font-bold`, :72) is 18px.
- `.gv-lead-title` h3 30–36px display under its parent `.gv-h2` at 20px body (garage-view.css:426 vs :147).
- `.mvp-h2` clamp(40–72) on `/pro` is larger than the H1 `.mvp-h2--operate` clamp(36–48) of `/pro/checkout` (pro.css:81, :87).
- Landing: `cta-section.tsx:40` H2 clamp(52–128) and `manifesto-section.tsx:26` `<p>` clamp(44–96) both exceed the H1 class (84); `features-grid.tsx:57` and `faq.tsx:22` use the H1 class on `<h2>`.

### Line-height and measure (summary; rows below)

- Display leading is disciplined (0.94–1.05) except `.mv-read-body h3` 1.1 (fine at 26px), `.mv-cmp-h3` 1.08, `.mv-read-cta p` / `.mv-pull` 1.08, `.gv-ride-date` 40px (baseline hack).
- Sentences under 1.45: `.mv-check-text` 16/1.4, `.mv-rows a` 16/1.4, `.mv-read-faq summary` 17/1.4, `.mv-cmp-faq summary` 16/1.4, `.mv-cmp-sub` 1.4, `.xp-row-title` 16/1.3, `.mv-route-name` 17/1.3, `.gv-overdue` 14/1.3, `.review-text` 15 (1.55 ✓) — meta lines at 1.35–1.4 are fine.
- Measure: `.mv-read-body` 70ch ✓, `.sp-prose`/`.overview-text` 68ch ✓, `.mv-cmp-note` 72ch (14px) borderline; **over 75ch**: feature-content-page.tsx:486–497 long-form intro (18px) and section paragraphs (16px) sit in an 820px box with no `max-width` → ≈90–100ch; **under 45ch**: features/page.tsx:183 `maxWidth: 32ch`, :256 `44ch`, garage.css:154 `40ch`, `.mv-footer-brand-text` 320px@14 ≈ 45ch.
- `text-wrap: balance` is on 22 heading rules ✓ but missing on `.mv-section-title` (when used as h2), `.mv-read-h2`, `.mv-tool-h2`, `.mvp-h2`, `.sp-section-title`, `.xp-h3`, `.sib-title`, `.mv-cmp-h3`, H2_STYLE clones. `text-wrap: pretty` exists only on `.mv-cmp-body/-lede/-note` and `.nf-lede` — every other prose class lacks it.

### Case, tracking, italics, mono (summary)

Clean: no uppercase, no letter-spaced labels, no serif, no italic display anywhere in scope. Three exceptions, all in `trip-detail-map.tsx` and legacy files (rows below). `.mv-read-body em { font-style: italic }` is prose emphasis in the body face — allowed (Rule 4 bans italic *display*). Mono is confined to code, refs, kbd, cookie names and map markers — allowed as data.

### Numerals (summary)

Every figure that has `.mv-figure` is tabular (checked in markup: price, stats, odometer, spend, rides, tool rows, checklist counts, proof). Gaps: `.day-stats strong` (per-day km/h in a column, body 500, no tabular), `.mvp-price-crossed` (a price in the body face), `.diag-step-num` (step index, body), `.reviews-score-out` ("/5" at 0.28×), `.xp-figure-unit` 0.72em (unit too big), `.mvp-price-period` 22 under 64 (0.34×), `.gv-odo-unit` 15 under 24 (0.63×). Rows below.

---

## Findings by file (file · line/selector · issue · exact fix)

### `apps/web/src/components/marketing/design-system.css` (owner-only — report)

| line / selector | issue | exact fix |
|---|---|---|
| :355 `.mv-h2` | Canonical H2 defined, **0 `<h2>` use it**; 14 inline clamp clones exist instead | Keep as the only H2; the rows below replace every clone with `className="mv-h2"`. Already has `text-wrap: balance` ✓. |
| :187 `.mv-section-title` | Used as `<h2>` on the landing page (features-grid.tsx:57, faq.tsx:22) — H1 scale on section headlines | Document: H1 only (+ manifesto/final CTA exception). Add `text-wrap: balance` here (feature pages add it inline today). |
| :202 `.mv-section-sub` 18/1.55, 620px | Lede ✓ but no `pretty`; px measure | `max-width: 60ch; text-wrap: pretty;` |
| :815 `.hero-desc` `clamp(15px, 2.5vw, 17px)` | Fluid body text; 15 is below the lede floor | `font-size: 17px` (phone lede) + `text-wrap: pretty` |
| :279 `.mv-btn` 14/600, −0.005em; :533 `.mv-footer-brand` 18/−0.02em; :603 `.mv-footer-link` 14; :575 `.mv-footer-store` 12; :648 `.mv-footer-operator` 11 | 14/12/11 are off-scale; three different negative trackings on the body face | `.mv-btn` 15/600 tracking 0 (then delete the `font-size: 15px` overrides in pro.css:294/:720); brand 17/600 tracking 0; link 15; store 13/500; operator 12. `.mv-footer-bottom` 12 ✓ Caption. |
| :442 `.mv-plate-figure` `letter-spacing: −0.3px` | Figures elsewhere track 0 (`.mv-figure`) | `letter-spacing: 0` |
| :47 `.mv-serif, .mv-display` | Alias still exported; `.mv-display` sets no size so 6 `<h2>` + 3 `<p>` carry inline sizes | After the clones move to `.mv-h2`, delete `.mv-serif` (TODO at :45) |
| :616 `.mv-footer-wordmark` clamp(80,16vw,240) | Exceeds Display | Accept as the one non-type exception (outlined wordmark, `aria-hidden`); note it in DIRECTION so nobody snaps it. |
| :368 `.mv-table` 15/1.45, th body 500 ✓; :150 `.mv-section-meta` 13/500 ✓; :956 `.hero-strip-figure` 20/22 ✓; :460 `.mv-plate-caption` 15/20 ✓ | On scale | none |

### `apps/web/src/components/marketing/trackside-read.css`

| line / selector | issue | exact fix |
|---|---|---|
| :90 `.mv-index-h1` clamp(44, **6.4vw**, 84) | Same cap as H1 but a different slope than `.mv-section-title` (5.5vw) | Make it `clamp(44px, 5.5vw, 84px)` (identical to H1) |
| :100 `.mv-read-lede, .mv-index-lede` 19/1.5 | Lede off-scale | 18/1.55 + `text-wrap: pretty` |
| :150 `.mv-read-h2` 32 vs :182 `.mv-read-body h2` 34 | Two H2-read sizes; `.mv-read-h2` lacks balance | Both 34/1.05/600; add `text-wrap: balance` to `.mv-read-h2` |
| :157 `.mv-read-label` 15/600 on `<h2>` ×3 | Heading below body size | 20/1.25 body 600 (Section head) — or demote the element to `<p>` |
| :165 `.mv-read-body` 17.5 (17 <720) | Half-pixel step | 17px at all widths; add `.mv-read-body p { text-wrap: pretty }` |
| :201 `h4` 18/1.4 | Between body 17 and Section head 20 | 17/1.4 body 600 (body-strong) |
| :273 figcaption 14; :395 `.mv-read-note` 14; :425 faq summary 17/**1.4**; :445 answer 16.5 | Off-scale / tight | 15 · 15 · 17/1.45 · 16/1.55 |
| :481–:544 byline 15, role 13.5, author-name 17, role 14, bio 16, creds 14, links 14 | Four meta sizes | 15 · 13 · 17 · 13 · 16 · 13 · 15 |
| :574 `.mv-rows a` 16/1.4; :585 sub 14; :592 aside 14; :597 aside figure 17 | Tight rows, 14s, figure off-step | 16/1.5 · 15 · 15 · 20 (Figure-sm) |
| :684 `.mv-read-cta p` 28/1.08 display | Off-step H2-read; leading loose for display | 34/1.05 (it is the CTA headline) |
| :735–:784 feed: meta 14, meta figure 18, title 30/1.05 (26 <720), featured title clamp(36,5vw,56), featured excerpt 18 | Three feed title sizes; 14 | meta 15 · figure 20 · title 34 (26 on phones = H3) · featured → `.mv-h2` clamp · excerpt 18 ✓ |
| :888 `.mv-chip` 14; :921 active-filters 14; :929 text-action 14 | Control labels at 14 | 15/500 (controls use Small) |
| :1003 `.mv-places-count` 14, :1008 figure 18 | | 15 · 20 |
| :1045 `.mv-route-name` 17/**1.3**; :1061 figure 22; :1065 `.mv-route-unit` **body** 500 13; :1078 meta 13.5 | Route card: tight title, off-step figure, unit in the wrong face | 17/1.4 · 20 · `font-family: var(--mv-font-display)` 500 13 · 13 |
| :1116 `.mv-bike-year` 40 above :1125 `.mv-bike-name` 32 | Figure outranks the bike-page title — reads as a plate, probably intended | Keep year 40 (Figure-lg); name → 34 (H2-read) so it is one step, not two |
| :1181 `.mv-tool-h2` 30; :1371 `.mv-tool-cta h2` 30 | H2-read off-step; `.mv-tool-h2` lacks balance | Both 34/1.05 + balance |
| :1200 hint 13.5; :1258 choice-desc 14; :1263 choice figure 18; :1300 dt span 13.5; :1341 stats span 13.5; :1354 footnote 14; :1420/:1425 summary label/note 14; :1440 timer-sub 13.5 | The 13.5/14 family (8 rules) | 13 (labels/hints/footnotes) · 15 (choice-desc) · 20 (choice figure) |
| :1305 `.mv-tool-row dd` 22; :1319 `.is-total dd` 44 (:1396 36); :1410 `.mv-check-summary .mv-figure` 44; :1436 timer figure 32 | Column of currency values at 22; totals at 44/36; 32 | dd 20 · total 40 (28 on phones) · summary 40 · timer 28 |
| :1475 `.mv-check-letter` 48/0.9 (36 phones); :1491 `.mv-check-count` 18 | Plate-style letter off-step | 40 (28 phones) · 20 |
| :1560 `.mv-check-text` 16/**1.4** | Checklist sentences under 1.45 | 16/1.5 |
| :1607 `.mv-values dd` 16.5 | Half-pixel | 16/1.55 + pretty |
| :1622 `.mv-pull` clamp(28,3.6vw,40) display 600, 1.08 | A quoted **sentence** set in the display face (Rule 4: sentences in the body face) | Body face 22/1.35 500 ink, `max-width: 34ch`, balance — or, if it is treated as a headline, 34/1.05 fixed. Owner call. |

### `apps/web/src/components/share-page.css`

| line / selector | issue | exact fix |
|---|---|---|
| :117 `.sp-title` clamp(40, 7vw, 72) | Its own H1 clamp | `clamp(44px, 5.5vw, 84px)` (= `.mv-section-title`) |
| :127 `.sp-sub` 16 ink-3; :133 `.sp-prose` 17/1.65 ✓ | Meta line at 16; prose lacks pretty | 15 · add `text-wrap: pretty` |
| :158 `.sp-figure-value` 40 ✓ / small 22 500 ✓; :173 label 14; :411 phone 34/18 | Label off-step; phone figure off-step | label 13/500 ink-3 · phone 28 with small 14 |
| :185 `.sp-section-title` 28/1.05 | H2-read off-step, no balance | 34/1.05 + balance |
| :205 count 14; :239 row-num 18; :260 row-meta 14; :282 aside 14; :323/:329/:382 14 | 14s | 15 · 20 · 15 · 15 · 13 |
| :358 `.sp-cta-title` clamp(32,5vw,48); :367 sub 16 | Own H2 clamp | `.mv-h2` clamp · 17 |

### `apps/web/src/app/pro/pro.css`

| line / selector | issue | exact fix |
|---|---|---|
| :69 `.mvp-title` clamp(52,7vw,104) | H1 above the H1 cap | `clamp(44px, 5.5vw, 84px)` |
| :81 `.mvp-h2` clamp(40,5vw,72), no balance; :87 `.mvp-h2--operate` clamp(36,5vw,48) is the **H1** of checkout/success/manage (6 pages) | An H2 on `/pro` outranks the H1 on `/pro/checkout`; the H1 carries an H2 class | `.mvp-h2` → `.mv-h2` clamp(34,4.2vw,56) + balance; operate H1 → 44/0.98 fixed (H1-operate) and `<h1 class="mv-section-title">` semantics |
| :243 `.mvp-price-figure` 64 ✓ plate; :250 `.mvp-price-period` 22 display 500 ink-3; :255 `.mvp-price-crossed` 16 **body**, line-through | Unit at 0.34×; the old price is a figure in the body face | period 32/500 ink-2 (0.5×); crossed `.mv-figure` 28/500 ink-3 line-through |
| :92 lead ✓; :99 sub ✓; :104 small 14; :212 seg-btn 14; :261 price-sub 14; :516 back 14; :594 alert 14; :724 after 14; :733 progress 14 | 14s | small/price-sub/after/progress 13 · seg-btn/back/alert 15 |
| :329 `.mvp-feature-title` 18 body | Between body and Section head | 20/1.25 body 600 |
| :377 `.mvp-compare-cell--head` 22 (19 phone); :411 value figure 18 (16) | Column heads off-step | head 26 (20 phone) · figure 20 (inline = cell size 15 is also fine) |
| :457 faq summary 17 ✓; :476 `.mvp-faq-body` 15 | Answer below compact body | 16/1.55 |
| :566 `.mvp-summary-row .mv-figure` 22; :570 total 34; :626 `.mvp-pay` 16 | Checkout figures off-step | 20 · 40 · 15 (= `.mv-btn`) |
| :92 `.mvp-lead`, :99 `.mvp-sub`, :475 `.mvp-faq-body` | No `pretty` | add `text-wrap: pretty` |

### `apps/web/src/app/welcome/welcome.css`

| line / selector | issue | exact fix |
|---|---|---|
| :104 `.wl-title` 76 **600** (:337 64, :398 48) | Fixed H1 at three breakpoints, weight 600 where every other H1 is 700 | `clamp(44px, 5.5vw, 84px)` 700; delete :337/:398 |
| :152 `.wl-reason-title` 18 (17 :343, 15 :412); :217 `.wl-card-title` 30 (28 :363) | Three sizes for one role; H2-read off-step | reason-title 17/600 body, one value · card-title 26 (H3) |
| :158 tag 14; :224 card-body 14; :243 signin 14; :267 13.5; :287 get 16 | 14 family | 13 · 15 · 15 · 13 · 15 |

### `apps/web/src/components/auth-ui/auth-ui.css`

| line / selector | issue | exact fix |
|---|---|---|
| :232 `.mva-title` 44 → :256 54 → :264 56, **600** | Three fixed sizes stepping 10px/2px; weight 600 | 44/0.98 **700** fixed (H1-operate); delete :256/:264 |
| :687 `.mva-check-title` 32; :775 `.mva-modal-title` 30 | H2-read off-step | 34/1.05 both |
| :247 subtitle 15 (16 ≥768); :144/:173/:281/:419/:645/:717/:790 14; :699/:705 15 | Off-scale 14s, duplicated breakpoints | subtitle 16 fixed · all 14 → 15 · check body/email 16 |

### `apps/web/src/components/explore/explore.css`

| line / selector | issue | exact fix |
|---|---|---|
| :28 `.xp-h1` clamp(52, 7.6vw, **112**); :38 `-sm` clamp(36,4.6vw,64); :499 `.xp-results-title` 40 | The directory title is the second-largest type on the site, above every H1 | H1 clamp(44,5.5vw,84) · `-sm` → H1-read clamp(38,5.4vw,62) · results 44 fixed |
| :45 `.xp-h2` clamp(34, **4vw, 54**) | Near-clone of `.mv-h2` | Replace with `.mv-h2` |
| :56 `.xp-h3` 28/1; :369 `.xp-tile-title` clamp(32,3.2vw,44) | H3 off-step; tile title fluid | 26/1.1 both; add balance to `.xp-h3` |
| :66 `.xp-lede` 17 | Lede off-step | 18/1.55 + pretty |
| :110 `.xp-figure-value` 22; :116 `.xp-figure-unit` **0.72em**; :127 xl clamp(44,5vw,64); :131 label 12 | Row figure off-step; unit too large; label under Meta | 20 · `0.5em` · 64 (56 phones) · 13 |
| :209 chip 14; :222 chip figure 18; :262 row-title 16/**1.3**; :270 row-meta 13.5; :432 seg-btn 13.5; :456 text-btn 14; :479 crumbs 13 (vs `.mv-crumbs` 14); :508 count 14; :514 count figure 17; :546/:782/:891 14.5; :677 select label 12; :689/:715 14; :820/:851 12.5 | The meta family (14 rules) | chip/seg/text-btn/count/select/submit/empty/option/notice 15 · row-title 16/1.4 · row-meta/crumbs (both files)/select-label/foot/hint 13 · chip figure 20 · count figure 1em |

### `apps/web/src/components/garage-ui/garage-ui.css` + `primitives.tsx`

| line / selector | issue | exact fix |
|---|---|---|
| garage-ui.css:76 `.mvg-eyebrow`; primitives.tsx:83 `MonoLabel` | Styled correctly (body 14/500, sentence case, tracking 0) but **named** after the two things Rule 5 bans; 14 off-scale | Rename `.mvg-caption` / `Caption`; 13/500 ink-3 (Meta) |
| :219/:225 qrh 16/14; :245/:248 hero qrh 18/15; :273/:325/:390/:464/:598 14; :379/:384 reason 15/14; :439 store 16; :498 handoff-title 30; :506 handoff-sub 14 | 14 family; H2-read off-step | 16/15 · 17/16 · 15 · 16/15 · 15 · 34 · 16 |

### `apps/web/src/app/(community)/garage/garage.css`

| line / selector | issue | exact fix |
|---|---|---|
| :37 `.prof-title` 40 (:59 52) | Own fixed H1 | 44 fixed (H1-operate) or `.mv-section-title` |
| :246 `.prof-stat-num` 36 (:263 40); :252 `.unit` 16 500 ✓; :242 dt 14 | Figure steps 36→40; unit 0.44×; label 14 | 40 at all widths · unit 20 · dt 13/500 |
| :53 caption 14; :109/:155/:165/:212/:351/:579/:646 14; :333 person avatar 18; :154 help `max-width: 40ch` | 14s; under-45ch measure | 13 (caption) · 15 (rest) · 20 · 48ch |
| :218 `.prof-bio` 16/60ch ✓ | no pretty | add `text-wrap: pretty` |

### `apps/web/src/app/(community)/garage/garage-view.css`

| line / selector | issue | exact fix |
|---|---|---|
| :96 `.gv-title` 44 → :115 56 → :126 64; :795 `.gv-start-title` 40/52/60 | Two H1s, six fixed sizes | Both 44/0.98 fixed (H1-operate); the 64 plate figure (:377) stays the big number on this page |
| :147 `.gv-h2` 20/1.25 body 600 ✓ Section head; :426 `.gv-lead-title` h3 **30/36 display** under it | Child heading outranks its parent | lead-title 26/1.1 (H3) — or make the bike name the section's `<h2>` and `.gv-h2` its label |
| :315 `.gv-odo-value` 24; :321 unit 15 | Off-step; unit 0.63× | 28 · unit 14/500 |
| :458 `.gv-spend-total` 44/48/56; :468 sep 24; :522 `.gv-cat-amt` 16 | Three sizes for one figure; category amounts off-step | 40 fixed · sep 20 · amt 20 |
| :561 `.gv-ride-num` 36/40; :567 unit 16; :572 `.gv-ride-date` 22/18/24, :599 `line-height: 40px` | Figure steps; unit 0.44×; date at three sizes with a leading hack for baseline alignment | num 40 · unit 20 · date 20/22 one size, align with `align-items: baseline` |
| :290 plate caption 16; :153 count 14; :209/:666/:696 14; :231 overdue 14/1.3; :554 dt 14; :735 error-title 17; :812 14 | 14s | caption 15 (mobile plate caption) · count/meta 15 · overdue 15/1.4 · dt 13 · error-title 20/600 · 15 |

### `apps/web/src/components/trip-detail/trip-detail.css` + `trip-detail-map.tsx`

| line / selector | issue | exact fix |
|---|---|---|
| :88 `.rh-title` clamp(52, 8vw, **128**); :698 phone clamp(40, **12vw**, 80) | Route title at hero scale; 12vw on phones | `clamp(44px, 5.5vw, 84px)`, delete the phone override |
| :129 `.rh-figure-value` 44, small 24 ✓0.55; :144 label 14; :706/:710 phone 36/20 | Off-step figure; label 14 | 40 / small 20 · 13/500 · phone 28/14 |
| :278 `.rsec-title` clamp(36,4.5vw,64); :566 `.sib-title` clamp(32,4vw,52) (no balance); :619 `.end-cta-title` clamp(40,6vw,**88**) | Three section-H2 clamps, the last larger than most page H1s | All three → `.mv-h2` (end CTA may use `.mv-section-title` as the one final-CTA exception) |
| :402 `.day-stats` 14 + :406 `strong` body 500 | Per-day km / h in a column, no tabular numerals, body face | 15; wrap the figures in `<span class="mv-figure">` (inline, 1em) |
| :474 `.reviews-score-out` 18 under the 64 score | Unit at 0.28× | 32/500 ink-2 display |
| :305 `.overview-text` 17/1.65 68ch ✓; :545 `.review-text` 15 | No pretty; review text below compact body | add pretty · 16/1.55 |
| :62/:168/:189/:230/:386/:605/:661 14; :667 sticky-sub 12; :386 `.day-num` 14/500 | 14s | crumb/author/tabs/sib-meta/sticky-title 15 · icon-btn 15 · day-num 13/500 · sticky-sub 13 |
| trip-detail-map.tsx:226, :271 `font-family: 'Geist Mono'` literal, 11–13px 600 | Hard-coded family on map markers | `var(--mv-font-mono)` (data) — or `var(--mv-font-display)` 13/600 tabular per Rule 4 |
| trip-detail-map.tsx:279 `letter-spacing: 0.06em; text-transform: uppercase;` 10px mono | The only uppercase, letter-spaced label in scope (Rule 5); 10px is under Caption | body face 13/500 sentence case, tracking 0, no mono; :286 notes 12 → 13 |

### Marketing components (`apps/web/src/components/marketing/*.tsx`, `app/[locale]/(marketing)/**`)

| file:line | issue | exact fix |
|---|---|---|
| features-grid.tsx:57 `<h2 class="mv-section-title">`; :187 `.fx-title` `<h3>` clamp(34,3.8vw,56) 600; :287 `.fx-figure-value` 36 | Section H2 at H1 scale; H3 at H2 scale; figure off-step | h2 → `.mv-h2`; `.fx-title` → the block's `<h2 class="mv-h2">` (the section intro becomes a `<p>`); figure 40 |
| faq.tsx:22 `<h2 class="mv-section-title">`; :29 question 18/−0.01em | H1 scale on the FAQ head; question off-step | `.mv-h2` · 17/600 body, tracking 0 |
| cta-section.tsx:40 `<h2>` clamp(52, 8vw, **128**) inline display; :116 14/500 | Larger than every H1 except the hero; inline clone | `.mv-section-title` (the final-CTA exception) or `.mv-h2`; 13 |
| manifesto-section.tsx:26 `<p>` clamp(44, 6vw, **96**) display 700 | Statement above the H1 cap; inline clone | `.mv-section-title` sizing (clamp 44–84) — Persuade may carry one display statement, but not above H1 |
| feature-cta.tsx:30 `<h2>` clamp(44,7vw,88); :41 p 17 | Clone above H1 cap | `.mv-h2` · 18 lede |
| diagnostics-demo.tsx:27 `<h2>` clamp(40,4.8vw,64); :41 p 17/−0.01em; :82 14/600; :93 12; :135 `.diag-step-num` 18 body ink-4 | Clone; step index in the body face | `.mv-h2` · 18 · 15 · 13 · `.mv-figure` 20 |
| feature-content-page.tsx:92 `H2_STYLE` clamp(34,4.2vw,56)/1.02 (×4 at :406/:487/:506 + :621 clamp(26,2.6vw,34)); :101 `H3_STYLE` 19/600 with overrides 17 (:322), 20 (:370), 15 ink-3 500 (:597); :110 `BODY_STYLE` 16/1.65; :490 intro 18 and :495–:496 section paragraphs with no `max-width` inside an 820px box (≈90–100ch) | Inline clone of `.mv-h2`; four H3 sizes, two at/below body; prose over 75ch | `className="mv-h2"` everywhere, :621 → 26; H3 = 20/1.25 body 600 one value, :597 → `<p>` Meta 13/500; body 17/1.6 + pretty; intro `max-width: 60ch`, sections 68ch |
| features/page.tsx:172, :245 `<h2 class="mv-display">` clamp(34,4.2vw,56) / clamp(30,3.6vw,48); :218 row title clamp(30,3.4vw,44); :282 clamp(26,2.6vw,34); :183 p `maxWidth: 32ch`, :256 `44ch`; :52 desc 15; :132/:293 13–14/500 | Two section-H2 sizes on one page; fluid H3s; measures under 45ch | both h2 → `.mv-h2`; row titles 26 fixed (H3); 18 lede at 48ch; desc 16; 13 |
| compare-page.tsx:119 `.mv-cmp-h1` clamp(44,**6.4vw**,80); :120 `.mv-cmp-h2` clamp(28,3.4vw,**40**) 600; :121 `.mv-cmp-h3` 24/1.08; :122 `.mv-cmp-sub` 16/600 body on `<h3>` ×5; :127 note 14 72ch; :143/:144 table 14; :161 faq summary 16/1.4 | H1 slope differs; H2 smaller than H3 elsewhere; h3 = body size; 14s | h1 → `.mv-section-title`; h2 → `.mv-h2`; h3 26/1.1; `.mv-cmp-sub` 20/1.25 body 600; note 13; table th-row/td 15; summary 17/1.45 |
| compare/*.tsx inline `style={{ fontSize: 15 }}` ×12 (compare-page.tsx:278/:307/:399/:491/:553; compare/page.tsx:333–:410; alternatives/page.tsx:95–:175; maintenance-vs-ride-apps/page.tsx:120–:159) | Per-element size overrides fighting the class | Delete once `.mv-cmp-body` is 17/16 and `.mv-cmp-sub` 20; `.mv-cmp-figure` at :385 18 → 20 |
| explore/page.tsx:112, explore/[country]/page.tsx:147/:153, [region]/page.tsx:190 `<span class="mv-figure" style="font-size: 1.15em">` inside a lede sentence | Figures inside sentences take the sentence size | Remove the inline size (1em) |
| features/ai-diagnostics/page.tsx:95 32/600; :46/:86/:122/:127 14–15 figures; garage-management/page.tsx:98/:103 figure cells 17; trip-planning/page.tsx:124 dt 12, :127 24; learning-paths/page.tsx:84 30/600, :131 12; bikes/[…]/[pageType]/page.tsx:184 `<h3 style={{fontSize:22}}>` inside `.mv-read-body` | Off-step figures/titles; an inline h3 size overriding the 26px rule | 28 · 15 · 15 (table = cell size) · 13 / 28 · 34 / 13 · delete the inline size |
| app/get/page.tsx:83 h1 clamp(48,7vw,84) **600**; :106/:122 14; :77 brand −0.01em | H1 weight/slope off; 14s | `.mv-section-title` 700 · 15 · tracking 0 |
| app/t/[token]/not-found.tsx:26 h1 clamp(44,8vw,72) | Own H1 clamp | `.mv-section-title` |
| app/not-found.tsx:42/:56 and app/error.tsx:21, app/[locale]/(marketing)/error.tsx:16 — 14s | | nf-path/err-status 15 · nf-whereto-label 13/500 |
| blog-search.tsx:155 `textTransform: 'capitalize'` on type chips | Case from CSS, not copy (Rule 5) | Remove; capitalise the label in the source string |
| cookie-consent.tsx:430 toast 14 | | 15 (mono cookie name at :374 is data — allowed) |
| gpx-download-button.tsx:293 `text-[11px]`; :327 `text-sm font-medium`; :375 `text-2xl` display 600; :384 `text-sm leading-relaxed` | Tailwind sizes; 11px under Caption; H3 at 24 | 13/500 Meta · 15/500 · 26/1.1 (H3) · 16/1.55 |
| app/u/[handle]/layout.tsx:38–:93 — `text-xl font-bold` h1 (20px system), `text-2xl font-bold` avatar, `text-sm` tabs/CTAs, `text-lg font-bold` footer line, `neutral-*` colours | The one page in scope still outside the Race Plate system; H1 is 20px body face | h1 `.mv-section-title` 44 (H1-operate) 700 display; avatar initial `.mv-figure` 28; tabs 15/500; footer line 20/600 (Section head) + 16 sub; `.mv-btn` for the store links; tokens for colour |
| app/ride/[id]/opengraph-image.tsx, app/rider/[username]/opengraph-image.tsx `fontFamily: 'sans-serif'` 700, 14–64px, hex greens | OG images are not pages (outside this lens), but they are the only "MotoVault type" many people see | When touched: fetch Barlow Condensed 700 in the route and set title/figures in it; keep labels in the system face |

### Delivery (`apps/web/src/app/layout.tsx`)

| line | issue | exact fix |
|---|---|---|
| :19–:22 `Plus_Jakarta_Sans` (`--font-sans`) + :97 comment about its preload | Loaded and preloaded on **every** page, consumed only by `app/piel/layout.tsx:42` (out of scope). Every marketing/rider page downloads a family it never renders | Move the `Plus_Jakarta_Sans()` call into `app/piel/layout.tsx` (and its `variable` onto that layout's element) |
| :27–:32 Barlow Condensed 500/600/700, `display: swap`; mv-tokens.css:105 `"Arial Narrow"` fallback | ✓ exactly the weights used; no missing weight found in any rule | none (next/font emits the metric-adjusted fallback) |

---

## Hierarchy per page type — the five that read worst

1. **Landing `/` (Persuade)** — one Display H1, then "H2"s at five sizes: features-grid and FAQ wear the H1 class (84), the closing CTA is 128 (bigger than every other page's H1), the manifesto statement is 96, diagnostics 64. The eye cannot tell section from page. Fix: every section headline → `.mv-h2`; let only the manifesto *or* the closing CTA borrow H1 scale (one per page).
2. **`/pro` and `/pro/checkout` (Persuade → Operate)** — the pricing page's H2 (72) is larger than the checkout page's H1 (48, which is literally `class="mvp-h2 mvp-h2--operate"`), and the price (64) is smaller than the headline above it, while "/month" sits at a third of the price. Fix: `.mvp-title` → H1 clamp, `.mvp-h2` → `.mv-h2`, operate H1 44 fixed, period 32.
3. **Feature content pages `/features/*`** — H1 correct, but the H3 step is 19 / 20 / 17 / 15 depending on the block (two of them at or under body size, one dressed as a heading in ink-3), the long-form block runs ≈90–100ch, and two sibling sections on `/features` use different H2 clamps. Fix: one H3 (20/600 body), `.mv-h2` everywhere, 60–68ch measures.
4. **Garage `/garage` (Operate)** — a 44→64 title, body-face 20px section heads (correct), then the lead bike's name at 30–36 in the display face *under* a 20px head, three sizes for the spend total and three for the last-ride date. The ladder goes 64 → 20 → 36 → 40. Fix: H1 44 fixed, lead title 26 (or make it the h2), all stat figures 40 / units 20.
5. **`/u/[handle]` (rider saved routes)** — still the pre-Trackside Tailwind page: a 20px system-face H1 inside a neutral gradient header, 18px bold CTA line, no display face anywhere. Nothing on it belongs to the system. Fix: rebuild on the roles above (see its row).

Runners-up: **Explore** (`.xp-h1` 112 outranks every H1 but the hero, results title 40 fixed), **trip detail** (`.rh-title` 128 and `.end-cta-title` 88 bracket a page whose body is 17), **Read** (article H1 62 vs index H1 84 is fine, but chapter titles split 30/32/34 across feed, tool and body rules, and `.mv-read-label` puts an H2 at 15px).

## Verification checklist for the fix PR

- `grep -rn "fontSize: 'clamp\|font-size: clamp" apps/web/src` returns only `.hero-headline`, `.mv-section-title`, `.mv-read-h1`, `.mv-h2`, `.xp-figure-xl`, `.mv-footer-wordmark`.
- `grep -rnE "font-size: *(13\.5|14|14\.5|16\.5|17\.5|12\.5|11|10)px" apps/web/src` returns nothing.
- Every `<h2>` on `app/[locale]/(marketing)/page.tsx` renders at the `.mv-h2` computed size; `document.querySelectorAll('h2').forEach(h => console.log(getComputedStyle(h).fontSize))` at 1440px shows one value (56px) plus at most one 84px exception.
- Every `.mv-figure` sibling unit computes to 0.5× its figure; `.xp-figure-unit` reads `0.5em`.
- Network panel on `/en` shows two font families (Barlow Condensed, Geist Mono), not three.
