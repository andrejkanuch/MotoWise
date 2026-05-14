-- Fix get_make_stats() performance: GROUP BY raw column instead of initcap()
-- wrapping, and remove redundant HAVING clause.
--
-- Problems fixed:
--   1. GROUP BY initcap(m.make) prevents index usage on the `make` column.
--      Since makes are already stored in ALL CAPS, we GROUP BY m.make and
--      apply initcap() only in the SELECT list for display.
--   2. HAVING COUNT(DISTINCT m.user_id) >= 1 is always true after GROUP BY
--      and adds unnecessary overhead — removed.

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
    initcap(m.make) AS make,
    COUNT(DISTINCT m.user_id) AS riders,
    COUNT(DISTINCT m.model) AS distinct_models,
    COUNT(*) AS total_bikes
  FROM motorcycles m
  WHERE m.make IS NOT NULL
    AND m.make != ''
    AND m.deleted_at IS NULL
  GROUP BY m.make
  ORDER BY riders DESC, total_bikes DESC;
$$;

-- Restrict access: only service-role (admin) may call this function
REVOKE EXECUTE ON FUNCTION get_make_stats() FROM public;
REVOKE EXECUTE ON FUNCTION get_make_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_make_stats() TO service_role;

-- Partial index to support the WHERE/GROUP BY in get_make_stats()
CREATE INDEX IF NOT EXISTS idx_motorcycles_make_active
  ON public.motorcycles (make)
  WHERE make IS NOT NULL AND make != '' AND deleted_at IS NULL;
