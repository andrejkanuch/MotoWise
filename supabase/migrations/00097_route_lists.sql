-- Migration: MOT-170 — route_lists + route_list_items
-- Forward-compatible saved-routes organisation; keeps route_saves intact.

-- ==========================================
-- TABLE: route_lists
-- ==========================================
CREATE TABLE public.route_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  slug        TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$'),
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT route_lists_user_slug_unique UNIQUE (user_id, slug)
);

ALTER TABLE public.route_lists ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_route_lists_user ON public.route_lists (user_id);
CREATE INDEX idx_route_lists_user_default ON public.route_lists (user_id, is_default) WHERE is_default = true;

-- ==========================================
-- TABLE: route_list_items
-- ==========================================
CREATE TABLE public.route_list_items (
  list_id   UUID NOT NULL REFERENCES public.route_lists(id) ON DELETE CASCADE,
  route_id  UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note      TEXT CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 500),

  PRIMARY KEY (list_id, route_id)
);

ALTER TABLE public.route_list_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_route_list_items_route ON public.route_list_items (route_id);

-- ==========================================
-- FUNCTION: create_default_route_list()
-- Auto-creates a "Saved" list when a new user is inserted.
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_default_route_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.route_lists (user_id, name, slug, visibility, is_default)
  VALUES (NEW.id, 'Saved', 'saved', 'private', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_create_default_route_list
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_route_list();

-- ==========================================
-- BACKFILL: create default lists for existing users
-- and copy route_saves entries into route_list_items
-- ==========================================

-- 1) Create default "Saved" list for every existing user who doesn't have one
INSERT INTO public.route_lists (user_id, name, slug, visibility, is_default)
SELECT u.id, 'Saved', 'saved', 'private', true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.route_lists rl
  WHERE rl.user_id = u.id AND rl.is_default = true
);

-- 2) Copy route_saves into route_list_items for each user's default list
INSERT INTO public.route_list_items (list_id, route_id, added_at)
SELECT rl.id, rs.route_id, rs.saved_at
FROM public.route_saves rs
JOIN public.route_lists rl ON rl.user_id = rs.user_id AND rl.is_default = true
ON CONFLICT DO NOTHING;

-- ==========================================
-- TRIGGER: updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION public.route_lists_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_route_lists_updated_at
  BEFORE UPDATE ON public.route_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.route_lists_set_updated_at();

-- ==========================================
-- RLS: route_lists
-- ==========================================

-- Owner: full CRUD on own lists
CREATE POLICY "route_lists_select_own" ON public.route_lists
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "route_lists_insert" ON public.route_lists
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "route_lists_update" ON public.route_lists
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "route_lists_delete" ON public.route_lists
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_default = false);

-- Public lists: visible to anyone (authenticated)
CREATE POLICY "route_lists_select_public" ON public.route_lists
  FOR SELECT TO authenticated
  USING (visibility = 'public');

-- ==========================================
-- RLS: route_list_items
-- Items follow list ownership.
-- ==========================================

CREATE POLICY "route_list_items_select_own" ON public.route_list_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_lists rl
      WHERE rl.id = list_id AND rl.user_id = auth.uid()
    )
  );

CREATE POLICY "route_list_items_select_public" ON public.route_list_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_lists rl
      WHERE rl.id = list_id AND rl.visibility = 'public'
    )
  );

CREATE POLICY "route_list_items_insert" ON public.route_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.route_lists rl
      WHERE rl.id = list_id AND rl.user_id = auth.uid()
    )
  );

CREATE POLICY "route_list_items_update" ON public.route_list_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_lists rl
      WHERE rl.id = list_id AND rl.user_id = auth.uid()
    )
  );

CREATE POLICY "route_list_items_delete" ON public.route_list_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_lists rl
      WHERE rl.id = list_id AND rl.user_id = auth.uid()
    )
  );

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE public.route_lists IS 'User-created collections of saved routes. Each user has a default "Saved" list auto-created on sign-up.';
COMMENT ON TABLE public.route_list_items IS 'Many-to-many join between route_lists and routes, with optional per-item notes.';
COMMENT ON COLUMN public.route_lists.is_default IS 'True for the auto-created "Saved" list. Cannot be deleted.';
COMMENT ON COLUMN public.route_lists.visibility IS 'private = owner only, public = discoverable by other users.';
