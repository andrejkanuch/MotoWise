---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, security, typescript, architecture]
dependencies: []
---

# ZodValidationPipe Exists But Is Never Applied — No Input Validation

## Problem Statement

A `ZodValidationPipe` exists and CLAUDE.md documents it as a pattern, but it is never imported or used in any resolver. No GraphQL mutation has runtime input validation. The Zod schemas in `@motolearn/types` are completely disconnected from the API. A client could submit `year: 99999` for a motorcycle and it would pass.

## Findings

- **Source:** Architecture Strategist (IMPORTANT #2), TypeScript Reviewer (I1), Code Simplicity Reviewer
- **Files:**
  - `apps/api/src/common/pipes/zod-validation.pipe.ts` (defined but unused)
  - All resolver files (no `@UsePipes` annotations)
  - `@motolearn/types` validators (never imported by any app)

## Proposed Solutions

### Option A: Wire Up ZodValidationPipe on All Mutation Resolvers
Apply `@UsePipes(new ZodValidationPipe(Schema))` or `@Args('input', new ZodValidationPipe(Schema))` on each mutation.
- **Effort:** Medium (touch every mutation resolver)
- **Risk:** Low

### Option B: Delete Pipe and Schemas (If Not Ready)
Per simplicity reviewer: delete unused code, add back when actually needed.
- **Effort:** Small
- **Risk:** Medium (no validation at all)

## Recommended Action

Option A — the schemas already exist and are correct; just wire them up.

## Acceptance Criteria

- [ ] Every mutation resolver validates input via ZodValidationPipe
- [ ] `@motolearn/types` is actually imported in the API app
- [ ] Invalid inputs (e.g., year: 99999) are rejected with clear errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | All 3 review agents flagged this independently |
