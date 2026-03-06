---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, performance]
dependencies: []
---

# No GraphQL Query Depth or Complexity Limiting

## Problem Statement

The Apollo Server configuration has no `validationRules` for query depth or complexity. Any client can send deeply nested or expensive queries, enabling DoS attacks as the schema grows with nested relationships.

## Findings

- **Source:** Performance Oracle (both instances)
- **File:** `apps/api/src/app.module.ts:24-30`
- No `graphql-depth-limit` or `graphql-query-complexity` installed
- Current schema is flat, but as `@ResolveField` resolvers are added, exponential DB load becomes possible

## Proposed Solutions

### Option A: Add depth-limit and complexity packages
Install `graphql-depth-limit` and `graphql-query-complexity`, configure in Apollo Server options.
- **Pros:** Industry standard, well-tested
- **Cons:** Requires tuning complexity values
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `graphql-depth-limit` installed and configured (max depth: 7)
- [ ] `graphql-query-complexity` installed and configured (max complexity: 1000)
- [ ] Overly deep/complex queries return a clear error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Both performance reviews flagged this |

## Resources

- `apps/api/src/app.module.ts`
