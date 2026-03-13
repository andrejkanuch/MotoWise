---
status: pending
priority: p3
issue_id: "100"
tags: [code-review, performance, api, optimization]
dependencies: ["094", "095"]
---

# Expenses query optimization: SELECT columns, LIMIT, hoist formatter

## Problem Statement

Several related optimization opportunities in the expenses feature:

1. **SELECT * in findByMotorcycle:** Fetches all columns including `updated_at`, `deleted_at`, `user_id` — none needed by the client.
2. **No LIMIT/pagination:** All expenses fetched and sent to client, even though mobile shows max 5 at a time.
3. **JS-side grouping:** Category grouping and totals computed in Node.js instead of SQL `GROUP BY`.
4. **Intl.NumberFormat recreated per call:** `formatCurrency` creates a new formatter on every invocation.

## Findings

- **Performance Oracle:** CRITICAL-1 (SELECT * + JS grouping) + OPT-6 (formatter)
- **Learnings Researcher:** "Never SELECT *", "Always add .limit()"

## Proposed Solutions

1. Select explicit columns: `id, motorcycle_id, amount, category, date, description, maintenance_task_id, created_at`
2. Add `.limit(50)` or similar reasonable cap to the query
3. Consider SQL `GROUP BY` for aggregation (future optimization)
4. Hoist `Intl.NumberFormat` instance outside `formatCurrency` function in `expenses-section.tsx`

- Effort: Small-Medium
- Risk: Low

## Acceptance Criteria

- [ ] Explicit column selection in findByMotorcycle
- [ ] Query has a reasonable LIMIT
- [ ] `Intl.NumberFormat` created once, reused across calls

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Performance oracle + learnings flagged |
