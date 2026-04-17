---
status: pending
priority: p2
issue_id: "127"
tags: [code-review, react, dead-code]
dependencies: []
---

# Trip assistant sheet has dead scroll-to-end effect

## Problem Statement

`apps/mobile/src/components/trips/trip-assistant-sheet.tsx:47-51` registers:

```tsx
useEffect(() => {
  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
}, []);
```

Empty deps means it runs once on mount. The comment claims "keep latest message visible as soon as it streams in," but the real scroll-to-end lives on `onContentSizeChange` at line 124. The effect is both dead and redundant.

## Findings

- **Maintainability Reviewer:** misleading comment; effect never fires on new messages.
- **Julik Frontend Races Reviewer:** `setTimeout` inside an effect without cleanup.

## Proposed Solutions

### Option A: Delete the effect (Recommended)

`onContentSizeChange` already scrolls on every content-size change including mount. Remove the effect and its setTimeout.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Wire the effect to message length

If an explicit "scroll on new message" hook is desired:

```tsx
useEffect(() => {
  scrollRef.current?.scrollToEnd({ animated: true });
}, [messages.length]);
```

Keeps behaviour close to the stale comment's intent but overlaps with `onContentSizeChange`.

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `apps/mobile/src/components/trips/trip-assistant-sheet.tsx`

## Acceptance Criteria

- [ ] Effect removed
- [ ] Manual test: opening the sheet with prior messages still lands at the bottom
- [ ] Streaming a new message still scrolls to bottom

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | maintainability-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
