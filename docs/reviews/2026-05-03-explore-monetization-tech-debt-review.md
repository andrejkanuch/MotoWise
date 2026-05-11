---
title: "Tech-Debt Review — Explore Funnel & Monetization Plan"
type: review
status: review
date: 2026-05-03
reviews: docs/plans/2026-05-03-001-feat-explore-monetization-funnel-plan.md
focus: schema reuse, avoid duplicate tables/columns, tech-debt impact
verdict: 1 table can be eliminated entirely · 2 columns can be removed · 2 columns are justified · 1 column needs an i18n decision
---

# Tech-Debt Review — Explore Funnel & Monetization Plan

## TL;DR

The migration `00125_explore_monetization.sql` proposes **5 new columns + 1 new table + 1 new index**. After auditing every existing migration:

- **1 new table is fully avoidable** — `trip_suggestions` (00106) already implements the exact workflow.
- **2 new columns should be removed** — `border_crossings` is speculative ("shape only, content v2"), `has_sufficient_routes` is a hardcoded business rule masquerading as schema.
- **2 columns are genuinely needed** — `elevation_profile`, `best_season_months`. No existing column can absorb them.
- **1 column needs a design decision before adding** — `places.editorial_md` should likely be a separate `place_editorial` table for i18n.
- **1 column is a stopgap** — `user_gating_events.trip_id` is correct given current state, but perpetuates the `routes`/`trips` split tech debt.

Net effect of these changes: migration shrinks from ~120 lines to ~30 lines; one parallel-shape table is eliminated; future ALTER TABLE pressure reduced.

---

## The big find: `trip_suggestions` already exists

The plan's Track 1.1 proposes a new `route_suggestions` table for the "Suggest a route" CTA on thin country pages. **A table with this exact shape and status workflow already exists in `00106_trip_suggestions.sql`:**

```sql
-- Existing: supabase/migrations/00106_trip_suggestions.sql
CREATE TABLE trip_suggestions (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips,         -- currently NOT NULL
  author_user_id UUID NOT NULL REFERENCES users,
  kind TEXT NOT NULL DEFAULT 'waypoint'           -- ENUM('waypoint','note')
    CHECK (kind IN ('waypoint','note')),
  name TEXT NOT NULL CHECK (1-200 chars),
  notes TEXT CHECK (≤2000 chars),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  day_index INT,
  period_of_day TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by UUID REFERENCES users,
  decided_at TIMESTAMPTZ,
  decided_note TEXT,
  waypoint_id UUID REFERENCES trip_waypoints,
  created_at, updated_at
);
-- + RLS policies, status indexes, decision audit trail
```

The plan's `route_suggestions` table:

```sql
-- Plan: route_suggestions
CREATE TABLE route_suggestions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,         -- vs author_user_id
  country_code TEXT NOT NULL,                     -- NEW field
  name TEXT NOT NULL CHECK (1-200 chars),         -- same
  description TEXT CHECK (≤2000 chars),           -- same shape as notes
  source_url TEXT CHECK (≤2048 chars),            -- NEW field
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),  -- subset of existing
  created_at, updated_at
);
```

**These are 90% the same table.** The only real differences:

1. New table needs `country_code` (not present in `trip_suggestions`)
2. New table needs `source_url` (not present)
3. Existing table requires `trip_id NOT NULL`, new use case has no trip yet
4. New table uses `approved` instead of `accepted` (cosmetic; align with existing)

### Recommended consolidation

Extend `trip_suggestions` instead of creating a parallel table:

```sql
-- Single new migration, ~10 lines
ALTER TABLE trip_suggestions
  ALTER COLUMN trip_id DROP NOT NULL;             -- allow country-level suggestions

ALTER TABLE trip_suggestions
  ADD COLUMN country_code TEXT,                   -- nullable; required only when trip_id IS NULL
  ADD COLUMN source_url TEXT CHECK (source_url IS NULL OR char_length(source_url) <= 2048);

-- Extend kind enum to cover the new use case
ALTER TABLE trip_suggestions
  DROP CONSTRAINT trip_suggestions_kind_check;
ALTER TABLE trip_suggestions
  ADD CONSTRAINT trip_suggestions_kind_check
  CHECK (kind IN ('waypoint','note','new_route'));

-- Either trip_id (waypoint/note suggestion) OR country_code (new_route) must be set
ALTER TABLE trip_suggestions
  ADD CONSTRAINT trip_suggestions_target_check
  CHECK (
    (kind IN ('waypoint','note') AND trip_id IS NOT NULL)
    OR (kind = 'new_route' AND country_code IS NOT NULL AND trip_id IS NULL)
  );
```

**What you save:**

- Zero new RLS policies (existing 4 cover this).
- Zero new indexes — existing `(status) WHERE status='pending'` index covers admin queue.
- One unified admin review queue UI instead of two parallel ones.
- One mutation resolver pattern (`createSuggestion(input)`), not two.
- Status terminology stays consistent (`accepted`/`rejected`/`withdrawn`); the plan's `approved` introduces a third synonym.

**Trade-offs:**

- The existing table name is "trip_suggestions" and now also stores route suggestions where there's no trip yet. Slight semantic drift. Mitigation: rename to `community_suggestions` in a follow-up cleanup migration once the team is comfortable; not blocking.
- `author_user_id` (existing) vs `user_id` (proposed) — keep `author_user_id`, it's clearer.

This is the highest-leverage simplification in the plan.

---

## Columns to remove from 00125

### Remove `trips.border_crossings JSONB`

The plan's own comment: *"Border crossings (shape only, content v2)"*.

**Don't add columns for shape-only-content-v2.** This is the textbook anti-pattern that produces "what is this column for? Nothing reads it." comments three years later. When v2 ships and you actually know whether borders are: an array of `{country_a, country_b, lat, lng, name}`, a derived computation from waypoint sequence, a separate `trip_border_crossings` table, or something else — add it then.

The cost of deleting this from the migration: zero. The cost of carrying an unused JSONB column: it shows up in every `SELECT *`, in generated TypeScript types, in the GraphQL schema, in code review questions. Each is small but compounds.

**Action:** Remove from 00125. Add when v2 has a concrete use case.

### Remove `places.has_sufficient_routes BOOLEAN GENERATED`

The plan defines this as `GENERATED ALWAYS AS (route_count >= 8) STORED`. This is a hardcoded business rule (8) baked into schema:

- If you decide thin pages should be ≥10 routes (or ≥5 with editorial), it's an `ALTER TABLE` to change the threshold.
- If you decide the threshold should be locale-specific (≥8 for English, ≥3 for emerging markets), the column can't represent it.
- The query benefit is marginal: `WHERE route_count >= 8` is just as indexable as `WHERE has_sufficient_routes = true`, and a `B-tree (route_count)` index serves both directions plus `>= 5`, `>= 10`, etc.

**Action:** Remove the generated column. Use `WHERE route_count >= 8` directly in the sitemap query and `generateMetadata`. Define the threshold as a TypeScript constant (`PLACE_INDEX_MIN_ROUTES = 8`) so it can change without a migration.

```typescript
// apps/web/src/lib/seo/place-indexing.ts
export const PLACE_INDEX_MIN_ROUTES = 8;
export const isIndexable = (place: { route_count: number }) =>
  place.route_count >= PLACE_INDEX_MIN_ROUTES;
```

---

## Column that needs a design decision before adding

### `places.editorial_md TEXT` — single-locale or i18n?

The plan adds `editorial_md TEXT` to the `places` table for country/region editorial content.

**Two issues with putting it on `places`:**

1. **`places` is a reference table** (PK is `BIGINT` GeoNames ID). Mixing reference data with editorial content is a known anti-pattern — every `places` query now risks pulling kilobytes of markdown unintentionally.

2. **i18n cannot be represented.** `next-intl` is in the codebase; the blog already stores per-locale content (`content/blog/{locale}/`). At some point you'll want `editorial_md` per locale: English markdown for `en`, Spanish for `es`, etc. Single-column TEXT can't represent that.

**Two designs to choose between:**

**Option A — single-locale, ship now:**

```sql
ALTER TABLE places ADD COLUMN editorial_md TEXT;
```

Acceptable if and only if the team commits to "editorial content stays English-only forever, or we move it to MDX files alongside `/guides/` later." Cheap; aligns with the 3-guide launch.

**Option B — separate i18n-ready table (~10 lines extra):**

```sql
CREATE TABLE place_editorial (
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en',
  content_md TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  PRIMARY KEY (place_id, locale)
);
ALTER TABLE place_editorial ENABLE ROW LEVEL SECURITY;
-- public read, admin write — same pattern as articles
```

**Option C — push it to MDX entirely:**

The plan's Track 8 already builds an MDX guides infrastructure. Country pages can pull from `content/places/{locale}/{country_slug}.mdx` using the same gray-matter pattern. **No DB column at all.** This is the most consistent: one editorial-content system, one publishing workflow, one mental model.

**Recommendation: Option C.** Country editorial is editorial content. The blog/guides MDX pipeline already exists. Don't create a third place editorial content can live (DB column, MDX, blog). Path: `apps/web/src/content/places/en/italy.mdx` with `gray-matter` frontmatter for `metaTitle, metaDescription, heroImage, season`. Publishing flow = git commit, same as guides.

If you reject Option C, take Option B. Avoid Option A — it locks out i18n at the schema layer.

---

## Columns that ARE justified

### `trips.elevation_profile JSONB` — keep

Existing `trips.elevation_gain_m INT` is the *total* gain (e.g., 1840m), not the per-point profile needed for the elevation chart. No existing column or table can represent the dense (50-100 sample points per trip) elevation series.

JSONB is the right choice here:

- Dense per-point data; a separate `trip_elevations(trip_id, distance_km, elevation_m, lat, lng)` table would be 5-10K rows for 122 trips with no relational queries against individual points
- The audit confirms `trips` has no other JSONB blobs — this becomes the first, set the precedent carefully
- The CHECK constraint in the plan (`jsonb_typeof = 'array' AND jsonb_array_length > 0`) is good defensive practice

The lat/lng-included shape (BC-5 fix) is correct — without it, map↔chart hover sync requires a separate lookup.

**One tightening suggestion:** The CHECK should also verify each element has the four required keys, or document that schema validation lives at the application layer:

```sql
-- Optional: stronger CHECK if you want DB-level guarantees
CHECK (
  elevation_profile IS NULL
  OR (
    jsonb_typeof(elevation_profile) = 'array'
    AND jsonb_array_length(elevation_profile) > 0
    AND elevation_profile @? '$[*] ? (
      exists(@.distanceKm) && exists(@.elevationM)
      && exists(@.lat) && exists(@.lng)
    )'
  )
)
```

Application-layer Zod validation is fine if you'd rather keep the CHECK simple.

### `trips.best_season_months SMALLINT[]` — keep

Nothing seasonal exists anywhere in the schema (audited). The CHECK constraint (`<@ ARRAY[1,...,12]`) is good. SMALLINT[] is queryable with `&&` (overlap) for "best season includes month 7" filters. Keep as proposed.

---

## The stopgap column

### `user_gating_events.trip_id UUID` — add, but with a deprecation note

Adding `trip_id` while keeping `route_id` perpetuates the legacy `routes`/`trips` split that the trip-unification migrations (00112, 00117–00119) are working to eliminate. After the proposed change, `user_gating_events` has two parallel FKs to two parallel "trip-like" entities, and the GPX-quota count must `COUNT(*) WHERE feature='DOWNLOAD_GPX'` regardless of which FK is set.

**Add a CHECK to prevent ambiguous rows:**

```sql
ALTER TABLE user_gating_events
  ADD COLUMN IF NOT EXISTS trip_id UUID
  REFERENCES trips(id) ON DELETE SET NULL;

ALTER TABLE user_gating_events
  ADD CONSTRAINT user_gating_events_target_xor
  CHECK ((route_id IS NOT NULL)::int + (trip_id IS NOT NULL)::int <= 1);

CREATE INDEX IF NOT EXISTS idx_gating_events_trip
  ON user_gating_events (user_id, feature, trip_id)
  WHERE trip_id IS NOT NULL;
```

**Add a follow-up migration to the backlog** (not 00125): once the legacy `routes` table is decommissioned, backfill `trip_id` from `routes.migrated_to_trip_id` (if such a backref exists), then drop `route_id`. This is documented tech debt, not a current blocker.

---

## Summary of changes to migration 00125

**Remove:**
- `CREATE TABLE route_suggestions` (~40 lines + 4 RLS policies + 3 indexes) → replaced by 4-line ALTER on existing `trip_suggestions`
- `trips.border_crossings JSONB` (speculative)
- `places.has_sufficient_routes BOOLEAN GENERATED` (encodes business rule in schema)

**Reconsider:**
- `places.editorial_md TEXT` → recommend MDX in `content/places/`, no DB column

**Keep:**
- `trips.elevation_profile JSONB` (necessary; consider stronger CHECK)
- `trips.best_season_months SMALLINT[]`
- `user_gating_events.trip_id UUID` (add CHECK XOR with `route_id`)
- `idx_trips_template_filters` partial index

**Net migration size:** drops from ~120 lines to ~30-40 lines. Net new tables: 0 instead of 1.

---

## Tech-debt impact

The plan as currently written would add the following long-lived tech debt:

| Debt item | Cost | If addressed in this PR |
|---|---|---|
| `route_suggestions` parallel to `trip_suggestions` | Two admin queues, two RLS policy sets, two resolver patterns, semantic confusion | Eliminated — single `trip_suggestions` table |
| `trips.border_crossings` unused JSONB column | Confusion in code review, in `SELECT *`, in generated types | Eliminated — add when v2 needs it |
| `places.has_sufficient_routes` hardcoded threshold | ALTER TABLE to change "8" to anything else | Eliminated — TS constant |
| `places.editorial_md` blocking i18n | Schema migration when first non-EN locale ships | Eliminated if Option C (MDX) is taken |
| `user_gating_events` dual FK | Survives until legacy routes decommissioning | Documented; XOR check prevents bad data |

The plan already does an excellent job avoiding most schema duplication (the `countries` table mistake was caught, `places.route_count` reuse was caught, `subscription_status` correction was applied). The remaining items above are the last 20% of the schema cleanup and they're all eliminable today.

---

## Other tech-debt observations (outside schema)

A few things noticed during the audit, low-priority but worth listing:

1. **`trip_share_tokens` already exists (00086)** with a token rotation RPC. The Track 2B builder share feature should reuse this directly, not invent a new tokenization. The architecture review I wrote earlier flagged "share-link durability is undefined" — actually it's defined; the plan just needs to point at it.

2. **`trip_waypoints.notes`** is capped at 1000 chars. If builder users want to attach long descriptions, this might bite. Worth a quick UX validation but not a blocker.

3. **`migrated_from_discover_trip_id`** on trips suggests the unification has historical scaffolding. Once the legacy `routes` table is dropped, this column becomes archaeology. Schedule a cleanup migration in the backlog.

4. **No `idx_places_route_count`** exists for the country-page sitemap query. If you take my advice to remove `has_sufficient_routes`, add a B-tree on `(kind, route_count)` to support `WHERE kind IN ('country','region') AND route_count >= 8`:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_places_kind_route_count
     ON places (kind, route_count)
     WHERE kind IN ('country','region');
   ```

---

## Appendix: full schema audit

Final effective schema after all 124 migrations, for the tables touched by this plan:

**`trips`** — 31 columns. Has: `polyline TEXT`, `elevation_gain_m INT` (total only), `surface_type TEXT`, `country_code TEXT`, `region_code TEXT`, `is_template BOOLEAN`, `is_flagged BOOLEAN`, `status TEXT`, `view_count BIGINT`, `clone_count BIGINT`, `average_rating FLOAT`, `review_count INT`, `start_point GEOGRAPHY`, `slug TEXT`, `day_count INT`, `migrated_from_discover_trip_id UUID`. No JSONB columns, no season columns, no per-point elevation.

**`trip_waypoints`** — `id, trip_id, sort_order, type, name, notes (TEXT ≤1000), lat, lng, created_at, day_index (00075, 0-based), period_of_day (00105)`.

**`trip_suggestions`** (00106) — full pending/accepted/rejected/withdrawn workflow with admin decision audit trail. **Reusable for the plan's "suggest a route" feature.**

**`trip_share_tokens`** (00086) — token rotation infrastructure already exists. **Reusable for builder shares.**

**`places`** (00093, 00122, 00124) — `id BIGINT (GeoNames), kind TEXT ('country'|'region'|'city'), name, country_code, region_code, latitude, longitude, population, search_tsv, route_count INT (00122)`. Maintained by `trg_sync_places_route_count`. No editorial/markdown/description columns.

**`user_gating_events`** (00101, 00102) — `id, user_id, feature TEXT, route_id UUID (FK routes ON DELETE SET NULL), created_at, year_month TEXT GENERATED`. Quota-tracking only.

Reviewer: Claude (sonnet)
