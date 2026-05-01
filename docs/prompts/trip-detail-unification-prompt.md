# Compound Engineering Brief — Unify Trip Detail on `trips`, Audit & Retire `routes`/`discover_trips`

**Status:** Ready to plan
**Owner:** _claim before starting_
**Estimated scope:** Phase 1 ~½ day · Phase 2 ~1–2 days (audit-driven) · Phase 3 ~1 day
**Linked context:** `docs/solutions/architecture/trip-unification-three-entities-to-one.md`

---

## 1 · Problem

Public trip-detail pages at `https://motovault.app/trips/{country}/{region}/{slug}` 404 for any template that exists in `trips` but not in `discover_trips`. Concrete repro: 5 South Africa templates inserted on 2026-05-01 (e.g. `garden-route-cape-to-tsitsikamma`) are visible on the mobile Discover feed and present in `trips` but invisible to the web detail page.

**Root cause:** the page (`apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx`) calls the `@deprecated discoverTripBySlug` resolver, which reads from `public.discover_trips` (40 rows, lowercase country codes, hand-curated). The non-deprecated path is `tripBySlug` which reads from `public.trips` (125 rows, all 119 templates) — already used by mobile (`apps/mobile/src/graphql/queries/trip-by-slug.graphql`) and by web sitemap/explore via `tripTemplates`.

**Knock-on:** the daily route-add skill (`skills/add-moto-routes/SKILL.md`) only writes to `trips`. Every batch it adds is invisible to the web until someone manually mirrors it into `discover_trips`. 79 rows ghosted this way previously and required a manual backfill — see the warning in `references/db-schema.md`.

We want to refactor properly, not patch.

---

## 2 · Audit Findings (run on 2026-05-01)

### Row counts

| Table                    | Rows  | Status                                                                                  |
|--------------------------|-------|-----------------------------------------------------------------------------------------|
| `trips`                  | 125   | Active — primary entity (119 templates + 6 user trips)                                  |
| `trip_waypoints`         | 1,049 | Active — primary waypoint store                                                         |
| `discover_trips`         | 40    | **Read-only catalogue** — only fed by web detail page (deprecated path)                 |
| `discover_trip_reviews`  | 1     | Single row — practically dead                                                           |
| `routes`                 | 40    | **Still actively read** by web Explore + admin + sitemap fallback + search + fuel-stops |
| `route_reviews`          | 1     | Practically dead                                                                        |
| `route_saves`            | 7     | Used by deprecated `savedRoutes` query (web Garage, profile saved page)                 |
| `route_lists`            | 135   | **No application reads/writes** — schema only                                           |
| `route_list_items`       | 3     | **No application reads/writes** — schema only                                           |

### Active code references to `routes` (must migrate or remove)

API:
- `apps/api/src/modules/routes/routes.resolver.ts` — `routePathById`, `routeBySlug` *(deprecated, 8 weeks)*, `routeDetail` *(deprecated, 8 weeks)*, plus `discoverRoutes`-style listing.
- `apps/api/src/modules/routes/routes.service.ts` — 12+ queries against `routes` and `route_reviews`.
- `apps/api/src/modules/routes/saved-routes.service.ts` — 6 queries against `route_saves`.
- `apps/api/src/modules/search/search.service.ts:227` — full-text search hits `routes`.
- `apps/api/src/modules/fuel-stops/fuel-stops.service.ts:89,187` — joins `routes` to find nearby fuel stops.
- `apps/api/scripts/seed-places.ts`, `apps/api/scripts/backfill-route-slugs.ts` — utility scripts.

Web:
- `apps/web/src/lib/fetch-route-detail.ts` — `routeDetail` query.
- `apps/web/src/lib/redirect/uuid-to-slug.ts` — `routePathById` for /r/{uuid} redirects.
- `apps/web/src/components/save-route-button.tsx` — `isRouteSaved`, `saveRoute`, `unsaveRoute`.
- `apps/web/src/app/(community)/garage/page.tsx` — `savedRoutes` query.
- `apps/web/src/app/u/[handle]/saved/page.tsx` — `savedRoutes` query.
- `apps/web/src/app/explore/[country]/page.tsx` and `[locale]/(marketing)/explore/[country]/page.tsx` — `topRoutes` fetch.
- `apps/web/src/app/admin/analytics/page.tsx` — admin top-routes leaderboard.

Mobile:
- `apps/mobile/src/app/route/[country]/[region]/[slug].tsx` — universal-link landing page → `routeBySlug` deep link → redirects to trip-detail by ID.
- `apps/mobile/src/graphql/queries/saved-routes.graphql`, `is-route-saved.graphql`, `route-detail.graphql`, `get-route-reviews.graphql`, `route-by-slug-deeplink.graphql`, `fuel-stops-near-route.graphql`.
- `apps/mobile/src/graphql/mutations/save-route.graphql`, `unsave-route.graphql`, `unshare-route.graphql`.
- `apps/mobile/src/graphql/queries/template-trip-id-for-route.graphql` — bridge query (route id → template trip id).

### Verdict

| Object                         | Action                                                                                |
|--------------------------------|---------------------------------------------------------------------------------------|
| `route_lists`, `route_list_items` | **Drop in Phase 3.** Zero application reads/writes anywhere. Schema-only.          |
| `route_reviews` (1 row)        | Drop after deprecating `routes.routeDetail`/`routeReviews` queries.                   |
| `route_saves` (7 rows)         | **Migrate** the 7 saves to a new `trip_saves` table or to existing `tripSavesSvc` using `trips.migrated_from_route_id` mapping; then drop. |
| `routes` (40 rows)             | **Migrate** behind the scenes: every consumer of `routes` switches to `trips` (via `migrated_from_route_id` join or by reading `trips` directly). Drop after a clean 30-day window with zero reads. |
| `discover_trips` (40 rows)     | **Drop** in Phase 3 once the web detail page is on `tripBySlug`. Mobile already off it. |
| `discover_trip_reviews` (1 row) | Drop with `discover_trips`.                                                          |

---

## 3 · Goal / Acceptance Criteria

- The 5 SA template URLs (and any future template insert) resolve at `https://motovault.app/trips/{COUNTRY}/{REGION}/{slug}` within ≤5 min of insertion (current ISR window).
- Single source of truth: `trips` is the only table queried for public template detail.
- All `@deprecated` resolvers (`discoverTrip*`, `routeBySlug`, `routeDetail`, `savedRoutes`, `saveRoute`, `unsaveRoute`, `isRouteSaved`) are either removed or have a documented removal date past their stated 8-week window.
- New tests cover the unified read path and prevent regression of the ghost-row bug.
- `pnpm precheck` passes; CI green; no production GraphQL errors for ≥48 h after deploy.

---

## 4 · Phased Plan

### Phase 1 — Unblock the web detail page (urgent, ½ day)

**Files to change**

1. `apps/api/src/modules/trips/models/trip.model.ts`
   - Add `@Field() updatedAt: string;` next to `createdAt`. Currently missing — the page renders "Updated …" from this.
2. `apps/api/src/modules/trips/services/trip-templates.service.ts`
   - Map `updated_at` in `mapTemplateRow` and add `updated_at` to `TEMPLATE_SELECT`.
3. `apps/api/src/modules/trips/trips.resolver.ts`
   - Inside `tripBySlug`, fire-and-forget call `tripTemplatesSvc.incrementViewCount(trip.id)` after successful fetch (mirror `discoverTripsService.incrementViewCount`). Add the method to `TripTemplatesService` if missing — it should `UPDATE trips SET view_count = view_count + 1 WHERE id = $1` using `SUPABASE_ADMIN`.
4. `apps/web/src/graphql/queries/trip-by-slug.graphql` (new file)
   - Inline GraphQL string in the page is a smell — extract a TypedDocumentNode like the rest of the web app does for `tripTemplates`. Mirror the field set the page consumes.
5. `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx`
   - Replace the inline `DISCOVER_TRIP_BY_SLUG_QUERY` with `TripBySlugDocument` from `@motovault/graphql`.
   - Rename `contributor` → `organiser` (DiscoverTrip used `contributor`; Trip uses `organiser`). Field shape is identical.
   - Confirm `updatedAt` reads from the new field.
   - Page no longer needs its own `TripData` interface — derive types from `TripBySlugQuery['tripBySlug']`.
6. `pnpm generate` to regenerate GraphQL client types.

**SQL preflight (no migration yet)** — confirm assumptions before code:
```sql
-- Every template has updated_at populated:
SELECT COUNT(*) FROM trips
WHERE is_template = true AND (updated_at IS NULL OR slug IS NULL OR published_at IS NULL);
-- Expect 0.

-- Every (country_code, region_code, slug) is unique among templates:
SELECT country_code, region_code, slug, COUNT(*)
FROM trips WHERE is_template = true
GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;
-- Expect 0 rows.
```

**Tests (Phase 1)** — colocated `*.spec.ts`, vitest, follow patterns in `apps/api/src/modules/motorcycles/motorcycles.service.spec.ts`:

- `apps/api/src/modules/trips/services/trip-templates.service.spec.ts`
  - `getTemplateBySlug` returns the row when `is_template = true` and `is_flagged = false`.
  - Throws `NotFoundException` when slug doesn't exist, when `is_flagged = true`, when `is_template = false`.
  - Maps `updated_at` to `updatedAt` correctly.
  - Mocks Supabase client (`createSupabaseMock` if it exists; otherwise vi-mock per the kudos.service.spec.ts pattern).
- `apps/api/src/modules/trips/trips.resolver.spec.ts` (extend existing or create)
  - `tripBySlug` calls service once with the right args.
  - `tripBySlug` triggers `incrementViewCount` exactly once and does not await it (no error if increment fails).
  - `tripBySlug` does NOT throw if increment fails (service swallows errors).
- `apps/web/src/app/trips/[country]/[region]/[slug]/__tests__/page.test.tsx` (new — `pnpm --filter web test`)
  - Snapshot/render test: given a fixture of `TripBySlugQuery['tripBySlug']`, the page renders title, breadcrumb, distance, organiser display name, "Updated …" string, and the day-by-day waypoint groups.
  - 404 path: when `fetchTrip` returns `null`, page calls `notFound()`.
  - Static map URL builder: with `MAPBOX_ACCESS_TOKEN` unset, returns `null`; with it set, returns a URL containing every waypoint pin.

**Verification (Phase 1)**

```sql
-- After deploy, pick a freshly-added SA template and confirm it returns:
SELECT id, slug, view_count, updated_at FROM trips
WHERE slug = 'garden-route-cape-to-tsitsikamma' AND is_template = true;
```

cURL the deployed GraphQL endpoint with the new `tripBySlug` query against `country: "ZA", region: "ZA-WC", slug: "garden-route-cape-to-tsitsikamma"` — expect 200 with `data.tripBySlug.id`. Then load `https://motovault.app/trips/ZA/ZA-WC/garden-route-cape-to-tsitsikamma` after waiting out the 5-min ISR window — expect a rendered page with all 10 waypoints in 2 day groups.

**Rollback for Phase 1:** revert the page commit. The old `discoverTripBySlug` resolver remains untouched.

---

### Phase 2 — Migrate `routes` consumers to `trips` (1–2 days, audit-driven)

The bridge already exists: `trips.migrated_from_route_id` and `trips.migrated_from_discover_trip_id`. Mobile already uses `templateTripIdForRoute` to walk this bridge.

**Migrations to write (read-only, no destructive changes yet)**

1. **Search** (`search.service.ts`):
   - Replace the `routes` table search with a search against `trips` filtered by `is_template = true AND is_flagged = false`. Use `search_tsv` if it exists on `trips`; otherwise add a generated tsvector column in a new migration.
2. **Fuel-stops** (`fuel-stops.service.ts:89,187`):
   - Update the join to look up the trip via `migrated_from_route_id`, then read `start_lat`/`start_lng` from `trips`. Mid-term: add a PostGIS `geography` column on `trips` (mirror `discover_trips.start_point`) and switch the spatial query.
3. **Web Explore `topRoutes`** (`apps/web/src/app/explore/[country]/page.tsx`, `[locale]/(marketing)/explore/[country]/page.tsx`):
   - The "top routes" carousel was originally curated route content. Replace with `tripTemplates(filter: { country: $c })` ordered by `view_count DESC`. The list of "best routes per country" comes for free.
4. **Admin analytics top routes** (`apps/web/src/app/admin/analytics/page.tsx`):
   - Same swap. Order by `view_count DESC` from `trips`.
5. **Save / unsave** (`save-route-button.tsx`, mobile mutations):
   - Add `tripBySlugId` resolver if needed, then call `saveTrip` / `unsaveTrip` (existing in `tripSavesSvc`). Bridge stale references using `migrated_from_route_id`.
6. **Mobile universal link** (`apps/mobile/src/app/route/[country]/[region]/[slug].tsx`):
   - Already uses the `routeBySlug → tripId` bridge. After Phase 2 retires `routes`, switch to `tripBySlug` directly. Keep the `route/...` URL shape for backwards compatibility — just resolve it through `tripBySlug` server-side.
7. **`/u/[handle]/saved` and `/garage`** (web saved-routes pages):
   - Switch to `savedTrips` (already exists per the `@deprecated savedRoutes` comment in `saved-routes.resolver.ts`).
8. **Sitemap** (`apps/web/src/app/sitemap.ts`):
   - Already uses `tripTemplates`. No work, just verify after the URL pattern stays at `/trips/...`.

**Tests (Phase 2)**

- `apps/api/src/modules/search/search.service.spec.ts` — extend: search returns templates from `trips`, not `routes`. Removing a template (`is_flagged=true`) drops it from results.
- `apps/api/src/modules/fuel-stops/fuel-stops.service.spec.ts` — extend: nearest-fuel query takes a `tripId` and returns same results as previous `routeId` flow when bridged via `migrated_from_route_id`.
- `apps/api/src/modules/trips/services/trip-saves.service.spec.ts` — new or extended: save/unsave a template; `savedTrips` paginates; `isTripSaved` returns boolean.
- `apps/web/src/app/(community)/garage/__tests__/page.test.tsx` — render test using `savedTrips` fixture; verifies the saved-routes-to-saved-trips swap.
- E2E (Playwright if set up — otherwise skip): visit `/explore/za`, click first card, land on a `/trips/...` URL. No `/r/...` legacy URL should appear in the DOM.

**Migration script (no DDL yet)**

`apps/api/scripts/audit-routes-references.ts` — a read-only script that:
- Counts rows in `routes` whose `id` is **not** referenced by `trips.migrated_from_route_id` (i.e. orphan candidates).
- Counts `route_saves` whose `route_id` cannot be resolved to a `trips.id`.
- Outputs JSON for review before any drop.

**Verification (Phase 2)**

After deploying Phase 2:
- Production logs show 0 calls/day to `routeBySlug`, `routeDetail`, `routePathById`, `savedRoutes`, `isRouteSaved`, `saveRoute`, `unsaveRoute` for ≥7 days.
- Sentry has no new "Route not found" or "DiscoverTripNotFoundError" issues.

---

### Phase 3 — Drop deprecated tables & resolvers (1 day)

**Only after Phase 2 has been clean for ≥7 days in production.**

Migrations (`supabase/migrations/`, write each as a separate file):

1. `drop_route_lists.sql` — `DROP TABLE public.route_list_items; DROP TABLE public.route_lists;`. Zero application reads/writes — confirmed in audit.
2. `drop_discover_trips.sql` — `DROP TABLE public.discover_trip_reviews; DROP TABLE public.discover_trips;` plus removing the `forked_from_discover_trip_id` column from `trips` if unused (verify first).
3. `drop_routes.sql` (last) — drop `route_saves`, `route_reviews`, `routes` in that order. Keep `trips.migrated_from_route_id` for at least one more release in case we need to debug data lineage; remove in a follow-up migration.

API code to delete:

- `apps/api/src/modules/discover-trips/` — entire module (resolver + service + models + DTOs).
- `apps/api/src/modules/routes/saved-routes.resolver.ts`, `saved-routes.service.ts` and their `.spec.ts`.
- All `@deprecated` queries in `routes.resolver.ts` (`routeBySlug`, `routeDetail`); keep `routePathById` only if still needed for `/r/{uuid}` legacy redirects, otherwise delete it too.
- Drop `apps/api/scripts/seed-places.ts` and `backfill-route-slugs.ts` if they only target the routes table.

GraphQL files to delete:

- `apps/mobile/src/graphql/queries/saved-routes.graphql`, `is-route-saved.graphql`, `route-detail.graphql`, `get-route-reviews.graphql`, `fuel-stops-near-route.graphql`.
- `apps/mobile/src/graphql/mutations/save-route.graphql`, `unsave-route.graphql`, `unshare-route.graphql`.
- `apps/mobile/src/graphql/queries/template-trip-id-for-route.graphql` (no longer needed once routes are gone).
- `apps/web/src/graphql/queries/route-by-slug.graphql`, `route-path-by-id.graphql`.
- `apps/mobile/src/graphql/queries/discover-trips.graphql`.

Run `pnpm generate` after each batch of file deletions; expect TS errors that pinpoint remaining consumers.

**Skill update**

- `skills/add-moto-routes/SKILL.md` and `references/db-schema.md`: remove every mention of `discover_trips`. The `published_at` warning stays — that's the `trips`-side concern.

**Tests (Phase 3)**

- All `routes.service.spec.ts` and `saved-routes.service.spec.ts` deleted.
- A migration test: spin up the test DB with the drop migrations applied, run `pnpm test` across the monorepo — every test still passes. (No code path can reference dropped tables.)
- Add a guardrail test in `apps/api/src/modules/trips/__tests__/no-deprecated-tables.spec.ts`:
  ```ts
  // Fails if any source file under apps/api/src or apps/web/src or apps/mobile/src
  // references any of: 'discover_trips', 'route_lists', 'route_list_items',
  // 'route_reviews', 'route_saves', 'discover_trip_reviews'.
  ```
  Use a glob + ripgrep-based assertion; this is the long-term insurance against the bug returning.

**Verification (Phase 3)**

```sql
-- After dropping:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('discover_trips','discover_trip_reviews','routes','route_reviews','route_saves','route_lists','route_list_items');
-- Expect 0 rows.

-- Templates still queryable:
SELECT COUNT(*) FROM trips WHERE is_template = true AND published_at IS NOT NULL;
-- Expect ~119+ (matches today plus any new inserts).
```

Smoke test the production sitemap. Hit each of the 5 SA templates plus 5 random older templates. All 200.

---

## 5 · Test-Strategy Summary (compound-engineering view)

| Layer        | Test                                                    | Phase |
|--------------|---------------------------------------------------------|-------|
| Unit (API)   | `trip-templates.service.spec.ts` — getTemplateBySlug   | 1     |
| Unit (API)   | `trips.resolver.spec.ts` — tripBySlug + view increment | 1     |
| Unit (web)   | trip-detail page render + 404 + map URL                 | 1     |
| Unit (API)   | search.service.spec.ts — searches trips                 | 2     |
| Unit (API)   | fuel-stops.service.spec.ts — bridges via trips          | 2     |
| Unit (API)   | trip-saves.service.spec.ts — save/unsave/list           | 2     |
| Unit (web)   | garage page renders savedTrips                          | 2     |
| Guardrail    | no-deprecated-tables source-grep test                   | 3     |
| Integration  | sitemap → detail page round trip                        | 3     |

Run `pnpm precheck` after each phase; gate merge on green.

---

## 6 · Out of Scope / Follow-ups

- Adding PostGIS `geography` column to `trips` for fast spatial queries (today some flows use `discover_trips.start_point`).
- Migrating `discover_trip_reviews` (1 row) and `route_reviews` (1 row) to `trip_reviews` — unless the row is meaningful, drop with the parent table.
- Renaming the URL structure from `/trips/...` to `/routes/...` or vice versa. Out of scope; keep both for SEO continuity.
- Adding 301 redirects from `/r/{uuid}` and `/route/{country}/{region}/{slug}` to `/trips/...`. Probably worth doing in Phase 2 to preserve link equity.

---

## 7 · Quick-Reference Commands

```bash
# Audit current usage of legacy tables (run before each phase):
pnpm --filter @motovault/api exec tsx scripts/audit-routes-references.ts

# Regenerate GraphQL types after schema change:
pnpm generate

# Full pre-merge check:
pnpm precheck

# Pre-push (merge-base diff only):
pnpm precheck:push
```

---

## 8 · Open Questions (resolve before Phase 2)

1. Are the 7 rows in `route_saves` worth migrating, or can we tell those users their saves were lost? Check Sentry/analytics for actual usage of `savedRoutes` queries in the last 30 days.
2. Does `topRoutes` admin analytics need to keep historical view counts? If yes, copy `routes.view_count` into `trips.view_count` with a one-time SQL `UPDATE … FROM` join on `migrated_from_route_id` before dropping `routes`.
3. Mobile OTA: are there still users on app versions that call the deprecated `discoverTrips` / `routeBySlug` queries? If yes, Phase 3 must wait for the next forced-update window.
