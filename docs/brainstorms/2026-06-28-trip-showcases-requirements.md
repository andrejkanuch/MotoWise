---
date: 2026-06-28
topic: trip-showcases
---

# Trip Showcases (Dateless Trips)

## Summary

Add a top-level mode toggle to the trip planner — **"Already rode it"** vs **"Planning"** — so a rider can publish a trip they already took *without* picking start/end dates. A showcase carries the route, waypoints, and notes but no dates or rider list; when set public it flows into web Explore and mobile Discover, where other riders view, clone, and adjust it into their own trip. A showcase is the existing template under the hood, so clone, share-by-link, and the discovery feeds are reused as-is.

## Problem Frame

The trip system was unified in `supabase/migrations/00117_trip_unification_schema.sql`, and most of "a shareable, cloneable, discoverable route" already exists as a **template** (`is_template = true`): date-agnostic in spirit (parameterized by `day_count`), shareable via `trip_share_tokens`, cloneable via the `cloneTrip` mutation, and surfaced in `/explore` (web) and the `(tabs)/(discover)` feed (mobile).

The blocker is a single mismatch: `trips.start_date` and `trips.end_date` are `NOT NULL` (`supabase/migrations/00072_trips.sql`), even for templates, and the planner requires a valid date range to save (`apps/mobile/src/utils/trip-form-dates.ts`). A rider who just wants to say "here's a route I rode, copy it if you like" is forced to invent dates that mean nothing. There is no point in the UI where they declare "this already happened" versus "this is a plan," so the date fields can't know whether to ask.

## Key Decisions

- **A showcase is a template, not a new entity.** "Already rode it" maps to the existing `is_template = true` path; "Planning" maps to `is_template = false`. This reuses clone, share tokens, and the Explore/Discover feeds with no new surface and no duplicated infrastructure.
- **One planner with a mode toggle, not two flows.** The past-vs-future choice is a segmented control at the top of the existing planner (`apps/mobile/src/app/(modals)/create-trip.tsx`). There is no separate "showcase" screen and no recorded-ride entry point.
- **Dates go nullable only for showcases.** Planned rides still require start/end dates; the mode enforces which rule applies. The data model gains a conditional constraint rather than dropping date validation wholesale.
- **Visibility stays three tiers, relabeled by effect.** No schema change to the `content_visibility` enum (`private` / `unlisted` / `public`); the UI describes them as "Only you" / "Anyone with the link" / "Shown in Discover & Explore" so the identity-gate-vs-link-gate distinction is obvious.
- **No experience layer in this scope.** The route, per-waypoint notes, and existing reviews/condition tags carry "the experience." No story text, photos, or season-ridden tag.

## Requirements

**Planner mode**

- R1. The planner displays a top-level mode toggle with two states: "Already rode it" (showcase) and "Planning" (future ride).
- R2. In "Already rode it" mode, the date fields and rider/participant fields are hidden, and the trip is created as a showcase (`is_template = true`).
- R3. In "Planning" mode, the planner behaves as it does today: start/end dates are required and rider fields are present (`is_template = false`).
- R4. Switching mode mid-edit updates which fields render while preserving the route and waypoints already entered.

**Dates & data model**

- R5. `start_date` and `end_date` become nullable. A showcase may have null dates; a planned ride must have non-null start/end dates.
- R6. In showcase mode, multi-day itinerary structure is anchored on `day_count` (and waypoint `day_index`), not a date range — "add a day" increments the day count instead of extending an end date.

**Visibility**

- R7. Visibility remains the three-tier `content_visibility` enum with no schema change; the UI labels them by effect: "Only you" (`private`), "Anyone with the link" (`unlisted`), "Shown in Discover & Explore" (`public`).
- R8. The three labels apply in both modes. For a showcase, "Only you" is a personal record; for a planned ride, it is the organiser plus invited riders.

**Discovery & sharing**

- R9. A public showcase appears in web Explore and mobile Discover through the existing template feed (`tripTemplates`).
- R10. A public showcase is shareable by link and cloneable into an editable copy via the existing `trip_share_tokens` / `cloneTrip` mechanisms, unchanged.
- R11. The upcoming "rider trips" feed (`discoverRiderTrips`) stays date-gated and unchanged; showcases do not appear there.

## Key Flows

- F1. Create a showcase
  - **Trigger:** Rider opens the planner and selects "Already rode it".
  - **Steps:** Date and rider fields hide; rider builds the route and waypoints; rider picks a visibility label; rider publishes.
  - **Outcome:** A dateless `is_template = true` trip is created; if public, it enters the template feed for Explore/Discover.
  - **Covers:** R1, R2, R5, R6, R7, R9.

- F2. Discover, clone, and adjust someone's showcase
  - **Trigger:** Rider finds a public showcase in Explore (web) or Discover (mobile), or opens a shared link.
  - **Steps:** Rider views the route/waypoints; rider clones it; the clone opens as an editable draft they can adjust.
  - **Outcome:** An independent copy owned by the cloning rider, with lineage tracked (`cloned_from_trip_id`).
  - **Covers:** R9, R10.

## Acceptance Examples

- AE1. **Covers R2, R5.** Given "Already rode it" mode, when the rider publishes with no dates entered, then the trip saves successfully as a dateless showcase.
- AE2. **Covers R3, R5.** Given "Planning" mode, when the rider tries to publish without a valid start/end range, then save is blocked with the existing date validation.
- AE3. **Covers R4.** Given a route with waypoints built in "Planning" mode, when the rider switches to "Already rode it", then the waypoints remain and the date/rider fields disappear.
- AE4. **Covers R6.** Given "Already rode it" mode, when the rider taps "add a day", then `day_count` increases and a new day section appears with no change to any end date.

## Scope Boundaries

**Deferred for later**
- An experience layer: free-text "how it went / tips", trip photos, and a season/month-ridden descriptor.

**Outside this scope**
- Creating a showcase from a recorded ride — all creation is in the planner; the recorded-ride entry point is not built.
- Any new discovery surface, a dedicated showcase feed, or a "real rider" badge — showcases blend into the existing template feed.
- Surfacing showcases in the date-gated "rider trips" feed.

## Dependencies / Assumptions

- The existing template infrastructure works as mapped: `cloneTrip`, `trip_share_tokens` / `rotateTripShareToken` / `tripByShareToken`, the `tripTemplates` feed, and the web routes under `apps/web/src/app/explore/` and `apps/web/src/app/trips/[country]/[region]/[slug]/`.
- `is_template` is the correct and sufficient flag to distinguish a showcase from a planned ride.
- Making dates nullable requires a migration plus a conditional check tying the date requirement to `is_template = false`. Existing templates currently hold placeholder dates; whether those are nulled or left untouched is a planning decision.

## Outstanding Questions

**Deferred to planning**
- Default position of the mode toggle (likely "Planning" to preserve current behavior).
- Exact form of the conditional date constraint (`is_template = false` ⇒ dates required) and how it coexists with the existing `end_date >= start_date` check.
- Whether existing templates' placeholder dates are backfilled to null or left as-is.
- Whether rider/participant fields are fully hidden or merely optional in showcase mode, and how `max_riders` defaults behave when hidden.

## Sources / Research

- Planner UI and form state: `apps/mobile/src/app/(modals)/create-trip.tsx`, `apps/mobile/src/hooks/use-create-trip-data.ts`, `apps/mobile/src/utils/trip-form-dates.ts`.
- Trip detail (template vs regular branching already exists): `apps/mobile/src/app/(modals)/trip-detail.tsx`, `apps/mobile/src/hooks/use-trip-detail-data.ts`.
- Mobile Discover feed: `apps/mobile/src/app/(tabs)/(discover)/index.tsx`.
- API contract: `apps/api/src/modules/trips/trips.resolver.ts`, `apps/api/src/modules/trips/dto/`, `apps/api/src/modules/trips/models/trip.model.ts`.
- DB schema and constraints: `supabase/migrations/00072_trips.sql` (date NOT NULL + `end_date >= start_date`), `supabase/migrations/00117_trip_unification_schema.sql` (template columns), `supabase/migrations/00086_trip_share_tokens.sql` (share links).
- Web Explore + public trip pages: `apps/web/src/app/explore/`, `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx`.
