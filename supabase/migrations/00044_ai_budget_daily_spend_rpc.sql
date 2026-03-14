-- Migration: 00044_ai_budget_daily_spend_rpc
-- Purpose: PostgREST aggregate functions (.sum()) are not enabled by default.
--          Create an RPC to sum today's AI spend instead.

CREATE OR REPLACE FUNCTION public.get_daily_ai_spend(p_since TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_cents), 0)::INTEGER
  FROM content_generation_log
  WHERE created_at >= p_since
    AND status = 'success';
$$;
