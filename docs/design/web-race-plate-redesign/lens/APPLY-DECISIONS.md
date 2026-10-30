# Iteration 2 apply — owner decisions (2026-10-30)

Apply agents: read docs/design/web-race-plate-redesign/BUILD-BRIEF.md first (process rules still bind: no edits to
design-system.css, mv-tokens.css, hero.tsx, globals.css, package.json; i18n via the tool; keep analytics/JSON-LD/data).
Then read the four reports in this folder (it2-normalize.md, it2-typeset.md, it2-layout.md, it2-clarify.md) and apply
EVERY row whose file or i18n key is in your owned list. Where a row conflicts with a decision below, the decision wins.

## Shared kit (now in design-system.css — use it, delete your local copies)
`.mv-root` (selection + focus grammar; put it on any non-marketing root wrapper that lacks `.mv-marketing`),
`.mv-btn .mv-btn-primary|.mv-btn-ghost`, `.mv-btn-block`, `.mv-btn.is-compact`, `:disabled` states, `.mv-icon-btn`,
`.mv-link` (+ `.is-quiet`, `.is-tall`), `.mv-h2`, `.mv-h3`, `.mv-section-title`, `.mv-figure`, `.mv-table`,
`.mv-segmented`, `.mv-field` / `.mv-field-input` (+ `.is-tall`) / `.mv-field-hint` / `.mv-field-error` / `.mv-select`,
`.mv-rows` (+ `.is-open`) / `.mv-row` / `.mv-row-title` / `.mv-row-sub` / `.mv-row-aside`, `.mv-crumbs`, `.mv-chips` /
`.mv-chip` (+ `.is-tall`), `.mv-alert`, `.mv-scroll-row`, `.mv-reveal`, `.mv-dark-scene`, `.mv-phone-mockup`.
Radius tokens: `--mv-radius-control` 12, `--mv-radius-card` 16, `--mv-radius-plate` 20, `--mv-radius-small` 6,
`--mv-radius-track` 2, `--mv-radius-pill` 999, `--mv-radius-screen` 28. `--mv-radius-field/-inner/--mv-radius` are
aliases to retire from your files.

## Type scale (snap every size to it; see it2-typeset.md for the table)
Display (hero only) · H1 `.mv-section-title` clamp(44,5.5vw,84) — Read pages clamp(38,5.4vw,62), Operate pages 44 fixed ·
H2 `.mv-h2` clamp(34,4.2vw,56) — Read/Operate H2 34/1.05 600 · H3 26/1.1 600 · Operate section head 20/1.25 body 600 ·
Lede 18/1.55 · Body 17/1.6 (compact 16/1.55) · Small 15/1.45 · Meta 13/18 500 · Caption 12/16 · Figures 64 / 40 / 28 / 20
tabular 600, units 0.5× in display 500 ink-2. 14px is NOT a step (→ 15 or 13); no half-pixel sizes. Every `<h2>` on a
Persuade page uses `.mv-h2`; nothing but the hero exceeds 84px (the manifesto statement and the home closing CTA may use
the H1 size, nothing larger). `text-wrap: balance` on headings, `pretty` on prose; prose measure 60–70ch.

## Rhythm (it2-layout.md)
Spacing scale 4/8/16/24/32/48/64/96/120/160 (40 only as the gutter). Two intervals per page family: weight sections
96–128 top, prose sections 64–96. Gutters 40 → 24 at ≤900 → 20 at ≤480; every page container is `var(--mv-container)`
(1240) unless it is a reading column (≤70ch). Hairline rows: ONE padding (12px 0, min-height 44) site-wide via `.mv-row`.
Crumbs → H1 40px, H1 → lede 28px, lede → meta 20px. Fixed bottom bars offset by `--mv-cookie-banner-h`.

## Copy (it2-clarify.md) — apply all ★ rows and group (a)/(b) rows in your files, with these calls:
- ★1/★2 AI vendor + navigation: user copy never names a model or vendor ("a vision model"); the app has no
  turn-by-turn navigation — say "GPX export" / "copy it into your planner".
- ★3 CTA vocabulary: store install = "Download for iOS" / "Download for Android"; deep link into an installed app =
  "Open in the app"; the generic (QR, welcome, sticky bar) = "Get the app". Nothing else.
- ★4 model count: ONE figure everywhere: "12,000+ models" (the NHTSA catalogue figure already used in the site
  definition). Never "18,000", never "thousands of".
- ★5 testing preambles: replace every "Tested April 2026 … iPhone 15 Pro … we rode …" with: "Features and prices
  checked against each app's store listing and documentation in April 2026. We have not ridden with the other app."
- ★6 prices: never typed in copy. Where the page can pass a value, interpolate from `STATIC_WEB_PLANS`
  (src/lib/web-pricing.ts) with "on the web"; where it cannot (compare tables, FAQ answers), say "Pro is a monthly or
  yearly subscription, with a lifetime option; prices are shown in the store and on /pro." Checkout: format 0 in the
  package currency.
- ★7 the maintenance-report export does not exist: "Not yet. You can share a bike's service history as a read-only
  web link from the app."
- ★8 titles: sentence case, ≤60 characters, keep the keyword (e.g. "Motorcycle maintenance tracker: service history
  and reminders"). Brand names keep their case.
- ★9/★10 counts: 14 expense categories, 10 waypoint types. ★11 no stopwatch claims ("in 5 seconds") — state the steps.
  ★12 no "never miss", "smart", "all-in-one", "best-in-class", "comprehensive", "robust"; no exclamation marks.
- ★13 errors name what failed and the way out; ★14 cookie banner is plain ("Accept all" / "Only required" / "Saved.");
  ★15 support copy: one rider, no "team", keep "within 24 hours on business days" (the owner answers mail).
- ★16 gamification: no badges/streaks/"skill trees"/"personal best"/"new record" copy; the TCLOCS timer may stay as a
  plain "time taken" readout with no records.
- ★17 no unverifiable security/accuracy claims (TLS 1.3, AES-256, "enterprise-grade", "highly accurate"): "encrypted
  in transit and at rest, stored on EU servers, deleted on request — see /privacy"; diagnostics carry a confidence
  level and are a first opinion.
- ★18 OEM schedules do not load automatically: "set each service interval once and the app counts down".
- ★19 link text says where it goes.
- ★20 Privacy/Terms legal text: DO NOT edit (owner decision pending); everything else in those pages that the report
  lists as voice (sentence case headings) is fine to apply.
- Group (c) dead keys: do NOT prune yet (done once at the end). Group (d): do not act; the owner has the list.

## Verify before you report
From apps/web: `pnpm exec tsc --noEmit -p tsconfig.json` clean; from the repo root `pnpm exec biome check --write <your
files>` clean; curl your routes on http://localhost:3000 (200 + H1). Report ≤25 lines: rows applied per report, rows
skipped and why, new/changed i18n keys, anything the owner must do in design-system.css.
