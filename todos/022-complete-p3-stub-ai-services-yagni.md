---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, simplicity]
dependencies: []
---

# Stub AI Services Only Throw Errors — YAGNI

## Problem Statement

Three AI service files contain nothing but a method that throws `Error('Not yet implemented')`. They are registered as providers but never injected or called.

## Findings

- **Source:** Code Simplicity Reviewer (IMPORTANT)
- **Files:**
  - `apps/api/src/modules/articles/article-generator.service.ts`
  - `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts`
  - `apps/api/src/modules/quizzes/quiz-generator.service.ts`

## Proposed Solutions

### Option A: Delete All Three
Remove files and their provider registrations. Create when actually implementing.
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] Stub services deleted
- [ ] Provider registrations removed from modules

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
