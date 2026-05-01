---
name: add-moto-routes
description: Autonomously adds 5–10 new motorcycle route templates to the MotoVault Supabase database. Queries existing coverage, selects the most underrepresented famous riding region from 8 priority destinations, and inserts real routes with verified GPS coordinates and properly structured multi-day waypoints. Trigger when asked to add routes, expand the route library, grow the trip database, run the daily route job, or populate routes for a specific country or region.
---

# Add Motorcycle Routes — Route Library Expansion

## Context
MotoVault is a motorcycle trip planning app backed by Supabase PostgreSQL.
- **Supabase Project ID:** `tpsoneenbrmdwvzcbifw`
- **MCP tool:** `mcp__36e8f95a-13f0-4b10-89a1-4a49a287e9be__execute_sql`
- **Organiser User ID:** `b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a`
- **Reference files:** `references/db-schema.md` · `references/regions/<region>.md` (one file per region, see `references/regions/_format.md`)

**Goal:** Insert 5–10 high-quality route templates per run across the world's most famous motorcycle destinations.

---

## Step 1 — Survey Existing Coverage

Run this first:

```sql
SELECT country_code, COUNT(*) AS routes,
  STRING_AGG(title, ' | ' ORDER BY title) AS titles
FROM trips
WHERE is_template = true
  AND organiser_user_id = 'b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a'
GROUP BY country_code
ORDER BY country_code;
```

Note which countries already have routes and how many. You will avoid inserting duplicate titles.

---

## Step 2 — Select Target Region(s)

Priority order (most famous → underrepresented gets chosen first):

| # | Region | Countries | Target routes |
|---|--------|-----------|---------------|
| 1 | Japan | JP | 6 |
| 2 | Australia | AU | 5 |
| 3 | India | IN | 4 |
| 4 | South America | AR, CL, BO | 4 |
| 5 | Morocco / North Africa | MA | 4 |
| 6 | Thailand / SE Asia | TH | 3 |
| 7 | South Africa | ZA | 4 |
| 8 | New Zealand | NZ | 4 |

> Targets reflect the count of routes available in `references/regions/<region>.md`. To exceed a target, use `WebSearch` for additional verified GPS coordinates.

- A region with **0 routes** gets priority over all others.
- Among equally-covered regions, follow the numbered order above.
- Per run, go deep into 1–2 regions (5–7 routes from one region is better than 1 from each).

---

## Step 3 — Source Routes

**Read only the file for your target region**, e.g. `references/regions/japan.md`, `references/regions/morocco.md`. Each per-region file is sized to fit a single `Read` call (the legacy combined file was >25k tokens — do NOT reintroduce it). The format is documented in `references/regions/_format.md`.

Use these as your primary source. Pick routes from the target region that are NOT already in the database (compare titles carefully).

**When the reference file is exhausted for a region**, use WebSearch:
- Search: `"best motorcycle roads [country/region]"`
- For GPS: `"[place name] latitude longitude"` — verify from 2+ sources
- Never use approximate or estimated coordinates. If unsure, search to confirm.

---

## Step 4 — Build Routes

For each route, assemble:
1. **Trip metadata** — title, **slug**, description, country_code, region_code, city, distance_m, day_count, difficulty, surface_type, elevation_gain_m, start_lat, start_lng, is_motovault_pick, average_rating, review_count, **published_at**
2. **Waypoints** — with correct day_index, sort_order, type, period_of_day, notes

> **Critical — non-negotiable.** Every template INSERT must set `published_at = NOW()` and a derived `slug`. Rows with NULL `published_at` are invisible to the `tripTemplates` GraphQL query (it orders by `published_at DESC` and uses it in cursor pagination). Rows with NULL `slug` cannot be deep-linked. Past silent failure: 79 seeded rows became ghosts in the DB until a manual backfill. See `references/db-schema.md` → "Slug Derivation" for the exact slug rules and worked examples.

**Multi-day structure (critical — get this right):**
```
Day 0 (day_index=0):  [start] ... stops ... [overnight]
Day 1 (day_index=1):  stops ... [overnight]   ← if 3+ day trip
Day N (day_index=N):  stops ... [end]          ← final day always ends with [end]
```
- `sort_order` is **globally sequential** across ALL days (never restarts per day)
- `day_index` is **0-based**
- Every overnight stop must be at a real town with accommodation
- Day distances should be realistic: 100–350 km/day on mountain roads

**Waypoint counts:**
- 1-day: 5–9 waypoints (start + 3-7 stops + end)
- 2-day: 8–14 waypoints
- 3-day: 12–20 waypoints

**Valid waypoint types:** `start` | `end` | `overnight` | `scenic` | `photo` | `food` | `fuel` | `pass_summit` | `ferry` | `mechanical` | `rally_point`

See `references/db-schema.md` for all valid values and the exact SQL CTE pattern.

---

## Step 5 — Insert

Use chained CTEs — one per trip + one for its waypoints. Each SQL call should insert 3–5 trips maximum to avoid statement length issues.

Example structure for two trips:
```sql
WITH
trip1 AS (INSERT INTO trips (...) VALUES (...) RETURNING id),
trip1_wp AS (INSERT INTO trip_waypoints ... SELECT trip1.id ...),
trip2 AS (INSERT INTO trips (...) VALUES (...) RETURNING id),
trip2_wp AS (INSERT INTO trip_waypoints ... SELECT trip2.id ...)
SELECT 'batch inserted' AS status;
```

For negative lat/lng (Southern/Western hemisphere), always wrap in parens:
`(-38.3374)::numeric` — NOT `-38.3374::numeric`

**SQL string-literal escaping.** Any apostrophe inside a description, name, or note must be doubled: `Chile's` → `'Chile''s'`, `world's` → `'world''s'`. Forgetting this breaks the entire CTE and rolls back every trip in the batch. Scan every string before submitting.

**Country code casing.** Use uppercase ISO 3166-1 alpha-2 (`JP`, `AU`, `MA`, `CL`) for `country_code`. Older rows in the DB use lowercase (`us`, `fr`, `it`); do not propagate that. The survey query in Step 1 splits results by case, so mixing them hides true coverage.

---

## Step 6 — Verify

```sql
SELECT title, country_code, day_count, slug, published_at IS NOT NULL AS is_published,
  (SELECT COUNT(*) FROM trip_waypoints WHERE trip_id = t.id) AS waypoints
FROM trips t
WHERE is_template = true
  AND organiser_user_id = 'b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

Every row must show: non-zero `waypoints`, a non-empty `slug`, and `is_published = true`. If any row has NULL `slug` or `is_published = false`, the route is a ghost — fix it immediately:

```sql
-- Backfill any ghost rows from the current run:
UPDATE trips SET published_at = NOW() WHERE id = '<id>' AND published_at IS NULL;
UPDATE trips SET slug = '<derived-slug>' WHERE id = '<id>' AND slug IS NULL;
```

Confirm each route appears with the expected waypoint count. If any has 0 waypoints, the waypoint CTE failed — re-run that batch.

---

## Quality Rules

- **No hallucinated GPS.** Use the reference file or web-searched coordinates only.
- **Meaningful waypoint notes.** Each note should tell a rider WHY the stop matters: history, fuel warning, food, timing advice, hazard, view. Not just the place name.
- **No duplicate titles.** Check the survey output from Step 1 before naming routes.
- **Variety per run.** Mix 1-day and multi-day. Mix easy/challenging. Mix paved/mixed.
- **Honest ratings.** Use 4.7–4.9 for iconic world-famous routes. 4.3–4.6 for great but lesser-known. review_count: 0 for newly added routes.
- **is_motovault_pick: true** only for genuinely bucket-list routes (Manali-Leh, Carretera Austral, Great Ocean Road, etc.)
