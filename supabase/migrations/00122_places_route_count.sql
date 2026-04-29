-- Add route_count column to places table.
-- Stores pre-computed count of published routes per country/region.

ALTER TABLE public.places ADD COLUMN route_count INT NOT NULL DEFAULT 0;

-- Backfill country route counts
UPDATE public.places p
SET route_count = sub.cnt
FROM (
  SELECT country_code, COUNT(*) AS cnt
  FROM public.routes
  WHERE status = 'published'
  GROUP BY country_code
) sub
WHERE p.kind = 'country'
  AND p.country_code = sub.country_code;

-- Backfill region route counts
UPDATE public.places p
SET route_count = sub.cnt
FROM (
  SELECT country_code, region_code, COUNT(*) AS cnt
  FROM public.routes
  WHERE status = 'published'
    AND region_code IS NOT NULL
  GROUP BY country_code, region_code
) sub
WHERE p.kind = 'region'
  AND p.country_code = sub.country_code
  AND p.region_code = sub.region_code;
