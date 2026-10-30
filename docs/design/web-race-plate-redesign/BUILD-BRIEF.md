# Build brief for Trackside build agents (2026-10-30)

You are one of several agents rebuilding the MotoVault web app (`apps/web`) into the
**Trackside** world in parallel. Each agent owns a disjoint file list. Read, in order:

1. `docs/design/web-race-plate-redesign/DIRECTION.md` — the direction contract (binding rules).
2. `packages/design-system/src/mv-tokens.css` — the ONE token source (dark `:root`, light
   `html:not(.dark)`). Every colour, radius, font and easing you use is a `var(--mv-*)` from it.
   `--mv-page`, `--mv-card`, `--mv-copper-400/500/600`, `--mv-warm-*`, `--mv-success/warning/danger`,
   `--mv-font-sans`, `--mv-font-serif`, `--mv-on-accent` are DEPRECATED aliases: when you touch a
   line that uses one, replace it with the canonical token (`--mv-bg`, `--mv-surface`,
   `--mv-copper-text/--mv-copper/--mv-copper-hover`, `--mv-go/--mv-due-ink/--mv-overdue-ink`,
   `--mv-font-body/--mv-font-display`, `--mv-on-copper`).
3. `apps/mobile/DESIGN.md` — the Race Plate system the site mirrors (read "Colors", "Typography",
   "Named Rules", "Bike Plate", "Do's and Don'ts").
4. `/Users/andrejmacm5/.claude/plugins/cache/impeccable/impeccable/4.8.0/skills/impeccable/reference/craft-floor.md`
   — the quality floor. Read it immediately before your first edit.
5. `apps/web/CLAUDE.md` — app conventions (server components by default, no hardcoded hex).

## The world in one paragraph
Graphite ramp + bone ink (paper ramp in light). Barlow Condensed (`--mv-font-display`, weights
500/600/700, tabular figures) for every headline and number; the system face (`--mv-font-body`)
for every sentence, label and button. Copper is the only action colour — a verb, never a status,
never decoration, never a glow. Flat and tonal: lift by stepping up the ramp, no drop shadows, no
backdrop blur (navbar only). Controls radius 12, cards 16, the Bike Plate 20. Sentence case
everywhere. No eyebrows/kickers, no section numbers, no letter-spaced uppercase, no serif, no
italic display, no monospace labels (mono only for genuine data/code). ≤1 card-styled element per
section; spacing over dividers; left-align; vary rhythm; no identical icon-tile grids; no
gradient text; no glassmorphism. The bone/signal/red triad appears ONLY inside depictions of the
app (the Bike Plate, phone screens). Both schemes must work: check every colour choice in dark and
light. Motion: visible by default; entrances are a progressive enhancement (`.mv-reveal`,
`.mv-reveal-stagger` are scroll-timeline driven and need no JS); one authored moment per page, not
an identical entrance on every section; no infinite loops, parallax, magnetic or scroll-scrubbed
theatre; honour `prefers-reduced-motion`.

## Voice
The rider's logbook: records, service history, real costs. Specific and honest. Never invented
reviews, rider counts, ratings or "beautifully simple". Buttons name their action. Sentence case.

## Hard process rules
- Edit ONLY the files in your owned list. Never edit: `design-system.css`, `mv-tokens.css`,
  `bike-plate.tsx`, `hero.tsx`, `globals.css`, `package.json`, anything under `packages/`,
  generated files. If a shared style or token is missing, put the CSS in your own component
  (inline `style`, the existing `<style dangerouslySetInnerHTML>` pattern, or a CSS file that sits
  next to your component with a unique class prefix) and list the shared need in your report.
- Reusable shared pieces you MAY import: `BikePlate` (`@/components/marketing/bike-plate`),
  `ThemeToggle` (`@/components/theme-toggle`, needs `labels` prop), `.mv-btn .mv-btn-primary`,
  `.mv-btn-ghost`, `.mv-display`, `.mv-figure`, `.mv-section-title`, `.mv-section-sub`,
  `.mv-plate-chip` (max one per section, and only when the number carries meaning),
  `.mv-phone-mockup` (max one full device frame per page), `.mv-reveal`.
- i18n (marketing pages under `src/app/[locale]/(marketing)` and `src/components/marketing`):
  keep every `t('…')`/`getTranslations` call pattern. To ADD or CHANGE an English string, write a
  spec JSON (`{"Namespace.key": "value"}`) to the scratch dir and run
  `python3 .impeccable/tools/add-web-i18n-keys.py <spec.json>` from the repo root — never edit
  `messages/*.json` by hand (other agents write it too). Prefer reusing existing keys. Remove
  nothing from en.json (dead keys are pruned at the end). Root-only routes (`/pro`, `/explore`,
  `/trips`, `/login`, …) are English-only; edit their strings in place.
- Keep intact: analytics (`storeAnchorProps`, `CtaPageType`/`CtaPlacement`, `trackEvent`),
  links, JSON-LD / structured data, metadata, `revalidate`, Supabase/GraphQL data flow, tests.
- Server components stay server; add `'use client'` only for real interactivity.
- No Tailwind palette classes (`neutral-*`, `zinc-*`, `gray-*`, `emerald-*`, `primary-*`), no raw
  hex/rgba/oklch in components. Tailwind layout utilities are fine.
- No new npm packages, no new fonts, no new global CSS. Lucide icons or authored SVG only — no
  emoji, no unicode glyphs as icons.
- Real app imagery: `apps/web/public/images/marketing/mw/` holds app screenshots; the real
  current Race Plate app screens live in `docs/design/app-screens/**` (copy a file into
  `apps/web/public/images/marketing/` if you need one; name it clearly). Never show the OLD app
  UI (purple/blue cards, serif) as "the app".
- Photography: `hero-dusk-ride.jpg`, `cta-night.jpg`, `hero-explore.jpg` exist. Do not download
  or generate new photos.

## Verify before you report
From `apps/web`: `pnpm exec tsc --noEmit -p tsconfig.json` (must be clean) and from the repo root
`pnpm exec biome check --write <your files>` (format + lint clean). The dev server runs at
http://localhost:3000 — render your routes with `curl -s -o /dev/null -w '%{http_code}'` and grep
the HTML for your headings; do not drive the shared browser pane. Hand-check both schemes by
reasoning about every token you used (light values are in mv-tokens.css).

## Report (final message, ≤40 lines)
1. Files changed/added/deleted. 2. What the section/page now does, in the voice of the contract.
3. New or changed en.json keys (list). 4. Shared needs (styles/tokens the owner should add).
5. Anything you could not finish and why. No screenshots.
