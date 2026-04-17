---
status: pending
priority: p2
issue_id: "135"
tags: [code-review, architecture, agent-native, duplication]
dependencies: []
---

# Readiness logic duplicated between mobile and server

## Problem Statement

`apps/mobile/src/utils/readiness.ts:82,125` contains pure `computeReadiness` + `formatReadinessBrief` that duplicate server-side `FuelStopsService.calculateEffectiveRange` (both use `tankLiters × kmPerLiter × 0.8`). If one changes (different safety factor, new reserves), the other silently drifts. It also blocks agent-native parity: the web app and any agent shell can't produce the same "tank-bag brief" because the logic is RN-local.

## Findings

- **Architecture Strategist:** duplicated formula across apps violates "types flow one direction: packages → apps."
- **Agent-Native Reviewer:** agent cannot produce the same brief as the mobile UI — parity break.

## Proposed Solutions

### Option A: Move pure logic + types into @motovault/types (Recommended)

```ts
// packages/types/src/readiness.ts
export interface ReadinessInput {
  tankLiters: number;
  kmPerLiter: number;
  plannedDistanceM: number;
}
export function computeReadiness(input: ReadinessInput) { /* ... */ }
export function formatReadinessBrief(r: ReturnType<typeof computeReadiness>) { /* ... */ }
```

Mobile imports from `@motovault/types`. API imports the same helper inside `FuelStopsService.calculateEffectiveRange`. Optionally expose `tripReadinessBrief(tripId: ID!): TripReadinessBrief` on the API so mobile is a dumb consumer.

- Pros / Cons / Effort: Medium / Risk: Low

### Option B: Keep mobile util, make API the only writer

API returns a ready-formatted brief; mobile stops computing. Cleanest for parity but requires round-trip for an action that today is local.

## Recommended Action

Option A, with Option B's GraphQL field added later for agent parity.

## Technical Details

- **Affected files:** new `packages/types/src/readiness.ts`, `apps/mobile/src/utils/readiness.ts`, `apps/api/src/modules/fuel-stops/fuel-stops.service.ts`, optional new resolver

## Acceptance Criteria

- [ ] Single `computeReadiness` implementation imported by mobile + API
- [ ] Same inputs → same numbers both sides
- [ ] Unit tests live in `packages/types`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist + agent-native-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
