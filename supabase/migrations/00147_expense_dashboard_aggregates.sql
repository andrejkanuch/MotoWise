-- Migration: 00147_expense_dashboard_aggregates (audit H10)
--
-- ExpensesService.getDashboard previously fetched up to 5000 raw expense rows
-- (with NO order) and summed them in JS. Past 5000 expenses the dashboard was
-- silently wrong — an arbitrary 5000-row slice was aggregated and the rest
-- dropped. This RPC moves the aggregation into SQL (date_trunc month buckets,
-- per-category sums, all-time / current-year / previous-year totals) so the
-- numbers are correct regardless of row count.
--
-- SECURITY INVOKER: getDashboard calls this through the per-request user client
-- (SUPABASE_USER), so the function runs under the caller's RLS. The expenses
-- RLS policy already restricts rows to user_id = auth.uid(); we additionally
-- pin the owner via auth.uid() inside the function (defense in depth) and take
-- only the motorcycle id as a parameter — never a user id.

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
      e.category,
      round(e.amount::numeric, 2) AS amount,
      date_part('year', e.date)::int AS yr,
      date_part('month', e.date)::int AS mon
    FROM public.expenses e
    WHERE e.user_id = (SELECT auth.uid())
      AND e.motorcycle_id = p_motorcycle_id
      AND e.deleted_at IS NULL
  ),
  buckets AS (
    SELECT
      yr,
      mon,
      jsonb_object_agg(category, cat_total) AS categories,
      round(sum(cat_total)::numeric, 2) AS total
    FROM (
      SELECT yr, mon, category, round(sum(amount)::numeric, 2) AS cat_total
      FROM scoped
      GROUP BY yr, mon, category
    ) per_cat
    GROUP BY yr, mon
  ),
  category_totals AS (
    SELECT category, round(sum(amount)::numeric, 2) AS total
    FROM scoped
    GROUP BY category
  )
  SELECT jsonb_build_object(
    'currentYearTotal', COALESCE((
      SELECT round(sum(amount)::numeric, 2) FROM scoped
      WHERE yr = date_part('year', (now() AT TIME ZONE 'utc'))::int
    ), 0),
    'previousYearTotal', COALESCE((
      SELECT round(sum(amount)::numeric, 2) FROM scoped
      WHERE yr = date_part('year', (now() AT TIME ZONE 'utc'))::int - 1
    ), 0),
    'allTimeTotal', COALESCE((SELECT round(sum(amount)::numeric, 2) FROM scoped), 0),
    'expenseCount', (SELECT count(*) FROM scoped),
    'monthlyBuckets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('year', yr, 'month', mon, 'categories', categories, 'total', total)
        ORDER BY yr DESC, mon DESC
      )
      FROM buckets
    ), '[]'::jsonb),
    'categoryTotals', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('category', category, 'total', total)
        ORDER BY total DESC
      )
      FROM category_totals
    ), '[]'::jsonb)
  );
$$;

-- User-callable read aggregate: authenticated only (RLS enforced via INVOKER).
REVOKE ALL ON FUNCTION public.expense_dashboard_aggregates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_dashboard_aggregates(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
