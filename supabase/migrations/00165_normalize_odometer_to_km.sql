-- 00165_normalize_odometer_to_km.sql
--
-- Odometer / mileage unit normalization — Option A (canonical km).
-- See docs/plans/odometer-unit-normalization.md.
--
-- CONTRACT (after this migration): every persisted odometer/mileage integer is
-- KILOMETRES — motorcycles.current_mileage, maintenance_tasks.target_mileage,
-- completed_mileage, and interval_km. Display unit is derived from the user's
-- global users.measurement_system; motorcycles.mileage_unit is deprecated and is
-- normalized to 'km' here purely so any lingering reader sees the truth.
--
-- WHY measurement_system (not mileage_unit) is the source of truth: mileage_unit
-- defaults to 'mi' and was never kept in sync (on prod, 137 metric-owner bikes
-- still carry the 'mi' default). Since PR #164 the app has DISPLAYED values using
-- measurement_system, so that is the unit each stored number is actually in.
--
-- DATA-ONLY: no schema change (all columns are already INTEGER), so this produces
-- no database.types.ts diff. Converts ONLY imperial-owned rows (metric values are
-- already km). Verified prod scope (2026-07-16): 6 bikes, 101 target_mileage,
-- 6 completed_mileage. interval_km needs NO change (all populated rows are OEM/km;
-- user-entered intervals are all NULL).
--
-- IDEMPOTENT: steps 1-2 are guarded by `mileage_unit IS DISTINCT FROM 'km'`
-- (NULL-safe); step 3 flips every bike to 'km', so a re-run converts nothing. The
-- migration runner also records the version and will not re-run it.
--
-- GUARD CAVEAT + PRE-APPLY CHECK (must run first): the guard trusts `mileage_unit`
-- as the "still legacy miles" signal, but that column is the deprecated/unreliable
-- one (default 'mi', drifts from measurement_system). An imperial-owned bike whose
-- mileage_unit is ALREADY 'km' would be skipped by steps 1-2 and then stamped 'km'
-- by step 3 — leaving its odometer ~1.609x too small. Verified 0 such rows on prod
-- (2026-07-16), and migration-first ordering prevents new ones, but VERIFY before
-- applying; if it returns > 0, drop the guard and gate on measurement_system alone:
--   SELECT count(*) FROM public.motorcycles m JOIN public.users u ON u.id=m.user_id
--    WHERE u.measurement_system='imperial' AND m.mileage_unit='km';  -- expect 0
--
-- ORDERING (CRITICAL): apply this BEFORE promoting the km-aware OTA/build. If the
-- new client wrote canonical km while mileage_unit was still 'mi', this migration
-- would multiply those already-km values by KM_PER_MILE again. Running first means
-- no km writes exist until the data is converted. See the release runbook in
-- docs/plans/odometer-unit-normalization.md.
--
-- REVERSIBLE (rollback — run manually if needed, BEFORE any new writes):
--   BEGIN;
--   UPDATE public.maintenance_tasks mt SET
--     target_mileage    = CASE WHEN mt.target_mileage    IS NOT NULL
--                              THEN round(mt.target_mileage    / 1.609344) END,
--     completed_mileage = CASE WHEN mt.completed_mileage IS NOT NULL
--                              THEN round(mt.completed_mileage / 1.609344) END
--   FROM public.motorcycles m JOIN public.users u ON u.id = m.user_id
--   WHERE mt.motorcycle_id = m.id AND u.measurement_system = 'imperial';
--   -- (no deleted_at filter — mirrors the forward step, which converts every
--   --  imperial-owned task row incl. soft-deleted, so rollback must too.)
--   UPDATE public.motorcycles m SET
--     current_mileage = round(m.current_mileage / 1.609344),
--     mileage_unit    = 'mi'
--   FROM public.users u
--   WHERE u.id = m.user_id AND u.measurement_system = 'imperial';
--   COMMIT;
-- (Rounding is deterministic; a round-trip may differ by <=1 unit — negligible
--  for an odometer.)
--
-- PRE-IMAGE SNAPSHOT (capture before applying, for audit/rollback verification):
--   SELECT m.id, m.current_mileage, m.mileage_unit, u.measurement_system
--     FROM public.motorcycles m JOIN public.users u ON u.id = m.user_id
--    WHERE u.measurement_system = 'imperial';
--   SELECT mt.id, mt.target_mileage, mt.completed_mileage
--     FROM public.maintenance_tasks mt
--     JOIN public.motorcycles m ON m.id = mt.motorcycle_id
--     JOIN public.users u ON u.id = m.user_id
--    WHERE u.measurement_system = 'imperial';
--
-- POST-DEPLOY VERIFICATION (run after applying; both expect 0):
--   -- no imperial-owned bike left unflagged as km:
--   SELECT count(*) FROM public.motorcycles m JOIN public.users u ON u.id=m.user_id
--    WHERE u.measurement_system='imperial' AND m.mileage_unit IS DISTINCT FROM 'km';
--   -- no bike left with a stale non-km unit at all (step 3 covers everyone):
--   SELECT count(*) FROM public.motorcycles WHERE mileage_unit IS DISTINCT FROM 'km';
-- Also confirm the converted row counts match the pre-image snapshot (prod
-- 2026-07-16 scope: 6 bikes, 101 target_mileage, 6 completed_mileage).

BEGIN;

-- 1) maintenance_tasks target/completed for imperial owners (guard on the bike's
--    pre-state mileage_unit, NULL-safe; runs before step 3 flips it). No deleted_at
--    filter — soft-deleted rows are converted too so the km contract holds if a
--    task is ever restored; the rollback mirrors this.
UPDATE public.maintenance_tasks mt
SET
  target_mileage    = CASE WHEN mt.target_mileage    IS NOT NULL
                           THEN round(mt.target_mileage    * 1.609344)::int END,
  completed_mileage = CASE WHEN mt.completed_mileage IS NOT NULL
                           THEN round(mt.completed_mileage * 1.609344)::int END
FROM public.motorcycles m
JOIN public.users u ON u.id = m.user_id
WHERE mt.motorcycle_id = m.id
  AND u.measurement_system = 'imperial'
  AND m.mileage_unit IS DISTINCT FROM 'km'
  AND (mt.target_mileage IS NOT NULL OR mt.completed_mileage IS NOT NULL);

-- 2) motorcycles.current_mileage for imperial owners (same NULL-safe guard).
UPDATE public.motorcycles m
SET current_mileage = round(m.current_mileage * 1.609344)::int
FROM public.users u
WHERE u.id = m.user_id
  AND u.measurement_system = 'imperial'
  AND m.mileage_unit IS DISTINCT FROM 'km'
  AND m.current_mileage > 0;

-- 3) Deprecate the per-bike unit: every stored number is now km. Making the
--    column uniformly 'km' also serves as the idempotency guard for steps 1-2.
UPDATE public.motorcycles SET mileage_unit = 'km' WHERE mileage_unit IS DISTINCT FROM 'km';

COMMIT;
