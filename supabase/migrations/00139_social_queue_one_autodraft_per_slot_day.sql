-- Migration: 00139_social_queue_one_autodraft_per_slot_day
--
-- Fixes duplicate publishing caused by manual /run-slot calls consuming the
-- auto-drafted row early, then the real cron tick auto-drafting and publishing
-- a second row for the same slot + date.
--
-- Root cause: the old unique index (migration 00091) only guarded status='ready'
-- rows. Once the first autodraft was claimed (status -> 'publishing' -> 'published'),
-- the constraint no longer blocked a second insert.
--
-- Fix: widen the unique index to cover ALL autodraft rows regardless of status.
-- This ensures at most one gemini-autodraft row per (slot, scheduled_for), period.
-- Manual seeds (source != 'gemini-autodraft') are unaffected and can still have
-- multiple rows per slot/date.
--
-- Step 1: deduplicate existing autodraft rows (keep the one with highest
-- priority: published > failed > publishing > ready, then latest created_at).
-- Step 2: create the wider unique index.

BEGIN;

-- Drop the old narrow index
DROP INDEX IF EXISTS public.idx_social_post_queue_autodraft_unique_ready;

-- Remove duplicate autodraft rows, keeping the "best" one per (slot, scheduled_for):
-- prefer published > publishing > failed > ready, then latest created_at as tiebreaker.
DELETE FROM public.social_post_queue
WHERE source = 'gemini-autodraft'
  AND id NOT IN (
    SELECT DISTINCT ON (slot, scheduled_for) id
    FROM public.social_post_queue
    WHERE source = 'gemini-autodraft'
    ORDER BY slot, scheduled_for,
      CASE status
        WHEN 'published'  THEN 0
        WHEN 'publishing' THEN 1
        WHEN 'failed'     THEN 2
        WHEN 'ready'      THEN 3
        ELSE 4
      END,
      created_at DESC
  );

-- New index: one autodraft row per slot per day, any status
CREATE UNIQUE INDEX idx_social_post_queue_autodraft_unique
  ON public.social_post_queue (slot, scheduled_for)
  WHERE source = 'gemini-autodraft';

COMMENT ON INDEX public.idx_social_post_queue_autodraft_unique IS
  'Ensures at most one gemini-autodraft row per slot+date. See migration 00139.';

COMMIT;
