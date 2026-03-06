---
status: pending
priority: p3
issue_id: "025"
tags: [code-review, typescript]
dependencies: []
---

# Admin and Mobile Apps Have No Env Validation

## Problem Statement

The API app validates env vars with Zod, but admin and mobile use non-null assertions (`!`) on `process.env.*`. Missing vars at runtime produce cryptic errors instead of clear startup failures.

## Findings

- **Source:** TypeScript Reviewer (M5), Architecture Strategist (MINOR #7)
- **Files:**
  - `apps/mobile/src/lib/supabase.ts:4-5`
  - `apps/mobile/src/lib/urql.ts:7`
  - `apps/admin/src/middleware.ts:8-9`
  - `apps/admin/src/lib/supabase-server.ts:8-9`

## Proposed Solutions

### Option A: Add Runtime Guard Clauses
Add `if (!process.env.X) throw new Error(...)` at module scope.
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] Missing env vars produce clear error messages at startup

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
