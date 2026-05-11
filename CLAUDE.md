# MotoVault

Monorepo for MotoVault — AI-powered motorcycle learning & diagnostics platform.

## Architecture
- **Monorepo**: Turborepo + pnpm workspaces
- **apps/mobile**: Expo 54 (RN 0.83, React 19.2) — user-facing mobile app
- **apps/api**: NestJS 11 — GraphQL API (code-first, Apollo Server driver) + Claude AI
- **apps/web**: Next.js 16 — web app (public pages + admin dashboard)
- **packages/types**: @motovault/types — Zod schemas, shared TS types, DB types
- **packages/graphql**: @motovault/graphql — generated GraphQL client types (TypedDocumentNode)
- **packages/design-system**: @motovault/design-system — CSS tokens, semantic colors, JS color/typography/spacing constants
- **packages/tsconfig**: @motovault/tsconfig — shared TypeScript configurations
- **supabase/**: Database migrations, seeds, RLS policies

## Commands
- `pnpm dev` — start all apps (Expo :8081, NestJS :4000, Next.js :3000)
- `pnpm build` — build all packages
- `pnpm lint` / `pnpm lint:fix` — Biome lint/format
- `pnpm precheck` — full lint + typecheck + test (match CI)
- `pnpm precheck:push` — pre-push hook: Biome only on files changed since `merge-base` with `origin/main` (or `main`), then typecheck + test
- `pnpm test` — run all tests
- `pnpm generate` — regenerate DB types + GraphQL schema + client types
- `pnpm db:migration <name>` — create new migration

## Type System (Three Sources)
- **database.types.ts**: DB row shapes — use ONLY in NestJS services
- **Zod schemas**: Validation/input types — use at API boundaries, forms, AI response validation
- **NestJS @ObjectType()**: API contract — defines what GraphQL clients see
- **TypedDocumentNode**: Generated client types — use in mobile (TanStack Query + graphql-request) + web

## Update Sequence (when modifying data models)
1. Update Supabase migration SQL
2. Push migration to production: `npx supabase db push`
3. Run `pnpm generate:types` to update database.types.ts
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
- Biome handles all linting + formatting (no ESLint/Prettier)
- Port assignments: Expo 8081, NestJS 4000, Next.js 3000
- Always export both Zod schema AND inferred type from validators
- Use `as const` objects for enums, not TypeScript `enum` keyword

## Supabase Client Rules
- **SUPABASE_ADMIN** (service-role): Article/quiz generation, admin operations, system tasks, **and all reads from `@Public()` resolvers**
- **SUPABASE_USER** (per-request JWT): User-scoped CRUD — RLS enforced. **Only use from authenticated resolvers.**
- `@Public()` resolvers MUST use SUPABASE_ADMIN for reads — the user client with anon key lacks `authenticated` role, so tables with owner-only RLS (motorcycles, users, trip_saves) return empty results
- NEVER use service-role for user-scoped writes (bypasses RLS author checks)
- NEVER expose service-role key to clients

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
- Use `presentation: 'formSheet'` for modals (add-bike, confirm dialogs)
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
- **CRITICAL**: `eas update` does NOT read env vars from `eas.json` build profiles. It bundles whatever `EXPO_PUBLIC_*` vars are set in the shell at publish time.
- **Always** use `apps/mobile/.env.production` when publishing OTA updates to avoid bundling local dev URLs (e.g. `http://192.168.x.x:4000`).
- Command: `cd apps/mobile && env $(grep -v '^#' .env.production | grep -v '^$' | xargs) eas update --branch production --message "description"`
- Runtime version policy is `appVersion` (currently `3.4.0`), so OTA updates only reach builds with matching app version.
- EAS project ID: `359ae282-329d-455d-b9f3-64919afad0b4`, owner: `andykeny`

## Repo maintenance (local + CI)
- **Git hooks**: `core.hooksPath` → `.githooks`. **pre-commit** runs GraphQL codegen when `*.graphql` or `apps/api/schema.graphql` is staged — if `packages/graphql/src/generated` changes, run `pnpm generate`, then re-stage generated files. **pre-push** runs `pnpm precheck` (`lint` + `typecheck` + `test`) — keep `main` green so pushes are not blocked by unrelated debt; use `git push --no-verify` only when intentional.
- **GraphQL changes**: After resolver/model/schema edits, run `pnpm generate` before commit. Every `.graphql` document must validate against the schema (mobile + web + any other app folders codegen scans).
- **Web / Mapbox**: Interactive maps need a **public** token in the bundle: `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Static route previews on the server use **`MAPBOX_ACCESS_TOKEN`** (see `apps/web/.env.example`). Do not rely on server-only tokens for `mapbox-gl` in the browser.

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
- Use ESLint or Prettier (use Biome)
- Skip RLS policies on new tables
- Use raw_user_meta_data for role checks (use public.users.role)
- Use TypeScript `enum` (use `as const` objects)
- Use `any` type for GraphQL query/mutation data — always use generated types from @motovault/graphql
- Hardcode colors (hex, rgba) — use palette tokens from @motovault/design-system
