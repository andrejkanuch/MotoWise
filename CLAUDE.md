# MotoLearn

Monorepo for MotoLearn — AI-powered motorcycle learning & diagnostics platform.

## Architecture
- **Monorepo**: Turborepo + pnpm workspaces
- **apps/mobile**: Expo 55 (RN 0.83, React 19.2) — user-facing mobile app
- **apps/api**: NestJS 11 — GraphQL API (code-first, Apollo Server driver) + Claude AI
- **apps/web**: Next.js 16 — web app (public pages + admin dashboard)
- **packages/types**: @motolearn/types — Zod schemas, shared TS types, DB types
- **packages/graphql**: @motolearn/graphql — generated GraphQL client types (TypedDocumentNode)
- **packages/design-system**: @motolearn/design-system — CSS tokens, semantic colors, JS color/typography/spacing constants
- **packages/tsconfig**: @motolearn/tsconfig — shared TypeScript configurations
- **supabase/**: Database migrations, seeds, RLS policies

## Commands
- `pnpm dev` — start all apps (Expo :8081, NestJS :4000, Next.js :3000)
- `pnpm build` — build all packages
- `pnpm lint` / `pnpm lint:fix` — Biome lint/format
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
- Shared validation uses Zod schemas in @motolearn/types
- GraphQL operations (.graphql files) live in each app's src/graphql/
- Run `pnpm generate` after changing any resolver or .graphql file
- All DB changes require a migration in supabase/migrations/
- Biome handles all linting + formatting (no ESLint/Prettier)
- Port assignments: Expo 8081, NestJS 4000, Next.js 3000
- Always export both Zod schema AND inferred type from validators
- Use `as const` objects for enums, not TypeScript `enum` keyword

## Supabase Client Rules
- **SUPABASE_ADMIN** (service-role): Article/quiz generation, admin operations, system tasks
- **SUPABASE_USER** (per-request JWT): User-scoped CRUD — RLS enforced
- NEVER use service-role for user-scoped queries
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

## Do NOT
- Import from apps/ into packages/
- Use relative paths across package boundaries (use @motolearn/* imports)
- Modify generated files in packages/graphql/src/generated/
- Modify packages/types/src/database.types.ts (auto-generated)
- Commit .env files (use .env.example as template)
- Use ESLint or Prettier (use Biome)
- Skip RLS policies on new tables
- Use raw_user_meta_data for role checks (use public.users.role)
- Use TypeScript `enum` (use `as const` objects)
