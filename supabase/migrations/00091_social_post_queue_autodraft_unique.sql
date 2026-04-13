-- Prevent double-publish race for Gemini-autodrafted rows.
--
-- Failure mode being fixed: when /run-slot is fired manually at the same
-- moment a cron tick is running, both invocations can land in the auto-draft
-- branch (both see an empty queue), both call draftPost, both call
-- insertDraftedRow — producing two 'ready' rows for the same (slot,
-- scheduled_for). The first is claimed and published; the second sits at
-- 'ready' and is picked up at the next cron tick, effectively posting the
-- same angle twice in ~5 hours.
--
-- A partial unique index over (slot, scheduled_for) WHERE status='ready'
-- AND source='gemini-autodraft' blocks the second insert at the DB layer.
-- The losing invocation's insertDraftedRow throws, the scheduled handler
-- logs and exits, and the next cron tick picks up the winning row
-- normally.
--
-- Scoped deliberately to autodraft rows only — manual seeds via
-- scripts/fill-queue.ts retain the ability to queue multiple 'ready' rows
-- for the same slot/date (which the existing claim RPC already handles
-- in order by created_at).

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_post_queue_autodraft_unique_ready
  ON public.social_post_queue (slot, scheduled_for)
  WHERE status = 'ready' AND source = 'gemini-autodraft';

COMMENT ON INDEX public.idx_social_post_queue_autodraft_unique_ready IS
  'Blocks concurrent auto-draft inserts for the same slot+date. See migration 00091 and docs/plans/2026-04-11-004-feat-worker-gemini-autodraft-plan.md for context.';
