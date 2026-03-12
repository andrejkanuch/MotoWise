---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, typescript, security]
dependencies: []
---

# QuizzesService Uses `as any` on JSON Columns — No Runtime Validation

## Problem Statement

`QuizzesService` casts `questions_json` with `as any` instead of validating through the existing `QuizSchema` Zod validator. If the JSON shape diverges from expected `{ correctIndex: number }`, scores silently compute as zero.

## Findings

- **Source:** TypeScript Reviewer (C2)
- **File:** `apps/api/src/modules/quizzes/quizzes.service.ts:25,41`

## Proposed Solutions

### Option A: Parse Through Zod Schema
```typescript
import { QuizSchema } from '@motovault/types';
const parsed = QuizSchema.parse(data.questions_json);
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `questions_json` validated through `QuizSchema` at runtime
- [ ] No `as any` casts on JSON columns
- [ ] Type inference flows correctly after validation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
