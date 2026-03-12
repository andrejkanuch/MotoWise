# MotoVault Schema Design

## 1. Executive Summary

**Stack:** Supabase (PostgreSQL 15) + NestJS 11 (GraphQL code-first) + Expo 55 (mobile) + Next.js 16 (admin)

**Principles:**
- Supabase migrations are the single source of truth for all schema
- All primary keys are UUID via `gen_random_uuid()`
- Row Level Security (RLS) on every table, no exceptions
- Snake_case in SQL, camelCase in TypeScript/GraphQL -- mapped at the NestJS service layer
- JSONB for semi-structured data (preferences, quiz answers, diagnostic results)
- Soft deletes only where business logic requires undo (motorcycles); hard deletes + CASCADE everywhere else
- No ORM -- raw Supabase client with generated types

**Type Pipeline:**
```
SQL migration
  -> supabase gen types (database.types.ts)
    -> Zod schemas (@motovault/types)
      -> NestJS @ObjectType() (GraphQL code-first)
        -> GraphQL codegen (TypedDocumentNode for clients)
```

---

## 2. Migration Workflow

Migrations live in `supabase/migrations/` and are numbered sequentially.

**Creating a new migration:**
```bash
pnpm db:migration add_maintenance_tables
# Edit the generated file in supabase/migrations/
```

**Applying locally:**
```bash
pnpm db:reset          # Drops, recreates, runs all migrations + seed
```

**Regenerating types after schema change:**
```bash
pnpm generate:types    # supabase gen types -> packages/types/src/database.types.ts
pnpm generate          # Full pipeline: DB types + GraphQL schema + client codegen
```

**Update sequence when modifying data models:**
1. Write or update the Supabase migration SQL
2. `pnpm db:reset` to apply
3. `pnpm generate:types` to update `database.types.ts`
4. Update Zod schemas in `packages/types` to match
5. Update NestJS models/resolvers
6. `pnpm generate` for full pipeline

**Current migrations:**
| # | File | Purpose |
|---|------|---------|
| 1 | `00001_types_and_extensions.sql` | Enums, pg_trgm, uuid-ossp |
| 2 | `00002_tables_and_constraints.sql` | All 9 core tables + constraints |
| 3 | `00003_rls_indexes_triggers_storage.sql` | RLS policies, indexes, triggers, storage bucket |
| 4 | `00004_fix_rls_role_escalation.sql` | Prevent users from self-promoting via UPDATE |
| 5 | `00005_enrich_motorcycles_users_articles.sql` | motorcycle_type enum, new columns on motorcycles/users/articles |
| 6 | `00006_content_generation_log.sql` | AI usage tracking table |

---

## 3. Enums & Types

```sql
CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE article_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TYPE article_category AS ENUM (
  'engine', 'brakes', 'electrical', 'suspension',
  'drivetrain', 'tires', 'fuel', 'general'
);

CREATE TYPE diagnostic_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

CREATE TYPE motorcycle_type AS ENUM (
  'cruiser', 'sportbike', 'standard', 'touring',
  'dual_sport', 'dirt_bike', 'scooter', 'other'
);
```

---

## 4. Core Tables (MVP -- Implemented)

### 4.1 users

Extends `auth.users`. Created automatically via trigger on signup.

```sql
CREATE TABLE public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  role       user_role NOT NULL DEFAULT 'user',
  preferences JSONB DEFAULT '{}',
  avatar_url TEXT,
  years_riding INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Trigger:** `set_updated_at` -- auto-updates `updated_at` on every UPDATE.

**Trigger:** `on_auth_user_created` -- inserts a `public.users` row when `auth.users` gets a new signup.

**RLS:**
```sql
CREATE POLICY "Users read own data"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own data" ON public.users FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Admins read all users" ON public.users FOR SELECT USING (public.is_admin());
```

### 4.2 motorcycles

```sql
CREATE TABLE public.motorcycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  make              TEXT NOT NULL,
  model             TEXT NOT NULL,
  year              INTEGER NOT NULL CHECK (year >= 1900),
  nickname          TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  type              motorcycle_type,
  vin               VARCHAR(17),
  current_mileage   INTEGER DEFAULT 0,
  mileage_unit      VARCHAR(2) DEFAULT 'mi' CHECK (mileage_unit IN ('mi', 'km')),
  engine_cc         INTEGER,
  primary_photo_url TEXT,
  purchase_date     DATE,
  deleted_at        TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_motorcycles_user_id ON public.motorcycles (user_id);
CREATE INDEX idx_motorcycles_type ON public.motorcycles (type) WHERE type IS NOT NULL;
CREATE INDEX idx_motorcycles_vin ON public.motorcycles (vin) WHERE vin IS NOT NULL;
CREATE UNIQUE INDEX idx_motorcycles_one_primary_per_user ON public.motorcycles (user_id) WHERE is_primary = true;
CREATE UNIQUE INDEX idx_motorcycles_user_vin_active ON public.motorcycles (user_id, vin) WHERE vin IS NOT NULL AND deleted_at IS NULL;
```

**RLS:**
```sql
CREATE POLICY "Users own motorcycles" ON public.motorcycles FOR ALL USING (auth.uid() = user_id);
```

### 4.3 articles

```sql
CREATE TABLE public.articles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  raw_text           TEXT NOT NULL DEFAULT '',
  difficulty         article_difficulty NOT NULL DEFAULT 'beginner',
  category           article_category NOT NULL DEFAULT 'general',
  content_json       JSONB NOT NULL,
  search_vector      TSVECTOR GENERATED ALWAYS AS (
                       to_tsvector('english', title || ' ' || raw_text)
                     ) STORED,
  view_count         INTEGER NOT NULL DEFAULT 0,
  flag_count         INTEGER NOT NULL DEFAULT 0,
  version            INTEGER NOT NULL DEFAULT 1,
  is_hidden          BOOLEAN NOT NULL DEFAULT false,
  is_safety_critical BOOLEAN NOT NULL DEFAULT false,
  summary            TEXT,
  read_time_minutes  SMALLINT,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  is_seed_content    BOOLEAN NOT NULL DEFAULT false,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Trigger:** `set_updated_at` on UPDATE.

**Indexes:**
```sql
CREATE INDEX idx_articles_search     ON public.articles USING GIN (search_vector);
CREATE INDEX idx_articles_category   ON public.articles (category)   WHERE is_hidden = false;
CREATE INDEX idx_articles_difficulty ON public.articles (difficulty)  WHERE is_hidden = false;
CREATE INDEX idx_articles_verified   ON public.articles (is_verified) WHERE is_verified = true;
```

**RLS:**
```sql
CREATE POLICY "Anyone reads visible articles" ON public.articles FOR SELECT USING (is_hidden = false);
CREATE POLICY "Admins manage articles"        ON public.articles FOR ALL   USING (public.is_admin());
```

### 4.4 quizzes

One quiz per article (1:1 via UNIQUE FK).

```sql
CREATE TABLE public.quizzes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL UNIQUE REFERENCES public.articles(id) ON DELETE CASCADE,
  questions_json JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:**
```sql
CREATE POLICY "Anyone reads quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Admins manage quizzes" ON public.quizzes FOR ALL USING (public.is_admin());
```

### 4.5 quiz_attempts

```sql
CREATE TABLE public.quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id         UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  answers_json    JSONB NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (score <= total_questions)
);
```

**Indexes:**
```sql
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
```

**RLS:**
```sql
CREATE POLICY "Users own quiz attempts"  ON public.quiz_attempts FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Admins read quiz attempts" ON public.quiz_attempts FOR SELECT USING (public.is_admin());
```

### 4.6 diagnostics

```sql
CREATE TABLE public.diagnostics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id         UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  result_json           JSONB NOT NULL,
  wizard_answers        JSONB,
  severity              diagnostic_severity,
  confidence            REAL CHECK (confidence >= 0 AND confidence <= 1),
  related_article_id    UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  data_sharing_opted_in BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_diagnostics_user_id       ON public.diagnostics (user_id);
CREATE INDEX idx_diagnostics_motorcycle_id ON public.diagnostics (motorcycle_id);
```

**RLS:**
```sql
CREATE POLICY "Users own diagnostics"  ON public.diagnostics FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Admins read diagnostics" ON public.diagnostics FOR SELECT USING (public.is_admin());
```

### 4.7 diagnostic_photos

```sql
CREATE TABLE public.diagnostic_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id     UUID NOT NULL REFERENCES public.diagnostics(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  original_filename TEXT,
  file_size_bytes   INTEGER CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_diagnostic_photos_diagnostic_id ON public.diagnostic_photos (diagnostic_id);
```

**RLS (ownership via diagnostic join):**
```sql
CREATE POLICY "Users own diagnostic photos" ON public.diagnostic_photos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.diagnostics
    WHERE diagnostics.id = diagnostic_photos.diagnostic_id
      AND diagnostics.user_id = auth.uid()
  )
);
CREATE POLICY "Admins read diagnostic photos" ON public.diagnostic_photos FOR SELECT USING (public.is_admin());
```

**Storage bucket:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('diagnostic-photos', 'diagnostic-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Policies: user-scoped via folder name matching auth.uid()
CREATE POLICY "Users upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'diagnostic-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins access all photos" ON storage.objects
  FOR ALL USING (bucket_id = 'diagnostic-photos' AND public.is_admin());
```

### 4.8 content_flags

```sql
CREATE TABLE public.content_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_reference TEXT,
  comment           TEXT NOT NULL,
  status            flag_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_content_flags_article_id ON public.content_flags (article_id);
CREATE INDEX idx_content_flags_status     ON public.content_flags (status);
```

**RLS:**
```sql
CREATE POLICY "Users create flags"  ON public.content_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own flags" ON public.content_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage flags" ON public.content_flags FOR ALL    USING (public.is_admin());
```

### 4.9 learning_progress

```sql
CREATE TABLE public.learning_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  article_read   BOOLEAN NOT NULL DEFAULT false,
  quiz_completed BOOLEAN NOT NULL DEFAULT false,
  quiz_best_score INTEGER,
  first_read_at  TIMESTAMPTZ,
  last_read_at   TIMESTAMPTZ,
  UNIQUE (user_id, article_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_learning_progress_user_id    ON public.learning_progress (user_id);
CREATE INDEX idx_learning_progress_article_id ON public.learning_progress (article_id);
```

**RLS:**
```sql
CREATE POLICY "Users own progress"  ON public.learning_progress FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Admins read progress" ON public.learning_progress FOR SELECT USING (public.is_admin());
```

### 4.10 content_generation_log

Tracks all AI API calls (articles, quizzes, diagnostic responses). Inserts happen via service role only.

```sql
CREATE TABLE public.content_generation_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_type  TEXT NOT NULL,           -- 'article', 'quiz', 'diagnostic_response'
  content_id    UUID,                    -- Polymorphic FK (not enforced)
  input_tokens  INTEGER,
  output_tokens INTEGER,
  model         TEXT,                    -- e.g., 'claude-sonnet-4-5-20250514'
  cost_cents    INTEGER,
  status        TEXT NOT NULL DEFAULT 'success',  -- 'success', 'failed', 'rate_limited'
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_content_gen_log_user_id      ON public.content_generation_log (user_id);
CREATE INDEX idx_content_gen_log_content_type ON public.content_generation_log (content_type);
CREATE INDEX idx_content_gen_log_created_at   ON public.content_generation_log (created_at DESC);
```

**RLS:**
```sql
CREATE POLICY "Users read own generation logs"  ON public.content_generation_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all generation logs" ON public.content_generation_log FOR SELECT USING (public.is_admin());
-- No INSERT policy: inserts happen via service role (bypasses RLS)
```

### Helper Function

```sql
CREATE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Used in RLS policies to check admin status without granting users read access to other users' roles.

---

## 5. P1 Features (Future)

### 5.1 maintenance_tasks

Reference table for standard maintenance items per motorcycle type.

```sql
CREATE TABLE public.maintenance_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  motorcycle_type  motorcycle_type,          -- NULL = universal
  interval_miles   INTEGER,
  interval_months  INTEGER,
  is_critical      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 maintenance_events

User-logged maintenance on their motorcycles.

```sql
CREATE TABLE public.maintenance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id   UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL,
  description     TEXT,
  mileage_at      INTEGER,
  cost_cents      INTEGER,
  performed_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_events_user ON public.maintenance_events (user_id);
CREATE INDEX idx_maintenance_events_moto ON public.maintenance_events (motorcycle_id);
CREATE INDEX idx_maintenance_events_date ON public.maintenance_events (performed_at DESC);
```

### 5.3 motorcycle_health_metrics

Computed/cached health scores per motorcycle.

```sql
CREATE TABLE public.motorcycle_health_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id   UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  health_score    SMALLINT CHECK (health_score >= 0 AND health_score <= 100),
  overdue_tasks   INTEGER NOT NULL DEFAULT 0,
  last_service_at DATE,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (motorcycle_id)
);
```

### 5.4 expenses

Financial tracking for motorcycle ownership.

```sql
CREATE TABLE public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id   UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,        -- 'fuel', 'maintenance', 'insurance', 'parts', 'gear', 'other'
  amount_cents    INTEGER NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  description     TEXT,
  occurred_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_user ON public.expenses (user_id);
CREATE INDEX idx_expenses_moto ON public.expenses (motorcycle_id);
CREATE INDEX idx_expenses_date ON public.expenses (occurred_at DESC);
```

### 5.5 usage_counters

Track per-user daily usage of AI features for rate limiting.

```sql
CREATE TABLE public.usage_counters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  counter_key TEXT NOT NULL,            -- 'diagnostics', 'article_generation'
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  count       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, counter_key, date)
);

CREATE INDEX idx_usage_counters_user_date ON public.usage_counters (user_id, date);
```

### 5.6 article_versions

Immutable history of article content changes.

```sql
CREATE TABLE public.article_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  raw_text     TEXT NOT NULL,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version)
);

CREATE INDEX idx_article_versions_article ON public.article_versions (article_id, version DESC);
```

### 5.7 article_regeneration_queue

Queue for AI-powered article regeneration requests.

```sql
CREATE TABLE public.article_regeneration_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_regen_queue_status ON public.article_regeneration_queue (status) WHERE status = 'pending';
```

### 5.8 article_bookmarks

```sql
CREATE TABLE public.article_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, article_id)
);

CREATE INDEX idx_bookmarks_user ON public.article_bookmarks (user_id);
```

### 5.9 pre_ride_checklists

User-completed pre-ride safety checklists.

```sql
CREATE TABLE public.pre_ride_checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  items_json    JSONB NOT NULL,          -- Array of { item, checked, note? }
  all_passed    BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklists_user ON public.pre_ride_checklists (user_id);
CREATE INDEX idx_checklists_moto ON public.pre_ride_checklists (motorcycle_id);
```

---

## 6. P2 Features (Future)

### 6.1 Forum Tables

Community discussion boards.

```sql
CREATE TABLE public.forum_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.forum_replies (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 OBD-II Integration

Store readings from Bluetooth OBD-II adapters.

```sql
CREATE TABLE public.obd_readings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  dtc_codes     TEXT[],                 -- e.g., ARRAY['P0301', 'P0420']
  pid_data      JSONB,                  -- Raw PID key-value data
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_obd_readings_moto ON public.obd_readings (motorcycle_id, recorded_at DESC);
```

### 6.3 Parts Marketplace

User-to-user parts listings.

```sql
CREATE TABLE public.parts_listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  price_cents   INTEGER NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  condition     TEXT NOT NULL,          -- 'new', 'like_new', 'used', 'for_parts'
  motorcycle_make  TEXT,
  motorcycle_model TEXT,
  photos_json   JSONB DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active', 'sold', 'removed'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parts_listings_seller ON public.parts_listings (seller_id);
CREATE INDEX idx_parts_listings_status ON public.parts_listings (status) WHERE status = 'active';
```

### 6.4 article_translations

Localized versions of articles.

```sql
CREATE TABLE public.article_translations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  locale       VARCHAR(5) NOT NULL,     -- 'es', 'de', 'fr', 'ja', etc.
  title        TEXT NOT NULL,
  raw_text     TEXT NOT NULL,
  content_json JSONB NOT NULL,
  translated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, locale)
);

CREATE INDEX idx_translations_locale ON public.article_translations (locale);
```

---

## 7. Indexing Strategy

**Rules applied across all tables:**

| Category | Strategy |
|----------|----------|
| Foreign keys | B-tree index on every FK column (Postgres does not auto-index FKs) |
| Full-text search | GIN index on `search_vector` TSVECTOR column |
| Filtered queries | Partial indexes with `WHERE` clause (e.g., `WHERE is_hidden = false`, `WHERE status = 'pending'`) |
| Unique constraints | Partial unique indexes for business rules (one primary motorcycle per user, one VIN per active motorcycle per user) |
| Time-ordered queries | Descending indexes on timestamp columns used in ORDER BY (e.g., `created_at DESC`) |
| Enum columns | Indexes on enum columns commonly used in WHERE clauses (category, difficulty, status) |

**Existing indexes (MVP):**

| Table | Index | Type |
|-------|-------|------|
| articles | `search_vector` | GIN |
| articles | `category WHERE is_hidden = false` | B-tree partial |
| articles | `difficulty WHERE is_hidden = false` | B-tree partial |
| articles | `is_verified WHERE is_verified = true` | B-tree partial |
| motorcycles | `user_id` | B-tree |
| motorcycles | `type WHERE type IS NOT NULL` | B-tree partial |
| motorcycles | `vin WHERE vin IS NOT NULL` | B-tree partial |
| motorcycles | `(user_id) WHERE is_primary = true` | Unique partial |
| motorcycles | `(user_id, vin) WHERE vin IS NOT NULL AND deleted_at IS NULL` | Unique partial |
| diagnostics | `user_id`, `motorcycle_id` | B-tree |
| quiz_attempts | `user_id`, `quiz_id` | B-tree |
| learning_progress | `user_id`, `article_id` | B-tree |
| content_flags | `article_id`, `status` | B-tree |
| diagnostic_photos | `diagnostic_id` | B-tree |
| content_generation_log | `user_id`, `content_type`, `created_at DESC` | B-tree |

---

## 8. Design Decisions

### UUID vs BIGSERIAL

UUIDs are used for all primary keys. Rationale:
- Supabase `auth.users` uses UUID; `public.users.id` must match
- Safe for client-side generation (no sequential ID leakage)
- Merge-friendly across environments (no collision between dev/staging/prod seeds)
- Slight storage overhead (16 bytes vs 8) is acceptable at our scale

### GENERATED ALWAYS AS vs Triggers for search_vector

```sql
search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('english', title || ' ' || raw_text)
) STORED
```

Advantages over trigger-based approach:
- Cannot get out of sync (computed by the database engine on every write)
- No trigger function to maintain
- Declared inline with the column definition
- Automatically updated on `INSERT`, `UPDATE`, and `COPY`

### JSONB vs Normalization

JSONB is used where the schema is:
- **Variable per record:** `preferences`, `metadata`, `wizard_answers`
- **Opaque to SQL queries:** `content_json` (rendered by clients, not filtered), `questions_json`, `answers_json`
- **Costly to normalize:** `result_json` (diagnostic results have variable structure per diagnostic type)

Normalization is used where:
- Data is queried/filtered frequently (category, difficulty, severity)
- Referential integrity matters (user_id, motorcycle_id, article_id)
- Unique constraints are needed (slug, user+article progress)

### Soft Deletes

Only `motorcycles` uses soft delete (`deleted_at TIMESTAMPTZ`). Rationale:
- Diagnostics reference motorcycles; deleting breaks history
- Users may want to restore accidentally deleted bikes
- All other tables use hard delete with `ON DELETE CASCADE`

### Denormalization

Denormalized counters are used sparingly:
- `articles.view_count` -- avoids counting a views table on every page load
- `articles.flag_count` -- enables quick admin dashboard queries
- `learning_progress` -- single row per user+article avoids aggregation queries

These counters are updated atomically via `UPDATE SET view_count = view_count + 1`.

### RLS Strategy

Every table has RLS enabled. The pattern is consistent:
- **User-owned tables:** `auth.uid() = user_id` for all operations
- **Public-read tables:** `FOR SELECT USING (true)` or conditional (`is_hidden = false`)
- **Admin access:** Via `public.is_admin()` SECURITY DEFINER function
- **Indirect ownership:** JOIN-based policies (diagnostic_photos checks diagnostic ownership)
- **Role escalation prevention:** `WITH CHECK` ensures users cannot modify their own `role` column

The `is_admin()` function is `SECURITY DEFINER` so it can read the users table regardless of the caller's RLS context, and `STABLE` so the planner can cache it within a transaction.

---

## 9. Query Examples

**Full-text article search with filters:**
```sql
SELECT id, slug, title, summary, category, difficulty,
       ts_rank(search_vector, query) AS rank
FROM public.articles, to_tsquery('english', 'brake & pad') AS query
WHERE search_vector @@ query
  AND is_hidden = false
  AND category = 'brakes'
ORDER BY rank DESC
LIMIT 20;
```

**User's learning dashboard (articles + quiz progress):**
```sql
SELECT a.id, a.title, a.category, a.difficulty,
       lp.article_read, lp.quiz_completed, lp.quiz_best_score
FROM public.articles a
LEFT JOIN public.learning_progress lp
  ON lp.article_id = a.id AND lp.user_id = $1
WHERE a.is_hidden = false
ORDER BY a.category, a.difficulty;
```

**Motorcycle diagnostics history:**
```sql
SELECT d.id, d.severity, d.confidence, d.created_at,
       d.result_json->>'summary' AS summary,
       a.title AS related_article
FROM public.diagnostics d
LEFT JOIN public.articles a ON a.id = d.related_article_id
WHERE d.motorcycle_id = $1
ORDER BY d.created_at DESC;
```

**Admin: AI cost report by model and content type:**
```sql
SELECT model, content_type,
       COUNT(*) AS calls,
       SUM(input_tokens) AS total_input,
       SUM(output_tokens) AS total_output,
       SUM(cost_cents) AS total_cost_cents
FROM public.content_generation_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model, content_type
ORDER BY total_cost_cents DESC;
```

**Check overdue primary motorcycle maintenance (P1):**
```sql
SELECT m.id, m.make, m.model, m.year, m.current_mileage,
       mt.name AS task_name,
       MAX(me.performed_at) AS last_performed,
       MAX(me.mileage_at) AS last_mileage
FROM public.motorcycles m
CROSS JOIN public.maintenance_tasks mt
LEFT JOIN public.maintenance_events me
  ON me.motorcycle_id = m.id AND me.task_id = mt.id
WHERE m.user_id = $1
  AND m.deleted_at IS NULL
  AND (mt.motorcycle_type IS NULL OR mt.motorcycle_type = m.type)
GROUP BY m.id, mt.id
HAVING MAX(me.mileage_at) IS NULL
   OR (m.current_mileage - MAX(me.mileage_at)) > mt.interval_miles;
```
