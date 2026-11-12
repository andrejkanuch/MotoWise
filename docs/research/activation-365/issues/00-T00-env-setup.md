---
title: "[#365 T00-env] Test environment setup: iOS simulator, pinned Supabase CLI, local stack at the latest migration, Android E2E build recipe"
labels: [chore, area:mobile, area:db, activation-365]
order: 0
task_id: T00
depends_on: []
phase: P0
size: S
release_path: "local machine setup + one repo PR (apps/mobile/eas.json profile, apps/mobile/.maestro/README.md, docs); no app code, nothing reaches riders (D17 not affected)"
---

## Context
#365, plan §0 (Maestro bullets), §3A.0 rule 9, §11. Found by the validation of 2026-11-12: `validation/V3-release.md` §5 (tooling) and `validation/V4-device-repro.md` (Setup). First task in issue order: it **blocks T05c, T18, T35 and every task whose acceptance needs Maestro or an E2E build** (T01, T07b, T08–T17, T19a, T19b, T20, T21, T22, T24, T25b, T26–T32). Target: done before T05c starts and well before the T18 cut (submit target 2026-11-30). About half a day; no app code.

## Why
On 2026-11-12 none of the plan's iOS checks, seeded flows or the runbook's pre-promotion E2E could run on this machine [SOURCE: V3 §5]:
- **No iOS simulator runtime and no device** (Xcode 27.2; `xcrun simctl list runtimes` empty). Blocks every iOS Maestro check (FS-OB1a, FS-OB3 relaunch, T14 iOS, T19b, T05c's `inspect_screen` on iOS) and the runbook's mandatory `test:e2e:onboarding-paywall` on a booted simulator before any store promotion (`docs/runbooks/mobile-release.md:12-16`), i.e. T18 and T35.
- **Supabase CLI not installed** (not on PATH, not in `node_modules/.bin`), so `pnpm db:start`/`pnpm db:reset` (root `package.json:18-20`) cannot run.
- **`pnpm db:reset` cannot replay the repo migrations from empty:** 00093 (ordering), 00097, 00098 and 00102 fail; they were patched only in the scratch copy (`features/bike-detail-shell-overview/data-verification.md:13-18`). The patched stack `~/.motovault-local/mvscratch` was running but at migration **00199**; the repo has 00200–00202.
- **No Android E2E build:** `eas.json` `e2e-simulator` is iOS-only (`ios.simulator: true`, `EXPO_PUBLIC_OB_VARIANT=invested`); no profile bakes `OB_VARIANT=invested` or `EXPO_PUBLIC_E2E_RUN=1` for Android; no `preview` build exists (`eas build:list`); `apps/mobile/android` and `ios/` do not exist (CNG). The emulator only had the production vc99 build, pointed at production.
- **The agent checkout has no `node_modules`**, so `eas` and Expo commands fail there (`PluginError INVALID_PLUGIN_IMPORT … plugins/with-android-manifest-hygiene.js`).
- The only AVD is API 35 `google_apis` (GMS, no Play Store); FS-OB2a/T36 asked for a Play image (API 34); whether Google sign-in works on the current image is untested.

## What to change
1. **iOS:** `xcodebuild -downloadPlatform iOS` (several GB; 33 GiB were free on 2026-11-12), then create and boot an iPhone simulator (`xcrun simctl create "MV iPhone" <device type> <runtime>`); record the runtime and device id in `apps/mobile/.maestro/README.md`. Build or download the `e2e-simulator` profile app and install it.
2. **Supabase CLI, pinned:** use `npx supabase@<version>` with the version recorded in `~/.motovault-local/mvscratch/supabase/.temp/` (the one that created the stack), always with `--workdir ~/.motovault-local/mvscratch`. Document the exact command for start/stop/status in the README and in `features/bike-detail-shell-overview/local-stack.md`.
3. **Local stack to the repo's latest migration:** apply 00200–00202 (and anything newer on `main`) to `mvscratch` in order (copy the files into the scratch `migrations/`, apply with the pinned CLI or `psql` against `127.0.0.1:54322`); verify `select max(version) from supabase_migrations.schema_migrations` equals the repo's latest. Write down, in `local-stack.md` and `.maestro/README.md`, that **`pnpm db:reset` cannot replay the repo from empty** (00093/00097/00098/00102) and that seeded flows use `mvscratch`.
4. **Android E2E build recipe** (two forms, both documented):
   - an `e2e-android` profile in `apps/mobile/eas.json` (internal distribution, `android.buildType: "apk"`, `EXPO_PUBLIC_OB_VARIANT=invested`, `EXPO_PUBLIC_E2E_RUN=1` as the E2E marker for T01's `e2e_run`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT=e2e`, `SENTRY_DISABLE_AUTO_UPLOAD=true`), plus a local-stack variant whose `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_API_URL` point at `http://10.0.2.2:54321` and `http://10.0.2.2:4000/graphql` for seeded flows; or a dev-client build against the local stack;
   - the **universal-APK recipe** V4 used for read-only red runs on the real store binary: `bundletool build-apks --mode=universal` on the production AAB, signed with a local debug key, `adb install`. It talks to **production**, so it is only for flows that create no user, ride or other row.
   - Replace "preview build" in `.maestro/README.md` with these recipes (no EAS `preview` build exists).
5. **`pnpm install`** in the agent checkout(s), so `eas`, Expo, jest and the local API (`node ../../node_modules/ts-node/...`, per `local-stack.md`) run.
6. **Optional:** an API-34 `google_apis_playstore` AVD with a test Google account for FS-OB2a/T36/T15b; first try Google sign-in on the existing API 35 GMS AVD and record the result.

## How
Shell steps only, plus one small repo PR (`eas.json` profile, README/local-stack text). Run once end to end: boot the iPhone simulator, `maestro test apps/mobile/.maestro/flows/onboarding.yaml` on the `e2e-simulator` build; start `mvscratch`, run `apps/mobile/scripts/run-onboarding-e2e.sh` with `SUPABASE_URL=http://127.0.0.1:54321` against an `e2e-android` local-stack build on the emulator. Keep production keys out of every local command (local stack uses the public demo keys documented in `local-stack.md`).

## Acceptance criteria
- [ ] `xcrun simctl list devices available` shows the booted iPhone simulator; `onboarding-paywall-verify.yaml` (runbook E2E) runs on it — log in the PR.
- [ ] `npx supabase@<pinned> status --workdir ~/.motovault-local/mvscratch` is green and `schema_migrations` max = the repo's latest migration (≥ 00202).
- [ ] `e2e-android` profile merged; one APK built (EAS or local) and `onboarding.yaml` passes on the emulator with `OB_VARIANT=invested`; `e2e_run`-ready env present.
- [ ] One seeded flow (the T08 `E2E_SEED_DIAGNOSIS_USED=1` runner path, or the onboarding runner) completes against `mvscratch` from the emulator via `10.0.2.2`.
- [ ] `.maestro/README.md` and `local-stack.md` describe the recipes, the pinned CLI command, and "`pnpm db:reset` cannot replay from empty"; "preview build" no longer appears there.
- [ ] Google sign-in on the API 35 GMS AVD tried and the result recorded (and the optional Play-image AVD created if it fails).

## Verification
Commands and outputs pasted in the PR: `xcrun simctl list runtimes`, `xcrun simctl list devices available`, `emulator -list-avds`, `npx supabase@<pinned> status --workdir …`, the `schema_migrations` max, `eas build:list --profile e2e-android --limit 1` (or the local build log), two Maestro run logs (iOS sim, Android emu).

## Friction spec
None directly; enables the automated check of every FS-* spec that runs `maestro (local, <device>)` (plan §5A.1). Automated check: the two Maestro smoke runs above.

## Production metric
None (setup). Side rule: E2E builds carry `EXPO_PUBLIC_E2E_RUN=1` so T01's `e2e_run` super property keeps every E2E event out of `{EXCL}` metrics; read-only universal-APK runs against production must not sign in or create rows (V4 left anonymous events from `$device_model = 'sdk_gphone64_arm64'` on 2026-11-12; T02 excludes that person if one exists).

## Release
No app release. One repo PR for `eas.json` + docs; local machine state otherwise.

## Dependencies
- Blocked by: —
- Blocks: T05c, T18, T35, and every task whose acceptance needs Maestro or an E2E build: T01, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17, T19a, T19b, T20, T21, T22, T24, T25b, T26, T27, T28, T29, T30, T31, T32.

## Out of scope
Fixing the old migrations 00093/00097/00098/00102 in the repo (a separate data-model task, owner-applied); Maestro in CI (no macOS runner; plan §8 item 8); any production write.

## Constraints
No production Supabase or PostHog writes; no `.env` files committed; production keys never used against the local stack; `expo`/`react-native` stay in `apps/mobile` only; run Expo CLI from `apps/mobile`.
