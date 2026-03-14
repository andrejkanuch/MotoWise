---
title: "RLS Bypass: Using adminClient for Public Read Queries"
category: security-issues
date: 2026-03-15
tags: [supabase, rls, admin-client, anon-client, nestjs, graphql]
module: Articles
symptom: "Public GraphQL queries using service-role client instead of anon client, bypassing RLS"
root_cause: "New service methods (findPopular, findSimilar) injected SUPABASE_ADMIN and used it for read-only queries on public data"
---

## Problem

When adding new read-only queries to `ArticlesService` (e.g., `findPopular`, `findSimilar`), the `adminClient` (service-role) was used instead of `anonClient`. These queries were exposed via `@Public()` GraphQL resolvers, meaning unauthenticated users could trigger queries that bypass all RLS policies.

The existing methods (`search`, `findBySlug`, `findBySlugFull`) correctly used `anonClient`, but new methods defaulted to `adminClient` — likely because the developer needed to query columns not yet in the generated DB types and reached for the admin client as a quick workaround.

## Root Cause

Two compounding factors:

1. **Convenience over correctness**: `adminClient` was used because the `keywords` column wasn't in `database.types.ts` yet (migration not yet deployed), so `as any` was needed regardless — but the developer chose adminClient as a "just works" escape hatch.

2. **No lint/review gate**: Nothing prevents using `adminClient` in a service that also has `anonClient` injected. Both are `SupabaseClient` types with identical APIs, so TypeScript can't distinguish them.

## Impact

- RLS policies on `articles` table bypassed entirely for popular/similar queries
- If the `is_hidden` code filter were accidentally removed, hidden/flagged articles would be exposed
- `findSimilar` had no `is_hidden` filter at all (relied on RLS which was bypassed), meaning hidden articles could appear as "similar" suggestions

## Solution

1. Switch all read queries to `anonClient`:

```typescript
// WRONG — bypasses RLS
const { data } = await this.adminClient
  .from('articles')
  .select('title, slug')
  .textSearch('search_vector', topic, { type: 'websearch' })
  .limit(3);

// CORRECT — RLS enforced
const { data } = await this.anonClient
  .from('articles')
  .select('title, slug')
  .eq('is_hidden', false)  // defense-in-depth alongside RLS
  .textSearch('search_vector', topic, { type: 'websearch' })
  .limit(3);
```

2. Remove `adminClient` injection from services that don't need it:

```typescript
// Before: both clients injected
constructor(
  @Inject(SUPABASE_ANON) private readonly anonClient: SupabaseClient,
  @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
) {}

// After: only what's needed
constructor(@Inject(SUPABASE_ANON) private readonly anonClient: SupabaseClient) {}
```

3. Always add `is_hidden = false` filter as defense-in-depth, even when RLS enforces it.

## Prevention

- **Rule**: Only use `SUPABASE_ADMIN` for system operations (article creation, admin tasks, background jobs). Never for user-facing read queries — even if the resolver is `@Public()`.
- **Code review check**: Any new `this.adminClient.from(...)` call should be questioned. If the query could use `anonClient`, it must.
- **Pattern**: When a column isn't in generated types yet, use `as any` on the result — don't switch to adminClient to "avoid" the type issue. The type workaround is cosmetic; the client choice is a security decision.
- **Existing convention**: This is already documented in `CLAUDE.md` under "Supabase Client Rules" — the issue was that new code didn't follow the convention.

## Related

- `CLAUDE.md` → "Supabase Client Rules" section
- `apps/api/CLAUDE.md` → "Use SUPABASE_ADMIN only for system operations"
- PR #28: `feat(learn): Learn Pages v2` — where this was caught and fixed
