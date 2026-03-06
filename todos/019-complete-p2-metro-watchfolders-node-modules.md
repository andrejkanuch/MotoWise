---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, performance]
dependencies: []
---

# Metro watchFolders Includes Entire node_modules

## Problem Statement

Metro's `watchFolders` includes the entire root `node_modules` directory, causing Watchman to track tens of thousands of files. This slows Metro startup and increases memory usage.

## Findings

- **Source:** Performance Oracle
- **File:** `apps/mobile/metro.config.js:13`

## Proposed Solutions

### Option A: Remove node_modules from watchFolders
Rely on `nodeModulesPaths` for resolution instead.
- **Effort:** Small
- **Risk:** Low (test that imports still resolve)

## Acceptance Criteria

- [ ] `node_modules` removed from `watchFolders`
- [ ] Metro still resolves all imports correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
