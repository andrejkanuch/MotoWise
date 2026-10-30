# Finish review — 2026-10-30 (verdict: ship after fixes)

Reviewer: impeccable-finish-reviewer on 32 captures (.impeccable/review, 1440/375 × dark/light × 8 pages).
Contract: DIRECTION.md + apps/web/DESIGN.md. Quality bar: apps/mobile/DESIGN.md + mw/ captures.

## Material fixes
1. Explore desktop: search input crushed to an icon stub — `explore.css` `.xp-field` (~l.560) gets `flex-wrap: wrap`, `.xp-field-main` `flex: 1 1 100%`; "Search routes" label on one line.
2. Trip detail: the route never shows — `.rh-map-bg` filter ~`saturate(.85) brightness(.95)`, scrim only a left→right gradient to ~50%, static map framed (padding) so the polyline sits in the right half; `.rh` content on `var(--mv-container)` + 40px gutter (crumbs/H1 at x=100, tabs at x=154, nav at 140).
3. Light scheme: home closing CTA (`cta-section.tsx` ~l.111) and trip hero (`design-system.css` `.mv-dark-scene` ~l.1089) fade through a grey smoke band into the light ground — under `html:not(.dark)` end both scenes with a hard edge; fade only between graphite stops.
4. Feature pages: two frames of the same Service screen; hero frame slices the disclaimer — in `feature-content-page.tsx` when the hero takes the shot, the pair below shows a DIFFERENT capture as a frameless cropped panel; end the hero crop on a row boundary or fade it.
5. Home/login plates: "Africa Twin · 2022" in km vs every capture's Street Glide Special / MT-07 in mi and $ — plates show the Street Glide Special 2022 (e.g. 23,480 mi) in English; non-English locales keep km with converted figures.
6. /pro leads with AI ("More bikes. More AI.", "More AI, every month") against the logbook positioning (owner: AI diagnostics stays out of positioning) — retitle around bikes/offline maps/logging stays free, drop or make specific "More AI, every month", move "Unlimited AI diagnostics" below receipt scans and GPX export; "Annual −30%" must not wrap at 375.
7. Blog index: "8 min min read"; tag chips mix case and raw slugs — render `{n} {readingTime}` from a bare number, meta at body 13, dedupe tags case-insensitively, humanise slugs, sentence case.
8. Compare: H2 → body rhythm collapsed ("Quick verdict" touches its paragraph; sourcing note ~4px under "Feature by feature") — 20–24px H2→body, note at small 15 with 16px above, 96px only between sections.

## Further fixes
- Home stat row: "5.0 / 5 App Store rating from 2 riders" undercuts honest proof — replace the cell with a figure that holds (route count).
- Home expense mockup: copper Save bar peeks under the floating tab bar — crop above the tab bar.
- Home trip-planning image: route cut off at the bottom — object-position so the route sits in frame.
- Trip detail: breadcrumb shows raw region code "CL NB"; "Curated by Rider" reads as a placeholder.
- FAQ disclosure marks ~8px and faint — 16px in ink-2.

## Ceiling (not this PR)
Overdue (red) plate never appears on the web; feature pages carry no plate; route stats could sit on a plate figure block; `.mv-plate-chip` unbuilt.
