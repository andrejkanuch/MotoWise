---
status: complete
priority: p2
issue_id: "188"
tags: [code-review, mobile, architecture, auth, data-integrity]
dependencies: []
---

# Server-revoked session at cold start no longer runs local-data cleanup

## Problem Statement
The PR gates the entire logout+cleanup block behind `prevUserIdRef.current` (`_layout.tsx:338-361`). `prevUserIdRef` is a **per-mount** ref, null on every app launch. If a session is revoked server-side (password reset elsewhere, admin ban, refresh-token rotation failure) and the app is then **cold-started**, `INITIAL_SESSION` fires with a null session and `prevUserIdRef` is null → the cleanup (`queryClient.clear`, `clearPersistedQueryCache`, `SecureStore.deleteItemAsync(LAST_USER_KEY)`, `clearSyncQueue`, `clearRideData`, `cancelAllNotifications`, `clearAllWidgets`) is **skipped**. On `main` the old `if (!session)` block ran it.

Impact is **contained, not a privacy leak**: the persisted-query-cache buster (`persisted-query-provider.tsx:16`, keyed by `sessionUserId ?? LAST_USER_KEY`) prevents loading another user's persisted cache, and on next login as the same user the stale cache is their own data (refetched/invalidated normally). The residual wart: that user's notifications/widgets persist until the next in-app sign-out. Worth fixing for correctness; not a blocker.

## Proposed Solutions
1. **(Recommended) Decouple the two concerns** (architecture rec #3): gate **only** `resetUser()` + `logoutRevenueCat()` behind `prevUserIdRef` (that's the funnel-orphaning fix), but run the local-data cleanup whenever a null session is observed **and** `LAST_USER_KEY` exists in SecureStore (a persistent signal that survives cold starts, unlike the per-mount ref).
2. Initialize `prevUserIdRef` from `LAST_USER_KEY` at mount so a revoked cold-start session still counts as "had a user."
3. Accept as-is and document the minor staleness (buster makes it safe).

## Acceptance Criteria
- [ ] A cold start with a server-revoked session still clears local user data (or documented as acceptable with rationale).
- [ ] The PostHog anonymous-id orphaning fix (Defect 1) is preserved — `resetUser()` still NOT called on a genuine first-launch anonymous visitor.

## Technical Details
Affected: `apps/mobile/src/app/_layout.tsx:338-361`; mitigating: `apps/mobile/src/lib/persisted-query-provider.tsx:13-20`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (architecture-strategist).

## Resources
- PR #78; `docs/Onboarding-Funnel-Instrumentation-Fix.md` (Defect 1)
