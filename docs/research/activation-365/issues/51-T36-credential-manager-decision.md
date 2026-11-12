---
title: "[#365 T36] Decide on Credential Manager for Android Google sign-in (data-gated)"
labels: [research, enhancement, area:mobile, activation-365]
order: 51
task_id: T36
depends_on: [TR0]
phase: P4
size: M
release_path: "decision only; if yes, a store build (native change, never OTA)"
---

## Context
#365, plan §3 T36, spec FS-OB2a, D15.

## Why
The free module uses the deprecated legacy Google Sign-In SDK on Android [SOURCE: R5 C1–C2]; every OB2 replay is Android [SOURCE: R5 Q17]; proxy loss 20/124 [SOURCE: R5 Q9].

## What to change
After 2–4 weeks of `auth_oauth_*` (TR0 + Release A): if "started, no result" ≥ 10% of Android Google starts, spike Credential Manager behind a flag (D15 licence/dependency decision); device check Pixel + Samsung; else close with numbers.

## How
Query below; if spiking: Context7 docs for the current library, native change → store build only.

## Acceptance criteria
- [ ] Decision + numbers in `experiments.md`.
- [ ] If built: Android Google started→success ≥ 90% on the new build.

## Verification
`SELECT countIf(event='auth_oauth_started') s, countIf(event='auth_oauth_result') r FROM events WHERE timestamp > now() - INTERVAL 28 DAY AND toString(properties.provider)='google' AND lower(coalesce(toString(properties.platform), toString(properties.$os)))='android' AND {EXCL}`.

## Friction spec
FS-OB2a. Repro: Android emulator (Google Play image) → account → Google: (a) Back, (b) double tap, (c) airplane after picking. Expected: (a) cancelled, no alert; (b) one sheet; (c) friendly message ≤ 10 s. Automated check: `onboarding-oauth-cancel.yaml` (maestro local, Android w/ Google account) + jest.

## Production metric
"Started, no result" share (verbatim `R5…:197-209`) by `{REL}`; target ≤ 5% of Google starts; Android account-step loss ≤ 10%. Annotate if shipped.

## Release
Decision; native → store release only.

## Dependencies
- Blocked by: TR0.
- Blocks: —

## Out of scope
iOS Apple sign-in.

## Constraints
D15; native modules never by OTA.
