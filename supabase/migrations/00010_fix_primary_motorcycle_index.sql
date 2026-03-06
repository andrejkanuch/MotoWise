-- Fix: primary motorcycle unique index should exclude soft-deleted rows
-- The original index was created before soft delete was added in migration 00005
DROP INDEX IF EXISTS idx_motorcycles_one_primary_per_user;
CREATE UNIQUE INDEX idx_motorcycles_one_primary_per_user
  ON public.motorcycles (user_id) WHERE is_primary = true AND deleted_at IS NULL;
