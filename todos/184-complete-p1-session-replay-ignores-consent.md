---
status: complete
priority: p1
issue_id: "184"
tags: [code-review, mobile, security, privacy, gdpr, posthog, session-replay]
dependencies: []
---

# Session replay records regardless of analytics consent (GDPR) — BLOCKS MERGE

## Problem Statement
PR #78 enables PostHog mobile session replay (`analytics.ts:35` `enableSessionReplay: !__DEV__`). The user's privacy toggle is enforced **only** via `posthogClient.optOut()` in `setAnalyticsEnabled` (`analytics.ts:150-162`). But `optOut()` gates only the JS event queue (`enqueue`/`sendImmediate`) — it does **not** stop the native session-replay recorder. `startSessionReplay()` checks only `!isDisabled && enableSessionReplay`, never `optedOut`, and the app never calls `stopSessionRecording()` (zero references in src).

Result: a user (incl. EU — a target market) who turned **off** Analytics in the Privacy screen still has their screens recorded and uploaded. Consent is also resolved from a server `me` query after login (`_layout.tsx:178-189`) while `analyticsEnabled` defaults to `true` (`analytics.ts:44`), so replay records the entire cold-start/login/onboarding window before consent is even known. This is a GDPR consent violation, not just a UX bug.

## Findings
- `optOut()` only sets the persisted OptedOut flag checked by the JS queue (verified in `node_modules/posthog-react-native` / `@posthog/core`). Native replay pipeline is separate. — security-sentinel
- App never calls `startSessionRecording`/`stopSessionRecording`.
- `disabled: __DEV__` DOES stop replay in dev (recorder checks `isDisabled`), so this only affects release builds — exactly where real users are.

## Proposed Solutions
1. **(Recommended) Wire replay to consent.** In `setAnalyticsEnabled(false)` call `posthogClient.stopSessionRecording()`; in the `true` branch call `startSessionRecording()`. Start with replay effectively off until consent is confirmed.
   - Pros: directly fixes the violation. Cons: must confirm exact SDK method names for v4.41.1.
2. **Persist last-known consent locally (MMKV/SecureStore)** and apply it synchronously at startup before the recorder starts, instead of waiting on the network `me` query. Pairs with #1 to close the pre-consent window.
3. Default `analyticsEnabled`/replay OFF until first consent is known (conservative for EU).

## Acceptance Criteria
- [ ] A user who has Analytics disabled produces **no** session recordings (verify in PostHog after a native build).
- [ ] No replay is captured during the pre-consent cold-start window.
- [ ] `setAnalyticsEnabled` start/stops the native recorder alongside optIn/optOut.

## Technical Details
Affected: `apps/mobile/src/lib/analytics.ts:35,44,150-162`, consent load `apps/mobile/src/app/_layout.tsx:178-189`, `privacy.tsx:36-38`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (security-sentinel). The replay enablement in this PR introduced it.

## Resources
- PR #78; `docs/Onboarding-Funnel-Instrumentation-Fix.md` (Defect 3)
