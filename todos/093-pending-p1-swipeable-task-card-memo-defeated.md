---
status: pending
priority: p1
issue_id: "093"
tags: [code-review, performance, react-native, memo]
dependencies: []
---

# SwipeableTaskCard memo defeated by expandedId prop

## Problem Statement

`SwipeableTaskCard` is wrapped in `React.memo`, but every card receives `expandedId: string | null` as a prop. When any card is expanded/collapsed, `expandedId` changes for ALL cards, causing every card to re-render — defeating memo entirely.

With 20+ tasks, toggling expand triggers 20 re-renders including reanimated layout calculations and photo gallery renders.

## Findings

- **Performance Oracle:** CRITICAL-3 — N-1 unnecessary re-renders on expand/collapse
- Component at `apps/mobile/src/components/bike-hub/swipeable-task-card.tsx`
- Called from `maintenance-section.tsx` and `bike-tasks.tsx`

## Proposed Solutions

### Fix: Pass derived boolean instead of full ID
In parent components, replace:
```tsx
<SwipeableTaskCard expandedId={expandedId} ... />
```
With:
```tsx
<SwipeableTaskCard isExpanded={expandedId === task.id} ... />
```

Update `SwipeableTaskCard` props to accept `isExpanded: boolean` instead of `expandedId: string | null`.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] `SwipeableTaskCard` accepts `isExpanded: boolean` instead of `expandedId`
- [ ] Only 2 cards re-render on expand/collapse (old expanded + new expanded)
- [ ] Both `maintenance-section.tsx` and `bike-tasks.tsx` updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Performance oracle flagged |

## Resources

- PR #23: https://github.com/andrejkanuch/MotoWise/pull/23
