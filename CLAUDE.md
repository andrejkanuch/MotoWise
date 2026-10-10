# MotoVault

Monorepo for MotoVault, a rider app: ride tracking, expenses, maintenance and the garage (bike hub).
Turborepo + pnpm workspaces. This file holds only what applies everywhere; each workspace's own `CLAUDE.md` holds the rest.

## Where things live
| Workspace | What it is | Its rules |
|---|---|---|
| `apps/mobile` | Expo app for riders | `apps/mobile/CLAUDE.md` |
| `apps/api` | NestJS code-first GraphQL API | `apps/api/CLAUDE.md` |
| `apps/web` | Next.js: public pages, signed-in rider pages, admin | `apps/web/CLAUDE.md` |
| `packages/types` | Zod schemas, shared types, generated DB types | `packages/types/CLAUDE.md` |
| `packages/graphql` | Generated GraphQL client types | `packages/graphql/CLAUDE.md` |
| `packages/design-system` | `palette` and CSS tokens | `packages/design-system/CLAUDE.md` |
| `packages/analytics`, `packages/tsconfig` | PostHog client and event schemas; shared TS configs | none |
| `supabase/` | Migrations, RLS policies, SQL checks | `supabase/CLAUDE.md` |

## Commands
- `pnpm dev` — all apps (Expo :8081, NestJS :4000, Next.js :3000); `pnpm build`; `pnpm test`
- `pnpm lint` / `pnpm lint:fix` — Biome; `pnpm typecheck` — every workspace
- `pnpm verify:mobile` / `pnpm verify:api` / `pnpm verify:web` — one app's typecheck, tests and guards. Use the one for the app you changed
- `pnpm precheck` — the `check:*` guards below, then lint, typecheck, test. CI also runs `pnpm check:i18n`, an audit and knip
- `pnpm generate` — DB types + GraphQL schema + client types. Run it after changing any resolver or `.graphql` file. Reads production
- `pnpm db:migration <name>`; `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` — local Supabase; `pnpm db:types` — DB types from production

## Type system
- **database.types.ts**: DB row shapes — use ONLY in NestJS services
- **Zod schemas**: validation and input types — API boundaries, forms, AI response validation
- **NestJS @ObjectType()**: the API contract GraphQL clients see
- **TypedDocumentNode**: generated client types — mobile and web

## Changing a data model
1. Write the migration SQL in `supabase/migrations/`
2. Applying it to production is an owner-approved step — do not apply it yourself. `npx supabase db push` is retired. See `docs/runbooks/supabase-migrations.md`
3. `pnpm db:types` updates database.types.ts. It reads production, so it shows only migrations that are live there
4. Update the Zod schemas in packages/types to match
5. Update the NestJS models and resolvers to match
6. `pnpm generate` regenerates the full pipeline

## Conventions
- DB columns are snake_case (user_id); TypeScript and GraphQL are camelCase (userId)
- GraphQL operations: Get/List/Create/Update/Delete + EntityName, in kebab-case files (get-article-by-slug.graphql) in each app's `src/graphql/`
- Types flow ONE direction, packages/ -> apps/: never import from apps/ into packages/, and never use a relative path across a package boundary (use @motovault/* imports)
- Shared validation uses Zod schemas in @motovault/types
- Use generated types from @motovault/graphql — NEVER `any` for GraphQL query or mutation data
- Use `as const` objects, never the TypeScript `enum` keyword
- Biome does all linting and formatting — no ESLint or Prettier. The one exception is the i18n-only `apps/mobile/eslint.config.mjs`
- Dependencies: Renovate only (`renovate.json`); never re-add `dependabot.yml`. Why: `docs/solutions/build-errors/renovate-dependabot-duplicate-bots.md`

## Hard rules
- NEVER use the service-role Supabase client for user-scoped writes (it bypasses RLS)
- NEVER expose the service-role key to clients
- Every DB change is a migration in `supabase/migrations/`, and every new table gets RLS policies
- Soft delete goes through a `SECURITY DEFINER` RPC, never a direct UPDATE (`supabase/CLAUDE.md`)
- Role checks read `public.users.role`, never `raw_user_meta_data`
- Never commit .env files (use .env.example as the template)
- Mobile OTA: publish only with `--environment production` or the `Mobile OTA Update` workflow, never with a local env file, and only with the owner's go-ahead (`docs/runbooks/mobile-ota.md`)
- `expo` and `react-native` belong to `apps/mobile` ONLY — never add them to the root or `apps/web`. Run Expo CLI from `apps/mobile`

## Guards
- Git hooks live in `.githooks`. pre-commit runs GraphQL codegen when a `.graphql` file or the schema is staged and fails if generated output would change. pre-push runs `pnpm precheck:push`. Use `git push --no-verify` only when intentional
- Run on push (`pnpm precheck:push`): Biome on changed files, `pnpm check:agent-docs`, `pnpm check:mobile-structure`, typecheck, test, `pnpm check:i18n`
- `pnpm precheck` and CI only, a push does not run them: `pnpm check:arch` (package boundaries), `pnpm check:router`, `pnpm check:mobile-colors`, `pnpm check:store-copy`, `pnpm check:deadcode` (unused mobile files), Biome on the whole repo
- `pnpm check:api-bans` runs in `pnpm precheck` and `pnpm verify:api` only. No CI job runs it
- `pnpm check:agent-docs` — this file and its siblings may cite only paths and scripts that exist, within size budgets. `pnpm check:mobile-structure` — mobile imports, layering, route size
- Do not edit generated files: `packages/graphql/src/generated/`, `packages/types/src/database.types.ts`, `apps/api/schema.graphql`. A hook blocks the edit

## When stuck
- `docs/solutions/README.md` — index of solved problems. Search it before debugging
- `docs/MAP.md` — what is where
- A local checkout can lag `origin/main`. A SessionStart hook (`.claude/hooks/warn-behind-main.sh`) prints one line when it is behind the ref as last fetched; it does not fetch. Before auditing or planning, run `git fetch` and compare `HEAD` with `origin/main`
