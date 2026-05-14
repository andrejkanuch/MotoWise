-- Aggregate fleet stats per motorcycle make.
-- Used by the onboarding bike-setup screen to show real community data.
-- Returns only makes with at least 1 rider, ordered by rider count DESC.

CREATE OR REPLACE FUNCTION get_make_stats()
RETURNS TABLE (
  make          text,
  riders        bigint,
  distinct_models bigint,
  total_bikes   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- Normalize NHTSA uppercase to title case for display
    initcap(m.make) AS make,
    COUNT(DISTINCT m.user_id) AS riders,
    COUNT(DISTINCT m.model) AS distinct_models,
    COUNT(*) AS total_bikes
  FROM motorcycles m
  WHERE m.make IS NOT NULL
    AND m.make != ''
    AND m.deleted_at IS NULL
  GROUP BY initcap(m.make)
  HAVING COUNT(DISTINCT m.user_id) >= 1
  ORDER BY riders DESC, total_bikes DESC;
$$;

-- Restrict access: only service-role (admin) may call this function
REVOKE EXECUTE ON FUNCTION get_make_stats() FROM public;
REVOKE EXECUTE ON FUNCTION get_make_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_make_stats() TO service_role;
