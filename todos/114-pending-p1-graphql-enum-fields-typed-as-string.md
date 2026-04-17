---
status: pending
priority: p1
issue_id: "114"
tags: [code-review, graphql, codegen, architecture]
dependencies: [113]
---

# GraphQL enum fields are typed as String instead of registered enums

## Problem Statement

`kind`, `status`, `periodOfDay`, suggestion `decision`, participant `role`, and assistant history `role` are declared as `@Field(() => String)` in NestJS models/DTOs. `apps/api/src/common/enums/graphql-enums.ts` already establishes the right pattern (`registerEnumType` + a compile-time `_xSync` guard record). As a result, codegen emits `string` everywhere, and invalid values only fail at the DB CHECK constraint — surfacing as a 500 rather than a 400 validation error.

## Findings

- **architecture-strategist:** `apps/api/src/trips/models/trip-suggestion.model.ts:31,49,52`; `apps/api/src/trips/dto/trip-suggestion.inputs.ts:8,27,37,53`; `apps/api/src/trips/dto/ask-trip-assistant.input.ts:7`; plus `shared-trip-waypoint.model.ts` and `trip.model.ts` for `periodOfDay`.

## Proposed Solutions

### Option A: Register and swap (Recommended)
Add `GqlPeriodOfDay`, `GqlTripSuggestionKind`, `GqlTripSuggestionStatus`, `GqlTripSuggestionDecision`, `GqlParticipantRole`, `GqlAssistantMessageRole` to `graphql-enums.ts` with the matching `_sync` records (ensures DB values and GraphQL enum values can never diverge without a compile error). Swap `@Field(() => String)` → `@Field(() => GqlXxx)` in the named files. Regenerate. Coordinate with #113 so both sides share one set of constants.
- Pros: Validation at the API boundary (400 not 500); typed clients; future enum additions cause type errors everywhere they matter.
- Cons: Cross-cutting change; requires `pnpm generate` + mobile callsite updates (which #108 simplifies).
- Effort: Medium
- Risk: Medium

### Option B: Keep strings, add Zod ValidationPipe
Validate inputs via Zod only, leave GraphQL as String.
- Pros: Smaller schema surface.
- Cons: Clients still see `string`; loses codegen enum types; diverges from existing pattern.
- Effort: Small
- Risk: Medium (architectural inconsistency)

## Recommended Action

Option A — matches the repo's established pattern and is a natural consumer of #113.

## Technical Details

- **Affected files:** `apps/api/src/common/enums/graphql-enums.ts`, `apps/api/src/trips/models/trip-suggestion.model.ts`, `apps/api/src/trips/dto/trip-suggestion.inputs.ts`, `apps/api/src/trips/dto/ask-trip-assistant.input.ts`, `apps/api/src/trips/models/shared-trip-waypoint.model.ts`, `apps/api/src/trips/models/trip.model.ts`, generated files under `apps/api/schema.graphql` + `packages/graphql/src/generated/`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] All six enums registered in `graphql-enums.ts` with `_sync` guards.
- [ ] Zero `@Field(() => String)` declarations remain for these six fields.
- [ ] `pnpm generate` produces typed enum members on client (`TripSuggestionKind.Waypoint`, etc.).
- [ ] Invalid enum input from GraphQL client returns a 400 with field path, not a 500.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist |

## Resources

- Branch: feat/impeccable-discover-redesign
- Depends on: #113
