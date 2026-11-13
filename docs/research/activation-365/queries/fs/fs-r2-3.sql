-- FS-R2-3 - changing make/model/year refreshes the schedule
-- Plan: EXECUTION_PLAN.md §5 FS-R2-3
-- Placeholders: {RN} = properties.$lib = 'posthog-react-native' (never on server events such as signup_completed);
-- {EXCL} = the exclusion predicate in queries/q00-excluded-persons.md (14 person ids + e2e_run + {E2E_PERSONS}).
-- Platform `plat` = person-level platform with the $app_build fallback (plan §0 {REL}; valid for 3.26.0-3.28.x only,
-- so `android?` rows on 3.19.x-3.21.x are old iOS builds below 100). PostHog project 155556, execute-sql, read-only.
-- Dashboard tile (T03b): yes
-- run 2026-11-13: event form: not measurable until T05d/T23 (garage_bike_edited). DB proxy (Supabase, 2026-11-13): 117 live
--   blank-model bikes, 7 ever with a task [V1-db5 116/7; R2-DB6 117/7].

-- event form after T05d (garage_bike_edited) -- draft
SELECT toString(properties.$app_version) AS ver,
  uniqIf(person_id, event = 'garage_bike_edited' AND toString(properties.from_capture_level) = 'make'
         AND has(JSONExtractArrayRaw(toString(properties.changed_fields)), '"model"')) AS make_only_riders_set_model
FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL} AND event = 'garage_bike_edited'
GROUP BY ver;

-- DB proxy (Supabase Management API, read-only):
-- BEGIN READ ONLY;
-- select count(*) as live_blank_model_bikes,
--   count(*) filter (where exists (select 1 from public.maintenance_tasks t where t.motorcycle_id = m.id)) as with_any_task_ever
-- from public.motorcycles m join public.users u on u.id = m.user_id
-- where m.deleted_at is null and coalesce(trim(m.model), '') = '' and u.deleted_at is null
--   and <exclusion on u., queries/db/README.md>;
-- COMMIT;
