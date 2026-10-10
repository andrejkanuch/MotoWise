# Map of the repository

What is where. Read this when you do not know which directory holds something. It is
not loaded automatically, and it carries no rules: the rules are in the `CLAUDE.md` of
each app and package. `pnpm check:agent-docs` fails if a path cited here stops existing.

## apps/mobile — Expo app (`@motovault/mobile`)

| Path | Purpose |
|---|---|
| `apps/mobile/index.ts` | Bundle entry. Import order is load-bearing: CarPlay registers before the router |
| `apps/mobile/app.config.ts` | Expo config: `version`, runtime version policy, plugins, permissions. There is no `app.json` |
| `apps/mobile/eas.json`, `apps/mobile/metro.config.js` | EAS build profiles; Metro config (resolves `@motovault/*` from source) |
| `apps/mobile/DESIGN.md`, `apps/mobile/PRODUCT.md` | Mobile design system and product brief |
| `apps/mobile/src/app/` | Expo Router routes. `_layout.tsx` holds providers, auth gating and screen tracking |
| `apps/mobile/src/app/(tabs)/` | Tab groups: `(home)`, `(discover)`, `(garage)`, `(profile)`; `(learn)` and `(diagnose)` are hidden |
| `apps/mobile/src/app/(tabs)/(garage)/` | Bike hub (`bike/`), expenses, maintenance tasks, documents, notes, odometer |
| `apps/mobile/src/app/(modals)/` | Ride flow, trips, group rides, receipt scan, recalls, CarPlay screens |
| `apps/mobile/src/app/(onboarding)/`, `apps/mobile/src/app/(auth)/` | Onboarding flow including the paywall; login and register |
| `apps/mobile/src/features/` | Vertical slices: `carplay`, `ride`, `receipt-scan`, `create-trip`. `apps/mobile/src/features/create-trip/index.ts` is the one barrel file that exists; add no more |
| `apps/mobile/src/components/` | UI by domain (`bike-hub`, `ride`, `garage`, `maintenance`, `discover`, `trip`, `onboarding`, …); shared primitives in `ui/`, `shared/`, `skeleton/` |
| `apps/mobile/src/lib/` | Infrastructure: GraphQL client, query keys and options, Supabase, secure storage, analytics, subscription, notifications, widgets sync |
| `apps/mobile/src/lib/bike-hub/` | The bike hub's pure logic: segments, attention, task due dates, costs, recalls |
| `apps/mobile/src/hooks/` | Hooks shared across domains |
| `apps/mobile/src/stores/` | Zustand stores |
| `apps/mobile/src/utils/` | Pure helpers: units, fuel, geo, Mapbox, haptics |
| `apps/mobile/src/config/`, `apps/mobile/src/theme/` | Feature flags, onboarding config, sheet detents; type scale and editorial tokens |
| `apps/mobile/src/graphql/` | `.graphql` operations in `queries/` and `mutations/` |
| `apps/mobile/src/i18n/` | i18next setup and `locales/*.json`; `en` is the source |
| `apps/mobile/src/widgets/` | iOS widgets. PascalCase file names are coupled to the native targets |
| `apps/mobile/src/__tests__/`, `apps/mobile/src/test/` | Cross-cutting contract tests; shared mocks and fixtures. Other tests sit in `__tests__/` beside the code |
| `apps/mobile/plugins/`, `apps/mobile/modules/carplay/` | Expo config plugins; the local CarPlay native module |
| `apps/mobile/.maestro/` | Maestro E2E flows and their README |
| `apps/mobile/eslint.config.mjs` | The i18n-only ESLint config, the one exception to Biome-only |

## apps/api — NestJS GraphQL API (`@motovault/api`)

| Path | Purpose |
|---|---|
| `apps/api/src/main.ts`, `apps/api/src/instrument.ts` | Bootstrap; Sentry |
| `apps/api/src/app.module.ts` | Module registration, the global `GqlAuthGuard`, the single throttler |
| `apps/api/src/modules/` | One folder per feature: module, resolver, service, `dto/`, `models/`, specs beside the source |
| `apps/api/src/modules/supabase/` | Providers for the Supabase clients |
| `apps/api/src/modules/webhooks/` | RevenueCat webhook |
| `apps/api/src/modules/motorcycles/nhtsa.service.ts` | NHTSA vPIC client for make, model and year data |
| `apps/api/src/common/guards/` | Auth and throttler guards, plus inventory specs that fail when a public mutation, controller or AI resolver is added unlisted |
| `apps/api/src/common/decorators/`, `apps/api/src/common/pipes/` | `@CurrentUser()`, `@Public()`; `ZodValidationPipe`, `ParseUUIDPipe` |
| `apps/api/src/common/supabase/unwrap.ts` | The only allowed home of raw Postgres error codes |
| `apps/api/src/common/pagination/`, `apps/api/src/common/models/` | Relay connection helpers; paginated model factory |
| `apps/api/src/common/interceptors/` | Correlation id with slow-resolver logging; locale |
| `apps/api/src/common/revalidation/`, `apps/api/src/common/storage/` | Web revalidation calls; photo storage helpers |
| `apps/api/src/config/` | Constants and environment validation |
| `apps/api/schema.graphql` | Generated schema. Do not edit |
| `apps/api/scripts/` | `generate-schema.ts` (used by `pnpm generate`), one-off seeds and backfills |
| `apps/api/Dockerfile`, `render.yaml` | Deployment to Render |

## apps/web — Next.js app (`@motovault/web`)

| Path | Purpose |
|---|---|
| `apps/web/src/app/layout.tsx` | Root layout: fonts, providers, the dark-theme script |
| `apps/web/src/proxy.ts` | Next 16 proxy (there is no `middleware.ts`): locale handling, admin and signed-in gates, edge-cache rules |
| `apps/web/next.config.ts` | Security headers, `NON_LOCALIZED_ROUTE_SECTIONS`, redirects, the Turbopack cache flag |
| `apps/web/vercel.json` | Build and deployment rules. Authoritative over the dashboard |
| `apps/web/src/app/[locale]/(marketing)/` | Localised marketing pages (next-intl) |
| `apps/web/src/app/(community)/` | Signed-in pages: feed, garage, profile |
| `apps/web/src/app/admin/` | Admin dashboard |
| `apps/web/src/app/pro/` | Web checkout |
| `apps/web/src/app/api/` | Route handlers |
| `apps/web/src/app/__tests__/not-found-contract.test.ts` | Structural guard for the 404 contract |
| `apps/web/src/components/` | Components by area (`marketing`, `explore`, `trip-detail`, `builder`, `garage-ui`, `auth-ui`, `admin`, `guides`) and flat shared ones |
| `apps/web/src/lib/` | `graphql-client.ts` (browser), `graphql-server.ts` (server), `fetch-*.ts` page loaders, analytics, SEO, blog, Supabase clients |
| `apps/web/src/graphql/` | `.graphql` operations: `fragments/`, `mutations/`, `queries/` |
| `apps/web/src/i18n/`, `apps/web/messages/` | next-intl routing and request config; translation files |
| `apps/web/src/providers/` | TanStack Query provider; theme provider (pins dark) |
| `apps/web/content/`, `apps/web/src/content/` | Blog MDX; guide content |
| `apps/web/scripts/check-route-css.mjs` | Post-build guard: fails if key routes lose their CSS tokens |
| `apps/web/e2e/`, `apps/web/playwright.config.ts` | Playwright specs |

## supabase/ — database

| Path | Purpose |
|---|---|
| `supabase/migrations/` | Every schema change, `00NNN_<name>.sql` |
| `supabase/checks/` | SQL checks and fixtures; `run.sh` runs them in a disposable container |
| `supabase/templates/`, `supabase/config.toml` | Auth email templates; local and auth config |
| `supabase/seed.sql`, `supabase/seed-articles.sql` | Local seeds |
| `docs/runbooks/supabase-migrations.md` | How a migration reaches production (owner-approved; `db push` is retired) |

## scripts/ — repository tooling

| Path | Purpose |
|---|---|
| `scripts/precheck-changed.sh` | The pre-push check (`pnpm precheck:push`) |
| `scripts/check-arch-boundaries.ts` | Packages never import apps; no relative imports across packages (`pnpm check:arch`) |
| `scripts/check-agent-docs.ts` | Instruction files cite real paths and scripts, within budget (`pnpm check:agent-docs`) |
| `scripts/check-mobile-structure.ts`, `scripts/mobile-structure-baseline.json` | Mobile import and route-size rules, and the recorded violations (`pnpm check:mobile-structure`) |
| `scripts/codemod-mobile-alias.ts` | Rewrites mobile imports that climb three or more levels to `@/`. `--check` exits 1 if a run would change a file; re-run it with `--write` after rebasing a branch |
| `scripts/check-i18n.sh`, `scripts/check-i18n-new-keys.ts` | i18n ratchet (`pnpm check:i18n`) |
| `scripts/check-no-router-any.sh`, `scripts/check-no-hardcoded-mobile-colors.sh` | Mobile guards (`pnpm check:router`, `pnpm check:mobile-colors`) |
| `scripts/check-api-bans.sh` | No raw Postgres error-code literals outside `unwrap.ts` (`pnpm check:api-bans`) |
| `scripts/check-404-contract.sh` | End-to-end 404 probe against a real server (`pnpm check:404`) |
| `scripts/reconcile-signup-events.ts` | Acceptance check for the signup event (`pnpm reconcile:signup`) |
| `scripts/seed-*.ts`, `scripts/seed-*.py`, `scripts/backfill-elevation-profiles.ts` | Seeds and backfills. Read the header before running: some write to production |
| `scripts/setup-supabase-smtp.sh`, `scripts/aso-analytics-pull.sh` | One-off operations scripts run by the owner |

## packages/ — shared code

| Path | Purpose |
|---|---|
| `packages/types/` | `@motovault/types`: Zod validators, constants, `database.types.ts` (generated) |
| `packages/graphql/` | `@motovault/graphql`: generated client types in `src/generated/`. Do not edit |
| `packages/design-system/` | `@motovault/design-system`: `palette`, CSS tokens, spacing, typography |
| `packages/analytics/` | `@motovault/analytics`: PostHog client wrapper and Zod event schemas |
| `packages/tsconfig/` | Shared TypeScript configurations |

## Elsewhere

| Path | Purpose |
|---|---|
| `docs/solutions/README.md` | Index of solved problems, one row per document |
| `docs/runbooks/` | Procedures: OTA publishing, migrations, the confirmation email template |
| `docs/plans/`, `features/` | Plans and per-feature execution records |
| `store/play/` | Play Store listing metadata and its checker (`pnpm check:store-copy`) |
| `infra/social-worker/` | Cloudflare Worker for scheduled social posting |
| `.github/workflows/` | CI, the 404 contract check, the mobile OTA workflow |
| `.githooks/` | pre-commit (GraphQL codegen check) and pre-push |
| `.claude/` | Shared agent settings, the protected-files hook list, project skills |
