-- Migration: 00041_self_healing_complete_onboarding
-- Purpose: Make complete_onboarding resilient when handle_new_user trigger
--          fails to create the public.users row (e.g., race condition, trigger
--          missing in production). Instead of raising "User not found", we
--          backfill the row from auth.users before proceeding.

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
  p_last_service_date TEXT DEFAULT NULL,
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

  -- Self-healing: ensure public.users row exists (backfill from auth.users
  -- if the handle_new_user trigger failed or hasn't fired yet)
  INSERT INTO public.users (id, email, full_name, role)
  SELECT id, email, raw_user_meta_data->>'full_name', 'user'
  FROM auth.users
  WHERE id = p_user_id
  ON CONFLICT (id) DO NOTHING;

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

-- Also re-create the handle_new_user trigger in case it was dropped
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
