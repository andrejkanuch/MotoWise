-- Add measurement system preference to users (metric or imperial)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS measurement_system TEXT NOT NULL DEFAULT 'metric'
  CHECK (measurement_system IN ('metric', 'imperial'));

-- Comment
COMMENT ON COLUMN public.users.measurement_system IS 'User display preference: metric (km, celsius, bar) or imperial (mi, fahrenheit, PSI)';
