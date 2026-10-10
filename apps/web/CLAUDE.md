# Web — Next.js 16

Public marketing and SEO pages, signed-in rider pages (`/garage`, `/profile`, `/feed`, `/welcome`), the `/pro` checkout and the admin dashboard.

## Verify
- `pnpm verify:web` (repo root) — this app's typecheck + tests
- `pnpm --filter @motovault/web exec vitest run <path>` — one test file
- `pnpm --filter @motovault/web exec playwright test` — Playwright specs in `e2e/`
- `pnpm --filter @motovault/web dev` — dev server (port 3000)
- `pnpm --filter @motovault/web build` — production build, then `scripts/check-route-css.mjs`

## Where things go
- Localised marketing pages: `src/app/[locale]/(marketing)/` (next-intl; locales in `src/i18n/routing.ts`, strings in `messages/`)
- Root-only sections (no copy under `[locale]`) sit directly in `src/app/`, for example `src/app/trips` and `src/app/pro`. Adding or removing one means changing two lists that must agree: `NON_LOCALIZED_ROUTE_SECTIONS` in `next.config.ts` and the skip-locale branch in `src/proxy.ts`
- Signed-in pages: `src/app/(community)/`. Admin: `src/app/admin/`. Both are gated in `src/proxy.ts`
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
- **Brand**: rugged, premium, confident. A precision instrument built for riders, not a generic utility app: forged steel with a leather grip. The signature "exhaust copper" (#D4622E) anchors the identity.
- **Tone**: dark, warm surfaces, never cold blue-gray; neutrals carry a 2-4% warm tint. Premium automotive meets activity tracker.
- **References**: Strava/Komoot (data-rich but clean) and the Porsche/BMW companion apps (dark surfaces, precise typography).
- **Anti-references**: generic SaaS dashboards, gamification (badges, streaks, cartoon icons), cluttered forum aesthetics, minimalism that loses personality.
- **Theme**: dark only today — `src/providers/theme-provider.tsx` pins `dark`.
- **Type**: Plus Jakarta Sans for UI, Instrument Serif for editorial and display moments, Geist Mono for data and code.
- **Colour**: oklch tokens with full scales. Primary blue (trust), accent teal (growth), signature copper (identity), warm amber (encouragement); editorial warm tokens for content pages.
- **Surfaces**: elevation by subtle transparency, not drop shadows. Cards are warm dark (#1E1C19, `--mv-card`), not pure black.
- **Principles**: (1) rider-first hierarchy — surface what matters for the next ride, service or decision; (2) warm precision — engineered, never clinical; (3) confident density — depth without clutter, every element earns its space; (4) platform-native craft — web is a premium editorial experience (magazine layouts, rich typography), never mobile idioms forced onto it; (5) dark surfaces, bright data — bright colour only for interactive elements and key metrics.
