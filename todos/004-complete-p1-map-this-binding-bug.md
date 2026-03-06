---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, typescript, bug]
dependencies: []
---

# `.map(this.mapRow)` Detaches `this` — Will Crash When mapRow Uses Instance State

## Problem Statement

Three services pass `this.mapRow` as a callback to `.map()`, which detaches the method from its class instance. Currently works by accident because `mapRow` doesn't reference `this`, but will throw `TypeError` the moment any `mapRow` needs instance state (logger, config, etc).

## Findings

- **Source:** TypeScript Reviewer (C3)
- **Files:**
  - `apps/api/src/modules/motorcycles/motorcycles.service.ts:18`
  - `apps/api/src/modules/diagnostics/diagnostics.service.ts:18`
  - `apps/api/src/modules/learning-progress/learning-progress.service.ts:17`
- `articles.service.ts:46` already uses the correct arrow function pattern

## Proposed Solutions

### Option A: Use Arrow Functions (Simple Fix)
Change `.map(this.mapRow)` to `.map((row) => this.mapRow(row))`
- **Effort:** Small (3 lines)
- **Risk:** None

## Acceptance Criteria

- [ ] All `.map(this.mapRow)` calls replaced with `.map((row) => this.mapRow(row))`
- [ ] Consistent with the pattern in `articles.service.ts`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Latent bug — works now but will crash when mapRow evolves |
