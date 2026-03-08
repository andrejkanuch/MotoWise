---
status: complete
priority: p2
issue_id: "069"
tags: [code-review, web, nextjs, navigation]
---

# Navbar logo uses <a> instead of Next.js <Link>

## Problem Statement

The navbar logo link uses a raw `<a>` tag instead of Next.js `<Link>`, causing a full page reload on click instead of client-side navigation.

**File:** `apps/web/src/components/marketing/navbar.tsx`

## Findings

- Architecture-strategist and learnings-researcher both flagged this
- Past solution (todo 034) already fixed this exact issue in admin pages
- `<Link>` enables prefetching and client-side transitions

## Proposed Solutions

1. **Replace with `<Link>`** (Recommended)
   - Import `Link` from `next/link`
   - Replace `<a href="/">` with `<Link href="/">`
   - **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Logo click navigates without full page reload
- [ ] Prefetching works for homepage
