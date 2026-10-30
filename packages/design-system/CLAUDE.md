# Design System Package — @motovault/design-system

## Rule
- `palette` (`src/palette.ts`) is the one colour source: all colors must come from it — no hardcoded hex or rgba values in components. `withAlpha(color, alpha)` derives a transparent variant
- Enforced on mobile by `pnpm check:mobile-colors` (blocks new raw colours); not enforced on web

## What serves which app
- `src/tokens.css`, `src/semantic.css` — oklch scales and semantic variables, imported by both apps
- `src/mv-tokens.css` — the ONE `--mv-*` token source for every web surface (marketing, signed-in, auth, Pro): the Race Plate graphite ramp on `:root` (dark) and the paper ramp under `html:not(.dark)` (light). Values mirror `palette.plate*` / `palette.plateLight*`; change the palette first. Deprecated aliases (`--mv-page`, `--mv-card`, `--mv-copper-400/500/600`, `--mv-warm-*`, `--mv-font-sans/serif`) stay until their last consumer is migrated
- `palette.plate*` and `palette.plateLight*` — the mobile "Race Plate" scheme, dark and light
- Web UI follows the design brief in `apps/web/CLAUDE.md`; mobile UI follows `apps/mobile/DESIGN.md` and `apps/mobile/PRODUCT.md`
