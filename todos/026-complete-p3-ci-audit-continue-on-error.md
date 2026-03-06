---
status: pending
priority: p3
issue_id: "026"
tags: [code-review, simplicity]
dependencies: []
---

# CI Audit Job Has continue-on-error: true — Never Fails

## Problem Statement

The `audit` CI job runs `pnpm audit` with `continue-on-error: true`, meaning it can never block a merge. A job that always passes is noise.

## Findings

- **Source:** Code Simplicity Reviewer (MINOR)
- **File:** `.github/workflows/ci.yml:56-65`

## Proposed Solutions

### Option A: Remove continue-on-error
Let the audit job actually gate merges.
- **Effort:** Small
- **Risk:** Low (may block on known unfixed vulns — use `pnpm audit --audit-level=critical`)

### Option B: Remove the Job
If audit isn't ready to gate, remove it entirely.
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] Audit job either gates merges or is removed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
