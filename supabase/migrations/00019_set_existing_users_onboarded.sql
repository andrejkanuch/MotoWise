-- Set onboarding_completed for all existing users so they skip onboarding.
-- New users get preferences = '{}' (from 00002 default), which means
-- onboardingCompleted is absent, correctly routing them to onboarding.
--
-- This migration is idempotent: the WHERE clause skips rows that already
-- have the onboardingCompleted key (regardless of value).
--
-- Pre-migration verification (run manually):
-- SELECT COUNT(*) FROM public.users WHERE preferences ? 'onboardingCompleted';
-- Expected: 0 (feature is new)
--
-- Rollback:
-- UPDATE public.users SET preferences = preferences - 'onboardingCompleted'
-- WHERE preferences ? 'onboardingCompleted';

UPDATE public.users
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"onboardingCompleted": true}'::jsonb
WHERE preferences IS NULL
   OR NOT (preferences ? 'onboardingCompleted');
