---
status: pending
priority: p2
issue_id: "120"
tags: [code-review, security, ai-cost, dos]
dependencies: []
---

# AskTripAssistantInput.history has no size/length validators

## Problem Statement

`apps/api/src/modules/trip-assistant/dto/ask-trip-assistant.input.ts:22` declares `history` as an array of `AskTripAssistantHistoryItem` with no `@ArrayMaxSize` or `@MaxLength` per item. The server-side `slice(-16)` in the service runs *after* class-validator instantiates the whole array. A client can POST a history of 500 000 × 2 KB items, forcing multi-GB allocation before the trim. The history is also trusted client-supplied input, so cost injection (2.5× token burn per request) is trivial.

## Findings

- **Security Sentinel:** no ArrayMaxSize on `history`, no MaxLength on `content`, no @IsIn on `role`.
- **Performance Reviewer:** O(N) validation + allocation before trim; worst-case DoS vector.
- No GraphQL body-size limit in `apps/api/src/main.ts`.

## Proposed Solutions

### Option A: Bound DTO + enforce body size (Recommended)

```ts
@Field(() => [AskTripAssistantHistoryItem], { nullable: true })
@IsOptional()
@ArrayMaxSize(32)
@ValidateNested({ each: true })
@Type(() => AskTripAssistantHistoryItem)
history?: AskTripAssistantHistoryItem[];

// AskTripAssistantHistoryItem
@Field() @IsIn(['user','assistant']) role!: 'user' | 'assistant';
@Field() @MaxLength(2000) content!: string;
```

Add `app.use(json({ limit: '128kb' }))` (or Apollo body-parser equivalent) in `main.ts`.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Server-side history storage

Persist last 8 turns in Redis/Postgres keyed by `(tripId, userId)`; ignore client history entirely. Eliminates cost injection and shrinks the payload.

- Effort: Medium / Risk: Low

## Recommended Action

Option A immediately; Option B as a follow-up for stronger cost control.

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-assistant/dto/ask-trip-assistant.input.ts`, `apps/api/src/main.ts`

## Acceptance Criteria

- [ ] `history` capped to 32 items at validation time
- [ ] Per-message `content` capped to 2000 chars
- [ ] GraphQL body-size limit ≤ 128 KB
- [ ] Test: oversized payload rejected with 400 before entering resolver

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | security-sentinel + performance-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
