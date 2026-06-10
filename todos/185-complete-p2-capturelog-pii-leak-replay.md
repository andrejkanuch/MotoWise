---
status: complete
priority: p2
issue_id: "185"
tags: [code-review, mobile, security, privacy, posthog, session-replay]
dependencies: ["184"]
---

# `captureLog: true` can ship PII/coords/auth errors into session replays

## Problem Statement
`analytics.ts:40` sets `captureLog: true`. Visual masking (`maskAllTextInputs`/`maskAllImages`/`maskAllSandboxedViews`) masks the rendered layer, but `captureLog` is a **text side-channel** masking does not touch. In the SDK, `captureLog = localCaptureLog && remoteConsoleLogEnabled` — so it also needs the server-side console-log flag (partial mitigation), but flipping that one dashboard setting (no app release) would retroactively start capturing console output into replays.

The app has ~34 `console.*` calls, several logging full error objects that can carry PII/identifiers:
- `supabase.ts:54` — `signOut failed` Supabase auth errors (email/session context)
- `(tabs)/(profile)/upgrade.tsx:210,274,297` — RevenueCat purchase/restore errors (app user IDs/receipt)
- `utils/mapbox-geocoding.ts:86,151,178`, `mapbox-directions.ts:111` — reverse-geocode errors echoing precise coordinates
- `utils/ride-location.ts:317` — background GPS errors

## Proposed Solutions
1. **(Recommended) Set `captureLog: false`.** The diff comment claims masking means "no PII ever captured" — `captureLog` defeats that. Cheapest correct fix.
2. Keep `captureLog: true` only after auditing/scrubbing every `console.*` to ensure no coordinates, auth context, or purchase identifiers are interpolated.

## Acceptance Criteria
- [ ] `captureLog: false`, OR a documented audit confirming no console call leaks PII + the remote flag policy.
- [ ] Update the `analytics.ts` comment so it no longer over-claims PII safety.

## Technical Details
Affected: `apps/mobile/src/lib/analytics.ts:40`.

## Work Log
- 2026-06-09: Found during /ce-review of PR #78 (security-sentinel).

## Resources
- PR #78
