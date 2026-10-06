-- Migration: 00186_expense_dashboard_per_currency
--
-- expense_dashboard_aggregates (00147) summed `amount` across every expense of
-- a bike regardless of `expenses.currency`, so a rider who logged €50 and $40
-- saw "90" on the expense dashboard. There is no FX source in the codebase, so
-- the only honest aggregate is one per currency.
--
-- This re-creates the function with the same signature and adds a
-- `currencies` array: one full breakdown (year totals, month buckets, category
-- totals, count) per currency, ordered most-used first (expense count, then
-- total, then code — deterministic). The legacy top-level keys are kept for the
-- API build that predates this migration, but they now carry the FIRST
-- (primary) currency's figures instead of a cross-currency sum; `expenseCount`
-- stays the bike's total row count (a count, not money). An API build that
-- reads `currencies` therefore works against either version of the function,
-- and the pre-fix API stops summing currencies as soon as this lands.
--
-- Unchanged: SECURITY INVOKER on the per-request user client, owner pinned via
-- auth.uid(), motorcycle id is the only parameter, and the ACL below.
-- CREATE OR REPLACE keeps the existing ACL; the REVOKE/GRANT pair is repeated
-- so this file is correct on its own.

BEGIN;

CREATE OR REPLACE FUNCTION public.expense_dashboard_aggregates(
  p_motorcycle_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH scoped AS (
    SELECT
      e.currency,
      e.category,
      round(e.amount::numeric, 2) AS amount,
      date_part('year', e.date)::int AS yr,
      date_part('month', e.date)::int AS mon
    FROM public.expenses e
    WHERE e.user_id = (SELECT auth.uid())
      AND e.motorcycle_id = p_motorcycle_id
      AND e.deleted_at IS NULL
  ),
  this_year AS (
    SELECT date_part('year', (now() AT TIME ZONE 'utc'))::int AS yr
  ),
  buckets AS (
    SELECT
      currency,
      yr,
      mon,
      jsonb_object_agg(category, cat_total) AS categories,
      round(sum(cat_total)::numeric, 2) AS total
    FROM (
      SELECT currency, yr, mon, category, round(sum(amount)::numeric, 2) AS cat_total
      FROM scoped
      GROUP BY currency, yr, mon, category
    ) per_cat
    GROUP BY currency, yr, mon
  ),
  category_totals AS (
    SELECT currency, category, round(sum(amount)::numeric, 2) AS total
    FROM scoped
    GROUP BY currency, category
  ),
  per_currency AS (
    SELECT
      s.currency,
      count(*) AS expense_count,
      round(COALESCE(sum(s.amount), 0)::numeric, 2) AS all_time_total,
      round(COALESCE(sum(s.amount) FILTER (WHERE s.yr = ty.yr), 0)::numeric, 2)
        AS current_year_total,
      round(COALESCE(sum(s.amount) FILTER (WHERE s.yr = ty.yr - 1), 0)::numeric, 2)
        AS previous_year_total
    FROM scoped s
    CROSS JOIN this_year ty
    GROUP BY s.currency
  ),
  breakdowns AS (
    SELECT
      row_number() OVER (
        ORDER BY pc.expense_count DESC, pc.all_time_total DESC, pc.currency ASC
      ) AS rank,
      jsonb_build_object(
        'currency', pc.currency,
        'currentYearTotal', pc.current_year_total,
        'previousYearTotal', pc.previous_year_total,
        'allTimeTotal', pc.all_time_total,
        'expenseCount', pc.expense_count,
        'monthlyBuckets', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'year', b.yr, 'month', b.mon, 'categories', b.categories, 'total', b.total
            )
            ORDER BY b.yr DESC, b.mon DESC
          )
          FROM buckets b
          WHERE b.currency = pc.currency
        ), '[]'::jsonb),
        'categoryTotals', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('category', ct.category, 'total', ct.total)
            ORDER BY ct.total DESC
          )
          FROM category_totals ct
          WHERE ct.currency = pc.currency
        ), '[]'::jsonb)
      ) AS obj
    FROM per_currency pc
  ),
  primary_breakdown AS (
    SELECT obj FROM breakdowns WHERE rank = 1
  )
  SELECT jsonb_build_object(
    'currencies', COALESCE(
      (SELECT jsonb_agg(obj ORDER BY rank) FROM breakdowns),
      '[]'::jsonb
    ),
    'currentYearTotal', COALESCE((SELECT obj -> 'currentYearTotal' FROM primary_breakdown), '0'::jsonb),
    'previousYearTotal', COALESCE((SELECT obj -> 'previousYearTotal' FROM primary_breakdown), '0'::jsonb),
    'allTimeTotal', COALESCE((SELECT obj -> 'allTimeTotal' FROM primary_breakdown), '0'::jsonb),
    'expenseCount', (SELECT count(*) FROM scoped),
    'monthlyBuckets', COALESCE((SELECT obj -> 'monthlyBuckets' FROM primary_breakdown), '[]'::jsonb),
    'categoryTotals', COALESCE((SELECT obj -> 'categoryTotals' FROM primary_breakdown), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.expense_dashboard_aggregates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_dashboard_aggregates(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
