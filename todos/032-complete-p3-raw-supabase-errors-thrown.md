---
status: pending
priority: p3
issue_id: "032"
tags: [code-review, security]
dependencies: []
---

# Raw Supabase PostgrestErrors Thrown Directly — May Leak DB Schema

## Problem Statement

Pattern `if (error) throw error;` in services throws raw Supabase `PostgrestError` objects. These could leak DB schema details in logs or to clients if the exception filter changes.

## Findings

- **Source:** TypeScript Reviewer (P1-4)
- **Files:** `motorcycles.service.ts:17`, `articles.service.ts:41`, `diagnostics.service.ts:17`, `learning-progress.service.ts:16`

## Proposed Solutions

### Option A: Wrap in NestJS Exceptions
```typescript
if (error) throw new InternalServerErrorException('Failed to fetch motorcycles');
```
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] No raw Supabase errors thrown to exception filter
- [ ] Errors logged server-side with details, sanitized message to client

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
