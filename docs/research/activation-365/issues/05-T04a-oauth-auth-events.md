---
title: "[#365 T04a] Auth events: auth_oauth_started/result, auth_error_alert_shown, auth_email_submitted, auth_post_signin_wait"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 5
task_id: T04a
depends_on: [T01]
phase: P0
size: S
release_path: "Release A store build 3.29.0 (D17)"
---

## Context
#365, plan §3 T04 (split a), specs FS-OB2a/b/c, FS-OB5. Gates T11, T12, T36 decisions.

## Why
OAuth attempts, cancels, errors and durations are invisible: no event on tap/cancel/error; `sign_in_oauth_clicked` is web-only [SOURCE: hooks/use-oauth-sign-in.ts:28-38; R5 Q1–Q3]. Cancel shows an `Alert` but fires no event [SOURCE: lib/oauth-error-alert.ts:19; R5 C4]. Proxy baseline: Android account viewers without `signup_completed` 20/124 (16.1%) [SOURCE: R5 Q9].

## What to change
| Event | Properties | Where |
|---|---|---|
| `auth_oauth_started` | `provider`, `surface: onboarding_account\|onboarding_sign_in\|login\|register` | `hooks/use-oauth-sign-in.ts` before the provider call (hook gains `surface`) |
| `auth_oauth_result` | `provider, surface, outcome: success\|cancelled\|in_progress\|no_play_services\|cannot_present\|error, stage: sheet\|token_exchange, duration_ms, is_new_user, error_code` | same hook, `finally`; marks from `lib/oauth.ts:121-182` |
| `auth_error_alert_shown` | `provider, outcome, error_code` | `lib/oauth-error-alert.ts` `presentOAuthError` |
| `auth_email_submitted` | `surface, mode: signup\|signin` | `app/(onboarding)/account.tsx`, `app/(onboarding)/sign-in.tsx` |
| `auth_post_signin_wait` | `wait_ms, outcome: advanced\|already_onboarded\|me_error\|timeout` | `app/(onboarding)/account.tsx:125-148` |
Also `surface` on `user_signed_up`/`user_signed_in`. Add names to `AnalyticsEvent` (`lib/analytics.ts`) and `packages/analytics/src/events.ts`.

## How
Jest `apps/mobile/src/__tests__/hooks/use-oauth-sign-in.test.ts`: resolve / cancel / in-progress / network error → exactly one `auth_oauth_started` + one `auth_oauth_result` with typed props; `auth_error_alert_shown` fires whenever `presentOAuthError` shows. Document in `docs/onboarding-ab-event-schema.md`. No email, no free-text message in properties.

## Acceptance criteria
- [ ] Jest passes; `pnpm verify:mobile` green.
- [ ] Event schema doc updated.
- [ ] After 3.29.0 go-live, `read-data-schema` lists the five events within 48 h.

## Verification
`SELECT event, uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event IN ('auth_oauth_started','auth_oauth_result','auth_error_alert_shown','auth_email_submitted','auth_post_signin_wait') AND {EXCL} GROUP BY event` → started/result/email non-zero within 7 d of 3.29.0 go-live.

## Friction spec
FS-OB2a/OB2c/OB5 (measurement part). Repro: Android emulator, account step, "Continue with Google", press Back on the picker. Expected: one `auth_oauth_started` + one `auth_oauth_result {outcome:'cancelled'}` (and, until T12, one `auth_error_alert_shown`). Automated check: jest (CI) above — Maestro cannot complete OAuth.

## Production metric
FS-OB2a "started, no result" = started − results per provider × platform by `{REL}` (verbatim `deep-dives/R5-signin-and-measurement.md:197-209`, `activation_fix_level`). Baseline: none (new); proxy 23/111 Android account viewers without sign-up, 10-15→11-12 [SOURCE: V1-q19] (R5: 20/124); proxy SQL never applies `{RN}` to the server event `signup_completed`. Target ≤ 5% of Google starts; read 2–4 weeks after 3.29.0 go-live per platform (feeds T36). Tile "FS-OB2a — Google started without result". Annotate Release A per T03a.

## Release
JS only → Release A 3.29.0 (owner rule D17; no OTA).

## Dependencies
- Blocked by: T01.
- Blocks: T11, T12, T36, T18.

## Out of scope
Any UI change (T12 fixes the alert).

## Constraints
Never `Application Backgrounded` as "left the app" on Android account step (Google sheet = background, 80/81) [SOURCE: R5 Q10]; no PII.
