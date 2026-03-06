---
status: pending
priority: p3
issue_id: "033"
tags: [code-review, security]
dependencies: []
---

# Admin Dashboard Missing Strict-Transport-Security (HSTS) Header

## Findings

- **Source:** Security Sentinel (P3-3)
- **File:** `apps/admin/next.config.ts:5-15`
- Has X-Frame-Options, X-Content-Type-Options, Referrer-Policy but no HSTS

## Fix

Add to headers array:
```typescript
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
```

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
