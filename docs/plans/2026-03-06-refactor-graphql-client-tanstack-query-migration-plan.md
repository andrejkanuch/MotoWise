---
title: "refactor: Migrate GraphQL client from urql to TanStack Query v5"
type: refactor
status: completed
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-graphql-client-migration-tanstack-query-brainstorm.md
---

# refactor: Migrate GraphQL Client from urql to TanStack Query v5

## Overview

Replace urql with TanStack Query v5 + graphql-request as the GraphQL data layer in the Expo mobile app. This is a big-bang migration touching 12 source files + 3 CLAUDE.md files. The codegen pipeline and API remain unchanged.

## Problem Statement

The current urql setup has 8 pain points (see brainstorm: docs/brainstorms/2026-03-06-graphql-client-migration-tanstack-query-brainstorm.md):

1. **Mixed patterns**: 6 screens use inline `gql` (untyped), 4 use `TypedDocumentNode` (typed)
2. **Duplicate queries**: `MyMotorcyclesQuery` inline in 3 files with different field selections
3. **No cache invalidation**: Document cache doesn't update after mutations
4. **Token in closure**: Auth token can go stale independently of Supabase refresh
5. **No global error handling**: Each screen handles errors differently
6. **No retry/offline**: Network failures are permanent
7. **Untyped preferences**: JSON scalar → manual `as` casts everywhere
8. **No optimistic updates**: Mutations feel sluggish (out of scope for this PR but enabled by TanStack)

## Proposed Solution

**TanStack Query v5** for data fetching/caching + **graphql-request v7** for transport. Keep existing `@motolearn/graphql` codegen pipeline (TypedDocumentNode works with graphql-request natively).

Key decisions (see brainstorm):
- **Explicit cache invalidation** via query keys (no normalized cache)
- **Big bang migration** — all screens in one PR
- **Auth token read fresh** from Supabase `getSession()` on every request
- **All screens use TypedDocumentNode** — eliminate all inline `gql`
- **Global error handling** via QueryCache/MutationCache callbacks
- **Built-in retry** with exponential backoff (3 retries for queries, 1 for mutations)

## Technical Approach

### Phase 1: Foundation (new files)

Create 4 new files that form the new data layer:

#### `apps/mobile/src/lib/graphql-client.ts`
- `GraphQLClient` instance pointing to `EXPO_PUBLIC_API_URL`
- `gqlFetcher<TData, TVariables>(document, variables?)` — reads fresh Supabase token + locale header on every request
- Fully typed via TypedDocumentNode generics

#### `apps/mobile/src/lib/query-client.ts`
- `QueryClient` with global defaults:
  - `staleTime: 2 * 60 * 1000` (2 min — prevents excessive refetch on tab switches)
  - `gcTime: 30 * 60 * 1000` (30 min — mobile users background app often)
  - `retry: 3` with exponential backoff capped at 30s
  - `networkMode: 'offlineFirst'`
- `QueryCache.onError` — global error handler (toast for background refetch failures, token refresh on UNAUTHENTICATED)
- `MutationCache.onError` — global mutation error handler (toast unless mutation has its own onError)

#### `apps/mobile/src/lib/query-native.ts`
- `setupOnlineManager()` — uses `expo-network` to track connectivity for TanStack Query
- `setupFocusManager()` — uses `AppState` to refetch active queries when app returns to foreground

#### `apps/mobile/src/lib/query-keys.ts`
- Query key factory using TkDodo's pattern:
  ```
  queryKeys.user.me           → ['user', 'me']
  queryKeys.motorcycles.all   → ['motorcycles']
  queryKeys.motorcycles.lists → ['motorcycles', 'list']
  queryKeys.articles.list()   → ['articles', 'list', filters]
  queryKeys.diagnostics.all   → ['diagnostics']
  queryKeys.progress.all      → ['progress']
  queryKeys.nhtsa.makes       → ['nhtsa', 'makes']
  queryKeys.nhtsa.models()    → ['nhtsa', 'models', { makeId, year }]
  ```

### Phase 2: Root Layout Swap

#### `apps/mobile/src/app/_layout.tsx`
- Replace `UrqlProvider` with `QueryClientProvider`
- Replace `useQuery` (urql) with `useQuery` (TanStack) for `MeDocument`
- Map `pause: !session` → `enabled: !!session`
- Map `meResult.fetching` → `meQuery.isLoading`
- Call `setupOnlineManager()` at module level
- Call `setupFocusManager()` in useEffect
- Add `queryClient.clear()` when session becomes null (logout cache reset)

### Phase 3: Screen Migration (10 screens)

Each screen follows the same pattern:

| urql | TanStack Query |
|------|---------------|
| `import { useQuery, useMutation, gql } from 'urql'` | `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'` |
| `const [{ data, fetching, error }] = useQuery({ query: Doc })` | `const { data, isLoading, error, refetch } = useQuery({ queryKey, queryFn })` |
| `const [{ fetching }, execute] = useMutation(Doc)` | `const { mutateAsync, isPending } = useMutation({ mutationFn, onSuccess })` |
| `pause: !condition` | `enabled: !!condition` |
| `reexecute({ requestPolicy: 'network-only' })` | `refetch()` |
| Inline `gql\`...\`` | Import `*Document` from `@motolearn/graphql` |
| `if (result.error) Alert.alert(...)` | `try { await mutateAsync(...) } catch (e) { Alert.alert(...) }` |

#### Screens with inline `gql` → TypedDocumentNode (6 files):

| File | Inline Operation | Replace With |
|------|-----------------|--------------|
| `(garage)/index.tsx:10-22` | `MyMotorcyclesQuery` | `MyMotorcyclesDocument` |
| `(garage)/add-bike.tsx:17-27` | `CreateMotorcycleMutation` | `CreateMotorcycleDocument` |
| `(garage)/bike/[id].tsx:8-26` | `MyMotorcyclesQuery` + `DeleteMotorcycleMutation` | `MyMotorcyclesDocument` + `DeleteMotorcycleDocument` |
| `(home)/index.tsx:21-32` | `MyMotorcyclesQuery` | `MyMotorcyclesDocument` |
| `(diagnose)/index.tsx:10-20` | `MyDiagnosticsQuery` | `MyDiagnosticsDocument` |
| `(learn)/index.tsx:11-20` | `MyProgressQuery` | `MyProgressDocument` |

**Note**: Inline operations select fewer fields than generated documents (e.g., inline skips `userId`). Use the generated documents — fetching slightly more data is fine and ensures consistency.

#### Screens already using TypedDocumentNode (4 files):

| File | Change |
|------|--------|
| `_layout.tsx` | Provider swap + useQuery API change (Phase 2) |
| `(onboarding)/select-bike.tsx` | useQuery/useMutation API change |
| `(onboarding)/personalizing.tsx` | useMutation API change |
| `(profile)/index.tsx` | useQuery API change |

#### Mutation invalidation map:

| Mutation | Invalidate |
|----------|-----------|
| `createMotorcycle` | `queryKeys.motorcycles.all` |
| `deleteMotorcycle` | `queryKeys.motorcycles.all` |
| `updateUser` | `queryKeys.user.me` |

### Phase 4: Cleanup

- Delete `apps/mobile/src/lib/urql.ts`
- Remove `urql` and `@urql/exchange-auth` from `apps/mobile/package.json`
- Remove unused `urql` from `apps/web/package.json` (zero usage in web source)
- Update 3 CLAUDE.md files (root, mobile, graphql package) — replace urql references with TanStack Query + graphql-request
- Run `pnpm install` to update lockfile

## Complete File Change List

### Create (4 files)
| File | Purpose |
|------|---------|
| `apps/mobile/src/lib/graphql-client.ts` | GraphQLClient + gqlFetcher |
| `apps/mobile/src/lib/query-client.ts` | QueryClient config + global error handlers |
| `apps/mobile/src/lib/query-native.ts` | Online/focus manager setup for RN |
| `apps/mobile/src/lib/query-keys.ts` | Query key factory |

### Delete (1 file)
| File | Reason |
|------|--------|
| `apps/mobile/src/lib/urql.ts` | Replaced by graphql-client.ts + query-client.ts |

### Modify — Source (10 files)
| File | Key Changes |
|------|-------------|
| `app/_layout.tsx` | UrqlProvider → QueryClientProvider, useQuery API, cache clear on logout |
| `app/(onboarding)/select-bike.tsx` | useQuery/useMutation → TanStack hooks |
| `app/(onboarding)/personalizing.tsx` | useMutation → TanStack hook, mutation.then → try/catch |
| `app/(tabs)/(garage)/index.tsx` | Remove inline gql, useQuery → TanStack, reexecute → refetch |
| `app/(tabs)/(garage)/add-bike.tsx` | Remove inline gql, useMutation → TanStack + invalidation |
| `app/(tabs)/(garage)/bike/[id].tsx` | Remove 2 inline gql blocks, useQuery/useMutation → TanStack |
| `app/(tabs)/(home)/index.tsx` | Remove inline gql, 2x useQuery → TanStack |
| `app/(tabs)/(diagnose)/index.tsx` | Remove inline gql, useQuery → TanStack |
| `app/(tabs)/(learn)/index.tsx` | Remove inline gql, useQuery → TanStack |
| `app/(tabs)/(profile)/index.tsx` | useQuery → TanStack |

### Modify — Config/Docs (5 files)
| File | Changes |
|------|---------|
| `apps/mobile/package.json` | Remove urql deps, add @tanstack/react-query + graphql-request |
| `apps/web/package.json` | Remove unused urql dep |
| `CLAUDE.md` | Update GraphQL client references |
| `apps/mobile/CLAUDE.md` | Update urql → TanStack Query |
| `packages/graphql/CLAUDE.md` | Update "consumed via urql" |

### No Changes Needed
- `packages/graphql/codegen.ts` — TypedDocumentNode is framework-agnostic
- `packages/graphql/src/generated/*` — auto-generated, unchanged
- `apps/mobile/src/graphql/**/*.graphql` — operation files unchanged
- `apps/api/` — server unaffected
- `apps/mobile/src/lib/supabase.ts` — still used for auth
- `apps/mobile/src/stores/auth.store.ts` — still used for locale/session

## Acceptance Criteria

### Functional
- [x] All 10 screens fetch and display data correctly using TanStack Query
- [x] Mutations (create/delete motorcycle, update user) work and invalidate relevant queries
- [x] Pull-to-refresh works on garage screen (and any other screen using RefreshControl)
- [x] Navigation gate correctly checks `Me` query for onboarding status
- [x] Auth token is sent on all authenticated requests
- [x] App handles network loss gracefully (shows cached data, retries on reconnect)
- [x] Logout clears all cached query data

### Type Safety
- [x] Zero inline `gql` template literals — all operations use TypedDocumentNode from `@motolearn/graphql`
- [x] Zero `as any` casts on query/mutation results
- [x] `pnpm typecheck` passes with no new errors

### Non-Functional
- [x] No urql imports remain anywhere in the codebase (`grep -r "from 'urql'" apps/` returns nothing)
- [x] `urql` and `@urql/exchange-auth` removed from all package.json files
- [x] All 3 CLAUDE.md files updated
- [ ] App works on both iOS and Android (Expo Go)

## Dependencies

### Add
- `@tanstack/react-query` ^5.x
- `graphql-request` ^7.x

### Remove
- `urql` ^4.2.0
- `@urql/exchange-auth` ^2.2.0

### Keep
- `graphql` ^16.10.0 (peer dep)
- `@motolearn/graphql` (codegen, unchanged)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Inline gql selects fewer fields than generated docs | Slightly more data fetched | Negligible — a few extra string fields per query |
| `mutateAsync` throws instead of returning `{ error }` | All error handling patterns change | Systematic migration: `if (result.error)` → `try/catch` |
| Query key mismatch causes stale cache | Mutations don't invalidate correctly | Query key factory with unit tests; verify each mutation's `onSuccess` |
| Token refresh race condition | 401 on first request after token expiry | TanStack retry (3x) + `getSession()` auto-refreshes in Supabase v2 |
| Cache not cleared on logout | Next user sees previous user's data | `queryClient.clear()` in session change handler |

## Institutional Learnings Applied

From `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`:
- API error codes are GraphQL string extensions (`UNAUTHENTICATED`, `FORBIDDEN`), not HTTP codes. Global error handler must check `error.response.errors[].extensions.code`.
- Cache reset on logout is critical. Current urql approach recreates the client via `useMemo([session?.user?.id])`. TanStack equivalent: `queryClient.clear()`.

From `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`:
- When modifying screens, do NOT introduce `colors` imports from `@motolearn/design-system`. Use hex constants in RN inline styles.

## Sources & References

### Origin
- **Brainstorm:** [docs/brainstorms/2026-03-06-graphql-client-migration-tanstack-query-brainstorm.md](docs/brainstorms/2026-03-06-graphql-client-migration-tanstack-query-brainstorm.md) — Key decisions: TanStack Query over urql/Apollo, explicit invalidation, big bang migration, fresh token per request.

### Internal References
- Current urql client: `apps/mobile/src/lib/urql.ts`
- Root layout provider: `apps/mobile/src/app/_layout.tsx`
- Codegen config: `packages/graphql/codegen.ts`
- Generated types: `packages/graphql/src/generated/graphql.ts`

### External References
- [TanStack Query v5 GraphQL Guide](https://tanstack.com/query/v5/docs/framework/react/graphql)
- [TanStack Query React Native Guide](https://tanstack.com/query/v5/docs/framework/react/react-native)
- [graphql-request v7 API](https://www.jsdocs.io/package/graphql-request)
- [TkDodo's Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)
- [TanStack Query DevTools Expo Plugin](https://github.com/LovesWorking/tanstack-query-dev-tools-expo-plugin)
