-- Migration: Blog CMS (extensible, Postgres-backed content platform)
-- Plan: docs/plans/2026-06-24-001-feat-blog-cms-postgres-plan.md (U1)
--
-- Class-Table Inheritance: blog_posts base + per-type tables (guide/maintenance/
-- trip/gear), each with a `meta jsonb` overflow. Per-entity translations carry the
-- locale-specific body + a trigger-maintained tsvector (per-locale config + folded
-- keyword_text), mirroring the article keyword-search trigger in 00045. Taxonomy
-- (hierarchical categories + flat keywords) via M2M joins. Full-snapshot JSONB
-- versioning. Public-read RLS gated on published status (parent-gated for child
-- tables); admin ALL with WITH CHECK; versions deny-all to public. Scheduled
-- publishing via pg_cron (mirrors 00048), snapshotting in SQL so it matches the
-- app publish path without needing the MDX compiler.
--
-- Patterns mirrored: 00002/00003 (articles tsvector + public-read/admin RLS +
-- is_admin()/update_updated_at()), 00045 (trigger-maintained search_vector folding
-- keyword text), 00048 (SECURITY DEFINER fn + pg_cron + REVOKE/GRANT).
--
-- NOTE: `main` only carries through 00149, but PRODUCTION is already at 00156
-- (document-vault + expense + share-link migrations 00150-00156 applied outside this
-- branch's view). Numbered 00157 to sit after the live prod head. Re-verify the next
-- free number against production before pushing.

BEGIN;

-- ============================================================
-- LOCALE → TEXT SEARCH CONFIG HELPER
-- ============================================================
CREATE FUNCTION public.blog_locale_config(loc text) RETURNS regconfig
LANGUAGE sql STABLE AS $$
  SELECT CASE loc
    WHEN 'es' THEN 'spanish'::regconfig
    WHEN 'de' THEN 'german'::regconfig
    WHEN 'fr' THEN 'french'::regconfig
    WHEN 'it' THEN 'italian'::regconfig
    ELSE 'english'::regconfig
  END
$$;

-- ============================================================
-- BASE TABLE
-- ============================================================
CREATE TABLE public.blog_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type               text NOT NULL CHECK (type IN ('guide', 'maintenance', 'trip', 'gear')),
  slug               text NOT NULL UNIQUE,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
  published_at       timestamptz,
  scheduled_for      timestamptz,
  author             text,
  cover_image        text,
  cover_alt          text,
  spec_data          boolean NOT NULL DEFAULT false,
  is_safety_critical boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- A scheduled post must carry a target time.
  CONSTRAINT chk_blog_scheduled_for CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL)
);

-- ============================================================
-- PER-TYPE TABLES (CTI). Each holds only type-specific columns + a meta overflow.
-- ============================================================
CREATE TABLE public.blog_post_guide (
  post_id    uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  difficulty text CHECK (difficulty IS NULL OR difficulty IN ('beginner', 'intermediate', 'advanced')),
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.blog_post_maintenance (
  post_id           uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  make              text,
  model             text,
  variant           text,
  dataset_models    text[] NOT NULL DEFAULT '{}',
  applicable_models text[] NOT NULL DEFAULT '{}',
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.blog_post_trip (
  post_id       uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  distance_km   numeric,
  country_codes text[] NOT NULL DEFAULT '{}',
  route_gpx     text,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.blog_post_gear (
  post_id   uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  brand     text,
  model     text,
  rating    numeric(3, 1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  price_eur numeric,
  verdict   text,
  meta      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- TRANSLATIONS (per-locale body + SEO + FTS vector)
-- ============================================================
CREATE TABLE public.blog_post_translations (
  post_id         uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  locale          text NOT NULL CHECK (locale IN ('en', 'es', 'de', 'fr', 'it')),
  title           text NOT NULL,
  excerpt         text,
  seo_title       text,
  seo_description text,
  body_raw        text NOT NULL DEFAULT '',   -- MDX source (source of truth)
  body_text       text NOT NULL DEFAULT '',   -- MDX/JSX-stripped plain text, for FTS
  keyword_text    text NOT NULL DEFAULT '',   -- denormalized assigned-keyword names, for FTS
  body_json       jsonb,                      -- reserved for a future block editor
  faq             jsonb NOT NULL DEFAULT '[]'::jsonb,
  reading_time    text,
  word_count      integer,
  search_vector   tsvector,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, locale)
);

-- ============================================================
-- TAXONOMY
-- ============================================================
CREATE TABLE public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  parent_id  uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.keywords (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_post_categories (
  post_id     uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE public.blog_post_keywords (
  post_id    uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, keyword_id)
);

-- ============================================================
-- VERSIONS (full JSONB snapshot, admin-only)
-- ============================================================
CREATE TABLE public.blog_post_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  version_num integer NOT NULL,
  snapshot    jsonb NOT NULL,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, version_num)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_blog_posts_status_published ON public.blog_posts (status, published_at DESC);
CREATE INDEX idx_blog_posts_type ON public.blog_posts (type);
CREATE INDEX idx_blog_posts_scheduled ON public.blog_posts (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_blog_translations_search ON public.blog_post_translations USING GIN (search_vector);
CREATE INDEX idx_blog_translations_title_trgm ON public.blog_post_translations USING GIN (title gin_trgm_ops);
CREATE INDEX idx_blog_post_categories_category ON public.blog_post_categories (category_id);
CREATE INDEX idx_blog_post_keywords_keyword ON public.blog_post_keywords (keyword_id);
CREATE INDEX idx_categories_parent ON public.categories (parent_id);
CREATE INDEX idx_blog_post_versions_post ON public.blog_post_versions (post_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.blog_post_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- TRIGGER: per-locale search_vector (title A / excerpt B / keyword_text C / body_text D)
-- Mirrors 00045's trigger-maintained vector; per-locale config via blog_locale_config.
-- ============================================================
CREATE FUNCTION public.blog_post_translation_search_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cfg regconfig := public.blog_locale_config(NEW.locale);
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector(cfg, coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector(cfg, coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector(cfg, coalesce(NEW.keyword_text, '')), 'C') ||
    setweight(to_tsvector(cfg, coalesce(NEW.body_text, '')), 'D');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_blog_translation_search
  BEFORE INSERT OR UPDATE ON public.blog_post_translations
  FOR EACH ROW EXECUTE FUNCTION public.blog_post_translation_search_update();

-- ============================================================
-- TRIGGER: keep keyword_text in sync when a post's keywords change.
-- The UPDATE re-fires the search-vector trigger above.
-- ============================================================
CREATE FUNCTION public.refresh_blog_post_keyword_text(p_post_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.blog_post_translations t
  SET keyword_text = COALESCE((
    SELECT string_agg(k.name, ' ' ORDER BY k.name)
    FROM public.blog_post_keywords bpk
    JOIN public.keywords k ON k.id = bpk.keyword_id
    WHERE bpk.post_id = p_post_id
  ), '')
  WHERE t.post_id = p_post_id;
END $$;

CREATE FUNCTION public.blog_post_keywords_changed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_blog_post_keyword_text(COALESCE(NEW.post_id, OLD.post_id));
  RETURN NULL;
END $$;

CREATE TRIGGER trg_blog_post_keywords_changed
  AFTER INSERT OR DELETE ON public.blog_post_keywords
  FOR EACH ROW EXECUTE FUNCTION public.blog_post_keywords_changed();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_guide ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_versions ENABLE ROW LEVEL SECURITY;

-- Base: anyone reads published; admins manage all.
CREATE POLICY "Anyone reads published blog posts" ON public.blog_posts
  FOR SELECT USING (status = 'published');
CREATE POLICY "Admins manage blog posts" ON public.blog_posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Child tables: public read only when the parent post is published; admins manage.
-- (helper expression repeated per table; kept explicit for clarity over a function)
CREATE POLICY "Public reads guide of published" ON public.blog_post_guide
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage guide" ON public.blog_post_guide
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads maintenance of published" ON public.blog_post_maintenance
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage maintenance" ON public.blog_post_maintenance
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads trip of published" ON public.blog_post_trip
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage trip" ON public.blog_post_trip
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads gear of published" ON public.blog_post_gear
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage gear" ON public.blog_post_gear
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads translations of published" ON public.blog_post_translations
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage translations" ON public.blog_post_translations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads post categories of published" ON public.blog_post_categories
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage post categories" ON public.blog_post_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public reads post keywords of published" ON public.blog_post_keywords
  FOR SELECT USING (post_id IN (SELECT id FROM public.blog_posts WHERE status = 'published'));
CREATE POLICY "Admins manage post keywords" ON public.blog_post_keywords
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Taxonomy is public-readable (browse/filter); admins write.
CREATE POLICY "Anyone reads categories" ON public.categories
  FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Anyone reads keywords" ON public.keywords
  FOR SELECT USING (true);
CREATE POLICY "Admins manage keywords" ON public.keywords
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Versions: admin-only (no public SELECT policy => deny-all to anon/authenticated).
CREATE POLICY "Admins manage versions" ON public.blog_post_versions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- SEARCH RPC: FTS (per-locale) + trigram typo tolerance + recency boost.
-- search_path = 'public' so pg_trgm's word_similarity resolves (learning:
-- typeahead-word-similarity-not-found.md). Published-only; length-bounded.
-- ============================================================
CREATE FUNCTION public.search_blog_posts(query text, loc text DEFAULT 'en')
RETURNS TABLE (post_id uuid, rank real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cfg regconfig;
  ts  tsquery;
BEGIN
  IF query IS NULL OR char_length(query) = 0 OR char_length(query) > 200 THEN
    RETURN;
  END IF;
  cfg := public.blog_locale_config(loc);
  ts  := websearch_to_tsquery(cfg, query);

  RETURN QUERY
  SELECT t.post_id,
    (
      ts_rank(t.search_vector, ts)
      + word_similarity(query, t.title) * 0.3
      + CASE WHEN p.published_at > now() - interval '30 days' THEN 0.3 ELSE 0 END
    )::real AS rank
  FROM public.blog_post_translations t
  JOIN public.blog_posts p ON p.id = t.post_id
  WHERE p.status = 'published'
    AND t.locale = loc
    AND (t.search_vector @@ ts OR word_similarity(query, t.title) > 0.3)
  ORDER BY rank DESC
  LIMIT 50;
END $$;

REVOKE EXECUTE ON FUNCTION public.search_blog_posts(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_blog_posts(text, text) TO anon, authenticated;

-- ============================================================
-- SCHEDULED PUBLISH: flip due posts + write a SQL snapshot (parity with the app
-- publish path, which also snapshots from existing columns — no MDX compile).
-- Mirrors 00048's SECURITY DEFINER + pg_cron + REVOKE/GRANT.
-- ============================================================
CREATE FUNCTION public.publish_due_blog_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.blog_posts
    WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= now()
  LOOP
    INSERT INTO public.blog_post_versions (post_id, version_num, snapshot, created_by)
    SELECT
      r.id,
      COALESCE((SELECT max(version_num) FROM public.blog_post_versions WHERE post_id = r.id), 0) + 1,
      jsonb_build_object(
        'post', to_jsonb(p),
        'translations', (
          SELECT jsonb_agg(to_jsonb(t))
          FROM public.blog_post_translations t
          WHERE t.post_id = r.id
        )
      ),
      NULL
    FROM public.blog_posts p
    WHERE p.id = r.id;

    UPDATE public.blog_posts
    SET status = 'published', published_at = COALESCE(published_at, now())
    WHERE id = r.id;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.publish_due_blog_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_blog_posts() TO service_role;

SELECT cron.schedule(
  'publish-due-blog-posts',
  '* * * * *',
  $$SELECT public.publish_due_blog_posts()$$
);

COMMIT;
