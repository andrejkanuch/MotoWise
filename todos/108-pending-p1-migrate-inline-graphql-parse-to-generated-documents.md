---
status: pending
priority: p1
issue_id: "108"
tags: [code-review, typescript, codegen, dead-workaround]
dependencies: []
---

# Migrate inline graphql parse() + hand-rolled TypedDocumentNode to generated documents

## Problem Statement

Three mobile files still import `parse` from `graphql` and hand-roll `TypedDocumentNode` + Data/Vars interfaces as a workaround for a previously-broken codegen. Codegen is now fixed (commit 9cfaff7); `AskTripAssistantDocument`, `TripSuggestionsDocument`, `CreateTripSuggestionDocument`, `RespondToTripSuggestionDocument`, and `MyRidesDocument` all exist in `packages/graphql/src/generated/graphql.ts`. The duplicated types drift from the schema and will break again when GraphQL enums replace strings (see #114).

**Known Pattern:** `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`

## Findings

- **kieran-typescript-reviewer:** `apps/mobile/src/hooks/use-trip-assistant.ts:39-47`, `apps/mobile/src/hooks/use-trip-suggestions.ts:46-136`, `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx:53-74`.
- **architecture-strategist:** concurs — violates one-way type flow from packages/ → apps/.
- **code-simplicity-reviewer:** concurs — ~140 LOC of pure workaround.

## Proposed Solutions

### Option A: Swap to generated Documents (Recommended)
Import `AskTripAssistantDocument`, `TripSuggestionsDocument`, etc. from `@motovault/graphql`, delete the local `parse()` + interface blocks, and extract nested types via `type X = SomeQuery['field'][number]`. Removes ~140 LOC and the drift risk.
- Pros: Single source of truth; auto-picks up enum changes from #114.
- Cons: Touches 3 files at once — need to verify TanStack Query generics still compile.
- Effort: Small
- Risk: Low

### Option B: Add pre-push guard
Biome rule or grep hook forbidding `import { parse } from 'graphql'` under `apps/mobile/src`.
- Pros: Prevents regression.
- Cons: Alone doesn't fix current state.
- Effort: Small
- Risk: Low

## Recommended Action

Do BOTH — Option A to fix, Option B as guardrail so the workaround can't reappear.

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-trip-assistant.ts`, `apps/mobile/src/hooks/use-trip-suggestions.ts`, `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx`, `.githooks/pre-push` (or Biome config).
- **Database changes:** No.

## Acceptance Criteria

- [ ] No `import { parse } from 'graphql'` under `apps/mobile/src`.
- [ ] All three files import their `*Document` from `@motovault/graphql`.
- [ ] `pnpm typecheck` passes; TanStack Query call sites retain full inference.
- [ ] Pre-push grep/Biome rule fails CI if `parse` is reintroduced.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Prior: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
