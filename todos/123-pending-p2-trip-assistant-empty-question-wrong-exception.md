---
status: pending
priority: p2
issue_id: "123"
tags: [code-review, nestjs, http-codes]
dependencies: []
---

# Trip assistant throws NotFoundException for empty question

## Problem Statement

`apps/api/src/modules/trip-assistant/trip-assistant.service.ts:79` throws `NotFoundException('Empty question')` when the user submits a blank question. Empty input is a 400, not a 404 — the client cannot distinguish "trip missing" from "bad input." `ForbiddenException` is also imported but never used.

## Findings

- **Correctness Reviewer:** `trip-assistant.service.ts:79` — wrong HTTP semantics.
- **Kieran TypeScript Reviewer:** unused `ForbiddenException` import.
- **Architecture Strategist:** validation belongs in a pipe, not inline.

## Proposed Solutions

### Option A: BadRequestException + drop unused import (Recommended)

```ts
if (!question.trim()) {
  throw new BadRequestException('Question is required');
}
```

Delete the `ForbiddenException` import.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Move validation into ZodValidationPipe

Covered by #134 — Zod schema enforces `question: z.string().trim().min(1).max(2000)` so the service never sees empty input.

## Recommended Action

Option A immediately; Option B as part of #134 rollout.

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-assistant/trip-assistant.service.ts`

## Acceptance Criteria

- [ ] Empty question returns 400 (BadRequest), not 404
- [ ] `ForbiddenException` import removed
- [ ] Existing happy-path test unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | correctness-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Related: #134 Zod validation pipe
