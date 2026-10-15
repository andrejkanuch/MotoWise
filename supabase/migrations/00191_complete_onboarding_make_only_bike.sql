-- 00191: complete_onboarding creates the bike when the rider skipped the model.
--
-- Onboarding has offered a make-only path since #81 (quick-make chips and
-- "continue without a model"). The app then sends no p_bike_model, and the bike
-- branch below required make AND model AND year, so the bike was discarded with
-- no error: the rider finished onboarding, and its "garage ready" paywall, with
-- an empty garage. motorcycles.model is NOT NULL, so a make-only bike is stored
-- with model = '' (an absent or blank model normalises to the empty string).
--
-- The new bike is primary only when the rider has no live primary bike, so a
-- rider who already owns one can still complete onboarding: before, the
-- make-only call skipped the insert, and an unconditional is_primary = true
-- would now abort the whole call on idx_motorcycles_one_primary_per_user.
--
-- Only the bike branch changes. Signature, SECURITY DEFINER, search_path and the
-- auth.uid() check are unchanged, and CREATE OR REPLACE keeps the existing ACL.
-- Plan: docs/plans/2026-10-15-1102-fix-onboarding-make-only-bike-dropped-plan.md
-- Check: supabase/checks/complete_onboarding_bike.sql

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid, p_preferences jsonb, p_bike_make text DEFAULT NULL::text, p_bike_model text DEFAULT NULL::text, p_bike_year integer DEFAULT NULL::integer, p_bike_type motorcycle_type DEFAULT NULL::motorcycle_type, p_bike_mileage integer DEFAULT NULL::integer, p_bike_nickname text DEFAULT NULL::text, p_bike_photo_url text DEFAULT NULL::text, p_annual_repair_spend text DEFAULT NULL::text, p_maintenance_reminders boolean DEFAULT NULL::boolean, p_reminder_channel text DEFAULT NULL::text, p_seasonal_tips boolean DEFAULT NULL::boolean, p_recall_alerts boolean DEFAULT NULL::boolean, p_weekly_summary boolean DEFAULT NULL::boolean, p_last_service_date text DEFAULT NULL::text, p_mileage_unit text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bike_id UUID;
  v_bike_model TEXT := COALESCE(NULLIF(btrim(p_bike_model), ''), '');
  v_extra_prefs JSONB := '{}'::jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  IF p_currency IS NOT NULL AND p_currency NOT IN (
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
    'SEK','NOK','DKK','PLN','TRY',
    'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN','KES'
  ) THEN
    RAISE EXCEPTION 'Invalid currency: %', left(p_currency, 10);
  END IF;

  INSERT INTO public.users (id, email, full_name, role)
  SELECT id, email, raw_user_meta_data->>'full_name', 'user'
  FROM auth.users
  WHERE id = p_user_id
  ON CONFLICT (id) DO NOTHING;

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

  UPDATE public.users
  SET preferences = COALESCE(preferences, '{}'::jsonb) || p_preferences || v_extra_prefs,
      onboarding_completed_at = NOW(),
      currency = COALESCE(p_currency, currency)
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found: %', p_user_id; END IF;

  -- A make-only bike (no or blank model) is created with model = ''.
  IF p_bike_make IS NOT NULL AND p_bike_year IS NOT NULL THEN
    SELECT id INTO v_bike_id FROM public.motorcycles
    WHERE user_id = p_user_id AND make = p_bike_make
      AND model = v_bike_model AND year = p_bike_year
    LIMIT 1;

    IF v_bike_id IS NULL THEN
      INSERT INTO public.motorcycles (
        user_id, make, model, year, type, current_mileage, nickname,
        is_primary, primary_photo_url, mileage_unit
      )
      VALUES (
        p_user_id, p_bike_make, v_bike_model, p_bike_year,
        COALESCE(p_bike_type, 'other'::motorcycle_type),
        COALESCE(p_bike_mileage, 0),
        p_bike_nickname,
        -- Primary only when the rider has no live primary bike yet, so a repeat
        -- onboarding never trips idx_motorcycles_one_primary_per_user.
        NOT EXISTS (
          SELECT 1 FROM public.motorcycles
          WHERE user_id = p_user_id AND is_primary AND deleted_at IS NULL
        ),
        p_bike_photo_url,
        COALESCE(p_mileage_unit, 'mi')
      )
      RETURNING id INTO v_bike_id;
    ELSE
      UPDATE public.motorcycles
      SET primary_photo_url = COALESCE(p_bike_photo_url, primary_photo_url),
          mileage_unit = COALESCE(p_mileage_unit, mileage_unit),
          current_mileage = COALESCE(p_bike_mileage, current_mileage),
          nickname = COALESCE(p_bike_nickname, nickname)
      WHERE id = v_bike_id;
    END IF;

    IF p_last_service_date IS NOT NULL AND v_bike_id IS NOT NULL THEN
      UPDATE public.motorcycles
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lastServiceDate', p_last_service_date)
      WHERE id = v_bike_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id, 'motorcycle_id', v_bike_id);
END;
$function$;
