---
status: pending
priority: p2
issue_id: "124"
tags: [code-review, typescript, logic-bug]
dependencies: []
---

# Seasonal filter month ranges overlap and skip spring

## Problem Statement

`apps/mobile/src/hooks/use-inspiration-filters.ts:27-48` picks a season from a 0-indexed month with buggy ranges:

- `month >= 10 || month <= 2` → Nov + Dec + Jan + Feb + **Mar** (March riders get "Stay paved this winter")
- `month >= 8 && month <= 10` → Sep + Oct + **Nov** (November double-counted)
- else → Apr–Aug only (no dedicated spring or true-autumn branch)

Net effect: March riders see the winter filter, November riders never see autumn foliage, and spring has no specific copy.

## Findings

- **Correctness Reviewer:** overlap at month=10 (November) and misclassification of month=2 (March).
- **Testing Reviewer:** no unit test on the season mapping.

## Proposed Solutions

### Option A: Literal lookup table (Recommended)

```ts
const SEASON_BY_MONTH: Record<number, 'winter' | 'spring' | 'summer' | 'autumn'> = {
  0:'winter', 1:'winter', 2:'spring', 3:'spring', 4:'spring',
  5:'summer', 6:'summer', 7:'summer',
  8:'autumn', 9:'autumn', 10:'autumn',
  11:'winter',
};
const season = SEASON_BY_MONTH[new Date().getMonth()];
```

Then switch filter on `season`. Remove overlapping if/else chain.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Hemisphere-aware mapping

Flip season for southern hemisphere users using device locale/timezone. Worthwhile only if the product actually ships there.

## Recommended Action

Option A. Add Option B when/if SH rollout is planned.

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-inspiration-filters.ts`

## Acceptance Criteria

- [ ] Unit test for all 12 months → expected season
- [ ] March shows spring filter, November shows autumn filter
- [ ] No branch overlap

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | correctness-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
