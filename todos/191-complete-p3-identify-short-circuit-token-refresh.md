---
status: complete
priority: p3
issue_id: "191"
tags: [code-review, mobile, performance, analytics]
dependencies: []
---

# Avoid redundant `identifyUser` on every TOKEN_REFRESHED

## Problem Statement
`onAuthStateChange` calls `identifyUser(session.user.id)` on every session-bearing event, including `TOKEN_REFRESHED` and `USER_UPDATED`. `identifyUser` (`analytics.ts:177-191`) `await`s `getStoredUtmProperties()` (a SecureStore read) and calls `posthog.identify()` on each — idempotent but wasteful network/IO chatter on every token refresh.

## Proposed Solution
Short-circuit when the id is unchanged: `if (prevUserIdRef.current !== session.user.id) identifyUser(session.user.id)` — the ref is already in scope right there. Still set `prevUserIdRef.current = session.user.id` afterward.

## Acceptance Criteria
- [ ] `identifyUser` runs once per genuine identity change, not on every token refresh.
- [ ] First identify after sign-in still fires (ref starts null).

## Technical Details
Affected: `apps/mobile/src/app/_layout.tsx:337-341`, `apps/mobile/src/lib/analytics.ts:177-191`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (architecture-strategist).

## Resources
- PR #78
