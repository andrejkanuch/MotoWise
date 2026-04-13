# MotoVault — Routes Discovery & Detail Platform (AllTrails-style)

**Status:** Draft v1 — for review
**Author:** PRD drafted with Claude (Cowork) on behalf of Andrej
**Date:** 2026-04-11
**Type:** Multi-epic feature spec — ready to slice into Linear tickets
**Scope boundary:** This is a specification-only document. **No implementation** is authorized by this PRD. Engineering kickoff requires explicit sign-off per epic.

---

## 0. TL;DR

Turn MotoVault's existing `routes` backend into a public, SEO-indexable, search-driven discovery product modeled on AllTrails — but moto-first. Logged-out visitors get a teaser experience (stats, static map, description, 3 reviews); signed-in users get the full interactive experience including reviews, photos, GPX export, saves, and turn-by-turn preview. Web and mobile share the same GraphQL surface. The backend already has most of the data primitives we need (PostGIS geometry, polyline, privacy cropping, ratings, saves, GPX export). The net-new work is: **(1) slugs + region hierarchy, (2) full-text search & global search UX, (3) public web SSR detail pages, (4) gating/paywall policy, (5) saved-routes profile dashboard, (6) moto-differentiation layer, (7) Pro subscription plumbing, (8) analytics instrumentation.**

We can ship an MVP in ~3 releases without breaking any existing production data. All schema changes are additive (new columns with defaults, new tables, new indexes) — zero destructive migrations.

---

## 1. Context & Current State

### 1.1 What already exists in MotoVault (verified from codebase)

From migrations `00047_create_rides_table.sql`, `00064_routes.sql`, `00065_route_reviews_saves_waitlist.sql`, `00066_group_rides.sql`, `00072_trips.sql`:

- **`routes` table** with:
  - `id uuid`, `contributor_user_id`, `source_ride_id` (nullable)
  - PostGIS `GEOGRAPHY(LINESTRING, 4326)` for the main geometry
  - `start_point`, `end_point` as `GEOGRAPHY(POINT, 4326)` — **privacy-cropped ±500 m**
  - Google-encoded `polyline` (TEXT) for fast client rendering
  - `distance_m`, `elevation_gain_m`, `curvature_index`, `surface_type` (paved/mixed/off-road/unknown), `rating_avg`, `rating_count`, `comment_count`
  - `is_motovault_pick`, `editorial_description` (editorial layer already exists)
  - `status` (published/hidden)
  - GIST indexes on geography and start_point
  - RPC `update_route_geography()` writing WKT (Supabase client workaround)
- **`route_reviews`** — 1-to-5 rating, 500-char text, JSONB `condition_tags`, unique `(route_id, user_id)`, trigger updates `rating_avg` / `rating_count`
- **`route_saves`** — composite PK `(route_id, user_id)`, index on `(user_id, saved_at DESC)`
- **`premium_waitlist`** — features enum includes `offline_routes`, `premium_general`
- **`group_rides`** — already linked to `route_id`
- **`trips`** — multi-day multi-waypoint, with 11 waypoint types (fuel/food/scenic/overnight/photo/ferry/pass_summit/rally_point/…)
- **API surface already public**:
  - `discoverRoutes(filter)` — public, supports `bounds`, `nearPoint + radiusKm`, length/elevation/surface filters, `highlyRatedOnly`
  - `routeDetail(id)` — public
  - `exportRouteGPX(id)` — exists (gating TBD)
  - `createRouteReview`, `saveRoute`/`unsaveRoute`, `shareRideToDiscover` (9-step pipeline with curvature calculation + privacy cropping + polyline re-encoding) — authenticated
- **Rich telemetry already captured on rides**: lean angle, heading, speed, altitude. This is the raw material for moto-specific route intel that AllTrails can't match.

### 1.2 What does **not** exist yet (gap list)

1. **Human-readable slugs** and a region hierarchy (`country / region / slug`) — all routes are currently addressed by UUID only.
2. **Text search** — there is no full-text index, no `search` column, no trigram index. `discoverRoutes` is geometry-filter-only today.
3. **Global search UI/API** — no single endpoint returning cross-entity results (routes + regions + cities).
4. **Public web detail pages** — the Next.js app has no SEO-indexable route pages and no SSR path for `/route/…`.
5. **Freemium gating policy** — currently `routeDetail` returns everything to everyone. There is no concept of "teaser view vs full view."
6. **Saved routes dashboard** — `route_saves` exists in the DB but there is no profile page (web or mobile) surfacing them back.
7. **Pro subscription** — `premium_waitlist` is the only monetization primitive today. No plan table, no entitlement check.
8. **Moto-specific intelligence layer** — we have `curvature_index` as a raw float but no user-facing "twist score," no road-surface crowd-sourcing, no fuel-range overlay.
9. **Region/place entities** — there are no rows representing "Poland," "Małopolskie," or "Tatry" that routes can be rolled up to.
10. **Analytics instrumentation** for discovery funnel (search → detail → save → signup → Pro).

### 1.3 Research inputs (and their limitations)

AllTrails (`/` and the Palenica Białczańska detail page) were blocked by Cloudflare anti-bot during the research pass, so parts of the AllTrails patterns in this PRD are **inferred** from published product screenshots, competitor coverage, and industry norms rather than directly observed this session. This is flagged wherever it matters. Before we commit to UX pixel-level detail (Epic 6 in particular), a designer should do a manual walkthrough of the live AllTrails detail page and sanity-check the inferences here. I'd recommend 30 minutes with a signed-out browser and 30 minutes with a signed-in free account.

REVER (motorcycle) was successfully fetched and confirmed the moto-specific differentiation angles that drive Epic 8.

---

## 2. Strategy & Problem Framing

### 2.1 Problem statement

Motorcycle riders discover routes today through a fragmented mix of Reddit threads, regional Facebook groups, Kurviger/Calimoto desktop planners, and paper guidebooks. AllTrails owns the hiking-discovery pattern but its UX is hike-first (dog-friendly, wildflowers, stroller-accessible) and ignores the dimensions motorcyclists actually care about (twistiness, surface quality, fuel range, lean suitability, seasonal closures). MotoVault has the raw telemetry advantage — we have real lean-angle and heading data from real rides — but no public-facing discovery surface to attract riders who aren't signed up yet, and no gated depth-of-content to convert them once they arrive.

### 2.2 Why now

1. The `routes` backend is already production-grade: privacy cropping, PostGIS, polyline, ratings, saves, GPX — all built. The expensive part is done.
2. Seeded route data already exists (per the user's brief). We're leaving this value on the table by having no public surface for it.
3. The `premium_waitlist` table implies we were already planning a paid tier. This PRD gives that tier something concrete to gate.
4. Moto-specific competitors (Kurviger, Calimoto, REVER) are strong in niches but none has achieved AllTrails-scale SEO or community — the discovery slot is still open.

### 2.3 Strategic goals (12-month horizon)

| # | Goal | Target |
|---|---|---|
| G1 | Organic traffic from route slugs | ≥ 50k indexed pages, ≥ 30k monthly sessions from search |
| G2 | Signup conversion from logged-out detail pages | ≥ 4% visitor → account |
| G3 | Free → Pro conversion driven by Epic 4 gates | ≥ 2% of active free users in first 90 days |
| G4 | Saved routes per active user | ≥ 3 median saves per MAU |
| G5 | GPX downloads (paid unlock) | ≥ 15% of Pro subscribers download ≥1 GPX/mo |
| G6 | Public route contributions | ≥ 10% of completed rides shared to Discover |

These targets are **hypotheses**, not commitments. Revisit after first 30 days post-launch.

### 2.4 Non-goals for this initiative (v1)

- **Turn-by-turn live navigation.** Stays out of scope. Existing apps (Kurviger, Calimoto, Google Maps) are good enough and live nav is a ~6-month build on its own.
- **Route planning / drawing from scratch on a map.** v1 is discovery of existing routes (seeded + contributed). Planner is a separate initiative.
- **Social graph (follow/followers, activity feed).** Only "saves" and reviews in v1.
- **Offline maps.** Listed as a Pro benefit in Epic 9 but the actual tile download pipeline is deferred.
- **Multi-day trip builder UI.** The `trips` table exists; building the UI on top of it is a separate spec.
- **Server-rendered mobile SSR.** Mobile stays client-rendered via GraphQL.

---

## 3. Users & Personas

| Persona | Who | Primary jobs-to-be-done on this feature |
|---|---|---|
| **Drop-in Discovery Visitor** | Unauthenticated Google visitor landing on a slug page | See if this route is worth their weekend; decide whether to sign up |
| **Weekend Warrior** (free account) | Signed-in free user planning next Sunday ride | Browse curated lists, read full reviews, save for later |
| **Touring Planner** (Pro candidate) | Multi-day trip planner, higher intent | GPX export, offline maps, plan multi-route itineraries |
| **Contributor** | Rider who just finished a good ride | Share their ride as a public route, earn rating + community |
| **Editor** (MotoVault internal) | Internal staff curating MotoVault Picks | Promote/hide routes, edit `editorial_description` |

---

## 4. Epic Breakdown (ready to slice into Linear)

This section is structured so each epic can become a Linear **Project**, and each numbered ticket inside it becomes a Linear **Issue**. Every ticket includes acceptance criteria suitable for direct paste.

### Epic summary table

| Epic | Name | Est. scope | Depends on | Ship target |
|---|---|---|---|---|
| E0 | Discovery & Alignment Spike | 1 week | — | Release 1 |
| E1 | Data model extensions (slugs, regions, FTS) | 1.5 weeks | E0 | Release 1 |
| E2 | Global search API + web/mobile UI | 2 weeks | E1 | Release 1 |
| E3 | Public web route detail pages (SSR + SEO) | 2 weeks | E1 | Release 1 |
| E4 | Freemium gating & paywall policy | 1 week | E3 | Release 2 |
| E5 | Saved routes & profile dashboard (web + mobile) | 1.5 weeks | E1 | Release 2 |
| E6 | Map preview UX polish (logged-out vs logged-in) | 1 week | E3, E4 | Release 2 |
| E7 | GPX gating & download flow | 0.5 week | E4 | Release 2 |
| E8 | Moto differentiation layer v1 (twist score, surface, fuel range) | 2 weeks | E1 | Release 3 |
| E9 | Pro subscription plumbing + monetization hooks | 2 weeks | E4 | Release 3 |
| E10 | Analytics instrumentation & funnel tracking | 0.5 week cross-cutting | All | Continuous |

**Release cadence proposed:** Release 1 (E0–E3) = "public discovery surface lit up." Release 2 (E4–E7) = "gating turned on + saves." Release 3 (E8–E9) = "moto-specific depth + paid tier."

---

## 5. Epic E0 — Discovery & Alignment Spike

### Goal
Validate assumptions before writing migrations. Confirm AllTrails/competitor UX live, confirm seeded data shape, confirm Mapbox tile budget, lock design direction.

### Tickets

**E0-T1. Live AllTrails walkthrough (design)**
- Owner: Designer
- Output: Figma board with annotated screenshots of (a) homepage global search, (b) detail page logged-out, (c) detail page logged-in-free, (d) saved lists, (e) mobile experience. Document exactly where the paywall hits.
- AC: 10-to-15-frame Figma board shared in #product.

**E0-T2. Competitor scan: Kurviger, Calimoto, REVER (design)**
- Owner: Designer
- Output: 1-page comparison table for moto-specific features absent from AllTrails (twistiness, fuel, surface).
- AC: Shared in Figma alongside E0-T1.

**E0-T3. Seeded routes audit (engineering)**
- Owner: Backend
- Output: Query report — how many routes are published, by country/region split, how many have `polyline`, `start_point`, `elevation_gain_m`, `curvature_index`, `editorial_description`, `is_motovault_pick`.
- AC: Posted as SQL + results in the Linear ticket. Informs which regions get public slugs first.

**E0-T4. Map tile budget research (engineering)**
- Owner: Backend + Designer
- Output: Decision memo — Mapbox vs MapLibre (self-hosted) vs Stadia Maps, with cost projection for 50k slug pages × expected traffic.
- AC: ADR filed in `docs/architecture/` per engineering:architecture conventions.

**E0-T5. URL & slug convention ADR (product + engineering)**
- Owner: PM + Backend
- Output: ADR locking slug format (see §6.1 below), region hierarchy, redirect policy.
- AC: ADR merged.

### Exit criteria for E0
All five tickets closed; design direction signed off by Andrej; Mapbox provider locked; ADRs merged. Nothing else in this PRD starts until E0 is green.

---

## 6. Epic E1 — Data Model Extensions

### Problem
Current `routes` table can't be addressed by slug, has no concept of country/region/city rollups, and has no text search. We need all three before we can ship public pages or a search UI.

### Goals
- Enable URLs like `/route/poland/malopolskie/palenica-bialczanska-morskie-oko`.
- Enable text search across route name, description, and region.
- Enable aggregated region pages (`/explore/poland/malopolskie` listing N routes).

### Non-goals
- Storing regional hierarchy as a self-managed CMS. We'll bootstrap from a static taxonomy seeded from Natural Earth / GeoNames and iterate from there.

### 6.1 URL & slug convention

```
/route/{country}/{region}/{slug}
/explore/{country}/{region}            — region index page
/explore/{country}                     — country index page
/explore                               — global browse (map + list)
/search?q=…&near=lat,lng               — search results page
/u/{userHandle}/saved                  — saved lists (public or private per user setting)
```

Slug format: `kebab-case`, ASCII-folded (no diacritics), max 80 chars, unique per `(country, region)` tuple. Collisions append `-2`, `-3`.

### 6.2 Tickets

**E1-T1. Migration `00080_route_slugs_and_regions.sql` (additive only)**

New columns on `routes`:
- `slug text` — nullable initially, backfilled
- `country_code char(2)` — ISO 3166-1 alpha-2, nullable initially
- `region_code text` — ISO 3166-2 where possible, free-text fallback
- `region_slug text` — slugified display name
- `city text` — nullable
- `display_name text` — human route title (e.g. "Palenica Białczańska → Morskie Oko")
- `search_tsv tsvector GENERATED ALWAYS AS (...) STORED` — combines `display_name`, `editorial_description`, `region_slug`, `city`
- `view_count_7d int default 0` — for sort-by-popularity

New table `places`:
```
places(
  id uuid pk,
  kind text check (kind in ('country','region','city')),
  country_code char(2) not null,
  region_code text,
  name text not null,
  slug text not null,
  parent_id uuid references places(id),
  geom geography(polygon, 4326),
  centroid geography(point, 4326),
  route_count int default 0,
  unique (kind, country_code, coalesce(region_code,''), slug)
)
```

Indexes:
- `create unique index on routes (country_code, region_slug, slug) where slug is not null`
- `create index routes_search_tsv_gin on routes using gin(search_tsv)`
- `create index routes_trgm_gin on routes using gin (display_name gin_trgm_ops)` (needs `pg_trgm` extension — enable with migration)
- `create index places_search on places using gin(to_tsvector('simple', name))`
- `create index places_parent on places(parent_id)`

RLS:
- `places`: `for select using (true)` — fully public
- New `routes` columns inherit existing RLS (no change)

**AC:**
- Migration pushes cleanly to a staging branch via `npx supabase db push`.
- `pnpm generate` regenerates `database.types.ts` without type conflicts.
- No existing row is invalidated (columns are nullable or have defaults).
- Rollback is a simple `drop column` / `drop table` — document it.

**E1-T2. Backfill job for `country_code`, `region_code`, `region_slug`, `slug`, `display_name`**
- NestJS one-shot script that reads `routes.start_point`, calls a reverse-geocoder (Mapbox or Nominatim with cache) to derive country and region, generates a slug from a sensible default title (contributor-provided name if any, else "Route in {region}"), writes back via `SUPABASE_ADMIN`.
- Dry-run mode that prints a diff without writing.
- Idempotent (safe to re-run).
- Deduplication of generated slugs within `(country_code, region_slug)`.
- **AC:** 100% of currently-published routes have non-null `country_code`, `region_slug`, and `slug` after one live run. Script is committed under `apps/api/scripts/backfill-route-slugs.ts`.

**E1-T3. Populate `places` table from GeoNames**
- Seed migration or separate script. Countries + level-1 admin regions minimum. Cities optional.
- Wire `routes.country_code` and `routes.region_slug` → FK-like reference into `places` (soft reference, not a DB FK — we keep it loose so edits to `places` don't cascade).
- **AC:** `places` has ≥ 200 countries and ≥ 2 000 regions seeded. `select count(*) from places where kind='region'` returns a reasonable number.

**E1-T4. Zod schemas in `@motovault/types`**
- Add `RouteSlugSchema`, `CountryCodeSchema`, `RegionCodeSchema`, extend `RouteDetailSchema` with the new fields.
- Add `PlaceSchema` + `PlaceKindSchema`.
- Per CLAUDE.md convention: export both schema and inferred type; `as const` objects for enums; no `enum` keyword.
- **AC:** `pnpm build` in `packages/types` passes.

**E1-T5. Update `routes.service.ts` and `routes.resolver.ts`**
- Expose new fields in the `Route` `@ObjectType`.
- Add `routeBySlug(country, region, slug)` query — public, returns `Route | null`.
- Add `placeBySlug(country, region?)` query — public.
- Keep `routeDetail(id)` for backward compatibility; do not break existing mobile clients.
- Run `pnpm generate` so `packages/graphql` picks up the new types.
- **AC:** Existing `myRides` and `discoverRoutes` queries still pass their contract tests. New `routeBySlug` query returns the correct route for at least 10 seeded slugs.

### Open questions for E1
- **Do we redirect old UUID URLs?** Yes — 301 from `/route/{uuid}` to `/route/{country}/{region}/{slug}` if slug exists. (Engineering.)
- **What do we do about routes spanning multiple regions?** v1: assign to the region of `start_point`. Flag as a known limitation. (Product.)
- **How do we handle routes with no geocoded region?** Keep them UUID-only and exclude from public indexes until a human resolves. (Editorial.)

---

## 7. Epic E2 — Global Search

### Problem
Users arriving via SEO or the in-app home screen need one search box that returns routes **and** places, with typeahead, geo-bias, and post-search filters. We have no such endpoint today.

### Goals
- Single-box typeahead that feels AllTrails-fast (P50 < 150 ms, P99 < 400 ms).
- Categorized results: Routes, Regions, Cities.
- Geo-bias: rank results near the user's location first.
- Full filter sidebar on the results page.

### Non-goals
- Elasticsearch or a separate search service. Postgres FTS + `pg_trgm` is sufficient for v1; re-evaluate at 500k routes.
- Semantic / vector search. Parked for v2.

### 7.1 API shape

```graphql
type SearchResult {
  routes: [RouteSearchHit!]!
  places: [PlaceSearchHit!]!
  totalRoutes: Int!
  totalPlaces: Int!
}

type RouteSearchHit {
  id: ID!
  slug: String!
  country: String!
  region: String!
  displayName: String!
  distanceM: Float!
  ratingAvg: Float
  ratingCount: Int!
  thumbnailUrl: String
  distanceFromUserKm: Float   # only when bias coords provided
}

type PlaceSearchHit {
  id: ID!
  kind: PlaceKind!             # country | region | city
  name: String!
  slug: String!
  routeCount: Int!
}

extend type Query {
  search(
    q: String!
    nearLat: Float
    nearLng: Float
    limit: Int = 10
  ): SearchResult!

  searchRoutes(
    q: String
    filter: DiscoverRoutesFilterInput
    sort: RouteSortInput
    cursor: String
    limit: Int = 20
  ): RouteConnection!
}
```

- `search` is the typeahead endpoint; cheap, capped at 10+10 results, `@Public()`.
- `searchRoutes` is the results-page endpoint with pagination; reuses the existing `DiscoverRoutesFilterInput` and layers text search on top.
- Backend query: `where search_tsv @@ websearch_to_tsquery('simple', :q) or display_name % :q order by ts_rank_cd + geo-proximity`.

### 7.2 Tickets

**E2-T1. Backend: `search` resolver + service implementation**
- Throttle: `STANDARD` preset, but consider a dedicated `SEARCH_TYPEAHEAD` with tighter per-user limits (e.g. 20 req/10 s) to prevent abuse.
- Return both routes and places in one round-trip.
- Add the ST_Distance-based `distanceFromUserKm` projection when bias coords are supplied.
- **AC:** Unit tests cover: empty query → empty arrays; query with no matches → empty with zero total; query with geo-bias → results ordered by proximity; RLS respected (published only).

**E2-T2. Backend: `searchRoutes` resolver with cursor pagination**
- Reuse existing cursor base64 pattern (`created_at` descending, or relevance+id for `sort=relevance`).
- **AC:** Pagination returns stable ordering; `highlyRatedOnly` still works; bounds filter still works.

**E2-T3. Web: global search component (Next.js)**
- Top-nav search box, full-width on mobile.
- Debounced typeahead hitting `search`, 200 ms debounce.
- Categorized dropdown: Routes group, Regions group, "See all results →" footer.
- `?q=` pushes to `/search` results page which uses `searchRoutes`.
- Geolocation prompt on first focus if user hasn't granted it; fall back to IP bias from Vercel edge headers.
- Accessibility: ARIA combobox pattern, keyboard navigable, screen-reader-announced category headers.
- **AC:** Lighthouse a11y ≥ 95 on the search page. Keyboard-only navigation works end-to-end.

**E2-T4. Mobile: global search screen (Expo)**
- Replaces or augments the current in-app search (if any; Epic 0 spike confirms). Uses the same `search` + `searchRoutes` endpoints.
- Live results; tapping a route navigates to the route detail screen (not the web slug URL).
- Reanimated v4 `FadeInUp` stagger on results (per CLAUDE.md mobile UI patterns).
- **AC:** Works offline-gracefully (cached recent searches).

**E2-T5. Results page filter sidebar**
- Filters (desktop sidebar, mobile bottom-sheet):
  - Length buckets (reuse existing enum)
  - Elevation buckets
  - Surface type (multi-select)
  - Min rating
  - Has GPX (future-gated)
  - Twistiness score (greyed out until E8 ships — ticket includes placeholder)
- "Map view" / "List view" toggle. Map view is deferred to E3 but the toggle exists here.
- **AC:** Filters compose with text query. Deep link with filters in URL query params is shareable.

### Open questions for E2
- **How do we bias by user location without prompting?** Vercel/Next.js edge geo headers give us country + approximate city. Ship with edge bias as default and only prompt for precise location if the user clicks "near me." (Product decision.)
- **Do we store popular searches?** Yes, fire a `search.query` analytics event from E10. We don't need a table yet.

---

## 8. Epic E3 — Public Web Route Detail Pages (SSR + SEO)

### Problem
We have zero SEO surface today. Route detail must be server-rendered at `/route/{country}/{region}/{slug}`, fast, indexable, and scale to 50k pages.

### Goals
- Google-indexable detail pages with full schema.org / JSON-LD markup (`TouristAttraction` or custom `SportsActivityLocation`).
- First Contentful Paint < 1.5 s at P75.
- Logged-out view is a conversion surface (see Epic 4 for gating policy).
- Zero client-side hydration cost for the static sections.

### Non-goals
- ISR invalidation on every route edit. We accept stale content for up to 1 hour via `revalidate: 3600`.

### 8.1 Page anatomy (top → bottom)

Inferred from the AllTrails research — validate in E0-T1 before finalizing pixel layout.

1. **Hero banner** — generated static map snapshot (Mapbox Static Images API) showing the full polyline with start/end pins. Watermarked with MotoVault + attribution.
2. **Breadcrumbs** — `Explore > Poland > Małopolskie > Palenica Białczańska`. Each segment links to the corresponding `/explore/...` page.
3. **Title + badges** — `displayName`, surface-type badge, MotoVault Pick badge if applicable, country flag.
4. **Stats strip** — Distance, Elevation gain, Twist score (see E8), Avg rating + count, Contributor handle.
5. **Engagement bar** — Save, Share, Report, Download GPX (gated by Epic 4/7).
6. **Interactive map** — Lazy-loaded Mapbox GL JS. Logged-out version is reduced-interactivity (see Epic 6). Elevation profile docked below.
7. **Description** — `editorial_description` for Picks, else contributor-provided text. Markdown-rendered.
8. **Conditions / tags** — aggregated `condition_tags` from recent reviews (top 5).
9. **Reviews** — Top 3 reviews for logged-out visitors with a soft-wall "Sign up to read all N reviews." Full list for logged-in.
10. **Photos** — Grid of up to 12 thumbnails, lightbox on click. Photos come from reviews (nullable in v1; just show placeholder if empty).
11. **Weather widget** — Current + 7-day forecast for the start point. Server-fetched, 1-hour cache. Open-Meteo (free, no key) as the default provider; verify in E0-T4.
12. **Nearby routes** — 6 routes within 50 km of the start point, using the existing spatial index.
13. **Meta row** — Last updated, view count, report-a-problem link.
14. **Footer CTAs** — "Save this route (free)" • "Upgrade to Pro for GPX + offline."

### 8.2 Tickets

**E3-T1. Next.js SSR route at `app/route/[country]/[region]/[slug]/page.tsx`**
- `generateStaticParams`: seed top 1 000 routes statically at build time (by `view_count_7d`), ISR for the rest.
- `generateMetadata`: pull `displayName`, first 150 chars of description, hero static-map URL into OG tags.
- `revalidate = 3600`.
- `notFound()` if the slug doesn't resolve (triggers 404.tsx).
- **AC:** Lighthouse Performance ≥ 85 mobile on a sample page. Schema.org JSON-LD validates in Google Rich Results Test.

**E3-T2. Mapbox Static Images hero generator**
- NestJS service `buildRouteHeroUrl(polyline, bounds)` that returns a signed Mapbox Static URL. Encodes the polyline into the overlay.
- Output cached at the CDN by the URL (params are deterministic).
- **AC:** Hero renders at 1200×630 for OG preview and 1600×720 for page hero.

**E3-T3. Region index pages `/explore/[country]/[region]`**
- SSR list of routes in a region, map + list split. Same filter sidebar as E2-T5.
- SEO title: "Motorcycle routes in {Region}, {Country} | MotoVault."
- **AC:** At least 10 seeded region pages are indexable end-to-end.

**E3-T4. `/explore` global browse**
- Map-first view centered on user bias location. List of top-rated routes overlaid.
- **AC:** Works without JS beyond the map (server-renders the list).

**E3-T5. Sitemap + robots**
- `app/sitemap.ts` emits URLs for every published route and place. Chunked at 50k per sitemap file, indexed by `sitemap-index.xml`.
- `app/robots.ts` allows `/route/`, `/explore/`, `/search/`; disallows `/u/*/saved/private`, `/api/*`.
- **AC:** `curl -I {prod}/sitemap.xml` returns 200; Google Search Console accepts it.

**E3-T6. 301 redirects for legacy UUID URLs**
- Middleware that catches `/route/[uuid]` and redirects to the slugged URL.
- **AC:** Unit test for the middleware; manual verification on 5 known UUIDs.

### Open questions for E3
- **Do we show contributor handles publicly?** Default yes; respect an opt-out flag on `public.users` (new column `show_in_routes boolean default true`).
- **Do we show the ride telemetry attribution ("Recorded on a 2021 KTM 390 Adventure")?** v1: yes, because it's genuine differentiation and trust-building. Opt-out per route.

---

## 9. Epic E4 — Freemium Gating & Paywall Policy

### Problem
Everything in `routeDetail` is currently public. We need a policy layer that decides what to return based on (a) is-logged-in, (b) is-Pro, and pairs it with a consistent UX for soft/hard walls.

### Goals
- Tight, principled gating table that the team can reference when adding new fields.
- No regressions for existing authenticated mobile users.

### Non-goals
- Granular per-feature purchases. We stay simple: free / Pro.

### 9.1 Gating matrix (proposed v1)

| Content | Anonymous | Signed-in Free | Pro |
|---|---|---|---|
| Route title, stats, hero image | ✅ | ✅ | ✅ |
| Interactive map with polyline | ✅ (zoom capped, no full-screen) | ✅ (full) | ✅ (full) |
| Elevation chart | ✅ static image | ✅ interactive | ✅ interactive |
| Editorial description | ✅ | ✅ | ✅ |
| First 3 reviews | ✅ (truncated if > 300 chars) | ✅ (full) | ✅ (full) |
| All reviews beyond first 3 | 🚫 account soft wall | ✅ | ✅ |
| Write a review | 🚫 account wall | ✅ | ✅ |
| Save to profile | 🚫 account wall | ✅ | ✅ |
| Photos | ✅ first 4 | ✅ all | ✅ all |
| GPX download | 🚫 hard wall | 🚫 Pro wall *(or 2/month free — see open Q)* | ✅ unlimited |
| Offline map pack | 🚫 | 🚫 Pro wall | ✅ |
| Surface-conditions overlay (E8) | 🚫 | ✅ | ✅ |
| Fuel-range overlay (E8) | 🚫 | 🚫 Pro wall | ✅ |
| Twist score | ✅ badge only | ✅ full breakdown | ✅ full |
| Ad-free experience | 🚫 | 🚫 | ✅ |

Two open product questions:

1. **GPX for free users: zero, or rate-limited (e.g. 2/month)?** My recommendation: **2/month free** — the friction of signing up is still there, and a taste of the paid product is better retention than a hard wall. REVER and RideWithGPS both use variants of this. Parking for Andrej decision.
2. **Offline map pack: bundled with Pro, or a separate regional SKU à la Komoot?** Bundle with Pro for v1 (simpler ARPU story). Regional SKUs are a possible add-on in E9.

### 9.2 Tickets

**E4-T1. `EntitlementService` in NestJS**
- Central enum: `free | pro`. Method `can(user, capability)` returning boolean.
- Capabilities: `READ_ALL_REVIEWS`, `WRITE_REVIEW`, `SAVE_ROUTE`, `DOWNLOAD_GPX`, `USE_OFFLINE_MAPS`, `SEE_FUEL_OVERLAY`, `AD_FREE`.
- Sourced from a new `public.subscriptions` table (see E9-T1) — wrap stale entitlement behind a 60 s cache per user.
- **AC:** 100% branch coverage in unit tests.

**E4-T2. Resolver-level enforcement**
- Update `routeDetail` to project the gated shape based on `ctx.user`. Anonymous path returns a trimmed `PublicRoute` `@ObjectType` that is a strict subset of `Route`.
- Update `getRouteReviews` to return only first 3 for anonymous; add `hasMore` flag.
- Update `exportRouteGPX` (see E7) to throw `ForbiddenException` with a structured error code `GPX_LIMIT_REACHED` that the client can catch and show an upgrade sheet.
- **AC:** Anonymous hitting `routeDetail` on a sensitive field returns `null` rather than throwing (to keep the public page rendering).

**E4-T3. Paywall modal component (web + mobile)**
- Shared shape: title, value-prop bullets, price, primary CTA ("Upgrade to Pro"), secondary ("Sign up free").
- Variant per capability (GPX download, offline maps, fuel overlay…).
- Tracks `paywall.shown` + `paywall.cta_clicked` events.
- **AC:** Triggered by at least 3 capability codes, rendered in Storybook for review.

**E4-T4. Anonymous-to-account soft wall on reviews**
- After scroll past the 3rd review on a logged-out detail page, show an inline "Sign up to read all {count} reviews" card. Clicking fires `signup.source=review_softwall`.
- **AC:** Only shows for anonymous. Doesn't break SEO (content is server-rendered, wall is absolutely-positioned).

### Open questions for E4
- Free GPX quota: 0, 2, or 5 per month? (see above)
- Do we show the Pro price inline or only on the paywall modal? (product)

---

## 10. Epic E5 — Saved Routes & Profile Dashboard

### Problem
`route_saves` exists but has no surface. Users can't see what they saved, organize them, or share them.

### Goals
- One `/u/{handle}/saved` page on web. One "Saved" tab in mobile profile.
- List grouping (v1: single default "My Saved"; v2: user-created lists).
- Optional public share URL per list.

### Non-goals
- Collaborative lists, comments on lists, list cover images — all v2.

### 10.1 Tickets

**E5-T1. `handle` on `public.users`**
- Add `handle text unique`, backfill from email local part with uniqueness deduplication.
- Add `show_saved_publicly boolean default false`.
- **AC:** Migration is additive; existing users continue to work.

**E5-T2. `route_lists` table (optional v1, useful scaffolding)**
```
route_lists(
  id uuid pk,
  owner_user_id uuid fk,
  name text not null,
  slug text not null,
  is_public boolean default false,
  created_at timestamptz,
  unique (owner_user_id, slug)
)
route_list_items(
  list_id uuid fk,
  route_id uuid fk,
  added_at timestamptz,
  primary key (list_id, route_id)
)
```
Ship a single default list per user (`name='Saved'`) that wraps the existing `route_saves` semantics. Existing `saveRoute` mutation auto-adds to the default list as well (dual-write, read from `route_saves` for back-compat).
- **AC:** No breakage for any existing `route_saves` consumer.

**E5-T3. GraphQL: `mySavedRoutes`, `userPublicSaves(handle)`, `createRouteList`, `addRouteToList`**
- `mySavedRoutes` — paginated, authenticated. Default sort: newest saved first.
- `userPublicSaves` — public when `show_saved_publicly=true`; 404 otherwise.
- **AC:** Types regenerated; mobile `useQuery<MySavedRoutesQuery>` pattern works.

**E5-T4. Web `/u/[handle]/saved` page**
- SSR when public, client-side when private.
- Grid of route cards. Each card uses the hero static-map URL, title, stats, surface badge.
- "Unsave" action with optimistic UI.
- **AC:** Works for a user with 0 saves (empty state), 1 save, 100 saves (pagination).

**E5-T5. Mobile profile "Saved" tab**
- Reanimated stagger on mount (`FadeInUp.delay(i*50)`).
- Long-press to multi-select and delete.
- **AC:** Matches existing profile design patterns. Haptic feedback on save toggle per CLAUDE.md.

### Open questions for E5
- Do we want lists in v1 or v2? My rec: ship the table from day one but expose only the default "Saved" list in UI; lists UI lands in v2. Keeps the DB forward-compatible.

---

## 11. Epic E6 — Map Preview UX Polish

### Problem
The map is the centerpiece of a route page. We need distinct, intentional behavior for anonymous vs authenticated, with appropriate interactivity and a clear upgrade path.

### Goals
- Anonymous sees a polished, trust-building map — not a broken or blurred one.
- Authenticated gets rich interactivity: pan, zoom, elevation hover, fullscreen.
- Performance: lazy-load the Mapbox bundle so the above-the-fold hero render doesn't block it.

### Non-goals
- Custom tile styling for MotoVault. v1 uses Mapbox default outdoor style. Custom style is a v2 polish.

### 11.1 Tickets

**E6-T1. Anonymous map: static + click-to-unlock**
- Render the Mapbox Static Images hero (from E3-T2) as the initial frame. On click, if anonymous, show an inline "Sign up to explore the map" sheet instead of loading the full GL JS.
- **AC:** Zero Mapbox GL JS bytes loaded for logged-out traffic → measured via bundle analyzer.

**E6-T2. Authenticated map: full Mapbox GL JS**
- Polyline in MotoVault brand color (from design-system palette — no hardcoded hex per CLAUDE.md).
- Start pin (green "S"), end pin (red "E"), both with the 500 m privacy-crop indicator.
- Fullscreen toggle.
- Elevation hover — hovering the polyline highlights the corresponding point on the elevation chart and vice versa.
- **AC:** Fullscreen works on desktop and mobile; elevation-sync works both directions.

**E6-T3. Elevation chart component**
- Shared React component (web) / React Native component (mobile).
- X: distance, Y: elevation. Uses `recharts` on web, `react-native-svg` on mobile.
- **AC:** Renders with real seeded data for at least 5 routes, handles null `elevation_gain_m`.

**E6-T4. Mobile map screen enhancements**
- The mobile detail screen gets the same gating behavior — anonymous (or rather, guest-mode) sees a reduced map.
- Uses the same map library already chosen in the mobile app (confirm in E0).
- **AC:** Haptic feedback on pin tap. `borderCurve: 'continuous'` on any rounded frame per CLAUDE.md.

### Open questions for E6
- Should we blur the map for logged-out users (à la inferred AllTrails) or show a clean static image with a visible "Sign up to interact" CTA? My recommendation: **clean static with CTA**. Blurring looks broken; clean + CTA feels polished. Validate with a quick A/B on launch.

---

## 12. Epic E7 — GPX Gating & Download

### Problem
`exportRouteGPX` exists in the backend. We need the gating policy (E4) wired into it and a clean download UX on both surfaces.

### Tickets

**E7-T1. Wire `exportRouteGPX` to `EntitlementService`**
- Check `DOWNLOAD_GPX` capability.
- If denied, throw `ForbiddenException` with structured error code `GPX_LIMIT_REACHED` + a field `upsell: { sku: 'pro_monthly', priceCents, feature: 'gpx_unlimited' }`.
- **AC:** Existing Pro users see no regression. Free users (if quota = 2/month) get counted — see E7-T2.

**E7-T2. Per-user monthly GPX quota tracking**
- New table `user_monthly_gpx_usage(user_id, yyyy_mm, count, unique(user_id, yyyy_mm))`.
- Increment in the same transaction as the download. Rollback on download failure.
- **AC:** Correctly handles timezone boundaries (UTC month).

**E7-T3. Web: download button flow**
- Signed URL to a server-generated `.gpx` file (don't stream raw through the API gateway; push to object storage with a 60 s TTL signed URL).
- **AC:** Filename is `{slug}.gpx`. Opens natively in Kurviger, Calimoto, Google Earth.

**E7-T4. Mobile: download & share sheet**
- Use `expo-file-system` to save, then `expo-sharing` to present the iOS/Android share sheet so users can pipe it into their preferred nav app.
- **AC:** Works in Kurviger and Google Maps on iOS and Android.

---

## 13. Epic E8 — Moto Differentiation Layer v1

### Problem
MotoVault must not be "AllTrails with bikes on the cover." The differentiation that will make a rider choose us is moto-specific intelligence. We already have the raw materials (lean angle, heading, curvature_index) — we just haven't surfaced them.

### Goals
- Ship three moto-specific features in v1: **twist score**, **crowd-sourced surface reports**, **fuel-range overlay**.
- Each feature has a clear entitlement tier (see E4 gating matrix).

### Non-goals
- Weather-aware road-grip ML. v2.
- Bike-specific compatibility routing ("routes for adventure bikes only"). v2.
- Border-crossing info. v2.

### 13.1 Tickets

**E8-T1. Twist score (derived from `curvature_index`)**
- Transform `curvature_index` float into a 1–10 score via a calibrated mapping (`ntile(10) over (partition by country_code)` — relative to the country's distribution, so a "10" always feels like a local standout).
- New column `routes.twist_score int` (GENERATED? or materialized). Materialized is safer since it depends on a percentile across all rows.
- Display as a badge on the hero, breakdown on the detail page ("Top 10% twistiest in Poland").
- **AC:** Values stable across re-runs. Visible on at least 100 seeded routes after a backfill.

**E8-T2. Road surface reports (crowd-sourced)**
- New table `route_surface_reports(id, route_id, user_id, segment_index, condition enum('smooth','rough','gravel','potholes','wet','icy','debris'), note text, reported_at)`.
- Mutation `reportRouteSurface(routeId, segmentIndex, condition, note)` — authenticated.
- Aggregation view on route detail: top 3 most-recent, most-voted conditions per route.
- **AC:** Report decays — reports older than 90 days are de-weighted in the aggregation.

**E8-T3. Fuel-range overlay (Pro)**
- User sets `fuel_tank_range_km` on their bike profile (existing `motorcycles` table, add the column).
- On the route detail map, draw concentric range circles from the start point + from each gas-station waypoint we know about.
- Gas-station data: v1 uses OpenStreetMap Overpass API, cached nightly into a new `fuel_stops` table keyed by geohash.
- **AC:** Works for Poland routes end-to-end (smoke test). Gracefully hides when no fuel data is available.

**E8-T4. Surface type crowd-sourcing → `routes.surface_type`**
- Expose a "What's the dominant surface here?" vote on the review form. Update `routes.surface_type` when consensus reaches ≥ 5 votes with ≥ 80% agreement.
- **AC:** No automatic downgrade of editor-set values — editorial always wins.

### Open questions for E8
- Do we normalize `twist_score` globally or per-country? (Per-country feels more useful; recommend that.)
- Who owns the Overpass caching job? (Backend infra.)

---

## 14. Epic E9 — Pro Subscription Plumbing & Monetization Hooks

### Problem
We reference "Pro" throughout this PRD. We actually need a subscription table, billing integration, webhook handling, and entitlement wiring.

### Goals
- A single `subscriptions` record per user is the source of truth.
- RevenueCat as the billing backend (aligned with the existing `revenuecat-retention-offers` skill in the repo — we're already committed to RevenueCat).
- Launch with one SKU: `motovault_pro_monthly` and one annual `motovault_pro_annual`.

### 14.1 Tickets

**E9-T1. `subscriptions` table + service**
```
subscriptions(
  user_id uuid pk fk,
  revenuecat_entitlement text not null,
  plan text check (plan in ('pro_monthly','pro_annual')),
  status text check (status in ('active','in_grace','expired','cancelled')),
  current_period_end timestamptz,
  updated_at timestamptz
)
```
- Service reads via the user-scoped Supabase client (RLS: user can read their own row, no writes from client).
- **AC:** RLS enforced; only service role writes.

**E9-T2. RevenueCat webhook handler**
- NestJS endpoint `/webhooks/revenuecat` verifying the signature.
- Handles `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE` events.
- Writes through to `subscriptions` and invalidates the entitlement cache.
- **AC:** Idempotent — replaying a webhook doesn't create duplicates.

**E9-T3. Web checkout flow**
- Minimal Stripe Checkout or RevenueCat web billing — whichever is already in use in the existing retention-offers skill. (Check `revenuecat-retention-offers` SKILL.md before building.)
- **AC:** End-to-end purchase in staging; webhook fires; entitlement flips within 2 s.

**E9-T4. Mobile paywall**
- Native IAP via `react-native-purchases` (RevenueCat SDK). Already the pattern based on `revenuecat-retention-offers`.
- Restore purchases flow.
- **AC:** TestFlight + internal-track Android purchase succeeds end-to-end.

**E9-T5. Monetization hook slots (affiliate scaffolding)**
- Non-intrusive placement system with slot names: `route_detail.below_stats`, `route_detail.above_reviews`, `profile.sidebar`, `search_results.inline_card`.
- v1 populates only `route_detail.below_stats` with a single affiliate card: "Recommended tires for {surface_type} routes → {affiliate link}." Feature-flagged OFF by default; turn on per-country as we sign affiliate programs.
- **AC:** Slots are CMS-driven via a new `monetization_slots` table so we can update without deploys. No ads appear for Pro users.

### Open questions for E9
- **Price points.** Andrej — $5.99/mo and $49.99/yr is the market benchmark; REVER and Komoot sit there. Confirm.
- **Regional pricing.** Launch USD only or include EUR/PLN on day one? RevenueCat handles it; I'd enable all major currencies on day one.
- **Free trial.** 7-day trial is standard. Strongly recommended.

---

## 15. Epic E10 — Analytics Instrumentation

### Goal
Instrument every funnel step so we can actually measure the success metrics in §2.3.

### Core events to fire
| Event | Fired from | Properties |
|---|---|---|
| `search.query` | Web + mobile | `q`, `latency_ms`, `result_count`, `has_geo_bias` |
| `search.result_clicked` | Web + mobile | `q`, `position`, `route_id` |
| `route_detail.viewed` | Web + mobile | `route_id`, `is_authenticated`, `is_pro`, `source` |
| `route_detail.save_clicked` | Web + mobile | `route_id`, `is_authenticated` |
| `paywall.shown` | All | `capability`, `source_screen` |
| `paywall.cta_clicked` | All | `capability`, `sku` |
| `signup.completed` | Web + mobile | `source` (enum incl. `review_softwall`, `save_wall`, `gpx_wall`) |
| `subscription.started` | Webhook | `sku`, `price_cents`, `free_trial` |
| `gpx.downloaded` | API | `route_id`, `is_pro`, `quota_remaining` |
| `route_shared.created` | API | `source_ride_id`, `country_code` |

### Tickets
**E10-T1. Shared analytics client** — wraps PostHog (or whichever the team already uses; confirm in E0).
**E10-T2. Funnel dashboard** — one Looker/Metabase dashboard with the 6 funnel steps and the 12-month goals from §2.3.

---

## 16. Success metrics & evaluation plan

### Leading indicators (weeks 1–4)
- Organic landing pages indexed in Search Console (target: 5 k by week 4)
- Signup rate from logged-out detail pages (target: ≥ 3% baseline)
- Searches per session on web (target: ≥ 2.5)
- Save-to-profile rate among signed-in users (target: ≥ 25% in first week of use)

### Lagging indicators (weeks 4–12)
- Free → Pro conversion rate (target: ≥ 2%)
- GPX downloads per Pro user (target: ≥ 1/month)
- Retention: D30 for signed-up-via-discovery cohort (target: ≥ 35%)

### Evaluation cadence
- **Weekly** for Release 1 (get the funnel metrics stable)
- **Bi-weekly** for Release 2 + 3
- **Monthly retro** per epic once in production

---

## 17. Cross-cutting concerns

### 17.1 Data safety & non-destructive migrations
Every migration in this PRD is **additive only**:
- New columns with defaults or nullable
- New tables, no existing-table drops
- No `alter column … type …` anywhere
- Rollback plan is a simple `drop column` / `drop table` per migration; documented in each ticket.

### 17.2 Privacy
- Route `start_point` and `end_point` are already privacy-cropped ±500 m. No change.
- User profiles default to `show_saved_publicly=false` and `show_in_routes=true`.
- Reverse-geocoding in E1-T2 uses Mapbox/Nominatim — do not cache PII, only route identifiers.
- Surface-condition reports in E8 are stored with `user_id` for moderation but displayed anonymously.

### 17.3 Performance budgets
- SSR detail page: LCP < 2.5 s at P75 on 4G.
- `search` typeahead: P99 < 400 ms.
- `routeBySlug`: P99 < 150 ms.

### 17.4 i18n
Out of scope for v1 content, but routes already have `country_code` and we're using `simple` tsvector config rather than a language-specific one so we're not locking ourselves in. v2 can add per-language config.

### 17.5 Accessibility
WCAG 2.1 AA target across all web pages. Mobile uses platform a11y APIs (VoiceOver / TalkBack). Epic E2, E3, E5 each include Lighthouse a11y ≥ 95 as an AC.

### 17.6 Feature flags
Use a single feature-flag service. The following flags are needed:
- `routes_public_pages` — kill-switch for E3
- `routes_freemium_gating` — kill-switch for E4
- `twist_score_visible` — rollout for E8
- `pro_paywall_live` — rollout for E9
- `affiliate_slots_enabled` — per-country

---

## 18. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SEO pages don't get indexed fast enough | M | H | Seed with Picks + a sitemap, do outreach backlinks, monitor weekly |
| Postgres FTS doesn't scale past 500k routes | L | M | Clear migration path to Meilisearch/Typesense; not a day-one problem |
| Paywall hurts signup conversion | M | H | Start with soft walls only, measure, tighten |
| Mapbox costs balloon | M | M | ISR + static-image caching; re-evaluate at 100k pages |
| Contributor-generated data quality is low | M | H | Editorial curation layer already exists; require MotoVault Pick badge for top placement |
| Reverse-geocoding rate limits | M | L | Use a cache, batch backfill overnight |
| RevenueCat webhook failures | L | H | Retry queue + manual reconciliation script |
| Privacy complaints about route start points | L | H | 500m crop already in place; add explicit deletion flow |

---

## 19. Open questions consolidated (for Andrej)

Sorted by blocking-ness:

**Blocking Release 1:**
1. Confirm **slug/URL scheme** per §6.1.
2. **Mapbox vs self-hosted tiles** — pick in E0-T4.
3. **Seeded data scope** — which countries/regions ship in Release 1?

**Blocking Release 2:**
4. **Free GPX quota** — 0, 2, or 5 per month? (§9.1)
5. **Gating matrix sign-off** — any rows you want to flip?
6. **Review soft-wall threshold** — 3 reviews visible to anonymous, or different?

**Blocking Release 3:**
7. **Pro pricing** — $5.99/$49.99 confirmed?
8. **Affiliate partners** — do we already have tire/gear affiliate relationships or does someone need to source them?
9. **Regional offline map SKUs** — bundle in Pro only, or add as a separate one-off purchase (Komoot-style)?

**Nice to have answers for design kickoff:**
10. Should we show bike-type-specific suitability on the detail page (e.g. "👍 sport bikes, ⚠️ cruisers")?
11. Are we happy showing contributor handles + bike model publicly as a trust signal?
12. Should the logged-out map be blurred, static, or clean-static-with-CTA? (My rec: clean-static-with-CTA.)

---

## 20. Timeline (rough)

| Week | Milestone |
|---|---|
| 1 | E0 spike closes; ADRs merged; design direction locked |
| 2–3 | E1 migrations land, backfill runs against staging |
| 3–4 | E2 + E3 in parallel; staging preview of global search and SSR pages |
| 5 | Release 1 goes live behind `routes_public_pages` flag to 10% traffic |
| 6 | Release 1 to 100%; Epic E4 + E5 in flight |
| 7–8 | Release 2 (gating + saved routes) |
| 9–10 | Epic E8 (moto-differentiation) |
| 11–12 | Epic E9 (Pro billing) + Release 3 |

Padding for design review, QA, and RevenueCat review cycles is not shown here but should be added.

---

## 21. Appendix A — Monetization opportunity matrix (for future bets beyond v1)

Ranked roughly by feasibility vs early-stage reward, based on the competitive research:

| # | Idea | Feasibility | Year-1 reward | Notes |
|---|---|---|---|---|
| 1 | Pro subscription | Very high | High | Covered by E9 |
| 2 | Tire / gear affiliate (RevZilla, Amazon) | Very high | Low–Mid | E9-T5 slot ready |
| 3 | Regional offline map packs | High | Mid | v2 extension of E4 offline-maps gate |
| 4 | Motorcycle insurance lead-gen | High | Mid | Post-ride CTA, high-intent moment |
| 5 | Hotel / overnight stop partnerships | Medium–High | Mid | Natural for the `trips` feature |
| 6 | Sponsored routes (tourism boards) | Medium | Mid–High | Requires BD, but motorcycle tourism is a real budget line |
| 7 | Fuel-station partnerships (Shell etc.) | Medium | Low | Needs scale first |
| 8 | Dealership lead-gen (test rides) | Medium | Mid | Post-ride, high-intent |
| 9 | Guided-tour / instructor marketplace | Medium | Low early, high later | Feeds community stickiness |
| 10 | Challenge sponsorships | Medium | Low–Mid | Works best at scale |
| 11 | Data licensing to DOTs / tourism | Medium | High (eventually) | Requires anonymization + scale |
| 12 | Premium content tier (audio guides, curated routes) | Low–Medium | Mid | Good retention lever |

**Recommendation for the first 12 months:** focus on (1), (2), (3), (4), and (5). The others stay on the roadmap but don't distract the team yet.

---

## 22. Appendix B — Moto-specific differentiation checklist (what beats AllTrails)

Not all of this is in v1 — Epic E8 covers the first three. The rest is the long-term roadmap.

1. ✅ **Twist score per route** (E8-T1)
2. ✅ **Crowd-sourced surface quality** (E8-T2)
3. ✅ **Fuel-range overlay by bike tank size** (E8-T3)
4. 🔜 Lean-angle / cornering difficulty rating
5. 🔜 Bike compatibility matching (cruiser vs adventure vs sport)
6. 🔜 Seasonal road closure calendar (mountain passes)
7. 🔜 Toll roads + border crossing info
8. 🔜 Real-time group-ride coordination
9. 🔜 Road-grip / weather intelligence
10. 🔜 Turn-by-turn cue sheets with optional audio notes
11. 🔜 Rider-submitted hazard markers (potholes, roadkill, speed traps)
12. 🔜 Guided-tour marketplace

---

## 23. Appendix C — What we explicitly do NOT need to build

- Authentication system — already in place via Supabase
- Route geometry storage — already in place (`routes` table, PostGIS)
- Privacy cropping — already in place (±500 m)
- Polyline encoding/decoding — already in place (`PolylineCodec` in `routes.service.ts`)
- Curvature calculation — already in place (`calculateCurvatureIndex`)
- GPX XML builder — already in place (`buildGpxXml`, `escapeXml`)
- Rating aggregation triggers — already in place
- `route_saves` table — already in place
- `premium_waitlist` — already in place, can deprecate once E9 ships
- Group rides / trips — out of scope, separate initiative

This matters because it means **the hard backend geometry work is done**. The remaining work is UX surface, policy (gating), growth (SEO), and differentiation (moto intelligence) — the easier parts to de-risk.

---

## 24. Sign-off

**PM** (Andrej): ☐
**Design lead**: ☐
**Backend lead**: ☐
**Mobile lead**: ☐
**Web lead**: ☐

---

*End of document.*
