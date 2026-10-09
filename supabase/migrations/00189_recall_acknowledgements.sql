-- Migration: 00189_recall_acknowledgements
-- "Mark a safety recall as done".
--
-- NHTSA keeps a recall campaign listed long after the dealer has done the work,
-- so until now every campaign the API returned counted as open forever. A row
-- here says "the rider marked campaign X on bike Y as done". The API
-- (motorcycles.service checkRecalls) reads these rows through the USER client,
-- flags each recall `acknowledged`, and persists recall_count as the number of
-- recalls WITHOUT a row — so the plate, garage badge, bike-hub attention list
-- and CarPlay heads-up (which all read recall_count) stop alerting.
--
-- Keyed on (motorcycle_id, campaign_number): a campaign is per bike, and a
-- rider with two bikes of the same model marks each one separately.
--
-- WRITES go through the user client (RLS). Undo is a HARD delete: there is no
-- deleted_at column, so the SELECT policy has no `deleted_at IS NULL` clause and
-- the soft-delete-vs-SELECT-policy trap (docs/solutions/architecture/
-- soft-delete-rejected-by-select-rls-policy.md) does not apply. A DELETE whose
-- WHERE reads columns is still filtered by the SELECT policy, which is the same
-- owner check, so the rider can delete exactly their own rows.
--
-- No UPDATE grant or policy: a row is only ever inserted or deleted, so it can
-- never be moved onto another bike or user.
--
-- ACCOUNT DELETION: user_id and motorcycle_id both cascade, so
-- hard_delete_expired_accounts() (deletes auth.users) covers this table with no
-- change. A soft-deleted bike keeps its rows (harmless; they only matter while
-- the bike is live) and loses them when the bike row is hard-deleted.
--
-- DEPLOY ORDER: apply BEFORE the API that reads/writes recall_acknowledgements.

BEGIN;

CREATE TABLE public.recall_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  -- NHTSA campaign numbers look like 23V123000 (9-12 chars). 32 leaves room for
  -- format drift without accepting arbitrary text.
  campaign_number text NOT NULL
    CHECK (char_length(campaign_number) BETWEEN 1 AND 32 AND campaign_number = btrim(campaign_number)),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recall_acknowledgements_motorcycle_campaign_key UNIQUE (motorcycle_id, campaign_number)
);

COMMENT ON TABLE public.recall_acknowledgements IS
  'Safety recall campaigns a rider marked as done for one of their bikes. A recall with a row here is not counted in motorcycles.recall_count. Undo = hard delete.';
COMMENT ON COLUMN public.recall_acknowledgements.campaign_number IS
  'NHTSA recall campaign number (Recall.campaignNumber), stored exactly as NHTSA returns it.';
COMMENT ON COLUMN public.recall_acknowledgements.acknowledged_at IS
  'When the rider marked the recall as done. Kept on a repeated acknowledge (the insert is a no-op on conflict).';

-- The API reads "this rider's acknowledgements for this bike".
CREATE INDEX idx_recall_acknowledgements_user_motorcycle
  ON public.recall_acknowledgements (user_id, motorcycle_id);

ALTER TABLE public.recall_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own recall acknowledgements" ON public.recall_acknowledgements
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- The bike must be the caller's own live bike: user_id alone would let a
-- caller attach a row to any motorcycle id they can guess.
CREATE POLICY "Users acknowledge recalls on own bikes" ON public.recall_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.motorcycles m
      WHERE m.id = motorcycle_id
        AND m.user_id = (SELECT auth.uid())
        AND m.deleted_at IS NULL
    )
  );

CREATE POLICY "Users delete own recall acknowledgements" ON public.recall_acknowledgements
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Supabase's default privileges grant ALL on new tables to anon and
-- authenticated. Clear them and grant back only what the API uses.
-- service_role keeps its default grant (nothing writes this table with it today).
REVOKE ALL ON TABLE public.recall_acknowledgements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.recall_acknowledgements TO authenticated;

COMMIT;
