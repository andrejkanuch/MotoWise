-- Migration: 00088_social_post_queue
--
-- Scheduled social media publishing queue.
--
-- Replaces the claude.ai scheduled-task approach (which failed silently because
-- the sandbox egress proxy blocked motovault-social-api.workers.dev). Content
-- is now pre-seeded into this table by a local CLI (infra/social-worker/scripts/
-- fill-queue.ts) and consumed by the Cloudflare Worker's scheduled() handler,
-- which runs on Cloudflare infrastructure with no sandbox involved.
--
-- Slots map 1:1 to cron triggers in infra/social-worker/wrangler.toml:
--   afternoon      -> 0 14 * * *  (Europe afternoon / Americas morning)
--   evening        -> 0 19 * * *  (Europe evening)
--   night-americas -> 0 0  * * *  (Americas evening)
--
-- Lifecycle: ready -> publishing -> published | failed
-- Rows are claimed atomically via claim_next_social_post() SECURITY DEFINER RPC.

BEGIN;

-- ==========================================
-- 1. social_post_queue table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.social_post_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scheduling
  slot              TEXT NOT NULL,
  scheduled_for     DATE NOT NULL,

  -- Content (filled in by fill-queue.ts)
  angle             TEXT NOT NULL,
  caption           TEXT NOT NULL,
  post_prompt       TEXT NOT NULL,
  story_prompt      TEXT NOT NULL,

  -- Execution
  status            TEXT NOT NULL DEFAULT 'ready',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,

  -- Results (filled in by the Worker)
  post_image_url    TEXT,
  story_image_url   TEXT,
  post_results      JSONB,
  story_results     JSONB,
  error             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT social_post_queue_slot_chk
    CHECK (slot IN ('afternoon', 'evening', 'night-americas')),
  CONSTRAINT social_post_queue_status_chk
    CHECK (status IN ('ready', 'publishing', 'published', 'failed', 'skipped'))
);

-- Pickup index: covers the "next claimable row for this slot" query.
CREATE INDEX IF NOT EXISTS idx_social_post_queue_pickup
  ON public.social_post_queue (slot, scheduled_for, created_at)
  WHERE status = 'ready';

-- Audit index for listing recent attempts.
CREATE INDEX IF NOT EXISTS idx_social_post_queue_recent
  ON public.social_post_queue (slot, scheduled_for DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.social_post_queue_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_post_queue_updated_at ON public.social_post_queue;
CREATE TRIGGER trg_social_post_queue_updated_at
  BEFORE UPDATE ON public.social_post_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.social_post_queue_set_updated_at();

-- ==========================================
-- 2. Row Level Security
-- ==========================================
-- This table is server-side only. The Worker uses the service role key to
-- bypass RLS; anon and authenticated roles have no access. Enabling RLS with
-- no policies denies by default (belt-and-suspenders alongside the explicit
-- REVOKE below).
ALTER TABLE public.social_post_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.social_post_queue FROM anon, authenticated;
GRANT ALL ON public.social_post_queue TO service_role;

-- ==========================================
-- 3. claim_next_social_post RPC
-- ==========================================
-- Atomically pops the next queued row for a given slot. Uses FOR UPDATE SKIP
-- LOCKED so concurrent callers (unlikely with a single cron worker, but cheap
-- insurance) never double-publish. Transitions ready -> publishing and bumps
-- attempts + last_attempt_at in one statement.
--
-- Returns NULL if no row is ready.
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

REVOKE ALL ON FUNCTION public.claim_next_social_post(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_social_post(TEXT) TO service_role;

COMMIT;
