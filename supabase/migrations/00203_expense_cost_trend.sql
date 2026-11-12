-- Migration: 00203_expense_cost_trend
-- Cost trend: monthly expense totals for one bike, one series per currency.
--
-- WHAT IT ADDS
--   * expense_cost_trend(p_motorcycle_id, p_tz, p_months): one jsonb with the
--     last p_months calendar months, the current month in p_tz included. An
--     expense belongs to the month of its `date` (the rider's own calendar
--     date); p_tz decides only which month is the current one, so a rider in
--     Auckland on the 1st already sees the new month while UTC still shows the
--     old one. Soft-deleted expenses are never read.
--     Amounts are never summed across currencies (there is no FX source), so
--     each currency is its own series, most expenses first (then the larger
--     total, then the code), with every month of the window, oldest first, and
--     0 for a month with no spend.
--
-- Returns (keys always present; amounts are JSON numbers, exact to the cent):
-- {
--   "from_month": "YYYY-MM", "to_month": "YYYY-MM",
--   "expense_count": int,          live expenses in the window, every currency
--   "series": [ { "currency": text, "expense_count": int, "total": numeric,
--                 "months": [ { "month": "YYYY-MM", "total": numeric } ] } ]
-- }
--
-- ACCESS
--   SECURITY INVOKER on the per-request user client, like
--   expense_dashboard_aggregates (00147, 00186): the owner is pinned with
--   auth.uid() and the expenses RLS policies still apply. EXECUTE is revoked
--   from PUBLIC and anon by name and granted to authenticated. The Pro gate is
--   in the API, which returns the money figures to Pro riders only. A rider who
--   calls this function directly sees only figures from their own expense rows,
--   which RLS already lets them read.
--
-- DEPLOY ORDER: apply and verify BEFORE the API that reads this function
-- deploys (the API deploys on merge). Nothing calls it until then. Applying it
-- to production is an owner-approved step (docs/runbooks/supabase-migrations.md).
--
-- ROLLBACK (nothing reads the function until the API that uses it deploys):
--   DROP FUNCTION public.expense_cost_trend(uuid, text, integer);

BEGIN;

CREATE FUNCTION public.expense_cost_trend(
  p_motorcycle_id uuid,
  p_tz text,
  p_months integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_to date;
  v_from date;
BEGIN
  IF p_months IS NULL OR p_months < 1 OR p_months > 60 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 60' USING ERRCODE = '22023';
  END IF;

  -- AT TIME ZONE rejects an unknown zone name with 22023.
  v_to := date_trunc('month', now() AT TIME ZONE p_tz)::date;
  v_from := (v_to - make_interval(months => p_months - 1))::date;

  RETURN (
    WITH scoped AS (
      SELECT
        e.currency,
        e.amount,
        date_trunc('month', e.date)::date AS month
      FROM public.expenses e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.motorcycle_id = p_motorcycle_id
        AND e.deleted_at IS NULL
        AND e.date >= v_from
        AND e.date < (v_to + interval '1 month')::date
    ),
    window_months AS (
      SELECT m::date AS month
      FROM generate_series(v_from, v_to, interval '1 month') AS m
    ),
    per_month AS (
      SELECT currency, month, sum(amount) AS total
      FROM scoped
      GROUP BY currency, month
    ),
    per_currency AS (
      SELECT currency, count(*) AS expense_count, sum(amount) AS total
      FROM scoped
      GROUP BY currency
    )
    SELECT jsonb_build_object(
      'from_month', to_char(v_from, 'YYYY-MM'),
      'to_month', to_char(v_to, 'YYYY-MM'),
      'expense_count', (SELECT count(*) FROM scoped),
      'series', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'currency', pc.currency,
            'expense_count', pc.expense_count,
            'total', pc.total,
            'months', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'month', to_char(wm.month, 'YYYY-MM'),
                  'total', COALESCE(pm.total, 0)
                )
                ORDER BY wm.month
              )
              FROM window_months wm
              LEFT JOIN per_month pm
                ON pm.currency = pc.currency AND pm.month = wm.month
            )
          )
          ORDER BY pc.expense_count DESC, pc.total DESC, pc.currency ASC
        )
        FROM per_currency pc
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expense_cost_trend(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_cost_trend(uuid, text, integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
