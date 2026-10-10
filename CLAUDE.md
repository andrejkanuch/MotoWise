# MotoVault

Monorepo for MotoVault — a rider app: ride tracking, expenses, maintenance and the garage (bike hub).

## Architecture
- **Monorepo**: Turborepo + pnpm workspaces
- **apps/mobile**: Expo 57 (RN 0.86, React 19.2) — user-facing mobile app
- **apps/api**: NestJS 11 — GraphQL API (code-first, Apollo Server driver); AI features use the OpenAI SDK and the Vercel AI SDK
- **apps/web**: Next.js 16 — web app (public pages, signed-in rider pages, admin dashboard)
- **packages/types**: @motovault/types — Zod schemas, shared TS types, DB types
- **packages/graphql**: @motovault/graphql — generated GraphQL client types (TypedDocumentNode)
- **packages/design-system**: @motovault/design-system — CSS tokens, semantic colors, JS color/typography/spacing constants
- **packages/analytics**: @motovault/analytics — PostHog (`posthog-js`) client wrapper and Zod event schemas
- **packages/tsconfig**: @motovault/tsconfig — shared TypeScript configurations
- **supabase/**: Database migrations, seeds, RLS policies

## Commands
- `pnpm dev` — start all apps (Expo :8081, NestJS :4000, Next.js :3000)
- `pnpm build` — build all packages
- `pnpm lint` / `pnpm lint:fix` — Biome lint/format
- `pnpm typecheck` — typecheck every workspace (turbo; builds the packages it depends on first)
- `pnpm precheck` — `check:api-bans`, `check:router`, `check:mobile-colors`, `check:arch`, `check:store-copy`, then lint + typecheck + test. Not identical to CI: CI also runs `pnpm check:i18n`, `pnpm audit --audit-level=critical` and knip (advisory), and does not run `check:api-bans`
- `pnpm precheck:push` — pre-push hook: Biome only on files changed since `merge-base` with `origin/main` (or `main`), then typecheck + test + `pnpm check:i18n`
- `pnpm test` — run all tests
- `pnpm verify:mobile` / `pnpm verify:api` / `pnpm verify:web` — one app's typecheck + tests + its own guards
- `pnpm check:agent-docs` — instruction files cite only paths and `pnpm` scripts that exist, within their budgets; `pnpm check:mobile-structure` — mobile import and route-size rules; `pnpm check:deadcode` — unused mobile source files
- `pnpm generate` — regenerate DB types + GraphQL schema + client types
- `pnpm db:migration <name>` — create new migration
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` — local Supabase (CLI)
- `pnpm db:types` — regenerate database.types.ts from the linked (production) Supabase project

## Type System (Three Sources)
- **database.types.ts**: DB row shapes — use ONLY in NestJS services
- **Zod schemas**: Validation/input types — use at API boundaries, forms, AI response validation
- **NestJS @ObjectType()**: API contract — defines what GraphQL clients see
- **TypedDocumentNode**: Generated client types — use in mobile (TanStack Query + graphql-request) + web

## Update Sequence (when modifying data models)
1. Update Supabase migration SQL
2. Applying the migration to production is an owner-approved step — do not apply it yourself. See `docs/runbooks/supabase-migrations.md`
3. Run `pnpm db:types` to update database.types.ts — it reads the linked production project, so it only shows migrations that are live there
4. Update Zod schemas in packages/types to match
5. Update NestJS models/resolvers to match
6. Run `pnpm generate` to regenerate full pipeline

## Naming Conventions
- DB columns: snake_case (user_id, content_json)
- TypeScript/GraphQL: camelCase (userId, contentJson)
- Map at the NestJS service layer; never expose snake_case to clients
- GraphQL operations: Get/List/Create/Update/Delete + EntityName
- GraphQL files: kebab-case (get-article-by-slug.graphql)
- Expo routes: kebab-case (add-bike.tsx)

## Conventions
- Types flow ONE direction: packages/ -> apps/ (never import from apps/ into packages/)
- Shared validation uses Zod schemas in @motovault/types
- GraphQL operations (.graphql files) live in each app's src/graphql/
- Run `pnpm generate` after changing any resolver or .graphql file
- All DB changes require a migration in supabase/migrations/
- Biome handles all linting + formatting (no ESLint/Prettier). One deliberate exception: `apps/mobile/eslint.config.mjs`, an i18n-only ESLint config (see `apps/mobile/CLAUDE.md`)
- Port assignments: Expo 8081, NestJS 4000, Next.js 3000
- Always export both Zod schema AND inferred type from validators
- Use `as const` objects for enums, not TypeScript `enum` keyword

## Supabase Client Rules (per-table)
- **SUPABASE_USER** (per-request JWT): all user-scoped CRUD — RLS enforced. Also fine for `@Public()` reads of tables with public-read RLS (articles, places).
- **SUPABASE_ADMIN** (service-role): system tasks (generation, webhooks, event listeners), `@Public()` reads of tables with **owner-only RLS** (pair with explicit filters + app-layer redaction as defense-in-depth), and own-profile reads of `users` columns outside the authenticated column grants (00141: email, preferences, currency, subscription_* are service-role-only reads — `select('*')` on users via the user client FAILS with permission denied).
- NEVER use service-role for user-scoped writes (bypasses RLS author checks). There is no longer a standing exception: `deleteRide` was the one cited here and moved to an RPC in 00176.
- **Soft delete goes through a `SECURITY DEFINER` RPC, never a direct UPDATE.** PostgreSQL applies SELECT policies to the NEW row of an UPDATE whenever the statement reads table columns — a `WHERE` clause, `RETURNING`, or a Supabase `.select()`, so every real soft delete qualifies — so a `deleted_at IS NULL` SELECT policy rejects the UPDATE that sets `deleted_at` — `42501 new row violates row-level security policy`, while the table's own UPDATE policy passes. Expense deletion was broken for every rider from launch this way. Use `soft_delete_<table>(<table>_id uuid) RETURNS boolean` on the **user** client (`auth.uid()` is null on service-role, so the function refuses everything). Pin `SET search_path = ''` and pair the `GRANT EXECUTE ... TO authenticated` with `REVOKE EXECUTE ... FROM PUBLIC, anon` in the same transaction. **`anon` must be named**: Postgres grants EXECUTE to PUBLIC on every new function *and* this project carries Supabase's `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`, so `REVOKE ... FROM PUBLIC` alone leaves an explicit anon grant behind and the RPC stays callable unauthenticated. `CREATE OR REPLACE` keeps a function's existing ACL, so re-creating one to harden it does not clear a stale grant either. `true` means "deleted and yours" including already-deleted, `false` means "no such row for you". Six tables carry the affected policy shape — `ride_summaries` is still latent. See `docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md`.
- NEVER expose service-role key to clients
- `users` writes go through the user client — column-level UPDATE grants (00141) are the immutable-column protection

## Auth Pattern
- Supabase Auth for all auth (email, Google, Apple)
- Mobile stores tokens in expo-secure-store (NEVER AsyncStorage)
- API validates JWT locally via jose (no network call) in GqlAuthGuard
- @CurrentUser() decorator extracts AuthUser from context
- OAuth uses `signInWithIdToken` (native) not `signInWithOAuth` (browser)

## Mobile UI Patterns
- Use react-native-reanimated v4 for animations (never RN Animated API)
- Use expo-haptics on iOS for interactive feedback
- Use `borderCurve: 'continuous'` on all rounded elements
- Modal presentation is a three-way rule: `formSheet` for short forms, with an explicit background; `fullScreenModal` for immersive, camera, map or long-content screens; `card` for a detail pushed inside a stack
- Use FadeIn/FadeInUp/SlideInUp from reanimated for enter animations
- Stagger list items: `FadeInUp.delay(index * 50)`
- Keep animations under 300ms
- Use inline styles (not StyleSheet.create) unless reusing across components

## External APIs
- NHTSA vPIC API (https://vpic.nhtsa.dot.gov/api/) for motorcycle make/model/year data
  - `GetMakesForVehicleType/motorcycle` — all motorcycle makes
  - `GetModelsForMakeIdYear/makeId/{id}/modelyear/{year}/vehicletype/motorcycle` — models
  - Free, no API key required

## OTA Updates (EAS Update)
- **Publish with `--environment production`, or with the `Mobile OTA Update` workflow (`.github/workflows/mobile-ota.yml`). Never publish with a local env file** such as `.env.production`: it is untracked, drifts silently, and a wrong `EXPO_PUBLIC_API_URL` in it takes every rider's API calls down with a green publish.
- Command: `cd apps/mobile && npx eas update --branch production --environment production --message "description"`
- An OTA is a production release: it needs the owner's go-ahead, and it ships everything mobile on `main` since the store binary was cut, not only your change. Scope check, bundle check and the native-mismatch trap: `docs/runbooks/mobile-ota.md`.
- Runtime version policy is `appVersion`: the runtime version is `version` in `apps/mobile/app.config.ts`, so an OTA only reaches builds with the same app version. It does not guard against a native mismatch.
- EAS project ID: `359ae282-329d-455d-b9f3-64919afad0b4`, owner: `andykeny`

## Repo maintenance (local + CI)
- **Git hooks**: `core.hooksPath` → `.githooks`. **pre-commit** runs GraphQL codegen when `*.graphql` or `apps/api/schema.graphql` is staged — if `packages/graphql/src/generated` changes, run `pnpm generate`, then re-stage generated files. **pre-push** runs `pnpm precheck:push` (Biome on changed files + `typecheck` + `test` + `check:i18n`) — keep `main` green so pushes are not blocked by unrelated debt; use `git push --no-verify` only when intentional.
- **GraphQL changes**: After resolver/model/schema edits, run `pnpm generate` before commit. Every `.graphql` document must validate against the schema (mobile + web + any other app folders codegen scans).
- **Dependencies: Renovate only, one branch (2026-08-24)**: `renovate.json` is the *single* source of dependency automation. `dependabot.yml` was deleted from `.github/` — the repo ran **both** bots for six weeks with contradictory rules (Dependabot had an `expo-and-react-native` group that bumped exactly the packages Renovate disables; that group is how #150 pushed RN ahead of the Expo SDK and broke `pod install`), and each bot opened its own branch for the same GitHub Actions digests. Do **not** re-add `dependabot.yml`. The shape that keeps it to one branch: a catch-all `matchPackageNames: ["*"]` group covering minor/patch/digest across *every* manager, `major.dependencyDashboardApproval` so majors queue behind a checkbox on the Dependency Dashboard issue instead of opening branches, and `lockFileMaintenance` off (Renovate **never** groups lock file maintenance with other updates, so enabling it always adds a second standing branch). Renovate applies `packageRules` in order with **last match winning** — the opposite of Dependabot, where the first matching group wins — so the catch-all group goes **first** and every `enabled: false` safety rule after it. Nothing auto-merges. The one sanctioned second branch is a `vulnerabilityAlerts` PR, which needs GitHub **Dependabot alerts** left enabled (Renovate reads that feed; it has no advisory source of its own here). Dependabot *security updates* stay off — they would reintroduce the duplicate-PR problem.
- **Web / Vercel build config**: `apps/web/vercel.json` is authoritative. Its `ignoreCommand` **overrides** the dashboard's "Ignored Build Step" — a custom command set there is silently dead config. Change the rule in `vercel.json`, in review — not in the dashboard. `vercel.json` rejects unknown keys, so it cannot carry comments.
- **Web / production-only deployments (cost control, 2026-08-11 → 2026-08-24)**: two layers, both required.
  1. `git.deploymentEnabled` stops the **deployment from being created at all** — no container, no clone, no build minutes, no PR comment. Keys are **minimatch** patterns and "if a branch matches multiple rules and at least one is `true`, a deployment occurs", so `{"**": false, "*": false, "main": true}` *does* express "main only". The earlier note that it cannot was wrong: it was inferred from a bare `{"main": true}` block, which is dead config because unspecified branches default to `true` — the fix is the catch-all `false`, not abandoning the key. Both `**` and `*` are listed because plain `*` does not cross `/`, and branch names here are `feat/…`, `chore/…`, `dependabot/…`. Fail-safe by construction: if a pattern ever stops matching, the branch falls back to `true` (a preview), and `main` can never be blocked because its explicit `true` wins.
  2. `ignoreCommand` stays as the second layer — it still exits 0 for any non-production deployment that reaches a build container anyway (deploy hooks, `vercel deploy`, a branch whose commit predates this config), then falls through to `turbo-ignore` so pushes to `main` that do not touch the web app skip too.
  Why: preview builds were ~75% of all builds and Build CPU Minutes was 45% of the Vercel bill (~$30/mo of a ~$68/mo run-rate). Vercel has **no** project-level "production only" switch — `gitProviderOptions.createDeployments` is `enabled`/`disabled` for the whole project and would kill production with it. Caveat: `git.deploymentEnabled` is read from the vercel.json **on the pushed commit**, so a long-lived branch cut before 2026-08-24 still creates previews until it is rebased on `main`. Trade-off: the 404 contract check runs on the **production** `deployment_status` after merge instead of on a preview before it, so a soft-404 regression is caught minutes later rather than in review — `apps/web/src/app/__tests__/not-found-contract.test.ts` is still the pre-merge guard.
- **Web / 404 contract**: never add a `loading.tsx` above a route that calls `notFound()`, `redirect()` or `permanentRedirect()` — the Suspense boundary streams the shell first, and a streamed response can only carry HTTP 200, silently turning every 404 into an indexable soft-404. Two guards: `apps/web/src/app/__tests__/not-found-contract.test.ts` (structural, runs in the Tests job on every PR) and `.github/workflows/check-404-contract.yml`, which runs `scripts/check-404-contract.sh` on `deployment_status` — the only point where a real server exists, since no unit test can observe a prerender's HTTP status. Dev mode cannot reproduce this bug. Run it by hand with `pnpm check:404 <url>`. **From CI, always probe the deployment's own `*.vercel.app` URL (`deployment_status.environment_url`) with `VERCEL_AUTOMATION_BYPASS_SECRET`, production included** — never `motovault.app`. Vercel's Deployment Protection is scoped `all_except_custom_domains`, so the custom domain needs no bypass secret, but that exemption is a trap: `motovault.app` is fronted by **Cloudflare**, which serves GitHub runners a `Just a moment...` bot challenge, and the script's identity check then fails with a message that reads like a misconfiguration. Every production run failed this way from the workflow's introduction until 2026-08-24 while every preview run passed — preview runs masked it, and #207 (no more previews) left the check with no working signal until #209 fixed it. See `docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md`.
- **Web / Turbopack build cache is OFF (`turbopackFileSystemCacheForBuild: false`)**: Next 16.3 turns it on by default and Vercel restores `.next/cache` from the previous deployment. The #285 production build reused a stale compile of `globals.css` (its new `@import` of `mv-tokens.css` never reached the output; the global CSS chunk had the *same content hash* as #281's), so /login, /signup, /garage and /welcome shipped without the `--mv-*` tokens. Local and `next dev` builds were correct, so no pre-merge check saw it. `apps/web/scripts/check-route-css.mjs` runs after `next build` and fails the deployment if those routes' CSS (per `page_client-reference-manifest.js` `entryCSSFiles`) does not define `--mv-page`. Do not re-enable the cache without a reason stronger than ~10s of compile time.
- **Web / Mapbox**: Interactive maps need a **public** token in the bundle: `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Static route previews on the server use **`MAPBOX_ACCESS_TOKEN`** (see `apps/web/.env.example`). Do not rely on server-only tokens for `mapbox-gl` in the browser.
- **`expo` + `react-native` belong to `apps/mobile` ONLY.** Never add them to the repo root or `apps/web` — neither runs React Native, and a second declaration pins a *different* SDK (the root and `apps/web` sat on `expo@~56` while mobile moved to 57, and `expo-doctor` failed the duplicate-native-module check for the whole `expo-modules-core` tree). Run Expo CLI from `apps/mobile`, or via `pnpm --filter @motovault/mobile <script>`.
- **`expo.install.exclude` in `apps/mobile/package.json`**: `@sentry/react-native` is pinned **ahead** of Expo's `bundledNativeModules.json` (Expo recommends `~7.11`, we ship `8.x`) — the exclusion stops `expo install --fix` from downgrading it a major version. Re-verify against the [Sentry RN changelog](https://github.com/getsentry/sentry-react-native/blob/main/CHANGELOG.md) on each SDK bump, and drop the exclusion if Expo ever catches up. Exclusions for packages Expo already recommends at the installed version are dead config — `react-native-view-shot` was one and was removed. History of this and the two rules above: `docs/solutions/build-errors/renovate-dependabot-duplicate-bots.md`.

## GraphQL Type Safety
- ALWAYS use generated types from @motovault/graphql — NEVER use `any` for GraphQL data
- Import query/mutation result types: `import { type MyRidesQuery, MyRidesDocument } from '@motovault/graphql'`
- Extract nested types from generated ones: `type RideEdge = MyRidesQuery['myRides']['edges'][number]`
- `gqlFetcher(Document)` returns the typed result — use `useQuery<MyRidesQuery>(...)` or `useInfiniteQuery<MyRidesQuery>(...)`
- TypedDocumentNode carries both result AND variables types — no need for manual type annotations on variables
- Run `pnpm generate` after changing any .graphql file or resolver to regenerate types
- All colors must come from `palette` in @motovault/design-system — no hardcoded hex or rgba values in components

## Do NOT
- Import from apps/ into packages/
- Use relative paths across package boundaries (use @motovault/* imports)
- Modify generated files in packages/graphql/src/generated/
- Modify packages/types/src/database.types.ts (auto-generated)
- Commit .env files (use .env.example as template)
- Use ESLint or Prettier (use Biome) — the one exception is the i18n-only `apps/mobile/eslint.config.mjs`
- Skip RLS policies on new tables
- Use raw_user_meta_data for role checks (use public.users.role)
- Use TypeScript `enum` (use `as const` objects)
- Use `any` type for GraphQL query/mutation data — always use generated types from @motovault/graphql
- Hardcode colors (hex, rgba) — use palette tokens from @motovault/design-system

## Design Context (web only)

This section describes `apps/web`. Mobile UI is governed by `apps/mobile/DESIGN.md` and `apps/mobile/PRODUCT.md`, which differ from it in colour, type and theme — read those for any mobile screen.

### Users
Motorcycle riders in Europe and the Americas who want a single app to manage their entire moto life — trip planning, maintenance tracking, expense logging, diagnostics, and learning. They open the app before a ride, after a service, or when something sounds wrong. They are hands-on people who value their machines and want to feel in command of every detail.

### Brand Personality
**Rugged. Premium. Confident.**
MotoVault feels like a precision instrument built for riders — not a generic utility app. Think forged steel with a leather grip: tough materials, beautiful finish, zero fluff. The "exhaust copper" signature color (#D4622E) anchors the identity with warmth and mechanical authenticity.

### Aesthetic Direction
- **Visual tone**: Dark, warm surfaces — never cold blue-gray. Neutrals carry 2-4% warm tint for a lived-in feel. Premium automotive meets activity tracker.
- **References**: Strava/Komoot (data-rich but clean, activity focus) + Porsche/BMW companion apps (dark surfaces, precise typography, premium feel).
- **Anti-references**: No generic SaaS dashboards. No gamification (badges, streaks, cartoon icons). No cluttered forum aesthetics. Not stripped so minimal it loses personality.
- **Theme**: Web is dark only today (`apps/web/src/providers/theme-provider.tsx` pins `dark`). Mobile supports light and dark, and has a night mode (amber-red) for riding without destroying night vision — see `apps/mobile/DESIGN.md` and `apps/mobile/PRODUCT.md`.
- **Typography**: Plus Jakarta Sans for UI (clean, geometric, modern). Instrument Serif for editorial/display moments (warmth, craft). Geist Mono for data/code.
- **Color system**: oklch tokens with full scales. Primary blue (trust), accent teal (growth), signature copper (identity), warm amber (encouragement). Editorial warm tokens for magazine-quality content pages.
- **Motion**: Reanimated v4 on mobile, under 300ms. FadeInUp/SlideInUp with staggered delays. Haptic feedback on iOS for interactive moments. Purposeful, not decorative.
- **Surfaces**: `borderCurve: 'continuous'` on all rounded elements. Elevated surfaces use subtle transparency, not drop shadows. Cards use warm dark tones (#1E1C19), not pure black.

### Design Principles
1. **Rider-first information hierarchy** — Surface what matters for the next ride, service, or decision. Data should feel actionable, not decorative.
2. **Warm precision** — Every element should feel engineered but never clinical. Warm neutrals, copper accents, and editorial typography keep the interface human.
3. **Confident density** — Show meaningful data without clutter. Riders want depth, not simplification — but every element must earn its space.
4. **Platform-native craft** — Mobile feels like a native iOS/Android tool (haptics, continuous curves, native navigation). Web feels like a premium editorial experience (magazine layouts, rich typography). Never force one platform's idioms onto the other.
5. **Dark surfaces, bright data** — Dark backgrounds create focus; accent colors (copper, teal, blue) highlight what matters. Reserve bright colors for interactive elements and key metrics.
