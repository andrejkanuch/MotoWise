---
status: pending
priority: p3
issue_id: "023"
tags: [code-review, simplicity]
dependencies: []
---

# Unused Constants and Enums — Dead Code

## Problem Statement

Several exported constants and enums are never imported anywhere in the codebase.

## Findings

- **Source:** Code Simplicity Reviewer (MINOR)
- **Files:**
  - `packages/types/src/constants/enums.ts:31-37` — `DiagnosticDifficulty` never referenced
  - `packages/types/src/constants/limits.ts:3-5` — `FREE_TIER_ARTICLES_PER_MONTH`, `FREE_TIER_DIAGNOSTICS_PER_MONTH`, `MAX_PHOTO_SIZE_BYTES` never imported

## Proposed Solutions

### Option A: Remove Unused Exports
Delete unused constants. Add back when features are built.
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] All exported symbols have at least one consumer

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
