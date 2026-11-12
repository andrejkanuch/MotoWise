-- Repeatable check for the cost trend read (migrations/00203_expense_cost_trend.sql).
--
-- Proves on a real database what the API spec (mocked Supabase client) cannot:
--   * anon cannot execute the function; authenticated can;
--   * one series per currency, most expenses first, with every month of the
--     12-month window (oldest first, 0 for a month with no spend);
--   * a soft-deleted expense, an expense before the window, an expense on
--     another bike and another rider's expense on this bike are never counted;
--   * the window ends at the current month in p_tz, for zones on both sides
--     of the date line;
--   * an unknown zone and a window outside 1 to 60 months raise 22023.
--
-- Runs in the DISPOSABLE container only:
--   supabase/checks/run.sh expense_cost_trend.sql
-- Everything runs in ONE transaction that ends in ROLLBACK.
--
-- A failed assertion raises, which aborts the transaction (nothing is kept) and
-- surfaces as the error. Success returns no rows and no error.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.expense_cost_trend(uuid, text, integer)') IS NULL THEN
    RAISE EXCEPTION 'public.expense_cost_trend missing: run via run.sh with its fixture';
  END IF;
  IF has_function_privilege('anon', 'public.expense_cost_trend(uuid, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute expense_cost_trend';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.expense_cost_trend(uuid, text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute expense_cost_trend';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures, as the connecting (admin) role. Rider R owns bikes B and C; rider
-- X is somebody else. Dates are relative to the current UTC month (m0).
-- ---------------------------------------------------------------------------
SELECT
  set_config('cost_check.rider', gen_random_uuid()::text, true),
  set_config('cost_check.other', gen_random_uuid()::text, true),
  set_config('cost_check.bike', gen_random_uuid()::text, true),
  set_config('cost_check.bike_c', gen_random_uuid()::text, true),
  set_config('cost_check.m0', date_trunc('month', now() AT TIME ZONE 'UTC')::date::text, true);

INSERT INTO public.expenses (user_id, motorcycle_id, amount, currency, date, deleted_at)
SELECT
  current_setting('cost_check.' || v.who)::uuid,
  current_setting('cost_check.' || v.bike)::uuid,
  v.amount,
  v.currency,
  (current_setting('cost_check.m0')::date + make_interval(months => v.months_ago * -1))::date + v.day,
  CASE WHEN v.deleted THEN now() END
FROM (VALUES
  -- counted: EUR 100.10 + 49.90 in m0, EUR 25 in m-2, USD 30 in m-11
  ('rider', 'bike', 100.10, 'EUR', 0, 0, false),
  ('rider', 'bike', 49.90, 'EUR', 0, 3, false),
  ('rider', 'bike', 25.00, 'EUR', 2, 9, false),
  ('rider', 'bike', 30.00, 'USD', 11, 0, false),
  -- never counted
  ('rider', 'bike', 999.00, 'EUR', 0, 1, true),   -- soft-deleted
  ('rider', 'bike', 500.00, 'EUR', 12, 0, false), -- before the window
  ('rider', 'bike_c', 77.00, 'GBP', 0, 0, false), -- another bike
  ('other', 'bike', 88.00, 'EUR', 0, 0, false)    -- another rider
) AS v (who, bike, amount, currency, months_ago, day, deleted);

-- ---------------------------------------------------------------------------
-- As rider R.
-- ---------------------------------------------------------------------------
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('cost_check.rider'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  m0 date := current_setting('cost_check.m0')::date;
  r jsonb := public.expense_cost_trend(current_setting('cost_check.bike')::uuid, 'UTC', 12);
  eur jsonb := r -> 'series' -> 0;
  usd jsonb := r -> 'series' -> 1;
BEGIN
  IF r ->> 'to_month' <> to_char(m0, 'YYYY-MM')
     OR r ->> 'from_month' <> to_char(m0 - interval '11 months', 'YYYY-MM') THEN
    RAISE EXCEPTION 'window is wrong: %', r;
  END IF;
  IF (r ->> 'expense_count')::int <> 4 OR jsonb_array_length(r -> 'series') <> 2 THEN
    RAISE EXCEPTION 'expected 4 expenses in 2 series: %', r;
  END IF;
  IF eur ->> 'currency' <> 'EUR' OR (eur ->> 'expense_count')::int <> 3
     OR (eur ->> 'total')::numeric <> 175.00 THEN
    RAISE EXCEPTION 'EUR series is wrong: %', eur;
  END IF;
  IF usd ->> 'currency' <> 'USD' OR (usd ->> 'expense_count')::int <> 1
     OR (usd ->> 'total')::numeric <> 30.00 THEN
    RAISE EXCEPTION 'USD series is wrong: %', usd;
  END IF;
  IF jsonb_array_length(eur -> 'months') <> 12 OR jsonb_array_length(usd -> 'months') <> 12 THEN
    RAISE EXCEPTION 'every series must have 12 months: %', r;
  END IF;
  IF eur -> 'months' -> 11 ->> 'month' <> to_char(m0, 'YYYY-MM')
     OR (eur -> 'months' -> 11 ->> 'total')::numeric <> 150.00
     OR (eur -> 'months' -> 9 ->> 'total')::numeric <> 25.00
     OR (eur -> 'months' -> 10 ->> 'total')::numeric <> 0 THEN
    RAISE EXCEPTION 'EUR months are wrong: %', eur -> 'months';
  END IF;
  IF usd -> 'months' -> 0 ->> 'month' <> to_char(m0 - interval '11 months', 'YYYY-MM')
     OR (usd -> 'months' -> 0 ->> 'total')::numeric <> 30.00 THEN
    RAISE EXCEPTION 'USD months are wrong: %', usd -> 'months';
  END IF;

  -- The window ends at the current month of the zone, on both sides of the date line.
  IF public.expense_cost_trend(current_setting('cost_check.bike')::uuid, 'Pacific/Kiritimati', 12) ->> 'to_month'
       <> to_char(now() AT TIME ZONE 'Pacific/Kiritimati', 'YYYY-MM')
     OR public.expense_cost_trend(current_setting('cost_check.bike')::uuid, 'Etc/GMT+12', 12) ->> 'to_month'
       <> to_char(now() AT TIME ZONE 'Etc/GMT+12', 'YYYY-MM') THEN
    RAISE EXCEPTION 'to_month does not follow p_tz';
  END IF;

  -- The rider's other bike: only its own expense; an unknown bike: nothing.
  r := public.expense_cost_trend(current_setting('cost_check.bike_c')::uuid, 'UTC', 3);
  IF (r ->> 'expense_count')::int <> 1 OR r -> 'series' -> 0 ->> 'currency' <> 'GBP' THEN
    RAISE EXCEPTION 'bike C is wrong: %', r;
  END IF;
  r := public.expense_cost_trend(gen_random_uuid(), 'UTC', 12);
  IF (r ->> 'expense_count')::int <> 0 OR r -> 'series' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'an unknown bike must be empty: %', r;
  END IF;

  BEGIN
    PERFORM public.expense_cost_trend(current_setting('cost_check.bike')::uuid, 'Not/AZone', 12);
    RAISE EXCEPTION 'an unknown zone was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.expense_cost_trend(current_setting('cost_check.bike')::uuid, 'UTC', 0);
    RAISE EXCEPTION 'a 0-month window was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

ROLLBACK;
