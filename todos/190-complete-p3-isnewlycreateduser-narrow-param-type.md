---
status: complete
priority: p3
issue_id: "190"
tags: [code-review, mobile, typescript, quality]
dependencies: ["187"]
---

# Narrow `isNewlyCreatedUser` param to remove `as User` test casts

## Problem Statement
`isNewlyCreatedUser(user: User | null)` only reads `created_at` and `last_sign_in_at`, but the type demands a full `User`. The test helper therefore casts: `({ created_at, last_sign_in_at }) as User` (`oauth-errors.test.ts:18`), plus an inline `{ last_sign_in_at } as User` at line 86. `as` casts in tests tend to metastasize.

## Proposed Solution
Narrow the param to `Pick<User, 'created_at' | 'last_sign_in_at'> | null` in `oauth.ts`. The function's true input contract becomes honest, the test helper needs no cast, and the inline line-86 cast disappears. Callers pass full `User` objects which satisfy the `Pick`.

## Acceptance Criteria
- [ ] `isNewlyCreatedUser` param is narrowed; no `as User` casts remain in the test.
- [ ] Tests still pass; production call sites still typecheck.

## Technical Details
Affected: `apps/mobile/src/lib/oauth.ts:54`, `apps/mobile/src/lib/__tests__/oauth-errors.test.ts:17-18,86`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (kieran-typescript-reviewer).

## Resources
- PR #78
