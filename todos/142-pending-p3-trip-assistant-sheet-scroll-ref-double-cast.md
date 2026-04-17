---
status: pending
priority: p3
issue_id: "142"
tags: [code-review, typescript, cleanup]
dependencies: []
---

# trip-assistant-sheet uses synthetic interface + double cast for scroll ref

## Problem Statement

`trip-assistant-sheet.tsx` declares `useRef<{ scrollToEnd: ... } | null>(null)` and does `r as unknown as { scrollToEnd: ... }` in the ref callback — a hand-rolled duck-typing of `BottomSheetScrollView`'s imperative handle. The library already exports the right type.

## Findings

- **Kieran TypeScript Reviewer:** `apps/mobile/src/components/trip/trip-assistant-sheet.tsx:35, 120-122` — double cast + synthetic interface

## Proposed Solutions

### Option A: Use the library's exported type (Recommended)
```ts
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
const scrollRef = useRef<BottomSheetScrollViewMethods | null>(null);
```
Drops the `as unknown as …` cast.
- Effort: Small

## Technical Details

- **Affected files:** `apps/mobile/src/components/trip/trip-assistant-sheet.tsx`

## Acceptance Criteria

- [ ] No `as unknown as` in the file
- [ ] `pnpm typecheck` passes
- [ ] Scroll-to-end behaviour unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer |
