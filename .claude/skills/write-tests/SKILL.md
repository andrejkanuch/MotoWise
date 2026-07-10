---
name: write-tests
description: Write unit/integration tests for API services & resolvers, web logic, and mobile utils, plus E2E flows. Use when writing tests, adding coverage, or reviewing test quality in MotoVault.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Write Tests (MotoVault)

MotoVault is a Turborepo monorepo. Test runners differ per app — match the one that's already there:

| Target | Runner | Command |
|--------|--------|---------|
| `apps/api` (NestJS) | Vitest | `pnpm --filter @motovault/api test` |
| `apps/web` (Next.js) | Vitest | `pnpm --filter @motovault/web test` |
| `apps/mobile` (Expo) | jest-expo | `pnpm --filter @motovault/mobile test` |
| `packages/*` | Vitest | `pnpm --filter <pkg> test` |
| Web E2E | Playwright | `pnpm --filter @motovault/web exec playwright test` (`apps/web/e2e/`) |
| Mobile E2E | Maestro | `pnpm --filter @motovault/mobile test:e2e` (`apps/mobile/.maestro/`) |

Full gate: `pnpm precheck` (api-bans → router → arch → lint → typecheck → test).

## Decision: what layer, what approach

```text
Pure logic (cursors, filters, mappers, formatters, Zod schemas, date math)
    → unit test, NO mocks. This is the bulk of MotoVault's suite and where it's strongest.

NestJS service that calls Supabase
    → default: mock the injected Supabase client (see SUPABASE_TESTING.md — the CLEAN
      pattern, never the brittle callIndex chain).
    → when the logic IS the SQL/RLS (complex filters, joins, RLS author checks,
      column-level grants): prefer a real local Supabase DB (see SUPABASE_TESTING.md).

NestJS resolver
    → mock the service; assert the resolver maps snake_case → camelCase and shapes
      the GraphQL contract. Don't re-test the service through the resolver.

External APIs (Claude/Anthropic, NHTSA vPIC, RevenueCat, Mapbox, PostHog)
    → always mock. Never hit the network in a unit test.

Mobile screens/hooks
    → jest-expo + @testing-library/react-native for logic-bearing hooks and utils.
      Full user journeys belong in Maestro E2E, not jest.
```

### Never do this (brittle mock chains)

```ts
// BAD — tracks query order, breaks on any refactor
let callIndex = 0;
mockDb.from.mockImplementation(() => (callIndex++ % 3 === 0 ? snapA : snapB));
```

If a service needs a mock this contorted, that's the signal to use a real local Supabase DB instead (see `SUPABASE_TESTING.md`).

## Conventions (match the existing suite)

- **AAA structure** with `// Arrange / // Act / // Assert` comments.
- **BDD names describe behavior, not implementation**:
  - GOOD: `it('rejects a SQL-injection attempt embedded in a cursor part', ...)`
  - BAD: `it('calls decodeCursor with base64', ...)`
- **`vi.clearAllMocks()` in `beforeEach`** (Vitest) / `jest.clearAllMocks()` (mobile).
- **Parameterize repetition** with `it.each([...])`.
- **Named constants over magic numbers/strings** (aligns with the no-magic-strings rule — use `as const`).
- **No `any`** — especially no `any` for GraphQL data; use generated types from `@motovault/graphql`.
- **One behavior per test**; each test independent (no shared mutable state between tests).

## Essential scenarios per unit under test

Happy path · boundary conditions (exact start/end, off-by-one) · empty/null inputs ·
error conditions (invalid input, DB error, external failure) · idempotency (run twice → same result) ·
legacy/back-compat inputs (old mobile bundles hitting new API) · injection/hostile input for anything that parses untrusted strings.

## Progress checklist

- [ ] Tests pass: `pnpm --filter <pkg> test`
- [ ] Types pass: `pnpm typecheck`
- [ ] No `any`; GraphQL data uses `@motovault/graphql` types
- [ ] AAA + behavior-focused names
- [ ] Boundary + error + idempotency cases covered, not just happy path
- [ ] No brittle order-dependent mock chains (real DB instead — see `SUPABASE_TESTING.md`)
- [ ] External APIs mocked; no network in unit tests
- [ ] For user-facing flows: an E2E exists (Playwright web / Maestro mobile)

See `SUPABASE_TESTING.md` for the Supabase service-test patterns (clean mock + real local DB).
See `E2E.md` for Playwright (web) and Maestro (mobile) guidance.
