---
status: pending
priority: p3
issue_id: "101"
tags: [code-review, cleanup, simplification]
dependencies: []
---

# Minor cleanups: redundant code, i18n, sort optimization

## Problem Statement

Collection of low-severity findings from multiple reviewers:

1. **`grandTotal` duplicates `ytdTotal`** — expenses-section.tsx computes same total the server already returns
2. **`year ?? undefined` is a no-op** — resolver line 25
3. **`deleteMutateRef` unnecessary** — TanStack Query v5 `mutate` is already stable
4. **Verbose inline type annotations** — expenses-section.tsx uses full inline types instead of generated GraphQL types
5. **`new Date()` in sort comparators** — creates 2-4 Date objects per comparison call
6. **Animation stagger not capped** — 50 items = 2500ms delay chain
7. **`CATEGORY_LABELS` hardcoded English** — not using i18n, also duplicates `CATEGORY_META` from add-expense.tsx
8. **`formatCurrency` hardcoded to `en-US`/USD locale** — should use `undefined` for locale
9. **`overdueCount` memo redundant** — already computed during activeTasks sort
10. **`ytdTotal` naming misleading** — returns all-time total when year=0
11. **`year` parameter no bounds validation** — could pass negative/extreme values
12. **Admin RLS missing `deleted_at IS NULL`** — admins see soft-deleted records (may be intentional)

## Proposed Solutions

Address individually as time permits. Each is 1-5 lines changed. Most impactful: #1 (remove redundant computation), #5 (cache `new Date()` before sort), #7 (share category constants).

- Effort: Small (each)
- Risk: Low

## Acceptance Criteria

- [ ] At least items 1-5 addressed (highest value)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Multiple reviewers flagged |
