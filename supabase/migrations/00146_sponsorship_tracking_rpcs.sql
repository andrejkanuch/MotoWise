-- Migration: 00146_sponsorship_tracking_rpcs (audit H8)
--
-- Sponsorship impression/click tracking was a read-modify-write in JS against
-- the USER client: (a) two concurrent impressions both read the same
-- spent_this_month and one increment was lost (money race), and (b) RLS only
-- lets the sponsor/admin UPDATE the row, so tracking silently no-oped for
-- every other viewer. These RPCs do the increment + budget clamp + auto-pause
-- in ONE atomic UPDATE.
--
-- service_role only: this is a money RPC — if anon/authenticated could call
-- it via PostgREST, any user could loop track_sponsorship_impression and
-- drain a sponsor's monthly budget. Grants follow the 00139 rollup-RPC
-- precedent. (Backlog: per-user impression dedupe ledger.)
--
-- Schema notes (00100_sponsorships): clicks have no cost column
-- (cost_per_impression only), so track_sponsorship_click does no spend math.
-- monthly_budget defaults to 0 = "no budget configured": spend is not clamped
-- and the sponsorship is never auto-paused in that case (matches the previous
-- JS guard `monthly_budget > 0`).

BEGIN;

CREATE OR REPLACE FUNCTION public.track_sponsorship_impression(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.sponsorships
  SET
    impressions_count = impressions_count + 1,
    spent_this_month = CASE
      WHEN monthly_budget > 0
        THEN LEAST(spent_this_month + cost_per_impression, monthly_budget)
      ELSE spent_this_month + cost_per_impression
    END,
    status = CASE
      WHEN monthly_budget > 0
        AND spent_this_month + cost_per_impression >= monthly_budget
        THEN 'paused'::public.sponsorship_status
      ELSE status
    END
  WHERE id = p_id
    AND status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now());

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_sponsorship_click(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.sponsorships
  SET clicks_count = clicks_count + 1
  WHERE id = p_id
    AND status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now());

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.track_sponsorship_impression(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_sponsorship_impression(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.track_sponsorship_click(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_sponsorship_click(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
