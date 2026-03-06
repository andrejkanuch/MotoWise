---
status: pending
priority: p3
issue_id: "034"
tags: [code-review, performance]
dependencies: []
---

# Admin Dashboard Uses `<a>` Tags Instead of Next.js `<Link>`

## Findings

- **Source:** Architecture Strategist (P3-3), TypeScript Reviewer (P3-3)
- **File:** `apps/admin/src/app/dashboard/layout.tsx:8-20`
- Causes full page reloads instead of client-side navigation

## Fix

Replace `<a href="...">` with `<Link href="...">` from `next/link`.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
