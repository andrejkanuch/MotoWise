# V4 — Device repro of low-confidence onboarding/ride frictions

Date: 2026-11-12, 15:15–15:30 CET (about 25 min of the 45 min box used). Research only: no code, no migrations, no sign-up, no sign-in, no purchase, no ride recorded.

## Setup (what could run)

| Item | Result | Source |
|---|---|---|
| Booted device / installed MotoVault build | none: `adb devices` empty, `xcrun simctl list devices` empty, no iOS runtimes, no Android system images, no AVDs | command output |
| EAS preview APK | none: the last 12 Android builds are `production` AABs plus one `development` APK (3.22.2, 2026-10-09). No `preview` profile build exists | `eas build:list --platform android --limit 12 --json` (run from the main checkout; in `MotoWise-research` it fails with "Unable to resolve a valid config plugin for ./plugins/with-android-manifest-hygiene", because that checkout has no `node_modules`) |
| What was used | **production 3.28.0 (versionCode 99) AAB** (`gitCommitHash 52d281e9`, built 2026-11-12 11:09Z). Converted with `bundletool build-apks --mode=universal`, signed with a local debug key, and installed on a new AVD `mv_repro` (Pixel 7, `system-images;android-35;google_apis;arm64-v8a`, gesture navigation). This is the binary riders get from the store, with production backend and PostHog | command output |
| Driving | `adb shell input` plus `uiautomator dump` (helper script in the scratchpad). Maestro was not needed | — |
| Process death | for (a): Home, then `adb shell am kill com.motovault.app` (pid empty afterwards; `am start -W` reported `LaunchState: COLD`). Also `am force-stop` + `am start` (COLD) | command output |

Screenshots and UI dumps (step 01–27) are in
`/private/tmp/claude-501/-Users-andrejmacm5-personal-MotoWise/3a73a610-56a1-4888-a069-a30e28120226/scratchpad/shots/`.

Side effect: the run sent anonymous onboarding events to production PostHog from one device with `$device_model = sdk_gphone64_arm64`, app 3.28.0, Android 15, 2026-11-12 14:18–14:30 UTC. It did not sign in, so there is no person profile. Filter that model out of the next reads.

Flow observed on 3.28.0: Welcome → experience (Step 2 of 9) → bike-setup (3) → reveal (4) → goals (5) → account "Save your setup." (6).

---

## (a) OB1 / RC-C — resume after process death: **REPRODUCED** (screen-level resume works; in-screen state is lost)

| # | Steps | Observation | Evidence |
|---|---|---|---|
| a1 | Welcome → "Just getting started" → bike-setup → tap HONDA → type "Africa" into "Search HONDA models…" → Home → `am kill` → launch | COLD launch lands on **bike-setup (Step 3)**, but on the empty make picker ("Let's find your bike."). **The make (HONDA) and the model query ("Africa") are both lost** | shots 05_typed, 06_relaunch_bike |
| a2 | Get to account (Step 6), with HONDA Africa Twin saved and 2 goals picked → Home → `am kill` → launch | COLD launch lands on **account (Step 6)**. Resume to the screen itself works | shots 20_account, 21_cold_from_account |
| a3 | Same as a2, then press the **on-screen Back** chevron on the resumed account screen | Goals (Step 5) shows **"0 of 5 picked"**: the two picks are gone from the UI, although the store persists `ridingGoals` | shot 27_inapp_back |
| a4 | Same as a2, then press **Android Back** on the resumed account screen | **The app closes** to the launcher. After the resume `router.replace`, the resumed screen is the root of the stack | shot 22_back_from_resumed_account |
| a5 | A cold relaunch after a back-walk in which the rider had reached account, walked back to experience and moved forward to bike-setup | Resumes at **bike-setup (Step 3)**, not account (Step 6). Going forward again overwrites `lastCompletedScreen` with an earlier screen, so the furthest point reached is lost | shot 16_cold_after_backwalk |
| a6 | Email code step | **Not attempted.** Sending a code needs a real address and creates an auth user in production. Blocked by the task rules | — |

Code that matches:
- `app/(onboarding)/goals.tsx:77`: `const [selected, setSelected] = useState<Set<RidingGoal>>(new Set());` never seeds from the store. Any remount of goals (resume, `replace`, back via `getPreviousRoute`) shows 0 picks. The picks only survive a back-pop when the screen was still mounted (step b1 below shows "2 of 5 picked").
- Bike-setup keeps the make and the model query in component state, so they do not survive process death (a1). When the bike was already committed with "Add to my garage", it does show again after a remount (shot 14_bike_again shows "HONDA Africa Twin · 2023").
- The resume target is the screen after `lastCompletedScreen` (`config/onboarding.ts:577-583`), which a5 confirms.

**Revised confidence for RC-C:** mechanism confirmed on device, **85%** (was a replay/SQL inference). New sub-finding: the **goals screen** also loses its in-screen state on any remount (a3). T13 lists only the account/code and bike drafts.

## (b) OB1 / RC-B — Android Back walk: **REPRODUCED**, and it gives the trigger for RC-D

| # | Steps | Observation | Evidence |
|---|---|---|---|
| b1 | From account (Step 6), in a session where bike-setup was the stack root after a resume: Back ×6, 2.5 s apart | 6 → 5 (goals, "2 of 5 picked", kept) → 4 (reveal) → 3 (bike-setup, HONDA kept) → **4th Back: app closes** (launcher) | shots 11_back1…6 |
| b2 | In an un-resumed stack (Welcome → experience → bike-setup): Back ×3 | Step 2 (experience) → **Welcome "Let's get started"** → app closes. One screen per press, down to Welcome. That is the "reset" a rider sees | shots 15_back1…3 |
| b3 | Right after b1 or b2 (process still alive, pid 4666): launch from the launcher | `LaunchState: WARM` (the activity is recreated, the JS runtime survives). Shows **Welcome, with no resume**, although the store holds progress (bike + goals + `lastCompletedScreen`). Seen twice | shots 12_warm_after_back, 23_warm |
| b4 | From that Welcome, tap "Let's get started" | Experience → bike-setup with HONDA Africa Twin still selected. The data is kept; only the position is lost | shots 13_restart_tap, 14_bike_again |
| b5 | `force-stop` or `am kill` → launch (COLD) | Resumes properly (bike-setup or account) | shots 16, 21, 26 |

What this means:
- RC-B is as the plan describes it (`app/(onboarding)/_layout.tsx` has no BackHandler): one pop per press, down to Welcome. Back on the root screen finishes the activity.
- **RC-D trigger found:** Back out of the app (from Welcome, or from a resumed root step), then reopen while the process is still cached. That gives a warm activity in the same JS runtime. `resumeHandledThisLaunch` (`app/(onboarding)/index.tsx:23-29`, read at `:49`) is already `true`, so Welcome does not resume. This is exactly "Welcome shows again in a live runtime with progress" (FS-OB1d). It is cheap to repeat on an emulator.
- T19's plan ("only Welcome returns `false` so the OS backgrounds the app") will **still produce RC-D on the next warm launch**, unless T20 lands in the same build. T20 replaces the module flag, and it covers this case only when the warm activity's Welcome mount carries no `from:'back'` param. It does not: the new activity mounts Welcome fresh.

**Revised confidence:** RC-B mechanism **90%** (was a replay inference). RC-D cause: **25% → 80%**. The trigger is "Back exits the activity, then a warm relaunch". There may be other triggers, such as OS activity recreation, but this one is enough.

## (c) OB1 / RC-A — sign-in dead end for an unfinished account: **BLOCKED**

- It needs a confirmed account with `onboardingCompleted=false`. There are two ways to get one: sign up through the app, which needs an inbox to receive the code and creates a production user, or an admin-API insert, which is a production Supabase write. Both are outside the task rules. The available test account (`test@test.com`) has finished onboarding, so it cannot show the dead end, and signing in also writes session and device rows. Not attempted.
- Static check only: `app/(onboarding)/sign-in.tsx` (214 lines) has no `useEffect` on the session. Its only navigation is `goToGetStarted` → `router.replace(OB_ROUTE.EXPERIENCE)` (`:82-85`) and `router.back()` (`:124`). Meanwhile `app/_layout.tsx:459` keeps `(onboarding)` mounted for `isSignedIn && !onboardingCompleted`. That matches the plan's T11 "Why". Confidence unchanged at **85%** (code + SQL; no device evidence).
- To unblock: the T11 runner `scripts/run-onboarding-signin-e2e.sh` against **local Supabase** (`pnpm db:start`) with a dev-client build pointed at it, or an owner-approved synthetic user.

## (d) PO4 — "ride too short" at a standstill: **BLOCKED**

- It needs a signed-in, onboarded account. Starting and ending a ride creates ride rows in production, which is a write the rules forbid. Not attempted.
- Static check only: floors `MIN_RIDE_ELAPSED_S = 30`, `MIN_RIDE_DISTANCE_M = 50` (`utils/ride-constants.ts:25-26`); guard "End Anyway" → `executeEndRide` (`app/(modals)/ride-hud.tsx:201, 257, 423`). Consistent with T09. Confidence unchanged.
- To unblock: the same local-Supabase dev-client setup, with `adb emu geo fix` fixed at one point.

---

## Effect on plan confidence

**Confirms**
- **T19 / FS-OB1b (RC-B):** reproduced on the store binary 3.28.0. One screen per Back press down to Welcome, and Back on the root finishes the activity (b1, b2). Raise the confidence in T19's "Why" to about 90%. The FS-OB1b step-(1) script works as written on a Pixel 7 API 35 emulator.
- **T13 / FS-OB1c (RC-C):** reproduced. A cold resume lands on the right screen (bike-setup, account), but bike-setup loses the make and the query (a1). Raise to about 85%. `onboarding-bike-resume.yaml` will fail on `origin/main` as intended: pick a make, then `stopApp`, then `launchApp`, and the make chip is gone.
- **T11 / FS-OB1a**, **T09 / FS-PO4b:** the code paths match the plan (static only). Device repro is blocked, so confidence is unchanged.

**Corrects**
- **T20 / FS-OB1d (RC-D):** the trigger is **no longer unknown**. Back out of the onboarding root, then a warm relaunch, gives a live JS runtime with `resumeHandledThisLaunch=true` and shows Welcome with progress (b3). Edits:
  - Cause confidence 25% → 80%.
  - Drop "No Maestro (trigger unknown)". Add Maestro `onboarding-welcome-warm-resume.yaml` (tag `android`): to bike-setup, then `pressKey: back` until the app is backgrounded, then `launchApp` (no `stopApp`, no `clearState`), then `assertNotVisible: "Let's get started"`.
  - The "Out of scope: finding the remount trigger" line is resolved.
- **T19 ↔ T20 coupling:** T19's "only Welcome returns `false` so the OS backgrounds the app" reproduces RC-D on the next warm launch, because the warm Welcome mount has no `from:'back'` param. Edits:
  - Ship **T19 and T20 in the same build**, or move T20 into Release A.
  - The T20 "What" must treat a fresh Welcome mount in a new activity as a mount to resume. "resume unless `params.from==='back'`" already does that. Its Jest test needs a case for "flag true, new mount, no param → resume".
  - Alternative: on Welcome, call `moveTaskToBack` (keeps the activity) instead of returning `false`.
- **T13 scope:** add the **goals screen**. `goals.tsx:77` initializes `selected` to an empty `Set` and never reads the persisted `ridingGoals`. Every remount shows "0 of 5 picked" with Continue disabled (a3, and after the a2 cold resume, shot 19). Edits:
  - Add "goals seeds from `ridingGoals`" to T13's What and Files.
  - Add a Jest case.
  - FS-OB1b's `goal-chip-track_rides-selected` assertion passes today only because the back-pop keeps the screen mounted. Add a replace-path assertion.
- **T13 resume target:** a back-walk followed by moving forward again overwrites `lastCompletedScreen` with an earlier screen. A rider who had reached account resumes at bike-setup (a5). Edit: record a monotonic `furthestScreen` (or `lastViewedScreen`, per T04) and resume to that, not to the last completed screen.
- **Android Back on a resumed root step** (a4): it closes the app from account or bike-setup, while the on-screen Back chevron goes one step back. T19's BackHandler via `getPreviousRoute` + `replace` fixes this. Edit: add one FS-OB1b check, "cold resume to account, Android Back → goals, not the launcher".

**Invalidates**
- Nothing in the plan is shown wrong.
- The FS-OB1b/FS-OB1c/FS-OB1a Maestro specs say "preview build", but **no EAS `preview` Android build exists** (`eas build:list`). Edit: use a universal APK from the production AAB (`bundletool build-apks --mode=universal` + debug key), or add a `preview` build step to T11/T13/T19.
- FS-OB1a and FS-PO4b also need a non-production backend so the runner can create users and rides.

**Blocked / to do**
- (c) RC-A and (d) PO4: run under the local-Supabase setup described above.
- The email-code relaunch case (FS-OB3) was not attempted, for the same reason.
