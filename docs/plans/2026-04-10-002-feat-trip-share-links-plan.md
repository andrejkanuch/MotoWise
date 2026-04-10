---
title: H2 — Trip Share Links (capability URLs for unlisted trips)
type: feat
status: active
date: 2026-04-10
---

# H2 — Trip Share Links

## Deepening Revisions (2026-04-10)

Plan revised after a 6-agent parallel review (security, data integrity, TypeScript, architecture, simplicity, framework docs). Key changes from the original draft:

1. **Schema: column → table.** Ship `trip_share_tokens` as a dedicated table in Phase 1, not as columns on `trips`. Avoids stacked Phase-1→Phase-2 refactor and matches the `share_links` precedent.
2. **Hashing at rest ships in Phase 1**, not Phase 2. Store `sha256(token)` only. Plaintext exists in the RPC call, the SSR request, and the client share sheet — never in the DB. This closes the backup/WAL/pg_stat_statements leak class.
3. **Drop `tripDetail(shareToken)` merged resolver.** Keep only `tripByShareToken(shareToken: String!): SharedTrip` as a dedicated `@Public()` resolver. Drops the `'__token_fetch__'` sentinel, the cross-trip IDOR check theatre, and the dual-client branching in `tripDetail`.
4. **Separate `SharedTrip` object type** with a narrower field set (no `shareToken`, no `organiser_user_id`). Organiser-only fields move to a `TripShareLink` field-resolved sub-object on `Trip`.
5. **Drop expiry entirely from Phase 1.** No `expires_at` column, no `setExpiry` RPC, no `setExpiry` mutation, no expiry picker UI. Rotation is the only revocation primitive. Phase 2+ can add back if users ask.
6. **Drop per-trip OG opt-in toggle from Phase 2.** Teaser OG is the permanent policy — scraper caches persist forever.
7. **Drop Phase 2.3 audit table and Betterstack alerts.** Build when a real abuse pattern emerges.
8. **Dedicated mobile read-only preview screen** at `apps/mobile/src/app/t/[token]/index.tsx`, not `viaToken` coupling into the existing trip-detail modal.
9. **Migration is multi-step + safe.** `ALTER TABLE ... DEFAULT gen_random_bytes()` is VOLATILE and forces a full table rewrite under ACCESS EXCLUSIVE lock — handled by the separate-table design (no ALTER on `trips` at all).
10. **Edge rate limit on `/t/*` on Vercel** (`@vercel/edge` or Upstash) in addition to NestJS throttler. Direct-to-Supabase SSR path bypasses the API throttle entirely.
11. **Next.js 16 specifics:** `params` is a Promise (must `await`), `runtime = 'edge'`, `dynamic = 'force-dynamic'`, response headers set via `middleware.ts` (RSCs cannot mutate response headers).
12. **Branded `TripShareToken` type**, typed `TripShareTokenError` with `as const` reason codes, Zod parse of the RPC JSON payload at the service boundary.
13. **Hash user_id in RPC response** (`sha256(user_id || trip_id)`) so recipients can't correlate participants across multiple shared trips. Gate `display_name` on `users.is_public`.
14. **AASA file via Next.js route handler**, not static file with `${APPLE_TEAM_ID}` placeholder. Adds `webcredentials` entry and explicit `components` exclusion for safety.
15. **Explicit `REVOKE ALL FROM PUBLIC` then `GRANT EXECUTE TO anon, authenticated`** on all RPCs (Supabase linter rule `0011`).
16. **Log redaction** on all SECURITY DEFINER functions via `SET log_min_duration_statement = -1`.
17. **Parallel-agent swarm guardrails** — Phase 0 serial, migration+regen as a hard barrier, `_layout.tsx` / `app.module.ts` / `app.config.ts` owned by a single agent.
18. **Rollback procedures** documented for Phase 1 migration.

## Overview

Replace MotoVault's broken "unlisted" trip visibility with a proper capability-URL share-link system. Every unlisted trip gets a server-issued 32-byte token (stored only as SHA-256 hash in DB). Recipients reach the trip via a short `/t/:token` URL that deep-links into the mobile app on iOS/Android, or falls back to a Next.js SSR read-only page. Ships in two phases: **Phase 0** (Universal/App Links infra) and **Phase 1** (table + RPC + dedicated resolver + routes + share sheet + rides mirror). Phase 2 collapses to small follow-up hardening items.

This plan closes finding **H2** from the [2026-04-10 trip security audit](docs/solutions/integration-issues/) and follows up on the hardening shipped in `supabase/migrations/00085_trip_security_hardening.sql`.

## Problem Statement

Migration `00084_trip_ride_visibility.sql` introduced `visibility IN ('private', 'unlisted', 'public')` and was hardened further by `00085_trip_security_hardening.sql`, but an explicit known gap remains: `unlisted` is still treated identically to `public` in `trips_select` (lines 91-125), `trip_waypoints_select` (lines 29-50), and `trip_participants_select` (lines 58-83). Any caller with the Supabase anon key can run `GET /rest/v1/trips?visibility=eq.unlisted` and enumerate every "secret" trip, then pivot to the child tables to pull routes and participant lists.

**Impact of not fixing:** the entire privacy promise of "unlisted" is cosmetic. Every unlisted trip is readable by anyone with the anon key, including route coordinates, notes, and participant identities.

## Proposed Solution

**One sentence:** Create a `trip_share_tokens(trip_id, token_hash)` table with SHA-256 hashing at rest, gate unlisted reads exclusively through a SECURITY DEFINER RPC that accepts the plaintext token (hashes it server-side and looks up by hash), drop the `unlisted` branch from all three RLS policies, expose a new `tripByShareToken(shareToken: String!): SharedTrip` GraphQL query, and ship a short `/t/:token` path URL that deep-links into the app on mobile or renders an SSR read-only page on web.

Short-URL example:
```
https://motovault.app/t/8f3a2e9c1b7d4f6a0c2b9e5d7a3f1c8b4e6d2a9f7c1b3e5d8a0c2f4b6e9d1a7c
```

The plaintext token exists only in (a) the organiser's share sheet for copy/share, (b) the recipient's URL, (c) the RPC call. The DB never stores it.

## Technical Approach

### Architecture

```
┌─────────────┐    /t/:token    ┌──────────────────┐
│  Recipient  │────────────────▶│ Universal Link  │
└─────────────┘                 │  or Web SSR     │
                                └────────┬─────────┘
                                         │
                   ┌─────────────────────┴────────────────────┐
                   ▼                                          ▼
        ┌─────────────────────┐                    ┌────────────────────┐
        │ Expo Router          │                    │ Next.js RSC         │
        │ app/t/[token]/       │                    │ app/t/[token]/      │
        │ index.tsx (preview)  │                    │ page.tsx            │
        └──────────┬───────────┘                    └──────────┬─────────┘
                   │                                           │
                   │ GraphQL                                   │ anon supabase
                   │ tripByShareToken(token)                   │ .rpc('resolve_trip_by_token')
                   ▼                                           ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ apps/api — TripsService.resolveTripByShareToken(token)        │
        │  - calls supabaseAdmin.rpc('resolve_trip_by_token', {p_token})│
        │  - parses result via ResolveTripByTokenResponseSchema         │
        │  - maps to SharedTrip model                                   │
        └──────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ Postgres — SECURITY DEFINER resolve_trip_by_token(p_token)    │
        │  1. Validate token shape; fail uniform 'Trip not found'       │
        │  2. v_hash := digest(p_token, 'sha256')                       │
        │  3. SELECT trip via trip_share_tokens.token_hash = v_hash     │
        │     WHERE trip.visibility='unlisted' AND status<>'draft'      │
        │     AND status<>'archived'                                    │
        │  4. SELECT waypoints + redacted participants                  │
        │  5. RETURN jsonb_build_object(allow-listed columns only)      │
        │  SET search_path='', log_min_duration_statement=-1            │
        │  GRANT EXECUTE TO anon, authenticated (explicit)              │
        └──────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
CREATE TABLE public.trip_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id),              -- one active token per trip
  UNIQUE (token_hash)            -- defense-in-depth; collision-proof
);
CREATE INDEX idx_trip_share_tokens_token_hash ON public.trip_share_tokens(token_hash);
```

- `token_hash` is `sha256(plaintext)`. Plaintext never stored.
- `UNIQUE (trip_id)` enforces one active token per trip (rotation updates the row in place).
- `CASCADE` on `trip_id` means deleting a trip cleans up the token row.
- No `expires_at` — YAGNI per simplicity review. Rotation is the revocation primitive.

### Migration Safety — Multi-Step (NOT a single ALTER)

Because the separate-table approach doesn't ALTER `trips`, there's no table-rewrite lock window. Migration is essentially:

1. `CREATE TABLE trip_share_tokens` (instant, no locks on `trips`)
2. Backfill: for each trip with `visibility = 'unlisted'`, insert a row with a freshly-minted token hash. Runs in a single INSERT-SELECT. Plaintext is **thrown away** — existing outstanding URLs are breaking anyway (they were the broken design we're fixing).
3. `CREATE FUNCTION resolve_trip_by_token` (SECURITY DEFINER with log redaction)
4. `CREATE FUNCTION rotate_trip_share_token` (SECURITY DEFINER with `FOR UPDATE`)
5. `DROP POLICY IF EXISTS` then `CREATE POLICY` for all three RLS policies (dropping the unlisted branch)
6. Assert baseline: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='trips_select' AND tablename='trips') THEN RAISE EXCEPTION 'Missing baseline'; END IF; END $$;`

No `CONCURRENTLY` needed because:
- The new unique indexes are on the new table (empty at creation time).
- Policy drop+recreate on existing tables is fast (metadata-only).

### New RPCs

**All three:** `SECURITY DEFINER`, `SET search_path = ''`, `SET log_min_duration_statement = -1`, `SET log_statement = 'none'`, explicit `REVOKE ALL ON FUNCTION ... FROM PUBLIC` then `GRANT EXECUTE TO ...`.

1. `public.resolve_trip_by_token(p_token TEXT) RETURNS JSONB` — GRANT to `anon, authenticated`. Validates shape, hashes, looks up, returns allow-list JSON. Uniform `Trip not found` exception on any failure (no existence oracle). Strips `share_token`-adjacent data, hashes `user_id` with trip_id for correlation resistance, gates `display_name` on `users.is_public`.

2. `public.rotate_trip_share_token(p_trip_id UUID) RETURNS TEXT` — GRANT to `authenticated` only. Uses `SELECT ... FOR UPDATE` on the parent trip to serialize rotations. Returns new **plaintext** token (sole code path that returns plaintext). Stores only the hash.

3. (No `set_expiry` RPC — dropped.)

### GraphQL Surface

Additive — no breaking changes to existing callers:

```graphql
# New dedicated public query — does NOT share a resolver with tripDetail
tripByShareToken(shareToken: String!): SharedTrip

# New organiser-only mutation
rotateTripShareToken(tripId: ID!): String!
```

**`SharedTrip` is a new ObjectType** with a narrower field set than `Trip`:
- `id`, `title`, `description`, `status`, `startDate`, `endDate`, `difficulty`, `distance`, `waypoints`, `participants` (redacted)
- **No** `shareToken`, **no** `organiserUserId`, **no** `organiserEmail`, **no** internal flags

**Organiser-only `TripShareLink` field** on `Trip` (added via `@ResolveField`):
- `@Field(() => TripShareLink, { nullable: true }) shareLink?: TripShareLink | null`
- Resolver checks `user.id === trip.organiserUserId` — returns `null` otherwise
- `TripShareLink { token: String!, url: String! }` — `url` computed as `https://motovault.app/t/${token}`

The organiser reads their own trip via the existing `tripDetail(tripId)` query, which now exposes the `shareLink` field via the field resolver. The organiser never calls `tripByShareToken`. The anonymous recipient never calls `tripDetail`.

### URL Format

Path-token: `https://motovault.app/t/{64-char-hex-token}`

---

## Resolved Edge Cases (from SpecFlow Analysis)

These semantic decisions were pulled forward from the SpecFlow gap analysis. Each is load-bearing for Phase 1 correctness.

### Authentication + routing

- **Cold-start deep link before auth (1.1, 7.1, 7.2):** `app/t/[token]/index.tsx` must live **outside** the auth gate in `apps/mobile/src/app/_layout.tsx`. Anonymous recipients must resolve the token without a session. The auth redirect in `_layout.tsx` explicitly allow-lists `/t/*`.
- **Pending-route cold start (7.1):** extend `use-notification-deep-link.ts` pattern to also buffer `Linking.useURL()` for `/t/*` paths when `segments[0] !== '(tabs)'` during cold start.
- **OAuth interruption (7.3):** if an anonymous recipient taps "Sign in" mid-flow, persist the pending token in `expo-secure-store` under key `pending_share_token` with 5-minute TTL + `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. Drain on next app foreground. Clear on background too.

### Resolver precedence rules (simplified)

With two distinct queries (`tripDetail(tripId)` for authed, `tripByShareToken(token)` for anon), there is no precedence logic in the service. The mobile trampoline:
- Calls `tripByShareToken(token)` — always.
- Receives a `SharedTrip` with `id`.
- If the caller is authenticated and has RLS access to the trip, the trampoline also calls `tripDetail(sharedTrip.id)` and uses the authenticated result — giving the organiser/participant their full interactive view.
- If `tripDetail` returns 404 (RLS denied), fall back to the `SharedTrip` read-only preview.

This keeps precedence at the caller, not the resolver.

### Error taxonomy

All failure modes collapse to `Trip not found` (GraphQL `NOT_FOUND`, HTTP 404). No distinction between revoked/expired/deleted/never-existed/wrong-shape. Generic copy on the error screen: *"This trip isn't available."*

### Token/visibility orthogonality

`visibility` is gated inside the RPC. Flipping a trip `unlisted → private` immediately 404s the token. Flipping back to `unlisted` re-enables the same token. No banner, no auto-rotate. Simplicity reviewer's cut #4.

### Participant list semantics

**Live join**, not snapshot. But participant `user_id` is hashed with trip_id in the response, so correlation across multiple shared trips is impossible.

### Status matrix

| Status | Resolvable via token |
|---|---|
| `draft` | ❌ |
| `published` | ✅ |
| `active` | ✅ |
| `completed` | ✅ |
| `archived` | ❌ |

RPC: `status NOT IN ('draft', 'archived')`.

### Race conditions

- **Two concurrent rotates:** `SELECT ... FOR UPDATE` on parent trip inside `rotate_trip_share_token` serializes.
- **Rotate during in-flight read:** the old token hash is gone after the UPDATE; next lookup 404s. TanStack Query `retry: false` on `tripByShareToken`.
- **Concurrent revoke + resolve:** Postgres READ COMMITTED handles atomically.

### Crawler + preview caching

Teaser OG is the **permanent policy**. WhatsApp/iMessage/Slack/Discord scrapers cache forever; teaser = generic title + MotoVault logo. No trip-specific data ever goes into a scraper cache. Preview-bot user agents (`Slackbot`, `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `Discordbot`, `LinkedInBot`) detected in `middleware.ts` and served the teaser head-only response without calling the RPC (avoids M3 audit-table pollution).

### Rate limiting

Two layers:
1. **Vercel edge middleware** on `/t/*`: 30/min/IP via `@vercel/edge-rate-limit` or Upstash.
2. **NestJS throttler** on `rotateTripShareToken` mutation: `THROTTLE_PRESETS.SHARE_LINK` (10/min/user).

### PostHog redaction

- Global `sanitize_properties` filter: replace `$current_url` and `$pathname` matching `/t/{hex}` with `/t/{token}`.
- Never pass raw token as event property.
- Exclude `rotateTripShareToken` mutation from session replay and Sentry breadcrumbs.

### Clipboard permanence

- Android: use native clipboard with `ClipDescription.EXTRA_IS_SENSITIVE=true` via a tiny expo-modules-core wrapper.
- iOS: `UIPasteboard.general.setItems(_:, options: [.localOnly: true])` — prevents Handoff/Universal Clipboard sync.
- Warning copy in share sheet: *"Anyone with this link can view and forward the trip."*

### CSP on web fallback

`middleware.ts` sets Content-Security-Policy on `/t/*`:
```
default-src 'self';
img-src 'self' https://*.mapbox.com data:;
connect-src 'self' https://api.mapbox.com;
style-src 'self' 'unsafe-inline';
script-src 'self';
frame-ancestors 'none';
```

### Phase 0 rollout sequencing

1. Deploy AASA + assetlinks.json via Next.js route handlers (not static files) to Vercel
2. Validate with Apple AASA validator + Google Digital Asset Links API
3. **Wait 24h** for Apple CDN propagation
4. Submit app binary with `associatedDomains` + `intentFilters` referencing the domain
5. TestFlight smoke test

---

## Alternative Approaches Considered

1. **Column on `trips` + Phase 2 migration to table.** Rejected — stacked refactor, backup leak of plaintext, table-rewrite lock window on `ALTER TABLE ... DEFAULT gen_random_bytes()`.
2. **Stateless HMAC** — rejected, per-link revocation impossible.
3. **Fragment-based URLs** — rejected, breaks SSR/OG/Universal Link AASA matching.
4. **Header-based RLS via `current_setting('request.headers')`** — rejected, undocumented PostgREST behavior.
5. **Merge into existing `share_links` module** — rejected, module is motorcycle-specific by schema and polymorphic refactor is significant.
6. **Reuse `trip-detail.tsx` modal via `viaToken` prop** — rejected, leaky-abstraction; dedicated read-only preview screen instead.
7. **`tripDetail(shareToken)` merged resolver with optional tripId sentinel** — rejected, three reviewers flagged it (sentinel strings, nullable landmines, throttle-per-resolver mismatch).

---

## Implementation Phases

## Phase 0 — Universal Links & App Links Infrastructure

### Tasks

1. **apps/mobile/app.config.ts** — add to the `ios` block:
   ```ts
   associatedDomains: ['applinks:motovault.app', 'applinks:www.motovault.app']
   ```
   Add to the `android` block:
   ```ts
   intentFilters: [
     {
       action: 'VIEW',
       autoVerify: true,
       data: [
         { scheme: 'https', host: 'motovault.app', pathPrefix: '/t/' },
         { scheme: 'https', host: 'www.motovault.app', pathPrefix: '/t/' },
       ],
       category: ['BROWSABLE', 'DEFAULT'],
     },
   ]
   ```
   Add/verify the `expo-router` plugin entry: `['expo-router', { origin: 'https://motovault.app' }]`.

2. **apps/web/src/app/.well-known/apple-app-site-association/route.ts** — Next.js route handler (NOT static file):
   ```ts
   import { NextResponse } from 'next/server';
   export const runtime = 'edge';
   export async function GET() {
     const teamId = process.env.APPLE_TEAM_ID!;
     const bundle = 'app.motovault';
     return NextResponse.json({
       applinks: {
         details: [{
           appIDs: [`${teamId}.${bundle}`],
           components: [
             { '/': '/t/*', comment: 'Trip share URLs' },
           ],
         }],
       },
       webcredentials: { apps: [`${teamId}.${bundle}`] },
     }, { headers: { 'Content-Type': 'application/json' } });
   }
   ```

3. **apps/web/src/app/.well-known/assetlinks.json/route.ts** — same pattern:
   ```ts
   export async function GET() {
     const fingerprint = process.env.ANDROID_CERT_SHA256!;
     return NextResponse.json([{
       relation: ['delegate_permission/common.handle_all_urls'],
       target: {
         namespace: 'android_app',
         package_name: 'app.motovault',
         sha256_cert_fingerprints: [fingerprint],
       },
     }], { headers: { 'Content-Type': 'application/json' } });
   }
   ```

4. **Environment variables** on Vercel: `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256`.

5. **Validation**:
   - [Apple AASA validator](https://branch.io/resources/aasa-validator/) — paste `https://motovault.app`
   - Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://motovault.app&relation=delegate_permission/common.handle_all_urls`
   - `curl -I https://motovault.app/.well-known/apple-app-site-association` → `Content-Type: application/json`, 200, no redirect.

### Acceptance Criteria — Phase 0

- [ ] `apps/mobile/app.config.ts` has `ios.associatedDomains` and `android.intentFilters`
- [ ] Next.js route handlers serve AASA + assetlinks.json with correct Content-Type
- [ ] Apple AASA validator passes
- [ ] Google Digital Asset Links API returns verified entry
- [ ] Manual smoke test on a TestFlight/Internal build opens the app on a fake `/t/aaaa...` URL (lands on error state)
- [ ] 24h CDN propagation wait observed before shipping Phase 1

---

## Phase 1 — MVP

### Phase 1.1 — Database migration `00086_trip_share_tokens.sql`

```sql
BEGIN;

-- Baseline assertion
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='trips_select') THEN
    RAISE EXCEPTION 'Missing baseline policy from 00085 — run migrations in order';
  END IF;
END $$;

-- 1. trip_share_tokens table
CREATE TABLE IF NOT EXISTS public.trip_share_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trip_share_tokens_trip_unique UNIQUE (trip_id),
  CONSTRAINT trip_share_tokens_hash_unique UNIQUE (token_hash)
);

ALTER TABLE public.trip_share_tokens ENABLE ROW LEVEL SECURITY;

-- Organiser can read their own; no one else touches this table directly.
-- All reads + mutations go through SECURITY DEFINER RPCs.
CREATE POLICY "trip_share_tokens_select" ON public.trip_share_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips t
            WHERE t.id = trip_share_tokens.trip_id
              AND t.organiser_user_id = (SELECT auth.uid()))
  );

-- 2. Backfill: mint tokens for existing unlisted trips (plaintext discarded)
INSERT INTO public.trip_share_tokens (trip_id, token_hash)
SELECT id, extensions.digest(encode(extensions.gen_random_bytes(32), 'hex')::bytea, 'sha256')
FROM public.trips WHERE visibility = 'unlisted'
ON CONFLICT (trip_id) DO NOTHING;

-- 3. Drop unlisted branch from trips_select
DROP POLICY IF EXISTS "trips_select" ON public.trips;
CREATE POLICY "trips_select" ON public.trips FOR SELECT USING (
  (visibility = 'public' AND (status <> 'draft' OR organiser_user_id = (SELECT auth.uid()) OR public.is_admin()))
  OR organiser_user_id = (SELECT auth.uid())
  OR (visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.trip_participants tp
        WHERE tp.trip_id = trips.id AND tp.user_id = (SELECT auth.uid())))
  OR public.is_admin()
);

-- 4. Drop unlisted branch from trip_waypoints_select
DROP POLICY IF EXISTS "trip_waypoints_select" ON public.trip_waypoints;
CREATE POLICY "trip_waypoints_select" ON public.trip_waypoints FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.trips t
          WHERE t.id = trip_waypoints.trip_id
            AND (t.visibility = 'public'
                 OR t.organiser_user_id = (SELECT auth.uid())
                 OR (t.visibility = 'private' AND EXISTS (
                     SELECT 1 FROM public.trip_participants tp
                     WHERE tp.trip_id = t.id AND tp.user_id = (SELECT auth.uid())))
                 OR public.is_admin()))
);

-- 5. Drop unlisted/public mingling from trip_participants_select
DROP POLICY IF EXISTS "trip_participants_select" ON public.trip_participants;
CREATE POLICY "trip_participants_select" ON public.trip_participants FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.trips t
             WHERE t.id = trip_participants.trip_id
               AND t.organiser_user_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.trips t
             WHERE t.id = trip_participants.trip_id
               AND t.visibility = 'public')
  OR EXISTS (SELECT 1 FROM public.trip_participants self
             WHERE self.trip_id = trip_participants.trip_id
               AND self.user_id = (SELECT auth.uid()))
  OR public.is_admin()
);

-- 6. resolve_trip_by_token RPC (anon + authed callable)
CREATE OR REPLACE FUNCTION public.resolve_trip_by_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_hash         BYTEA;
  v_trip         public.trips%ROWTYPE;
  v_waypoints    JSONB;
  v_participants JSONB;
BEGIN
  -- Validate shape (defense only; hash comparison is the real gate)
  IF p_token IS NULL OR p_token !~ '^[a-fA-F0-9]{64}$' THEN
    PERFORM pg_sleep(0.02); -- constant-time-ish padding
    RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
  END IF;

  v_hash := extensions.digest(lower(p_token)::bytea, 'sha256');

  SELECT t.* INTO v_trip
    FROM public.trip_share_tokens tst
    JOIN public.trips t ON t.id = tst.trip_id
    WHERE tst.token_hash = v_hash
      AND t.visibility = 'unlisted'
      AND t.status NOT IN ('draft', 'archived');

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.02);
    RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', w.id,
      'sort_order', w.sort_order,
      'day_index', w.day_index,
      'type', w.type,
      'name', w.name,
      'notes', w.notes,
      'lat', w.lat,
      'lng', w.lng
    ) ORDER BY w.sort_order, w.day_index), '[]'::jsonb)
    INTO v_waypoints
    FROM public.trip_waypoints w WHERE w.trip_id = v_trip.id;

  -- Participants: hash user_id with trip_id for correlation resistance;
  -- gate display_name on users.is_public.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'anon_id', encode(extensions.digest((tp.user_id::text || v_trip.id::text)::bytea, 'sha256'), 'hex'),
      'role', tp.role,
      'status', tp.status,
      'display_name', CASE WHEN u.is_public THEN u.display_name ELSE 'Rider' END,
      'avatar_url', CASE WHEN u.is_public THEN u.avatar_url ELSE NULL END
    )), '[]'::jsonb)
    INTO v_participants
    FROM public.trip_participants tp
    LEFT JOIN public.users u ON u.id = tp.user_id
    WHERE tp.trip_id = v_trip.id;

  -- Allow-list build — do NOT use to_jsonb(v_trip) - 'x' (deny-by-exception)
  RETURN jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'description', v_trip.description,
      'status', v_trip.status,
      'difficulty', v_trip.difficulty,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'max_riders', v_trip.max_riders,
      'participant_count', v_trip.participant_count,
      'cover_image_url', v_trip.cover_image_url
    ),
    'waypoints', v_waypoints,
    'participants', v_participants
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_min_duration_statement = -1
SET log_statement = 'none';

REVOKE ALL ON FUNCTION public.resolve_trip_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_trip_by_token(TEXT) TO anon, authenticated;

-- 7. rotate_trip_share_token RPC (organiser-only, returns plaintext once)
CREATE OR REPLACE FUNCTION public.rotate_trip_share_token(p_trip_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plaintext TEXT;
  v_hash      BYTEA;
BEGIN
  -- Verify organiser + lock the trip row
  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND organiser_user_id = auth.uid()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_plaintext := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := extensions.digest(v_plaintext::bytea, 'sha256');

  INSERT INTO public.trip_share_tokens (trip_id, token_hash)
  VALUES (p_trip_id, v_hash)
  ON CONFLICT (trip_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        rotated_at = now();

  RETURN v_plaintext;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_min_duration_statement = -1
SET log_statement = 'none';

REVOKE ALL ON FUNCTION public.rotate_trip_share_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_trip_share_token(UUID) TO authenticated;

COMMIT;
```

**Rollback script** (`supabase/migrations/rollbacks/00086_trip_share_tokens_rollback.sql`):
```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION public.resolve_trip_by_token(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rotate_trip_share_token(UUID) FROM authenticated;
DROP FUNCTION IF EXISTS public.resolve_trip_by_token(TEXT);
DROP FUNCTION IF EXISTS public.rotate_trip_share_token(UUID);
DROP TABLE IF EXISTS public.trip_share_tokens;
-- NOTE: re-applying 00085 policies requires a rerun of that migration.
COMMIT;
```

### Phase 1.2 — Regenerate types

```bash
npx supabase db push
npx supabase gen types typescript --linked 2>/dev/null > packages/types/src/database.types.ts
pnpm generate
```

### Phase 1.3 — Zod validators

**File:** `packages/types/src/validators/trip.ts`

```ts
// Branded type — forces callers through the schema
export const TripShareTokenSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/)
  .transform((s) => s.toLowerCase())
  .brand<'TripShareToken'>();
export type TripShareToken = z.infer<typeof TripShareTokenSchema>;

// RPC response contract — parsed at every service boundary
export const SharedTripRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['published', 'active', 'completed']),
  difficulty: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  max_riders: z.number().int(),
  participant_count: z.number().int(),
  cover_image_url: z.string().nullable(),
}).strict();

export const SharedTripWaypointSchema = z.object({
  id: z.string().uuid(),
  sort_order: z.number().int(),
  day_index: z.number().int().nullable(),
  type: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
}).strict();

export const SharedTripParticipantSchema = z.object({
  anon_id: z.string(),
  role: z.string(),
  status: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
}).strict();

export const ResolveTripByTokenResponseSchema = z.object({
  trip: SharedTripRowSchema,
  waypoints: z.array(SharedTripWaypointSchema),
  participants: z.array(SharedTripParticipantSchema),
}).strict();
export type ResolveTripByTokenResponse = z.infer<typeof ResolveTripByTokenResponseSchema>;
```

### Phase 1.4 — Backend (NestJS)

**File:** `apps/api/src/modules/trips/trips.service.ts`

Add two new methods — do NOT modify `tripDetail`:

```ts
async resolveTripByShareToken(shareToken: TripShareToken): Promise<SharedTrip> {
  const { data, error } = await this.supabaseAdmin.rpc('resolve_trip_by_token', {
    p_token: shareToken,
  });
  if (error || !data) throw new TripShareTokenError('NOT_FOUND');

  const parsed = ResolveTripByTokenResponseSchema.safeParse(data);
  if (!parsed.success) {
    this.logger.error({ err: parsed.error }, 'resolve_trip_by_token payload shape drifted');
    throw new TripShareTokenError('NOT_FOUND');
  }
  return this.mapRowToSharedTrip(parsed.data);
}

async rotateTripShareToken(userId: string, tripId: string): Promise<string> {
  await this.verifyOrganiser(userId, tripId);
  const { data, error } = await this.supabase.rpc('rotate_trip_share_token', { p_trip_id: tripId });
  if (error || !data) throw new InternalServerErrorException('Failed to rotate share token');
  return data as string;
}
```

**New:** `apps/api/src/modules/trips/errors/trip-share-token.errors.ts`:

```ts
export const TRIP_SHARE_TOKEN_ERROR_CODES = {
  NOT_FOUND: 'TRIP_SHARE_TOKEN_NOT_FOUND',
  MISMATCH: 'TRIP_SHARE_TOKEN_MISMATCH',
} as const;

export type TripShareTokenErrorCode =
  (typeof TRIP_SHARE_TOKEN_ERROR_CODES)[keyof typeof TRIP_SHARE_TOKEN_ERROR_CODES];

export class TripShareTokenError extends NotFoundException {
  constructor(public readonly reason: TripShareTokenErrorCode) {
    super({ message: 'Trip not found', reason });
  }
}
```

**File:** `apps/api/src/modules/trips/models/shared-trip.model.ts` — new ObjectType (narrower than `Trip`).

**File:** `apps/api/src/modules/trips/models/trip-share-link.model.ts` — new ObjectType with `token`, `url` fields.

**File:** `apps/api/src/modules/trips/trips.resolver.ts`:

```ts
@Query(() => SharedTrip, { nullable: true })
@Public()
@Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
async tripByShareToken(
  @Args('shareToken') shareToken: string,
): Promise<SharedTrip | null> {
  const parsed = TripShareTokenSchema.safeParse(shareToken);
  if (!parsed.success) throw new TripShareTokenError('NOT_FOUND');
  return this.tripsService.resolveTripByShareToken(parsed.data);
}

@Mutation(() => String)
@UseGuards(GqlAuthGuard)
@Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
async rotateTripShareToken(
  @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  @CurrentUser() user: AuthUser,
): Promise<string> {
  return this.tripsService.rotateTripShareToken(user.id, tripId);
}
```

**Field resolver** on `Trip` for organiser-only `shareLink`:

```ts
@ResolveField(() => TripShareLink, { nullable: true })
async shareLink(
  @Parent() trip: Trip,
  @CurrentUser() user?: AuthUser,
): Promise<TripShareLink | null> {
  if (!user || user.id !== trip.organiserUserId) return null;
  const result = await this.tripsService.getOrMintShareToken(trip.id, user.id);
  if (!result) return null;
  return {
    token: result.plaintext ?? null, // plaintext returned only on mint
    url: `https://motovault.app/t/${result.plaintext ?? 'rotate'}`,
  };
}
```

**Note:** because tokens are hashed at rest, the organiser cannot re-read their existing token. They must rotate to see a new plaintext. The field resolver exposes only the `url` placeholder (`https://motovault.app/t/rotate`) when plaintext is not available, with a button in the share sheet to mint a fresh one. This is documented in the share-sheet UX copy.

Actually simpler: **the organiser sees a "Generate link" button that calls `rotateTripShareToken`** — on success, the share sheet displays the returned plaintext URL (stored in component state, never persisted). Subsequent opens of the share sheet show "Show/rotate link" which calls rotate again.

### Phase 1.5 — GraphQL operations

**New files:**
- `apps/mobile/src/graphql/queries/trip-by-share-token.graphql`
- `apps/mobile/src/graphql/mutations/rotate-trip-share-token.graphql`

Run `pnpm generate` to regenerate `@motovault/graphql` types.

### Phase 1.6 — Next.js SSR (Next 16)

**File:** `apps/web/src/app/t/[token]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchTripByToken } from '@/lib/fetch-trip-by-token';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  // Always return teaser metadata — never trip-specific fields
  return {
    title: 'You have been invited to view a trip on MotoVault',
    description: 'Open MotoVault to see the route, waypoints, and details.',
    robots: {
      index: false, follow: false, nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
    openGraph: {
      title: 'You have been invited to view a trip on MotoVault',
      description: 'Open MotoVault to see the route.',
      images: [{ url: '/og/trip-teaser.png' }],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchTripByToken(token);
  return <SharedTripView data={data} />;
}
```

**File:** `apps/web/src/lib/fetch-trip-by-token.ts`

```ts
import 'server-only';
import { notFound } from 'next/navigation';
import { ResolveTripByTokenResponseSchema, type ResolveTripByTokenResponse } from '@motovault/types';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const TOKEN_PATTERN = /^[a-fA-F0-9]{64}$/;

export async function fetchTripByToken(
  token: string,
): Promise<ResolveTripByTokenResponse> {
  if (!TOKEN_PATTERN.test(token)) notFound();

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('resolve_trip_by_token', { p_token: token });
  if (error || !data) notFound();

  const parsed = ResolveTripByTokenResponseSchema.safeParse(data);
  if (!parsed.success) notFound();
  return parsed.data;
}
```

**File:** `apps/web/src/middleware.ts` — add matcher for `/t/*`:

```ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/t/')) {
    // Preview-bot detection — serve teaser head-only without RPC fire
    const ua = req.headers.get('user-agent') ?? '';
    const isPreviewBot = /(Slackbot|WhatsApp|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|TelegramBot)/i.test(ua);
    if (isPreviewBot) {
      return new Response('<html><head><title>Shared trip — MotoVault</title><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"></head></html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https://*.mapbox.com data:; connect-src 'self' https://api.mapbox.com; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none';");
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: ['/t/:path*'] };
```

**Edge rate limit** via `@vercel/edge-rate-limit` or Upstash: 30/min/IP on `/t/*`.

### Phase 1.7 — Expo Router trampoline

**New files:**
- `apps/mobile/src/app/t/[token]/index.tsx` — dedicated read-only preview screen
- `apps/mobile/src/hooks/use-trip-share-token-resolver.ts` — query hook returning discriminated union

**File:** `apps/mobile/src/app/t/[token]/index.tsx`

```tsx
import { useLocalSearchParams } from 'expo-router';
import { TripShareTokenSchema } from '@motovault/types';
import { useTripShareTokenResolver } from '@/hooks/use-trip-share-token-resolver';
import { SharedTripView } from '@/components/shared-trip-view';
import { ShareTokenErrorView } from '@/components/share-token-error-view';

export default function SharedTripScreen() {
  const params = useLocalSearchParams<{ token: string }>();
  const parsed = TripShareTokenSchema.safeParse(params.token);
  const state = useTripShareTokenResolver(parsed.success ? parsed.data : null);

  switch (state.status) {
    case 'validating':
    case 'fetching': return <LoadingSpinner />;
    case 'failed': return <ShareTokenErrorView />;
    case 'resolved': return <SharedTripView data={state.data} />;
  }
}
```

The `use-trip-share-token-resolver.ts` hook returns a discriminated union `TrampolineState` and handles TanStack Query with `retry: false`. The trampoline has **no** `router.replace` — all states are rendered in-place. This is finding P3.2 from TypeScript review.

Auth gate: `apps/mobile/src/app/_layout.tsx` must allow `/t/*` through without a session. Single agent owns this edit (parallel-agent guardrail).

**No dedicated `/t/revoked.tsx`** — `<ShareTokenErrorView />` renders the 404 state inline.

### Phase 1.8 — Share sheet UI (organiser side)

**File:** `apps/mobile/src/app/(modals)/trip-detail.tsx` — replace the stub at line 303.

**New component:** `apps/mobile/src/components/trip-share-sheet.tsx`

Trigger: header Share2 icon. Opens a full-screen modal (dark theme convention) with:
- Trip title + map thumbnail
- If `shareLinkPlaintext` is null (not yet minted this session): `Generate link` button → calls `rotateTripShareToken` mutation → stores plaintext in local state → replaces button with URL row
- Once plaintext present: URL row + `Copy link` / `Share…` / `Show QR` buttons
- Secondary destructive: `Regenerate link` (confirms + rotates) and `Stop sharing` (`updateTrip({ visibility: 'private' })`)
- Warning copy: *"Anyone with this link can view and forward the trip."*

**Clipboard sensitive flag:**
- Android: `Clipboard.setStringAsync(url, { isSensitive: true })` via a small `expo-modules-core` patch, or drop back to native `ClipboardManager.setPrimaryClip` with `ClipDescription.EXTRA_IS_SENSITIVE = true`.
- iOS: `UIPasteboard.general.setItems([["public.plain-text": url]], options: [.localOnly: true])` — requires a tiny native-module wrapper or `react-native-clipboard` with the `options` API.

**QR code:** `react-native-qrcode-svg` (Expensify fork, active in 2026), ECL `M`.

### Phase 1.9 — Create-trip visibility copy

**File:** `apps/mobile/src/app/(modals)/create-trip.tsx`

Line 86 — updated copy:
```
Unlisted — Anyone with the link can view (and forward it). Not shown on Discover.
```

### Phase 1.10 — Rides mirror

Same design applied to rides — `00086` also creates `ride_share_tokens` + RPC + policy updates for `rides_select_with_visibility`. Mobile `/r/[token]` trampoline + Next.js `/r/[token]` page. Sharing this into Phase 1 avoids carrying a live enumeration leak for another sprint.

**Note:** Originally this was Phase 2; the simplicity reviewer observed it's a literal copy-paste once the trip mirror is proven. Ship together in Phase 1 under a second migration `00087_ride_share_tokens.sql`.

### Phase 1.11 — Tests

- **Unit (trips.service.spec.ts):**
  - `resolveTripByShareToken` with valid token → success
  - `resolveTripByShareToken` with invalid format → `TripShareTokenError('NOT_FOUND')`
  - `resolveTripByShareToken` with revoked token → `TripShareTokenError('NOT_FOUND')`
  - `rotateTripShareToken` non-organiser → `ForbiddenException`
- **Integration (Vitest + test DB):**
  - Anon `SELECT * FROM trips WHERE visibility='unlisted'` returns `[]`
  - Anon `SELECT * FROM trip_waypoints WHERE trip_id IN (unlisted)` returns `[]`
  - Anon `SELECT * FROM trip_participants WHERE trip_id IN (unlisted)` returns `[]`
  - Anon `rpc('resolve_trip_by_token', { p_token: <valid> })` returns full JSON
  - Anon `rpc('resolve_trip_by_token', { p_token: <rotated-away> })` errors with generic message
  - `display_name` in response equals 'Rider' when `users.is_public = false`
  - `user_id` never appears in response (only `anon_id`)
  - `share_token` field never appears in response trip object
  - Concurrent rotate calls: both succeed, last-writer wins, both receive their own value
- **E2E (Playwright on web):**
  - `/t/{valid}` renders read-only trip
  - `/t/{invalid}` returns 404 with friendly copy
  - `/t/{token}` response headers include `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
  - Preview-bot UA receives head-only teaser (no body fetch from RPC)
  - Content-Security-Policy header present
- **Mobile E2E (Maestro or Detox):**
  - Cold-start with `motovault.app/t/<valid>` opens app on trampoline screen
  - Anonymous viewer sees read-only screen, no Join/Edit actions
- **Security assertions:**
  - Grep test logs for any 64-char hex string matching token — must find none

### Acceptance Criteria — Phase 1

- [ ] `supabase/migrations/00086_trip_share_tokens.sql` and `00087_ride_share_tokens.sql` merged
- [ ] `packages/types/src/database.types.ts` regenerated
- [ ] `trip_share_tokens` + `ride_share_tokens` tables exist with RLS
- [ ] Anon enumeration of unlisted trips + rides via PostgREST returns `[]`
- [ ] `tripByShareToken` + `rideByShareToken` GraphQL queries work
- [ ] `tripDetail` organiser receives `shareLink` sub-object via field resolver
- [ ] `rotateTripShareToken` mutation rotates; throttled to `SHARE_LINK` preset
- [ ] `/t/[token]` + `/r/[token]` Next.js routes return 200 for valid, 404 for invalid
- [ ] Response headers + CSP in middleware correct
- [ ] Preview-bot user agent served head-only teaser
- [ ] Mobile `/t/[token]` trampoline renders read-only preview without navigation
- [ ] Share sheet: Copy / Share / QR / Regenerate / Stop all work
- [ ] Clipboard sensitive flag set on Android + iOS
- [ ] Create-trip visibility copy updated
- [ ] PostHog `$current_url` redaction rule shipped for `/t/*`
- [ ] Edge rate limit active on Vercel
- [ ] No token value in any log output after test run
- [ ] `pnpm lint:fix` clean; `tsc --noEmit` clean for api, mobile, web, types
- [ ] Test suite (unit + integration + E2E + mobile) green

---

## Phase 2 — Follow-up Hardening (incremental)

Phase 2 is intentionally small now that major items moved to Phase 1.

### 2.1 — PostHog dashboards + abuse monitoring
- PostHog dashboard for `trip_share_link_opened` / `rotated`
- Alert rule: > 1000 opens on a single trip within 1h → notify admin
- No new audit table. PostHog is sufficient for this signal.

### 2.2 — Public-profile display-name leak review
- Follow-up audit across all public resolvers to verify `is_public` gating is consistent (not just in this RPC).

### 2.3 — Admin moderation runbook
- Document SQL steps for admin flip-to-private on abuse reports
- DMCA receiver docs — out-of-scope for code but owned by this plan

Deleted from Phase 2 (from original draft):
- ~~SHA-256 hashing~~ → moved to Phase 1
- ~~Per-trip OG opt-in toggle~~ → dropped permanently (teaser-only forever)
- ~~Failed-attempt audit table + Betterstack~~ → dropped (YAGNI; PostHog covers signals)
- ~~Rides mirror~~ → moved to Phase 1

---

## Parallel-Agent Swarm Guardrails

From architecture review finding #7 — the community-layer swarm precedent lost all `app.module.ts` registrations. Mitigations:

1. **Phase 0 runs serially, single agent.** No parallelism on `app.config.ts`, AASA/assetlinks route handlers, EAS credential extraction.
2. **Migration + types regen is a hard barrier.** `00086_trip_share_tokens.sql` + `00087_ride_share_tokens.sql` + `pnpm generate:types` + `pnpm generate` must land **before** any agent touches trips service/resolver code.
3. **`apps/api/src/app.module.ts` not modified.** Work stays within `TripsModule`.
4. **Single agent owns `apps/mobile/src/app/_layout.tsx`** (auth allowlist). Lands first.
5. **File ownership by agent:**
   - Agent A: migrations + Zod validators + types regen
   - Agent B: NestJS service + resolver + models (after A)
   - Agent C: Next.js route + middleware + AASA handlers (parallel to B)
   - Agent D: Mobile trampoline + share sheet + create-trip copy (after B's GraphQL shapes land)
6. **Post-swarm verification:** `pnpm lint:fix && pnpm --filter @motovault/api exec tsc --noEmit && pnpm --filter @motovault/mobile exec tsc --noEmit && pnpm --filter @motovault/web exec tsc --noEmit && pnpm --filter @motovault/types exec tsc --noEmit`
7. **Snapshot shared files pre-swarm:** `app.module.ts`, `_layout.tsx`, `app.config.ts` — diff post-swarm, any unexpected change is a red flag.

---

## Rollback Plan

**Phase 0:**
- Remove `ios.associatedDomains` + `android.intentFilters` from `app.config.ts`, ship a new build.
- Route handlers can be deleted or made to return 404.

**Phase 1 migration (`00086` / `00087`):**
- Run `supabase/migrations/rollbacks/00086_trip_share_tokens_rollback.sql`
- This drops the RPCs + `trip_share_tokens` table
- RLS policies need manual re-apply from 00085 (documented inline)
- Regenerate types after rollback

**Phase 1 code:**
- `git revert` the PR — all code changes are additive except the trip-detail share stub replacement

**Runbook — emergency revoke:**
- If a token leaks in public: `UPDATE trips SET visibility='private' WHERE id=<abuse>` — RPC immediately 404s. Alternatively `DELETE FROM trip_share_tokens WHERE trip_id=<abuse>` to preserve visibility but kill the token.

---

## System-Wide Impact

### Interaction Graph

1. Organiser creates unlisted trip → `createTripWithWaypoints` → trip row inserted.
2. Organiser opens trip-detail → `tripDetail(tripId)` → field resolver returns `shareLink: { token: 'rotate', url: '/t/rotate' }` (placeholder, no plaintext available yet because nothing has been minted).
3. Organiser taps Share → `Generate link` → `rotateTripShareToken(tripId)` → RPC inserts `trip_share_tokens` row → returns plaintext → mobile stores in component state → share sheet shows URL.
4. Recipient taps URL → universal-link → Expo trampoline `/t/[token]/index.tsx` → `tripByShareToken(token)` → NestJS resolver → `resolve_trip_by_token` RPC → JSON → Zod parse → SharedTrip → mobile render.
5. Non-installed recipient → web `/t/[token]/page.tsx` (Next.js RSC) → `fetch-trip-by-token.ts` → anon Supabase RPC → JSON → Zod parse → read-only render.

### Error & Failure Propagation

- DB raises `P0002 Trip not found` on any miss
- NestJS `TripShareTokenError('NOT_FOUND')` with `reason` for internal logging
- GraphQL `NOT_FOUND` extension code
- Mobile/web render single-state error screen

### API Surface Parity

- New: `tripByShareToken(shareToken)`, `rotateTripShareToken(tripId)`
- New: `rideByShareToken(shareToken)`, `rotateRideShareToken(rideId)`
- New: `Trip.shareLink` field resolver (organiser-only)
- New: `Ride.shareLink` field resolver (organiser-only)
- Unchanged: `tripDetail(tripId)`, `rideDetail(rideId)`

### Integration Test Scenarios

1. Anon PostgREST `SELECT * FROM trips WHERE visibility='unlisted'` → `[]`
2. Anon `rpc('resolve_trip_by_token', { p_token: <valid> })` → full JSON
3. Anon `rpc('resolve_trip_by_token', { p_token: <rotated-away> })` → error
4. Grep all test logs for 64-char hex — zero matches
5. Preview-bot UA GET `/t/<valid>` → head-only response, RPC not called
6. Response headers include all 4 required policies

---

## Acceptance Criteria — Overall

### Functional
- [ ] Phase 0, Phase 1 checklists complete
- [ ] Anon enumeration returns empty for trips + waypoints + participants + rides
- [ ] Short URLs work on iOS + Android via Universal/App Links
- [ ] Organiser can rotate + stop
- [ ] Recipient can view read-only on web and mobile
- [ ] Teaser-only OG served to all scrapers

### Non-Functional
- [ ] Resolve RPC p95 < 50ms (verified via load test)
- [ ] Edge + NestJS rate limits active
- [ ] No `any` in new trips code (enforced via `tsc --noEmit`)
- [ ] All new files pass biome check
- [ ] CSP + Referrer-Policy + X-Robots-Tag + Cache-Control set on `/t/*`
- [ ] PostHog `$current_url` redacts `/t/*`
- [ ] No token value logged anywhere

### Quality Gates
- [ ] Test coverage ≥80% on new service methods + RPCs
- [ ] Rollback script tested on staging
- [ ] Manual walkthrough: organiser mints → shares via WhatsApp → recipient sees teaser → opens in app

---

## Success Metrics

- **Primary:** zero CVE-equivalent reports about enumerable unlisted trips for 30 days post-merge
- **Secondary:** `trip_share_link_opened` > 0 within 7 days of deploy
- **Tertiary:** ratio of `trip_share_link_opened(surface=app)` to `(surface=web)` ≥ 50%
- **Counter:** edge rate-limit 429 spikes → investigate

## Dependencies & Risks

### Dependencies
- `APPLE_TEAM_ID` env var on Vercel
- `ANDROID_CERT_SHA256` env var on Vercel
- `react-native-qrcode-svg` (Expensify fork) — new mobile dependency
- Supabase `extensions.digest` (pgcrypto — already available)
- `@vercel/edge-rate-limit` or Upstash — new web dependency

### Risks

| Risk | Sev | Mitigation |
|---|---|---|
| Universal Link AASA misconfig | High | Route handler generates at runtime; Apple validator before ship; 24h propagation wait |
| Existing unlisted URLs break | Low | URLs never worked (stub); backfill mints new tokens; organiser sees new URL in share sheet on next open |
| Parallel agent conflicts on shared files | Med | File-ownership rules above; single-agent phases for `_layout.tsx`/`app.config.ts` |
| Token leakage via PostHog `$current_url` | Med | Global sanitize_properties filter; verified in integration tests |
| Preview-bot pollution of RPC metrics | Low | UA detection in middleware; head-only response |
| Backup plaintext exposure | **Mitigated** | Hashing at rest in Phase 1 (was Phase 2) |
| Rollback complexity | Med | Documented rollback script + runbook |

## Resource Requirements

- Solo developer (per user memory)
- Infra: existing Supabase + Vercel + Render NestJS
- 3rd-party: Mapbox (existing), `react-native-qrcode-svg` (new), `@vercel/edge-rate-limit` (new)

## Future Considerations

- Labeled links ("Marek", "WhatsApp group") — requires relaxing `UNIQUE(trip_id)` on `trip_share_tokens`
- Per-link expiry — add back if users request
- Per-link open analytics — add audit table when there's a product reason
- Real-time revocation propagation via Supabase Realtime
- Signed URLs for public preview images (avoids Mapbox static token exposure)

## Documentation Plan

- `docs/solutions/security-issues/trip-share-tokens-capability-urls.md` — post-merge retro documenting the 6-agent deepen-plan review and which suggestions shipped vs deferred
- Update `apps/mobile/CLAUDE.md` with `/t/*` + `/r/*` deep link convention
- Add SECURITY DEFINER + `log_min_duration_statement = -1` pattern to `docs/solutions/` as a reusable recipe

## Sources & References

### Internal
- Security audit synthesis (this conversation, 2026-04-10)
- 4-researcher H2 memo (this conversation)
- 6-agent deepen-plan review (this conversation): security-sentinel, data-integrity-guardian, kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer, framework-docs-researcher
- `supabase/migrations/00085_trip_security_hardening.sql` — canonical migration style
- `apps/api/src/modules/share-links/share-links.service.ts` — reference implementation
- `apps/api/src/config/constants.ts:45` — `THROTTLE_PRESETS.SHARE_LINK`
- `apps/web/src/app/ride/[id]/page.tsx` — SSR pattern
- `apps/mobile/src/hooks/use-notification-deep-link.ts` — pending-route pattern
- `docs/solutions/integration-issues/community-layer-full-stack-implementation.md` — Universal Links precedent + swarm traps

### External
- Expo Router v7 deep linking: https://docs.expo.dev/linking/into-your-app/
- Expo iOS Universal Links: https://docs.expo.dev/linking/ios-universal-links/
- Expo Android App Links: https://docs.expo.dev/linking/android-app-links/
- Next.js 16 generateMetadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js opengraph-image convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
- Supabase DB functions: https://supabase.com/docs/guides/database/functions
- Supabase advisor rule 0011: https://supabase.com/docs/guides/database/database-advisors?lint=0011_function_search_path_mutable
- Apple AASA: https://developer.apple.com/documentation/xcode/supporting-associated-domains
- Android App Links verification: https://developer.android.com/training/app-links/verify-android-applinks
- `react-native-qrcode-svg` Expensify fork: https://github.com/Expensify/react-native-qrcode-svg

### Related Work
- Branch: `feat/backlog-batch-mot-137-143`
- Previous migration: `supabase/migrations/00085_trip_security_hardening.sql`
- Audit context: 2026-04-10 — synthesized from 4 parallel research agents + 6 parallel deepen-plan reviewers
