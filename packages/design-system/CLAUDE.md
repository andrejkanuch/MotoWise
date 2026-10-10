# Design System Package — @motovault/design-system

## Rule
- `palette` (`src/palette.ts`) is the one colour source: all colors must come from it — no hardcoded hex or rgba values in components. `withAlpha(color, alpha)` derives a transparent variant
- Enforced on mobile by `pnpm check:mobile-colors` (blocks new raw colours); not enforced on web

## What serves which app
- `src/tokens.css`, `src/semantic.css` — oklch scales and semantic variables, imported by both apps
- `src/mv-tokens.css` — `--mv-*` tokens for the signed-in web app only (dark values only)
- `palette.plate*` and `palette.plateLight*` — the mobile "Race Plate" scheme, dark and light
- Web UI follows the design brief in `apps/web/CLAUDE.md`; mobile UI follows `apps/mobile/DESIGN.md` and `apps/mobile/PRODUCT.md`
