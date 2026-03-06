---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, performance]
dependencies: []
---

# Turbo `build` Task Missing `inputs` — Cache Invalidation Too Broad

## Problem Statement

The `build` task in `turbo.json` has no `inputs` array, so Turborepo hashes every file in each package. Changes to README, test files, or non-source files invalidate the build cache unnecessarily.

## Findings

- **Source:** Performance Oracle
- **File:** `turbo.json:6-9`

## Proposed Solutions

### Option A: Add inputs array
```json
"inputs": ["src/**", "package.json", "tsconfig.json", "next.config.*", "app.json"]
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `build` task has scoped `inputs` configuration
- [ ] Non-source file changes don't invalidate build cache

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
