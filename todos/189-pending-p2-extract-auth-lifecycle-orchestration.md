---
status: pending
priority: p2
issue_id: "189"
tags: [code-review, mobile, architecture, refactor, testing]
dependencies: []
---

# Extract auth identity + cleanup orchestration out of the root layout

## Problem Statement
The `onAuthStateChange` handler in `_layout.tsx:335-365` mixes five concerns in one `useEffect`: GQL token-cache invalidation, Zustand session sync, RevenueCat identity, PostHog analytics identity, and destructive multi-subsystem cleanup (query cache, secure store, sync queue, ride MMKV, notifications, widgets). This PR adds `prevUserIdRef` bookkeeping on top. The root layout reaches directly into seven subsystems' internals with no domain boundary, and identity is now tracked in three places (`useAuthStore.session`, `LAST_USER_KEY`, `prevUserIdRef`). Pre-existing smell, worsened here.

## Proposed Solutions
1. **(Recommended) Extract `apps/mobile/src/lib/auth-lifecycle.ts`** exposing `onUserIdentified(userId)` and `onUserSignedOut()`; the layout's `onAuthStateChange` becomes a thin dispatcher. Removes inappropriate intimacy, collapses the identity sources, and makes transition logic unit-testable without mounting the root component.
2. Minimal: leave inline but **add a regression test** (see below) — lower cost, doesn't address the structural issue.

## Acceptance Criteria
- [ ] Auth transition logic is unit-testable in isolation.
- [ ] Regression test: null `INITIAL_SESSION` with no prior user runs NO cleanup and does NOT call `resetUser()`; `SIGNED_OUT` after a prior `SIGNED_IN` runs the full cleanup + `resetUser()`.

## Technical Details
Affected: `apps/mobile/src/app/_layout.tsx:335-365`. New: `apps/mobile/src/lib/auth-lifecycle.ts` (+ test).

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (architecture-strategist).

## Resources
- PR #78
