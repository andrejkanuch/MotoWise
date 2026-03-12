---
title: "Migrate GraphQL Client from urql to TanStack Query"
date: 2026-03-06
status: decided
participants: [andrej, claude]
---

# Migrate GraphQL Client from urql to TanStack Query

## What We're Building

Replace urql with **TanStack Query v5 + graphql-request** as the GraphQL client layer in the Expo mobile app. This is a full rethink of how the app fetches, caches, and mutates data.

## Why This Approach

### Current Pain Points

1. **Mixed patterns**: Half the screens use inline `gql` (untyped), half use generated `TypedDocumentNode`. No consistency.
2. **Duplicate queries**: `MyMotorcyclesQuery` defined inline in 3 different files with different field selections.
3. **No normalized cache**: urql's default document cache means mutations don't auto-update lists. Users must pull-to-refresh after creating/deleting a motorcycle.
4. **Token stored in closure**: Auth token can go stale if Supabase refreshes independently. Causes unnecessary 401 round-trips.
5. **No global error handling**: Each screen handles errors differently (some Alert, some inline, some silent).
6. **No retry/offline**: Network failures are permanent. Only the personalizing screen has ad-hoc retry.
7. **`preferences` untyped**: JSON scalar means manual `as` casts everywhere for `me.preferences`.
8. **No optimistic updates**: Mutations feel sluggish — user sees no feedback until server responds.

### Why TanStack Query over urql or Apollo

| Criteria | TanStack Query | urql + graphcache | Apollo Client |
|----------|---------------|-------------------|---------------|
| Bundle size | ~12KB | ~13KB + graphcache | ~40KB |
| Retry/offline | Built-in | Needs retryExchange | Needs config |
| Devtools | Excellent (RN devtools plugin) | Limited | Good |
| Cache model | Document + query keys | Normalized | Normalized |
| Learning curve | Low (familiar if you know React Query) | Medium | High |
| Ecosystem size | Largest (framework-agnostic) | Smallest | Large (GQL-only) |
| Future flexibility | Works for REST/GQL/anything | GQL-only | GQL-only |

TanStack Query wins on DX, ecosystem, and simplicity. Normalized cache sounds appealing but explicit invalidation is simpler to reason about and debug.

## Key Decisions

### 1. Library Choice: TanStack Query v5 + graphql-request

- `@tanstack/react-query` for data fetching hooks
- `graphql-request` as the lightweight GraphQL transport (~5KB)
- Keep `@motovault/graphql` for generated `TypedDocumentNode` types (codegen unchanged)

### 2. Cache Strategy: Explicit Invalidation

After mutations, invalidate the relevant query keys so they refetch:
```
createMotorcycle -> invalidate ['motorcycles']
deleteMotorcycle -> invalidate ['motorcycles']
updateUser       -> invalidate ['me']
```

No optimistic updates for now. Can add later for specific interactions if needed.

### 3. Migration Strategy: Big Bang

Replace urql everywhere in a single PR. No coexistence period.

**Rationale**: The app has ~10 screens with GQL usage. A clean swap is manageable and avoids the complexity of two providers.

### 4. Auth Token: Read from Supabase Directly

Instead of caching the token in a closure, the fetcher reads the current session from Supabase on every request. This eliminates stale token issues.

### 5. All Screens Use TypedDocumentNode

Eliminate all inline `gql` usage. Every screen imports generated Document constants from `@motovault/graphql`.

### 6. Global Error Handling

Add a `QueryClient` default `onError` handler that:
- Shows a toast/alert for network errors
- Triggers token refresh on 401
- Logs errors for debugging

### 7. Retry Configuration

TanStack Query's built-in retry (default 3 retries with exponential backoff) handles transient failures automatically.

## Architecture

### Fetcher Function (~20 lines)

A single `graphqlFetcher` function that:
1. Gets current session from `supabase.auth.getSession()`
2. Sends the request via `graphql-request` with auth + locale headers
3. Returns typed data

### Query Key Convention

```
['me']                                    - current user
['motorcycles']                           - user's motorcycles
['motorcycleMakes']                       - NHTSA makes (public)
['motorcycleModels', { makeId, year }]    - NHTSA models (public)
['articles', filters]                     - article list
['article', slug]                         - single article
['quiz', articleId]                       - quiz for article
['diagnostics']                           - user's diagnostics
['progress']                              - learning progress
```

### Hook Pattern

Each screen uses standard TanStack Query hooks:
```tsx
// Query
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['motorcycles'],
  queryFn: () => gqlFetch(MyMotorcyclesDocument),
});

// Mutation with invalidation
const { mutateAsync } = useMutation({
  mutationFn: (input) => gqlFetch(CreateMotorcycleDocument, { input }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['motorcycles'] }),
});
```

### Provider Setup

Replace `UrqlProvider` with `QueryClientProvider` in `_layout.tsx`. The `QueryClient` is configured once with defaults for retry, staleTime, and error handling.

## Files Affected

| Area | Files | Change |
|------|-------|--------|
| Core | `lib/urql.ts` | Delete, replace with `lib/graphql-client.ts` |
| Core | `app/_layout.tsx` | Replace UrqlProvider with QueryClientProvider |
| Auth | `stores/auth.store.ts` | No change (token comes from supabase directly) |
| Onboarding | `select-bike.tsx`, `personalizing.tsx` | useQuery/useMutation -> TanStack hooks |
| Tabs | `(home)/index.tsx`, `(learn)/index.tsx`, `(diagnose)/index.tsx` | Inline gql -> TypedDocumentNode + TanStack |
| Garage | `(garage)/index.tsx`, `add-bike.tsx`, `bike/[id].tsx` | Same migration + add invalidation |
| Profile | `(profile)/index.tsx` | Same migration |
| Auth screens | `login.tsx`, `register.tsx` | No GQL usage, no change |
| Package | `package.json` | Remove urql deps, add @tanstack/react-query + graphql-request |

## Dependencies

### Add
- `@tanstack/react-query` (v5)
- `graphql-request` (v7)
- `@tanstack/react-query-devtools` (optional, for dev)

### Remove
- `urql`
- `@urql/exchange-auth`

### Keep
- `@motovault/graphql` (codegen pipeline unchanged)
- `graphql` (peer dependency)

## Open Questions

None — all key decisions resolved during brainstorm.

## Out of Scope

- Changing the codegen pipeline (`packages/graphql/codegen.ts`)
- Changing the NestJS API (resolvers, schema)
- Adding offline-first / persistence (can layer on later with `@tanstack/query-sync-storage-persister`)
- Optimistic updates (can add per-mutation later)
- Web app (`apps/web`) — separate migration if needed
