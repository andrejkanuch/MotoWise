---
title: "Dead JWKS verification path due to missing await on decodeProtectedHeader"
category: security-issues
date: 2026-03-20
tags: [jose, jwt, async, nestjs, auth-guard, jwks, supabase]
module: GqlAuthGuard
symptom: "All JWT tokens verified via HS256 path regardless of token type; JWKS asymmetric verification never executes"
root_cause: "Missing await on jose's decodeProtectedHeader() — returns a Promise, so header.kid is always undefined"
severity: critical
---

# Dead JWKS Verification Path — Missing `await` on `decodeProtectedHeader`

## Problem

The `GqlAuthGuard` had two JWT verification paths: HS256 (shared secret) and JWKS (asymmetric keys). The JWKS path was **dead code** — it never executed regardless of the token type.

```typescript
// gql-auth.guard.ts:56 — BEFORE (broken)
const header = decodeProtectedHeader(token);  // Returns Promise, NOT header object
if (header.kid) {  // Always undefined — checking .kid on a Promise
  // JWKS path — NEVER REACHED
}
```

## Root Cause

`jose`'s `decodeProtectedHeader()` returns a `Promise<JWTHeaderParameters>`. The guard called it without `await`, so `header` was a Promise object. `Promise.kid` is always `undefined`, so every token — regardless of its actual header — fell through to the HS256 legacy path.

## Why Tests Missed It

The test mock returned a synchronous value:
```typescript
mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });  // Synchronous — masks the bug
```

Both the HS256 and JWKS test paths passed because the mock bypassed the async behavior entirely.

## Solution

**Production fix** — add `await`:
```typescript
// gql-auth.guard.ts:56 — AFTER (fixed)
const header = await decodeProtectedHeader(token);
if (header.kid) {
  // JWKS path — now correctly reached for asymmetric tokens
}
```

**Test fix** — mock returns a Promise:
```typescript
mockDecodeProtectedHeader.mockResolvedValue({ alg: 'HS256' });  // Async — matches real jose API
```

## Prevention

- When mocking async functions, always use `mockResolvedValue` / `mockRejectedValue` instead of `mockReturnValue`. This catches missing `await` in production code.
- Add a lint rule or code review checklist item: "Every `await import()` function call should be `await`-ed at the call site."
- The security sentinel review agent caught this by comparing the mock behavior against the real jose API signature.

## Related

- PR #34: feat(api): Add comprehensive test coverage for core backend modules
- jose library docs: `decodeProtectedHeader` returns `Promise<JWTHeaderParameters>`
- Also fixed in same PR: free-tier bike limit changed from fail-open to fail-closed
