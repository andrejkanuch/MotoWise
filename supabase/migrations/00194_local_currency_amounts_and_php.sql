-- 00194: amounts fit every supported currency, and PHP (Philippine peso) is supported.
--
-- expenses.amount was capped at 99,999.99 and motorcycles.purchase_price at
-- 999,999.99 regardless of currency. In COP that is about US$25 and in ARS about
-- US$70, so Colombian and Argentine riders could not log a normal service, and
-- most of their bikes' prices were rejected. Both columns are DECIMAL(10,2), so the
-- new cap is the column's own maximum, 99,999,999.99. No column type changes.
--
-- PHP joins the currency allowlists (users, expenses, maintenance_tasks and the
-- complete_onboarding RPC); the Philippines is a target market. fuel_logs is not
-- touched: 00168 dropped that table.
--
-- Every new constraint is a strict superset of the old one, so all existing rows
-- already satisfy it. Constraints are re-added NOT VALID to skip the
-- write-blocking validation scan; 00195 validates them in its own transaction.
--
-- Deploy order: this migration must be live BEFORE the API and app builds that
-- relax the matching Zod limits (packages/types MONEY_AMOUNT_MAX), or amounts
-- between the old and new caps pass validation and then fail the DB CHECK as 500s.
--
-- complete_onboarding: the body is 00191's (verified identical to production on
-- 2026-11-03) with only 'PHP' added to the currency allowlist. Signature,
-- SECURITY DEFINER, search_path and the auth.uid() check are unchanged, and
-- CREATE OR REPLACE keeps the existing ACL.

-- 1. Amount caps
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_amount_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check
  CHECK (amount > 0 AND amount <= 99999999.99) NOT VALID;

ALTER TABLE public.motorcycles DROP CONSTRAINT IF EXISTS motorcycles_purchase_price_check;
ALTER TABLE public.motorcycles ADD CONSTRAINT motorcycles_purchase_price_check
  CHECK (purchase_price IS NULL OR (purchase_price >= 0 AND purchase_price <= 99999999.99)) NOT VALID;

-- 2. Currency allowlists (+PHP)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_currency;
ALTER TABLE public.users ADD CONSTRAINT chk_users_currency
  CHECK (currency IN (
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
    'SEK','NOK','DKK','PLN','TRY',
    'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN','KES','PHP'
  )) NOT VALID;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS chk_expenses_currency;
ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_currency
  CHECK (currency IN (
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
    'SEK','NOK','DKK','PLN','TRY',
    'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN','KES','PHP'
  )) NOT VALID;

ALTER TABLE public.maintenance_tasks DROP CONSTRAINT IF EXISTS chk_maintenance_tasks_currency;
ALTER TABLE public.maintenance_tasks ADD CONSTRAINT chk_maintenance_tasks_currency
  CHECK (currency IS NULL OR currency IN (
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
    'SEK','NOK','DKK','PLN','TRY',
    'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN','KES','PHP'
  )) NOT VALID;

-- 3. complete_onboarding allowlist (+PHP)
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid, p_preferences jsonb, p_bike_make text DEFAULT NULL::text, p_bike_model text DEFAULT NULL::text, p_bike_year integer DEFAULT NULL::integer, p_bike_type motorcycle_type DEFAULT NULL::motorcycle_type, p_bike_mileage integer DEFAULT NULL::integer, p_bike_nickname text DEFAULT NULL::text, p_bike_photo_url text DEFAULT NULL::text, p_annual_repair_spend text DEFAULT NULL::text, p_maintenance_reminders boolean DEFAULT NULL::boolean, p_reminder_channel text DEFAULT NULL::text, p_seasonal_tips boolean DEFAULT NULL::boolean, p_recall_alerts boolean DEFAULT NULL::boolean, p_weekly_summary boolean DEFAULT NULL::boolean, p_last_service_date text DEFAULT NULL::text, p_mileage_unit text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bike_id UUID;
  v_bike_make TEXT := NULLIF(btrim(p_bike_make), '');
  v_bike_model TEXT := COALESCE(NULLIF(btrim(p_bike_model), ''), '');
  v_extra_prefs JSONB := '{}'::jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  IF p_currency IS NOT NULL AND p_currency NOT IN (
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
    'SEK','NOK','DKK','PLN','TRY',
    'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN','KES','PHP'
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
  IF v_bike_make IS NOT NULL AND p_bike_year IS NOT NULL THEN
    -- Only a live bike counts as already created; a soft-deleted match must not
    -- swallow the onboarding bike.
    SELECT id INTO v_bike_id FROM public.motorcycles
    WHERE user_id = p_user_id AND make = v_bike_make
      AND model = v_bike_model AND year = p_bike_year
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_bike_id IS NULL THEN
      INSERT INTO public.motorcycles (
        user_id, make, model, year, type, current_mileage, nickname,
        is_primary, primary_photo_url, mileage_unit
      )
      VALUES (
        p_user_id, v_bike_make, v_bike_model, p_bike_year,
        COALESCE(p_bike_type, 'other'::motorcycle_type),
        COALESCE(p_bike_mileage, 0),
        p_bike_nickname,
        -- Primary only when the rider has no live primary bike yet, so a
        -- sequential repeat onboarding cannot trip idx_motorcycles_one_primary_per_user.
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
