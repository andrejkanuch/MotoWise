-- Migration: 00133_social_queue_recover_stuck
--
-- Fix claim_next_social_post to also recover rows stuck in 'publishing' for
-- more than 10 minutes. When the Worker dies mid-publish (timeout, crash),
-- rows remain in 'publishing' status forever because only 'ready' rows are
-- claimable. This update resets stale 'publishing' rows back to 'ready'
-- before attempting the normal claim, preventing permanent stuck rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_next_social_post(p_slot TEXT)
RETURNS public.social_post_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_row public.social_post_queue;
BEGIN
  -- Recovery: reset rows stuck in 'publishing' for more than 10 minutes.
  -- These are orphaned by Worker crashes/timeouts. Reset to 'ready' so they
  -- can be retried (as long as attempts < 3).
  UPDATE public.social_post_queue
  SET status = 'ready'
  WHERE slot = p_slot
    AND status = 'publishing'
    AND last_attempt_at < now() - interval '10 minutes'
    AND attempts < 3;

  SELECT id
  INTO v_id
  FROM public.social_post_queue
  WHERE slot = p_slot
    AND status = 'ready'
    AND scheduled_for <= (now() AT TIME ZONE 'utc')::date
  ORDER BY scheduled_for ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.social_post_queue
  SET status          = 'publishing',
      attempts        = attempts + 1,
      last_attempt_at = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;
