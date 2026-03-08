---
status: complete
priority: p1
issue_id: "063"
tags: [code-review, nextjs, web, deprecation]
---

# Migrate middleware.ts → proxy.ts (Next.js 16 deprecation)

## Problem Statement

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts`. The dev server shows: "⚠ The 'middleware' file convention is deprecated. Please use 'proxy' instead." This is a breaking change that will stop working in future Next.js versions.

**File:** `apps/web/src/middleware.ts`

## Findings

- The current middleware handles Supabase auth session refresh and admin route protection
- Next.js 16 requires renaming to `proxy.ts` and exporting `function proxy()` instead of the default middleware export
- The middleware matcher config may need adjustment for the proxy API
- See: https://nextjs.org/docs/messages/middleware-to-proxy

## Proposed Solutions

1. **Rename and adapt** (Recommended)
   - Rename `middleware.ts` → `proxy.ts`
   - Export `function proxy()` instead of default middleware
   - Update matcher config to proxy format
   - Verify Supabase SSR auth still works with proxy pattern
   - **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `middleware.ts` renamed to `proxy.ts`
- [ ] Export changed to `function proxy()`
- [ ] No deprecation warning on dev server startup
- [ ] Admin route protection still works
- [ ] Supabase auth session refresh still works
