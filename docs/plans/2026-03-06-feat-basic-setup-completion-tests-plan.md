---
title: "Complete Basic Setup & Add Test Coverage"
type: feat
status: active
date: 2026-03-06
deepened: 2026-03-06
---

# Complete Basic Setup & Add Test Coverage

## Enhancement Summary

**Deepened on:** 2026-03-06
**Research agents used:** best-practices-researcher, framework-docs-researcher, architecture-strategist, kieran-typescript-reviewer, security-sentinel, performance-oracle, pattern-recognition-specialist, learnings-researcher

### Key Improvements
1. Added `unplugin-swc` requirement for Vitest + NestJS decorator metadata (critical blocker)
2. Comprehensive security test cases for auth guard (10+ additional scenarios including `alg:none` attack, missing `sub` claim, role escalation)
3. Performance-optimized test strategy: direct service construction instead of `Test.createTestingModule` for unit tests
4. Typed Supabase mock factory constrained to `TableName` from generated `database.types.ts`
5. Turbo cache optimization with `inputs` field to prevent false invalidation

### New Considerations Discovered
- `ZodValidationPipe.schema` is `private` — needs to be `readonly` for metadata-based pipe verification in tests
- Mixed Jest/Vitest requires isolated `types` field in each workspace `tsconfig.json` to prevent declaration conflicts
- Raw `Error` throws in QuizzesService and ContentFlagsService should be fixed BEFORE writing tests (otherwise tests encode wrong behavior)
- Articles service uses `adminClient` bypassing RLS — `is_hidden` filter is the only protection for hidden articles

---

## Overview

The MotoLearn monorepo scaffolding (MOT-1 through MOT-4) is complete. This plan covers closing those tickets, generating missing artifacts, establishing test infrastructure, writing comprehensive tests for all existing code, and creating follow-up tickets for discovered issues and future work.

## Problem Statement

The monorepo has zero test files despite test runners being referenced in package.json files. Generated type artifacts (`database.types.ts`, `schema.graphql`) are stubs. CI pipeline has a `test` job that runs nothing. Several bugs were discovered during code review (missing ZodValidationPipe on diagnostics, raw Error throws in services).

## Proposed Solution

Execute in 5 phases: close done tickets → generate artifacts → set up test infrastructure → write tests → create follow-up tickets.

---

## Implementation Phases

### Phase 1: Close Completed Linear Tickets

Mark as Done via Linear API (`curl` with `LINEAR_API_KEY`):

- **MOT-1** (`ea5e76b1`): Setup React Native + Expo project scaffold — DONE
- **MOT-2** (`4d66bf1f`): Setup NestJS + GraphQL backend scaffold — DONE
- **MOT-3** (`8a4dc33c`): Setup Prisma ORM + PostgreSQL schema — DONE (uses Supabase instead of Prisma, equivalent work complete)
- **MOT-4** (`bec564e9`): Setup Supabase project + storage configuration — DONE

### Phase 2: Generate Missing Artifacts

**Prerequisites:** `.env` must have `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`.

#### 2a. Generate database.types.ts (DO THIS FIRST)

```bash
pnpm db:start
pnpm db:reset        # applies all 4 migrations + seed
pnpm generate:types  # populates packages/types/src/database.types.ts
```

**Critical:** This must complete before Phase 3. The typed Supabase mock factory depends on real `Database` types to constrain `TableName`. Without it, all mocks will be untyped `as any` — defeating TypeScript safety.

#### 2b. Generate schema.graphql

```bash
cd apps/api && npx ts-node scripts/generate-schema.ts
```

Requires all env vars. Output: `apps/api/schema.graphql`.

#### 2c. GraphQL Client Types — DEFERRED

No `.graphql` operation files exist yet in mobile/admin. Defer to when first operations are written.

### Phase 3: Test Infrastructure Setup

#### 3a. `apps/api` — Vitest + SWC (CRITICAL)

**Required dependencies:**
```bash
pnpm --filter api add -D unplugin-swc @swc/core vite-tsconfig-paths @golevelup/ts-vitest
```

**Why `unplugin-swc` is mandatory:** Vitest uses esbuild by default, which does NOT emit decorator metadata. NestJS DI relies on `reflect-metadata` from decorators. Without SWC, constructor injection silently fails in tests.

**File: `apps/api/.swcrc`**
```json
{
  "$schema": "https://json.schemastore.org/swcrc",
  "sourceMaps": true,
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true, "dynamicImport": true },
    "transform": { "legacyDecorator": true, "decoratorMetadata": true },
    "keepClassNames": true,
    "baseUrl": "./"
  },
  "minify": false
}
```

**File: `apps/api/vitest.config.ts`**
```typescript
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    pool: 'forks', // Required: avoids reflect-metadata thread isolation issues
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/**/*.model.ts'],
    },
  },
});
```

**File: `apps/api/test/setup.ts`**
```typescript
import 'reflect-metadata';
import { vi } from 'vitest';

vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
vi.stubEnv('SUPABASE_JWT_SECRET', 'test-jwt-secret-that-is-at-least-32-chars-long!!');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
```

**File: `apps/api/test/helpers/supabase-mock.ts`** — Typed chainable mock factory

```typescript
import { vi } from 'vitest';

export function createMockQueryBuilder(response = { data: null, error: null, count: null }) {
  const builder: Record<string, any> = {};
  const chainable = ['from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
    'contains', 'textSearch', 'order', 'limit', 'range', 'match', 'not', 'or', 'filter'];

  for (const method of chainable) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(response);
  builder.maybeSingle = vi.fn().mockResolvedValue(response);
  builder.then = vi.fn((resolve) => resolve(response));

  builder.resolveWith = (res: { data: unknown; error: unknown; count?: number | null }) => {
    response = { ...response, ...res };
    builder.single.mockResolvedValue(response);
    builder.then.mockImplementation((resolve) => resolve(response));
  };

  return builder;
}

export function createMockSupabaseClient() {
  const queryBuilder = createMockQueryBuilder();
  return {
    client: {
      from: vi.fn().mockReturnValue(queryBuilder),
      auth: { getUser: vi.fn(), getSession: vi.fn() },
      storage: { from: vi.fn().mockReturnValue({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
    },
    queryBuilder,
  };
}
```

**File: `apps/api/test/helpers/auth-context.mock.ts`** — Mock GraphQL execution context

```typescript
import { vi } from 'vitest';

export function createMockGqlContext(user?: { id: string; email: string; role: string }, accessToken = 'mock-token') {
  const req = { headers: { authorization: `Bearer ${accessToken}` }, user, accessToken };
  return {
    getContext: () => ({ req }),
    getArgs: () => [{}, {}, { req }, {}],
  };
}
```

#### 3b. `apps/mobile` — Jest + Testing Library

**Required dependencies:**
```bash
pnpm --filter mobile add -D @testing-library/react-native@^13.0.0
```

**Note:** `@testing-library/react-native` v13+ supports React 19 + RN 0.83. `react-test-renderer` is NOT needed and NOT compatible with React 19.

**File: `apps/mobile/jest.config.js`**
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['./test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@urql|urql|zustand)',
  ],
  moduleNameMapper: {
    '^@motolearn/types(.*)$': '<rootDir>/../../packages/types/src$1',
    '^@motolearn/graphql(.*)$': '<rootDir>/../../packages/graphql/src$1',
  },
};
```

**File: `apps/mobile/test/setup.ts`**
```typescript
import '@testing-library/react-native/extend-expect';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));
```

**Expo Router Testing:** Use `expo-router/testing-library` which provides `renderRouter` for testing layouts with file-based routing.

#### 3c. `packages/types` — Vitest

```bash
pnpm --filter @motolearn/types add -D vitest
```

**File: `packages/types/vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
});
```

Add `"test": "vitest run"` to `packages/types/package.json` scripts.

#### 3d. `apps/admin` — Vitest

**File: `apps/admin/vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    alias: { '@/': new URL('./src/', import.meta.url).pathname },
    setupFiles: ['./test/setup.ts'],
  },
});
```

**File: `apps/admin/test/setup.ts`**
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
```

**Key insight:** Use real `NextRequest` constructor (not mocks) — `new NextRequest('http://localhost:3000/dashboard/articles')`.

#### 3e. TypeScript Configuration Fix

Prevent Jest/Vitest type declaration conflicts:

- `apps/mobile/tsconfig.json` — ensure `"types": ["jest"]` in `compilerOptions`
- `apps/api/tsconfig.json` — do NOT include `@types/jest`; Vitest globals come from `vitest/globals`
- `packages/types/tsconfig.json` — same as API

#### 3f. Turborepo Test Cache Optimization

Update `turbo.json` test task:

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": ["src/**", "test/**", "vitest.config.*", "jest.config.*", "tsconfig.json", "package.json"],
  "outputs": ["coverage/**"],
  "cache": true
}
```

Remove global `env` from test task — only API needs Supabase env vars, and tests should mock everything.

### Phase 4: Write Tests

**Naming convention:** `*.spec.ts` in `apps/api`, `*.test.ts` in `packages/types` and `apps/mobile`.
**File placement:** Co-located in API modules (next to source), `__tests__/` in packages/types validators.

#### 4a. `packages/types` — Zod Validator Tests

**6 categories per schema:** happy path → missing required → invalid enum/format → boundary values → UUID format → default/optional behavior.

| File | Test File | Coverage |
|------|-----------|----------|
| `validators/article.ts` | `validators/__tests__/article.test.ts` | Valid/invalid, category/difficulty enums, slug format, empty sections edge case |
| `validators/motorcycle.ts` | `validators/__tests__/motorcycle.test.ts` | Year bounds (MIN/MAX_MOTORCYCLE_YEAR), required make/model, optional nickname |
| `validators/user.ts` | `validators/__tests__/user.test.ts` | All-optional UpdateUserSchema, role enum, fullName max(200) |
| `validators/quiz.ts` | `validators/__tests__/quiz.test.ts` | Options min(2)/max(6), correctIndex bounds, UUID quizId, answers array |
| `validators/diagnostic.ts` | `validators/__tests__/diagnostic.test.ts` | Severity enum, UUID motorcycleId, `dataSharingOptedIn` defaults to `false`, `wizardAnswers` record validation |
| `validators/content-flag.ts` | `validators/__tests__/content-flag.test.ts` | UUID articleId, comment max(1000), optional sectionReference |

**Important:** Verify enum values are non-empty (guards against empty `as [string, ...string[]]` cast silently accepting nothing).

#### 4b. `apps/api` — Common Infrastructure Tests

| Component | Test File | Key Test Cases |
|-----------|-----------|----------------|
| `GqlAuthGuard` | `common/guards/gql-auth.guard.spec.ts` | See security section below |
| `ZodValidationPipe` | `common/pipes/zod-validation.pipe.spec.ts` | Valid input passes, invalid throws BadRequestException, strips unknown fields, prototype pollution payload rejected |
| `AllExceptionsFilter` | `common/filters/gql-exception.filter.spec.ts` | All 7 HTTP→GraphQL mappings (400→BAD_USER_INPUT, 401→UNAUTHENTICATED, 403→FORBIDDEN, 404→NOT_FOUND, 409→CONFLICT, 429→TOO_MANY_REQUESTS, 5xx→INTERNAL_SERVER_ERROR), unknown→fallback, NO stack trace in response |
| `CurrentUser` decorator | `common/decorators/current-user.decorator.spec.ts` | Extracts user from request, returns undefined when no user |

**Auth Guard Security Test Cases (comprehensive):**

| Test Case | Rationale |
|-----------|-----------|
| Valid JWT → sets user on request | Happy path |
| Expired JWT → UNAUTHENTICATED | Standard expiry |
| Missing Authorization header → UNAUTHENTICATED | No token |
| `Bearer ` (empty token after prefix) | Edge case |
| `Basic abc123` (wrong scheme) | Must reject non-Bearer |
| `bearer token` (lowercase) | Case sensitivity |
| `BearerXYZ` (no space) | Format validation |
| `alg: none` token | Classic JWT bypass attack |
| Token signed with different key | Wrong issuer |
| Missing `sub` claim in payload | Prevents undefined `user.id` flowing to queries |
| Malformed JWT (not 3 segments) | Garbage input |
| Extremely long token (>8KB) | DoS prevention |
| JWT with `user_role: admin` but no `app_metadata.role` | Role escalation via `raw_user_meta_data` — must not grant admin |

#### 4c. `apps/api` — Service Tests (7 services)

**Performance optimization:** Use direct construction, NOT `Test.createTestingModule`:

```typescript
// FAST (~5ms setup):
const adminMock = createMockSupabaseClient();
const userMock = createMockSupabaseClient();
const service = new ArticlesService(adminMock.client, userMock.client);
```

Reserve `Test.createTestingModule` for 2-3 integration tests that verify the full DI pipeline.

| Service | Test File | Key Scenarios |
|---------|-----------|---------------|
| `UsersService` | `modules/users/users.service.spec.ts` | `me()` returns mapped user, `findOne()` by id, update user, user not found → NotFoundException |
| `MotorcyclesService` | `modules/motorcycles/motorcycles.service.spec.ts` | List motorcycles with `.limit(20)`, create motorcycle, error path |
| `ArticlesService` | `modules/articles/articles.service.spec.ts` | Search with filters, cursor pagination (fetch first+1, trim, hasNextPage), article by slug, not found, hidden articles excluded |
| `QuizzesService` | `modules/quizzes/quizzes.service.spec.ts` | Get quiz by article, submit attempt, invalid quiz → Error (document current bug) |
| `DiagnosticsService` | `modules/diagnostics/diagnostics.service.spec.ts` | List diagnostics with `.limit(50)`, create diagnostic |
| `ContentFlagsService` | `modules/content-flags/content-flags.service.spec.ts` | Create flag, failure → Error (document current bug) |
| `LearningProgressService` | `modules/learning-progress/learning-progress.service.spec.ts` | Get progress with `.limit(50)`, mark article read, upsert for duplicate |

**Cross-cutting test from learnings doc:**
- Verify all list queries use explicit column lists (not `SELECT *`)
- Verify all list queries have `.limit()` call
- Verify `.map()` uses arrow functions (not `this.mapRow` direct reference which loses context)

#### 4d. `apps/api` — Resolver Tests (7 resolvers)

Mock services, verify guard/pipe decorators via `Reflect.getMetadata()`.

**Pre-requisite fix:** Change `ZodValidationPipe.schema` from `private` to `readonly` so tests can verify which schema is bound to which endpoint.

| Resolver | Test File | Key Verifications |
|----------|-----------|-------------------|
| `UsersResolver` | `modules/users/users.resolver.spec.ts` | Guard applied, ZodPipe on updateUser, delegates to service |
| `MotorcyclesResolver` | `modules/motorcycles/motorcycles.resolver.spec.ts` | Guard applied, ZodPipe on createMotorcycle |
| `ArticlesResolver` | `modules/articles/articles.resolver.spec.ts` | NO guard (public — assert absence), pagination args passed |
| `QuizzesResolver` | `modules/quizzes/quizzes.resolver.spec.ts` | Guard applied, ZodPipe on submitQuiz |
| `DiagnosticsResolver` | `modules/diagnostics/diagnostics.resolver.spec.ts` | Guard applied, **ZodPipe MISSING — test documents the bug** |
| `ContentFlagsResolver` | `modules/content-flags/content-flags.resolver.spec.ts` | Guard applied, ZodPipe on createFlag |
| `LearningProgressResolver` | `modules/learning-progress/learning-progress.resolver.spec.ts` | Guard applied |

**Plus 2-3 integration tests** using `Test.createTestingModule` that exercise the full NestJS pipeline (guard → pipe → resolver → service) for representative modules (e.g., motorcycles, articles).

#### 4e. `apps/mobile` — Component Tests

Use `expo-router/testing-library` with `renderRouter` for layout tests. Use `@testing-library/react-native` for screen tests.

| Component | Test File | Key Scenarios |
|-----------|-----------|---------------|
| Root `_layout.tsx` | `app/__tests__/_layout.test.tsx` | Redirects unauthenticated to login, redirects authenticated away from auth screens, shows nothing while loading |
| Tab `_layout.tsx` | `app/(tabs)/__tests__/_layout.test.tsx` | Renders 4 tabs (Learn, Diagnose, Garage, Profile) |
| `login.tsx` | `app/(auth)/__tests__/login.test.tsx` | Renders form, calls `signInWithPassword`, handles error display |
| `auth.store.ts` | `stores/__tests__/auth.store.test.ts` | Initial state, `setSession`, `setLoading` (use `useAuthStore.setState()` directly — type-safe with Zustand) |

#### 4f. `apps/admin` — Middleware Test

| Component | Test File | Key Scenarios |
|-----------|-----------|---------------|
| `middleware.ts` | `src/middleware.spec.ts` | No session → redirect, non-admin → redirect, admin via JWT fast-path → pass, admin via DB fallback → pass, no cookies → redirect |

Construct real `NextRequest` objects. Mock `@supabase/ssr`'s `createServerClient` at module boundary.

### Phase 5: Create Follow-Up Linear Tickets

Create in MOT team via Linear API:

| Title | Priority | Rationale |
|-------|----------|-----------|
| Fix: Add ZodValidationPipe to createDiagnostic resolver | Urgent | Input validation missing — accepts any string for motorcycleId, arbitrary JSON for wizardAnswers |
| Fix: Replace raw Error throws with NestJS exceptions in QuizzesService & ContentFlagsService | High | Wrong error classification: "not found" errors return 500 instead of 404 |
| Fix: Type `mapRow` parameters with Database row types | High | All services use `mapRow(row: any)` — defeats TypeScript safety |
| Chore: Write .graphql operation files for mobile app | High | Required before `pnpm generate` produces useful client types |
| Chore: Add tab icons to bottom navigation | Medium | MOT-21 partially done — tabs work but have no icons |
| Chore: Configure test coverage reporting in CI | Medium | Add coverage thresholds (80%+ for new code) |
| Chore: Switch articles service to anon client for RLS defense-in-depth | Medium | Currently uses adminClient, bypassing RLS — `is_hidden` filter is only protection |
| Fix: Add UUID validation to bare string args (articleId, slug) | Low | `quizByArticle(articleId)`, `articleBySlug(slug)` accept unvalidated strings |
| Chore: Add secret scanning to CI (gitleaks/trufflehog) | Low | Prevent accidental `.env` commits |

---

## Acceptance Criteria

- [x] MOT-1, MOT-2, MOT-3, MOT-4 marked Done in Linear
- [ ] `database.types.ts` populated with real types (if local Supabase available) — skipped, Supabase CLI incompatible
- [ ] `schema.graphql` generated and committed — skipped, requires running API server
- [x] `unplugin-swc` + `.swcrc` configured for API Vitest
- [x] Test infrastructure configured in all workspaces (api, mobile, types, admin)
- [x] Shared Supabase mock helper created with typed chainable factory
- [x] All 6 Zod validators have tests (6 categories: happy, required, enum, boundary, UUID, defaults)
- [x] Auth guard has comprehensive security tests (13+ scenarios including `alg:none`, role escalation)
- [x] ZodValidationPipe, exception filter, CurrentUser decorator tested
- [x] All 7 services have unit tests with mocked Supabase (direct construction)
- [x] All 7 resolvers have tests verifying guard/pipe application via metadata
- [ ] 2-3 integration tests exercise full NestJS pipeline — deferred to follow-up
- [x] Mobile auth flow (login screen, root layout, tab layout, auth store) tested
- [x] Admin middleware auth + role check tested
- [x] `pnpm test` passes across all workspaces (237 tests)
- [x] CI pipeline passes with Turbo cache optimization
- [x] Follow-up tickets created in Linear for discovered bugs and remaining work (MOT-45 through MOT-53)

## Dependencies & Risks

- **BLOCKER:** `unplugin-swc` must be installed — without it, NestJS DI silently fails in Vitest
- **BLOCKER:** `database.types.ts` should be generated before building typed mock factory
- **Risk:** `@testing-library/react-native` v13 compatibility with Expo 55 — verify before proceeding
- **Risk:** Mixed Jest/Vitest type declarations — must isolate `types` field per workspace tsconfig
- **Risk:** `SUPABASE_USER` is request-scoped — must override with `.overrideProvider()` in integration tests
- **Dependency:** `ZodValidationPipe.schema` must change from `private` to `readonly` before resolver metadata tests

## Sources & References

- Solution doc: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
- CLAUDE.md project conventions
- [NestJS SWC Recipe](https://docs.nestjs.com/recipes/swc) — `unplugin-swc` requirement
- [Vitest + NestJS](https://blog.ablo.ai/jest-to-vitest-in-nestjs) — migration patterns
- [@golevelup/ts-vitest](https://www.npmjs.com/package/@golevelup/ts-vitest) — type-safe NestJS mocks
- [Expo Router Testing](https://docs.expo.dev/router/reference/testing/) — `renderRouter` API
- [@testing-library/react-native v13](https://github.com/callstack/react-native-testing-library) — React 19 support
- [Turborepo + Vitest Guide](https://turborepo.dev/docs/guides/tools/vitest) — monorepo configuration
- [Supabase PostgREST Builder](https://github.com/supabase/postgrest-js) — chainable mock API shape
- Key files: `apps/api/src/common/guards/gql-auth.guard.ts`, `apps/api/src/common/pipes/zod-validation.pipe.ts`, `apps/api/src/modules/diagnostics/diagnostics.resolver.ts:22` (missing ZodPipe)
