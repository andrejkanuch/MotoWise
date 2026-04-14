-- Migration: Upgrade typeahead_search RPC to use word_similarity for better partial-word matching
-- word_similarity('pac', 'Pacific Coast Highway') ~ 0.75 vs similarity() ~ 0.12
-- Uses explicit threshold instead of set_limit() to avoid leaking across pooled connections

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
      (
        word_similarity(search_term, r.name) * 0.50
        + CASE WHEN r.is_motovault_pick THEN 0.15 ELSE 0 END
        + LEAST(COALESCE(r.rating_avg, 0) / 5.0, 1.0) * 0.20
        + LEAST(COALESCE(r.rating_count, 0)::FLOAT / 50.0, 1.0) * 0.15
      ) AS sim
    FROM public.routes r
    WHERE word_similarity(search_term, r.name) >= 0.15
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
      (
        word_similarity(search_term, p.name) * 0.60
        + CASE p.kind
            WHEN 'country' THEN 0.25
            WHEN 'region'  THEN 0.15
            WHEN 'city'    THEN 0.10
          END
        + LEAST(COALESCE(p.population, 0)::FLOAT / 10000000.0, 1.0) * 0.15
      ) AS sim
    FROM public.places p
    WHERE word_similarity(search_term, p.name) >= 0.15
    ORDER BY sim DESC, p.population DESC NULLS LAST
    LIMIT result_limit
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';
