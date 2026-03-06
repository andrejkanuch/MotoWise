-- Migration: Enrich motorcycles, users, and articles tables
-- Adds motorcycle_type enum and new columns for richer data modeling

-- New enum for motorcycle classification
CREATE TYPE motorcycle_type AS ENUM (
  'cruiser', 'sportbike', 'standard', 'touring',
  'dual_sport', 'dirt_bike', 'scooter', 'other'
);

-- Motorcycles: add type, identification, mileage, and soft delete
ALTER TABLE public.motorcycles
  ADD COLUMN type motorcycle_type,
  ADD COLUMN vin VARCHAR(17),
  ADD COLUMN current_mileage INTEGER,
  ADD COLUMN mileage_unit VARCHAR(2) DEFAULT 'mi' CHECK (mileage_unit IN ('mi', 'km')),
  ADD COLUMN engine_cc INTEGER,
  ADD COLUMN primary_photo_url TEXT,
  ADD COLUMN purchase_date DATE,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN metadata JSONB DEFAULT '{}';

-- Indexes for new motorcycle columns
CREATE INDEX idx_motorcycles_type ON public.motorcycles (type) WHERE type IS NOT NULL;
CREATE INDEX idx_motorcycles_vin ON public.motorcycles (vin) WHERE vin IS NOT NULL;
CREATE UNIQUE INDEX idx_motorcycles_user_vin_active
  ON public.motorcycles (user_id, vin) WHERE vin IS NOT NULL AND deleted_at IS NULL;

-- Update motorcycle RLS to filter soft-deleted rows for regular users
DROP POLICY IF EXISTS "Users own motorcycles" ON public.motorcycles;
CREATE POLICY "Users own motorcycles" ON public.motorcycles
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Admins can see soft-deleted motorcycles (for audit/recovery)
CREATE POLICY "Admins read all motorcycles" ON public.motorcycles
  FOR SELECT USING (public.is_admin());

-- Users: add avatar and riding experience
ALTER TABLE public.users
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN years_riding INTEGER;

-- Articles: add summary, read time, and verification flags
ALTER TABLE public.articles
  ADD COLUMN summary TEXT,
  ADD COLUMN read_time_minutes SMALLINT,
  ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_seed_content BOOLEAN NOT NULL DEFAULT false;

-- Index for verified/seed content queries
CREATE INDEX idx_articles_verified ON public.articles (is_verified) WHERE is_verified = true;
