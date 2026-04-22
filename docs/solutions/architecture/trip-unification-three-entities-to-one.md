---
title: "Trip Unification: Merging routes, trips, and discover_trips into one table"
category: architecture
date: 2026-04-22
tags: [supabase, postgresql, rls, graphql, nestjs, schema-migration, data-model, refactor]
module: Trips
symptom: "Three overlapping entities (routes, trips, discover_trips) with fragmented features, JSONB/relational serialization boundary, 69 RLS policies, 3 detail screens, 3 API modules"
root_cause: "Entities were built incrementally — routes for ride paths, trips for planning, discover_trips for templates — creating triple maintenance cost and feature fragmentation"
severity: high
effort: large
---

# Trip Unification: Three Entities → One

## Problem

MotoVault had three separate database entities for "a motorcycle journey":

- **routes** (deprecated) — single-day paths from rides, PostGIS geography, route_reviews, route_saves
- **trips** — multi-day itineraries with collaboration (participants, invites, suggestions)
- **discover_trips** — trip templates for the Discover feed, JSONB waypoints, discover_trip_reviews

This caused: 2,530 lines across 3 service files, 69 RLS policies (trips_select rewritten 4x), a fragile JSONB↔relational serialization boundary (publishTripToDiscover serialized rows→JSONB, cloneDiscoverTrip reversed it), features landing on arbitrary entities (reviews on 2/3, saves on 1/3, GPX on 1/3).

## Root Cause

Build-order artifact. Routes came first (ride recording), then trips (planning), then discover_trips (template library). Each was designed in isolation rather than extending the existing entity.

## Solution

Unified everything into one `trips` table with `is_template BOOLEAN DEFAULT false`.

### Key Decisions

1. **Live view, not snapshot.** Setting `is_template = true` on the same row (no copy). Eliminates the JSONB serialization boundary entirely. If edit-during-publish becomes a problem, add `template_frozen_at` later.

2. **Publishing independent of trip status.** A draft can be a template. Only gate: title + description + 2+ waypoints + country_code present.

3. **Split RLS into two policies.** Template reads (`is_template = true AND visibility = 'public'`) bypass the expensive participant subquery. Personal trips keep the complex visibility/participant logic.

4. **Partial indexes.** 5 partial indexes WHERE `is_template = true` ensure discover queries never scan personal trips.

5. **Atomic clone RPC.** Replaced 3 separate service calls with a single PL/pgSQL function (trip + waypoints + participant + clone_count in one transaction).

### Migration Strategy (non-breaking, phased)

1. **00117**: Add ~20 nullable columns to trips + create trip_reviews + trip_saves + split RLS + partial indexes + triggers
2. **00118**: Copy discover_trips → trips with is_template=true, deserialize JSONB waypoints → trip_waypoints rows
3. **00119**: Migrate reviews (only from discover_trip_reviews to avoid dupes), saves, remap comments.route_id
4. **00120**: Atomic clone_trip_template RPC

All additive — old tables remain untouched. Old mobile versions keep working via deprecated resolvers.

### Service Architecture

Split 1,080-line god service → 7 focused services: TripLifecycle, TripWaypoints, TripParticipants, TripSharing, TripTemplates, TripReviews, TripSaves. Added DataLoaders for Trip.reviews and Trip.isSaved.

### Gotchas Encountered

- **`trip_saves.saved_at` vs `created_at`**: The migration used `saved_at` but the service code used `created_at`. PostgREST returns 400 error. Always verify column names match between DDL and service interfaces.
- **PromiseLike vs Promise**: Supabase client `.rpc()` returns `PromiseLike`, not `Promise`. `.catch()` doesn't exist on PromiseLike. Wrap with `Promise.resolve()`.
- **Constructor param name clashing with method name**: NestJS resolver `private readonly tripTemplates` collided with `async tripTemplates()` query method. Rename param to `tripTemplatesSvc`.
- **Missing RPC**: `increment_trip_clone` was called in service but never created in migration. Fire-and-forget silently swallowed the error. Always verify RPC functions exist before deploying.
- **Comment blocks wrapping JSX**: Wrapping old page.tsx code in `/* ... */` broke TypeScript — JSX inside block comments is invalid. Just delete old code; it's in git history.
- **Title length mismatch**: `trips.title` CHECK was 100 chars, `discover_trips.title` was 150. Must widen before migration or data gets truncated.
- **Review deduplication**: Migration 00112 already copied route_reviews → discover_trip_reviews. Only migrate from discover_trip_reviews to trip_reviews — skip route_reviews directly.

## Prevention

- **One entity per domain concept.** When adding a "template" or "published" version of an entity, use a boolean flag or status on the same table — don't create a parallel table.
- **Verify RPCs exist before calling them.** Add integration tests that call RPCs against a real Supabase local instance.
- **Column name parity check.** When creating a new table + service, grep the service for column names and verify they match the DDL.
- **Trigger WHEN clauses.** When adding triggers to a unified table, use `WHEN (NEW.column = value)` to avoid firing on irrelevant rows.

## Stats

- 19 commits, 111 files changed, +5,743 / -4,566 lines
- 4 SQL migrations, 7 API services, 12 new GraphQL operations, 12 new .graphql files
- 3 detail screens → 1, 3 API modules → 1 (+ 2 deprecated), 5 tables eliminated
- 5-agent code review: 3 P1s + 8 P2s found and fixed before merge

## Related

- Architecture review plan: `docs/plans/2026-04-22-001-architecture-review-unified-simplification-plan.md`
- Implementation plan: `docs/plans/2026-04-22-002-refactor-trip-unification-implementation-plan.md`
- Discover trip brainstorm: `docs/brainstorms/2026-04-18-discover-trip-templates-brainstorm.md`
- Prior route→discover migration: `supabase/migrations/00112_migrate_routes_to_discover_trips.sql`
