---
status: pending
priority: p2
issue_id: "078"
tags: [code-review, performance, api, ai-budget]
dependencies: []
---

## Problem Statement

`checkGlobalSpend()` and `getBudgetStatus()` in `ai-budget.service.ts` fetch ALL `content_generation_log` rows for today and sum `cost_cents` in JavaScript. At 1000 users with 200 daily generations each, this returns 200K rows per request. Additionally, `(row.cost_cents as number)` is unsafe — NaN propagation possible.

## Proposed Solutions

### Option A: Use database aggregate
```typescript
const { data } = await this.adminClient
  .from('content_generation_log')
  .select('cost_cents.sum()')
  .gte('created_at', todayStart.toISOString())
  .eq('status', 'success')
  .single();
```
Or use a Supabase RPC with `SELECT COALESCE(SUM(cost_cents), 0)`.
- Effort: Small | Risk: Low

### Option B: Add composite partial indexes
```sql
CREATE INDEX idx_content_gen_log_user_daily ON public.content_generation_log (user_id, created_at DESC) WHERE status = 'success';
CREATE INDEX idx_content_gen_log_global_daily ON public.content_generation_log (created_at DESC) WHERE status = 'success';
```
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] `checkGlobalSpend` uses database-level SUM
- [ ] `getBudgetStatus` shares the same optimized query
- [ ] Composite partial indexes added via migration
- [ ] `todayStart` uses `setUTCHours(0,0,0,0)` not `setHours`
