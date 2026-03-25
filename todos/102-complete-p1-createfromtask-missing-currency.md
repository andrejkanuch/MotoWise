---
status: complete
priority: p1
issue_id: "102"
tags: [code-review, data-integrity, currency]
dependencies: []
---

# createFromTask does not propagate user currency

## Problem Statement

`ExpensesService.createFromTask()` creates expenses from completed maintenance tasks but does not accept or pass a `currency` parameter. These expenses rely on the DB default (`'USD'`), meaning non-USD users will have task-generated expenses silently recorded as USD while their manually-logged expenses use their chosen currency.

This was flagged by 4 independent review agents (Security, Architecture, TypeScript, Data Integrity).

## Findings

- **Location**: `apps/api/src/modules/expenses/expenses.service.ts` lines 155-191
- **Evidence**: The `insert` block (lines 164-175) omits `currency` entirely
- **Impact**: Mixed-currency data in expense totals for non-USD users who complete maintenance tasks with costs

## Proposed Solutions

### Option A: Accept currency parameter (Recommended)
Add `currency?: string` param to `createFromTask`, pass from caller (maintenance tasks module).
- **Pros**: Simple, explicit, follows existing `create()` pattern
- **Cons**: Requires updating the caller
- **Effort**: Small
- **Risk**: Low

### Option B: Look up user's currency from DB
Query `users.currency` inside `createFromTask` before insert.
- **Pros**: No caller changes needed
- **Cons**: Extra DB query per task completion
- **Effort**: Small
- **Risk**: Low

## Recommended Action


## Technical Details

- **Affected files**: `apps/api/src/modules/expenses/expenses.service.ts`, callers of `createFromTask`
- **Database**: `expenses.currency` column defaults to `'USD'` if not provided

## Acceptance Criteria

- [ ] `createFromTask` passes the user's currency preference when creating expenses
- [ ] Task-generated expenses have the correct currency for non-USD users

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-24 | Identified during code review | Flagged by 4 agents independently |

## Resources

- PR branch: `feat/currency-preference`
