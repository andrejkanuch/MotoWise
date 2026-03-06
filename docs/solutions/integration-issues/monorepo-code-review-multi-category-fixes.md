---
title: "MotoLearn Monorepo: Comprehensive Code Review Fixes"
problem_type: integration_issue
components:
  - apps/api (NestJS GraphQL)
  - apps/mobile (Expo 55)
  - apps/admin (Next.js 16)
  - packages/types
  - supabase/migrations
severity: critical
date_resolved: 2026-03-06
tags:
  - code-review
  - security
  - performance
  - architecture
  - rls
  - graphql
  - nestjs
  - expo
  - supabase
---

# MotoLearn Monorepo: Comprehensive Code Review Fixes

## Problem

After initial scaffolding of the MotoLearn monorepo (Turborepo + pnpm, NestJS 11, Expo 55, Next.js 16, Supabase), a multi-agent code review identified 34 findings across security, performance, architecture, and code quality categories. Issues ranged from a critical RLS privilege escalation vulnerability to missing input validation, unbounded queries, and incorrect error handling.

## Symptoms

- **Security**: Users could self-promote to admin role via RLS policy missing `WITH CHECK` clause
- **Runtime bugs**: `.map(this.mapRow)` lost `this` binding causing crashes; cursor-based pagination used UUID instead of timestamp
- **GraphQL errors**: Numeric HTTP codes returned instead of string codes (e.g., 401 instead of 'UNAUTHENTICATED'), breaking client token refresh
- **Performance**: `SELECT *` queries, unbounded list queries (no LIMIT), admin middleware making 2 network calls per request
- **Architecture**: Duplicate auth service, Zod validation pipe defined but never wired to resolvers, GraphQL enums registered as strings

## Investigation

Five specialized review agents analyzed the codebase in parallel:
1. **Security Sentinel** — Found RLS privilege escalation (P1), JWT role trust issue (P2)
2. **TypeScript Reviewer** — Found `this` binding bugs, `as any` casts, missing type safety
3. **Performance Oracle** — Found SELECT *, unbounded queries, per-request Supabase overhead
4. **Architecture Strategist** — Found duplicate services, unused code (YAGNI), enum duplication
5. **Code Simplicity Reviewer** — Found dead code, redundant patterns, missing validation wiring

## Root Cause

The issues stemmed from the initial scaffolding phase where:
1. RLS policies were created with `USING` but missing `WITH CHECK` for UPDATE operations
2. Service methods used `.map(this.mapRow)` which detaches `this` context in JavaScript
3. Error filter mapped HTTP status to numeric codes instead of GraphQL string conventions
4. Validation infrastructure (ZodValidationPipe) was built but not connected to resolvers
5. Both AuthService and UsersService duplicated user lookup logic
6. AI service stubs were scaffolded prematurely (YAGNI violation)

## Solution

### Wave 1 — Foundation (12 parallel agents, no dependencies)

These changes had no interdependencies and were resolved simultaneously:

**Critical Security (P1):**
- `supabase/migrations/00004_fix_rls_role_escalation.sql` — Added `WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()))` to prevent role self-escalation
- `apps/api/src/common/filters/gql-exception.filter.ts` — Rewrote to map HTTP codes to GraphQL strings: 401->'UNAUTHENTICATED', 403->'FORBIDDEN', 404->'NOT_FOUND', 409->'CONFLICT', 429->'TOO_MANY_REQUESTS', 5xx->'INTERNAL_SERVER_ERROR'

**Architecture (P2):**
- Deleted `apps/api/src/modules/auth/` (resolver, service, module) — merged `me` query into UsersResolver
- Deleted AI service stubs (`article-generator.service.ts`, `diagnostic-ai.service.ts`, `quiz-generator.service.ts`) — YAGNI
- Removed unused constants (`FREE_TIER_*`, `MAX_PHOTO_SIZE_BYTES`) and `DiagnosticDifficulty` enum

**Performance (P2):**
- Replaced `SELECT *` with explicit column lists in articles, diagnostics, motorcycles, learning-progress services
- Added `.limit()` to all list queries: diagnostics(50), learning-progress(50), motorcycles(20)
- Added `persistSession: false, autoRefreshToken: false` to per-request Supabase client

**Code Quality (P2-P3):**
- Fixed `.map(this.mapRow)` -> `.map((row) => this.mapRow(row))` in 3 services
- Replaced `as any` quiz JSON casts with Zod schema validation
- Added env validation guards to mobile Supabase/urql clients
- Fixed admin: `<a>` -> `<Link>`, `window.location.href` -> `router.push()`

### Wave 2 — Dependent Changes (20 parallel agents)

These required Wave 1 completions:

- **Zod enum derivation** (depended on unused enum removal) — Derived Zod enums from `as const` objects
- **GraphQL enum registration** (depended on Zod enums) — Created `graphql-enums.ts` with `registerEnumType` for 5 enums
- **ZodValidationPipe wiring** (depended on auth merger) — Wired to all mutation resolvers
- **GqlThrottlerGuard** — Custom throttler extracting req/res from GraphQL context, registered globally
- **GraphQL depth limiting** — Added `depthLimit(7)` to validation rules
- **Pagination cursor fix** — Changed from UUID to `generated_at` timestamp
- **Mobile tabs layout** — Created proper `(tabs)/_layout.tsx` with 4 NativeTabs
- **Admin HSTS header** — Added `Strict-Transport-Security` to Next.js config
- **urql cache reset** — `useMemo` keyed on session user ID to reset cache on logout
- **CI pipeline** — Removed `continue-on-error`, added `--audit-level=critical`

### Total Impact
- **98 files changed**: +1,738 lines added, -204 removed
- **6 files deleted** (dead code removal)
- **1 new migration** (RLS fix)
- **All 34 findings resolved** in a single atomic commit

## Verification

- `npx tsc --noEmit` — No new TypeScript errors introduced (pre-existing TS2564/TS1272/TS1479 remain)
- All changes verified against todo acceptance criteria
- RLS fix validated: UPDATE policy now prevents role column modification

## Prevention Strategies

### Security
- **RLS checklist**: Every new table migration must include both `USING` (read) and `WITH CHECK` (write) clauses. Review all UPDATE/INSERT policies for column-level restrictions.
- **Error codes**: Use a centralized mapping (gql-exception.filter.ts) — never return raw HTTP status codes in GraphQL extensions.

### Code Quality
- **Never use `.map(this.method)`** — Always use `.map((item) => this.method(item))` or `.map(this.method.bind(this))` to preserve context.
- **Wire validation at creation** — When adding ZodValidationPipe infrastructure, immediately wire it to at least one resolver as proof of integration.
- **No premature stubs** — Don't scaffold service files until the feature is being actively implemented.

### Performance
- **Explicit SELECT columns** — Never use `SELECT *` in production services. List columns explicitly.
- **Always LIMIT list queries** — Every `.select()` that returns multiple rows must have a `.limit()`.
- **Per-request clients** — Disable session persistence and auto-refresh on ephemeral Supabase clients.

### Architecture
- **Single responsibility** — If two services do the same thing (auth vs users), merge immediately. Don't wait for it to become a problem.
- **Enum single source of truth** — Define as `as const` objects in packages/types, derive Zod schemas from them, register GraphQL enums from them. One source, three consumers.

## Key Files

| File | Change |
|------|--------|
| `supabase/migrations/00004_fix_rls_role_escalation.sql` | RLS WITH CHECK fix |
| `apps/api/src/common/filters/gql-exception.filter.ts` | GraphQL error code mapping |
| `apps/api/src/common/guards/gql-throttler.guard.ts` | Rate limiting for GraphQL |
| `apps/api/src/common/enums/graphql-enums.ts` | Enum type registration |
| `apps/api/src/app.module.ts` | Depth limit, throttler, enum import |
| `apps/api/src/modules/articles/articles.service.ts` | Pagination, SELECT, client fixes |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | Tab navigator layout |
| `packages/types/src/validators/*.ts` | Zod enum derivation |

## Cross-References

- All 34 todo files in `todos/` (001-034, all status: complete)
- Plan: `docs/plans/2026-03-06-feat-motolearn-monorepo-setup-plan.md`
