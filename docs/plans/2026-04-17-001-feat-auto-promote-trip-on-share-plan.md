---
title: "feat: Auto-promote trip on share"
type: feat
status: active
date: 2026-04-17
---

# Auto-promote trip on share

## Overview

When a user generates a share link for a trip, the trip should automatically become shareable. Today, share links silently fail because `resolve_trip_by_token` requires `visibility = 'unlisted' AND status NOT IN ('draft', 'archived')`, but new trips are created as `draft` + `private`. The user gets a link that looks valid, sends it to friends, and they see "This trip isn't available."

**Fix:** Atomically promote the trip to `published` + `unlisted` inside the `rotate_trip_share_token` RPC when generating a token. Share means share.

## Problem Statement

The trip sharing flow has a **silent precondition mismatch**:

1. `rotate_trip_share_token` generates a token for ANY trip (no status/visibility check)
2. `resolve_trip_by_token` requires `visibility = 'unlisted' AND status NOT IN ('draft', 'archived')`
3. New trips are `draft` + `private` by default
4. Result: every share link for a new trip is dead on arrival

Every major app (Google Docs, Notion, Komoot, Strava) lets users share instantly without a publish gate. MotoVault should too.

## Proposed Solution

### Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where does promotion execute? | **Postgres RPC** | Atomic, no TOCTOU, single round-trip |
| What about `public` trips? | **Modify `resolve_trip_by_token` to accept `visibility IN ('unlisted', 'public')`** | Avoids demoting public trips off Discover |
| Should archived trips be blocked? | **Yes, raise exception in RPC** | Prevent generating dead links |
| Should "Stop sharing" revert status? | **No, only revert visibility** | Reverting to draft could break participant invariants |
| Content quality gates (no waypoints)? | **No gates** | Trust the organiser's intent; riders share early to co-plan |

### State Transition Matrix

| Starting State | Action | `status` After | `visibility` After | Token Resolves? |
|---|---|---|---|---|
| draft + private | Generate link | **published** | **unlisted** | Yes |
| draft + unlisted | Generate link | **published** | unlisted | Yes |
| published + private | Generate link | published | **unlisted** | Yes |
| published + unlisted | Rotate link | published | unlisted | Yes (new token) |
| published + public | Generate link | published | **public** (unchanged) | Yes |
| active + private | Generate link | active | **unlisted** | Yes |
| completed + private | Generate link | completed | **unlisted** | Yes |
| archived + any | Generate link | **BLOCKED** | N/A | Exception raised |
| any + unlisted | Stop sharing | unchanged | **private** | No (token still exists but trip is private) |

## Technical Approach

### Phase 1: Migration — Modify RPCs

**File:** `supabase/migrations/00108_auto_promote_on_share.sql`

Two changes in one migration:

#### 1a. Modify `rotate_trip_share_token`

Add a conditional UPDATE before token generation:

```sql
-- Block archived trips
IF v_trip.status = 'archived' THEN
  RAISE EXCEPTION 'Archived trips cannot be shared' USING ERRCODE = 'P0002';
END IF;

-- Auto-promote: draft -> published, private -> unlisted
-- Never demote from public; never change non-draft statuses
UPDATE public.trips
SET
  status = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
  visibility = CASE WHEN visibility = 'private' THEN 'unlisted' ELSE visibility END
WHERE id = p_trip_id
  AND (status = 'draft' OR visibility = 'private');
```

This goes between the `SELECT ... FOR UPDATE` lock and the `INSERT ... ON CONFLICT` token generation.

#### 1b. Modify `resolve_trip_by_token`

Change line 193 from:

```sql
AND t.visibility = 'unlisted'
```

To:

```sql
AND t.visibility IN ('unlisted', 'public')
```

This allows share links to work for public trips without demoting them.

**Reference:** Current RPCs in `supabase/migrations/00086_trip_share_tokens.sql` (lines 173-252) and `supabase/migrations/00087_fix_rotate_trip_share_token_lock.sql`.

**Conventions to follow:**
- `SECURITY DEFINER` with `SET search_path = ''`
- Log suppression: `SET log_min_duration_statement = -1, SET log_statement = 'none'`
- `REVOKE ALL FROM PUBLIC` then explicit `GRANT EXECUTE TO authenticated`
- Use `CREATE OR REPLACE FUNCTION` for idempotency
- Header comment block with migration purpose

### Phase 2: Mobile — Share Sheet Fixes

**File:** `apps/mobile/src/components/trip-share-sheet.tsx`

#### 2a. Invalidate trip detail after token generation

In `rotateMutation.onSuccess`, add query invalidation so the trip detail screen reflects the new status/visibility:

```typescript
onSuccess: (token) => {
  setPlaintextToken(token);
  // Invalidate so trip-detail reflects auto-promoted status/visibility
  queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
},
```

**Pattern reference:** `create-trip.tsx:555-557` (update mutation) uses the same triple invalidation.

#### 2b. Add info line when link is active

Below the share URL display, add a subtle info message:

```
Anyone with this link can view your trip
```

Use `palette.neutral400` / `palette.neutral500` color, `fontSize: 12`.

#### 2c. Block archived trips in the UI

Add `tripStatus` prop to `TripShareSheet`. If `status === 'archived'`, show disabled state:

```
Unarchive this trip to share it.
```

This prevents the user from even attempting to generate a link for an archived trip. The RPC also blocks it as a defense-in-depth measure.

**Prop source:** `trip-detail.tsx` already has `trip.status` available from the `tripDetailQuery`.

### Phase 3: Mobile — Edit Mode Button Cleanup

**File:** `apps/mobile/src/app/(modals)/create-trip.tsx`

The "Save & Publish" button (added earlier today) should only show when the trip is actually a `draft`. If auto-promotion already published it, edit mode should show just "Save Changes."

Check: `tripQuery.data?.tripDetail.status === 'draft'` — this condition is already used on line 1452 for the published-trip warning banner. The "Save & Publish" button already has this guard (it's inside a `tripQuery.data?.tripDetail.status === 'draft'` conditional). No change needed here.

## System-Wide Impact

### Interaction Graph

1. User taps "Generate link" in share sheet
2. `rotateMutation` calls `RotateTripShareTokenDocument` GraphQL mutation
3. Resolver calls `tripsService.rotateTripShareToken(userId, tripId)`
4. Service calls `supabase.rpc('rotate_trip_share_token', { p_trip_id })`
5. **NEW:** RPC atomically updates `trips.status` and `trips.visibility` if needed
6. RPC generates token, stores hash, returns plaintext
7. **NEW:** `onSuccess` invalidates trip detail + trips list queries
8. Trip detail screen re-fetches and shows updated status badge

### Error Propagation

- RPC raises `P0002` for archived trips -> NestJS catches as generic error -> share sheet shows `Alert.alert('Failed to generate link', ...)`
- If UPDATE fails (constraint violation, concurrent modification): the `FOR UPDATE` lock prevents concurrent issues. Status/visibility have CHECK constraints but `published` and `unlisted` are always valid values.

### State Lifecycle Risks

- **Partial failure:** Impossible. The UPDATE and INSERT are inside the same `BEGIN...END` PL/pgSQL block, so they're atomic within the RPC call.
- **Stale cache:** Addressed by query invalidation in `onSuccess`.
- **"Stop sharing" leaves published status:** Intentional. A published trip that is private means "not in any feed, not shareable via link." This is a valid state for trips with existing participants.

## Acceptance Criteria

### Functional Requirements

- [ ] Draft + private trip -> generate share link -> link resolves immediately on web (`motovault.app/t/{token}`)
- [ ] Published + public trip -> generate share link -> link resolves, trip stays on Discover feed
- [ ] Archived trip -> share sheet shows disabled state ("Unarchive this trip to share it")
- [ ] Archived trip -> RPC rejects token generation with error
- [ ] Generate link -> stop sharing -> link no longer resolves (trip becomes private)
- [ ] Stop sharing -> re-share -> new link works, old link dead (token rotated)
- [ ] Trip detail screen updates status/visibility immediately after link generation (no stale UI)
- [ ] Share sheet shows "Anyone with this link can view your trip" info line when link is active
- [ ] Edit mode shows "Save & Publish" only for draft trips (not for auto-promoted published trips)

### Non-Functional Requirements

- [ ] Auto-promotion is atomic (single RPC call, no TOCTOU window)
- [ ] Rate limiting unchanged (uses existing `THROTTLE_PRESETS.SHARE_LINK`)
- [ ] No new RLS policies needed (promotion happens inside SECURITY DEFINER RPC)
- [ ] Migration is idempotent (`CREATE OR REPLACE FUNCTION`)

## Files to Modify

| File | Change |
|---|---|
| `supabase/migrations/00108_auto_promote_on_share.sql` | **NEW** — modify both RPCs |
| `apps/mobile/src/components/trip-share-sheet.tsx` | Add query invalidation, info line, archived guard |
| `apps/mobile/src/app/(modals)/trip-detail.tsx` | Pass `tripStatus` prop to `TripShareSheet` |

## Files NOT to Modify

| File | Why |
|---|---|
| `apps/api/src/modules/trips/trips.service.ts` | No service-layer changes needed — RPC handles promotion |
| `apps/api/src/modules/trips/trips.resolver.ts` | No resolver changes needed |
| `apps/mobile/src/app/(modals)/create-trip.tsx` | "Save & Publish" button already gated on `status === 'draft'` |
| `packages/types/src/validators/trip.ts` | No schema changes needed |

## Dependencies & Risks

- **Migration must be pushed to Supabase** before testing: `npx supabase db push`
- **No breaking changes:** The RPC signature is unchanged (same input/output types)
- **Backward compatible:** Existing tokens continue to work. Only the promotion side-effect is new.
- **RLS policy interaction:** Auto-promotion does not affect RLS because unlisted trips are only reachable via the SECURITY DEFINER RPC (the unlisted branch was intentionally removed from all RLS policies in migration 00086)

## Sources

- Current share token system: `supabase/migrations/00086_trip_share_tokens.sql`
- FOR UPDATE lock fix: `supabase/migrations/00087_fix_rotate_trip_share_token_lock.sql`
- RLS recursion fix (pattern to follow): `supabase/migrations/00089_fix_trips_rls_recursion.sql`
- Original trip share plan: `docs/plans/2026-04-10-002-feat-trip-share-links-plan.md`
- Share sheet component: `apps/mobile/src/components/trip-share-sheet.tsx`
- Trip detail screen: `apps/mobile/src/app/(modals)/trip-detail.tsx`
