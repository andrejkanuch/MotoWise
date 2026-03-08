---
status: pending
priority: p1
issue_id: "064"
tags: [code-review, architecture, pr-hygiene]
---

# Extract unrelated gql-auth.guard.ts changes to separate PR

## Problem Statement

The landing page PR includes modifications to `apps/api/src/auth/gql-auth.guard.ts` which is unrelated to the marketing site work. Mixing unrelated changes makes the PR harder to review and increases risk of unintended side effects.

## Findings

- Architecture-strategist flagged this as a medium-severity concern
- The guard changes should be in their own PR with proper testing
- Mixing concerns violates single-responsibility PR principle

## Proposed Solutions

1. **Revert and move to separate branch** (Recommended)
   - `git checkout main -- apps/api/src/auth/gql-auth.guard.ts` to revert
   - Create separate branch/PR for the auth guard changes
   - **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `gql-auth.guard.ts` changes removed from landing page PR
- [ ] Separate PR created if changes are needed
