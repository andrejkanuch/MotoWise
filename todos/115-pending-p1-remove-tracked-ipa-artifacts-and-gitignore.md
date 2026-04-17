---
status: pending
priority: p1
issue_id: "115"
tags: [code-review, build-artifact, repo-hygiene]
dependencies: []
---

# Remove tracked .ipa artifacts and gitignore them

## Problem Statement

`git ls-files` shows three `.ipa` binaries checked in under `apps/mobile/`, including a 52 MB `build-1776238760652.ipa` staged on this branch. `apps/mobile/.gitignore` has no rule for `*.ipa` or `*.apk`, so every clone and CI checkout pays that bandwidth. Build outputs should never be versioned — they belong in EAS artifacts / TestFlight.

## Findings

- **code-simplicity-reviewer:** tracked files `apps/mobile/build-1776238760652.ipa`, `apps/mobile/build-1774018050630.ipa`, `apps/mobile/build-1773943381230.ipa`.

## Proposed Solutions

### Option A: git rm + gitignore (Recommended)
```
git rm apps/mobile/build-*.ipa
```
Add to `apps/mobile/.gitignore`:
```
*.ipa
*.apk
```
Commit. Optionally follow up with `git filter-repo` to purge the blobs from history on a coordinated maintenance window.
- Pros: Trivial; fixes bleed immediately; prevents future accidents.
- Cons: History still carries the blobs until a filter-repo pass.
- Effort: Small
- Risk: Low

### Option B: Git LFS
Move `.ipa`/`.apk` to LFS if there's an actual reason to version them.
- Pros: Keeps artifact history.
- Cons: There is no real reason to version these; EAS already stores builds.
- Effort: Medium
- Risk: Medium

## Recommended Action

Option A — build artifacts should not be in git, period.

## Technical Details

- **Affected files:** `apps/mobile/build-1776238760652.ipa`, `apps/mobile/build-1774018050630.ipa`, `apps/mobile/build-1773943381230.ipa`, `apps/mobile/.gitignore`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] `git ls-files apps/mobile | rg '\.ipa$|\.apk$'` returns nothing.
- [ ] `apps/mobile/.gitignore` contains `*.ipa` and `*.apk`.
- [ ] A fresh `eas build` output dropped into `apps/mobile/` is not tracked by git.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | code-simplicity-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
