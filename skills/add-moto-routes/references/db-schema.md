# MotoVault DB Schema Reference

## Connection
- **Supabase Project ID:** `tpsoneenbrmdwvzcbifw`
- **MCP Tool:** `mcp__36e8f95a-13f0-4b10-89a1-4a49a287e9be__execute_sql`
- **Organiser User ID:** `b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a`

---

## Valid Enum Values

### trips.difficulty
`easy` | `moderate` | `challenging` | `expert`

### trips.surface_type
`paved` | `mixed` | `off-road` | `unknown`

### trips.status / visibility
Always use: `status = 'active'`, `visibility = 'public'`

### trip_waypoints.type
`start` | `end` | `overnight` | `scenic` | `photo` | `food` | `fuel` | `pass_summit` | `ferry` | `mechanical` | `rally_point`

### trip_waypoints.period_of_day
`morning` | `afternoon` | `evening` | `night`

---

## Template Trip Fixed Values
Every template uses these exact values:
```
start_date:        '1970-01-01'
end_date:          '1970-01-01'
dates_pending:     true
is_template:       true
status:            'active'
visibility:        'public'
max_riders:        50
participant_count: 1
review_count:      0          (for new routes — no reviews yet)
published_at:      NOW()      ← REQUIRED. NULL templates are invisible to the
                                 listTemplates GraphQL query (orders by
                                 published_at DESC and uses it in the cursor).
                                 Past silent failure: 79 seeded rows were
                                 ghosts in the DB until backfilled.
slug:              <derived>  ← REQUIRED. UNIQUE per (country_code,
                                 region_code, slug) for templates. Used as
                                 the SEO URL key. See "Slug Derivation" below.
```

---

## Slug Derivation

Slugs are derived from `title` using these rules (matches the existing 107
template rows in production — keep this consistent):

1. Lowercase the title.
2. **Strip** all non-ASCII characters entirely (e.g. `Dadès` → `dads`,
   `Tichka` → `tichka`). Do not transliterate (`è` does NOT become `e`).
3. **Strip** apostrophes (e.g. `Chile's` → `chiles`, `n'Tichka` → `ntichka`).
4. Replace any remaining run of non-`[a-z0-9]` characters with a single `-`.
5. Trim leading/trailing `-`.

Examples (all already in the DB):

| title                                                  | slug                                              |
|--------------------------------------------------------|---------------------------------------------------|
| `Carretera Austral — Chile's Southern Highway`         | `carretera-austral-chiles-southern-highway`       |
| `Tizi n'Tichka & Draa Valley — Marrakech to Zagora`    | `tizi-ntichka-draa-valley-marrakech-to-zagora`    |
| `Todra & Dadès Gorges Circuit`                         | `todra-dads-gorges-circuit`                       |
| `Anti-Atlas — Taroudant to Tiznit Coast Road`          | `anti-atlas-taroudant-to-tiznit-coast-road`       |

When generating SQL, derive the slug yourself and hardcode it as a string
literal — do not rely on an INSERT trigger (there isn't one).

---

## distance_m Convention
Store in **metres**: 60 km = `60000`, 305 km = `305000`

---

## Quick Reference: Pattern Selection

Single-day and multi-day trips use slightly different SQL shapes. Pick the right one:

| Aspect                    | Single-day                                        | Multi-day                                           |
|---------------------------|---------------------------------------------------|-----------------------------------------------------|
| `day_count`               | `1`                                               | `2`, `3`, …                                         |
| `VALUES` tuple columns    | `(name, lat, lng, type, so, pod, notes)`          | `(name, lat, lng, type, so, di, pod, notes)`        |
| `day_index` source        | hardcoded `0` in `SELECT`                         | `w.di` from each tuple                              |
| `overnight` waypoints     | none (only `start` … `end`)                       | one per day except final day                        |
| Final waypoint type       | `end`                                             | `end` (only on the last day)                        |
| `sort_order`              | `1..N` (single sequence)                          | `1..N` globally — never restarts per day            |

**Do not mix shapes inside one chained-CTE batch.** If you have one single-day and one multi-day trip in the same SQL call, each gets its own `VALUES (…)` block matching the table above.

---

## SQL Pattern — Single-Day Trip

```sql
WITH
trip_alias AS (
  INSERT INTO trips (
    organiser_user_id, title, slug, description, country_code, region_code, city,
    start_date, end_date, dates_pending, is_template, is_motovault_pick,
    day_count, distance_m, elevation_gain_m, difficulty, surface_type,
    average_rating, review_count, start_lat, start_lng,
    status, visibility, max_riders, participant_count, published_at
  ) VALUES (
    'b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a',
    'Route Title', 'route-title', 'Route description.',
    'JP', 'JP-01', 'Biei',
    '1970-01-01', '1970-01-01', true, true, true,
    1, 60000, 450, 'easy', 'paved',
    4.7, 0, 43.5933, 142.4640,
    'active', 'public', 50, 1, NOW()
  ) RETURNING id
),
trip_alias_wp AS (
  INSERT INTO trip_waypoints
    (trip_id, name, lat, lng, type, sort_order, day_index, period_of_day, notes)
  SELECT trip_alias.id, w.name, w.lat, w.lng, w.type, w.so, 0, w.pod, w.notes
  FROM trip_alias, (VALUES
    ('Start Town', 43.5933::numeric, 142.4640::numeric, 'start',   1, 'morning',   'Start here. Fuel up before heading out.'),
    ('Scenic Stop', 43.5700::numeric, 142.4353::numeric, 'scenic', 2, 'morning',   'Classic panorama viewpoint.'),
    ('Food Stop',   43.5343::numeric, 142.3897::numeric, 'food',   3, 'afternoon', 'Best local restaurant on route.'),
    ('End Town',    43.3504::numeric, 142.3834::numeric, 'end',    4, 'afternoon', 'End of route.')
  ) AS w(name, lat, lng, type, so, pod, notes)
)
SELECT 'Route Title inserted' AS status;
```

---

## SQL Pattern — Multi-Day Trip

For multi-day, add a `di` column to VALUES for day_index:

```sql
WITH
trip_alias AS (
  INSERT INTO trips (
    organiser_user_id, title, slug, description, country_code, region_code, city,
    start_date, end_date, dates_pending, is_template, is_motovault_pick,
    day_count, distance_m, elevation_gain_m, difficulty, surface_type,
    average_rating, review_count, start_lat, start_lng,
    status, visibility, max_riders, participant_count, published_at
  ) VALUES (
    'b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a',
    'Multi-Day Title', 'multi-day-title', 'Description.',
    'AU', 'AU-VIC', 'Torquay',
    '1970-01-01', '1970-01-01', true, true, true,
    2, 430000, 1200, 'moderate', 'paved',
    4.8, 0, (-38.3374)::numeric, 144.3238::numeric,
    'active', 'public', 50, 1, NOW()
  ) RETURNING id
),
trip_alias_wp AS (
  INSERT INTO trip_waypoints
    (trip_id, name, lat, lng, type, sort_order, day_index, period_of_day, notes)
  SELECT trip_alias.id, w.name, w.lat, w.lng, w.type, w.so, w.di, w.pod, w.notes
  FROM trip_alias, (VALUES
    -- Day 0
    ('Torquay',       (-38.3374)::numeric, 144.3238::numeric, 'start',     1, 0, 'morning',   'Start here.'),
    ('Lorne',         (-38.5405)::numeric, 143.9838::numeric, 'scenic',    2, 0, 'morning',   'Beautiful coastal town.'),
    ('Apollo Bay',    (-38.7558)::numeric, 143.6719::numeric, 'overnight', 3, 0, 'evening',   'Overnight in Apollo Bay.'),
    -- Day 1
    ('Twelve Apostles',(-38.6643)::numeric,143.1045::numeric, 'photo',    4, 1, 'morning',   'Iconic limestone stacks.'),
    ('Warrnambool',   (-38.3827)::numeric, 142.4877::numeric, 'end',       5, 1, 'afternoon', 'End of route.')
  ) AS w(name, lat, lng, type, so, di, pod, notes)
)
SELECT 'Multi-Day Title inserted' AS status;
```

---

## Chaining Multiple Trips in One SQL Call

```sql
WITH
trip1 AS (INSERT INTO trips (...) VALUES (...) RETURNING id),
trip1_wp AS (INSERT INTO trip_waypoints ... SELECT trip1.id, w.* FROM trip1, (VALUES ...) AS w(...)),
trip2 AS (INSERT INTO trips (...) VALUES (...) RETURNING id),
trip2_wp AS (INSERT INTO trip_waypoints ... SELECT trip2.id, w.* FROM trip2, (VALUES ...) AS w(...))
SELECT 'batch N inserted' AS status;
```

**Max 4–5 trips per SQL call** to keep statement size manageable.

---

## Negative Coordinates (Southern / Western Hemisphere)

**Always wrap in parentheses:**
```sql
(-38.3374)::numeric   ✅  Southern hemisphere (Australia, NZ, SA, Patagonia)
(-7.9811)::numeric    ✅  Western hemisphere (Morocco, Americas)
-38.3374::numeric     ❌  This is parsed as -(38.3374::numeric) — works but is ambiguous
```

---

## Region Code Conventions

Use ISO 3166-2 for region codes where possible:
- `JP-01` (Hokkaido), `JP-22` (Shizuoka/Izu), `JP-17` (Ishikawa/Noto), `JP-19` (Yamanashi)
- `AU-VIC`, `AU-NSW`, `AU-WA`, `AU-TAS`, `AU-QLD`
- `IN-HP` (Himachal Pradesh), `IN-LA` (Ladakh), `IN-RJ` (Rajasthan), `IN-KA` (Karnataka)
- `AR-RN` (Río Negro/Bariloche), `AR-Z` (Santa Cruz/Patagonia), `CL-LL` (Los Lagos), `CL-AI` (Aysén/Carretera)
- `MA-05` (Marrakech-Safi), `MA-08` (Drâa-Tafilalet), `MA-04` (Fès-Meknès)
- `TH-50` (Chiang Mai), `TH-57` (Chiang Rai / Mae Hong Son area)
- `ZA-WC` (Western Cape), `ZA-KZN` (KwaZulu-Natal)
- `NZ-OTA` (Otago/Milford), `NZ-CAN` (Canterbury/Arthur's Pass, Mackenzie), `NZ-WKO` (Waikato/Coromandel)
