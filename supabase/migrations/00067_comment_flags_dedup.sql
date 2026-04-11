-- Migration: Deduplicate comment flags via a join table
-- Replaces the naive flagged_count++ with per-user dedup

-- ==========================================
-- TABLE: comment_flags (composite PK = one flag per user per comment)
-- ==========================================
CREATE TABLE public.comment_flags (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.comment_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags_insert" ON public.comment_flags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flags_select" ON public.comment_flags FOR SELECT TO authenticated
  USING (true);

-- ==========================================
-- FUNCTION: flag_comment (replaces 00063 version)
-- Inserts into comment_flags (no-op on duplicate),
-- then syncs flagged_count from actual count.
-- ==========================================
CREATE OR REPLACE FUNCTION public.flag_comment(comment_uuid UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO public.comment_flags (comment_id, user_id)
    VALUES (comment_uuid, auth.uid())
    ON CONFLICT (comment_id, user_id) DO NOTHING;

  SELECT COUNT(*)::INT INTO new_count
    FROM public.comment_flags
    WHERE comment_id = comment_uuid;

  UPDATE public.comments SET flagged_count = new_count WHERE id = comment_uuid;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
