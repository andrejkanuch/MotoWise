---
status: pending
priority: p2
issue_id: "134"
tags: [code-review, architecture, validation]
dependencies: []
---

# New resolvers bypass ZodValidationPipe convention

## Problem Statement

`apps/api/src/modules/trip-suggestions/trip-suggestions.resolver.ts:30-58` and `apps/api/src/modules/trip-assistant/trip-assistant.resolver.ts:19-24` accept `@Args('input')` raw — no UUID validation on `tripId`, no length caps on `question`/`notes`, and decision/kind/status are checked imperatively in services (or not at all). `TripsResolver` already uses `new ZodValidationPipe(...)` per repo rule.

**Known Pattern:** `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — same inconsistency was patched previously.

## Findings

- **Architecture Strategist:** validation drifted — new resolvers don't follow the established Zod pipe pattern.
- **Security Sentinel:** missing UUID validation on `tripId` / `suggestionId` opens malformed-input paths.

## Proposed Solutions

### Option A: Zod schemas in @motovault/types + pipe on resolvers (Recommended)

Add schemas for each input to `packages/types`:

```ts
export const AskTripAssistantInputSchema = z.object({
  tripId: z.string().uuid(),
  question: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user','assistant']),
    content: z.string().max(2000),
  })).max(32).optional(),
});
export type AskTripAssistantInput = z.infer<typeof AskTripAssistantInputSchema>;
```

Apply in resolvers:

```ts
@Mutation(() => AskTripAssistantResult)
askTripAssistant(
  @Args('input', new ZodValidationPipe(AskTripAssistantInputSchema)) input: AskTripAssistantInput,
  @CurrentUser() user: AuthUser,
) { ... }
```

Remove ad-hoc checks in services.

- Pros / Cons / Effort: Medium / Risk: Low

### Option B: class-validator decorators only

Lighter change but splits the validation story across two libraries in the repo.

## Recommended Action

Option A. Mirrors the existing TripsResolver convention.

## Technical Details

- **Affected files:** `packages/types/src/schemas/trip-assistant.ts`, `packages/types/src/schemas/trip-suggestions.ts`, both resolvers, both services

## Acceptance Criteria

- [ ] Zod schemas exist for all four inputs
- [ ] Resolvers use `new ZodValidationPipe(...)`
- [ ] Service-level redundant checks removed
- [ ] Malformed UUID test returns 400 before reaching service

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist |

## Resources

- Branch: feat/impeccable-discover-redesign
- Known Pattern: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
