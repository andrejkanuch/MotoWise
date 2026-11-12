# Excluded PostHog persons (test + synthetic), used by every q0x query

Run 2026-11-12. Source: Supabase `public.users` (read-only SELECT via Management API) where
`is_synthetic = true`, the three owner/test emails, the six junk sign-ups soft-deleted on 2026-11-10,
`@motovault.app`, `@cloudtestlabaccounts.com`, `@priorises.com` → 26 user ids → mapped through
PostHog `person_distinct_ids` → 11 persons, plus one older owner test person from the project
test-account filter. Only 11 of 26 synthetic users have a PostHog person (the rest never consented / never
opened the app with analytics on).

`person_id NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)`

Not excluded (can't be identified in PostHog): Play pre-launch robots that never signed in, and the
TikTok ad-review crawler (web only; web queries filter `$raw_user_agent` ILIKE '%aweme%').
