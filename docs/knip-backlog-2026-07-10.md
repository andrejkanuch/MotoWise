# Knip backlog triage — 2026-07-10

First-run triage after adding `knip` (dead-code / unused-dependency detection). The knip config
(`knip.json`) has been **calibrated** to remove false positives; this doc catalogs the **real**
remaining backlog and how to clean it up safely. The CI `deadcode` job is **advisory** until this
backlog is worked down.

## TL;DR

- `knip.json` now ignores `docs/**` and `infra/**` (not pnpm workspaces) and treats test files as
  entries. That dropped phantom "unused files" from 116 → **86**.
- **Do not bulk-delete.** Knip has a systematic false-positive class here (see below) and several
  flagged files look like in-flight redesign work sitting in stashes/branches.
- Recommended: work the backlog in small, reviewed batches (files → deps → exports), each a separate
  commit with `pnpm precheck` green.

## Known false-positive classes (do not act on these blindly)

1. **NestJS DI providers.** `apps/api/src/modules/trips/trips.service.ts` is flagged unused but is a
   provider wired via `@Module({ providers: [...] })` and injected at runtime — knip can't see runtime
   DI. Treat every `*.service.ts` / provider flagged "unused" as suspect; confirm it's absent from all
   module `providers`/`exports` arrays before removing.
2. **In-flight redesign components.** Many flagged files (`components/home/*`, `components/marketing/*`,
   `components/discover/*`, `components/ride/hud-*`) match active redesign work parked in `git stash` /
   feature branches. Deleting them could orphan half-finished features. Cross-check against open work
   before removing.
3. **Build/config-only deps** (see "dependencies" below) — used by tooling, not imported in source.

## Real backlog (after calibration)

| Category | Count | Action |
|----------|------:|--------|
| Unused files | 86 | Review in batches — see below |
| Unused dependencies | 9 | Verify each; some are FP (build/config) |
| Unused devDependencies | 4 | Likely mostly FP (type packages) |
| Unlisted dependencies | 34 | Declare the real ones in the right `package.json` |
| Unused exports | 121 | Lowest priority; high FP risk (public APIs) |
| Unused exported types | 150 | Lowest priority; high FP risk |
| Duplicate exports | 2 | Intentional aliases — likely keep |

### Unused files — 60 are "high-confidence" (0 references anywhere)

The basename never appears in any `import`/`require`/dynamic-import string across `apps/` + `packages/`.
Still **verify each against the two FP classes above** before deleting. Concentrations:

- `apps/mobile/src/components/home/*` (~13) — home screen widgets; check redesign branches first.
- `apps/mobile/src/components/discover/*`, `discover/planner/*` — discover redesign; check branches.
- `apps/mobile/src/components/ride/hud-*` — ride HUD; check `feat/ride-logging-hud` stash.
- `apps/web/src/components/marketing/*` (~10) — marketing pages; check `feat/web-redesign-marketing-pages`.
- `apps/web/src/components/{public-navbar,theme-toggle,route-detail-map,save-route-button}.tsx` —
  spot-checked: 0 importers, strong dead-code candidates.

Regenerate the exact current list any time with:
```bash
pnpm knip --reporter json | head -1 | node -e 'const d=JSON.parse(require("fs").readFileSync(0));console.log((d.files||[]).join("\n"))'
```

### Unlisted dependencies — declare the real ones

Genuinely used but not in the nearest `package.json` (currently resolve via pnpm hoisting):

- **Test deps:** `@jest/globals` (mobile tests), `jsdom` (web tests) → add to the app's `devDependencies`.
- **Web source:** `server-only`, `hast`, `hast-util-to-string`, `unist-util-visit`, `@graphql-typed-document-node/core` → add to `apps/web` deps.
- **Mobile source:** `expo-font`, `@posthog/core`, `@graphql-typed-document-node/core` → note `@posthog/core`
  is transitive via `posthog-react-native`; either import from the parent package or declare it.
- **Root scripts:** `@supabase/supabase-js`, `dotenv`, `@motovault/types` used by `scripts/seed-*.ts` /
  `backfill-*.ts` → add to root `devDependencies`, or move seed scripts under an app that has them.
- `expo-updates` (in `app.json` config plugins) is an expo-plugin FP — ignore.

### Unused dependencies — verify before removing (several are FP)

| Dep | Workspace | Likely verdict |
|-----|-----------|----------------|
| `tailwindcss` | web | **FP** — used by PostCSS/config, not imported |
| `mapbox-gl`, `@types/mapbox-gl` | web | Used via dynamic import in map components — **but** if the dead map components are removed, this becomes truly unused |
| `chart.js`, `react-chartjs-2` | web | Used by chart components — same coupling as above |
| `nuqs` | web | Verify URL-state usage |
| `rehype-autolink-headings` | web | Used in MDX/rehype config — likely **FP** |
| `date-fns` | root | **FP-ish** — apps depend on it; root dep may be for hoisting/scripts |
| `expo-status-bar` | mobile | Verify; may be genuinely unused |
| `@as-integrations/express5` | api | Verify against Apollo/Express bootstrap in `main.ts` |
| `@nestjs/testing` | api (dev) | Tests use Vitest, not `@nestjs/testing` — likely removable |
| `@types/geojson`, `@types/graphql-type-json` | dev | Type-only; knip often can't see usage — likely **FP** |

## Recommended cleanup sequence (separate reviewed PR)

1. **Batch 1 — dependencies** (small, safe, high signal): add the real unlisted deps; add `ignoreDependencies`
   in `knip.json` for the confirmed build/config FPs (`tailwindcss`, `rehype-autolink-headings`, type packages).
   Re-run `pnpm knip` — dependency issues should reach zero.
2. **Batch 2 — dead files, web** (~15): confirm each against redesign branches, delete, `pnpm precheck`.
3. **Batch 3 — dead files, mobile** (~45): same, in sub-batches by folder (`home/`, `discover/`, `ride/`).
4. **Batch 4 — exports/types** (271): lowest priority, highest FP risk. Only after files are clean, and
   only for exports confirmed unused across all apps (a package's public API export can be "unused"
   internally yet consumed by an app).
5. When `pnpm knip` is green, drop `continue-on-error: true` from the CI `deadcode` job to make it blocking.
