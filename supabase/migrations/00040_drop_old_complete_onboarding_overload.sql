-- Migration: Drop old complete_onboarding overload (8 params)
-- The 00021 migration created an 8-param version, then 00023 added a 17-param version.
-- PostgreSQL treats different signatures as separate overloads, causing PGRST203.
-- Drop the old one so only the expanded version remains.

DROP FUNCTION IF EXISTS public.complete_onboarding(
  UUID, JSONB, TEXT, TEXT, INTEGER, motorcycle_type, INTEGER, TEXT
);
