-- Migration: 00082_fk_cascade_fixes
-- P2-110: Add ON DELETE CASCADE to user_id FKs on new tables so Supabase
-- Auth user deletion doesn't fail or leave orphans.
--
-- expense_photos.user_id and fuel_logs.user_id previously had no ON DELETE
-- behaviour. Deleting a user via Supabase Admin either blocked or relied on
-- Postgres cascade ordering which is not guaranteed.

ALTER TABLE public.expense_photos
  DROP CONSTRAINT IF EXISTS expense_photos_user_id_fkey;

ALTER TABLE public.expense_photos
  ADD CONSTRAINT expense_photos_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.fuel_logs
  DROP CONSTRAINT IF EXISTS fuel_logs_user_id_fkey;

ALTER TABLE public.fuel_logs
  ADD CONSTRAINT fuel_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
