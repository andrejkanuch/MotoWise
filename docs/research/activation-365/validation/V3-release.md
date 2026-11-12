# V3: release and tooling assumptions (read-only check, 2026-11-12 ~14:20 UTC)

Scope: the release assumptions in `EXECUTION_PLAN.md` (D14, D17, §3A.0 rule 1, §0 Maestro bullets, T18, T35, §6 row 0), checked against EAS, Google Play, App Store Connect, PostHog (project 155556), production Supabase (read-only transactions) and this machine.
Only read commands were run. Nothing was written to any service. The `gplay status` read opens a Play edit (`edit_id 06946068668191371498`) that it never commits.
Code reference: research checkout `7e29f7c0` (origin/main).

Status key: **holds** / **does not hold** / **partly holds** / **unknown**. Confidence is given for each conclusion.

---

## 1. EAS Update (production branch)

**Login: holds.** `eas whoami` returns account `andykeny` (eas-cli 23.2.0 is installed; 27.7.2 is available).

**Tooling caveat (does not hold for the research checkout).** `eas update:list` fails in `/Users/andrejmacm5/personal/MotoWise-research/apps/mobile`:
`PluginError INVALID_PLUGIN_IMPORT ... plugins/with-android-manifest-hygiene.js:1:48`. The clean checkout has no `node_modules` (`ls node_modules` is empty), so `app.config.ts` cannot be evaluated.
The same read-only command was run from `/Users/andrejmacm5/personal/MotoWise/apps/mobile`, which uses the same EAS project (`projectId 359ae282-329d-455d-b9f3-64919afad0b4` in both checkouts' `app.config.ts`).
Any agent running `eas` or Expo commands from the research checkout must run `pnpm install` first.

Command: `eas update:list --branch production --limit 30 --json --non-interactive`, then `eas update:view <group> --json` for each runtime's newest group.
The `production` channel maps only to the `production` branch (`eas channel:view production`: one branchMapping with logic `true`).

| Runtime | Latest group | Git commit | Published (UTC) | Note |
|---|---|---|---|---|
| 3.28.0 | `fece7a3c` | `5a497a1c` (#388, includes #387) | 2026-11-12 09:52 | previous 3.28.0 group: `211501b2` / `ced94b7d`, 11-10 17:06 |
| 3.27.0 | **none** | — | — | 3.27.0 riders run the JS embedded in iOS b108 / Android vc95; no OTA has ever targeted 3.27.0 |
| 3.26.0 | `bd05b306` | `0b099fd3` | 2026-11-03 10:50 | 8 groups on 3.26.0 (29010ab9 → bd05b306) |
| 3.25.0 | `848c0f00` | `59a4ce64` | 2026-10-11 10:32 | |
| 3.21.0 | `57b6f674` | `e3c0d33d` | 2026-10-08 16:22 | |
| 3.19.1 | `78411c81` | `3bb25031` | 2026-09-22 07:13 | |
| 3.18.0 … 3.0.0 | older | | ≤ 2026-07-30 | |

Each group covers both android and ios.

- **Holds:** the plan's former TR0 cut point "3.28.0: `fece7a3c` / `5a497a1c`" (§9 row 3) matches EAS exactly. `5a497a1c` is an ancestor of research HEAD (`git merge-base --is-ancestor`). Confidence 99%.
- **Holds:** OTAs are per runtime. `runtimeVersion.policy: 'appVersion'` and `version: '3.28.0'` are at `apps/mobile/app.config.ts:37`. An OTA from `main` today reaches only 3.28.0 binaries.
- **New fact for D17 hotfix planning:** 3.27.0 has no production update. A crash hotfix for 3.27.0 riders would be the first OTA on that runtime. Under the runbook's older-runtime procedure it would branch from the 3.27.0 *store-build* commit (iOS b108 / Android vc95 `2ce57d1d`), not from an update commit.

## 2. Google Play (com.motovault.app)

Command: `gplay status --package com.motovault.app --pretty`. The tracks source returned ok. The vitals source failed with a 400 (a CLI metric-combination bug), which does not affect the tracks.

| Track | Release name | Status | Version codes |
|---|---|---|---|
| production | 3.28.0 | completed | **98** |
| internal | 3.22.0 | completed | 92 |
| internal | **"3.26.0"** | **draft** | **99** |
| alpha | 3.19.0 | completed | 81 |
| beta | 71 (3.13.0) | completed | 71 |

EAS Android builds (`eas build:list --platform android --limit 6`):
- vc99: appVersion 3.28.0, commit `52d281e9` (#393, FCM), 2026-11-12 11:09.
- vc98: 3.28.0, commit `76bdd746`, 11-11 13:13.
- vc97 and vc96: 3.28.0. vc95: 3.27.0 `2ce57d1d`.
- `git log 76bdd746..52d281e9` lists only `5a497a1c` (#388) and `52d281e9` (#393).

**vc98 review status: unknown from the API, but probably live.** The Play API reports the release as `completed` (100% rollout, committed). It does not expose Google's review state. The memory note `project_sentry_batch_1112` says it was in review from 11-12 ~08:40 UTC.
PostHog shows real riders on Android 3.28.0/98 (query P3 below):
- 5 new persons first seen on 11-12 at 11:23, 12:52, 13:09, 14:00 and 14:18 UTC.
- Their geo is MX, NL, PT, BR and RU.
- None of them has an earlier build in 30 days, so these are fresh installs.

That pattern points to vc98 having cleared review around 11:00 UTC on 11-12. Confidence 80%. To confirm, check the Play Console UI ("Publishing overview"), which the API does not show.

**vc99 on internal: holds, with a defect.**
- vc99 sits on the internal track as a **draft**. A draft is not delivered to internal testers either, so vc99 is not distributed through Play at all yet.
- The release is **named "3.26.0"**, but the bundle is versionName 3.28.0 (EAS build 99; the emulator's `dumpsys package com.motovault.app` gives `versionCode=99 versionName=3.28.0`).
- The release name is a label only, but it would appear as "3.26.0" in Console history if promoted as is.

Only one person has run vc99, the internal tester `4c551d…`. That tester has also run the internal builds 92, 95, 96, 97, 98 and 99 and is **not excluded by the project's test-account filters** (query P4).

Read-only DB check: `device_push_tokens` by platform returns ios 106 total (8 in the last 7 days) and **android 3 total, all 3 in the last 7 days**. Android tokens exist now only from FCM-capable test builds, so the plan's T06 item 9 baseline is not "0" but "3 (test devices)".

## 3. App Store (app 6760291360)

Command: `asc versions list --app 6760291360 --include build` (and `--paginate`).
- **Live: 3.28.0, build 111**, `READY_FOR_SALE`, version created 2026-11-10, release type MANUAL.
- Earlier versions: 3.27.0 b108, 3.26.0 b106, 3.25.0 b105, 3.22.4 b103, 3.22.0 b97.
- **No version is in review:** all 28 versions report `READY_FOR_SALE`. The newest createdDate is 3.28.0. The CLI warns that the API can report historical versions as READY_FOR_SALE, but no version is newer than 3.28.0.
- `asc builds list --sort -uploadedDate`: builds 111 (11-11), 110, 109 (11-10) and 108 are all VALID. No build newer than 111 exists, so nothing is pending for 3.29.0.
- Confidence 95%.

## 4. Which binaries riders run (PostHog, last 14 days)

Exclusions on every query:
- the project test-account filters: `person.properties.internal != 'true'` and the 4 hard-coded person ids;
- the 19 synthetic Supabase users (`public.users WHERE is_synthetic = true`, read-only), via `person_distinct_ids`;
- `$lib = 'posthog-react-native'`.

Platform = the person's latest non-null `$os`, falling back to `platform`. Version = the person's latest non-null `$app_version`.

**Query P1** (per person, latest version):

| Platform | $app_version | Riders 14 d | Seen in last 3 d |
|---|---|---|---|
| android | 3.26.0 (b93) | **108** | 32 |
| android | 3.28.0 (vc98/99) | 5 | 5 (incl. 1 internal tester) |
| ios | 3.26.0 | 37 | 5 |
| ios | 3.27.0 | 14 | 14 |
| ios | 3.28.0 | 11 | 11 |
| ipados | 3.26.0 | 1 | 0 |
| unknown | 3.26.0 / 3.19.0 / 3.19.1 | 6 / 2 / 2 | 0 |
| **total** | | **186** | |

**Query P2** (3.27.0/3.28.0 by `$app_build`, first seen):
- iOS b108: 16+7 persons, from 11-09.
- iOS b111: 9+3 persons, from 11-11 13:19.
- Android vc95/96/97 and iOS b109/b110: 1 person each, internal testers.
- Android vc98: 6 persons, from 11-11 14:07.
- Android vc99: 1 person, from 11-12 11:47.

What this shows:
- **82%** of riders seen in 14 days (152/186) last ran **3.26.0**. On Android that is 108 of 113, all binary b93. This confirms the plan's premise (§2 "Why store binaries", Q-P1) that a `main` OTA reaches few riders. Confidence 95%.
  - The plan's Q-P1 numbers (android 3.26.0 = 34, `(null)` = 107) undercount Android. Q-P1 used `$os` on `Application Opened` only, which is null on most events. Attributing platform per person moves most of the `(null)` 3.26.0 riders to Android.
- iOS riders upgrade fast: everyone on 3.27/3.28 was seen within 3 days.
- On Android only 32 of the 108 3.26.0 riders were active in the last 3 days, and Play production was 3.26.0 until about 11-12. Expect a slow Android upgrade tail after 3.29.0.
- Consequence for measurement:
  - **FS-OB\* first-session baselines on 3.29.0 grow only with new installs (≈ 40 impressions/day, store funnel)**.
  - **Post-onboarding returning-rider metrics on `lvl = 2` will be dominated by iOS for the first 2–4 weeks.** The plan's 2-week read is per platform; on Android it will have very few returning riders at `lvl = 2`.

## 5. Local tooling for the plan's Maestro checks

| Item | Result | Status |
|---|---|---|
| Maestro CLI | `maestro --version` → **2.6.1** (`~/.maestro/bin/maestro`) | holds |
| Java | Zulu OpenJDK **17.0.18** (arm64), the only JVM | holds |
| Android SDK | `ANDROID_HOME=~/Library/Android/sdk`. Contents: platforms `android-36`, system image `android-35/google_apis/arm64-v8a`, build-tools, cmdline-tools, ndk, emulator, platform-tools | holds |
| AVDs | `emulator -list-avds` → **`mv_repro`** only. Android 15 / API 35, `tag.id=google_apis`, `PlayStore.enabled=no`, GMS present | partly. FS-OB2b/T04/T36 ask for "Google Play image (API 34)"; this AVD has GMS but no Play Store |
| adb devices | `emulator-5554 device` (running) | holds |
| App on the emulator | `com.motovault.app` **vc99 / 3.28.0**: a production-profile build pointed at prod, without `EXPO_PUBLIC_OB_VARIANT=invested` | not usable as the plan's E2E build |
| iOS simulators | Xcode 27.2 (27B52). `xcrun simctl list runtimes` → **empty**; `xcrun simctl list devices available` → **no devices** | **does not hold.** No iOS runtime is installed, so no iOS sim check can run |
| Disk | 33 GiB free on `/` | an iOS runtime (several GB) plus Supabase images (a few GB) fit, but not with much room to spare |
| Supabase CLI | not on PATH (`supabase not found`). Not in the main checkout's `node_modules/.bin`. The research checkout has no `node_modules` | **does not hold.** `pnpm db:start` / `pnpm db:reset` (root `package.json:18-20`) cannot run as written; `npx supabase@<pinned>` would download it |
| Docker | Engine **29.5.3**, running | holds |
| Local stack (`local-stack.md`) | The `mvscratch` stack **is running** (7 containers, up 25 h, workdir `~/.motovault-local/mvscratch`). Read-only `schema_migrations` → max **00199**, 197 rows | partly. Repo HEAD has 200 migration files up to **00202**, so the local DB is missing 00200–00202 |
| `pnpm db:reset` "seeds the schema" (plan §0) | `data-verification.md:13-18`: the repo migrations do **not** replay on an empty DB. 00093 is an ordering issue; 00097, 00098 and 00102 fail and were patched in the scratch copy only (00098 and 00102 by guesswork) | **does not hold.** Seeded flows must use the patched `mvscratch` workdir (after applying 00200–00202 there), not `pnpm db:reset` on the repo |
| Local API against the stack | `local-stack.md`: `node_modules/.bin` is not executable on this machine, so the API starts through `node ../../node_modules/ts-node/...` | holds as documented. Needs `pnpm install` in the checkout used |
| E2E build profiles | `eas.json` `e2e-simulator` is **iOS-simulator only** (`ios.simulator: true`, `EXPO_PUBLIC_OB_VARIANT=invested`). No Android profile bakes `OB_VARIANT=invested` or `EXPO_PUBLIC_E2E_RUN`. `apps/mobile/android` and `ios/` do not exist (CNG, prebuild needed for local Release builds) | **does not hold** for Android. Android Maestro flows that need `onboarding.yaml`'s deterministic variant have no build recipe |
| Release runbook E2E | `docs/runbooks/mobile-release.md:12-16` requires `test:e2e:onboarding-paywall` on a **booted iOS simulator** before promoting any build | **blocked** until an iOS runtime is installed (`xcodebuild -downloadPlatform iOS`) |

## 6. CI and Maestro

`ls .github/workflows` returns `check-404-contract.yml`, `ci.yml` and `mobile-ota.yml`. `grep -rli maestro .github/` returns nothing (exit 1). `grep -rn -iE "e2e|simulator|emulator" .github/workflows` returns nothing.
**Holds:** no CI job runs Maestro, and none builds a mobile binary either. Store builds are manual `eas build` runs. `mobile-ota.yml` is a `workflow_dispatch` OTA publish with `--environment production`. Confidence 99%.

---

## Effect on plan confidence

**Confirmed**
- §2 "Why store binaries" and §3A.0 rule 1 (D17): an OTA reaches only its own runtime, and 82% of 14-day riders last ran 3.26.0 (Android 108/113 on b93). Shipping #365 only in 3.29.0/3.30.0 store builds is the right path.
- §0 "Maestro: no CI job runs Maestro". Every Maestro check stays `maestro (local, <device>)`.
- T18 and T35 versions: 3.29.0 and 3.30.0 are free on both stores. iOS latest is 3.28.0 b111 with nothing in review. Play production is 3.28.0 vc98. `app.config.ts:37` is at 3.28.0.
- §9 row 3 / former TR0 commit references (`fece7a3c`/`5a497a1c`) are accurate. They are moot now that TR0 is removed.
- Maestro 2.6.1, Java 17, Android SDK, a running emulator and Docker are present, so Android-tagged Maestro flows (FS-OB1b, FS-OB1e, FS-PO2a, FS-PO2b airplane mode, FS-OB3 "Don't keep activities") are runnable once an E2E Android build exists.

**Corrected / invalidated**
1. **§6 row 0 and Q-P1 note "Android production = 3.26.0" are outdated.** Play production is 3.28.0 vc98 (completed). PostHog shows fresh installs on vc98 from 11-12 ~11:23 UTC (80% that review cleared). Edit row 0 to: "3.26.0 (b93 Android / b106 iOS), 3.27.0 (iOS b108), 3.28.0 (iOS b111 from 11-11; Android vc98 from ~11-12)". Re-state Q-P1 with per-person platform attribution: Android 3.26.0 = 108, not 34.
2. **D14 / T18 "promote vc99 as soon as vc98 clears review".** vc98 appears cleared, so the condition is met. vc99 is a **draft named "3.26.0"** on internal, so it is not even with internal testers. The plan needs an explicit step:
   - (a) rename the release to "3.28.0 (99)";
   - (b) roll it to internal and smoke it (push token registers);
   - (c) promote it to production with owner go-ahead.
   Alternatively, the owner decides to let FCM ride in 3.29.0 (T18) and drop vc99.

   Note that vc99 adds only #388 and #393 over vc98. T06 item 9's push baseline should be "android = 3 tokens, all test devices (7 d)", not 0.
3. **§0 Maestro bullet "`pnpm db:reset` seeds the schema" does not hold.**
   - The repo migrations fail on an empty DB at 00097, 00098 and 00102 (`data-verification.md`). Supabase CLI is not installed, and the research checkout has no `node_modules`.
   - Replace the bullet with: "seeded flows use the patched local stack in `~/.motovault-local/mvscratch` (running, at 00199). First apply 00200–00202 there. Start or stop it with `npx supabase@<pinned version> … --workdir ~/.motovault-local/mvscratch`."
   - Add a one-time setup task (call it T00-env) covering this, `pnpm install` in the agent checkout, and `xcodebuild -downloadPlatform iOS` plus creating an iPhone simulator.
   - This affects every seeded flow: FS-PO2a and FS-PO2b (T08, T17), FS-PO3 `gate-frequency-cap.yaml` (T21), and FS-PO1/PO1H (T07a service-plan flows).
4. **Every "iOS sim" check is blocked today.**
   - Xcode 27.2 has no iOS simulator runtime and no devices.
   - Affected: FS-OB1a, FS-OB1b (iOS swipe-back, T19b), FS-OB3 (`onboarding-email-code-relaunch`, T13), the T14 iOS relaunch case, FS-PO6/T16 iOS legs, and T05c's "`inspect_screen` on iOS sim + Android emulator".
   - Also blocked: **the release runbook's mandatory `test:e2e:onboarding-paywall` gate for T18 and T35** (`mobile-release.md:12-16`).
   - Add the runtime install as a P0 prerequisite blocking T05c, T18 and T35. Do not plan around the deleted runtimes.
5. **No Android E2E build recipe.**
   - `e2e-simulator` is iOS-only, the emulator has the prod vc99 without `OB_VARIANT=invested` and `E2E_RUN`, and there are no `android/`/`ios/` dirs.
   - Add an `e2e-android` EAS profile (internal distribution, APK, `EXPO_PUBLIC_OB_VARIANT=invested`, `EXPO_PUBLIC_E2E_RUN=1`, sentry upload off) to the same setup task.
   - For seeded flows, add a variant whose `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_API_URL` point at `10.0.2.2`.
   - Affects every Android-tagged FS-OB/FS-PO flow and T04/T19.
6. **FS-OB2b / T04 / T36 device spec.** The plan asks for an "Android emulator with Google Play image (API 34)". The only AVD is API 35 `google_apis` (GMS, no Play Store). Either relax the spec to "GMS image + Google account" or add creating an API-34 `google_apis_playstore` AVD to the setup task. Unknown whether Google sign-in works on the current image (not tested).
7. **Test-account filter gap (affects every `{EXCL}` metric, T02/T03b).** The internal tester `4c551d…` runs internal builds 92–99, is not flagged `internal`, and inflates Android 3.28.0 counts (1 of 5). T02 should add it to the exclusion. That is a PostHog write and goes on the D2 list; this check made no write.
8. **Measurement expectation (T18/T35 verification, FS-M, §0 reading rule).**
   - 32 of the 108 Android 3.26.0 riders were active in the last 3 days, and Android adoption of a new binary is slow. For the first 2–4 weeks, `lvl = 2` returning-rider reads will be mostly iOS.
   - First-session FS-OB\* reads depend on new installs only.
   - State this in T18 Verification, and treat a thin Android `lvl = 2` cohort at the 2-week read as "no verdict", not as a regression signal.
9. **D17 hotfix note (§3A.0 rule 1).** Runtime 3.27.0 has never received an OTA. A hotfix to 3.27.0 must branch from the store-build commit `2ce57d1d` (vc95 / iOS b108), per `reference_ota_hotfix_older_runtime`. Add this to the hotfix guidance.

**Unknown (needs a UI check or owner input):** the exact Google review state of vc98 (Play Console UI). Whether to ship vc99 at all or fold FCM into 3.29.0 (owner). Whether Google sign-in works on the `google_apis` AVD.

**Net effect on confidence:**
- Release path and versioning: **raised**. The store-build-only plan matches reality, and 3.29.0/3.30.0 are clear on both stores.
- Verification feasibility: **lowered until a setup task lands**. There is no iOS runtime, no Supabase CLI, no repo-replayable schema and no Android E2E build, so none of the plan's iOS Maestro checks, seeded flows or the runbook's pre-promotion E2E can run on this machine today.

Fixing that is about half a day of setup with no app code (install the iOS runtime, `pnpm install`, a pinned `npx supabase`, apply 00200–00202 to `mvscratch`, an `e2e-android` profile). It belongs before T05c and must be done before the T18 cut (target submit 2026-11-30).
