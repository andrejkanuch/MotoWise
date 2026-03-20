---
title: "feat: Backend GraphQL Test Coverage for Core Features"
type: feat
status: active
date: 2026-03-20
---

# Backend GraphQL Test Coverage for Core Features

## Enhancement Summary

**Deepened on:** 2026-03-20
**Sections enhanced:** All
**Review agents used:** Security Sentinel, Architecture Strategist, Code Simplicity Reviewer, Vitest Documentation

### Key Improvements
1. Dropped shared test-utils directory — inline mocks match established pattern and are simpler
2. Added critical security test cases from security review (JWT iss/aud, algorithm confusion, path traversal)
3. Collapsed 6 phases into flat ordered checklist — no false dependencies
4. Removed thin resolver delegation tests (YAGNI) — kept guard audit + behavior-only tests
5. Fixed OEM auto-populate test location (it's in the resolver, not the service)

### Security Findings (from Security Sentinel review)
- **CRITICAL**: GqlAuthGuard does not validate `iss`/`aud` claims — code fix + test needed
- **CRITICAL**: `kid` presence as sole algorithm selector enables algorithm confusion attacks
- **HIGH**: `storagePath` in `addPhoto` has no path traversal validation
- **HIGH**: Missing `ParseUUIDPipe` on `spendingSummary.motorcycleId` and `deleteTaskPhoto.photoId`

---

## Overview

The API has 14 resolvers and ~19 services but only 3 spec files. We need systematic test coverage starting with security-critical infrastructure and core business features.

## Problem Statement / Motivation

Current test coverage is extremely sparse — 3 spec files across the entire API. Security-critical code (auth guard, validation pipe) has zero tests. Core business features (motorcycles, expenses, maintenance tasks, users) have no resolver or service tests. A broken guard or validation pipe could ship undetected.

## Proposed Solution

Add test coverage in priority order. No shared test utilities — inline mocks per the established codebase pattern.

Files to create (10 total):
1. `gql-auth.guard.spec.ts` — security boundary
2. `zod-validation.pipe.spec.ts` — input validation
3. `motorcycles.resolver.spec.ts` — guard audit + OEM error handling
4. `motorcycles.service.spec.ts` — core CRUD + tier enforcement
5. `nhtsa.service.spec.ts` — external API + caching
6. `expenses.resolver.spec.ts` — guard audit
7. `expenses.service.spec.ts` — financial data CRUD + dashboard
8. `maintenance-tasks.resolver.spec.ts` — guard audit
9. `maintenance-tasks.service.spec.ts` — state machine + recurrence + photos
10. `users.service.spec.ts` — account lifecycle + data export

## Technical Approach

### Test Patterns (follow established codebase conventions)

- **Vitest 3.x** (already configured)
- **Direct constructor instantiation** with manual mocks (no `Test.createTestingModule`)
- **Inline Supabase mocks** — 3-5 lines of `vi.fn().mockReturnValue(...)` chaining per test (matches `diagnostic-ai.service.spec.ts` pattern)
- **Guard audit** — copy the `Reflect.getMetadata` helper from `articles.resolver.spec.ts` into each resolver spec (5 lines, not worth extracting)
- **vi.mock('jose')** for auth guard tests — note: guard uses `await import('jose')` (dynamic import), Vitest hoists `vi.mock` above imports so this works
- **`vi.clearAllMocks()` in `beforeEach`** for isolation
- **`as never` / `as unknown as Type`** for mock type casting

### Research Insights

**Vitest patterns:**
- Use `vi.mocked(fn)` for TypeScript-safe mock access
- Use `mockResolvedValueOnce` for test-specific return values (not `mockResolvedValue` which persists)
- Use `vi.useFakeTimers()` + `vi.setSystemTime()` for time-dependent tests (rate limiting, cache TTL)
- Use `vi.restoreAllMocks()` in `afterEach` to prevent state leaks

**Architecture decision (from review):**
- Direct instantiation is correct for this codebase — no complex DI, no circular deps
- `SUPABASE_USER` is request-scoped but unit tests sidestep this — acceptable for unit tests
- Integration tests (using real NestJS pipeline) are a separate future effort, not in this plan's scope

---

## Test File Checklist

### 1. GqlAuthGuard (`apps/api/src/common/guards/gql-auth.guard.spec.ts`)

The security boundary for the entire API. Mock `jose` at module level.

**Happy paths:**
- [ ] Returns `true` for routes decorated with `@Public()`
- [ ] Validates HS256 tokens (no `kid`) using shared secret, extracts `sub` + `email`
- [ ] Validates asymmetric tokens (`kid` present) using JWKS
- [ ] Stores raw token on `request.accessToken`
- [ ] Role extraction chain: `app_metadata.role` > `user_role` claim > `'user'` default

**Error paths:**
- [ ] Throws `UnauthorizedException` when Authorization header is missing
- [ ] Throws `UnauthorizedException` for malformed header (no `Bearer ` prefix)
- [ ] Throws `UnauthorizedException` for expired tokens
- [ ] Throws `UnauthorizedException` for tampered/invalid signature

**Security-critical (from security review):**
- [ ] Rejects token with valid signature but wrong `iss` claim (different Supabase project)
- [ ] Rejects token with `alg: RS256` but no `kid` — should NOT fall through to HS256
- [ ] Rejects token with `alg: HS256` and fabricated `kid` — should NOT route to JWKS
- [ ] Role extraction: `user_role: 'admin'` without `app_metadata.role` — verify behavior and document
- [ ] Missing `app_metadata` entirely (not an object) — falls through to default `'user'`

> **Note:** Tests for `iss`/`aud` and algorithm confusion may require code fixes first. Write the test, see it fail, fix the guard, see it pass.

### 2. ZodValidationPipe (`apps/api/src/common/pipes/zod-validation.pipe.spec.ts`)

- [ ] Returns `result.data` for valid input (uses a real Zod schema, e.g. `CreateMaintenanceTaskSchema`)
- [ ] Throws `BadRequestException` with flattened field errors for invalid input
- [ ] Passes through `null`/`undefined` input (no schema validation)
- [ ] Applies Zod `.default()` values (e.g., priority defaults to `'medium'`)
- [ ] Handles schema with `.transform()` — returns transformed data, not raw input

### 3. Motorcycles Resolver (`apps/api/src/modules/motorcycles/motorcycles.resolver.spec.ts`)

- [ ] Guard audit: all mutations and queries have `@UseGuards(GqlAuthGuard)`
- [ ] `createMotorcycle`: OEM auto-populate fires after creation (verify mock called)
- [ ] `createMotorcycle`: if OEM auto-populate throws, motorcycle is still returned (catch swallows error)

> **Note (from architecture review):** The try/catch for `oemSchedulesService.autoPopulateForBike` is in the resolver, not the service. Test it here.

### 4. Motorcycles Service (`apps/api/src/modules/motorcycles/motorcycles.service.spec.ts`)

- [ ] `findByUser` queries with user_id, maps full snake_case → camelCase shape (assert all fields)
- [ ] `create` inserts row, returns mapped result
- [ ] `update` builds partial update object, scopes by user_id
- [ ] `softDelete` calls RPC, returns true on success
- [ ] `softDelete` throws NotFoundException when RPC returns `false`
- [ ] `enforceFreeTierBikeLimit` throws ForbiddenException at limit
- [ ] `enforceFreeTierBikeLimit` fails open on DB error — add comment: "Intentional: DB outage should not block bike creation"

### 5. NHTSA Service (`apps/api/src/modules/motorcycles/nhtsa.service.spec.ts`)

- [ ] `getMakes` returns cached data on cache hit (no fetch)
- [ ] `getMakes` fetches from API on cache miss, sorts popular-first
- [ ] `getMakes` throws `ServiceUnavailableException` on API timeout (10s AbortController)
- [ ] `getMakes` throws on non-200 response
- [ ] `getModels` returns cached data, fetches on miss
- [ ] `getModels` LRU eviction at 500 entries
- [ ] Empty NHTSA response returns `[]`

> Use `vi.useFakeTimers()` for cache TTL tests if testing expiration.

### 6. Expenses Resolver (`apps/api/src/modules/expenses/expenses.resolver.spec.ts`)

- [ ] Guard audit: all mutations/queries have `@UseGuards(GqlAuthGuard)`

### 7. Expenses Service (`apps/api/src/modules/expenses/expenses.service.spec.ts`)

- [ ] `findByMotorcycle` queries with motorcycle_id, optional year filter
- [ ] `findByMotorcycle` maps `amount` string to number correctly (`"99.99"` → `99.99`, `"0.00"` → `0`)
- [ ] `logExpense` inserts with correct snake_case mapping
- [ ] `deleteExpense` sets `deleted_at`, scopes by user_id
- [ ] `createFromTask` suppresses duplicate (Postgres error code `23505`)
- [ ] `getDashboard` aggregates monthly buckets and category totals
- [ ] Year=0 means all-time (no year filter applied)

### 8. Maintenance Tasks Resolver (`apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.spec.ts`)

- [ ] Guard audit: all mutations/queries have `@UseGuards(GqlAuthGuard)`

### 9. Maintenance Tasks Service (`apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.spec.ts`)

- [ ] `findAllForUser` filters pending/in_progress tasks
- [ ] `findByMotorcycle` scopes by motorcycle_id
- [ ] `create` inserts with priority default
- [ ] `complete` transitions status to 'completed', calls auto-expense creation (verify mock)
- [ ] `complete` throws `BadRequestException` for already-completed task (not found by status filter)
- [ ] `createNextRecurrence` calculates next due date from `intervalDays`
- [ ] `createNextRecurrence` calculates next target mileage from `intervalKm`
- [ ] `softDelete` calls RPC, throws `NotFoundException` on `false`
- [ ] `addPhoto` enforces 5-photo limit
- [ ] `addPhoto` verifies task ownership via user_id check
- [ ] `deletePhoto` verifies ownership indirectly via task lookup

### 10. Users Service (`apps/api/src/modules/users/users.service.spec.ts`)

- [ ] `findById` queries by id, maps result
- [ ] `update` merges preferences with existing (preserves unmodified fields)
- [ ] `completeOnboarding` calls RPC with correct payload shape
- [ ] `deleteAccount` calls soft delete RPC
- [ ] `deleteAccount` fires RevenueCat cancel (verify mock called; failure doesn't throw)
- [ ] `deleteAccount` fires email notification (verify mock called; failure doesn't throw)
- [ ] `requestDataExport` enforces 24h rate limit (use `vi.setSystemTime()`)
- [ ] `requestDataExport` returns success immediately (background compilation is fire-and-forget)

---

## Dependencies & Risks

- **No risk to production** — all changes are test files only
- **Risk: Mock drift** — inline Supabase mocks may diverge from real client. Mitigated by testing full return shapes (assert all mapped fields, not just existence)
- **Assumption: RLS handles authorization for soft_delete RPCs** — document in test comments
- **jose dynamic imports** — guard uses `await import('jose')`, Vitest `vi.mock('jose')` hoisting handles this, but verify during implementation
- **Security code fixes may be needed** — JWT `iss`/`aud` validation and algorithm confusion tests may fail initially, requiring guard code changes

## Success Metrics

- All 10 test files created and passing
- Every public method on priority services has at least 1 happy-path + 1 error-path test
- Guard audit covers all 4 priority resolvers
- Auth guard has security-critical test cases (iss/aud, algorithm confusion)
- `pnpm --filter api test` passes with 0 failures

## Sources & References

- Existing test patterns: `apps/api/src/modules/articles/articles.resolver.spec.ts`, `apps/api/src/modules/diagnostics/diagnostic-ai.service.spec.ts`, `apps/api/src/common/interceptors/locale.interceptor.spec.ts`
- NestJS testing docs: https://docs.nestjs.com/fundamentals/testing
- Vitest docs: https://vitest.dev/guide/
- Security review findings: JWT iss/aud validation, algorithm confusion, path traversal
