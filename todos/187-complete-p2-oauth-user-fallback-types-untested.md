---
status: complete
priority: p2
issue_id: "187"
tags: [code-review, mobile, typescript, oauth, quality, testing]
dependencies: []
---

# OAuth `data.user ?? data.session?.user ?? null` fallback contradicts SDK types & is untested

## Problem Statement
In `oauth.ts:86,106` (both `signInWithApple`/`signInWithGoogle`):
```ts
return { isNewUser: isNewlyCreatedUser(data.user ?? data.session?.user ?? null) };
```
`signInWithIdToken` returns `AuthTokenResponse`; after `if (error) throw error`, TS narrows `data` to `{ user: User; session: Session }` — **both non-null**. So `?? data.session?.user ?? null` is statically unreachable. The accompanying comment claims "`data.user` can be null/incomplete" (a real runtime observation), but the code expresses it in a way the types say is impossible, and `data.session.user` is the same object from the same token — so the fallback gives false confidence. A reader can't tell if it's load-bearing.

Also: the fallback and the `now` default param (`now = new Date()`) are **untested** — `signInWithIdToken` is already mocked, so a test could pin "falls back to `data.session.user` when `data.user` is null" cheaply. Today the fallback could be deleted and every test still passes.

## Proposed Solutions
1. **(Recommended) Decide and document.** If the runtime null is real, document the specific provider/scenario and keep `data.user ?? data.session?.user` (drop the impossible `?? null`). If speculative, simplify to `isNewlyCreatedUser(data.user)`. Either way reconcile comment vs types.
2. **Extract a tiny `resolveUser(data)` helper** (the expression + rationale are duplicated verbatim across both functions — flagged independently by code-simplicity-reviewer). One source of truth.
3. **Add a test** asserting the fallback selects `data.session.user` when `data.user` is null, and one call exercising the `now` default.

## Acceptance Criteria
- [ ] Comment and types agree (no "impossible" branch left unexplained).
- [ ] User-resolution logic lives in one place (helper) if kept.
- [ ] Tests cover the fallback path and the default `now`.

## Technical Details
Affected: `apps/mobile/src/lib/oauth.ts:82-107`, `apps/mobile/src/lib/__tests__/oauth-errors.test.ts`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (kieran-typescript-reviewer + code-simplicity-reviewer, merged).

## Resources
- PR #78
