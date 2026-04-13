-- Materialized view: per-country percentile buckets for curvature_index
CREATE MATERIALIZED VIEW public.route_twist_buckets AS
SELECT
  country_code,
  percentile_cont(0.0) WITHIN GROUP (ORDER BY curvature_index) AS p0,
  percentile_cont(0.1) WITHIN GROUP (ORDER BY curvature_index) AS p10,
  percentile_cont(0.2) WITHIN GROUP (ORDER BY curvature_index) AS p20,
  percentile_cont(0.3) WITHIN GROUP (ORDER BY curvature_index) AS p30,
  percentile_cont(0.4) WITHIN GROUP (ORDER BY curvature_index) AS p40,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY curvature_index) AS p50,
  percentile_cont(0.6) WITHIN GROUP (ORDER BY curvature_index) AS p60,
  percentile_cont(0.7) WITHIN GROUP (ORDER BY curvature_index) AS p70,
  percentile_cont(0.8) WITHIN GROUP (ORDER BY curvature_index) AS p80,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY curvature_index) AS p90,
  percentile_cont(1.0) WITHIN GROUP (ORDER BY curvature_index) AS p100
FROM public.routes
WHERE curvature_index IS NOT NULL AND country_code IS NOT NULL
GROUP BY country_code;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_twist_buckets_country ON public.route_twist_buckets (country_code);
