-- 00193: only a ride's owner can link a trip to it through trips.source_ride_id.
--
-- 00192 added trips.source_ride_id with a one-template-per-ride unique index,
-- but trips_insert / trips_update only check organiser_user_id = auth.uid().
-- Any signed-in user could insert a template pointing at another rider's ride
-- straight through PostgREST, take that ride's only slot, and turn the owner's
-- "share to Discover" into a permanent "already shared". The FK also told them
-- whether a guessed ride id existed. shareRideAsTrip checks ownership; this
-- enforces the same rule in the database, where the column's guarantee lives.
--
-- - INSERT, or an UPDATE that sets a new non-null value: the ride must belong
--   to the trip's organiser.
-- - UPDATE to a different non-null ride is refused: the link is set once.
-- - UPDATE to NULL is allowed, because ON DELETE SET NULL runs as an UPDATE and
--   fires this trigger when the ride is deleted.
--
-- SECURITY DEFINER so the ride lookup does not depend on the caller's RLS view
-- of rides; search_path is pinned. A trigger function cannot be called as an RPC.

CREATE OR REPLACE FUNCTION public.trips_check_source_ride_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_ride_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.source_ride_id IS NOT DISTINCT FROM NEW.source_ride_id THEN
      RETURN NEW;
    END IF;
    IF OLD.source_ride_id IS NOT NULL THEN
      RAISE EXCEPTION 'trips.source_ride_id is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = NEW.source_ride_id
      AND r.user_id = NEW.organiser_user_id
  ) THEN
    RAISE EXCEPTION 'trips.source_ride_id must reference a ride owned by the organiser'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_trips_check_source_ride_owner ON public.trips;

CREATE TRIGGER trg_trips_check_source_ride_owner
  BEFORE INSERT OR UPDATE OF source_ride_id ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_check_source_ride_owner();
