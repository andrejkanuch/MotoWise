---
title: "Explore Funnel & Monetization — Full Implementation Plan"
type: feat
status: active
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md
---

# Explore Funnel & Monetization — Full Implementation Plan

## Overview

Activate the existing `MotoWise Pro` entitlement on web, upgrade `/explore` with real filters + map view, enrich trip detail pages with interactive map + reviews + elevation, ship the multi-day builder as the Pro anchor feature, and add an SEO guides layer — all driving toward $5K Pro web MRR by month 6 and +30% app install lift.

**Origin:** [Brainstorm](../brainstorms/2026-05-03-explore-monetization-brainstorm.md) · [PRD v3.1](../specs/explore-monetization-prd.md)

**Method:** 7-agent parallel planning + 12-agent deepening review

---

## Deepening Enhancement Summary

**Deepened on:** 2026-05-03
**Review agents:** Architecture Strategist, Security Sentinel, Performance Oracle, Data Integrity Guardian, Frontend Races Reviewer, Spec Flow Analyzer, Best Practices Researcher, Framework Docs Researcher, Pattern Recognition Specialist, TypeScript Reviewer, Code Simplicity Reviewer, Data Migration Expert

### Blocking Corrections (Must Fix Before Implementation)

| # | Finding | Severity | Source |
|---|---|---|---|
| **BC-1** | **`countries` table does not exist** — migration references it but geo data is in `places` with `kind` column. `places.route_count` + trigger already exist (`00122`/`00124`). Remove all `countries.*` references; use `places` with `kind = 'country'` filter. | CRITICAL | Architecture + Data Integrity + Data Migration (3 agents independently) |
| **BC-2** | **GPX REST endpoint bypasses all auth** — NestJS `GqlAuthGuard` only activates on GraphQL resolvers. A REST `GET /trips/:slug/gpx.gpx` has no auth unless explicitly wired. Keep GPX export in GraphQL (reuse `exportRouteGPXWithEntitlement` pattern) or create a dedicated `JwtAuthGuard` for REST. | CRITICAL | Security |
| **BC-3** | **Builder mutations have no server-side Pro gate** — frosted overlay is cosmetic. Free users can call `createTripWithWaypoints` via curl. Add `BUILDER_ACCESS` to `GATING_MATRIX` and enforce on mutations. | CRITICAL | Security |
| **BC-4** | **`can()` async migration breaks callers silently** — `Promise<boolean>` is always truthy. Every `if (can(...))` without `await` passes for everyone. Also: `GATING_MATRIX` already exists in `entitlements.types.ts` — keep `can()` synchronous, resolve tier once per request via request-scoped provider, use the matrix. | CRITICAL | Security + TypeScript |
| **BC-5** | **Elevation profile JSONB missing `lat`/`lng`** — map-chart hover sync needs coordinates. Store `{distanceKm, elevationM, lat, lng}` not just `{distanceKm, elevationM}`. | HIGH | Architecture |
| **BC-6** | **Existing `tripReviews` resolver conflict** — resolver already exists at line 359-374 of `trips.resolver.ts` with `tripId` + cursor pagination. Plan creates second with different args. Will cause schema conflict. Extend existing or create `tripReviewsBySlug`. | HIGH | TypeScript + Pattern |
| **BC-7** | **`user_gating_events.route_id` FK points to legacy `routes` table** — GPX metering for trips needs a new `trip_id` column. | HIGH | Data Integrity |
| **BC-8** | **Elevation backfill must NOT be a migration** — external API dependency (Mapbox Tilequery) means network failure blocks all future migrations. Implement as standalone script with idempotency (`WHERE elevation_profile IS NULL`). | HIGH | Data Migration |
| **BC-9** | **Trip detail page uses raw `fetch()` instead of `gqlServerFetcher`** — bypasses 8s abort timeout and violates codebase data-fetching pattern. Migrate before Track 2A. | HIGH | Pattern Recognition |

### Key Simplifications (48-66h Savings)

| Item | Verdict | Hours Saved | Reasoning |
|---|---|---|---|
| Attribution gate | **SIMPLIFY** — PostHog `$initial_referrer` only (no `signup_source` column exists, no Meta CAPI correlation) | ~4-6h | Over-engineered for zero web subs |
| Fuel-range planner | **DEFER** to v2 | ~6-8h | Builder converts by existing; no usage data yet |
| Filter dimensions | **REDUCE** 6→4 (cut Bike type, Best season filters) | ~8-10h | 122 routes × 6 dimensions = mostly empty; keep as trip detail display |
| Email capture trigger | **SIMPLIFY** — always save #3, no randomization | ~2h | Can't A/B with meaningful power at current traffic |
| Booking.com inventory check | **CUT** — render widget directly, let Booking handle empty states | ~6-8h | $120/mo revenue doesn't justify caching layer |
| Blurred GPX preview | **SIMPLIFY** — CSS blur on existing static map image, no separate preview endpoint | ~4-6h | Proven pattern; server-side truncation still enforced |
| `/u/[handle]` author page | **DEFER** to v2 | ~6-8h | One editorial account at launch; YAGNI |
| Exit-intent prompt | **DEFER** to v2 | ~4-6h | Overlaps with email capture; ship one mechanism first |
| SEO guides count | **REDUCE** 5→3 at launch | ~8-12h content | Ship infrastructure for all 5, write 3 highest-value |

### Race Conditions to Prevent (3 HIGH)

| Race | Fix |
|---|---|
| **Anon save sync double-fire** — `onAuthStateChange` fires for `SIGNED_IN`, `TOKEN_REFRESHED`, `INITIAL_SESSION`. Second fire sees empty localStorage after first cleared it. | Re-entrance guard + differential clear (only remove items that were actually synced) + gate on `event === 'SIGNED_IN'` only |
| **Success page poll flicker** — `setInterval` fires while previous request in-flight. Out-of-order responses flash "Pro!" then "Still waiting...". | `setTimeout` chaining, not `setInterval`. Each poll starts after previous completes. Persist poll start time in `sessionStorage`. |
| **Builder drag rebuilds WebGL context** — if `mapInstanceKey` derives from waypoints array identity, every drag event tears down Mapbox GL. | Keep `mapInstanceKey` stable during builder interactions. Update GeoJSON source in-place via `map.getSource('route').setData(...)`. Only update on `onDragEnd`. |

### Critical User Flow Gaps

| Gap | Resolution |
|---|---|
| Magic link + later Google OAuth = duplicate accounts | Verify Supabase identity linking is enabled; auto-merge on matching email |
| Pro expiration: builder trips inaccessible? | View-only access remains; editing/sharing/export re-gated behind Pro |
| Already-subscribed Pro user on `/pro/checkout` | Redirect to `/pro` with "You're already a Pro member" banner |
| Region pages have no route count for noindex | `places` already has `route_count` per region via existing trigger — use it |
| Builder has no auto-save | Add debounced auto-save (2s after last change) — all competitors do this |
| Attribution gate only on `/pro/checkout` — other upgrade surfaces skip it | Route all upgrade surfaces through `/pro/checkout`; gate there covers all paths |
| `/saved` empty state + anonymous access | Anon users access `/saved` (reads localStorage client-side). Empty: "Save routes" + CTA |
| Shared draft builder trip: what does recipient see? | Read-only; full route visible; cannot edit/export without Pro |

### Performance Optimizations

| Area | Recommendation | Impact |
|---|---|---|
| **Explore map: 122 separate sources** | Combine into single `FeatureCollection`. Use `feature-state` for hover. Centroid points + clustering at zoom <8, polylines at zoom ≥8. | 3-4s → <500ms on mobile |
| **Trip detail: 4+ GraphQL queries** | Keep at 1 query — use `@ResolveField` for elevation, reviews, similar trips, save status. Affiliate calls separate + client-side. | Eliminates server-side waterfall |
| **`can()` per-call DB query** | Cache user's `subscription_tier` per request. Use synchronous `GATING_MATRIX`. | Eliminates N+1 entitlement queries |
| **Filter counts** | At 122 routes, client-side counting (fetch all, filter in memory). Use `nuqs` for URL state. Server-side `filterCounts` resolver unnecessary. | Eliminates per-filter-change network roundtrip |
| **Country count trigger** | Proposed trigger fires on EVERY trips mutation including `view_count` updates. Existing `00124` trigger handles this correctly. Don't recreate. | Prevents full-table recount on every page view |
| **Batch anon save sync** | Create `syncAnonymousSaves(tripIds: [String!]!)` mutation with single `upsert`. Cap localStorage at 50 entries. | O(1) DB calls |

### Security Hardening

| Area | Action |
|---|---|
| GPX export | Keep in GraphQL, not REST. Reuse `exportRouteGPXWithEntitlement` pattern. |
| Builder Pro gate | Add `BUILDER_ACCESS` to `GATING_MATRIX`. Server-side check on mutations. |
| `signInWithOtp` abuse | Wrap in server-side API route with rate limiting per IP. |
| Booking.com proxy | Validate lat/lng with Zod. Bounded LRU cache. Rate limit per IP. |
| Entitlements flip | Feature flag `ENTITLEMENTS_ENFORCED` (default false). Fail-open on error. Pre-deploy reconciliation query. |
| `route_suggestions` RLS | `(SELECT auth.uid())` subquery form. Add `TO authenticated`. Add admin policies. `ON DELETE CASCADE` on user_id FK. |

### Framework Patterns (from Docs Research)

| Pattern | Key Detail |
|---|---|
| Next.js 16 `searchParams` | Is a `Promise` — must `await` in `generateMetadata` |
| `next-mdx-remote` v6 | RSC-native. Import from `/rsc`. No MDXProvider. Use `compileMDX` for frontmatter. |
| Supabase Auth | Use `getUser()` not `getSession()` for authorization. Middleware mandatory for session refresh. |
| `@dnd-kit` v2 API | `DragDropProvider` + `useSortable({ group })` for multi-container. `isSortable()` type guard. |
| Chart.js decimation | Built-in `lttb` algorithm for 1000+ points. `pointRadius: 0` is biggest perf win. |
| Mapbox clustering | Only works on points, not polylines. Two-layer approach needed. `generateId: true` for `setFeatureState`. |
| `nuqs` | Type-safe URL state for App Router. 6KB. `NuqsAdapter` required in root layout. |
| RevenueCat Web Billing | Client-side only. `customerInfo` returned immediately after `purchase()` — use for optimistic unlock. Webhook latency 5-60s. |

---

## Critical Pre-Implementation Discoveries

The planning team uncovered several facts that change the implementation approach from what the PRD assumed:

| Discovery | Impact |
|---|---|
| **Pro checkout is already fully functional** — `@revenuecat/purchases-js` wired, offerings loaded, purchase flow works at `/pro/checkout` | Track 5 is mostly done; focus shifts to attribution gate + success page polling |
| **ElevationChart component already exists** — Chart.js with bidirectional hover sync with `MapHeroInteractive` | PRD estimated 8-16h; actual work is adding pass-name annotations (~2-4h) |
| **`FREE_MONTHLY_EXPORTS` is currently `0`** (Pro-only), not `1` | Must change to `1` in `packages/types/src/constants/limits.ts` before any free-tier GPX flow works |
| **Annual discount is 30%** ($5.99/mo vs $49.99/yr), not 40% | Either update RC pricing to ~$42.99/yr or accept 30% — decision needed |
| **`SaveRouteButton` uses deprecated routes resolver** — `SavedRoutesResolver` is explicitly `@deprecated` with comment "use savedTrips / saveTripTemplate from TripsResolver instead" (CR-3 verified) | Update `SaveRouteButton` to call the existing trips mutations (`saveTripTemplate`/`unsaveTripTemplate`); no new component needed, just swap the GraphQL operations |
| **4+ explore pages exist** (primary `/explore`, `[country]`, `[country]/[region]`, `/search`, plus i18n marketing variants) (CR-4) | Upgrade all 4 primary routes; filter component must be reused across all; freeze i18n marketing variants |
| **Blog MDX system exists** (`content/blog/{locale}/`, gray-matter, in-memory cache) | Reusable for `/guides/` — no new content infrastructure needed |
| **PPR is disabled** due to next-intl incompatibility | All new pages must work without `cacheComponents`; no PPR assumptions |
| **Revenue forecast: organic-only = ~$900 MRR at month 6** | $5K requires paid acquisition + SEO guides + mobile cross-sell; guides are critical path for traffic |
| **GpxDownloadButton exists** with paywall modal — but links to App Store, not `/pro/checkout` | Quick fix: change upgrade URL to web checkout |
| **`JsonLdGraph` component exists** for structured data | Reuse for TouristTrip + FAQPage + BreadcrumbList schema |
| **Polyline has no elevation data** (lat/lng only) | Need pre-computed `elevation_profile JSONB` column via Mapbox Tilequery backfill |

---

## Dependency Graph

```
Track 1 (DB + Backend) ──┬──→ Track 2A (Trip Detail)
                         ├──→ Track 2B (Builder)
                         ├──→ Track 3 (Explore Filters)
                         └──→ Track 5 (Pro Checkout)
Track 3 ──→ Track 4 (Country Pages — reuses filter component)
Track 1 + Track 5 ──→ Track 6 (Affiliate — needs Pro gate working)
Track 7 (Analytics) runs in parallel from day 1
Track 8 (Guides) is independent — only needs sitemap hook
Track 9A (API routes cleanup) runs parallel with Track 1
Track 9B (Web routes cleanup) runs parallel with Track 2A
Track 9C (Mobile routes cleanup) runs parallel with Track 5
Track 9D (DB DROP tables) ──→ after mobile cutoff confirmed
```

**Critical path:** Track 1 entitlements flip → Track 2A.10 blurred GPX preview → Track 5 attribution gate

---

## Track 1 — Backend & DB (Days 1-4)

### 1.1 Migration `00125_explore_monetization.sql`

**CORRECTED per DB audit:** No `countries` table exists. Geo data is in `places` with `kind` column. `places.route_count` + trigger already exist (`00122`/`00124`). No `subscription_status` column — status derived from `subscription_tier` + `subscription_expires_at`. User handle column is `public_username`, not `handle`.

```sql
-- =================================================================
-- 00125_explore_monetization.sql
-- Slimmed per tech-debt review: ~30 lines, 0 new tables
-- =================================================================

-- 1. Elevation profile (pre-computed from Mapbox Tilequery backfill script)
--    Includes lat/lng for map-chart hover sync (BC-5 fix)
--    Shape: Array<{distanceKm: number, elevationM: number, lat: number, lng: number}>
ALTER TABLE trips ADD COLUMN elevation_profile JSONB
  CHECK (
    elevation_profile IS NULL
    OR (jsonb_typeof(elevation_profile) = 'array'
        AND jsonb_array_length(elevation_profile) > 0)
  );

-- 2. Best season (manual editorial per trip, months 1-12)
ALTER TABLE trips ADD COLUMN best_season_months SMALLINT[] DEFAULT '{}'
  CHECK (best_season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::SMALLINT[]);

-- 3. Extend user_gating_events for trip-based GPX metering (BC-7 fix)
--    XOR check: a row references either a route OR a trip, never both
ALTER TABLE user_gating_events ADD COLUMN IF NOT EXISTS trip_id UUID
  REFERENCES trips(id) ON DELETE SET NULL;
ALTER TABLE user_gating_events
  ADD CONSTRAINT user_gating_events_target_xor
  CHECK ((route_id IS NOT NULL)::int + (trip_id IS NOT NULL)::int <= 1);
CREATE INDEX IF NOT EXISTS idx_gating_events_trip
  ON user_gating_events (user_id, feature, trip_id)
  WHERE trip_id IS NOT NULL;

-- 4. Extend trip_suggestions (00106) for "Suggest a route" CTA
--    REUSES existing table instead of creating parallel route_suggestions
ALTER TABLE trip_suggestions ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE trip_suggestions
  ADD COLUMN country_code TEXT,
  ADD COLUMN source_url TEXT CHECK (source_url IS NULL OR char_length(source_url) <= 2048);
ALTER TABLE trip_suggestions DROP CONSTRAINT trip_suggestions_kind_check;
ALTER TABLE trip_suggestions
  ADD CONSTRAINT trip_suggestions_kind_check
  CHECK (kind IN ('waypoint','note','new_route'));
ALTER TABLE trip_suggestions
  ADD CONSTRAINT trip_suggestions_target_check
  CHECK (
    (kind IN ('waypoint','note') AND trip_id IS NOT NULL)
    OR (kind = 'new_route' AND country_code IS NOT NULL AND trip_id IS NULL)
  );

-- 5. Partial index for filter queries (costs nothing, prevents future issues)
CREATE INDEX IF NOT EXISTS idx_trips_template_filters
  ON trips (difficulty, surface_type, distance_m, estimated_duration_minutes)
  WHERE is_template = true AND NOT is_flagged;

-- 6. Index for place sitemap/noindex queries
CREATE INDEX IF NOT EXISTS idx_places_kind_route_count
  ON places (kind, route_count)
  WHERE kind IN ('country','region');
```

**What we DON'T create (tech-debt review eliminations):**
- ~~`CREATE TABLE route_suggestions`~~ → `trip_suggestions` (00106) already exists with same workflow; extended with `kind='new_route'` + `country_code` + `source_url`
- ~~`trips.border_crossings JSONB`~~ → speculative ("shape only, content v2"); add when v2 has concrete use case
- ~~`places.has_sufficient_routes BOOLEAN GENERATED`~~ → hardcoded business rule (8) in schema; use TS constant `PLACE_INDEX_MIN_ROUTES = 8` instead
- ~~`places.editorial_md TEXT`~~ → **use MDX files** at `apps/web/src/content/places/en/{country_slug}.mdx` (Option C from tech-debt review); consistent with guides pipeline, avoids i18n lock-in, one editorial-content system
- ~~`ALTER TABLE countries`~~ → table doesn't exist; `places.route_count` + trigger already handle this
- ~~`refresh_country_route_counts()` trigger~~ → `trg_sync_places_route_count` already exists

**Noindex threshold** — define as TypeScript constant, not schema:
```typescript
// apps/web/src/lib/seo/place-indexing.ts
export const PLACE_INDEX_MIN_ROUTES = 8;
export const isIndexable = (place: { routeCount: number }) =>
  place.routeCount >= PLACE_INDEX_MIN_ROUTES;
```

**Net migration: ~30 lines, 0 new tables** (down from ~120 lines + 1 table).

### 1.2 Entitlements Flip

**File:** `apps/api/src/modules/entitlements/entitlements.service.ts`

**CORRECTED per deepening review (BC-4):** Keep `can()` **synchronous**. Use the existing `GATING_MATRIX` from `entitlements.types.ts` (it already maps all tiers to all features). Resolve `subscription_tier` once per request via a request-scoped provider, not per `can()` call. Add `BUILDER_ACCESS` to the matrix (BC-3).

```typescript
// entitlements.service.ts — keep can() synchronous
import { GATING_MATRIX, type Tier, type Feature } from './entitlements.types';

// Tier is resolved once per request by GqlAuthGuard or a request-scoped provider
// and stored on the request context (e.g., user.tier)
can(tier: Tier, feature: Feature): boolean {
  return GATING_MATRIX[tier][feature];
}
```

Update `GATING_MATRIX` in `entitlements.types.ts` to add `BUILDER_ACCESS` and `EXPORT_DEVICE`:
```typescript
export const GATING_MATRIX: Record<Tier, Record<Feature, boolean>> = {
  free: {
    READ_FULL_ROUTE: true, SAVE_ROUTE: true, WRITE_REVIEW: true,
    READ_ALL_REVIEWS: true, // first 5 free, "read all" gated to sign-in (not Pro)
    DOWNLOAD_GPX: true,      // metered: 1/month via user_gating_events
    BUILDER_ACCESS: false, EXPORT_DEVICE: false,
    USE_OFFLINE_MAPS: false, SEE_FUEL_OVERLAY: false, AD_FREE: false,
  },
  pro: {
    READ_FULL_ROUTE: true, SAVE_ROUTE: true, WRITE_REVIEW: true,
    READ_ALL_REVIEWS: true, DOWNLOAD_GPX: true, // unlimited
    BUILDER_ACCESS: true, EXPORT_DEVICE: true,
    USE_OFFLINE_MAPS: true, SEE_FUEL_OVERLAY: true, AD_FREE: true,
  },
};
```

**Feature flag:** Add `ENTITLEMENTS_ENFORCED=true|false` env var (default `false`). When `false`, `can()` returns `true` for all authenticated users (current behavior). Flip to `true` after pre-deploy audit.

**Tier resolution per request:** In `GqlAuthGuard.canActivate()`, after extracting the user from JWT, fetch subscription columns from `users` table once and compute effective tier:
```typescript
const { data } = await this.supabaseAdmin
  .from('users')
  .select('subscription_tier, subscription_status, subscription_expires_at')
  .eq('id', user.id)
  .single();

// CR-1 FIX: subscription_status EXISTS (00023). Must check all three columns.
const isPro =
  data?.subscription_tier === 'pro'
  && ['active', 'trialing'].includes(data?.subscription_status)
  && data?.subscription_expires_at > new Date();

user.tier = isPro ? 'pro' : 'free';
```

**CRITICAL PRE-DEPLOY:** Run reconciliation query before flipping the feature flag:
```sql
-- CR-1: Include subscription_status in the check
SELECT id, subscription_tier, subscription_status, subscription_expires_at
FROM users
WHERE subscription_tier = 'pro'
  AND (subscription_status NOT IN ('active', 'trialing')
       OR subscription_expires_at < NOW()
       OR subscription_expires_at IS NULL);
```
If rows returned, reconcile via RC API.

### 1.3 Free GPX Quota Fix

**File:** `packages/types/src/constants/limits.ts`

Change `FREE_MONTHLY_EXPORTS` from `0` to `1`.

### 1.4 New GraphQL Resolvers

**File:** `apps/api/src/modules/trips/trips.resolver.ts`

```graphql
# Trip reviews with bike display name
tripReviews(slug: String!, limit: Int = 5, offset: Int = 0): [TripReview!]!

# Similar trips by country + difficulty + duration
similarTrips(slug: String!, limit: Int = 6): [Trip!]!

# Filter counts for progressive disclosure
filterCounts(filter: TripTemplateFilterInput): FilterCounts!

# Route suggestion — reuses existing trip_suggestions table (00106) with kind='new_route'
createTripSuggestion(input: TripSuggestionInput!): TripSuggestion!  # already exists; extend input for kind='new_route'
```

**Extend `TripTemplateFilterInput`** with: `distanceMin`, `distanceMax`, `bestSeasonMonth`, `bikeType`, `region`, `sort: TripSortEnum` (TOP_RATED, MOST_RIDDEN, DISTANCE_ASC, DISTANCE_DESC, NEWEST).

**FilterCounts implementation** — 6 parallel queries on 122 rows, each applying all filters except the counted dimension:

```sql
SELECT difficulty, COUNT(*) FROM trips
WHERE is_template = true AND status = 'published'
  AND ($country IS NULL OR country_code = $country)
  -- apply all active filters EXCEPT difficulty
GROUP BY difficulty;
```

At 122 rows this is <5ms total. No materialized views needed.

### 1.5 GPX Export

**CORRECTED per security review (BC-2):** Keep GPX export in **GraphQL**, not REST. NestJS `GqlAuthGuard` only activates on GraphQL resolvers — a REST endpoint would bypass all auth.

**File:** `apps/api/src/modules/trips/trips.resolver.ts`

New mutation: `exportTripGPX(slug: String!): GPXExportResult!` — follows the existing `exportRouteGPXWithEntitlement` pattern from `routes.service.ts`. Checks `GATING_MATRIX` + `getGPXQuotaStatus()`. Records usage in `user_gating_events` (using new `trip_id` column). Returns the GPX XML as a string or a signed download URL.

~~`GET /trips/:slug/gpx-preview.json`~~ — **REMOVED** per blurred preview simplification. The blurred preview uses the existing static map image with CSS blur, not a separate data endpoint.

Uses `@mapbox/polyline` to decode stored Google encoded polyline. Generates XML with `<wpt>` elements from `trip_waypoints`.

### 1.6 Elevation Profile Backfill

**Standalone script** (NOT a migration — external API dependency). File: `scripts/backfill-elevation-profiles.ts`

1. Query `SELECT id, polyline FROM trips WHERE is_template = true AND elevation_profile IS NULL`
2. Decode polyline → lat/lng pairs via `@mapbox/polyline`
3. Sample at ~1 point per 200-500m (keeps JSONB under 15KB per trip)
4. Batch Mapbox Tilequery API calls (free tier: 100K/month; 122 trips is trivial)
5. Store as `Array<{distanceKm: number, elevationM: number, lat: number, lng: number}>` (**includes lat/lng** for map-chart hover sync, per BC-5)
6. Re-runnable via `WHERE elevation_profile IS NULL` (idempotent)
7. Log failures to stdout/Sentry but continue processing remaining trips

Run in week 1 before Track 2A frontend work begins.

### 1.7 Webhook Telemetry

**File:** `apps/api/src/modules/webhooks/revenuecat.service.ts`

RC webhook payload includes `store` field. Map: `app_store` → `'ios'`, `play_store` → `'android'`, `stripe` → `'web'`. Fire PostHog event with `purchase_source` property.

### 1.8 Attribution Gate

**File:** new `apps/web/src/lib/attribution.ts`

```typescript
// NI-6 FIX: PostHog $initial_referrer is a CLIENT-SIDE property.
// Cannot read it in SSR. Use a client-side hook instead.
'use client';
import posthog from 'posthog-js';

export function useIsAppAttributed(): boolean {
  const [attributed, setAttributed] = useState(false);
  useEffect(() => {
    const referrer = posthog.get_property('$initial_referrer') ?? '';
    const isApp = referrer.includes('apps.apple.com')
      || referrer.includes('play.google.com');
    setAttributed(isApp);
  }, []);
  return attributed;
}
```

Used on `/pro/checkout` in a `useEffect`. A brief flash of checkout before the gate renders is acceptable — the gate is advisory (dismissable), not a security control. **Note:** `users.signup_source` does NOT exist. If stronger server-side attribution is needed later, add a `signup_source` column populated at signup from the request's `Referer` header.

**Test scenarios:**
- T-017: App-attributed user → soft redirect on `/pro/checkout`
- T-018: Web-organic user → normal checkout
- Edge: user who dismissed redirect can still proceed (not a hard block)

---

## Track 2A — Trip Detail Upgrade (Days 3-10)

### Component Architecture

```
TripDetailPage (server component, apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx)
├── TripHero (cover image + title + badges + curator credit)
├── TripSocialProof ("247 viewed · 89 cloned · Last ridden 2w ago")
├── TripDetailClient (client component — state coordinator for hoveredIndex)
│   ├── MapHeroInteractive (existing, port from /route/*)
│   │   └── Waypoint layer toggles (fuel/food/scenic/overnight/photo/pass)
│   ├── ElevationChart (existing, add pass-name annotations via chartjs-plugin-annotation)
│   └── TripBlurredGpxPreview (20% polyline + 3 waypoints + Pro overlay)
├── TripBestSeason (12-month heatmap from best_season_months)
├── TripReviewsSection (top 5, bike name inline, "Read all" auth-gated)
├── TripCtaCard (two-tier Pro card, not sticky)
├── AffiliateWidgets (Booking.com + EagleRider + RevZilla, see Track 6)
├── TripCuratorCredit (avatar + display_name; link deferred until /u/[public_username] ships in v2)
├── SimilarTripsGrid (4-6 cards)
└── StickyMobileAppCta (64px, dismissable, deep-link)
```

### Key Implementation Details

**Interactive map** — port `MapHeroInteractive` (already at `apps/web/src/components/map-hero-interactive.tsx`). Props: `polyline: [number, number][]`, `highlightedPoint`, `onHoverIndex`. Desktop: 480px tall, expandable to 90vh. Mobile: 320px, full-bleed. Polyline colored by surface: paved = `palette.primary400`, mixed = `palette.warning500`, offroad = `palette.accent400`.

**Elevation profile** — existing `ElevationChart` component. Add pass-name annotations:
1. Filter waypoints for `type === 'pass_summit'`
2. Find nearest polyline index by lat/lng distance
3. Use `chartjs-plugin-annotation` (~8KB gzipped) for vertical lines + labels: `"Stelvio Pass 2,757m"`
4. Hover tooltip: "km 47.2 / 1,842m / 6.2% grade"

**Elevation data source:** Read from `trips.elevation_profile` JSONB (pre-computed in Track 1.6). If null (not yet backfilled), hide chart entirely — never show a broken empty chart.

**Reviews section** — cards in single-column stack. Each card: star rating, ride date, review text, **bike display name inline** (e.g., "Rode on a BMW R1250GS"), condition tag pills. Positive tags (Good Surface, Low Traffic, Scenic): left-border `accent400`. Warning tags (Gravel Hazard, Construction, Heavy Traffic): left-border `warning500`. "Read all N reviews" requires sign-in.

**Social proof** — single line below overview description: "247 viewed · 89 cloned · Last ridden 2w ago". Data: `view_count`, `clone_count`, latest `trip_reviews.created_at`.

**Blurred GPX preview** — **SIMPLIFIED** per review: use CSS `filter: blur(3px)` on the existing static map image (from `getMapboxStaticUrl`), not an interactive mini-map with a separate `gpx-preview.json` endpoint. Add gradient overlay (transparent → `neutral900` at 80% opacity). Centered text: "Unlock full route with Pro" with lock icon. **Server-side truncation still enforced** — the full polyline is never sent to non-Pro clients (the static map URL only encodes what the server renders). Clicking scrolls to CTA card.

**Two-tier CTA card** — `neutral800` bg, not sticky (separate sticky mobile bar handles mobile). "MotoVault Pro" heading, price with annual toggle, mixed web+app bullet list, "Start free trial" primary CTA. App-attributed users see prominent "Open in app" secondary.

**Schema markup** — extend existing `JsonLdGraph` component:
- `TouristTrip` with `touristType`, `itinerary`, geo data
- `BreadcrumbList`: Home > Explore > Country > Region > Trip
- `FAQPage`: 3 auto-generated Q&As ("Best season for…?", "What bike for…?", "How long is…?")

**Institutional learning:** JSON-LD XSS prevention — always use `.replace(/</g, '\\u003c')` on `JSON.stringify(data)` when injecting via `dangerouslySetInnerHTML`. Use `NEXT_PUBLIC_BASE_URL` for canonical URLs.

### New Pages

~~**`/u/[handle]`**~~ — **DEFERRED to v2** per simplification review. Only one editorial account (`motovault-editorial`) at launch; YAGNI. Curator credit block on trip detail page still ships (links to nothing for now or to a filtered `/explore?curator=public_username` view). Build the full author page when community route submissions or multiple curators are added.

### Test Scenarios (Track 2A)

| ID | Given | When | Then |
|---|---|---|---|
| T-021 | Trip with polyline + 10 waypoints | Page loads | MapHeroInteractive renders polyline + typed markers; layer toggles work |
| T-023 | Trip with elevation_profile + 2 pass_summit waypoints | Page loads | Chart renders correct altitude curve; pass names annotated at correct positions |
| T-024 | Trip with 8 reviews, each with bike_id | Page loads | Top 5 shown with text, rating, bike name, condition tags; "Read all 8" visible |
| T-033 | Free user on trip detail | GPX preview section renders | First 20% visible, rest blurred, Pro overlay present |
| T-043 | Trip with view_count=1234, clone_count=56, review 3w ago | Page loads | "1,234 viewed · 56 cloned · Last ridden 3 weeks ago" |
| T-044 | Trip organiser has `is_public = false` | Page loads | Shows "Curated by MotoVault" fallback |

---

## Track 2B — Multi-Day Builder (Days 5-14)

### Component Architecture

```
BuilderPage (apps/web/src/app/builder/page.tsx — Pro gate wrapper)
├── BuilderProGate (frosted overlay for free users — server-side check, not just client)
└── BuilderLayout (Pro users only)
    ├── BuilderSidebar (45% width desktop, bottom drawer mobile)
    │   ├── BikeTypeSelector (dropdown from Garage or manual)
    │   ├── DayTabs ("Day 1", "Day 2" + "Add day") — NOTE: day_index is 0-based (0 = Day 1)
    │   ├── WaypointList (@dnd-kit DragDropProvider + useSortable with group per day)
    │   │   └── WaypointCard (type icon, name, notes, drag handle, delete)
    │   └── BuilderActions (Save / Share / Export GPX)
    ├── BuilderMap (MapHeroInteractive + click-to-add waypoint)
    └── BuilderElevation (existing ElevationChart, updates on changes)
```

~~**Fuel-Range Planner**~~ — **DEFERRED to v2** per simplification review. Builder converts by existing as a Pro-gated power feature. No usage data to justify the complexity. Track `BUILDER_OPENED` and `BUILDER_SAVED` events; if Pro users actually build multi-day trips, add fuel range warnings in v2.

### Drag-Drop

`@dnd-kit/core` + `@dnd-kit/sortable` (14KB gzipped, tree-shakeable). Waypoints reorderable within a day and across day separators. Dropping across a day separator reassigns `day_index`.

### Pro Gate UX

Non-Pro users see: map loads with blurred overlay + centered modal (not dismissable). "Plan your perfect multi-day trip" heading, 3 bullet points, "Start free trial" → `/pro/checkout`, "Learn more" → `/pricing`. Sample multi-day trip visible behind blur.

### Entry Points

1. Trip detail: "Start from this trip" → builder pre-populated with trip's waypoints (Pro-gated)
2. Direct: `/builder` from nav or `/pricing`
3. Saved trips: "Build a trip from saves" on `/saved`

### Test Scenarios (Track 2B)

| ID | Given | When | Then |
|---|---|---|---|
| T-025 | Pro user | Adds 6 waypoints across 2 days, drags to reorder | Reorder persists; day assignment updates; map polyline updates on drop (not during drag) |
| T-026 | Pro user completes builder trip | Saves, shares, exports | `trips` row with `is_template=false`, `status='draft'`, `day_index` 0-based; share token; valid GPX |
| T-027 | Pro user on trip detail | Clicks "Start from this trip" | Builder opens pre-populated |
| S-004 | Free user navigates to `/builder` | Page loads | Frosted overlay with upgrade prompt; no data mutation possible |

---

## Track 3 — Explore Filters + Map View (Days 5-12)

### Filter Panel with Progressive Disclosure

**File:** new `apps/web/src/components/explore-filters.tsx`

Horizontal pill row, sticky on scroll. **4 dimensions at launch** (reduced from 6 per simplification review): Difficulty, Surface, Duration, Distance. Bike type and Best season filters deferred to v2 (122 routes × 6 dimensions produces mostly empty result sets). Pills render only when filter counts show ≥1 result for that dimension. Desktop: dropdowns. Mobile: bottom sheets. Use `nuqs` for type-safe URL state management.

Each pill shows result count: "Moderate (34)". Active pill: `palette.primary500` background. Pills enter/exit with 150ms opacity + translateY animation.

**Progressive disclosure:** Initially show Difficulty + Surface + Duration. "More filters" pill expands remaining dimensions.

### Map/List Toggle

Desktop: split view (list 55% / map 45%) with draggable divider. Toggle for full-list or full-map. Mobile: full toggle (segmented control).

Map: Mapbox polylines colored by difficulty. Clustering at >50 routes. Click polyline → highlight + scroll list. Pan/zoom → viewport-driven list filtering.

### Canonical Tags

**File:** `apps/web/src/app/explore/page.tsx` + `[country]/page.tsx`

In `generateMetadata`, check `searchParams`. If any filter params exist:
```typescript
alternates: { canonical: '/explore' } // or '/explore/[country]'
```

### Anonymous Saves

**File:** new `apps/web/src/lib/anonymous-saves.ts`

Store `{ tripId, savedAt }[]` in localStorage key `motovault_saved_trips`. On auth (`onAuthStateChange`), batch-upsert into `trip_saves` via `saveTripTemplate` mutation, then clear localStorage.

### Email Capture Modal

**File:** new `apps/web/src/components/anon-email-capture-modal.tsx`

Triggers at **save #3** (always — simplified from randomized #2/#3; can't A/B with meaningful power at current traffic). 420px modal, email input + "Send magic link" → Supabase `signInWithOtp({ email, options: { shouldCreateUser: true } })`. **Wrap in a server-side API route with rate limiting per IP** (security hardening). Dismiss sets `email_capture_dismissed` in localStorage (boolean, no TTL complexity).

Post-submit: "Check your email" confirmation, auto-dismiss after 5s.

### Empty-State Framing

Zero-result combinations show "No exact matches — these routes are close" with 3-5 trips from relaxed filters. Never a blank page.

### Test Scenarios (Track 3)

| ID | Given | When | Then |
|---|---|---|---|
| T-028 | 122 routes; user selects difficulty=expert | Filters applied | Only dimensions with ≥1 result show pills; URL syncs |
| T-029 | `/explore?difficulty=expert&surface=mixed` | Page renders | `<link rel="canonical" href="/explore">` present |
| T-030 | Filter combo yields 0 results | Filters applied | "No exact matches" + 3-5 close trips shown |
| T-031 | Anon user saves 2 trips, then signs in | Auth completes | Both migrated to `trip_saves`; localStorage cleared |
| T-032 | Anon user saves 3rd trip | Save event | Email capture modal appears; email → magic link; PostHog event fires |

---

## Track 4 — Country & Region Pages (Days 10-16)

### noindex Logic

**CORRECTED:** Uses `places.route_count` (existing, maintained by `trg_sync_places_route_count`) compared against a TypeScript constant `PLACE_INDEX_MIN_ROUTES = 8` (per tech-debt review — no generated column in schema, threshold changeable without ALTER TABLE).

```tsx
// apps/web/src/app/explore/[country]/page.tsx
import { isIndexable } from '@/lib/seo/place-indexing';

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params; // Next.js 16: params is a Promise
  const place = await fetchPlace(country, 'country'); // places WHERE kind='country'
  return {
    robots: place && !isIndexable(place) ? { index: false } : undefined,
  };
}
```

Sitemap (`apps/web/src/app/sitemap.ts`): query `places WHERE kind IN ('country','region') AND route_count >= 8` (using `idx_places_kind_route_count` partial index added in 00125). Region-level noindex uses the same `route_count` column — both countries AND regions are maintained by the existing trigger.

### Rich Country Pages (8+ routes)

Editorial intro from **MDX files** at `apps/web/src/content/places/en/{country_slug}.mdx` (per tech-debt review Option C — no DB column, consistent with guides pipeline, avoids i18n lock-in). Rendered via `compileMDX` from `next-mdx-remote/rsc`. Best-season heatmap (12-column grid from `trips.best_season_months`). Interactive map (reuse `explore-map-view.tsx`). Filter panel (reuse, 4 dimensions). "Riders also explored" footer.

### Thin Country Pages (<8 routes)

"Suggest a route" CTA with dashed border card: "Help us map [Country]" → writes to existing `trip_suggestions` table with `kind='new_route'` + `country_code` (extended in 00125). Reuses existing RLS policies + admin decision audit trail. `noindex` meta tag. Routes still visible.

### Test Scenarios (Track 4)

| ID | Given | When | Then |
|---|---|---|---|
| T-036 | Country with 4 routes | Page renders + sitemap generated | `noindex` meta present; absent from sitemap |
| T-037 | Country crosses from 7→8 routes | New trip published | `noindex` removed; appears in sitemap |
| T-039 | Italy has `editorial_md` populated | `/explore/italy` loads | Markdown renders; no XSS from injection |

---

## Track 5 — Pro Web Activation (Days 10-14)

### Current State: Mostly Done

The checkout page at `/pro/checkout` is **already fully functional**:
- Lazy-imports `@revenuecat/purchases-js`
- `Purchases.configure({ apiKey, appUserId })` with `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`
- Gets offerings, picks monthly/annual package
- Calls `purchases.purchase({ rcPackage, customerEmail })`
- Tracks checkout events via PostHog

### Remaining Work

**5.1 Attribution gate on checkout page:**
Check `isAppAttributed()` on page load. If true → replace checkout form with "You're already set up in the app. Subscribe there for the best experience." + "Open MotoVault" deep link. Include dismissable "Continue on web instead" link (not a hard block — covers "deleted app, now on web" edge case).

**5.2 Success page polling:**
Current success page is static. Add client component:
```typescript
// Poll GET /api/me every 3s, max 20 attempts (60s)
// On subscription_tier === 'pro': show confetti + unlock confirmation
// On timeout: "Your payment is confirmed. Features will activate within a few minutes."
```

**5.3 Fix GpxDownloadButton:**
Change upgrade URL from App Store link to `/pro/checkout` on web.

**5.4 Annual pricing verification:**
Current: $5.99/mo vs $49.99/yr = 30% discount. PRD wants 40% → $42.99/yr. **Decision needed** — verify in RC dashboard what mobile uses, match exactly.

**5.5 Pricing page updates:**
Existing `/pro/page.tsx` has feature comparison. Add: "One subscription, everywhere you ride" tagline, FAQ section addressing "Why pay for GPX?", social proof ("Join X riders who plan with Pro").

### Cross-Platform Entitlement Sync

Source of truth: **Supabase `users.subscription_tier`**. Both mobile and web read this column. RC webhooks write to it from any platform.

- Web Pro → mobile: webhook writes `subscription_tier = 'pro'`; mobile reads from API at launch + RC `getCustomerInfo()`
- Mobile Pro → web: `subscription_tier` already `'pro'` in DB; web reads it via Supabase SSR auth
- Race condition (webhook delay): success page polls; client-side RC `customerInfo.entitlements` gives optimistic unlock while DB catches up

### Test Scenarios (Track 5)

| ID | Given | When | Then |
|---|---|---|---|
| T-001 | Web-organic free user | Completes monthly checkout | Webhook fires; `subscription_tier = 'pro'`; success page shows Pro within 60s |
| T-008 | Mobile Pro user visits web | Logs in | Web reads `subscription_tier = 'pro'`; all Pro features unlocked |
| T-017 | App-attributed user | Navigates to `/pro/checkout` | Soft redirect to "Open in App"; can dismiss and proceed |
| T-019 | User pays; webhook delayed 30s | Lands on success page | Polls; shows pending state; updates when webhook processes; fallback at 60s |

---

## Track 6 — Affiliate (Days 16-20)

### Booking.com

~~**Inventory pre-check**~~ — **CUT** per simplification review. $120/mo projected affiliate revenue doesn't justify building a server-side API proxy, caching layer, and conditional rendering. Booking.com's own affiliate widget handles empty states.

**File:** new `apps/web/src/components/trip-lodging-widget.tsx`

Renders Booking.com affiliate widget directly at each `overnight` waypoint using their standard embed/link format (lat/lng parameters). Let Booking handle empty states. If the widget consistently looks bad on remote routes, hide it for `surface_type = 'off-road'` trips as a simple heuristic.

### EagleRider

Static CTA at trip start point: "Rent a bike for this trip" → EagleRider nearest location page. Hidden if start country has no EagleRider presence.

### RevZilla (US-Only)

Bike-type-targeted gear cards. Geo-gated via IP/Accept-Language. Affiliate disclosure: "MotoVault earns a commission on purchases."

### Revenue Reality Check

Monetization expert's forecast for month 6:
- Booking.com: ~$120/mo (12 bookings × $10 avg commission)
- EagleRider: ~$50-100/mo
- RevZilla: ~$200-400/mo

**Combined realistic: $400-600/mo by month 6**, not $2K. Revise target accordingly.

---

## Track 7 — Analytics (Days 1-2 + Ongoing)

### Baseline Pull (Week 1)

PostHog funnel: `trip_detail_viewed → app_store_click → install_attributed` (last 60d). Also: total monthly sessions on `/explore` and `/trips/*`. This data validates all revenue targets.

### New Events

Add to `apps/web/src/lib/analytics.ts` as typed `WebEvent` values:

```typescript
// Explore
FILTER_APPLIED, SORT_CHANGED, MAP_VIEW_TOGGLED,
// Saves
ROUTE_SAVED_ANONYMOUS, EMAIL_CAPTURE_MODAL_SHOWN, EMAIL_CAPTURED_POST_SAVE,
// GPX
GPX_DOWNLOAD_ATTEMPTED, GPX_DOWNLOAD_DENIED, GPX_PREVIEW_SHOWN,
// Pro
PRO_CTA_CLICKED, CHECKOUT_ATTRIBUTION_GATE_SHOWN,
// Builder
BUILDER_OPENED, BUILDER_SAVED, BUILDER_SHARED,
// Affiliate
AFFILIATE_CLICK,
// Engagement
EXIT_INTENT_SAVE_SHOWN, EXIT_INTENT_SAVE_TAKEN
```

### Dashboards

PostHog: Explore Engagement · Trip Detail Engagement · Pro Funnel (web) · Anon-save email-capture funnel · Builder usage · Affiliate clicks

---

## Track 8 — SEO Guides (Days 12-20)

### MDX Infrastructure

Reuse existing blog MDX system (`apps/web/src/lib/blog.ts` pattern — gray-matter, in-memory cache). Store guides as `.mdx` files in `apps/web/src/content/guides/`. Country/region editorial content uses the **same pipeline**: `apps/web/src/content/places/en/{country_slug}.mdx` (per tech-debt review — one editorial-content system, not DB columns).

### New Routes

- `/guides` index: `apps/web/src/app/guides/page.tsx` — lists all published guides
- `/guides/[slug]`: `apps/web/src/app/guides/[slug]/page.tsx` — MDX rendering with custom components

Embedded trip cards via `<TripCard slug="stelvio-pass" />` custom MDX component. `Article` + `BreadcrumbList` schema in `generateMetadata`.

### Launch Set (3 Guides — reduced from 5 per simplification review)

Ship infrastructure for all guides; write 3 highest-value at launch. Add remaining 2 in month 2 based on organic traffic data.

| Guide | Internal Links | Target Keywords |
|---|---|---|
| "Best Motorcycle Routes in Europe — 2026" | IT, FR, ES, AT, NO, CH trips | best motorcycle routes europe |
| "Patagonia by Motorcycle: Routes, Seasons & Borders" | AR trips | patagonia motorcycle trip |
| "Alpine Passes: The Definitive Riding Guide" | AT, CH, IT mountain trips | alpine motorcycle passes |

**v2 guides** (month 2+): "Motorcycle Trip Planning: Complete Checklist", "What Bike for What Route?"

### Internal Linking

- Trip detail pages: "Related guides" section after similar trips (link list, not cards)
- Country pages: relevant guides linked in editorial section
- Sitemap: include all `/guides/*` URLs

---

## System-Wide Impact

### Interaction Graph

```
User saves trip → localStorage write → (save #2-3) → email capture modal
  → Supabase signInWithOtp → magic link → onAuthStateChange
  → batch-upsert trip_saves → clear localStorage

User clicks GPX download → EntitlementsService.can('DOWNLOAD_GPX')
  → if free: getGPXQuotaStatus() → if exhausted: 403 + upgrade prompt
  → if Pro: generate GPX from polyline + waypoints → 200

User completes web checkout → RC processes payment → RC webhook
  → revenuecat.controller (HMAC validation) → RevenueCatService.processEvent
  → process_revenuecat_event RPC → users.subscription_tier = 'pro'
  → PostHog subscribe event + Meta CAPI
```

### Error Propagation

- RC webhook fails HMAC → 401, no DB mutation, logged to Sentry
- GPX generation fails (malformed polyline) → 500 with user-friendly error
- Mapbox tiles fail to load → static map fallback (existing behavior)
- Email capture OTP fails → inline error in modal, user can retry
- Attribution check fails → default to allowing web checkout (fail open, not closed)

### State Lifecycle Risks

- **Partial subscription:** User pays but webhook delayed → success page polling handles up to 60s; optimistic UI from RC client response
- **Orphaned saves:** Anonymous saves in localStorage never synced → acceptable; localStorage cleared on browser data wipe is expected
- **Stale route counts:** Existing `trg_sync_places_route_count` trigger updates `places.route_count` on trip mutations; `has_sufficient_routes` is a generated column (instant). At worst, noindex status lags one page revalidation cycle (5min for trips, 24h for countries)

---

## Acceptance Criteria (All P0)

### Payment & Entitlements (LAUNCH GATE)

- [ ] `EntitlementsService.can()` returns `false` for free users on Pro features (T-011)
- [ ] `EntitlementsService.can()` returns `true` for Pro users on all features (T-010)
- [ ] RC Web Billing checkout completes and activates Pro within 60s (T-001, T-002)
- [ ] Webhook handles all lifecycle events: renewal, cancellation, expiration, billing issue (T-003-T-006)
- [ ] Webhook signature validation rejects spoofed requests (T-007, S-003)
- [ ] Cross-platform sync works both directions (T-008, T-009)
- [ ] GPX metering: 1 free/month, quota exhaustion shows upgrade, month rollover works (T-013-T-016)
- [ ] Attribution gate blocks app-attributed users from web checkout (T-017, T-018)
- [ ] Free user cannot bypass entitlement gate via direct API call (T-020, S-002)

### Trip Detail (CORE UX)

- [ ] Interactive map renders polyline + waypoints with layer toggles (T-021)
- [ ] Elevation chart shows correct data with pass annotations + hover sync (T-023)
- [ ] Reviews render with text, bike name, condition tags (T-024)
- [ ] Blurred GPX preview shows first 20% + Pro overlay (T-033)
- [ ] Social proof displays correct counts and recency (T-043)
- [ ] Schema markup validates (TouristTrip + FAQPage + BreadcrumbList) (T-034)

### Builder (PRO ANCHOR)

- [ ] Drag/drop waypoints with day assignment; map updates on drop only (T-025)
- [ ] ~~Fuel-range warnings~~ — DEFERRED to v2
- [ ] Save creates `trips` row with `is_template=false`, `status='draft'`, 0-based `day_index` (T-026)
- [ ] Auto-save via debounced mutation (2s after last change)
- [ ] Share generates working token URL via existing `trip_share_tokens` (T-026)
- [ ] Pre-populate from trip detail works (T-027)
- [ ] Free user sees Pro gate, **server-side enforced** — cannot call builder mutations (S-004, BC-3)

### Explore Filters

- [ ] Progressive disclosure: pills hide when zero results (T-028)
- [ ] URL state sync + canonical tags on filtered URLs (T-029)
- [ ] Empty state with relaxed-filter suggestions (T-030)
- [ ] Anonymous save + sync on auth (T-031)
- [ ] Email capture modal triggers at save #2-3 (T-032)

### SEO & Content

- [ ] noindex on thin pages (<8 routes) + sitemap exclusion (T-036)
- [ ] Dynamic re-index when routes cross threshold (T-037)
- [ ] Guides render MDX with embedded trip cards (T-038)
- [ ] All JSON-LD escapes `<` characters to prevent XSS (S-005)

### Performance Gates

- [ ] Mapbox tile + polyline render < 2s on 4G (P-001)
- [ ] Filter query response < 200ms p95 (P-002)
- [ ] GPX generation < 500ms (P-003)
- [ ] Explore map with 50+ clustered polylines < 3s render (P-004)

---

## Implementation Schedule

| Week | Track | Deliverables |
|---|---|---|
| **1** | Track 1 + Track 7 + Track 9A | Migration deployed; entitlements flipped; GPX endpoint live; elevation backfill running; PostHog baseline pulled; **API routes module deprecated resolvers deleted, active ones migrated to trips** |
| **1-2** | Track 2A + Track 9B | Interactive map on trip detail; elevation chart with annotations; reviews section; social proof; blurred GPX preview; schema markup; **web routes cleanup (save button, GPX button, sitemap, garage, dead pages)** |
| **2-3** | Track 2B | Builder page with drag/drop, auto-save (free drafts), share/export (Pro-gated); "Start from this trip" CTA |
| **2-3** | Track 3 | Explore filters (4 dimensions) with progressive disclosure; map view; anonymous saves; email capture modal; canonical tags |
| **3-4** | Track 5 + Track 9C | Attribution gate; success page polling; GpxDownloadButton → trips; pricing page updates; **mobile routes cleanup** |
| **3-5** | Track 4 | Country pages (top 6-8); noindex enforcement; "Suggest a route" CTA (via `trip_suggestions`); FAQ + BreadcrumbList schema |
| **4-5** | Track 8 | Guides infrastructure + country MDX editorial + 3 launch articles (2 more in month 2) |
| **5-6** | Track 6 | Booking.com widget; EagleRider CTA; RevZilla gear; affiliate tracking |
| **6+** | Track 9D | DB cleanup: DROP legacy tables after mobile app cutoff confirmed via deprecation logs |

---

## Revenue Model (REVISED per agent decisions)

### Pricing
- **Web annual: $42.99/yr** (40% discount, ~$3.58/mo). Mobile stays at $49.99/yr.
- Blended ARPU: ~$5.80/mo (65% monthly at $5.99 + 35% annual at $3.58/mo effective)

### MRR Targets (dual targets)
- **Base (organic): $2K MRR by month 6** — achievable with 3 SEO guides + route page long-tail + social referral
- **Stretch (organic + paid): $5K MRR by month 8-9** — requires $500-800/mo paid acquisition budget (Meta retargeting) starting month 2, contingent on PostHog baseline confirming conversion assumptions in week 1
- **Affiliate: $500/mo by month 6** (revised from $2K — unrealistic for year one)

### Revenue Ramp

| Month | Organic Subs | Paid Subs | Total Subs | MRR | Affiliate | Combined |
|---|---|---|---|---|---|---|
| 1 | 8 | 0 | 8 | $46 | $50 | $96 |
| 2 | 22 | 5 | 27 | $157 | $100 | $257 |
| 3 | 43 | 15 | 58 | $336 | $200 | $536 |
| 4 | 71 | 30 | 101 | $586 | $300 | $886 |
| 5 | 103 | 50 | 153 | $887 | $400 | $1,287 |
| **6** | **137** | **75** | **212** | **$1,230** | **$500** | **$1,730** |

**Reality:** $2K base target is tight but achievable. $5K requires paid. Don't commit to $5K without confirming traffic baseline in week 1.

---

## Open Decisions (Resolve Before Implementation)

| # | Decision | Options | Recommended | Status |
|---|---|---|---|---|
| D-1 | Annual pricing: 30% or 40% discount? | Keep $49.99/yr (30%) or change to $42.99/yr (40%) | **RESOLVED: $42.99/yr on web (40%).** Mobile stays $49.99/yr. Zero web subs = no migration. "$3.58/mo" framing is stronger. Apple/Google rules prevent cross-surface price comparison. | **RESOLVED** |
| D-2 | Flatten trip URLs to `/trips/[country]/[slug]`? | Flatten now (redirects) vs keep `[region]` | Pull GSC indexed count in week 1; if <500, flatten | **OPEN** |
| D-3 | Polyline elevation source: Mapbox Tilequery or manual? | Auto-backfill vs editorial | Auto-backfill (122 trips × 1 API call = trivial). Run as standalone script, NOT migration. | **RESOLVED** |
| D-4 | Migration number: 00125 or check for conflicts? | Verify latest migration number | **RESOLVED: 00125 is correct.** Latest migration is `00124_fix_places_route_count.sql` | **RESOLVED** |
| D-5 | `countries` table references | Create table vs use `places` | **RESOLVED: Use `places` with `kind='country'`.** `route_count` + trigger already exist. Added `editorial_md` + `has_sufficient_routes` generated column. | **RESOLVED** |
| D-6 | User handle column name | `handle` vs `public_username` | **CORRECTED (CR-2): BOTH columns exist.** `public_username` (TEXT, `00057`) and `handle` (CITEXT UNIQUE, `00097`). Use `handle` as the canonical URL handle (CITEXT, unique, `^[a-z0-9_]{3,20}$`). `public_profiles` view exposes both. | **RESOLVED** |
| D-7 | `subscription_status` column | Separate column vs derived | **CORRECTED (CR-1): Column EXISTS** (`00023`). Values: `free\|trialing\|active\|past_due\|cancelled\|expired`. Written by `process_revenuecat_event` RPC. Must be included in tier resolution: `effectiveTier = 'pro'` only when `subscription_tier='pro' AND subscription_status IN ('active','trialing') AND subscription_expires_at > NOW()`. | **RESOLVED** |
| D-8 | `signup_source` for attribution | Column vs PostHog-only | **RESOLVED: Column doesn't exist.** Attribution uses PostHog client-side `$initial_referrer` via `useEffect` (not SSR — NI-6 fix). | **RESOLVED** |
| D-9 | `day_index` indexing | 0-based vs 1-based | **RESOLVED: 0-based** (0 = Day 1, per `00075_trip_waypoint_day_index.sql`). Builder UI must display as "Day 1" but store as `day_index: 0`. | **RESOLVED** |

---

## Resolved Architectural Decisions (from agent team)

### NI-2: `user_gating_events` dual FK → Option C (add trip_id, let route_id age out)

Monthly quota query counts by `user_id + feature + year_month` — never filters by `route_id` or `trip_id`. The FKs are audit-only. Old `route_id` data falls outside the 30-day window within one billing cycle. Zero-risk, zero-effort. Drop `route_id` in a future cleanup migration after confirming no queries reference it.

### NI-4: ResolveField N+1 → Option C (hybrid)

- **Trip cards (lists):** Read denormalized data only (`avg_rating`, `review_count`, `elevation_gain_m` — already on `trips` table). No ResolveField.
- **Save status on lists:** DataLoader (batch 20 trip IDs → single query). Existing `TripSavedLoader` pattern.
- **Detail page (single trip):** ResolveField for reviews list, elevation profile, similar trips. 1 trip × 4 fields = 4 queries, acceptable.
- Result: O(2) queries for a 20-item list instead of O(80+).

### Q1: Builder auto-save → Option C (free draft saves, Pro-gate publishing)

- `saveDraftTrip` mutation: **NOT Pro-gated**. Saves to `trips` with `status='draft'`, `is_template=false`.
- `publishTrip` / sharing / GPX export: **Pro-gated** via `GATING_MATRIX`.
- Auto-save: debounced 2s after last change, calls `saveDraftTrip`.
- Free users: max 3 drafts. "You have 3 draft trips — upgrade to Pro to publish them." = conversion funnel.
- Pro lapse: existing drafts remain accessible and editable. Publishing re-gated.

### Routes Deprecation — Full Cleanup (NEW TRACK 9)

The legacy `routes` table is **fully superseded** by the unified `trips` table (`is_template=true`). Data was migrated in `00112` → `00117-00119`. All routes functionality must be removed or migrated to trips. No new code should ever reference routes.

**Scope audit (39 files reference routes):** 8 API files, 9 web files, 22 mobile files.

#### Track 9A — API cleanup (week 1-2, parallel with Track 1)

| # | Task | Status | Action |
|---|---|---|---|
| 9A.1 | `SavedRoutesResolver` (entire class `@deprecated`) | Dead | **DELETE** — `TripSavesService` + `TripsResolver.saveTrip/unsaveTrip/savedTrips` already replace it |
| 9A.2 | `SavedRoutesService` + `IsRouteSavedLoader` | Dead | **DELETE** — `TripSavedLoader` exists |
| 9A.3 | `RoutesResolver.discoverRoutes/routeBySlug/routeDetail` | Deprecated | **DELETE** — `TripsResolver` has `tripTemplates/tripBySlug` equivalents |
| 9A.4 | `RoutesResolver.getRouteReviews/createRouteReview` | Active | **MIGRATE** — point at `trip_reviews` table. `createRouteReview` → extend `createTripReview` to accept `slug` |
| 9A.5 | `RoutesResolver.exportRouteGPX` | Active | **REPLACE** with `exportTripGPX` mutation (Track 1.5) |
| 9A.6 | `RoutesResolver.sitemapPublishedRoutes` | Active | **REPLACE** — new `sitemapPublishedTrips` query returning trip templates. Web sitemap (`apps/web/src/app/sitemap.ts:107`) calls this |
| 9A.7 | `RoutesResolver.shareRideToDiscover` | Active | **MIGRATE** — create trip with `is_template=true` from ride data instead of route. Same UX, different target table |
| 9A.8 | `RoutesResolver.unshareRoute` | Active | **MIGRATE** — archive/unpublish the trip (`status='archived'`) instead of deleting a route |
| 9A.9 | `RoutesResolver.routePathById` | Active | **REPLACE** — query `trips` by ID, return `{country_code, region_code, slug}` for canonical redirect |
| 9A.10 | `RoutesResolver.joinPremiumWaitlist` | Active | **MOVE** — this isn't routes-specific; relocate to a new `SubscriptionResolver` or `ProResolver` |
| 9A.11 | `RoutesModule` in `app.module.ts` | Active | **REMOVE** import after all resolvers migrated |
| 9A.12 | `RoutesService` (964 lines) | Active | **DELETE** after all methods migrated to `TripTemplatesService` / new `TripExportService` |
| 9A.13 | Route models, DTOs, controller | Dead/Active | **DELETE** — `Route`, `RouteConnection`, `RouteReview` types replaced by `Trip`, `TripConnection`, `TripReview` |

#### Track 9B — Web cleanup (week 2-3, parallel with Track 2A)

| # | Task | Action |
|---|---|---|
| 9B.1 | `save-route-button.tsx` | **MIGRATE** — swap inline GraphQL to use `saveTripTemplate`/`unsaveTripTemplate` from `@motovault/graphql`. Rename component to `SaveTripButton`. |
| 9B.2 | `gpx-download-button.tsx` | **MIGRATE** — swap `ExportRouteGPX` mutation to new `exportTripGPX`. Fix App Store link → `/pro/checkout`. |
| 9B.3 | `fetch-route-detail.ts` | **DELETE** — trip detail page already uses `WebTripBySlugDocument` |
| 9B.4 | `fetch-saved-routes.ts` | **DELETE** — replace with trip-saves fetch in garage/profile pages |
| 9B.5 | `graphql/queries/route-path-by-id.graphql` | **DELETE** — redirect logic uses trip-based lookup |
| 9B.6 | `graphql/mutations/export-route-gpx.graphql` | **DELETE** — replaced by `exportTripGPX` |
| 9B.7 | `graphql/queries/sitemap-published-routes.graphql` | **DELETE** — replaced by `sitemapPublishedTrips` |
| 9B.8 | `app/sitemap.ts:107` | **MIGRATE** — call `sitemapPublishedTrips` instead of `sitemapPublishedRoutes` |
| 9B.9 | `app/(community)/garage/page.tsx` | **MIGRATE** — use `savedTrips` query instead of `savedRoutes` |
| 9B.10 | `app/u/[handle]/saved/` | **MIGRATE** — use `publicSavedTrips` instead of `publicSavedRoutes` |
| 9B.11 | `app/route/[country]/[region]/[slug]/` | **DELETE** — 301 redirect pages, dead code |
| 9B.12 | `app/routes/[id]/` | **DELETE** — 301 redirect page, dead code |
| 9B.13 | `lib/redirect/uuid-to-slug.ts` | **AUDIT** — if still references routes, migrate to trips |

#### Track 9C — Mobile cleanup (week 3-4, after web)

| # | Task | Action |
|---|---|---|
| 9C.1 | `graphql/mutations/save-route.graphql` + `unsave-route.graphql` | **DELETE** — use `saveTrip`/`unsaveTrip` |
| 9C.2 | `graphql/queries/saved-routes.graphql` + `is-route-saved.graphql` | **DELETE** — use `savedTrips`/`isTripSaved` |
| 9C.3 | `graphql/mutations/share-ride-to-discover.graphql` | **MIGRATE** — point at new trip-based mutation (9A.7) |
| 9C.4 | `graphql/mutations/unshare-route.graphql` | **MIGRATE** — point at trip archive mutation (9A.8) |
| 9C.5 | `graphql/queries/route-detail.graphql` | **DELETE** — use trip-by-slug |
| 9C.6 | `graphql/queries/get-route-reviews.graphql` | **DELETE** — use trip reviews |
| 9C.7 | `graphql/mutations/export-route-gpx.graphql` (if exists) | **MIGRATE** — use `exportTripGPX` |
| 9C.8 | `graphql/queries/fuel-stops-near-route.graphql` | **AUDIT** — if references route_id, migrate to trip_id |
| 9C.9 | `graphql/queries/template-trip-id-for-route.graphql` | **DELETE** — direct trip lookup, no route intermediary |
| 9C.10 | `hooks/use-inspiration-filters.ts` | **MIGRATE** — use trip-saves data |
| 9C.11 | `hooks/use-gpx-export.ts` | **MIGRATE** — use `exportTripGPX` |
| 9C.12 | `app/route/[country]/[region]/[slug].tsx` | **AUDIT** — redirect to trip or delete |
| 9C.13 | `components/comments/comment-list.tsx` | **AUDIT** — if passes `routeId`, switch to `tripId` |
| 9C.14 | `lib/query-keys.ts` | **CLEAN** — remove `routes.saved` key |

#### Track 9D — DB cleanup (post-Track 9A-C, separate migration)

After all API/web/mobile references are removed:

```sql
-- Migration 00126_routes_deprecation.sql (ship AFTER client cutoff)
-- 1. Drop legacy tables (CASCADE handles FKs)
DROP TABLE IF EXISTS route_list_items CASCADE;
DROP TABLE IF EXISTS route_lists CASCADE;
DROP TABLE IF EXISTS route_saves CASCADE;
DROP TABLE IF EXISTS route_reviews CASCADE;
DROP TABLE IF EXISTS surface_reports CASCADE;  -- or migrate to trips first
DROP TABLE IF EXISTS routes CASCADE;

-- 2. Clean user_gating_events
ALTER TABLE user_gating_events DROP CONSTRAINT IF EXISTS user_gating_events_target_xor;
ALTER TABLE user_gating_events DROP COLUMN IF EXISTS route_id;

-- 3. Clean comments polymorphic FK
ALTER TABLE comments DROP COLUMN IF EXISTS route_id;
-- (verify no route comments exist first: SELECT count(*) FROM comments WHERE route_id IS NOT NULL)

-- 4. Clean migration tracking columns
ALTER TABLE trips DROP COLUMN IF EXISTS migrated_from_discover_trip_id;
ALTER TABLE trips DROP COLUMN IF EXISTS cloned_from_discover_trip_id;
```

**Sequencing constraint:** Track 9D cannot ship until a mobile app version that no longer calls any routes resolver has been force-updated (or the deprecated resolvers have logged zero calls for 2+ weeks). The deprecation warnings in `RoutesService.logDeprecatedUsage()` provide the monitoring signal.

**After Track 9, run `pnpm generate` to regenerate all types — routes types will disappear from `@motovault/graphql`.**

---

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-05-03-explore-monetization-brainstorm.md](../brainstorms/2026-05-03-explore-monetization-brainstorm.md) — key decisions: two-tier CTA, $5K MRR target, builder as Pro anchor, PDF roadbook deferred
- **PRD v3.1:** [docs/specs/explore-monetization-prd.md](../specs/explore-monetization-prd.md) — full requirements, 34 items

### Internal References

- EntitlementsService: `apps/api/src/modules/entitlements/entitlements.service.ts:30`
- MapHeroInteractive: `apps/web/src/components/map-hero-interactive.tsx:35`
- ElevationChart: `apps/web/src/components/elevation-chart.tsx`
- Pro checkout: `apps/web/src/app/pro/checkout/page.tsx`
- RC webhook: `apps/api/src/modules/webhooks/revenuecat.service.ts`
- Trip detail: `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx`
- Analytics: `apps/web/src/lib/analytics.ts`
- Blog MDX: `apps/web/src/lib/blog.ts`
- GPX download button: `apps/web/src/components/gpx-download-button.tsx`
- JsonLdGraph: `apps/web/src/components/marketing/json-ld-graph.tsx`
- Trip templates resolver: `apps/api/src/modules/trips/trips.resolver.ts`
- Filter input DTO: `apps/api/src/modules/trips/dto/trip-template-filter.input.ts`
- Design system palette: `packages/design-system/src/palette.ts`

### Institutional Learnings

- JSON-LD XSS prevention: `docs/solutions/ui-bugs/web-landing-page-review-findings-resolution.md`
- PPR disabled (next-intl): `docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`
- RLS ownership check: `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md`
- GraphQL UUID = String!: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- Supabase admin vs anon client: `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`
- TanStack Query cache collision: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
- Trip unification patterns: `docs/solutions/architecture/trip-unification-three-entities-to-one.md`
