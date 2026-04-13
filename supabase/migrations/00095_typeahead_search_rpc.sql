-- Migration: RPC function for typeahead search using pg_trgm fuzzy matching
-- Part of MOT-155 — typeahead resolver

-- ==========================================
-- FUNCTION: typeahead_search(search_term, result_limit)
-- Returns UNION of route + place suggestions ranked by trigram similarity
-- ==========================================
CREATE OR REPLACE FUNCTION public.typeahead_search(
  search_term TEXT,
  result_limit INT DEFAULT 8
)
RETURNS TABLE (
  source      TEXT,
  id          TEXT,
  name        TEXT,
  slug        TEXT,
  kind        TEXT,
  country_code TEXT,
  region_code TEXT,
  population  INT,
  sim         FLOAT
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT
      'route'::TEXT                AS source,
      r.id::TEXT                   AS id,
      r.name::TEXT                 AS name,
      r.slug::TEXT                 AS slug,
      NULL::TEXT                   AS kind,
      r.country_code::TEXT         AS country_code,
      r.region_code::TEXT          AS region_code,
      NULL::INT                    AS population,
      similarity(r.name, search_term) AS sim
    FROM public.routes r
    WHERE r.name % search_term
      AND r.status = 'published'
    ORDER BY sim DESC, r.rating_avg DESC NULLS LAST
    LIMIT result_limit
  )
  UNION ALL
  (
    SELECT
      'place'::TEXT                AS source,
      p.id::TEXT                   AS id,
      p.name::TEXT                 AS name,
      NULL::TEXT                   AS slug,
      p.kind::TEXT                 AS kind,
      p.country_code::TEXT         AS country_code,
      p.region_code::TEXT          AS region_code,
      p.population::INT           AS population,
      similarity(p.name, search_term) AS sim
    FROM public.places p
    WHERE p.name % search_term
    ORDER BY sim DESC, p.population DESC NULLS LAST
    LIMIT result_limit
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';
