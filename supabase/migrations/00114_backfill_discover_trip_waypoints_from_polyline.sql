-- Migration: 00114_backfill_discover_trip_waypoints_from_polyline
--
-- All 40 migrated routes have NULL start_point/end_point but valid polylines.
-- This backfill decodes the first/last points from each polyline and sets
-- start/end waypoints + start_point geography.

BEGIN;

-- Temporary polyline decoder function
CREATE OR REPLACE FUNCTION pg_temp.decode_polyline_endpoints(encoded TEXT)
RETURNS TABLE(start_lat FLOAT, start_lng FLOAT, end_lat FLOAT, end_lng FLOAT) AS $$
DECLARE
  idx INT := 1;
  len INT;
  b INT;
  shift INT;
  result INT;
  lat FLOAT := 0;
  lng FLOAT := 0;
  first_lat FLOAT;
  first_lng FLOAT;
  last_lat FLOAT;
  last_lng FLOAT;
  is_first BOOLEAN := true;
BEGIN
  len := length(encoded);
  WHILE idx <= len LOOP
    shift := 0; result := 0;
    LOOP
      b := ascii(substring(encoded FROM idx FOR 1)) - 63;
      idx := idx + 1;
      result := result | ((b & 31) << shift);
      shift := shift + 5;
      EXIT WHEN b < 32;
    END LOOP;
    IF (result & 1) = 1 THEN lat := lat + (-(result >> 1) - 1);
    ELSE lat := lat + (result >> 1);
    END IF;

    shift := 0; result := 0;
    LOOP
      b := ascii(substring(encoded FROM idx FOR 1)) - 63;
      idx := idx + 1;
      result := result | ((b & 31) << shift);
      shift := shift + 5;
      EXIT WHEN b < 32;
    END LOOP;
    IF (result & 1) = 1 THEN lng := lng + (-(result >> 1) - 1);
    ELSE lng := lng + (result >> 1);
    END IF;

    IF is_first THEN
      first_lat := lat / 100000.0;
      first_lng := lng / 100000.0;
      is_first := false;
    END IF;
    last_lat := lat / 100000.0;
    last_lng := lng / 100000.0;
  END LOOP;

  RETURN QUERY SELECT first_lat, first_lng, last_lat, last_lng;
END;
$$ LANGUAGE plpgsql;

-- Step 1: Compute endpoints into a temp table
CREATE TEMP TABLE _endpoints AS
SELECT
  dt.id AS discover_trip_id,
  ep.start_lat, ep.start_lng, ep.end_lat, ep.end_lng
FROM public.discover_trips dt
CROSS JOIN LATERAL pg_temp.decode_polyline_endpoints(dt.polyline) ep
WHERE dt.polyline IS NOT NULL
  AND jsonb_array_length(dt.waypoints) = 0;

-- Step 2: Update discover_trips from the temp table
UPDATE public.discover_trips dt
SET
  waypoints = jsonb_build_array(
    jsonb_build_object(
      'sortOrder', 0, 'dayIndex', 0, 'type', 'start', 'name', 'Start',
      'lat', ep.start_lat, 'lng', ep.start_lng
    ),
    jsonb_build_object(
      'sortOrder', 1, 'dayIndex', 0, 'type', 'end', 'name', 'End',
      'lat', ep.end_lat, 'lng', ep.end_lng
    )
  ),
  start_point = ST_SetSRID(ST_MakePoint(ep.start_lng, ep.start_lat), 4326)::geography
FROM _endpoints ep
WHERE dt.id = ep.discover_trip_id;

DROP TABLE _endpoints;

COMMIT;
