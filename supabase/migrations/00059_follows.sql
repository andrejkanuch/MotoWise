-- Migration: Create follows table + follow counter trigger
-- Part of Community Layer — Phase 3: Social Graph

-- ==========================================
-- TABLE: follows
-- ==========================================
CREATE TABLE public.follows (
  follower_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (follower_id, following_id),

  CONSTRAINT chk_follows_no_self_follow
    CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INDEXES
-- ==========================================

-- "Who do I follow?" — follower lookups for feed query
CREATE INDEX idx_follows_follower ON public.follows (follower_id);

-- "Who follows me?" — following lookups for profile
CREATE INDEX idx_follows_following ON public.follows (following_id);

-- ==========================================
-- FUNCTION: update_follow_counts()
-- Atomically maintains follower_count/following_count on users table
-- SECURITY DEFINER with pinned search_path (migration 00007 pattern)
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.users SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    UPDATE public.users SET follower_count = follower_count - 1 WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ==========================================
-- TRIGGER: fire on follow/unfollow
-- ==========================================
CREATE TRIGGER trg_update_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_follow_counts();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Any authenticated user can see follow relationships
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT TO authenticated
  USING (true);

-- User can follow public profiles (not themselves — enforced by CHECK constraint too)
CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    follower_id = (select auth.uid())
    AND follower_id != following_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = following_id AND is_public = true
    )
  );

-- User can unfollow (delete own follows)
CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE TO authenticated
  USING (follower_id = (select auth.uid()));

-- Explicit deny UPDATE — prevent forging follow relationships
CREATE POLICY "follows_no_update" ON public.follows
  FOR UPDATE TO authenticated
  USING (false);
