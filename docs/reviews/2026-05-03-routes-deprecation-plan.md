---
title: "Routes Deprecation Plan — staged path to dropping the legacy `routes` table"
type: tech-debt
status: proposal
date: 2026-05-03
related:
  - docs/reviews/2026-05-03-explore-monetization-tech-debt-review.md
  - docs/plans/2026-05-03-001-feat-explore-monetization-funnel-plan.md
verdict: routes table cannot be dropped today; staged deprecation can fully retire it in 3-4 weeks
---

# Routes Deprecation Plan

## TL;DR

Two questions:

1. **Can we drop the proposed `route_suggestions` table?** **Yes — never create it.** Consolidate into the existing `trip_suggestions` table (00106) per the tech-debt review. The plan should remove the `CREATE TABLE route_suggestions` from migration 00125.

2. **Can we drop the legacy `routes` table?** **Not today.** Three blockers:
   - Web actively uses it (`SaveRouteButton` in `/explore` and `/garage`).
   - New rows are still being inserted via `shareRideToDiscover` mutation.
   - 3 satellite tables (`route_list_items`, `surface_reports`, `sponsorships`) have un-migrated CASCADE FKs to `routes(id)`.

But: **all of mobile is already migrated** (route GraphQL files exist but are not imported by any screen — pure dead code). And the `SavedRoutesResolver` already has a class-level `@deprecated` JSDoc.

This document lays out a 4-stage plan. Stage 1 (the only one that touches this PR) marks the legacy surface explicitly deprecated and migrates the web holdouts. Stages 2-4 are follow-on tracks that can ship over 3-4 weeks.

---

## Current state — where the legacy lives

### Mobile (apps/mobile)

| Operation | File present | Imported by any screen? | Status |
|---|---|---|---|
| `SavedRoutes`, `SaveRoute`, `UnsaveRoute` | yes | no | **dead code** |
| `RouteDetail`, `RouteBySlugDeeplink` | yes | no | **dead code** |
| `DiscoverRoutes`, `DiscoverRoutesMap` | yes | no | **dead code** |
| `IsRouteSaved` | yes | no | **dead code** |
| `GetRouteReviews`, `CreateRouteReview` | yes | no | **dead code** |
| `TemplateTripIdForRoute` | yes | no | **dead code** |
| `FuelStopsNearRoute` | yes | no | **dead code** |
| `MyRidesForHeatmap` | yes | yes (active) | references routes — keep |
| `TrackAffiliateClick` | yes | no | **dead code** |

Mobile is ready for cleanup. Removing these `.graphql` files only affects generated types in `packages/graphql`; nothing is imported.

### Web (apps/web)

| Component | Operations used | Where mounted | Status |
|---|---|---|---|
| `SaveRouteButton` | `IsRouteSaved`, `SaveRouteToCollection`, `UnsaveRouteFromCollection` | `/explore/page.tsx:8`, `/garage/page.tsx:310` | **ACTIVELY USED — must migrate before deprecation** |
| `SavedRoutes` query | reads `savedRoutes` | `/garage/page.tsx:12-35` | **ACTIVELY USED** |
| `RouteBySlug`, `ExploreDiscoverRoutes` | reads | various | **likely dead/transitional — verify** |
| `RoutePathById`, `SitemapPublishedRoutes` | reads | sitemap, route detail | **ACTIVELY USED** |
| `ExportRouteGPX` | mutates | route detail GPX flow | **ACTIVELY USED** |

Web is the holdout. Two pages (`/explore`, `/garage`) need their save button rewired before any deprecation can land cleanly.

### API (apps/api)

`SavedRoutesResolver` has a class-level JSDoc deprecation comment but **none of its individual GraphQL mutations carry the `@Deprecated` schema directive**. Only 3 queries do (`discoverRoutes`, `routeBySlug`, `routeDetail` — all in `routes.resolver.ts`, with deprecation reasons mentioning "Use discoverTrips/discoverTripBySlug/discoverTripById query instead. Removal target: 8 weeks post-OTA").

So the deprecation policy was started but not finished. Most of the route surface area is undocumented as deprecated despite being slated for removal.

### DB

| Table | FK to routes | Action | Status |
|---|---|---|---|
| `comments.route_id` | yes | CASCADE | partially migrated (00119) |
| `route_reviews.route_id` | yes | CASCADE | data migrated to `trip_reviews` |
| `route_saves.route_id` | yes | CASCADE | data migrated to `trip_saves`; **still being written** |
| `route_list_items.route_id` | yes | CASCADE | **ACTIVE — not migrated** |
| `surface_reports.route_id` | yes | CASCADE | **ACTIVE — not migrated** |
| `sponsorships.route_id` | yes | CASCADE | **ACTIVE — not migrated** |
| `group_rides.route_id` | yes | SET NULL | safe |
| `user_gating_events.route_id` | yes | SET NULL | safe (also gets `trip_id` per 00125) |

Triggers that would error on DROP TABLE: `trg_update_route_comment_count` (on `comments`), `trg_update_route_rating` (on `route_reviews`). Both fire `UPDATE routes ...` in their function body.

Functions referencing routes: `update_route_geography()`, `update_route_comment_count()`, `update_route_rating()`. None are SECURITY-critical; all become orphaned on drop.

---

## Staged plan

### Stage 1 — In this PR (Track 1 work)

**Scope:** Mark everything as deprecated. Remove dead mobile code. Migrate web's two holdouts. Don't touch the DB yet.

#### 1A. Apply `@Deprecated` to every legacy GraphQL operation

Add the `@Deprecated('reason')` decorator to every route mutation/query in `RoutesResolver` and `SavedRoutesResolver`. NestJS GraphQL emits `@deprecated` schema directives, which both clients honor and codegen surfaces as warnings.

```typescript
// apps/api/src/modules/routes/saved-routes.resolver.ts
@Mutation(() => Route, {
  deprecationReason:
    'Use saveTripTemplate from TripsResolver. Removal target: 6 weeks.',
})
async saveRouteToCollection(...) { ... }

@Mutation(() => Boolean, {
  deprecationReason:
    'Use unsaveTripTemplate from TripsResolver. Removal target: 6 weeks.',
})
async unsaveRouteFromCollection(...) { ... }
```

Apply to: `saveRouteToCollection`, `unsaveRouteFromCollection`, `savedRoutes`, `publicSavedRoutes`, `isRouteSaved`, `getRouteReviews`, `createRouteReview`, `exportRouteGPX`, `routePathById`, `routeConditions`, `routeSponsorships`, `fuelStops`, `fuelStopsNearRoute`, `templateTripIdForRoute`, `sitemapPublishedRoutes`, `shareRideToDiscover`, `unshareRoute`.

This is mechanical, ~30 lines of decorator additions, no behavior change. After deploy, both mobile and web `pnpm generate` runs surface the deprecation warnings in their generated docs — which is the documentation we currently lack.

#### 1B. Migrate the web holdouts

Two files:

**`apps/web/src/components/save-route-button.tsx`** — swap the inline `IsRouteSaved`, `SaveRouteToCollection`, `UnsaveRouteFromCollection` documents for the trip equivalents. The trip mutations already exist (`saveTripTemplate`, `unsaveTripTemplate`, `isTripSaved`). Rename the component file to `save-trip-button.tsx` while you're there.

**`apps/web/src/app/(community)/garage/page.tsx`** — swap the `SavedRoutes` query for `savedTrips`. Same shape (paginated list of saved entities); column-by-column rename.

Both call sites in `/explore/page.tsx` and `/garage/page.tsx` get updated to the new component name. Single-PR-scoped change.

**Test:** existing E2E for save/unsave should pass against the trips API. If there's no E2E coverage, add one — it's a load-bearing path.

#### 1C. Remove dead mobile route GraphQL files

Delete every `.graphql` file under `apps/mobile/src/graphql/` that defines a route operation, **except** `MyRidesForHeatmap` which is actively imported. The audit confirmed zero screen imports for the others.

Run `pnpm generate` after deletion; the corresponding entries in `packages/graphql/src/generated/` will disappear. This shrinks the mobile bundle and removes the surface area that could be re-imported by accident.

#### 1D. Don't create `route_suggestions`

In migration `00125_explore_monetization.sql`, remove the `CREATE TABLE route_suggestions` block entirely (~40 SQL lines). Replace with the `trip_suggestions` extension already specified in the tech-debt review:

```sql
ALTER TABLE trip_suggestions ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE trip_suggestions
  ADD COLUMN country_code TEXT,
  ADD COLUMN source_url TEXT CHECK (source_url IS NULL OR char_length(source_url) <= 2048);
ALTER TABLE trip_suggestions DROP CONSTRAINT trip_suggestions_kind_check;
ALTER TABLE trip_suggestions ADD CONSTRAINT trip_suggestions_kind_check
  CHECK (kind IN ('waypoint','note','new_route'));
ALTER TABLE trip_suggestions ADD CONSTRAINT trip_suggestions_target_check
  CHECK (
    (kind IN ('waypoint','note') AND trip_id IS NOT NULL)
    OR (kind = 'new_route' AND country_code IS NOT NULL AND trip_id IS NULL)
  );
```

The country-page "Suggest a route" form mutation calls `createTripSuggestion(input: { kind: 'new_route', countryCode, name, notes, sourceUrl })`. The admin queue is already built.

**Stage 1 effort estimate:** 1-1.5 days. Same PR as Track 1 of the implementation plan.

---

### Stage 2 — Stop new writes to `routes` (week 2-3)

**Scope:** Make the `routes` table strictly append-blocked from the application layer. New `shareRideToDiscover` calls write to the unified `trips` table instead.

#### 2A. Reroute `shareRideToDiscover` to write to `trips`

Currently in `routes.service.ts:266-363`, this mutation inserts into `routes` and calls `update_route_geography`. Replace with: insert into `trips` with `is_template = false, status = 'published', visibility = 'public'`. Re-emit the same return type for the existing client compatibility window.

Add a deprecation reason to the GraphQL mutation: `'Use shareRideToTrip. Removal: 8 weeks.'` and ship the new `shareRideToTrip` mutation alongside if not already present.

#### 2B. Block new `routes` inserts at the DB layer

Once application code no longer writes routes, add a defensive trigger:

```sql
CREATE OR REPLACE FUNCTION block_route_inserts() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'routes table is frozen; insert into trips with is_template=false instead';
END $$;

CREATE TRIGGER trg_routes_no_insert BEFORE INSERT ON routes
  FOR EACH ROW EXECUTE FUNCTION block_route_inserts();
```

If the app accidentally tries to insert a row, you get a clear error in Sentry rather than silent legacy growth.

**Stage 2 effort estimate:** 2-3 days, separate PR.

---

### Stage 3 — Migrate the un-migrated satellites (week 3-4)

**Scope:** Move `route_list_items`, `surface_reports`, `sponsorships` to trip-pointing equivalents. After this, dropping `routes` becomes safe.

#### 3A. `route_list_items` → `trip_list_items`

The mobile audit suggests "lists" / "collections" UX is still active in the codebase. Create a `trip_list_items` table that points at `trips(id)` instead of `routes(id)`, then run a migration script:

```sql
-- New migration, e.g., 00131_route_list_items_to_trip_list_items.sql
CREATE TABLE trip_list_items (
  -- mirror route_list_items shape, but trip_id UUID REFERENCES trips(id) ON DELETE CASCADE
);

-- Backfill via the existing migration chain:
-- routes → discover_trips (00112) → trips (00118)
INSERT INTO trip_list_items (list_id, trip_id, ...)
SELECT rli.list_id, t.id, ...
FROM route_list_items rli
JOIN discover_trips dt ON dt.migrated_from_route_id = rli.route_id
JOIN trips t ON t.migrated_from_discover_trip_id = dt.id;
```

Update the API resolver(s) to read from the new table. Keep `route_list_items` populated by a temporary write-through trigger for one release cycle, then stop.

#### 3B. `surface_reports.route_id` → `surface_reports.trip_id`

Add a `trip_id` column to `surface_reports` (analogous to the `user_gating_events` change in 00125), backfill via the same join chain, then drop `route_id`. Application code needs to re-point.

This is potentially a content-loss area: any surface report whose route never made it to `trips` (i.e., `routes.status != 'published'` at migration time) has no trip to attach to. Decide policy: drop those reports, or leave `trip_id` nullable + keep the historical `route_id` for archival reads.

#### 3C. `sponsorships.route_id` → `sponsorships.trip_id`

Same pattern. This one is revenue-adjacent so be careful: an active sponsorship contract may reference a specific route URL. Coordinate with whoever sells sponsorships.

**Stage 3 effort estimate:** 5-7 days, depending on how live `surface_reports` and `sponsorships` traffic is.

---

### Stage 4 — DROP TABLE routes (week 4+, after all stages above)

**Scope:** Final removal. Single migration once nothing reads or writes it.

```sql
-- 00135_drop_routes.sql or whatever the migration number is by then

-- Drop triggers and functions first
DROP TRIGGER IF EXISTS trg_update_route_comment_count ON comments;
DROP TRIGGER IF EXISTS trg_update_route_rating ON route_reviews;
DROP TRIGGER IF EXISTS trg_routes_no_insert ON routes;

DROP FUNCTION IF EXISTS update_route_geography(UUID);
DROP FUNCTION IF EXISTS update_route_comment_count();
DROP FUNCTION IF EXISTS update_route_rating();

-- Drop dependent satellite tables (if not already migrated/dropped)
DROP TABLE IF EXISTS route_reviews CASCADE;
DROP TABLE IF EXISTS route_saves CASCADE;
DROP TABLE IF EXISTS route_list_items CASCADE;
-- (after Stage 3 completes for surface_reports and sponsorships)

-- Final
DROP TABLE routes CASCADE;
```

**Pre-drop verification queries:**

```sql
-- Verify zero references in 30 days
SELECT COUNT(*) FROM route_saves WHERE created_at > NOW() - INTERVAL '30 days';
SELECT COUNT(*) FROM route_list_items WHERE created_at > NOW() - INTERVAL '30 days';

-- Verify Sentry/PostHog has zero events naming a deprecated route operation
-- (manual check)
```

After drop:

- Remove `apps/api/src/modules/routes/` entirely.
- Remove all remaining route `.graphql` files from `apps/web/src/graphql/`.
- Run `pnpm generate` to clean up `packages/graphql`.

**Stage 4 effort estimate:** 1 day.

---

## What `route_suggestions` should be (since you asked)

The plan as written creates `route_suggestions` as a brand-new table. **It should not exist.** Two reasons:

1. The exact workflow it provides (pending/accepted/rejected status, admin decision audit, RLS, `(status) WHERE status='pending'` index) is already in `trip_suggestions` (00106).

2. Even if you wanted a separate table, naming a new table after the legacy `routes` taxonomy in 2026 propagates the legacy mental model into new code. The unified entity is `trip`. The form is "suggest a trip for this country." The UI label can still say "Suggest a route" — it's the schema name that matters.

So: in the same migration where you'd have created `route_suggestions`, instead extend `trip_suggestions` with `kind = 'new_route'` + nullable `trip_id` + new `country_code` and `source_url` columns. ~10 lines of ALTER instead of ~80 lines of CREATE + 4 RLS + 3 indexes.

---

## Tracking and accountability

Suggested follow-up tickets for the engineering tracker (post-implementation-plan):

| Ticket | Stage | Owner area | Estimate |
|---|---|---|---|
| Add `@Deprecated` to all legacy route GraphQL ops | 1A | API | 2h |
| Migrate `SaveRouteButton` → `SaveTripButton` on web | 1B | Web | 4h |
| Update `/garage` to use `savedTrips` | 1B | Web | 2h |
| Delete dead mobile route `.graphql` files | 1C | Mobile / Codegen | 1h |
| Reroute `shareRideToDiscover` → `trips` writes | 2A | API | 1d |
| Add insert-blocking trigger on `routes` | 2B | DB | 2h |
| Migrate `route_list_items` → `trip_list_items` | 3A | DB + API + UI | 3d |
| Migrate `surface_reports.route_id` → `trip_id` | 3B | DB + API | 2d |
| Migrate `sponsorships.route_id` → `trip_id` | 3C | DB + API + biz coordination | 2d |
| Final: DROP TABLE routes | 4 | DB | 1d |

Total: ~3-4 weeks of staged work. Stage 1 ships in this PR; Stages 2-4 are independent follow-ons.

---

## Summary

**For this PR (Track 1 of the implementation plan):**

- Don't create `route_suggestions`. Extend `trip_suggestions` instead.
- Add `@Deprecated` decorators to all legacy route GraphQL operations.
- Migrate `SaveRouteButton` and `/garage` to the trips API.
- Delete dead mobile route GraphQL files.

**For the next 3-4 weeks:**

- Stop writing new routes (Stage 2).
- Migrate the 3 un-migrated satellite tables (Stage 3).
- Drop the routes table and clean up the routes module (Stage 4).

**`affiliate_clicks` separately:** the table is fine — it's a domain table for partner click tracking, unrelated to the routes deprecation. The `TrackAffiliateClick` mobile mutation has no UI consumer; either wire it up in v2 or remove the mutation. Not blocking.

Reviewer: Claude (sonnet)
