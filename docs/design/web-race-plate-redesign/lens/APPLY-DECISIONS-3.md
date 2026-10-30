# Iteration 3 apply — owner decisions (2026-10-30)

Apply agents: the process rules of BUILD-BRIEF.md and APPLY-DECISIONS.md still bind (no edits to design-system.css,
mv-tokens.css, hero.tsx, bike-plate.tsx, globals.css, theme-provider/toggle; i18n via the tool; keep analytics/JSON-LD/
data). Read the five reports it3-animate.md, it3-delight.md, it3-distill.md, it3-harden.md, it3-colorize.md and apply
EVERY row whose file or i18n key is in your owned list. Where a row conflicts with a decision below, the decision wins.

## Already done by the owner (do not redo; USE them)
- design-system.css: `.mv-plate[data-settle]` + stripe-lay (opt-in via `<BikePlate settle />` or `settle="late"`),
  `.mv-plate` background-color transition, `.mv-disclosure` (+ `.is-plus`, `.mv-disclosure-mark`), press feedback,
  segmented transitions, `.mv-enter-down/.mv-enter-up/.mv-enter-list` (`--i` per child) and the field-error/alert
  enter, view-transition cross-fade on theme change, two-icon theme toggle, caret/tap-highlight on roots, plate
  `::selection`, tabular numerals on `.mv-table td/.mv-row-aside/.mv-row dd/.mv-row time`, the reduced-motion policy
  (so DELETE per-file reduced-motion guards that only duplicate it when the page sits inside `.mv-marketing`/`.mv-root`;
  explore.css and garage-ui.css guards for loops stay), disabled-primary dim, active-chip hover, overdue plate identity ink.
- mv-tokens.css: ink-4 lifted, light ink-3 #606165, overdue/go/due inks, field-line at 3:1, print ramp.
- bike-plate.tsx: `settle` prop, sr-only state word (`stateLabel` prop for localized pages).
- hero.tsx: late settle, hook link and figure strip removed, no status dot. marketing layout: console note removed.
- en.json: Hero.plateCaption / Features.grid.maintenance.plateFigure+plateCaption on one ledger (delight row 1).

## Distill decisions (★ rows)
Apply: ★1 (home diagnostics band OUT; FAQ 14 → the 6 listed), ★2 (figure pairs + trips proof OUT; proof row = 12,000+
models / 14 categories / App Store rating when present), ★4 (Features dropdown → one "Features" link; footer store
buttons OUT), ★6 (garage feature page's fictional maintenance table OUT), ★7 (compare: verdict card and wins lists OUT —
verdict stays as one prose paragraph; one date per page), ★8 (one ContextualAppCta per post), ★9 (trip detail: 3 controls),
★10 (/pro "What Pro adds" OUT), site-definition paragraph OUT (not sr-only).
Do NOT apply: ★5 — the feature pages' long-form band STAYS (it carries the SEO ranking); only trim sentences that repeat
the rows above it. The footer's outlined wordmark STAYS.
Removed i18n keys: leave them in en.json (the prune happens at the end); just stop rendering them.

## Delight decisions
Row 1 (one demo bike ledger): auth-ui.tsx PANEL_PLATE and explore app-promo.tsx use the hero figures verbatim
(`figure="24,318" unit="km" caption="Ready · chain service in 1,882 km"`, identity "Africa Twin · 2022", number 27).
Row 3 (localized 404 gets the root 404's stage and rows): apply, i18n keys via the tool.
Row 7 (share page prints): apply the share-page.css print block.
Rows 2/4/5/6: done or cut by the owner.

## Animate decisions
Apply every per-file row (settle call sites R-hero-1 done; R-pro-1/2, R-garage-1, R-feat-1 are yours; disclosure call
sites take `.mv-disclosure` and drop their local chevron CSS; fixed bars use `translate`, not `bottom`; sheets/bars/
toasts/typeahead/menus/field errors take the enter utilities; progress bars `scaleX`; `transition: all` → explicit).
Never combine a settle and a reveal on one object; plates inside `.mv-reveal` get no settle.

## Harden decisions
Apply every ★ row and every blocker/major in your files. Minor rows: apply when cheap. Empty/error/loading states must
name what happened and the next step (logbook voice, sentence case). Overflow: the Bike Plate identity line truncates to
one line with an ellipsis (title attribute carries the full text) — this is a bike-plate.tsx (owner) change, already noted;
pages that compose the identity string should pass "make model · year" (drop the variant) when the string exceeds 40 chars.

## Colorize decisions
Apply every per-file row (go/due/overdue only on real states; ink-4 never as text; hairline on white cards in light;
Mapbox: scheme-aware style via `useTheme` + `map.setStyle`, light style `mapbox://styles/mapbox/light-v11`, category
hues from `palette.plateLightCat*` under light; the plate's state word is done).

## Verify before you report
From apps/web: `pnpm exec tsc --noEmit -p tsconfig.json` clean; repo root `pnpm exec biome check --write <files>` clean;
curl your routes (200 + H1); run the vitest files that cover your area. Report ≤25 lines: rows applied per report, rows
skipped and why, new/changed i18n keys, owner needs.
