# Web Race Plate Redesign — Compound Design Loop progress

Direction: **Trackside** (ride photography + Race Plate voice). Owner picked 2026-10-19.
Scope (widened 2026-10-30 by the owner): the whole web app except admin/builder — marketing, rider
pages (/garage, /profile), auth, /welcome, /get, /pro + checkout, root /explore, trips/routes/ride/
share/rider/u pages — in BOTH schemes, 8 locales translated at the end, one PR.
Copy: full repositioning (logbook/records voice, kill trust-killer lines, fix Claude-AI chip → on-device/AI wording).

## Design team (brainstorm, done)
- Lead designer — proposed Full Plate / Trackside / Spec Sheet; killed Full Plate; Trackside #1, Spec Sheet = template layer
- Rider domain expert — trust audit; logbook positioning; real plate as hero proof; founder visibility
- Anti-slop auditor — site is two dialects: home 3/10, templates 8/10; guardrails list
- Ecosystem strategist — token map plate*→--mv-*; deprecate --mv-warm-*; Barlow Condensed display + Geist body; dual --mv-* definition hazard

## Execution checklist
- [x] Foundation: ONE token source `packages/design-system/src/mv-tokens.css` (dark :root, light html:not(.dark), deprecated aliases), theme provider light/dark/system + hashed pre-paint script, ThemeToggle (2026-10-30, adf361f2)
- [x] Fonts: Barlow Condensed (500/600/700, tnum) as --font-plate; Instrument Serif removed from every layout
- [x] BikePlate web component (hero, garage, feature pages, auth panel, checkout success)
- [x] Hero: Trackside rebuild; entrances are transform-only (a stalled animation can never hide content)
- [x] Homepage sections rebuilt without GSAP (c953269d); real Race Plate captures from marketing/screenshots/en-US in /images/marketing/mw
- [x] Copy repositioning in messages/en.json (English; other locales pending)
- [x] feature-content-page.tsx is the one layout for all 7 feature pages (slots: steps/demo/table/longForm)
- [x] Compare "Spec Sheet" template + index/alternatives/maint-vs-ride
- [x] Navbar + footer + sticky bar + cookie banner + 404/error (blur: navbar only)
- [x] Blog/guides/bikes/tools/legal/about/press (trackside-read.css)
- [x] Auth/welcome/get/pro/checkout; garage/profile/followers + community nav; root explore; trips/ride/share/rider/u
- [x] Routing fix: /reset-password, /share, /u added to the root-only lists (they 404ed in prod)
- [ ] Locales: de, es, fr, it, ja, pl, pt-BR retranslation (end of the pass)
- [x] apps/web/CLAUDE.md design brief rewritten to the new world (token location to be updated at the end)
- [ ] apps/web/DESIGN.md + .impeccable/design.json via the documenter (end of the pass)

## Impeccable commands
Iteration 1 — DIAGNOSE: [x] /critique [x] /audit (brainstorm covered)
Iteration 2 — SYSTEMATIZE: [x] /normalize [x] /typeset [x] /arrange [x] /clarify (reports lens/it2-*.md, decisions lens/APPLY-DECISIONS.md, applied by 7 file-group agents)
Iteration 3 — ENHANCE: [ ] /animate [ ] /delight [ ] /distill [ ] /harden [ ] /colorize
Iteration 4 — POLISH: [ ] /adapt [ ] /onboard [ ] /optimize [ ] /polish [ ] /extract [ ] /bolder [ ] /overdrive

## Guardrails (binding)
- Tokens only: no neutral-*/emerald-*/primary-* Tailwind colors in (marketing); no raw oklch in components
- Copper is a verb: one copper moment per viewport; no copper gradients/glows beyond primary CTA
- Triad (bone/signal/red) only inside depictions of the app (plate component)
- Card budget ≤1 per section; no reusable divider component; vary rhythm
- Sentence case; no serif/italic; no letter-spaced uppercase; no eyebrows (exception: plate-chip section marker, max 1/section)
- Blur budget: navbar only. Max one full device frame per page
- Both schemes: every token has dark + light values
- One stat row max per page, real numbers only

## Iteration log
- It.1 (diagnose): brainstorm synthesis, direction picked (2026-10-19).
- It.2 (systematize, 2026-10-30): 4 research lenses → one shared kit in design-system.css (.mv-root/.mv-h2/.mv-h3/.mv-h1-operate/.mv-table/.mv-link/.mv-icon-btn/.mv-segmented/.mv-field*/.mv-rows/.mv-crumbs/.mv-chip/.mv-alert/.mv-scroll-row), one type scale, one spacing scale, one container; 684 dead i18n keys identified (prune at the end); product-truth copy fixed (no vendor names, no invented tests, no typed prices, 12,000+ models, 14 categories, 10 waypoint types); owner flags (d1–d15) in lens/it2-clarify.md.
- Build (2026-10-30): foundation + 9 parallel build agents (home, chrome, features, compare, content, auth/pro, rider, explore, trips) → commits adf361f2, c953269d, 3b415384. Visual pass in both schemes at 1440 and 375.
