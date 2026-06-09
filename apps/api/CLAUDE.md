# API — NestJS GraphQL

## Commands
- `pnpm --filter api dev` — start dev server (port 4000)
- `pnpm --filter api typecheck` — `tsc` on `src` (excludes `*.spec.ts` via `tsconfig.build.json`)
- `pnpm --filter api test` — unit tests (Vitest)
- `pnpm --filter api test:e2e` — E2E tests
- `pnpm --filter api generate:schema` — emit schema.graphql (standalone script)

## Architecture
- Code-first GraphQL with @nestjs/graphql + Apollo Server driver
- Feature modules in src/modules/{feature}/
- Each module: {feature}.module.ts, .resolver.ts, .service.ts, dto/, models/
- Dual Supabase clients: SUPABASE_ADMIN (system) + SUPABASE_USER (per-request RLS)
- Auth via GqlAuthGuard (local JWT validation with jose, no network call)
- Rate limiting is OPT-IN per resolver: `@UseGuards(GqlThrottlerGuard)` + `@Throttle({ default: THROTTLE_PRESETS.X })` on AI + abuse-prone mutations only. NO global throttler guard (a global guard 429'd public SSR queries — 24d066b5). Register exactly ONE named throttler in AppModule; v6 applies every registered throttler to every guarded route.

## Patterns
- Resolvers are thin — business logic in services
- Input validation with Zod schemas from @motovault/types via ZodValidationPipe
- Use @UseGuards(GqlAuthGuard) on all protected resolvers
- Use @CurrentUser() decorator to get authenticated user
- AI services (article-generator, diagnostic-ai) call Anthropic Claude API
- Use SUPABASE_ADMIN only for system operations (article creation, admin)
- Use SUPABASE_USER for user-scoped queries (respects RLS)
- Use cursor-based pagination for list queries (Relay connections)
- Map snake_case DB columns to camelCase in service layer
- `@ResolveField` lists that hit the DB: use **request-scoped** `DataLoader` (see `expense-photos.loader.ts`, `task-photos.loader.ts`) so parent lists don’t N+1
- Resolver + loader pairs that need the user’s Supabase client: mark `@Injectable({ scope: Scope.REQUEST })` on the resolver when injecting a loader

## Common Mistakes
- Forgetting to register new modules in AppModule imports
- Not running `pnpm generate` after adding/changing resolvers
- Production logs: resolvers slower than `SLOW_RESOLVER_MS` (default 2000, `0` disables) log at **warn** with prefix `SLOW` (see `CorrelationIdInterceptor`)
- Using SUPABASE_ADMIN for user-scoped queries (bypasses RLS!)
- Missing @UseGuards on new resolvers (defaults to public)
- Forgetting dto/ directory for input types
- Not adding models/ to content-flags and learning-progress modules
