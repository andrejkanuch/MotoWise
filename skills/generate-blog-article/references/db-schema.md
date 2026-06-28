# Blog CMS — Schema & SQL Patterns

Supabase project `tpsoneenbrmdwvzcbifw`. Run all SQL via the `mcp__36e8f95a-13f0-4b10-89a1-4a49a287e9be__execute_sql` MCP tool. Escape apostrophes in SQL strings by doubling them (`owner's` → `owner''s`).

## Tables & key columns

### `blog_posts` (base row)
| column | type | notes |
|---|---|---|
| `id` | uuid | default `gen_random_uuid()` |
| `type` | text NOT NULL | **CHECK**: `guide` \| `maintenance` \| `trip` \| `gear` |
| `slug` | text NOT NULL UNIQUE | kebab-case, derived from title |
| `status` | text NOT NULL | **CHECK**: `draft` \| `published` \| `scheduled` (default `draft`) |
| `published_at` | timestamptz | set `now()` when publishing; `NULL` for drafts |
| `scheduled_for` | timestamptz | required only if status=`scheduled` |
| `author` | text | use `'MotoVault Editorial'` |
| `cover_image`, `cover_alt` | text | optional |
| `spec_data` | bool NOT NULL | **set `true` for maintenance/spec posts** → triggers the stronger disclaimer |
| `is_safety_critical` | bool NOT NULL | `true` for spec posts |

### `blog_post_translations` (PK `post_id` + `locale`)
| column | type | notes |
|---|---|---|
| `locale` | text NOT NULL | use `'en'` |
| `title` | text NOT NULL | |
| `excerpt` | text | ~150 chars |
| `seo_title`, `seo_description` | text | meta tags |
| `body_raw` | text NOT NULL | MDX source (GFM + `{/* */}` comments only) |
| `body_text` | text NOT NULL | plain-text strip of body_raw (for full-text search) |
| `keyword_text` | text NOT NULL | space-joined keyword names (denormalized for FTS) |
| `faq` | jsonb NOT NULL | array of `{"question":"…","answer":"…"}` (default `[]`) |
| `reading_time` | text | e.g. `'8 min'` |
| `word_count` | int | |
| `search_vector` | tsvector | **trigger-maintained — never set** |

### Per-type rows (PK `post_id`)
- `blog_post_guide`: `difficulty` (CHECK: `beginner`\|`intermediate`\|`advanced`\| NULL), `meta` jsonb.
- `blog_post_maintenance`: `make`, `model`, `variant`, `dataset_models` text[], `applicable_models` text[], `meta` jsonb.

### Taxonomy
- `categories` (existing slugs — reuse, do NOT invent): `brand-guide`, `comparison`, `cost`, `diagnostics`, `diy`, `guides`, `maintenance`, `routes`, `seasonal`, `touring`, `troubleshooting`.
- `keywords` (`slug`, `name`) — create missing ones.
- `blog_post_categories` (`post_id`, `category_id`, `is_primary`).
- `blog_post_keywords` (`post_id`, `keyword_id`).

### `maintenance_data_sources` (SPEC provenance)
`source_type` (CHECK: `owner_manual` \| `service_manual` \| `community`), `title` NOT NULL, `edition_language`, `market_applicability`, `reference`, `source_url`, `retrieved_at`.

## Insert pattern (GUIDE, auto-published)

```sql
WITH new_post AS (
  INSERT INTO blog_posts (type, slug, status, published_at, author, spec_data, is_safety_critical)
  VALUES ('guide', 'mt-09-service-intervals', 'published', now(), 'MotoVault Editorial', false, false)
  ON CONFLICT (slug) DO UPDATE SET status='published', published_at=COALESCE(blog_posts.published_at, now()), updated_at=now()
  RETURNING id
),
guide AS (
  INSERT INTO blog_post_guide (post_id, difficulty)
  SELECT id, 'intermediate' FROM new_post
  ON CONFLICT (post_id) DO UPDATE SET difficulty=EXCLUDED.difficulty
  RETURNING post_id
),
tr AS (
  INSERT INTO blog_post_translations
    (post_id, locale, title, excerpt, seo_title, seo_description, body_raw, body_text, keyword_text, faq, reading_time, word_count)
  SELECT id, 'en',
    'Yamaha MT-09 Service Intervals & Oil Change Schedule',
    'When to service a Yamaha MT-09 — oil, valves, and costs, with metric and imperial figures.',
    'Yamaha MT-09 Service Intervals & Oil Change Schedule',
    'Yamaha MT-09 service schedule: oil every 6,000 km, valve checks, and what each service costs. Verify against your owner''s manual.',
    $body$<MDX BODY HERE>$body$,
    $txt$<PLAIN TEXT HERE>$txt$,
    'mt-09 service intervals oil change schedule yamaha maintenance',
    '[{"question":"How often does an MT-09 need an oil change?","answer":"…"}]'::jsonb,
    '8 min', 1500
  FROM new_post
  ON CONFLICT (post_id, locale) DO UPDATE SET
    title=EXCLUDED.title, excerpt=EXCLUDED.excerpt, seo_title=EXCLUDED.seo_title,
    seo_description=EXCLUDED.seo_description, body_raw=EXCLUDED.body_raw, body_text=EXCLUDED.body_text,
    keyword_text=EXCLUDED.keyword_text, faq=EXCLUDED.faq, reading_time=EXCLUDED.reading_time,
    word_count=EXCLUDED.word_count, updated_at=now()
  RETURNING post_id
),
cat AS (
  INSERT INTO blog_post_categories (post_id, category_id, is_primary)
  SELECT np.id, c.id, true FROM new_post np, categories c WHERE c.slug='maintenance'
  ON CONFLICT DO NOTHING
  RETURNING post_id
)
SELECT id FROM new_post;
```

Use `$body$ … $body$` dollar-quoting for the long MDX so you don't have to escape quotes inside it.

### Keywords (run after the post exists)
```sql
WITH kw AS (
  INSERT INTO keywords (slug, name) VALUES
    ('mt-09-service-intervals','mt-09 service intervals'),
    ('yamaha-maintenance','yamaha maintenance')
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
  RETURNING id
)
INSERT INTO blog_post_keywords (post_id, keyword_id)
SELECT (SELECT id FROM blog_posts WHERE slug='mt-09-service-intervals'), id FROM kw
ON CONFLICT DO NOTHING;
```

## Insert pattern (SPEC, draft for verification)
Same as GUIDE but:
- `type='maintenance'`, `status='draft'`, `published_at=NULL`, `spec_data=true`, `is_safety_critical=true`.
- Use `blog_post_maintenance` instead of `blog_post_guide`:
```sql
INSERT INTO blog_post_maintenance (post_id, make, model, variant, dataset_models, applicable_models)
SELECT id, 'YAMAHA', 'MT-09', NULL, ARRAY['YAMAHA/MT-09'], ARRAY['YAMAHA/MT-09'] FROM new_post
ON CONFLICT (post_id) DO UPDATE SET make=EXCLUDED.make, model=EXCLUDED.model;
```
- Record each manual in `maintenance_data_sources`:
```sql
INSERT INTO maintenance_data_sources (source_type, title, edition_language, market_applicability, reference, source_url)
VALUES ('owner_manual', 'Yamaha MT-09 Owner''s Manual 2024', 'English', 'EU', 'B7N-F8199-E0', 'https://…')
RETURNING id;
```

## Idempotency
Everything upserts on natural keys (`slug`, `(post_id,locale)`, `post_id`). Re-running for the same slug updates in place — safe.
