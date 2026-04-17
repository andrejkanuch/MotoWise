---
status: pending
priority: p1
issue_id: "113"
tags: [code-review, types, packages-types, architecture]
dependencies: []
---

# Co-planner + suggestion enums missing from @motovault/types

## Problem Statement

Migration 00106 added `co_planner` to the `trip_participants.role` CHECK and introduced `trip_suggestions.kind`, `trip_suggestions.status`, and `RespondToTripSuggestionInput.decision`. None of these values appear in `packages/types/src/validators/trip.ts` — `PARTICIPANT_ROLE` still only has `ORGANIZER | RIDER`. The new values live as magic strings in resolvers/services and as hand-written unions on the client. This violates the documented update sequence (migration → db.types → Zod → NestJS → GraphQL codegen).

**Known Pattern:** `docs/solutions/architecture/currency-preference-full-stack-implementation.md`

## Findings

- **architecture-strategist:** enums exist in DB but not in the shared types package — cross-app drift is now baked in.
- **kieran-typescript-reviewer:** magic strings in resolvers, hand-typed unions on client.

## Proposed Solutions

### Option A: Add `as const` + Zod enums to @motovault/types (Recommended)
Add `PARTICIPANT_ROLE.CO_PLANNER`, `TRIP_SUGGESTION_KIND`, `TRIP_SUGGESTION_STATUS`, `TRIP_SUGGESTION_DECISION` as `as const` objects + matching Zod schemas in `packages/types/src/validators/trip.ts`. Consume from NestJS services/DTO validators and from mobile client. Unblocks #114.
- Pros: Single source of truth across packages/ and apps/; prevents future drift.
- Cons: Touches multiple services; mechanical but broad.
- Effort: Medium
- Risk: Low

### Option B: Per-app unions only
Keep the values as local unions/consts in each app.
- Pros: Smaller diff.
- Cons: Re-introduces the exact drift this was supposed to prevent; blocks #114.
- Effort: Small
- Risk: High (regression)

## Recommended Action

Option A — it's the pattern every existing enum already follows (currency, participant role, period of day). Consumed by #114.

## Technical Details

- **Affected files:** `packages/types/src/validators/trip.ts` (+ index re-exports), `apps/api/src/trips/**/*` (services, resolvers, DTOs consuming the strings), `apps/mobile/src/hooks/use-trip-suggestions.ts`.
- **Database changes:** No — already present in migration 00106.

## Acceptance Criteria

- [ ] `PARTICIPANT_ROLE.CO_PLANNER`, `TRIP_SUGGESTION_KIND`, `TRIP_SUGGESTION_STATUS`, `TRIP_SUGGESTION_DECISION` exported from `@motovault/types`.
- [ ] Matching Zod schemas exported next to them.
- [ ] No raw string literals `'co_planner' | 'accept' | 'decline' | 'waypoint' | ...` in `apps/api/src/trips/` or `apps/mobile/src/hooks/use-trip-suggestions.ts`.
- [ ] `pnpm typecheck` passes across all workspaces.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist, kieran-typescript-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Prior: `docs/solutions/architecture/currency-preference-full-stack-implementation.md`
