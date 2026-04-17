---
status: pending
priority: p1
issue_id: "117"
tags: [code-review, dead-endpoint, agent-native, triage-needed]
dependencies: []
---

# setTripParticipantRole mutation has zero UI callers

## Problem Statement

`setTripParticipantRole` is fully wired server-side — DTO, resolver, service, schema — but has zero callers from mobile or web. Server-side `co_planner` RLS policies depend on the role being settable. Result: an agent (via MCP/GraphQL) can promote a participant to co-planner, but the human user cannot. Two reviewers disagree on whether to ship the UI or delete the endpoint.

## Findings

- **code-simplicity-reviewer:** "Delete — you shipped a dead endpoint."
- **agent-native-reviewer:** "Ship a tiny organiser-only role picker on trip-detail; RLS already depends on it and this is a user/agent parity gap."

## Proposed Solutions

### Option A: Ship minimal role picker UI (Recommended)
On the trip-detail screen, for organisers only, add a small role picker on each participant row (Rider / Co-planner) that calls `setTripParticipantRole`. Unlocks the half-shipped feature and closes the agent-vs-user parity gap.
- Pros: Preserves feature; agents and humans keep the same capabilities; co-planner RLS becomes actually usable.
- Cons: UI surface + tests + an extra GraphQL mutation document on the client.
- Effort: Small
- Risk: Low

### Option B: Delete the mutation + service + DTO + schema entry
Roll back the endpoint until a real product need appears. `co_planner` role value stays in the DB as an admin-only setting.
- Pros: Zero dead code.
- Cons: Throws away coherent, tested work; breaks the agent-native symmetry; next time we add this, we redo it.
- Effort: Small
- Risk: Medium (feature regression if a caller existed off-repo)

## Recommended Action

**triage-needed** — user decides. Default to Option A given co-planner RLS already depends on this mutation existing and agent-native parity is a stated project principle.

## Technical Details

- **Affected files (Option A):** trip-detail screen under `apps/mobile/src/app/(tabs)/trips/`, a new `.graphql` document for `SetTripParticipantRole`, regenerated `packages/graphql` output.
- **Affected files (Option B):** `apps/api/src/trips/trip-participants.resolver.ts` (or wherever it's defined), matching service method, DTO, and regenerated schema.
- **Database changes:** No.

## Acceptance Criteria (Option A)

- [ ] Organiser sees a role picker on each participant row on trip-detail.
- [ ] Non-organisers do not see the picker.
- [ ] Mutation success updates local cache; role badge re-renders.
- [ ] E2E: organiser promotes a rider to co-planner; co-planner-scoped action becomes available for that user.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | code-simplicity-reviewer, agent-native-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
