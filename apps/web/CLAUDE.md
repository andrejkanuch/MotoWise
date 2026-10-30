# Web — Next.js 16

Public marketing and SEO pages, signed-in rider pages (`/garage`, `/profile`, `/feed`, `/welcome`), the `/pro` checkout and the admin dashboard.

## Verify
- `pnpm verify:web` (repo root) — this app's typecheck + tests
- `pnpm --filter @motovault/web exec vitest run <path>` — one test file
- `pnpm --filter @motovault/web exec playwright test` — Playwright specs in `e2e/`
- `pnpm --filter @motovault/web dev` — dev server (port 3000)
- `pnpm --filter @motovault/web build` — production build, then `scripts/check-route-css.mjs`

## Where things go
- Two root layouts share one shell (`src/app/root-shell.tsx`, metadata in `src/app/root-metadata.ts`): `src/app/[locale]/layout.tsx` for the localised tree and `src/app/(root)/layout.tsx` for everything else. `[locale]` is a root segment, so `src/i18n/request.ts` reads the locale from `next/root-params`; never add `getLocale()`/`getMessages()` above `[locale]` again (that cached `en` for every /de, /fr… page until 2026-10-30)
- Localised marketing pages: `src/app/[locale]/(marketing)/` (next-intl; locales in `src/i18n/routing.ts`, strings in `messages/`)
- Root-only sections (no copy under `[locale]`) sit in `src/app/(root)/`, for example `src/app/(root)/trips` and `src/app/(root)/pro` (URLs are unchanged: a route group adds no segment). Adding or removing one means changing two lists that must agree: `NON_LOCALIZED_ROUTE_SECTIONS` in `next.config.ts` and the skip-locale branch in `src/proxy.ts`
- Signed-in pages: `src/app/(root)/(community)/`. Admin: `src/app/(root)/admin/`. Both are gated in `src/proxy.ts`
- GraphQL: `src/lib/graphql-client.ts` in the browser, `src/lib/graphql-server.ts` on the server; operations in `src/graphql/`

## Architecture
- Next.js 16 with App Router and Turbopack
- Supabase SSR auth via @supabase/ssr
- `graphql-request` + TanStack Query for the GraphQL client
- Public pages at root, admin pages under /admin (protected in `src/proxy.ts`; Next 16 has no `middleware.ts` here)
- Admin access requires role='admin' from public.users

## Patterns
- Server components by default; 'use client' only when needed
- Admin role check in `src/proxy.ts` for /admin/* routes
- Security headers configured in next.config.ts
- Import types from @motovault/types and @motovault/graphql
- All colors must come from `palette` in @motovault/design-system — no hardcoded hex or rgba values in components

## Build and deploy rules
- **`vercel.json` is authoritative.** Its `ignoreCommand` overrides the dashboard's "Ignored Build Step". Change build rules in `vercel.json`, in review, never in the dashboard. It rejects unknown keys, so it cannot carry comments.
- **Production-only deployments need both layers:** `git.deploymentEnabled` (`{"**": false, "*": false, "main": true}`) and the `ignoreCommand`. Remove neither. Why: `docs/solutions/integration-issues/vercel-production-only-deployments.md`
- **404 contract: never add a `loading.tsx` above a route that calls `notFound()`, `redirect()` or `permanentRedirect()`** — the streamed response can only be HTTP 200, so every 404 becomes an indexable soft-404. Dev mode cannot reproduce it. Guards: `src/app/__tests__/not-found-contract.test.ts` and `.github/workflows/check-404-contract.yml`; by hand, `pnpm check:404 <url>`. Why: `docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md`
- **From CI, probe the deployment's own `*.vercel.app` URL with `VERCEL_AUTOMATION_BYPASS_SECRET`, production included — never `motovault.app`** (Cloudflare serves GitHub runners a bot challenge).
- **Leave `turbopackFileSystemCacheForBuild: false`** in `next.config.ts`. A restored cache shipped routes without their CSS; `scripts/check-route-css.mjs` fails the build if it recurs. Why: `docs/solutions/build-errors/turbopack-stale-build-cache-drops-css.md`

## Common Mistakes
- Forgetting 'use client' on components using hooks
- Not checking admin role before rendering admin pages
- Using client-side Supabase where server-side should be used
- Mapbox: `MAPBOX_ACCESS_TOKEN` is server-only (static previews). **Interactive** `mapbox-gl` needs a **public** token in the bundle, `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, in `.env.local` (see `.env.example`). Do not rely on server-only tokens for `mapbox-gl` in the browser

## Design brief (web only)
Mobile has its own: `apps/mobile/DESIGN.md` and `apps/mobile/PRODUCT.md`.

- **Users**: motorcycle riders in Europe and the Americas who want one app for their moto life — rides, expenses, maintenance, the garage. Hands-on people who value their machines and want to feel in command of every detail.
- **Brand**: rugged, premium, confident. A precision instrument built for riders, not a generic utility app. The signature "exhaust copper" (#D4622E) anchors the identity.
- **World**: the marketing site speaks the mobile app's Race Plate system (`apps/mobile/DESIGN.md`) at web scale — direction "Trackside": ride photography carries emotion, the Race Plate voice carries everything else. The direction contract is `docs/design/web-race-plate-redesign/DIRECTION.md`; read it before styling any marketing surface.
- **Colour**: graphite ramp + bone ink from `palette.plate*` / `palette.plateLight*`, exposed as `--mv-*` tokens in `packages/design-system/src/mv-tokens.css` (the ONE token source, imported by `globals.css`; dark default, light under `html:not(.dark)`); `src/components/marketing/design-system.css` holds the shared component kit (`.mv-btn*`, `.mv-h2`, `.mv-table`, `.mv-rows`, `.mv-field*`, `.mv-plate*`, `.mv-reveal`, `.mv-dark-scene`). Copper is the only action colour ("copper is a verb" — never status, never decoration, never glows). The bone/signal/red triad appears only inside depictions of the app (the Bike Plate, `src/components/marketing/bike-plate.tsx`). `--mv-warm-*` and `.mv-serif` are deprecated aliases — do not use in new code.
- **Type**: Barlow Condensed (`--mv-font-display`, loaded in the root layout as `--font-plate`) for headlines and numbers (tabular figures); the system stack (`--mv-font-body`) for every sentence. No serif, no italic display, no mono labels, no letter-spaced uppercase, sentence case everywhere.
- **Surfaces**: flat and tonal — lift by stepping up the ramp (bg → surface → surface-2 → surface-3), never drop shadows; blur budget is the navbar only. Controls radius 12, cards 16, the plate 20.
- **Theme**: every surface ships BOTH schemes; `src/providers/theme-provider.tsx` resolves stored choice → OS preference (dark by default when storage is unavailable), the pre-paint script in `src/lib/theme-init-script.ts` sets `html.dark` before first paint (change its text and its CSP hash together), and `<ThemeToggle>` sits in every bar.
- **Anti-references**: generic SaaS dashboards, gamification, AI-slop tells (card-wrapped everything, identical icon grids, centered everything, gradient text, glassmorphism, glows).
- **Principles**: (1) rider-first hierarchy; (2) honest proof — real app objects and real numbers over decoration and vanity stats; (3) ≤1 card per section, spacing over dividers; (4) web-scale layouts and photography, never app chrome cosplay; (5) the logbook voice — records, service history, real costs; specific, honest, sentence case.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
