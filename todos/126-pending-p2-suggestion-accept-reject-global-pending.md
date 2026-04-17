---
status: pending
priority: p2
issue_id: "126"
tags: [code-review, react, ux]
dependencies: []
---

# Suggestion accept/reject disables every button during one mutation

## Problem Statement

`apps/mobile/src/components/trips/suggestions-section.tsx:170-213` binds every Accept/Reject/Withdraw button's `disabled` and `0.5` opacity to a single `isResponding` boolean produced by `use-trip-suggestions.ts:180`. Accepting suggestion A disables all buttons on B, C, D, etc. On a trip with 10 pending suggestions this reads as a UI freeze.

## Findings

- **Julik Frontend Races Reviewer:** shared mutation flag used as per-row state.
- **UX observation:** every suggestion row greys out during a single accept.

## Proposed Solutions

### Option A: Track the responding suggestion id locally (Recommended)

```tsx
const [respondingId, setRespondingId] = useState<string | null>(null);

<AcceptButton
  disabled={respondingId === s.id}
  onPress={async () => {
    setRespondingId(s.id);
    try { await respond({ id: s.id, decision: 'accepted' }); }
    finally { setRespondingId(null); }
  }}
/>
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Scoped `useMutationState` by mutationKey

If using TanStack Query per-suggestion mutation keys (`['respondToSuggestion', s.id]`), read `useMutationState({ filters: { mutationKey: [...], status: 'pending' } })` and show a row-level spinner. Heavier but eliminates local state.

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `apps/mobile/src/components/trips/suggestions-section.tsx`, `apps/mobile/src/hooks/use-trip-suggestions.ts`

## Acceptance Criteria

- [ ] Accepting one suggestion only disables that row's buttons
- [ ] Error on one row re-enables its buttons (finally)
- [ ] Visual regression: non-target rows keep full opacity during mutation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | julik-frontend-races-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
