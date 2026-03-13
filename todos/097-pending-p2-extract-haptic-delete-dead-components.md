---
status: pending
priority: p2
issue_id: "097"
tags: [code-review, cleanup, dead-code, duplication]
dependencies: []
---

# Extract haptic() to shared utility + delete dead component files

## Problem Statement

Two cleanup items:

1. **haptic() duplicated in 5 files:** Same 3-line function copy-pasted in `swipeable-task-card.tsx`, `maintenance-section.tsx`, `add-expense.tsx`, `bike-tasks.tsx`, `edit-bike.tsx`.

2. **3 dead component files:** The refactor replaced `spending-summary.tsx`, `stat-cards.tsx`, and `upcoming-tasks.tsx` but left the old files in place. They are no longer imported anywhere.

## Findings

- **TypeScript Reviewer:** HIGH-4 (haptic duplication)
- **Simplicity Reviewer:** ~300 LOC of dead code, ~12 LOC of duplication

## Proposed Solutions

1. Create `apps/mobile/src/lib/haptics.ts` with the shared `haptic()` function
2. Replace all 5 local definitions with imports from the shared utility
3. Delete: `spending-summary.tsx`, `stat-cards.tsx`, `upcoming-tasks.tsx`

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] `haptic()` lives in `apps/mobile/src/lib/haptics.ts`
- [ ] All 5 files import from shared utility
- [ ] Dead component files deleted
- [ ] No import errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | TS + simplicity reviewers flagged |
