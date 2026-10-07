-- Migration: 00182_notes
-- Bike-detail redesign R1 (spec §3 `notes`).
--
-- Per-bike rider notes: text, an optional odometer stamp, optional photos and an
-- optional link to a maintenance task or an expense.
--
-- NAMING vs THE SPEC
--   spec `text`        -> column `body` (the GraphQL field stays `text`)
--   spec `photo_ids[]` -> link table `note_photos`, mirroring expense_photos
--     (00076). Every other photo attachment in the app is a link table with a
--     DataLoader and a cascade; an array of ids would need a lookup table anyway.
-- Photo files go to the existing public `maintenance-photos` bucket under
-- {userId}/notes/{noteId}/{timestamp}.webp. That bucket's policy (first folder =
-- auth.uid(), 00022) already allows the path: no new bucket, no storage policy.
--
-- linked_task_id / linked_expense_id are both created now (lead decision D3).
-- R1 writes only linked_task_id ("also make it a task").
--
-- LINK OWNERSHIP AND note_link_is_own()
-- The INSERT and UPDATE policies require a linked task / expense to belong to
-- the caller. Written as a plain EXISTS that check would run under the caller's
-- own SELECT policies on maintenance_tasks / expenses, and both of those carry
-- `deleted_at IS NULL`. PostgreSQL evaluates an UPDATE policy's WITH CHECK on
-- every update, so once a rider soft-deleted a linked task, every later edit of
-- the note's text would be rejected with 42501 — the linked row is still theirs
-- but no longer visible to the EXISTS. note_link_is_own() is SECURITY DEFINER so
-- the ownership test ignores deleted_at. It pins user_id = auth.uid() inside, so
-- it answers only about the caller's own rows and is no oracle for anyone else's.
--
-- SOFT DELETE goes through soft_delete_note(), never a direct UPDATE: the SELECT
-- policy's `deleted_at IS NULL` rejects the UPDATE that stamps deleted_at
-- (docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md).
-- Same shape and meaning as 00176: true = "deleted and yours" (including
-- already deleted), false = "no such note for you". There is no DELETE policy.
--
-- HARD-DELETE CRON (00035) — FINDING
-- The cron calls hard_delete_expired_accounts() (latest body: 00167). It does
-- NOT enumerate tables: it sweeps storage objects per bucket, then deletes the
-- auth.users row and lets the FK cascades do the rest. notes.user_id and
-- note_photos.user_id both reference auth.users ON DELETE CASCADE, so both
-- tables are covered with no change to that function. The storage objects are
-- not: 'maintenance-photos' is still missing from the swept bucket list (the
-- gap 00167 records as pre-existing and tracked separately), so note photos
-- inherit it exactly as task and expense photos do. Not widened here.
--
-- DEPLOY ORDER: apply BEFORE the API that reads/writes notes.

BEGIN;

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  odometer integer NULL CHECK (odometer >= 0),
  linked_task_id uuid NULL REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL,
  linked_expense_id uuid NULL REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

COMMENT ON TABLE public.notes IS
  'Per-bike rider notes (bike-detail redesign R1). odometer is raw in motorcycles.distance_unit. Soft delete via soft_delete_note().';

CREATE INDEX idx_notes_motorcycle_created
  ON public.notes (motorcycle_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_user ON public.notes (user_id);

CREATE TABLE public.note_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_size_bytes int,
  mime_type text NOT NULL DEFAULT 'image/webp',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The object must sit in the owner's folder for this note, in normal form.
  -- notes.service checks the same before its admin-client storage.remove; this
  -- keeps a direct PostgREST insert from registering any other path.
  CONSTRAINT note_photos_storage_path_in_note_folder CHECK (
    left(storage_path, length(user_id::text || '/notes/' || note_id::text || '/'))
      = user_id::text || '/notes/' || note_id::text || '/'
    AND length(storage_path) > length(user_id::text || '/notes/' || note_id::text || '/')
    AND position('..' IN storage_path) = 0
    AND position('//' IN storage_path) = 0
    AND position('/./' IN storage_path) = 0
    AND right(storage_path, 1) <> '/'
  )
);

COMMENT ON TABLE public.note_photos IS
  'Photo attachments on notes. Files live in the maintenance-photos bucket under {userId}/notes/{noteId}/. Max 3 per note (trigger enforce_note_photos_limit; NOTE_PHOTOS_MAX in @motovault/types).';

CREATE INDEX idx_note_photos_note ON public.note_photos (note_id);
CREATE INDEX idx_note_photos_user ON public.note_photos (user_id);

-- Ownership of a note's links, independent of deleted_at (see header).
CREATE FUNCTION public.note_link_is_own(p_task_id uuid, p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (
      p_task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.maintenance_tasks t
        WHERE t.id = p_task_id AND t.user_id = (SELECT auth.uid())
      )
    )
    AND (
      p_expense_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.expenses e
        WHERE e.id = p_expense_id AND e.user_id = (SELECT auth.uid())
      )
    );
$$;

-- authenticated needs EXECUTE: a policy expression runs as the querying role.
REVOKE EXECUTE ON FUNCTION public.note_link_is_own(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_link_is_own(uuid, uuid) TO authenticated;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notes" ON public.notes
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id AND deleted_at IS NULL);

CREATE POLICY "Users insert own notes" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.motorcycles m
      WHERE m.id = motorcycle_id
        AND m.user_id = (SELECT auth.uid())
        AND m.deleted_at IS NULL
    )
    AND public.note_link_is_own(linked_task_id, linked_expense_id)
  );

-- WITH CHECK repeats the INSERT policy's bike clause, so an UPDATE cannot move
-- a note onto someone else's bike (motorcycle_id is an ordinary column; without
-- this, only the FK stood in the way). Consequence, accepted: the clause runs
-- under the motorcycles SELECT policy, so a note whose bike was soft-deleted
-- can no longer be edited. Such a note is unreachable in the app (the bike is
-- gone from the garage), it can still be read and soft-deleted, and keeping it
-- editable would have needed a second SECURITY DEFINER helper for no user-facing
-- gain.
CREATE POLICY "Users update own notes" ON public.notes
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.motorcycles m
      WHERE m.id = motorcycle_id
        AND m.user_id = (SELECT auth.uid())
        AND m.deleted_at IS NULL
    )
    AND public.note_link_is_own(linked_task_id, linked_expense_id)
  );

-- No DELETE policy: notes are soft-deleted through soft_delete_note().

-- WITH CHECK also ties the photo to one of the caller's own (live) notes:
-- user_id alone would let a caller attach a row to any note id they can guess.
CREATE POLICY "Users own note photos" ON public.note_photos
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_id AND n.user_id = (SELECT auth.uid())
    )
  );

-- Max 3 photos per note, enforced here as well as in notes.service, so a direct
-- PostgREST insert cannot exceed it. The advisory lock serialises concurrent
-- inserts for one note (the count would otherwise race). SECURITY DEFINER so the
-- count sees every row of the note, not only the ones RLS shows the caller.
CREATE FUNCTION public.enforce_note_photos_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('note_photos:' || NEW.note_id::text, 0));
  IF (SELECT count(*) FROM public.note_photos p WHERE p.note_id = NEW.note_id) >= 3 THEN
    RAISE EXCEPTION 'note_photos_limit' USING ERRCODE = '23514',
      DETAIL = 'A note can have at most 3 photos.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_note_photos_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_note_photos_limit
  BEFORE INSERT ON public.note_photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_photos_limit();

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.soft_delete_note(note_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.notes
  SET deleted_at = NOW()
  WHERE id = note_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Already deleted and still the caller's row -> idempotent success.
  RETURN EXISTS (
    SELECT 1 FROM public.notes
    WHERE id = note_id AND user_id = v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_note(uuid) TO authenticated;

COMMIT;
