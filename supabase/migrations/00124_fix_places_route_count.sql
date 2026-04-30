-- Fix missing countries and stale route_count in places table.
-- route_count now reflects trip templates (trips.is_template = true),
-- which replaced the legacy routes table as the canonical source.

-- 1. Insert missing countries that have trip templates but no places row.
INSERT INTO public.places (id, kind, name, country_code, latitude, longitude, route_count)
VALUES
  (6252002, 'country', 'Thailand',    'TH', 15.87, 100.99, 0),
  (6252003, 'country', 'New Zealand', 'NZ', -40.90, 174.89, 0)
ON CONFLICT DO NOTHING;

-- 2. Refresh route_count for ALL countries from trip templates.
UPDATE public.places p
SET route_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT UPPER(country_code) AS cc, COUNT(*) AS cnt
  FROM public.trips
  WHERE is_template = true AND is_flagged = false
  GROUP BY UPPER(country_code)
) sub
WHERE p.kind = 'country'
  AND UPPER(p.country_code) = sub.cc;

-- Zero out countries that no longer have any templates.
UPDATE public.places
SET route_count = 0
WHERE kind = 'country'
  AND UPPER(country_code) NOT IN (
    SELECT UPPER(country_code)
    FROM public.trips
    WHERE is_template = true AND is_flagged = false
  );

-- 3. Refresh route_count for regions from trip templates.
UPDATE public.places p
SET route_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT UPPER(country_code) AS cc, LOWER(region_code) AS rc, COUNT(*) AS cnt
  FROM public.trips
  WHERE is_template = true AND is_flagged = false
    AND region_code IS NOT NULL
  GROUP BY UPPER(country_code), LOWER(region_code)
) sub
WHERE p.kind = 'region'
  AND UPPER(p.country_code) = sub.cc
  AND LOWER(p.region_code) = sub.rc;

-- 4. Trigger to keep route_count in sync when templates change.
CREATE OR REPLACE FUNCTION public.sync_places_route_count()
RETURNS TRIGGER AS $$
DECLARE
  v_cc TEXT;
  v_rc TEXT;
BEGIN
  v_cc := UPPER(COALESCE(NEW.country_code, OLD.country_code));
  v_rc := LOWER(COALESCE(NEW.region_code, OLD.region_code));

  UPDATE public.places
  SET route_count = (
    SELECT COUNT(*) FROM public.trips
    WHERE is_template = true AND is_flagged = false
      AND UPPER(country_code) = v_cc
  )
  WHERE kind = 'country' AND UPPER(country_code) = v_cc;

  IF v_rc IS NOT NULL THEN
    UPDATE public.places
    SET route_count = (
      SELECT COUNT(*) FROM public.trips
      WHERE is_template = true AND is_flagged = false
        AND UPPER(country_code) = v_cc
        AND LOWER(region_code) = v_rc
    )
    WHERE kind = 'region'
      AND UPPER(country_code) = v_cc
      AND LOWER(region_code) = v_rc;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_places_route_count ON public.trips;
CREATE TRIGGER trg_sync_places_route_count
  AFTER INSERT OR UPDATE OF is_template, is_flagged, country_code, region_code
  OR DELETE
  ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_places_route_count();
