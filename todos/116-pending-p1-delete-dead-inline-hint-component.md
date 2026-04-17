---
status: pending
priority: p1
issue_id: "116"
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Delete dead InlineHint component (zero consumers)

## Problem Statement

`apps/mobile/src/components/shared/inline-hint.tsx` has zero consumers across the repo. The plan `docs/plans/2026-04-16-003-refactor-usability-audit-p1-2-plan.md` explicitly defers any migration to "future PRs." Shipping a primitive before it has a single caller is YAGNI — it locks an API we haven't validated and adds bundle weight without value.

## Findings

- **code-simplicity-reviewer:** `apps/mobile/src/components/shared/inline-hint.tsx` + `apps/mobile/src/components/shared/index.ts` (which only re-exports `InlineHint`).

## Proposed Solutions

### Option A: Delete now, reintroduce with first caller (Recommended)
Remove `inline-hint.tsx` and `apps/mobile/src/components/shared/index.ts` (since `InlineHint` is the sole export). When the first real migration to inline hints lands, author the component in the same PR with the real consumer informing the API.
- Pros: Zero dead code; future author sees the actual usage.
- Cons: We re-type ~40 LOC when it comes back (trivial).
- Effort: Small
- Risk: Low

### Option B: Keep with a deprecation comment + tracking issue
Leave the file but comment it as unused.
- Pros: Preserves the existing API shape.
- Cons: Dead code with a promise isn't better than dead code without one.
- Effort: Small
- Risk: Low

## Recommended Action

Option A — delete until there's a real caller.

## Technical Details

- **Affected files:** `apps/mobile/src/components/shared/inline-hint.tsx`, `apps/mobile/src/components/shared/index.ts`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] `apps/mobile/src/components/shared/inline-hint.tsx` deleted.
- [ ] `apps/mobile/src/components/shared/index.ts` deleted (or empty barrel removed from import sites).
- [ ] `pnpm typecheck` and `pnpm lint` pass.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | code-simplicity-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Plan: `docs/plans/2026-04-16-003-refactor-usability-audit-p1-2-plan.md`
