-- Bike Hub: Cost tracking + mileage timestamp
-- Cost tracking on maintenance tasks
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) CHECK (cost >= 0),
  ADD COLUMN IF NOT EXISTS parts_cost DECIMAL(10,2) CHECK (parts_cost >= 0),
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(10,2) CHECK (labor_cost >= 0),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$');

-- Mileage timestamp on motorcycles
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS mileage_updated_at TIMESTAMPTZ;

-- DB trigger: auto-set mileage_updated_at when current_mileage changes
CREATE OR REPLACE FUNCTION public.set_mileage_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.current_mileage IS NOT NULL AND NEW.current_mileage > 0 THEN
    NEW.mileage_updated_at := NOW();
  ELSIF TG_OP = 'UPDATE' AND NEW.current_mileage IS DISTINCT FROM OLD.current_mileage THEN
    NEW.mileage_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_mileage_updated_at ON public.motorcycles;
CREATE TRIGGER trg_set_mileage_updated_at
  BEFORE INSERT OR UPDATE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.set_mileage_updated_at();

-- Backfill mileage_updated_at for bikes with mileage > 0
UPDATE public.motorcycles
  SET mileage_updated_at = updated_at
  WHERE current_mileage > 0 AND mileage_updated_at IS NULL;
