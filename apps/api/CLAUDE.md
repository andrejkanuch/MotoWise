# API — NestJS GraphQL

## Verify
- `pnpm verify:api` (repo root) — typecheck + tests + `check:api-bans`
- `pnpm --filter @motovault/api typecheck` — `tsc` on `src` (excludes `*.spec.ts` via `tsconfig.build.json`)
- `pnpm --filter @motovault/api test` — unit tests (Vitest); one file: `pnpm --filter @motovault/api exec vitest run <path>`
- `pnpm --filter @motovault/api dev` — dev server (port 4000)
- `pnpm --filter @motovault/api generate:schema` — emit schema.graphql

## Where things go
- A feature is a module in `src/modules/<feature>/`: <feature>.module.ts, .resolver.ts, .service.ts, dto/ (input types), models/ (`@ObjectType`), `*.spec.ts` beside the source
- Shared by modules: `src/common/` (guards, decorators, pipes, pagination, interceptors). Raw Postgres error codes live only in `src/common/supabase/unwrap.ts` (`pnpm check:api-bans`)
- Supabase client providers: `src/modules/supabase/`

## Architecture
- Code-first GraphQL with @nestjs/graphql + Apollo Server driver
- Supabase Auth for all auth (email, Google, Apple). Auth via GqlAuthGuard (local JWT validation with jose, no network call)
- Rate limiting is OPT-IN per resolver: `@UseGuards(GqlThrottlerGuard)` + `@Throttle({ default: THROTTLE_PRESETS.X })` on AI + abuse-prone mutations only. NO global throttler guard (a global guard 429'd public SSR queries — 24d066b5). Register exactly ONE named throttler in AppModule; v6 applies every registered throttler to every guarded route.
- AI services use the OpenAI SDK (`openai`) and the Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`), not Anthropic
- Motorcycle make/model/year data: NHTSA vPIC API (free, no key); both endpoint URLs are in `src/modules/motorcycles/nhtsa.service.ts`

## Supabase client rules
- **SUPABASE_USER** (per-request JWT): all user-scoped CRUD — RLS enforced. Also fine for `@Public()` reads of tables with public-read RLS (articles, places).
- **SUPABASE_ADMIN** (service-role): system tasks (generation, webhooks, event listeners), `@Public()` reads of tables with **owner-only RLS** (pair with explicit filters + app-layer redaction as defense-in-depth), and own-profile reads of `users` columns outside the authenticated column grants (00141, re-applied by 00178: email, preferences, currency, subscription_* are service-role-only reads — `select('*')` on users via the user client FAILS with permission denied).
- NEVER use service-role for user-scoped writes (bypasses RLS author checks). No standing exception: `deleteRide` was the last and moved to an RPC in 00176.
- NEVER expose the service-role key to clients.
- `users` writes go through the user client — column-level UPDATE grants (00141, 00178) are the immutable-column protection.
- Role checks read `public.users.role`, never `raw_user_meta_data`.
- **Soft delete goes through a `SECURITY DEFINER` RPC, never a direct UPDATE**: a `deleted_at IS NULL` SELECT policy rejects the UPDATE that sets `deleted_at` (`42501`) while the UPDATE policy passes. Call `soft_delete_<table>(<table>_id uuid) RETURNS boolean` on the **user** client (`auth.uid()` is null on service-role, so the function refuses everything). `true` means "deleted and yours" including already-deleted, `false` means "no such row for you". The function pins `SET search_path = ''` and pairs `GRANT EXECUTE ... TO authenticated` with `REVOKE EXECUTE ... FROM PUBLIC, anon` in the same transaction — `anon` must be named. `ride_summaries` is still latent. Why: `docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md`; SQL rules: `supabase/CLAUDE.md`.

## Patterns
- Resolvers are thin — business logic in services
- Input validation with Zod schemas from @motovault/types via ZodValidationPipe
- `GqlAuthGuard` is registered GLOBALLY via `APP_GUARD` (app.module.ts), so GraphQL resolvers are AUTHENTICATED by default — do NOT add per-resolver `@UseGuards(GqlAuthGuard)` (redundant). Use `@Public()` to expose a resolver/route, and pair any `@Public()` REST controller with its own auth (see RevenueCatWebhookController / MaintenanceDuePushController + controller-auth-inventory.spec.ts)
- Use @CurrentUser() decorator to get authenticated user
- Use cursor-based pagination for list queries (Relay connections)
- Map snake_case DB columns to camelCase in service layer; never expose snake_case to clients
- `@ResolveField` lists that hit the DB: use **request-scoped** `DataLoader` (see `expense-photos.loader.ts`, `task-photos.loader.ts`) so parent lists don’t N+1
- Resolver + loader pairs that need the user’s Supabase client: mark `@Injectable({ scope: Scope.REQUEST })` on the resolver when injecting a loader

## Common Mistakes
- Forgetting to register new modules in AppModule imports
- Not running `pnpm generate` after adding/changing resolvers
- Production logs: resolvers slower than `SLOW_RESOLVER_MS` (default 2000, `0` disables) log at **warn** with prefix `SLOW` (see `CorrelationIdInterceptor`)
