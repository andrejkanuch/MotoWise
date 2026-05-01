---
title: Refactor share link to GraphQL + fix Vercel env + Sentry errors
type: fix
status: active
date: 2026-04-29
---

# Refactor share link to GraphQL + fix Vercel env + Sentry errors

## Overview

The `/t/[token]` trip share link page is broken in production. Root cause: Vercel's `NEXT_PUBLIC_SUPABASE_URL` env var points to `http://127.0.0.1:54321` (localhost), so the server-side Supabase RPC call fails silently. This also breaks the `/api/route-hero/[id]` endpoint (Sentry: MOTOVAULT-WEB-2).

Rather than just fixing the env var, refactor the share link page to use the GraphQL API — aligning with the project's architecture (web → GraphQL API → Supabase). The API already has the `tripByShareToken` resolver.

Additionally fix: PostgREST schema cache issue causing `browseCountries: column places.route_count does not exist` (Sentry: MOTO-VAULT-NODE-NESTJS-1, MOTOVAULT-WEB-1) — already resolved via `NOTIFY pgrst, 'reload schema'`.

## Tasks

### 1. Fix Vercel env vars (immediate)

Add proper server-side Supabase env vars to Vercel (without `NEXT_PUBLIC_` prefix) for the route-hero API route and any other server-side code that needs direct Supabase access:

```bash
vercel env add SUPABASE_URL production
# Value: https://tpsoneenbrmdwvzcbifw.supabase.co

vercel env add SUPABASE_ANON_KEY production  
# Value: the real anon JWT key
```

Also fix the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to point to production (they currently have localhost placeholder values).

### 2. Create GraphQL query document

**File:** `apps/web/src/graphql/queries/trip-by-share-token.graphql`

```graphql
query TripByShareToken($shareToken: String!) {
  tripByShareToken(shareToken: $shareToken) {
    id
    title
    description
    status
    difficulty
    startDate
    endDate
    maxRiders
    participantCount
    coverImageUrl
    waypoints {
      id
      sortOrder
      dayIndex
      type
      name
      notes
      lat
      lng
    }
    participants {
      anonId
      role
      status
      displayName
      avatarUrl
    }
  }
}
```

Run `pnpm generate` to produce `TripByShareTokenDocument` and `TripByShareTokenQuery` types.

### 3. Rewrite `fetchTripByToken` to use GraphQL

**File:** `apps/web/src/lib/fetch-trip-by-token.ts`

- Remove `getSupabaseServerClient` import
- Remove `ResolveTripByTokenResponseSchema` Zod validation (GraphQL codegen handles typing)
- Keep `TripShareTokenSchema` validation (defense-in-depth before sending to API)
- Use `gqlServerFetcher(TripByShareTokenDocument, { shareToken })` from `@/lib/graphql-server`
- Catch errors and call `notFound()` — match current behavior
- Return the typed `TripByShareTokenQuery['tripByShareToken']`

### 4. Update `SharedTripView` component

**File:** `apps/web/src/components/shared-trip-view.tsx`

Change prop type from `ResolveTripByTokenResponse` to the generated GraphQL type. Update all field accesses from snake_case to camelCase:

| Current (snake_case) | New (camelCase) |
|---|---|
| `trip.start_date` | `startDate` |
| `trip.end_date` | `endDate` |
| `trip.participant_count` | `participantCount` |
| `trip.max_riders` | `maxRiders` |
| `trip.cover_image_url` | `coverImageUrl` |
| `wp.sort_order` | `wp.sortOrder` |
| `wp.day_index` | `wp.dayIndex` |
| `p.anon_id` | `p.anonId` |
| `p.display_name` | `p.displayName` |
| `p.avatar_url` | `p.avatarUrl` |

Also update the destructuring: the GraphQL `SharedTrip` type is flat (waypoints/participants are direct fields), so change from `const { trip, waypoints, participants } = data` to receive a single `SharedTrip` object.

### 5. Run codegen + verify

```bash
pnpm generate
pnpm precheck
```

Verify locally that `/t/{token}` renders correctly.

## Acceptance Criteria

- [ ] `/t/{token}` page fetches data via GraphQL API, not direct Supabase RPC
- [ ] `SharedTripView` uses camelCase fields from generated GraphQL types
- [ ] No direct Supabase imports in `fetch-trip-by-token.ts`
- [ ] `pnpm generate` succeeds with new `.graphql` file
- [ ] `pnpm precheck` passes (lint + typecheck + test)
- [ ] Vercel env vars fixed: `SUPABASE_URL` + `SUPABASE_ANON_KEY` added for server-side use
- [ ] PostgREST schema cache reloaded (route_count column visible)

## Technical Notes

- The `tripByShareToken` resolver is `@Public()` and throttled via `THROTTLE_PRESETS.SHARE_LINK`
- The RPC `resolve_trip_by_token` is `SECURITY DEFINER` — works without a user JWT
- `gqlServerFetcher` sends no auth headers — correct for public queries
- The resolver validates the token with `TripShareTokenSchema` and throws `TripShareTokenError('NOT_FOUND')` on failure
- Preview bot handling remains in middleware (unchanged)

## Sentry Issues Resolved

- **MOTOVAULT-WEB-2**: `fetch failed` → `connect ECONNREFUSED 127.0.0.1:54321` on route-hero — fixed by adding proper `SUPABASE_URL` env var
- **MOTO-VAULT-NODE-NESTJS-1**: `browseCountries: column places.route_count does not exist` — fixed via PostgREST schema reload
- **MOTOVAULT-WEB-1**: `browseRegionsByCountrySlug Internal server error` — same root cause as above

## Sources

- Existing GraphQL server fetcher: `apps/web/src/lib/graphql-server.ts`
- Pattern example: `apps/web/src/lib/fetch-places.ts`
- API resolver: `apps/api/src/modules/trips/trips.resolver.ts:126-133`
- API service: `apps/api/src/modules/trips/services/trip-sharing.service.ts`
- SharedTrip model: `apps/api/src/modules/trips/models/shared-trip.model.ts`
