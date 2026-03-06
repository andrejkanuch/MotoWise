# API — NestJS GraphQL

## Commands
- `pnpm --filter api dev` — start dev server (port 4000)
- `pnpm --filter api test` — unit tests (Vitest)
- `pnpm --filter api test:e2e` — E2E tests
- `pnpm --filter api generate:schema` — emit schema.graphql (standalone script)

## Architecture
- Code-first GraphQL with @nestjs/graphql + Apollo Server driver
- Feature modules in src/modules/{feature}/
- Each module: {feature}.module.ts, .resolver.ts, .service.ts, dto/, models/
- Dual Supabase clients: SUPABASE_ADMIN (system) + SUPABASE_USER (per-request RLS)
- Auth via GqlAuthGuard (local JWT validation with jose, no network call)
- Rate limiting via @nestjs/throttler (stricter on AI endpoints)

## Patterns
- Resolvers are thin — business logic in services
- Input validation with Zod schemas from @motolearn/types via ZodValidationPipe
- Use @UseGuards(GqlAuthGuard) on all protected resolvers
- Use @CurrentUser() decorator to get authenticated user
- AI services (article-generator, diagnostic-ai) call Anthropic Claude API
- Use SUPABASE_ADMIN only for system operations (article creation, admin)
- Use SUPABASE_USER for user-scoped queries (respects RLS)
- Use cursor-based pagination for list queries (Relay connections)
- Map snake_case DB columns to camelCase in service layer

## Common Mistakes
- Forgetting to register new modules in AppModule imports
- Not running `pnpm generate` after adding/changing resolvers
- Using SUPABASE_ADMIN for user-scoped queries (bypasses RLS!)
- Missing @UseGuards on new resolvers (defaults to public)
- Forgetting dto/ directory for input types
- Not adding models/ to content-flags and learning-progress modules
