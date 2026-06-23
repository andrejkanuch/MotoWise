-- Migration: 00150_document_vault
-- Bike Document Vault (U1): per-bike document store for PII-grade paperwork
-- (insurance, registration, title, service records, ...).
--
-- Three tables (documents, document_files, document_categories), a PRIVATE
-- Storage bucket, and RLS on all of them. Modeled on:
--   - 00076_expense_photos.sql        (table + RLS shape)
--   - 00035_cron_..._exports_bucket   (private bucket: public=false, limits)
--   - 00003_rls_..._storage.sql       (folder-prefix Storage RLS)
--   - 00082_fk_cascade_fixes.sql      (ON DELETE CASCADE on user_id FKs)
--
-- Security notes:
--   - These are PII artifacts: the bucket is PRIVATE and only ever served via
--     short-lived signed URLs (no public-URL pattern).
--   - Table RLS verifies BIKE ownership (not just user_id) to close the IDOR
--     class that bit expenses.
--   - The Storage INSERT policy ALSO verifies bike ownership on path segment [2]
--     because the client uploads bytes BEFORE the documents row exists — a
--     user_id-only folder check would let a user stage bytes under a
--     motorcycle_id they do not own.

-- =============================================================================
-- 1. document_categories — per-rider categories (seeded + custom)
-- =============================================================================
CREATE TABLE public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('seeded', 'custom')),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  prompts_expiry BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- per-user uniqueness makes first-access seeding race-safe (idempotent upsert)
  CONSTRAINT document_categories_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_document_categories_user ON public.document_categories (user_id);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own document categories" ON public.document_categories
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.document_categories IS
  'Per-rider document categories (seeded materialized on first vault use + custom). Hiding sets is_hidden without touching documents.category_id.';

-- =============================================================================
-- 2. documents — parent row (one bike, one category, 1..N files)
-- =============================================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  -- RESTRICT: a category with documents cannot be deleted (v1 only hides categories)
  category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  expiry_date DATE,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_motorcycle ON public.documents (motorcycle_id);
CREATE INDEX idx_documents_user ON public.documents (user_id);
CREATE INDEX idx_documents_category ON public.documents (category_id);
-- Partial index backs the garage soon-expiring aggregate
CREATE INDEX idx_documents_expiry ON public.documents (expiry_date)
  WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- USING gates reads/updates/deletes to the owner; WITH CHECK additionally
-- verifies the target bike is owned AND not soft-deleted on INSERT/UPDATE.
CREATE POLICY "Users own documents" ON public.documents
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles
      WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
    )
    -- The category FK only guarantees existence; verify ownership too so a row
    -- can't be filed under another user's category via direct PostgREST.
    AND category_id IN (
      SELECT id FROM public.document_categories WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.documents IS
  'Bike document vault parent row. Private PII; files live in document_files + the private documents bucket. "Follow the bike": queries exclude documents whose motorcycle is soft-deleted (filter on motorcycles.deleted_at), never stamping documents on bike soft-delete.';

COMMENT ON COLUMN public.documents.deleted_at IS
  'Reserved for a future document/bike hard-delete soft-stage. Currently never written; read paths filter `deleted_at IS NULL` so the column is forward-compatible. Bike soft-delete is reflected via motorcycles.deleted_at, not this column.';

-- =============================================================================
-- 3. document_files — 1..N files per document (front/back of a card, etc.)
-- =============================================================================
CREATE TABLE public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  -- denormalized for GDPR export (byUserId) + hard-delete path-collection
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_size_bytes INT,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_files_document ON public.document_files (document_id);
CREATE INDEX idx_document_files_user ON public.document_files (user_id);

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own document files" ON public.document_files
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    -- The document FK only guarantees existence; verify the caller owns the
    -- parent document too, so a file row can't be attached to another user's
    -- document (orphan-sweep evasion / integrity) via direct PostgREST.
    AND document_id IN (
      SELECT id FROM public.documents WHERE user_id = (SELECT auth.uid())
    )
  );

COMMENT ON TABLE public.document_files IS
  'Files belonging to a document. storage_path points into the private documents bucket: {userId}/{motorcycleId}/{documentId}/{filename}.';

-- =============================================================================
-- 4. Private "documents" Storage bucket + folder-prefix RLS
-- =============================================================================
-- Bucket file_size_limit accommodates the largest allowed file (PDF, 20 MB);
-- per-type caps (image 5 MB / PDF 20 MB) are enforced at the application layer.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                                            -- PRIVATE
  20971520,                                         -- 20 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- INSERT: user-rooted AND bike-owned. The bike-ownership check on segment [2] is
-- load-bearing: the client uploads before the documents row exists, so without it
-- a user could stage bytes under a motorcycle_id they don't own.
CREATE POLICY "Users upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.motorcycles
      WHERE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
    )
  );

-- SELECT: required for the per-request user client to mint signed URLs (RLS is
-- the real authorization gate for signing — net-new vs health-reports).
CREATE POLICY "Users read own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Service role: system sweep (orphan reconciliation, hard-delete) + delete
-- defense-in-depth.
CREATE POLICY "Service role manages documents bucket" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents'
    AND auth.role() = 'service_role'
  );
