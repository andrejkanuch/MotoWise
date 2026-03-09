-- Migration: 00023_onboarding_redesign_preferences
-- Purpose: Add subscription columns, fix RLS bypass, create bike-photos bucket,
--          backfill existing users, expand complete_onboarding RPC

-- ==========================================
-- 1. ADD NEW COLUMNS TO USERS TABLE
-- ==========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revenuecat_id TEXT;

-- ==========================================
-- 2. RLS FIX: DROP PERMISSIVE POLICY, CREATE UNIFIED POLICY
-- ==========================================

-- Drop existing permissive policy that lacks WITH CHECK
DROP POLICY IF EXISTS "Users update own data" ON public.users;

-- Single unified policy: users can update own row but NOT subscription/role/email fields
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM public.users WHERE id = auth.uid())
    AND subscription_tier IS NOT DISTINCT FROM (SELECT subscription_tier FROM public.users WHERE id = auth.uid())
    AND subscription_expires_at IS NOT DISTINCT FROM (SELECT subscription_expires_at FROM public.users WHERE id = auth.uid())
    AND revenuecat_id IS NOT DISTINCT FROM (SELECT revenuecat_id FROM public.users WHERE id = auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT role FROM public.users WHERE id = auth.uid())
    AND email IS NOT DISTINCT FROM (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- ==========================================
-- 3. STORAGE BUCKET FOR BIKE PHOTOS
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('bike-photos', 'bike-photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own bike photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bike-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users view own bike photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bike-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own bike photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bike-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==========================================
-- 4. SAFE BACKFILL
-- ==========================================

-- Set onboarding_completed_at only for users who don't already have it
UPDATE public.users SET onboarding_completed_at = NOW()
  WHERE onboarding_completed_at IS NULL
  AND id IN (SELECT DISTINCT user_id FROM public.motorcycles);

-- Fix subscription_status for existing Pro subscribers
UPDATE public.users SET subscription_status = 'active'
  WHERE subscription_tier = 'pro' AND (subscription_status IS NULL OR subscription_status = 'free');

-- ==========================================
-- 5. EXPANDED complete_onboarding RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_preferences JSONB,
  p_bike_make TEXT DEFAULT NULL,
  p_bike_model TEXT DEFAULT NULL,
  p_bike_year INTEGER DEFAULT NULL,
  p_bike_type motorcycle_type DEFAULT NULL,
  p_bike_mileage INTEGER DEFAULT NULL,
  p_bike_nickname TEXT DEFAULT NULL,
  p_bike_photo_url TEXT DEFAULT NULL,
  p_annual_repair_spend TEXT DEFAULT NULL,
  p_maintenance_reminders BOOLEAN DEFAULT NULL,
  p_reminder_channel TEXT DEFAULT NULL,
  p_seasonal_tips BOOLEAN DEFAULT NULL,
  p_recall_alerts BOOLEAN DEFAULT NULL,
  p_weekly_summary BOOLEAN DEFAULT NULL,
  p_last_service_date DATE DEFAULT NULL,
  p_mileage_unit TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bike_id UUID;
  v_extra_prefs JSONB := '{}'::jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  -- Build extra preferences from new parameters
  IF p_annual_repair_spend IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('annualRepairSpend', p_annual_repair_spend);
  END IF;
  IF p_maintenance_reminders IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('maintenanceReminders', p_maintenance_reminders);
  END IF;
  IF p_reminder_channel IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('reminderChannel', p_reminder_channel);
  END IF;
  IF p_seasonal_tips IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('seasonalTips', p_seasonal_tips);
  END IF;
  IF p_recall_alerts IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('recallAlerts', p_recall_alerts);
  END IF;
  IF p_weekly_summary IS NOT NULL THEN
    v_extra_prefs := v_extra_prefs || jsonb_build_object('weeklySummary', p_weekly_summary);
  END IF;

  -- Merge caller preferences + extra preferences into user record
  UPDATE public.users
  SET preferences = COALESCE(preferences, '{}'::jsonb) || p_preferences || v_extra_prefs,
      onboarding_completed_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found: %', p_user_id; END IF;

  -- Idempotent bike creation (skip if same bike already exists)
  IF p_bike_make IS NOT NULL AND p_bike_model IS NOT NULL AND p_bike_year IS NOT NULL THEN
    SELECT id INTO v_bike_id FROM public.motorcycles
    WHERE user_id = p_user_id AND make = p_bike_make
      AND model = p_bike_model AND year = p_bike_year
    LIMIT 1;

    IF v_bike_id IS NULL THEN
      INSERT INTO public.motorcycles (
        user_id, make, model, year, type, current_mileage, nickname,
        is_primary, primary_photo_url, mileage_unit
      )
      VALUES (
        p_user_id, p_bike_make, p_bike_model, p_bike_year,
        COALESCE(p_bike_type, 'other'::motorcycle_type),
        COALESCE(p_bike_mileage, 0),
        p_bike_nickname,
        true,
        p_bike_photo_url,
        COALESCE(p_mileage_unit, 'mi')
      )
      RETURNING id INTO v_bike_id;
    ELSE
      -- Update existing bike with new fields if provided
      UPDATE public.motorcycles
      SET primary_photo_url = COALESCE(p_bike_photo_url, primary_photo_url),
          mileage_unit = COALESCE(p_mileage_unit, mileage_unit),
          current_mileage = COALESCE(p_bike_mileage, current_mileage),
          nickname = COALESCE(p_bike_nickname, nickname)
      WHERE id = v_bike_id;
    END IF;

    -- Store last_service_date in motorcycle metadata if provided
    IF p_last_service_date IS NOT NULL AND v_bike_id IS NOT NULL THEN
      UPDATE public.motorcycles
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lastServiceDate', p_last_service_date)
      WHERE id = v_bike_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id, 'motorcycle_id', v_bike_id);
END;
$$;
