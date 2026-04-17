---
status: pending
priority: p2
issue_id: "118"
tags: [code-review, security, rls, supabase]
dependencies: []
---

# trip_suggestions UPDATE policy missing explicit WITH CHECK

## Problem Statement

The `trip_suggestions` UPDATE policy (`supabase/migrations/00106_trip_suggestions.sql:124-138`) defines only a USING clause; Postgres defaults WITH CHECK to the same expression. Two broken effects: (1) a pending suggestion's author cannot set `status='withdrawn'` because the NEW row fails the author clause — the withdraw path is silently dead; (2) the author can freely rewrite `decided_by`, `decided_at`, `trip_id`, `waypoint_id` on their own pending row, forging audit fields.

**Known Pattern:** `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — same class of bug already patched once.

## Findings

- **Security Sentinel:** `supabase/migrations/00106_trip_suggestions.sql:124-138` — USING-only policy; NEW rows validated by copy of OLD predicate.
- **Testing Reviewer:** no test exercising the withdraw transition; would have caught this.
- Verified: resolver `respondToTripSuggestion` cannot persist status='withdrawn' in the current schema.

## Proposed Solutions

### Option A: Split USING vs WITH CHECK, branch by role (Recommended)

Write one policy per transition, or a unified WITH CHECK with explicit allowed transitions:

```sql
CREATE POLICY "trip_suggestions_update" ON public.trip_suggestions
  FOR UPDATE TO authenticated
  USING (
    public.is_trip_organiser(trip_id)
    OR public.is_trip_co_planner(trip_id)
    OR author_user_id = auth.uid()
  )
  WITH CHECK (
    -- organiser/co_planner: may decide
    ((public.is_trip_organiser(trip_id) OR public.is_trip_co_planner(trip_id))
      AND decided_by = auth.uid())
    OR
    -- author: may edit while pending OR withdraw
    (author_user_id = auth.uid()
      AND (
        (status = 'pending' AND author_user_id = (SELECT author_user_id FROM public.trip_suggestions WHERE id = trip_suggestions.id))
        OR status = 'withdrawn'
      ))
  );
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Triggers that enforce column-level immutability

More granular but heavier; keep the RLS split and add a BEFORE UPDATE trigger that forbids author from touching `trip_id`, `waypoint_id`, `decided_*`.

## Recommended Action

Option A. Add B's trigger if audits require column-level guarantees.

## Technical Details

- **Affected files:** `supabase/migrations/00106_trip_suggestions.sql`, new migration `001NN_trip_suggestions_update_policy.sql`, `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts` (verify withdraw path)

## Acceptance Criteria

- [ ] Author can transition pending → withdrawn
- [ ] Author cannot change `decided_by`, `decided_at`, `trip_id`, `waypoint_id`, `author_user_id`
- [ ] Organiser/co_planner can only set status with `decided_by = auth.uid()`
- [ ] RLS test in `supabase/tests/` covers each transition

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | security-sentinel + testing-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Known Pattern: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
