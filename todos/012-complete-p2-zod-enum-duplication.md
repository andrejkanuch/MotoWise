---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, typescript, architecture]
dependencies: []
---

# Zod Enum Values Duplicated Instead of Derived from as-const Objects

## Problem Statement

Zod schemas in `@motolearn/types` hardcode enum values as string literals (e.g., `z.enum(['beginner', 'intermediate', 'advanced'])`) instead of deriving from the `as const` objects in `enums.ts`. If values change in one place but not the other, validation silently breaks.

## Findings

- **Source:** TypeScript Reviewer (I2), Architecture Strategist (IMPORTANT #6)
- **Files:**
  - `packages/types/src/validators/article.ts:9-19`
  - `packages/types/src/validators/diagnostic.ts:12,14`
  - `packages/types/src/constants/enums.ts` (source of truth)

## Proposed Solutions

### Option A: Derive Zod Enums from as-const Objects
```typescript
import { ArticleDifficulty } from '../constants/enums';
const difficulties = Object.values(ArticleDifficulty) as [string, ...string[]];
z.enum(difficulties)
```
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] All Zod enum values derived from `as const` objects in `enums.ts`
- [ ] Single source of truth for enum values

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Both TypeScript and architecture reviewers flagged |
