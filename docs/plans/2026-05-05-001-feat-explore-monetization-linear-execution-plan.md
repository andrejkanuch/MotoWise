---
title: "Explore Monetization — Linear Execution Plan (MOT-219 to MOT-232)"
type: feat
status: active
date: 2026-05-05
origin: docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md
---

# Explore Monetization — Linear Execution Plan

## Overview

Execute 14 Linear tickets (MOT-219 to MOT-232) across 9 tracks to activate Pro web monetization, upgrade trip pages, ship the multi-day builder, and build the SEO content layer. This plan maps the brainstorm + deepened plan into a ticket-by-ticket execution order with file-level assignments, dependency resolution, and test criteria.

**Origin:** [Brainstorm](../brainstorms/2026-05-03-explore-monetization-brainstorm.md) · [Deepened Plan](2026-05-03-001-feat-explore-monetization-funnel-plan.md)
**Target:** $5K Pro web MRR by month 6, +30% app install lift
**Markets:** Europe + Americas only

---

## Deepening Enhancement Summary

**Deepened on:** 2026-05-05
**Agents used:** Architecture Strategist, Security Sentinel, Performance Oracle, Frontend Races Reviewer, TypeScript Reviewer, Data Integrity Guardian, Pattern Recognition Specialist, Code Simplicity Reviewer, Best Practices Researcher

### Blocking Corrections (Must Fix Before Implementation)

| # | Finding | Severity | Source |
|---|---|---|---|
| **D-1** | **RLS policies break for `kind='new_route'`** — INSERT/SELECT/UPDATE policies on `trip_suggestions` join on `trips.id = trip_id`. When `trip_id IS NULL` (new_route), all ops silently fail. Add new RLS policies for `kind='new_route'` rows in migration 00125. | CRITICAL | Security + Data Integrity (2 agents independently) |
| **D-2** | **GPX export uses SUPABASE_ADMIN for user-scoped data** — `TripGpxExportService` injects admin client for ALL operations including trip fetch, bypassing RLS. Switch trip fetch to `SUPABASE_USER`; keep admin only for storage upload + quota recording. | CRITICAL | Security |
| **D-3** | **ENTITLEMENTS_ENFORCED defaults `false`** — every authenticated user is Pro. No ticket owns flipping this flag or adding startup warnings. Add to MOT-223 or new ticket. | CRITICAL | Security + Architecture |
| **D-4** | **Builder mutations lack server-side Pro gate** — `createTripWithWaypoints`, `publishTrip` have zero `can()` checks. Frosted overlay is CSS-only, bypassable via curl. Add `BUILDER_ACCESS` enforcement on mutations. | HIGH | Security |
| **D-5** | **Plan shows 2-tier matrix; real code has 3 tiers** — `GATING_MATRIX` has `anonymous`, `free`, `pro` (not just `free`/`pro`). Plan's pseudo-code omits `anonymous`, which would break the `Record<Tier, Record<Feature, boolean>>` type. | HIGH | TypeScript |
| **D-6** | **MOT-221/222 parallel with MOT-223 risks merge conflicts** — both modify overlapping files. Sequence after MOT-223, not parallel. | HIGH | Architecture |
| **D-7** | **`publicSavedTrips` query does not exist** — MOT-222 depends on it but no resolver implements it. Add to MOT-222 backend scope. | HIGH | Architecture |
| **D-8** | **`TripSuggestionKind` needs 3-layer update for `new_route`** — Zod schema in `packages/types`, GraphQL enum in `shared/graphql/enums.ts`, and `CreateTripSuggestionInput` DTO all only allow `waypoint`/`note`. | HIGH | Architecture |
| **D-9** | **MOT-219 API work already done in working tree** — `TripReviewAuthor`/`TripReviewBike` ObjectTypes and service joins already exist. Ticket is mobile-only (update `.graphql` + `review-list.tsx`). | MEDIUM | Architecture |
| **D-10** | **Tier resolution already implemented in `GqlAuthGuard`** — `resolveEffectiveTier()` exists. Plan Track 1.2 should verify, not reimplement. | MEDIUM | Architecture |

### Simplification Recommendations (35-50h savings)

| Item | Action | Hours Saved | Reasoning |
|---|---|---|---|
| Trip detail: 11 → 7 components | **CUT** TripSocialProof, TripBestSeason, TripCuratorCredit; **INLINE** SimilarTripsGrid | ~5-8h | Social proof/season need editorial data; curator links to nothing; similar trips is a simple query |
| Defer Track 4 (MOT-227 country pages) | **DEFER** to v2 | ~12-16h | Most countries <8 routes (noindexed); editorial effort wasted |
| Defer email capture modal | **DEFER** to v2 | ~4-6h | Traffic too low for meaningful conversion; multi-step funnel with tiny audience |
| Defer attribution gate (MOT-228.1) | **DEFER** to v2 | ~4-6h | Zero web subscribers; zero cannibalization evidence |
| Simplify explore filters | **CUT** progressive disclosure + filterCounts resolver | ~3-4h | 122 trips rarely produce empty combinations; client-side counting already planned |
| Builder auto-save → manual save | **SIMPLIFY** to "Save Draft" button | ~2-3h | Zero builder users; manual save sufficient for v1 |
| Remove `best_season_months` from migration | **DEFER** column to v2 | ~1h | No UI consuming it without Track 4; no editorial data |

### Race Conditions to Prevent (11 total — 8 NEW)

| # | Race | Severity | Fix |
|---|---|---|---|
| 1 | Anon save sync double-fire | HIGH | Re-entrance guard with 3-state flag (IDLE/SYNCING/DONE); reset to IDLE on failure |
| 2 | Success page poll flicker | HIGH | `setTimeout` chaining + `cancelToken` on unmount + double-check after await |
| 3 | Builder drag WebGL rebuild | MEDIUM | Stable `mapInstanceKey`; `getSource()` null guard before `setData()` |
| **4** | **Map-elevation hover 60Hz state thrashing** | **HIGH** | `requestAnimationFrame` coalescing via pending ref — max 1 state update/frame |
| **5** | **nuqs rapid filter URL overlap** | **MEDIUM** | `shallow: true` + `throttleMs: 200`; derive filter query from React state, not searchParams |
| **6** | **Mapbox feature-state stuck hover across zoom threshold** | **MEDIUM** | Clear all hover state on `zoomend` when crossing cluster threshold (zoom 8) |
| **7** | **Email capture modal + concurrent save race** | **MEDIUM** | Make modal truly modal (disable save buttons behind it); invalidate query cache after sync |
| **8** | **PostHog `$initial_referrer` not available on first render** | **HIGH** | Return `null` while loading; render loading state; wait for `onFeatureFlags` callback |
| **9** | **AbortController missing on debounced moveend** | **MEDIUM** | Abort previous filter call on each moveend; cleanup on unmount |
| **10** | **Dynamic import: highlight set before map loads** | **LOW** | Apply initial `highlightedPoint` in map `load` event handler |
| **11** | **Builder auto-save lost on navigation** | **HIGH** | Flush debounce on unmount + `beforeunload`; use `navigator.sendBeacon` fallback |

### Type Safety Requirements

| Area | Action | Priority |
|---|---|---|
| `ElevationPoint` type | Move to `@motovault/types` with Zod schema; share across backfill script, API resolver, web chart | HIGH |
| Anonymous saves | Add Zod schema for localStorage validation (`z.array(z.object({tripId: z.string().uuid(), savedAt: z.string().datetime()})).max(50)`) | HIGH |
| `resolveTier()` utility | Create typed function in `entitlements.types.ts` to replace 8 scattered unsafe casts | HIGH |
| nuqs filter parsers | Pre-define `parseAsStringEnum` with difficulty/surface allowlists; export shared descriptor | MEDIUM |
| WebEvent typed properties | Add `WebEventProperties` map for per-event property types | MEDIUM |
| MDX frontmatter | Add Zod schemas for guide + place frontmatter; validate after `matter()` | MEDIUM |
| Builder state | Define `BuilderState` + `BuilderWaypoint` types before component work | MEDIUM |
| `FilterCounts` type | Remove from scope (client-side counting makes it unnecessary) | MEDIUM |

### Performance Optimizations

| Area | Action | Impact |
|---|---|---|
| Trip detail double fetch | Use `React.cache()` wrapper around `gqlServerFetcher` to deduplicate `generateMetadata` + page | Eliminates 150-400ms duplicate request |
| `findSimilarTrips` 3→1 queries | Pass source trip metadata directly instead of re-fetching by slug; single ORDER BY with CASE | Reduces resolver time from ~15ms to ~5ms |
| `TripReviewsLoader` missing author/bike | Update DataLoader to use same `REVIEW_SELECT` as `TripReviewsService` | Prevents N+1 sub-resolvers for review author/bike |
| Hero map LCP | Use `next/image` with `priority={true}` instead of CSS background; reduce to 1x | LCP 3.0s → 1.5-2.0s |
| Explore map payload | Two-tier loading: centroids first (~15KB), polylines on zoom ≥8 (~500KB) | Initial payload 500KB → 15KB |
| Memoize TripCard | `React.memo` + stable key; batch nuqs state updates via `startTransition` | Filter interaction 150ms → 30ms |
| Success page polling | Progressive intervals: 2s/2s/2s → 4s/4s/4s/4s/4s → 6s... | 20 polls → 15 polls, covers 68s window |

### Security Hardening

| Area | Action | Priority |
|---|---|---|
| GPX export auth | Switch trip fetch from `SUPABASE_ADMIN` to `SUPABASE_USER`; keep admin for storage + quota only | P0 |
| RLS for `new_route` | Add INSERT/SELECT/UPDATE/DELETE policies for `trip_id IS NULL` rows | P0 |
| Builder Pro gate | Add `can(BUILDER_ACCESS)` to `createTripWithWaypoints`, `publishTrip`, future `saveDraftTrip` | P0 |
| `signInWithOtp` abuse | Server-side API route: 3 req/IP/15min, 5 req/email/hour + CAPTCHA | P1 |
| `syncAnonymousSaves` | Max 50 items array validation; UUID validation; `upsert` with `onConflict` | P1 |
| `source_url` validation | Add `CHECK (source_url ~ '^https?://')` + Zod validator | P2 |
| `country_code` validation | Add `CHECK (country_code ~ '^[A-Z]{2}$')` in migration 00125 | P2 |

### Data Integrity Fixes

| Area | Action | Priority |
|---|---|---|
| XOR constraint | Consider `= 1` instead of `<= 1` on `user_gating_events` (check existing NULL-NULL rows first) | HIGH |
| `trip_suggestions` constraint | Use DROP+ADD pattern instead of `DO $$ IF NOT EXISTS` block for `trip_suggestions_target_check` | MEDIUM |
| GPX metering INSERT | Use `SUPABASE_ADMIN` for `user_gating_events` INSERT (no RLS insert policy for authenticated); document exception | MEDIUM |
| Track 9D safety | Replace `CASCADE` with explicit drops; add pre-drop verification queries | MEDIUM |
| Anonymous save sync | Wrap batch upsert in single transaction; differential clear on success only | MEDIUM |

### Best Practices (from Research)

| Technology | Key Pattern | Reference |
|---|---|---|
| Mapbox GL JS | `generateId: true` on source; `setFeatureState` for hover (GPU-driven); `minzoom`/`maxzoom` per layer | Mapbox docs |
| nuqs v2 | `createSearchParamsCache` for RSC; `parseAsStringEnum` for filter values; `throttleMs: 200` | nuqs.dev |
| @dnd-kit v2 | `DragDropProvider` (not `DndContext`); `useSortable({ group })` for multi-container; `structuredClone` snapshot on `onDragStart` | dndkit.com |
| RevenueCat Web | Client-side only; `customerInfo.entitlements` for optimistic unlock; exponential backoff polling | RC docs |
| next-mdx-remote v6 | `compileMDX` from `/rsc`; `React.cache()` for dedup; NO `MDXProvider` in RSC; compiled JSX not serializable | GitHub |
| Chart.js decimation | `parsing: false` + LTTB algorithm; `pointRadius: 0` biggest perf win; annotation `enter`/`leave` return `true` | chartjs.org |
| Anon save sync | 3-state mutex ref; `Promise.allSettled` not `.all`; never call `getSession()` inside `onAuthStateChange` | supabase-js#2013 |

### Pattern Compliance Fixes

| Issue | Action |
|---|---|
| Name collision: `elevation-chart.tsx` exists at root; plan creates same name in `trip-detail/` | Rename to `trip-elevation-chart.tsx` or replace root component |
| Name collision: `map-hero.tsx` vs `map-hero-interactive.tsx` | Clarify whether root component is replaced or both coexist |
| Dead code: `route-filters.tsx`, `route-map-section.tsx` after new components | Mark for deletion in MOT-226/224 |
| `ROUTE_SAVED_ANONYMOUS` event name | Change to `TRIP_SAVED_ANONYMOUS` to match migration direction |
| `joinPremiumWaitlist` cross-module import | Extract to `WaitlistService` (waitlist module already exists); remove `RoutesModule` from `TripsModule` |
| `filterCounts` resolver in deepened plan | Confirm cut from scope; client-side counting is correct at 122 trips |

---

## Dependency Graph

```
                    ┌─────────┐
                    │ MOT-223 │  Commit + fix agent partial work (P1)
                    │  URGENT │
                    └────┬────┘
                         │ blocks
              ┌──────────┼──────────┐
              ▼          │          ▼
        ┌─────────┐      │    ┌─────────┐
        │ MOT-224 │      │    │ MOT-228 │  Pro web activation (P2)
        │Track 2A │      │    │ Track 5 │
        └────┬────┘      │    └─────────┘
             │ blocks    │
             ▼           │
        ┌─────────┐      │
        │ MOT-225 │      │
        │Track 2B │      │    Independent tracks:
        └─────────┘      │    ┌─────────┐  ┌─────────┐  ┌─────────┐
                         │    │ MOT-226 │  │ MOT-230 │  │ MOT-231 │
  ┌─────────┐ ┌─────────┐    │ Track 3 │  │ Track 7 │  │ Track 8 │
  │ MOT-219 │ │ MOT-220 │    └────┬────┘  └─────────┘  └─────────┘
  │  URGENT │ │  HIGH   │         │ blocks
  └────┬────┘ └────┬────┘         ▼
       │           │         ┌─────────┐
       │    blocks │         │ MOT-227 │
       ▼           ▼         │ Track 4 │
  ┌──────────────────┐       └─────────┘
  │     MOT-232      │
  │ Track 9D (defer) │    ┌─────────┐  ┌─────────┐  ┌─────────┐
  └──────────────────┘    │ MOT-221 │  │ MOT-222 │  │ MOT-229 │
                          │  MED    │  │  MED    │  │  LOW    │
                          └─────────┘  └─────────┘  └─────────┘
```

**Critical path:** MOT-223 → MOT-224 → MOT-225
**Routes cleanup path:** MOT-219 + MOT-220 → MOT-232 (deferred until mobile cutoff)

---

## Execution Phases

### Phase 0: Stabilize Branch (MOT-223, MOT-221, MOT-222)

These three tickets address uncommitted agent work on `feat/explore-monetization-backend`. Must complete first to unblock everything.

### Phase 1: Backend Foundation (MOT-219, MOT-220) — Parallel

Both are backend-only, no dependencies on each other. Can execute simultaneously.

### Phase 2: Web Feature Tracks (MOT-224, MOT-226, MOT-228, MOT-230, MOT-231) — Parallel

All unblocked after Phase 0. MOT-224 blocked by MOT-223 (Phase 0). MOT-228 blocked by MOT-223. MOT-226, MOT-230, MOT-231 are independent.

### Phase 3: Dependent Features (MOT-225, MOT-227)

MOT-225 (builder) blocked by MOT-224. MOT-227 (country pages) blocked by MOT-226.

### Phase 4: Deferred (MOT-229, MOT-232)

MOT-229 (affiliates) is low priority. MOT-232 (DROP tables) blocked by MOT-219 + MOT-220 + mobile cutoff.

---

## Ticket Execution Details

### MOT-223: Commit + fix agent partial work [P1 URGENT]

**Goal:** Verify, fix, and commit the 12 uncommitted files from killed agents.

**Files (from git diff):**
- `apps/api/schema.graphql` (+21 lines)
- `apps/api/src/modules/routes/routes.resolver.ts` (+9 lines — deprecated markers)
- `apps/api/src/modules/trips/models/trip.model.ts` (+36 lines — TripReviewAuthor + TripReviewBike ObjectTypes)
- `apps/api/src/modules/trips/services/trip-reviews.service.ts` (+50 lines — author/bike joins)
- `apps/api/src/modules/trips/trips.module.ts` (+3 lines — RoutesModule import)
- `apps/api/src/modules/trips/trips.resolver.ts` (+17 lines — joinPremiumWaitlist)
- `apps/mobile/src/components/gpx-export-modal.tsx` (+2 lines — queryKeys swap)
- `apps/mobile/src/hooks/use-gpx-export.ts` (+4 lines — queryKeys swap)
- `apps/mobile/src/lib/query-keys.ts` (+1 line — trips.gpxQuota)
- `apps/web/src/app/u/[handle]/saved/page.tsx` (+2 lines — partial migration)
- `apps/web/src/lib/fetch-saved-routes.ts` (+33 lines — partial migration)
- `infra/social-worker/src/draft.ts` (+33 lines)
- `infra/social-worker/src/prompts.ts` (+21 lines)
- `infra/social-worker/src/scheduled.ts` (+17 lines)

**Steps:**
1. `pnpm build` — rebuild types package declarations
2. `pnpm generate --force` — regenerate schema + GraphQL types
3. `pnpm --filter api typecheck` — verify API types
4. `pnpm --filter mobile typecheck` — verify mobile types
5. `pnpm --filter web typecheck` — verify web types
6. `pnpm --filter api test -- --run` — run API tests
7. Fix any type errors from incomplete agent work
8. Commit all changes

**Acceptance:**
- [ ] All 3 typechecks clean
- [ ] API tests passing
- [ ] No uncommitted changes related to routes migration

**Unblocks:** MOT-224, MOT-228

---

### MOT-219: Add @ResolveField for author + bike on TripReview [P1 URGENT]

**Goal:** Add nested author/bike data to trip reviews so mobile `review-list.tsx` can drop the deprecated routes query.

**Files:**
- `apps/api/src/modules/trips/models/trip.model.ts` — add `TripReviewAuthor` + `TripReviewBike` ObjectTypes
- `apps/api/src/modules/trips/trips.resolver.ts` — add `@ResolveField('author')` + `@ResolveField('bike')`
- `apps/mobile/src/graphql/queries/trip-reviews.graphql` — request nested fields
- `apps/mobile/src/components/discover/review-list.tsx` — swap to `TripReviewsDocument`, change `routeId` → `tripId`

**Key patterns (from learnings):**
- Use `SUPABASE_USER` client, not admin (see `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`)
- Use `String!` for Supabase UUIDs, NOT `ID!` (see `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`)
- Constructor param name must not clash with resolver method name (rename to `tripReviewsSvc`)
- Run `pnpm generate` after resolver changes

**Acceptance:**
- [ ] `pnpm --filter api typecheck` clean
- [ ] `pnpm --filter mobile typecheck` clean
- [ ] `pnpm --filter api test -- --run` all passing
- [ ] `review-list.tsx` has zero route imports

**Blocks:** MOT-232

---

### MOT-220: Build trip-based ride sharing mutation [P2 HIGH]

**Goal:** Replace `ShareRideToDiscoverDocument` with trip-based equivalent.

**Files:**
- `apps/api/src/modules/routes/routes.service.ts` — read `shareRideToDiscover()` to understand pattern
- `apps/api/src/modules/trips/trips.resolver.ts` — add `shareRideAsTrip` mutation
- `apps/api/src/modules/trips/dto/share-ride-as-trip.input.ts` — new input type
- `apps/mobile/src/graphql/mutations/share-ride-as-trip.graphql` — new operation
- `apps/mobile/src/app/(modals)/ride-summary.tsx` — swap mutation

**Implementation:**
- Creates `trips` record with `is_template=true`, `status='published'`
- Copies ride polyline, waypoints, metadata
- Sets `organiser_user_id` to current user
- Mark `RoutesResolver.shareRideToDiscover` as `@deprecated`

**Acceptance:**
- [ ] `ride-summary.tsx` uses trip-based mutation
- [ ] API typecheck + tests pass
- [ ] Mobile typecheck clean

**Blocks:** MOT-232

---

### MOT-221: Move joinPremiumWaitlist + fix query keys [P3 MEDIUM]

**Goal:** Verify and commit the agent's partial work on premium waitlist migration.

**Files (already modified in working tree — verify only):**
- `apps/api/src/modules/trips/trips.resolver.ts` — joinPremiumWaitlist added
- `apps/api/src/modules/trips/trips.module.ts` — RoutesModule imported
- `apps/mobile/src/lib/query-keys.ts` — trips.gpxQuota added
- `apps/mobile/src/components/gpx-export-modal.tsx` — queryKeys swapped
- `apps/mobile/src/hooks/use-gpx-export.ts` — queryKeys swapped

**Note:** This work overlaps with MOT-223. If MOT-223 commits these files, MOT-221 is automatically resolved. Mark deprecated on `RoutesResolver.joinPremiumWaitlist`.

**Acceptance:**
- [ ] `queryKeys.routes.gpxQuota` no longer used anywhere
- [ ] joinPremiumWaitlist exists in both TripsResolver (new) and RoutesResolver (deprecated)
- [ ] All typechecks pass

---

### MOT-222: Migrate web /u/[handle]/saved/ to trips [P3 MEDIUM]

**Goal:** Replace `PublicSavedRoutesDocument` with trip-based query on the public saved page.

**Files:**
- `apps/web/src/lib/fetch-saved-routes.ts` — swap to trip-based query
- `apps/web/src/app/u/[handle]/saved/page.tsx` — update component
- `apps/web/src/app/u/[handle]/saved/saved-routes-client.tsx` — update if exists
- Possibly `apps/api/src/modules/trips/trips.resolver.ts` — add `publicSavedTrips` if missing

**Note:** Agent partially started this (changes in working tree). Verify completeness after MOT-223 commit.

**Acceptance:**
- [ ] Zero `PublicSavedRoutesDocument` imports in web
- [ ] Web typecheck clean

---

### MOT-224: [Track 2A] Trip detail page upgrade [P2 HIGH]

**Goal:** Transform `/trips/[country]/[region]/[slug]` into a conversion surface with interactive map, elevation chart, reviews, CTAs, and schema markup.

**Components to build (11 total):**

| # | Component | File | Effort |
|---|---|---|---|
| 1 | MapHeroInteractive port | `apps/web/src/components/trip-detail/map-hero.tsx` | 4-6h (port existing) |
| 2 | ElevationChart with pass annotations | `apps/web/src/components/trip-detail/elevation-chart.tsx` | 2-4h (existing + annotations) |
| 3 | TripReviewsSection | `apps/web/src/components/trip-detail/reviews-section.tsx` | 3-4h |
| 4 | TripSocialProof | `apps/web/src/components/trip-detail/social-proof.tsx` | 1-2h |
| 5 | TripBestSeason | `apps/web/src/components/trip-detail/best-season.tsx` | 2-3h |
| 6 | TripCtaCard (two-tier Pro) | `apps/web/src/components/trip-detail/cta-card.tsx` | 2-3h |
| 7 | Blurred GPX preview | `apps/web/src/components/trip-detail/gpx-preview.tsx` | 1-2h (CSS blur) |
| 8 | TripCuratorCredit | `apps/web/src/components/trip-detail/curator-credit.tsx` | 1h |
| 9 | SimilarTripsGrid | `apps/web/src/components/trip-detail/similar-trips.tsx` | 2-3h |
| 10 | StickyMobileAppCta | `apps/web/src/components/trip-detail/sticky-app-cta.tsx` | 1-2h |
| 11 | Schema markup (TouristTrip + FAQ + Breadcrumb) | In page.tsx via `JsonLdGraph` | 1-2h |

**Architecture:**
- Keep page as server component; add `TripDetailClient` wrapper for interactive elements
- Static map for SSR/LCP; interactive map loads via `dynamic({ ssr: false })`
- Use `@ResolveField` for elevation + reviews + similar + save_status (1 GraphQL query)

**Pre-requisite:** Migrate trip detail page from raw `fetch()` to `gqlServerFetcher` (BC-9 fix)

**Race conditions to prevent:**
- Map-elevation hover sync: use `requestAnimationFrame` coalescing
- Keep `mapInstanceKey` stable; update GeoJSON source in-place

**Acceptance:**
- [ ] Interactive map loads on trip detail pages
- [ ] Elevation chart renders with pass annotations (or hidden if no data)
- [ ] Reviews section shows top 5 with bike names + condition tags
- [ ] Pro CTA card visible for free users
- [ ] TouristTrip + FAQPage + BreadcrumbList schema in page source
- [ ] LCP < 2.5s (static map for SSR, interactive after hydration)
- [ ] All typechecks clean

**Blocked by:** MOT-223
**Blocks:** MOT-225

---

### MOT-225: [Track 2B] Multi-day trip builder [P2 HIGH]

**Goal:** Ship the Pro anchor feature — drag/drop multi-day trip builder.

**Components:**

| Component | File |
|---|---|
| BuilderLayout | `apps/web/src/components/builder/builder-layout.tsx` |
| BikeTypeSelector | `apps/web/src/components/builder/bike-type-selector.tsx` |
| DayTabs | `apps/web/src/components/builder/day-tabs.tsx` |
| WaypointList (dnd-kit v2) | `apps/web/src/components/builder/waypoint-list.tsx` |
| BuilderActions | `apps/web/src/components/builder/builder-actions.tsx` |
| BuilderMap | `apps/web/src/components/builder/builder-map.tsx` |

**Key decisions (from brainstorm):**
- Fuel-range planner DEFERRED to v2
- Auto-save: debounced 2s via `saveDraftTrip` mutation (NOT Pro-gated)
- Free users: max 3 drafts. "Upgrade to publish."
- Pro lapse: existing drafts remain accessible; editing/sharing/export re-gated
- Map updates on `onDragEnd` only (prevents WebGL context rebuild)
- Server-side Pro gate: `BUILDER_ACCESS` in `GATING_MATRIX` (BC-3 fix)

**Entry points:**
1. Trip detail: "Start from this trip" (pre-populates waypoints)
2. Direct: `/builder` from nav
3. `/saved` page: "Build a trip from saves"

**`@dnd-kit` v2 pattern:** `DragDropProvider` + `useSortable({ group })` for multi-container day assignment.

**Acceptance:**
- [ ] `/builder` page loads with map + sidebar layout
- [ ] Waypoints can be added, reordered (drag/drop), assigned to days
- [ ] Free users see frosted overlay + upgrade prompt
- [ ] Pro users can save/share/export
- [ ] Auto-save works (debounced 2s)
- [ ] Server-side Pro gate on mutations

**Blocked by:** MOT-224

---

### MOT-226: [Track 3] Explore filters + map + saves + email [P2 HIGH]

**Goal:** Upgrade `/explore` with 4-dimension filters, map view, anonymous saves, and email capture.

**Components:**

| Component | File |
|---|---|
| ExploreFilters (4 dims) | `apps/web/src/components/explore-filters.tsx` |
| ExploreMapView | `apps/web/src/components/explore-map-view.tsx` |
| AnonymousSaves util | `apps/web/src/lib/anonymous-saves.ts` |
| AnonEmailCaptureModal | `apps/web/src/components/anon-email-capture-modal.tsx` |

**Filters:** Difficulty, Surface, Duration, Distance (Bike type + Best season deferred to v2)
- Progressive disclosure: pills hide when zero results
- Client-side counting (fetch all 122 trips, filter in memory)
- URL state via `nuqs` (type-safe, 6KB) — requires `NuqsAdapter` in root layout
- Canonical tags: filtered URLs emit `<link rel="canonical">` to unfiltered parent

**Map:**
- Single `FeatureCollection` source (NOT 122 separate sources)
- `feature-state` for hover highlighting
- Centroid points + clustering at zoom <8, polylines at zoom ≥8
- `generateId: true` required for `setFeatureState`
- Viewport-driven list filtering on `moveend` with 200ms debounce

**Anonymous saves:**
- `localStorage` `motovault_saved_trips` as `{ tripId, savedAt }[]`
- Sync to `trip_saves` on auth via batch `syncAnonymousSaves` mutation
- Re-entrance guard on `onAuthStateChange` — gate on `SIGNED_IN` only
- Differential clear (only remove synced items)
- Cap at 50 entries

**Email capture:**
- Triggers at save #3
- `signInWithOtp({ email, shouldCreateUser: true })` wrapped in server-side API route with rate limiting
- Dismiss sets localStorage flag

**Race conditions:**
- Anon save sync double-fire: re-entrance guard + differential clear + gate on `event === 'SIGNED_IN'` only
- Filter queries: AbortController per filter query

**Acceptance:**
- [ ] 4 filter dimensions work with progressive disclosure
- [ ] Map view toggles correctly (desktop split, mobile full)
- [ ] Anonymous saves persist across sessions
- [ ] Save sync works on authentication
- [ ] Email capture modal triggers at save #3
- [ ] URL state preserved via nuqs

**Blocks:** MOT-227

---

### MOT-227: [Track 4] Country & region pages [P3 MEDIUM]

**Goal:** Add editorial MDX content, noindex thin pages, and "suggest a route" CTA.

**noindex for thin pages:**
- Use `places.route_count` with TS constant `PLACE_INDEX_MIN_ROUTES = 8` (already at `apps/web/src/lib/seo/place-indexing.ts`)
- `generateMetadata` checks `isIndexable(place)` — if false, `robots: { index: false }`
- Sitemap excludes pages where `route_count < 8`

**Editorial content:**
- MDX files at `apps/web/src/content/places/en/{country_slug}.mdx`
- Uses `next-mdx-remote/rsc` + `gray-matter` (same as blog)
- Top 6-8 countries at launch: US, IT, FR, ES, AT, NO, CH, AR

**"Suggest a route" CTA:**
- On thin country pages (< 8 routes), show dashed-border card
- Writes to existing `trip_suggestions` table with `kind='new_route'` + `country_code`

**Other components:**
- Country-level interactive map (reuse `explore-map-view.tsx` from Track 3)
- Reuse 4-dimension filter panel from Track 3
- Best-season heatmap from `trips.best_season_months`
- FAQ + BreadcrumbList schema
- "Riders also explored" cross-link footer

**Blocked by:** MOT-226

---

### MOT-228: [Track 5] Pro web activation [P2 HIGH]

**Goal:** Attribution gate, success page polling, pricing page updates.

**5.1 Attribution gate:**
- Client-side `useIsAppAttributed()` hook (PostHog `$initial_referrer`)
- If app-attributed: "Subscribe in the app" + deep link (dismissable)
- `users.signup_source` does NOT exist — PostHog-only

**5.2 Success page polling (rewrite):**
- `setTimeout` chaining (NOT `setInterval`)
- Poll `/api/me` every 3s, max 20 attempts
- Optimistic unlock from RC `customerInfo.entitlements`
- Persist poll start time in `sessionStorage`
- On tier='pro': confetti + unlock confirmation
- On timeout: "Processing — features will activate within minutes"
- If already Pro: redirect to `/pro`

**5.3 GpxDownloadButton fix:**
- Change upgrade URL from App Store to `/pro/checkout`
- File: `apps/web/src/components/gpx-download-button.tsx`

**5.4 Annual pricing:**
- Web annual: $42.99/yr (40% discount)
- Mobile stays $49.99/yr

**Blocked by:** MOT-223

---

### MOT-229: [Track 6] Affiliate integration [P4 LOW]

**Goal:** Booking.com, EagleRider, RevZilla affiliate placements.

- Booking.com: widget at each `overnight` waypoint (no inventory pre-check)
- EagleRider: static CTA at trip start point
- RevZilla: bike-type-targeted gear cards (US-only, geo-gated)
- PostHog `affiliate_click` tracking
- Combined revenue target: $400-600/mo

---

### MOT-230: [Track 7] Analytics instrumentation [P2 HIGH]

**Goal:** PostHog baseline pull + new typed events + dashboards.

**New events (typed `WebEvent` values):**
```
FILTER_APPLIED, SORT_CHANGED, MAP_VIEW_TOGGLED,
ROUTE_SAVED_ANONYMOUS, EMAIL_CAPTURE_MODAL_SHOWN, EMAIL_CAPTURED_POST_SAVE,
GPX_DOWNLOAD_ATTEMPTED, GPX_DOWNLOAD_DENIED, GPX_PREVIEW_SHOWN,
PRO_CTA_CLICKED, CHECKOUT_ATTRIBUTION_GATE_SHOWN,
BUILDER_OPENED, BUILDER_SAVED, BUILDER_SHARED,
AFFILIATE_CLICK
```

**File:** `apps/web/src/lib/analytics.ts`

**Dashboards:** Explore Engagement, Trip Detail Engagement, Pro Funnel, Anon-save email-capture funnel, Builder usage, Affiliate clicks

---

### MOT-231: [Track 8] SEO guides content layer [P3 MEDIUM]

**Goal:** MDX infrastructure + 3 launch articles.

**Infrastructure:**
- `/guides` index: `apps/web/src/app/guides/page.tsx`
- `/guides/[slug]`: `apps/web/src/app/guides/[slug]/page.tsx`
- MDX files in `apps/web/src/content/guides/`
- Reuse blog MDX system (gray-matter, in-memory cache)
- Custom MDX component: `<TripCard slug="stelvio-pass" />`
- Schema: `Article` + `BreadcrumbList`

**Launch set (3 guides):**
1. "Best Motorcycle Routes in Europe — 2026"
2. "Patagonia by Motorcycle: Routes, Seasons & Borders"
3. "Alpine Passes: The Definitive Riding Guide"

**Internal linking:**
- Trip detail pages: "Related guides" section
- Country pages: relevant guides in editorial section
- Guide frontmatter includes `trips: [slug1, slug2]` for reverse lookup

---

### MOT-232: [Track 9D] DROP legacy routes tables [P4 LOW — DEFERRED]

**Prerequisites (ALL must be true):**
1. MOT-219 completed
2. MOT-220 completed
3. New mobile app build shipped to App Store
4. `RoutesService.logDeprecatedUsage()` shows zero calls for 2+ weeks
5. All web route `.graphql` files deleted

**Migration SQL:** `00126_routes_deprecation.sql` — drops 6 tables + cleans FK columns

**Also delete:** entire `apps/api/src/modules/routes/` directory, all deprecated `.graphql` files (17 mobile + 6 web)

---

## Test Plan

### Unit / Integration Tests (per ticket)

| Ticket | Test | Command |
|---|---|---|
| MOT-223 | All existing tests pass | `pnpm test` |
| MOT-219 | TripReview resolveField returns author + bike | `pnpm --filter api test -- --run` |
| MOT-220 | shareRideAsTrip creates trip with correct fields | `pnpm --filter api test -- --run` |
| MOT-224 | Trip detail page renders all 11 components | Playwright E2E |
| MOT-225 | Builder drag/drop + auto-save + Pro gate | Playwright E2E |
| MOT-226 | Filters + map + anon saves + email capture | Playwright E2E |
| MOT-228 | Attribution gate + success polling | Playwright E2E |

### E2E Test Scenarios

1. **Anonymous → Pro flow:** Visit /explore → filter → view trip detail → save 3 trips → email capture → sign up → checkout → success page polling → Pro unlocked
2. **App-attributed gate:** Visit /pro/checkout with app referrer → see "Subscribe in app" → dismiss → can still checkout on web
3. **Builder Pro gate:** Free user → /builder → frosted overlay → try to call mutation via devtools → server rejects
4. **Anon save sync:** Save 5 trips anonymously → sign up → all 5 appear in /saved → localStorage cleared

### Typecheck + Lint (every ticket)

```bash
pnpm generate --force
pnpm --filter api typecheck
pnpm --filter mobile typecheck
pnpm --filter web typecheck
pnpm --filter api test -- --run
pnpm lint
```

---

## Key Learnings Applied

- **GraphQL contract drift:** Always run `pnpm generate` after resolver changes. Use `String!` for UUIDs, not `ID!`. (see `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`)
- **Trip unification:** Split services by concern. Watch for NestJS constructor/method name clashes. (see `docs/solutions/architecture/trip-unification-three-entities-to-one.md`)
- **Security:** SUPABASE_USER for user queries, never admin. Server-side Pro gates on all mutations. (see `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`)
- **Entitlements:** Keep `can()` synchronous. Resolve tier once per request. Use existing `GATING_MATRIX`. (BC-4 from deepened plan)
- **Web patterns:** Use `<Link>` for navigation. Escape JSON-LD. Prefer CSS animations over JS. (see `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`)

---

## Sources & References

### Origin
- **Brainstorm:** [docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md](../brainstorms/2026-05-03-explore-monetization-brainstorm.md) — Key decisions: two-tier CTA, $5K MRR target, builder as Pro anchor, PDF deferred to v2
- **Deepened plan:** [docs/plans/2026-05-03-001-feat-explore-monetization-funnel-plan.md](2026-05-03-001-feat-explore-monetization-funnel-plan.md) — 9 blocking corrections, 48-66h of simplifications, 3 race conditions to prevent

### Linear Issues
- [MOT-219](https://linear.app/lominic/issue/MOT-219) through [MOT-232](https://linear.app/lominic/issue/MOT-232)

### Institutional Learnings
- `docs/solutions/architecture/trip-unification-three-entities-to-one.md`
- `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`
- `docs/solutions/architecture/currency-preference-full-stack-implementation.md`
