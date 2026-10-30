# Web Race Plate Redesign — Compound Design Loop progress

Direction: **Trackside** (ride photography + Race Plate voice). Owner picked 2026-10-19.
Scope: full marketing surface — tokens, homepage, feature + compare templates, navbar/footer, 8 locales.
Copy: full repositioning (logbook/records voice, kill trust-killer lines, fix Claude-AI chip → on-device/AI wording).

## Design team (brainstorm, done)
- Lead designer — proposed Full Plate / Trackside / Spec Sheet; killed Full Plate; Trackside #1, Spec Sheet = template layer
- Rider domain expert — trust audit; logbook positioning; real plate as hero proof; founder visibility
- Anti-slop auditor — site is two dialects: home 3/10, templates 8/10; guardrails list
- Ecosystem strategist — token map plate*→--mv-*; deprecate --mv-warm-*; Barlow Condensed display + Geist body; dual --mv-* definition hazard

## Execution checklist
- [ ] Foundation: re-point --mv-* to palette.plate*/plateLight* (both schemes), add --mv-copper-*, delete grain/cursor/serif/mono-eyebrow helpers
- [ ] Fonts: Barlow Condensed (500/600/700, tnum) as --font-plate; retire Instrument Serif
- [ ] BikePlate web component (hero + reusable)
- [ ] Hero: Trackside rebuild (photo regraded to graphite scrims, condensed H1, plate, copper CTA, static figure strip; kill HUD/haze/stagger/magnetic/cursor)
- [ ] Homepage sections: features-grid, proof (real numbers), manifesto, CTA, FAQ restyle
- [ ] Copy repositioning in messages/en.json
- [ ] feature-content-page.tsx rebuild on tokens (fixes 7 pages)
- [ ] Compare template rebuild (Spec treatment; fixes 10 pages)
- [ ] Navbar + footer restyle (blur budget: navbar only)
- [ ] Locales: de, es, fr, it, ja, pl, pt-BR retranslation
- [ ] apps/web/CLAUDE.md design brief rewritten to the new world

## Impeccable commands
Iteration 1 — DIAGNOSE: [x] /critique [x] /audit (brainstorm covered)
Iteration 2 — SYSTEMATIZE: [ ] /normalize [ ] /typeset [ ] /arrange [ ] /clarify
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
- It.1 (diagnose): brainstorm synthesis, direction picked.
