---
title: "[#365 T36] Decide on Credential Manager for Android Google sign-in (data-gated)"
labels: [research, enhancement, area:mobile, activation-365]
order: 51
task_id: T36
depends_on: [T18]
phase: P4
size: M
release_path: "decision only; if yes, a store build (native change, never OTA)"
---

## Context
#365, plan §3 T36, spec FS-OB2a, D15.

## Why
The free module uses the deprecated legacy Google Sign-In SDK on Android [SOURCE: R5 C1–C2]; every OB2 replay is Android [SOURCE: R5 Q17]; proxy loss 23/111 Android account viewers without sign-up, 10-15→11-12 [SOURCE: V1-q19; R5 Q9 had 20/124].

## What to change
After 4 weeks of `auth_oauth_*` counted from 3.29.0 go-live on Android: if "started, no result" ≥ 10% of Android Google starts, spike Credential Manager behind a flag (D15 licence/dependency decision); device check Pixel + Samsung; else close with numbers.

**Gate window (doc review 2026-11-12, item 3):** first-session onboarding events (`auth_oauth_*`, `onboarding_back`, `bike_setup_summary`, `auth_session_lost` during onboarding) exist only from **3.29.0**: by owner rule D17 (2026-11-12) the P0 instrumentation ships only in Release A 3.29.0 (TR0 removed by D17), and a new rider's first session runs the binary's embedded JS. So the gate window counts from 3.29.0 go-live **per platform**; the pre-fix comparison is the R5 proxy SQL (Android account viewers without `signup_completed`, verbatim `R5…:213-221`; baseline 20/124) (`$screen`-based).

## How
Query below; if spiking: Context7 docs for the current library, native change → store build only.

## Acceptance criteria
- [ ] Decision + numbers in `experiments.md`.
- [ ] If built: Android Google started→success ≥ 90% on the new build.

## Verification
`SELECT countIf(event='auth_oauth_started') s, countIf(event='auth_oauth_result') r FROM events WHERE timestamp >= '<3.29.0 Android go-live>' AND timestamp < '<go-live + 28 d>' AND toString(properties.provider)='google' AND lower(coalesce(toString(properties.platform), toString(properties.$os)))='android' AND {EXCL}`.

## Friction spec
FS-OB2a. Repro: Android emulator with GMS + a Google account (T00 AVD if Google sign-in works on it, else T00's optional API-34 `google_apis_playstore` AVD) → account → Google: (a) Back, (b) double tap, (c) airplane after picking. Expected: (a) cancelled, no alert; (b) one sheet; (c) friendly message ≤ 10 s. Automated check: `onboarding-oauth-cancel.yaml` (maestro local, Android w/ Google account) + jest.

## Production metric
"Started, no result" share (verbatim `R5…:197-209`) by `{REL}`; target ≤ 5% of Google starts; Android account-step loss ≤ 10%. Annotate if shipped.

## Release
Decision; native → store release only.

## Dependencies
- Blocked by: T18 (the gate window starts at 3.29.0 go-live).
- Blocks: —

## Out of scope
iOS Apple sign-in.

## Constraints
D15; native modules never by OTA.
