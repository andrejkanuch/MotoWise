-- Smart Maintenance Hub: OEM schedules, task extensions, photo attachments, share links
-- MOT-61 (sub-issues: MOT-71, MOT-73, MOT-74, MOT-75, MOT-76)

-- Enable pgcrypto for gen_random_bytes (used in share link token generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ==========================================
-- 1. OEM Maintenance Schedules (reference data)
-- ==========================================
CREATE TABLE public.oem_maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT,                    -- NULL = generic for this make
  year_from INT,                 -- NULL = all years
  year_to INT,
  task_name TEXT NOT NULL,
  description TEXT,
  interval_km INT,               -- e.g. 5000
  interval_days INT,             -- e.g. 180 (6 months)
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  engine_type TEXT,              -- 'single','twin','inline-4','v-twin', NULL = all
  engine_cc_min INT,             -- NULL = any
  engine_cc_max INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for 3-level fallback lookup
CREATE INDEX idx_oem_schedules_lookup ON public.oem_maintenance_schedules (make, model);
CREATE INDEX idx_oem_schedules_make_generic ON public.oem_maintenance_schedules (make) WHERE model IS NULL;

-- No RLS: read-only reference data accessed via API service with SUPABASE_ADMIN

-- ==========================================
-- 2. Extend maintenance_tasks
-- ==========================================
ALTER TABLE public.maintenance_tasks
  ADD COLUMN source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'oem', 'imported')),
  ADD COLUMN oem_schedule_id UUID REFERENCES public.oem_maintenance_schedules(id),
  ADD COLUMN interval_km INT,
  ADD COLUMN interval_days INT,
  ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_maintenance_tasks_source ON public.maintenance_tasks (source);
CREATE INDEX idx_maintenance_tasks_oem_schedule ON public.maintenance_tasks (oem_schedule_id) WHERE oem_schedule_id IS NOT NULL;

-- ==========================================
-- 3. Maintenance Task Photos (MOT-74)
-- ==========================================
CREATE TABLE public.maintenance_task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  file_size_bytes INT,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_photos_task ON public.maintenance_task_photos (task_id);
CREATE INDEX idx_task_photos_user ON public.maintenance_task_photos (user_id);

ALTER TABLE public.maintenance_task_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own task photos" ON public.maintenance_task_photos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins read all task photos" ON public.maintenance_task_photos
  FOR SELECT USING (public.is_admin());

-- ==========================================
-- 4. Share Links (MOT-76)
-- ==========================================
CREATE TABLE public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON public.share_links (token);
CREATE INDEX idx_share_links_expires ON public.share_links (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_share_links_user_motorcycle ON public.share_links (user_id, motorcycle_id);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own share links" ON public.share_links
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Anon can read by token (service layer MUST filter by token)
-- Token is 256-bit random (64 hex chars) — enumeration is infeasible
CREATE POLICY "Anon read share links" ON public.share_links
  FOR SELECT TO anon USING (true);

-- ==========================================
-- 5. Maintenance Photos Storage Bucket
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('maintenance-photos', 'maintenance-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY "Users upload maintenance photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'maintenance-photos' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Users delete maintenance photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'maintenance-photos' AND (SELECT auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Public read maintenance photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'maintenance-photos');

-- ==========================================
-- 6. OEM Maintenance Schedule Seed Data
-- ==========================================

-- Generic fallback schedule (for any unknown make)
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('GENERIC', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('GENERIC', NULL, 'Air Filter', 'Inspect and replace air filter element', 10000, 365, 'medium', 2),
  ('GENERIC', NULL, 'Spark Plugs', 'Inspect and replace spark plugs', 15000, 730, 'medium', 3),
  ('GENERIC', NULL, 'Brake Fluid', 'Replace brake fluid (DOT4)', 20000, 730, 'high', 4),
  ('GENERIC', NULL, 'Coolant', 'Replace engine coolant', 30000, 730, 'medium', 5),
  ('GENERIC', NULL, 'Chain Clean & Lube', 'Clean, lubricate, and adjust drive chain', 1000, 30, 'medium', 6),
  ('GENERIC', NULL, 'Tire Pressure Check', 'Check and adjust tire pressure', NULL, 14, 'low', 7),
  ('GENERIC', NULL, 'Valve Clearance', 'Check and adjust valve clearance', 25000, NULL, 'high', 8),
  ('GENERIC', NULL, 'Fork Oil', 'Replace fork oil and inspect seals', 30000, 730, 'medium', 9),
  ('GENERIC', NULL, 'Brake Pads Inspection', 'Inspect brake pad wear and replace if needed', 10000, 365, 'high', 10);

-- Honda
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Honda', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 180, 'high', 1),
  ('Honda', NULL, 'Air Filter', 'Inspect and replace air filter', 12000, 365, 'medium', 2),
  ('Honda', NULL, 'Spark Plugs', 'Replace spark plugs', 16000, 730, 'medium', 3),
  ('Honda', NULL, 'Brake Fluid', 'Replace brake fluid', 24000, 730, 'high', 4),
  ('Honda', NULL, 'Coolant', 'Replace coolant', 24000, 730, 'medium', 5),
  ('Honda', NULL, 'Chain Clean & Lube', 'Clean and lubricate drive chain', 1000, 30, 'medium', 6),
  ('Honda', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Honda', NULL, 'Valve Clearance', 'Inspect valve clearance', 24000, NULL, 'high', 8),
  ('Honda', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', 9),
  ('Honda', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 12000, 365, 'high', 10);

-- Yamaha
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Yamaha', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('Yamaha', NULL, 'Air Filter', 'Inspect and replace air filter', 10000, 365, 'medium', 2),
  ('Yamaha', NULL, 'Spark Plugs', 'Replace spark plugs', 20000, 730, 'medium', 3),
  ('Yamaha', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Yamaha', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('Yamaha', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Yamaha', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Yamaha', NULL, 'Valve Clearance', 'Inspect valve clearance', 25000, NULL, 'high', 8),
  ('Yamaha', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', 9),
  ('Yamaha', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- Kawasaki
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Kawasaki', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 180, 'high', 1),
  ('Kawasaki', NULL, 'Air Filter', 'Inspect and replace air filter', 12000, 365, 'medium', 2),
  ('Kawasaki', NULL, 'Spark Plugs', 'Replace spark plugs', 15000, 730, 'medium', 3),
  ('Kawasaki', NULL, 'Brake Fluid', 'Replace brake fluid', 24000, 730, 'high', 4),
  ('Kawasaki', NULL, 'Coolant', 'Replace coolant', 30000, 730, 'medium', 5),
  ('Kawasaki', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Kawasaki', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Kawasaki', NULL, 'Valve Clearance', 'Inspect valve clearance', 25000, NULL, 'high', 8),
  ('Kawasaki', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', 9),
  ('Kawasaki', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 12000, 365, 'high', 10);

-- Suzuki
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Suzuki', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 180, 'high', 1),
  ('Suzuki', NULL, 'Air Filter', 'Inspect and replace air filter', 12000, 365, 'medium', 2),
  ('Suzuki', NULL, 'Spark Plugs', 'Replace spark plugs', 15000, 730, 'medium', 3),
  ('Suzuki', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Suzuki', NULL, 'Coolant', 'Replace coolant', 24000, 730, 'medium', 5),
  ('Suzuki', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Suzuki', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Suzuki', NULL, 'Valve Clearance', 'Inspect valve clearance', 25000, NULL, 'high', 8),
  ('Suzuki', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', 9),
  ('Suzuki', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 12000, 365, 'high', 10);

-- Harley-Davidson (longer intervals, no chain)
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Harley-Davidson', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 8000, 365, 'high', 1),
  ('Harley-Davidson', NULL, 'Air Filter', 'Inspect and replace air filter', 16000, 730, 'medium', 2),
  ('Harley-Davidson', NULL, 'Spark Plugs', 'Replace spark plugs', 24000, 730, 'medium', 3),
  ('Harley-Davidson', NULL, 'Brake Fluid', 'Replace brake fluid', 16000, 730, 'high', 4),
  ('Harley-Davidson', NULL, 'Primary & Transmission Fluid', 'Replace primary and transmission fluid', 16000, 365, 'high', 5),
  ('Harley-Davidson', NULL, 'Belt Inspection', 'Inspect drive belt tension and condition', 8000, 365, 'medium', 6),
  ('Harley-Davidson', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Harley-Davidson', NULL, 'Valve Clearance', 'Inspect valve clearance (Sportster)', 25000, NULL, 'high', 8),
  ('Harley-Davidson', NULL, 'Fork Oil', 'Replace fork oil', 40000, 730, 'medium', 9),
  ('Harley-Davidson', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 16000, 365, 'high', 10);

-- BMW
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('BMW', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 10000, 365, 'high', 1),
  ('BMW', NULL, 'Air Filter', 'Replace air filter', 20000, 730, 'medium', 2),
  ('BMW', NULL, 'Spark Plugs', 'Replace spark plugs', 20000, 730, 'medium', 3),
  ('BMW', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('BMW', NULL, 'Coolant', 'Replace coolant', 40000, 1460, 'medium', 5),
  ('BMW', NULL, 'Final Drive Oil', 'Replace final drive (shaft) oil', 20000, 730, 'medium', 6),
  ('BMW', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('BMW', NULL, 'Valve Clearance', 'Check valve clearance', 20000, NULL, 'high', 8),
  ('BMW', NULL, 'Fork Oil', 'Replace fork oil', 40000, 730, 'medium', 9),
  ('BMW', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- Ducati
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Ducati', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 365, 'high', 1),
  ('Ducati', NULL, 'Air Filter', 'Replace air filter', 12000, 730, 'medium', 2),
  ('Ducati', NULL, 'Spark Plugs', 'Replace spark plugs', 12000, 730, 'medium', 3),
  ('Ducati', NULL, 'Brake Fluid', 'Replace brake fluid', 24000, 730, 'high', 4),
  ('Ducati', NULL, 'Coolant', 'Replace coolant', 24000, 730, 'medium', 5),
  ('Ducati', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Ducati', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Ducati', NULL, 'Valve Clearance (Desmo)', 'Desmodromic valve service', 12000, NULL, 'critical', 8),
  ('Ducati', NULL, 'Fork Oil', 'Replace fork oil', 24000, 730, 'medium', 9),
  ('Ducati', NULL, 'Timing Belt', 'Replace timing belt', 24000, NULL, 'critical', 10);

-- KTM
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('KTM', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('KTM', NULL, 'Air Filter', 'Clean/replace air filter', 5000, 180, 'medium', 2),
  ('KTM', NULL, 'Spark Plugs', 'Replace spark plugs', 15000, 730, 'medium', 3),
  ('KTM', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('KTM', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('KTM', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 500, 14, 'medium', 6),
  ('KTM', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('KTM', NULL, 'Valve Clearance', 'Check valve clearance', 15000, NULL, 'high', 8),
  ('KTM', NULL, 'Fork Oil', 'Replace fork oil', 20000, 365, 'medium', 9),
  ('KTM', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 5000, 180, 'high', 10);

-- Triumph
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Triumph', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 10000, 365, 'high', 1),
  ('Triumph', NULL, 'Air Filter', 'Replace air filter', 20000, 730, 'medium', 2),
  ('Triumph', NULL, 'Spark Plugs', 'Replace spark plugs', 20000, 730, 'medium', 3),
  ('Triumph', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Triumph', NULL, 'Coolant', 'Replace coolant', 40000, 730, 'medium', 5),
  ('Triumph', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Triumph', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Triumph', NULL, 'Valve Clearance', 'Check valve clearance', 20000, NULL, 'high', 8),
  ('Triumph', NULL, 'Fork Oil', 'Replace fork oil', 40000, 730, 'medium', 9),
  ('Triumph', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- Aprilia
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Aprilia', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 365, 'high', 1),
  ('Aprilia', NULL, 'Air Filter', 'Replace air filter', 12000, 730, 'medium', 2),
  ('Aprilia', NULL, 'Spark Plugs', 'Replace spark plugs', 12000, 730, 'medium', 3),
  ('Aprilia', NULL, 'Brake Fluid', 'Replace brake fluid', 24000, 730, 'high', 4),
  ('Aprilia', NULL, 'Coolant', 'Replace coolant', 24000, 730, 'medium', 5),
  ('Aprilia', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Aprilia', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Aprilia', NULL, 'Valve Clearance', 'Check valve clearance', 12000, NULL, 'high', 8),
  ('Aprilia', NULL, 'Fork Oil', 'Replace fork oil', 24000, 730, 'medium', 9),
  ('Aprilia', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 12000, 365, 'high', 10);

-- Indian
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Indian', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 8000, 365, 'high', 1),
  ('Indian', NULL, 'Air Filter', 'Replace air filter', 16000, 730, 'medium', 2),
  ('Indian', NULL, 'Spark Plugs', 'Replace spark plugs', 24000, 730, 'medium', 3),
  ('Indian', NULL, 'Brake Fluid', 'Replace brake fluid', 16000, 730, 'high', 4),
  ('Indian', NULL, 'Primary Oil', 'Replace primary chaincase oil', 8000, 365, 'medium', 5),
  ('Indian', NULL, 'Belt Inspection', 'Inspect drive belt', 8000, 365, 'medium', 6),
  ('Indian', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Indian', NULL, 'Fork Oil', 'Replace fork oil', 40000, 730, 'medium', 9),
  ('Indian', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 16000, 365, 'high', 10);

-- Moto Guzzi
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Moto Guzzi', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 10000, 365, 'high', 1),
  ('Moto Guzzi', NULL, 'Air Filter', 'Replace air filter', 20000, 730, 'medium', 2),
  ('Moto Guzzi', NULL, 'Spark Plugs', 'Replace spark plugs', 20000, 730, 'medium', 3),
  ('Moto Guzzi', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Moto Guzzi', NULL, 'Final Drive Oil', 'Replace shaft drive oil', 20000, 730, 'medium', 5),
  ('Moto Guzzi', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Moto Guzzi', NULL, 'Valve Clearance', 'Check valve clearance', 10000, NULL, 'high', 8),
  ('Moto Guzzi', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', 9),
  ('Moto Guzzi', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- Royal Enfield
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Royal Enfield', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('Royal Enfield', NULL, 'Air Filter', 'Replace air filter', 10000, 365, 'medium', 2),
  ('Royal Enfield', NULL, 'Spark Plugs', 'Replace spark plugs', 10000, 365, 'medium', 3),
  ('Royal Enfield', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Royal Enfield', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('Royal Enfield', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 500, 14, 'medium', 6),
  ('Royal Enfield', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Royal Enfield', NULL, 'Valve Clearance', 'Check valve clearance', 10000, NULL, 'high', 8),
  ('Royal Enfield', NULL, 'Fork Oil', 'Replace fork oil', 20000, 730, 'medium', 9),
  ('Royal Enfield', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 5000, 180, 'high', 10);

-- Husqvarna
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Husqvarna', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('Husqvarna', NULL, 'Air Filter', 'Clean/replace air filter', 5000, 180, 'medium', 2),
  ('Husqvarna', NULL, 'Spark Plugs', 'Replace spark plugs', 15000, 730, 'medium', 3),
  ('Husqvarna', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Husqvarna', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('Husqvarna', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 500, 14, 'medium', 6),
  ('Husqvarna', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Husqvarna', NULL, 'Valve Clearance', 'Check valve clearance', 15000, NULL, 'high', 8),
  ('Husqvarna', NULL, 'Fork Oil', 'Replace fork oil', 20000, 365, 'medium', 9),
  ('Husqvarna', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 5000, 180, 'high', 10);

-- MV Agusta
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('MV Agusta', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 6000, 365, 'high', 1),
  ('MV Agusta', NULL, 'Air Filter', 'Replace air filter', 12000, 730, 'medium', 2),
  ('MV Agusta', NULL, 'Spark Plugs', 'Replace spark plugs', 12000, 730, 'medium', 3),
  ('MV Agusta', NULL, 'Brake Fluid', 'Replace brake fluid', 24000, 730, 'high', 4),
  ('MV Agusta', NULL, 'Coolant', 'Replace coolant', 24000, 730, 'medium', 5),
  ('MV Agusta', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('MV Agusta', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('MV Agusta', NULL, 'Fork Oil', 'Replace fork oil', 24000, 730, 'medium', 9),
  ('MV Agusta', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 12000, 365, 'high', 10);

-- Benelli
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Benelli', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('Benelli', NULL, 'Air Filter', 'Replace air filter', 10000, 365, 'medium', 2),
  ('Benelli', NULL, 'Spark Plugs', 'Replace spark plugs', 10000, 730, 'medium', 3),
  ('Benelli', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Benelli', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('Benelli', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('Benelli', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Benelli', NULL, 'Fork Oil', 'Replace fork oil', 20000, 730, 'medium', 9),
  ('Benelli', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- CF Moto
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('CF Moto', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('CF Moto', NULL, 'Air Filter', 'Replace air filter', 10000, 365, 'medium', 2),
  ('CF Moto', NULL, 'Spark Plugs', 'Replace spark plugs', 10000, 730, 'medium', 3),
  ('CF Moto', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('CF Moto', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('CF Moto', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', 6),
  ('CF Moto', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('CF Moto', NULL, 'Fork Oil', 'Replace fork oil', 20000, 730, 'medium', 9),
  ('CF Moto', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);

-- Zero (electric — no oil, no spark plugs, no coolant)
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, engine_type, sort_order) VALUES
  ('Zero', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', NULL, 1),
  ('Zero', NULL, 'Chain Clean & Lube', 'Clean and lubricate chain', 1000, 30, 'medium', NULL, 2),
  ('Zero', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', NULL, 3),
  ('Zero', NULL, 'Fork Oil', 'Replace fork oil', 30000, 730, 'medium', NULL, 4),
  ('Zero', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', NULL, 5),
  ('Zero', NULL, 'Battery Health Check', 'Check battery health and connections', NULL, 365, 'high', NULL, 6),
  ('Zero', NULL, 'Belt Inspection', 'Inspect drive belt tension and wear', 10000, 365, 'medium', NULL, 7);

-- Can-Am
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Can-Am', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 8000, 365, 'high', 1),
  ('Can-Am', NULL, 'Air Filter', 'Replace air filter', 16000, 730, 'medium', 2),
  ('Can-Am', NULL, 'Spark Plugs', 'Replace spark plugs', 16000, 730, 'medium', 3),
  ('Can-Am', NULL, 'Brake Fluid', 'Replace brake fluid', 16000, 730, 'high', 4),
  ('Can-Am', NULL, 'Coolant', 'Replace coolant', 40000, 730, 'medium', 5),
  ('Can-Am', NULL, 'Belt Inspection', 'Inspect drive belt', 8000, 365, 'medium', 6),
  ('Can-Am', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Can-Am', NULL, 'Fork Oil', 'Replace fork oil', 40000, 730, 'medium', 9),
  ('Can-Am', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 16000, 365, 'high', 10);

-- Piaggio
INSERT INTO public.oem_maintenance_schedules (make, model, task_name, description, interval_km, interval_days, priority, sort_order) VALUES
  ('Piaggio', NULL, 'Oil & Filter Change', 'Replace engine oil and oil filter', 5000, 180, 'high', 1),
  ('Piaggio', NULL, 'Air Filter', 'Replace air filter', 10000, 365, 'medium', 2),
  ('Piaggio', NULL, 'Spark Plugs', 'Replace spark plugs', 10000, 730, 'medium', 3),
  ('Piaggio', NULL, 'Brake Fluid', 'Replace brake fluid', 20000, 730, 'high', 4),
  ('Piaggio', NULL, 'Coolant', 'Replace coolant', 20000, 730, 'medium', 5),
  ('Piaggio', NULL, 'CVT Belt', 'Inspect/replace CVT belt', 10000, 365, 'high', 6),
  ('Piaggio', NULL, 'Tire Pressure Check', 'Check tire pressure', NULL, 14, 'low', 7),
  ('Piaggio', NULL, 'Valve Clearance', 'Check valve clearance', 12000, NULL, 'high', 8),
  ('Piaggio', NULL, 'Fork Oil', 'Replace fork oil', 20000, 730, 'medium', 9),
  ('Piaggio', NULL, 'Brake Pads Inspection', 'Inspect brake pads', 10000, 365, 'high', 10);
