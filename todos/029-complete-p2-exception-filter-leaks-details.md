---
status: pending
priority: p2
issue_id: "029"
tags: [code-review, security]
dependencies: []
---

# Exception Filter Leaks Validation Error Details to Clients

## Problem Statement

The `AllExceptionsFilter` forwards `exception.getResponse()` directly to clients via GraphQL error extensions. This leaks internal validation schema details, field names, and error structures that aid attackers.

## Findings

- **Source:** Security Sentinel (P2-5)
- **File:** `apps/api/src/common/filters/gql-exception.filter.ts:9-11`

## Proposed Solutions

### Option A: Sanitize Response
Only return user-safe error messages. For validation errors, return field names and messages but strip internal details.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No raw `getResponse()` forwarded to clients in production
- [ ] Validation errors still include field-level messages for UX
- [ ] Unknown exceptions logged server-side, generic message to client

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
