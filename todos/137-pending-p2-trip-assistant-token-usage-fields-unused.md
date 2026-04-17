---
status: pending
priority: p2
issue_id: "137"
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Trip assistant mutation selects unused token usage fields

## Problem Statement

`apps/mobile/src/graphql/mutations/ask-trip-assistant.graphql:4-5` selects `inputTokens` and `outputTokens`. They are returned in the hook's typed result but never rendered, logged, or read anywhere in the mobile client. Dead fields increase payload, inflate generated types, and make future schema churn noisier.

## Findings

- **Maintainability Reviewer:** no reader for `inputTokens` / `outputTokens` across `apps/mobile`.
- **Performance Reviewer:** trivial bytes, but dead code all the same.

## Proposed Solutions

### Option A: Drop the fields from the mobile query (Recommended)

Remove `inputTokens` and `outputTokens` from `apps/mobile/src/graphql/mutations/ask-trip-assistant.graphql`. Keep the fields on the server schema — they're cheap and useful for server-side logging/analytics.

```graphql
mutation AskTripAssistant($input: AskTripAssistantInput!) {
  askTripAssistant(input: $input) {
    answer
    # inputTokens / outputTokens removed — mobile does not consume
  }
}
```

Run `pnpm generate` to refresh types. After #108 migrates the hook to the generated Document, the hook will stop carrying the fields automatically.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Wire the fields into telemetry

If product wants client-side cost display, render them or ship them to Sentry/Amplitude. Not on the roadmap today.

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `apps/mobile/src/graphql/mutations/ask-trip-assistant.graphql`, regenerated `packages/graphql/src/generated/*`

## Acceptance Criteria

- [ ] `inputTokens` / `outputTokens` not in the mobile document
- [ ] `pnpm generate` + `pnpm typecheck` green
- [ ] No reference to the fields remains in `apps/mobile/src`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | maintainability-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Related: #108 generated-doc migration
