# R1: Onboarding "resets" after sign-up/sign-in (OB1, OB1-E, OB1-H, OB1-H2, OB6)

This is research only, done 2026-11-12. Nothing in the app, PostHog, Supabase or GitHub was changed.
Code was read from the clean checkout of `origin/main` at `52d281e9`
(`/Users/andrejmacm5/personal/MotoWise-research`). Code paths below are relative to `apps/mobile/src/`
unless a path says otherwise.
PostHog: project 155556 (EU). Every query is read-only and excludes the 12 test persons listed in
`queries/q00-excluded-persons.md`. Every number is a one-off derivation, not a governed metric.
Supabase: one read-only SELECT through the Management API.

## 1. Question

Session replays show riders going "back" to an early onboarding step (experience, bike setup or welcome)
after sign-up or sign-in, after leaving the app for Google sign-in or the mail app, or after "Open my garage".
The event view says 22 of 73 riders viewed an early step after auth (OB1-E). This deep dive asks:

1. Which code path or paths send riders back?
2. How often does each one happen, per platform and app version?
3. How can each one be proven fixed, both with an automated check and with a production metric that can be
   read per release?

## 2. Evidence

### 2.1 Code read (origin/main 52d281e9)

| # | Where | What it does | Relevance |
|---|---|---|---|
| C1 | `stores/onboarding.store.ts:203-233` | Zustand + MMKV persist (`version: 9`). `lastCompletedScreen`, answers and `bikeData` are persisted. `resetForSignOut()` and `reset()` wipe everything | Resume reads this |
| C2 | `app/(onboarding)/index.tsx:23-29, 47-57, 82-96` | Welcome decides the resume once per JS runtime (module flag `resumeHandledThisLaunch`). When `lastCompletedScreen` is set, it does `router.replace(target, {resumed:'1'})` and fires `onboarding_resumed {last_completed, resume_target}`. Otherwise it fires `onboarding_step_viewed welcome`. If welcome is mounted again in the same JS runtime, it **never resumes** | Explains welcome views in a live runtime |
| C3 | `config/onboarding.ts:577-583` (`getResumeRoute` = `getNextRoute`) | Resume goes to the screen **after** the last *completed* screen | In-screen progress on the target screen is lost |
| C4 | `app/(onboarding)/account.tsx` (whole file; no `setLastCompletedScreen`) | The account step never records completion. The email form and the code step are component state (`useState`, `useEmailCodeStep`) | A kill in the mail app resumes onto an **empty** account form (OB3, OB1-H) |
| C5 | `app/(onboarding)/sign-in.tsx` (grep: no `session`, `useEffect` or `useAuthStore`) | The onboarding sign-in screen (Welcome "Already have an account? Sign in", account "Already have an account?") has **no reaction to a new session**. Its comment says "the root gate routes the user onward", but the root gate keeps `(onboarding)` mounted for any signed-in account that has not finished onboarding (`app/_layout.tsx:459`), so the rider **stays on the sign-in screen**. The only way on is the "Get started" link (`goToGetStarted`, `router.replace(experience)` + a second `onboarding_started`) | Main driver of OB1-E (see Q4–Q6) |
| C6 | `hooks/use-oauth-sign-in.ts:28-38` | Google/Apple fire `user_signed_up` (new account) or `user_signed_in`. There is no navigation. A second tap opens the provider sheet again | Repeated auth events per rider |
| C7 | `app/(onboarding)/_layout.tsx:42-64`; grep `BackHandler` in `app/(onboarding)`, `components/onboarding`: none | Android hardware/gesture Back pops the onboarding stack one screen at a time down to Welcome, and never confirms or exits. iOS swipe-back is enabled on goals, bike-setup and no-bike-value | "Jumps back" in replays (Q8) |
| C8 | `app/_layout.tsx:417-419, 453-467` | Root gate: `(onboarding)` when `isAnonOnboarding \|\| (isSignedIn && !onboardingCompleted)`. `holding` waits for `me` only when **not** in onboarding and only until `SPLASH_FAILSAFE_MS` (18 s, `lib/auth-hydration.ts:41`) | — |
| C9 | `stores/auth.store.ts:78-89, 140-152` | `onboardingCompleted` is **not persisted**. `setSession(null)` sets it to false | On a cold start, completion depends on `me` |
| C10 | `lib/query-persist.ts:67-74`; `lib/persisted-query-provider.tsx` | The `['user','me']` query is persisted for 7 days and restored on a cold start | A stale `me` with `onboardingCompleted:false` can route a finished rider into onboarding (hypothesis H-E) |
| C11 | `app/(onboarding)/personalizing.tsx:366-393` | "Open my garage" → `handleContinue` → `reset()` (wipes the resume point) + `setOnboardingCompleted(true)`. A cold-start resume into personalizing completes silently | After completion the store is empty, so any route back into `(onboarding)` lands on **Welcome**, not on a resume |
| C12 | `app/_layout.tsx:579-711`, `lib/auth-state-change.ts:86-117` | Any null-session event after a user existed → `clearLocalData` → `resetForSignOut()` (`_layout.tsx:698`). With `hasAuthenticatedBefore=true` the root gate then shows `(auth)` login | OB1-H2 / OB6 "Open my garage opened a sign-in" — **not confirmed** in events (Q10) |
| C13 | `lib/onboarding-experiment.ts:144-170` | The variant is sticky and never reset in production. The layout's blank `!variant` frame cannot reappear | Rules out a variant flip as the cause |
| C14 | grep `Updates.updateId` in `lib/analytics.ts`, `hooks/use-analytics-super-properties`: none | Events carry `$app_version`/`$app_build`, **not the OTA update id** | A fix shipped by OTA cannot be told apart from the same store build that ran without it |

### 2.2 PostHog queries (each was run once on 2026-11-12, last 60 days unless noted, test persons excluded)

**Q1 – reproduce OB1-E.** For riders with `user_signed_up`/`user_signed_in`, I counted the early steps they viewed after their first auth event.
Result: 67 auth riders with onboarding events; **21 viewed experience/bike_setup/welcome after auth**; 8 of those never
completed; 3 had `onboarding_resumed` after auth; 9 viewed welcome; **16 fired `onboarding_started` again after auth**;
**12 had no `onboarding_started` before auth** (they signed in first); 1 had `auth_hydration_timeout`.
→ Most of the 21 are riders who **signed in or created an account first and only then started onboarding**. Their first
experience view comes after auth, so it is not a go-back. [SOURCE: Q1]

**Q2 – timelines of the 21** (events `onboarding_step_viewed/completed`, `onboarding_started/resumed/completed`, `user_signed_*`,
`Application Opened/Backgrounded`). Examples, with person id prefixes:
- `0cc37a50` (3.19.1): Welcome → **14× `user_signed_up google` in 17 s** (with BG between taps, which is the Google sheet) → cold start → welcome → `onboarding_started` → experience.
- `e48acf9f` (3.19.0), `cb9f1b60` (3.19.1), `b492dbb9` (3.21.0), `dc3469ef` (3.26.0), `6e9d2638` (3.26.0): 2–4 `user_signed_up google` within seconds, then "Get started" → experience.
- `ecfde4d3` (3.20.0): experience → back to Welcome → sign-in → `user_signed_up google` → `onboarding_started` again → experience (answers replayed).
- `005ef516` (3.26.0, email sign-up at account): paywall → heard_about → BG; 36 min later `V:welcome` with **no `Application Opened` and no `onboarding_resumed`** → 3× `user_signed_in google` → never completes.
- `5d3b4a8e` (3.26.0 iOS): stuck on personalizing (no `onboarding_completed`) → cold start 14 min later → welcome with **no resume** → `user_signed_in apple` ×2 → redoes the flow → stuck on personalizing again.
[SOURCE: Q2]

**Q3 – lifecycle event inventory** (60 d, RN): `Application Opened` 2,949 / 576 persons, `Application Became Active` 5,203 / 452,
`Application Backgrounded` 5,784 / 603, `Application Installed` 527 / 489, `onboarding_resumed` 110 / 84,
`auth_hydration_timeout` 18 / 9. (`from_background` does not exist in this project.) [SOURCE: Q3]

**Q4 – repeat Welcome views, classified by the last lifecycle event before them** (only riders who had already fired `onboarding_started`):

| Kind | Platform | Views | Persons | Persons after auth | Versions |
|---|---|---|---|---|---|
| cold_start (`Application Opened`) | android | 9 | 9 | 1 | 3.21.0, 3.26.0 |
| cold_start | (null, old builds) | 8 | 8 | 1 | 3.19.0, 3.19.1 |
| live_runtime (`Became Active`/`Backgrounded`) | (null) | 7 | 4 | 1 | 3.19.x |
| live_runtime | android | 6 | 6 | 1 | 3.26.0 |
| cold_start | ios | 5 | 5 | 1 | 3.26.0, 3.27.0 |
| live_runtime | ios | 1 | 1 | 0 | 3.26.0 |

[SOURCE: Q4] The per-view detail (Q5) shows that many cold-start cases are riders who quit **before completing
experience**, so Welcome is the correct screen for them. Cases with real lost progress are listed in Q6.

**Q5 – per-view detail of repeat Welcome** (36 rows). Cold-start cases whose last completed step was set:
`b65672c3` experience (3 min), `afb4862e` frequency (retired screen), `3e5d0461` notifications (**reinstall**: `Application Installed` again),
`e29f2170` notifications (cold start 41 s after entering personalizing), `5d3b4a8e` notifications (14 min), `352f7f52`, `8922f843` notifications (2–15 days),
`dbed09da` experience (resume → Back), `906b9019` notifications (35 days), `532d475d` paywall (garage_first; completed 6 min before).
[SOURCE: Q5]

**Q6 – full timelines for 6 lost-progress riders.**
- `dbed09da` and `b65672c3`: `onboarding_resumed experience→bike-setup`, then experience → welcome → experience within 4 s. This is **the rider pressing Back from the resumed screen**: the resumed stack has one screen, so `getPreviousRoute` replaces down to experience, then Welcome.
- `532d475d` (3.26.0 Android): `onboarding_completed` 17:21:03 → paywall closed 17:21:15 → **cold start 17:27:23 → welcome → experience**. The next day: `auth_hydration_timeout`. This is a completed rider routed back into onboarding (post-completion relapse, H-E).
- `e29f2170`: personalizing 10:24:21 → cold start 10:25:02 → welcome → experience. Onboarding never completed.
- `3e5d0461`: reinstall (`Application Installed` 10-01), so MMKV was wiped. Correct behaviour.
[SOURCE: Q6]

**Q7 – completers who see an onboarding step again** (after `onboarding_completed` + 5 s):
of 291 completers, **10 (3.4%)** saw an onboarding step again and 9 saw welcome/experience (3.26.0 Android 4/76, 3.26.0 iOS 1/24,
3.19.1 2/69, 3.21.0 iOS 1/5, 3.25.0 iOS 1/2, 3.19.0 1/42); 4 completed again; 11 had `onboarding_resumed` after completing
(the garage_first kill-on-paywall path, which works as designed: `resumed notifications→personalizing`). [SOURCE: Q7]
This matches the replay pack's OB6 counts (`onboarding_completed` twice for 6 of 291).

**Q8 – fast backward walks through onboarding** (`$screen` names `/(onboarding)/…`, mapped to the flow index; a "fast back" is a move to a lower index ≤ 5 s after the previous screen):

| Platform | Riders with onboarding screens | Riders with ≥3 fast back steps | …of whom completed | All completed | Riders with a fast back to Welcome |
|---|---|---|---|---|---|
| android | 187 | **25 (13%)** | **2** | 97 (52%) | 38 |
| ios | 70 | **15 (21%)** | **2** | 42 (60%) | 19 |
| unknown | 47 | 9 | 3 | 33 | 5 |

[SOURCE: Q8] A back-walk is near-terminal: 7 of 49 complete, against about 57% of everyone else.

**Q9 – replay sessions from scanner `01a1cfa9-dc29-76b9-91f0-84a19deb33b0`, matched to their events** (`$session_id` prefix):

| Session | Replay Vision said | Events show |
|---|---|---|
| `01a1cee7` (3.26.0 Android) | "after the personalization animation… spontaneously resets to the very first 'What's your experience?' screen" | `V:account 08:41:39` → `goals 08:41:49` → `reveal :52` → `bike-setup :53` → `experience :55` → `/(onboarding) :56` → BG. **Five Back presses, 1–3 s apart, from the account screen.** Personalizing was never reached (the AI misread the screen) |
| `01a1bb66` (3.26.0 Android) | "entered email, code sent, backgrounded… when foregrounded it had regressed to 'commitment'" | `email_code_sent 13:46:15` → `commitment 13:46:26` → `goals :28` → `reveal :28` → `bike-setup :29` → BG. **No BG before the regression**, so this was Back from the code step and then the account screen |
| `01a1c94f` (3.26.0 Android) | "multiple attempts with red validation errors… unexpectedly returned to experience" | Welcome → **sign-in screen** for 2.5 min (4 BG/ACTIVE = Google sheet or keyboard) → "Get started" → experience … goals → reveal → bike-setup → experience → welcome in **2 s** → experience again |
| `01a17cbb` (3.26.0 Android) | "after selecting Google, the app repeatedly loops the user back to earlier steps" | account → goals → account → BG (Google) → ACTIVE → goals → reveal → bike-setup → experience → `/(onboarding)` within 42 s → `onboarding_started` again → … → account → **sign-in** → BG. Back-walk plus sign-in |
| `01a197a4` (3.26.0 Android) | "clicked 'Open my garage' … prompted to sign in via Google or Apple" | Events end at `V:account 15:06:23` → BG. The "sign-in prompt" is the **account step** (commit_first), not a post-garage sign-in |
| `01a151de` (3.26.0 Android) | "'Open my garage'… white screen with spinner… Google Sign-in activity" | Events end at `heard_about 01:59:32` → BG. No personalizing or garage event was captured, so this is **not confirmable** |

[SOURCE: Q9, observations `01a1cfa9-ebac…`, `-ea21…`, `-e96b…`, `-e1f1…`, `-e4ae…`, `-de50…`]
Lesson: Replay Vision labels a rider's own Back presses as "the app reset". Every OB1 replay claim must be checked against `$screen` timing.

**Q10 – baseline signatures by app version** (60 d):

| Version | Starters | Resumed riders | Resumed then back to experience/welcome (approx.) | Welcome remount in live runtime | Welcome after cold start with lost progress |
|---|---|---|---|---|---|
| 3.26.0 | 166 | 32 | 3 | **7** | 5 |
| 3.19.0 | 118 | 20 | 5 | 1 | 2 |
| 3.19.1 | 100 | 14 | 0 | 3 | 2 |
| 3.21.0 | 46 | 10 | 1 | 0 | 0 |
| 3.20.0 / 3.22.x / 3.25.0 / 3.27.0 / 3.28.0 | 38 | 9 | 0 | 0 | 0 |

[SOURCE: Q10]

**Q11 – sign-in dead-end signature** (first auth per rider, 60 d):

| Version | Auth riders | ≥2 auth events within 2 min | `onboarding_started` ≤10 min after auth | …new account | …never completed | Repeated auth, never completed |
|---|---|---|---|---|---|---|
| 3.26.0 | 34 | 5 | 6 | 5 | 3 | 3 |
| 3.19.1 | 12 | 5 | 2 | 2 | 1 | 4 |
| 3.19.0 | 9 | 3 | 4 | 3 | 1 | 1 |
| 3.21.0 | 4 | 2 | 2 | 1 | 1 | 1 |
| 3.20.0 | 3 | 0 | 1 | 1 | 0 | 0 |
| 3.27.0 / 3.28.0 | 10 | 0 | 0 | 0 | 0 | 0 |
| **total** | **72** | **15** | **15** | **12** | **6** | **9** |

[SOURCE: Q11]

**Q12 – auth while on the onboarding sign-in screen, then no navigation for 10 s** (`$screen` before auth = `/(onboarding)/sign-in`):
3.26.0: 18 auths by 10 riders, **11 auths by 6 riders had no screen change within 10 s**. 3.21.0: 6 auths by 2 riders, 2 stuck.
(Older builds used other screen names and are not counted.) [SOURCE: Q12]

**Q13 – resume distribution** (`onboarding_resumed`, 60 d): experience→bike-setup **27 riders (7 completed)**, reveal→goals 13 (4),
notifications→personalizing 11 (11), paywall→account 8 (3), heard-about→notifications 6 (6), commitment→account 4 (1),
goals→account 3 (1), no-bike-value→goals 3 (0), plus legacy screens. [SOURCE: Q13]
Resumes onto **bike-setup** (27) and **account** (15) convert worst: their in-screen state (brand/model search, email/code form) is not persisted.

### 2.3 Supabase (production, read-only)

**S1:** accounts created in the last 60 days: 374. `preferences.onboardingCompleted` true: 315. Not completed: **59 (16%)**.
Accounts with **≥2 bikes created within a day of sign-up: 15** (includes the PO1 garage re-adds, so it is not specific to a second onboarding run).
Test accounts were not excluded here, so read it as an upper bound. [SOURCE: Supabase prod SELECT 2026-11-12]

## 3. Root cause

**Overall verdict: OB1 "onboarding goes back by itself" is mostly not one app-driven reset. It is four different mechanisms,
and the 22/73 headline mainly counts riders who authenticated first.** Confidence 75%.
What would raise it: the two new events in T2 (`onboarding_back`, enriched `onboarding_resumed`) on one release, plus an Android
device repro of each path below.

| Id | Mechanism | Verdict | Confidence | Size (60 d) | What would raise confidence |
|---|---|---|---|---|---|
| RC-A | **Sign-in dead end.** On `(onboarding)/sign-in`, a successful Google/Apple/email auth for an account that has not finished onboarding (new or unfinished) does nothing visible (C5). The rider taps again (repeated `user_signed_up` events), leaves, or taps "Get started", which restarts at experience with a second `onboarding_started` | **Confirmed in code and events** | 85% | 15 of 72 auth riders repeated auth within 2 min, 9 never completed (Q11); 6 of 10 sign-in-screen riders on 3.26.0 stuck ≥10 s (Q12) | A simulator repro (T1's Maestro flow fails on main) |
| RC-B | **Back-walk out of onboarding.** Android Back (button or edge gesture) and iOS swipe-back walk the stack one screen per press down to Welcome (C7). Riders who want to leave, or who swipe toward the mail app, end up several steps back. Replays call this "the app reset" (Q9) | **Confirmed in events** (screen changes 1–3 s apart); intent unknown | 70% (mechanism); 50% that it causes abandonment rather than signals it | 49 riders with ≥3 fast back steps, 7 completed (Q8) | `onboarding_back {trigger}` (T2) separates hardware, gesture and button. A 5-rider usability check |
| RC-C | **Resume loses in-screen progress.** Resume targets the screen after the last *completed* one (C3). The account step never records completion and keeps the email/code in component state (C4). Bike-setup keeps its partial search in component state. A rider killed in the mail app or the photo picker comes back to an empty form, or a step earlier than they remember, and then presses Back (Q6) | **Confirmed in code**; event evidence via the resume table | 70% | resume→bike-setup 27 riders, 7 completed; resume→account 15, 5 completed (Q13); OB3 replays 01a18023 / 01a151ef | Enriched `onboarding_resumed {away_ms, last_viewed}` (T2); Android "Don't keep activities" repro |
| RC-D | **Welcome remount in a live JS runtime.** Welcome is viewed again with no cold start and no resume (`resumeHandledThisLaunch` is already true, C2). Cause **not found**. Candidates: Back to Welcome (part of RC-B), an error-boundary retry (`(onboarding)/_layout.tsx:10`), Android activity recreation | Unexplained residue | 25% | 11 riders, 7 on 3.26.0 (Q4/Q10) | `onboarding_welcome_mounted {reason: initial|back|remount}` (T2) |
| RC-E | **Post-completion relapse.** After "Open my garage", `reset()` empties the onboarding store (C11). `onboardingCompleted` is not persisted (C9). On a cold start the gate relies on `me`. A stale persisted `me` (C10) or a failed/slow `me` (18 s cap, C8) routes a finished rider into `(onboarding)` → Welcome. They may redo onboarding, which creates a second bike and a second `onboarding_completed` | Plausible, matches `532d475d` (cold start 6 min after completion → welcome → experience) | 45% | 10 of 291 completers (3.4%) saw onboarding again; 4 completed twice (Q7) | `gate_routed {group, reason, me_source: cache|network|none}` on the first route of each cold start (T2) |
| RC-F | **Null-session reset (OB1-H2).** A null-session event after sign-up wipes the run (`resetForSignOut`, C12) and shows `(auth)` login. That would fit "Open my garage opened a sign-in" | **Not confirmed.** The two replays behind it (01a197a4, 01a151de) are the account step or have no events (Q9). `auth_hydration_timeout` touches 1 of the 21 | 20% | ≤ 2 sessions | `auth_session_lost {during_onboarding, last_step, auth_event}` (T2) |

Not causes (checked): the onboarding variant cannot flip (C13); the `(onboarding)` guard does not drop during sign-up, because `isAnonOnboarding`
becomes `isSignedIn && !onboardingCompleted` in the same render (C8); a reinstall (`3e5d0461`) is correct behaviour.

## 4. Fix options

| Option | Fixes | Pros | Cons |
|---|---|---|---|
| **A. Sign-in screen advances on session** (recommended): in `sign-in.tsx`, mirror `account.tsx:125-148`. When a session appears and `me` has settled: completed → leave it to the root gate; otherwise → `router.replace(getResumeRoute(...) ?? OB_ROUTE.EXPERIENCE)` with a one-line "Account ready, let's set up your garage" banner. Disable the OAuth buttons while a provider call is in flight | RC-A | Small; reuses the account step's tested pattern; no change to screen content, so it is the same in both paywall arms | A new account that taps "Sign in" still has to answer the questions (correct, but should be explained) |
| B. Remove the sign-in path from Welcome | RC-A | Fewer paths | Breaks returning riders; changes an onboarding screen during the A/B — rejected |
| **C. Back that leaves, not rewinds** (recommended): Android `BackHandler` on every onboarding step after `experience` calls `getPreviousRoute` (one step) and, on Welcome/experience, leaves the app (`BackHandler.exitApp()` default). Add **progress-preserving Back**: going back never clears answers (already true) and forward again skips re-asking. Log `onboarding_back {from, to, trigger}` | RC-B | Matches platform expectations; measurable | Some riders do use Back to fix an answer, which still works. iOS swipe-back stays as is (platform norm) |
| C2. Confirm dialog "Leave setup? Your answers are saved" after 2 quick Backs | RC-B | Stops accidental multi-back | Adds a dialog to onboarding during the A/B; owner decision |
| **D. Persist in-screen state** (recommended): account step writes `lastCompletedScreen`-like `accountDraft {email, codeSentAt, mode}` to the onboarding store (never the password) and reopens the code step on resume if `codeSentAt` < code TTL; bike-setup persists `{makeId, model query, year}` draft | RC-C, OB3 | Riders returning from the mail app land on the code entry | Store version bump with migration (v10); privacy: email stays on device, cleared by `reset()`/`resetForSignOut()` |
| **E. Persist completion locally** (recommended): persist `onboardingCompleted` per user id (e.g. `completedForUserId`) in the auth store; the gate treats a matching local flag as complete and lets `me` only *confirm*; never route a session whose local flag is set into `(onboarding)`. Also skip a stale cached `me` for the completion decision (require `dataUpdatedAt` after the session started, or a network answer) | RC-E | Removes the cold-start relapse | Needs care for a server-side "un-complete" (none exist today) |
| F. Instrument first, fix RC-D/RC-F later (recommended) | RC-D, RC-F | Causes unknown; cheap events | No fix yet |

**Recommended:** A + C + D + E as four small PRs behind no flag (they are bug fixes, the same for both paywall arms), plus F (instrumentation) first,
plus the OTA/release marker (T0). Owner decision: the board's rule is "no change to onboarding screens while `onboarding_paywall_2026q4` runs"
[SOURCE: board/99-synthesis.md "What we decided not to do"]. These fixes change navigation and persistence, not screen content or the paywall,
and they act the same in both arms. They still need a yes, and their release date goes in the ledger so the A/B readout can be cut before and after.

## 5. Friction specs

Each spec says how to reproduce it, the expected behaviour, the automated check and the production metric. Every metric is broken down by
`properties.$app_version`, `properties.$app_build` and, after T0 ships, `properties.ota_update_id`.
Common HogQL filter (abbreviated `{EXCL}` below): `person_id NOT IN (<12 test ids from queries/q00-excluded-persons.md>) AND properties.$lib = 'posthog-react-native'`.

### FS-R1-A: The sign-in screen does not advance after auth (RC-A)

1. **Repro:** iOS simulator or Android emulator, preview build, fresh install (`clearState` + `clearKeychain`). Test account type: a **new** email
   (or a confirmed account whose `preferences.onboardingCompleted` is false, created by the runner's admin API). Welcome → "Already have an account? Sign in"
   → sign in with email + password → observe.
2. **Expected after fix:** within 5 s of the session the app leaves the sign-in screen. For an unfinished account it goes to the resume target
   (Welcome-started progress) or `experience` with the "account ready" banner. An already-onboarded account goes to Home. While a provider call is in flight, the OAuth buttons are disabled.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/onboarding-signin-unfinished-account.yaml` (runner `scripts/run-onboarding-signin-e2e.sh`
   creates a confirmed, not-onboarded user and deletes it on exit, same as `run-onboarding-e2e.sh`):
   `clearState`, `clearKeychain`, `launchApp` → wait "Let's get started" → tap "Already have an account? Sign in" → consent `runFlow when` (as in `_shared/onboarding-to-account.yaml`)
   → tap "Continue with email" → type email/password (custom-keyboard gotcha: use `inputText` on the focused field, `hideKeyboard` before tapping submit)
   → submit → `extendedWaitUntil: visible: ".*How long have you.*" timeout: 8000` → `assertNotVisible: id: "onboarding-sign-in-screen"` (add `testID` in T1).
   Second case in the same flow: a confirmed **onboarded** user → `extendedWaitUntil` a Home tab label (as in `smoke.yaml`).
   OAuth cannot run in Maestro (Google/Apple sheets). Cover it with a jest test `src/app/(onboarding)/__tests__/sign-in-session-advance.test.tsx`:
   render with a mocked `useAuthStore` session + `me` (`onboardingCompleted:false`) → expect `router.replace` with the resume route. With `onboardingCompleted:true` → no replace.
   Also `useOAuthSignIn` double-tap guard: a second `onGoogle()` while the first is pending makes no second `signInWithGoogle` call.
4. **Production metric M-A:** riders whose auth happened on `/(onboarding)/sign-in` and who saw no `$screen` change within 10 s.
   ```sql
   SELECT toString(properties.$app_version) AS ver, toString(properties.ota_update_id) AS ota,
     uniq(person_id) AS riders_auth_on_signin,
     uniqIf(person_id, next_screen_s IS NULL OR next_screen_s > 10) AS riders_stuck
   FROM ( /* Q12 inner query: last $screen before the auth event and the first $screen after it */ )
   GROUP BY ver, ota
   ```
   Full SQL = Q12 above, plus `ota_update_id`. **Baseline:** 3.26.0 = 6 of 10 riders stuck (11/18 auths) [SOURCE: Q12]. **Target:** 0 stuck on the fixed
   build (allow 1 for a genuine network failure). Secondary: riders with ≥2 auth events within 2 min (Q11), baseline 15/72 (60 d), target ≤ 2 per 60 d.

### FS-R1-B: A back-walk rewinds onboarding instead of leaving (RC-B)

1. **Repro:** Android emulator with gesture navigation, preview build, fresh install, anonymous. Go to the account step (`_shared/onboarding-to-account.yaml`),
   then press system Back 5 times.
2. **Expected after fix:** each Back goes exactly one step back (no paywall re-present), answers stay filled, and Back on `experience`/Welcome
   **leaves the app** (no extra rewind). Back on the email code step returns to the email form (existing behaviour, kept).
   Re-entering the app (warm) shows the same screen.
3. **Automated:** Maestro `flows/onboarding-back-preserves.yaml` (Android only; tag `android`): `runFlow: _shared/onboarding-to-account.yaml` →
   `pressKey: back` → `assertVisible` the goals title with the chosen goal still selected (`assertVisible: id: "goal-chip-track_rides-selected"`, testID added in T3)
   → `pressKey: back` ×2 → `assertVisible` bike-setup with the chosen bike → tap Continue ×2 → `assertVisible` the account screen (forward works without re-answering)
   → `pressKey: back` until experience → `pressKey: back` → `assertNotVisible: ".*How long have you.*"` (app left) → `launchApp` (no `clearState`)
   → `assertVisible: ".*How long have you.*|.*bike.*"` (resumed, not Welcome).
   jest: `src/config/__tests__/onboarding.test.ts` add cases for `getPreviousRoute` on each variant with and without a bike (it exists; extend it).
4. **Production metric M-B:** share of riders with ≥3 fast back steps (≤5 s apart) through `/(onboarding)/…`, and their completion rate.
   SQL = Q8, grouped by `ver`/`ota` instead of platform, plus the new `onboarding_back` event once T2 ships:
   `SELECT ver, uniqIf(person_id, event='onboarding_back' AND properties.trigger='hardware') ... `.
   **Baseline:** Android 25/187 (13%) with ≥3 fast backs, 2 of them completed; iOS 15/70 (21%), 2 completed [SOURCE: Q8].
   **Target:** riders with ≥3 fast backs ≤ 5% on Android (a back-walk now leaves the app after at most 1–2 steps), and **no harm**: onboarding completion
   of starters on the fixed build ≥ the trailing 8-week rate (harm rule P06.3).

### FS-R1-C: Resume loses the email/code and the bike search (RC-C, OB3, OB1-H)

1. **Repro:** Android emulator, Developer options → "Don't keep activities" ON (forces activity teardown when the app leaves the foreground), preview build, fresh install.
   (a) Account step → "Continue with email" → enter a new address + password → code sent → press Home → open any app → return via recents.
   (b) Kill the app (`adb shell am kill com.motovault.app` while backgrounded) on the code step, then relaunch.
   (c) Bike-setup: pick a brand, type a model query → kill → relaunch.
2. **Expected after fix:** (a)/(b) the app reopens **on the code entry** for the same address, the resend countdown is correct, and entering the code continues to heard-about/paywall.
   (c) It reopens on bike-setup with the brand still selected. A resume never lands on a screen *before* the one the rider left.
3. **Automated:** Maestro `flows/onboarding-email-code-resume.yaml`. The part-1 runner (`run-onboarding-email-code-e2e.sh`) is extended:
   part 1 = `onboarding-email-code-signup.yaml` up to the code step → `stopApp` → part 2 = new flow: `launchApp` (no `clearState`) →
   `assertVisible` the code-step title and the email address → `inputText ${CODE}` → `extendedWaitUntil` heard-about or the paywall (paywall closed with `optional: true`,
   RevenueCat not present in test runs) → finish to Home.
   Bike case: `flows/onboarding-bike-resume.yaml` → `_shared` up to bike-setup → select a make (as in `add-bike.yaml`) → `stopApp` → `launchApp` → `assertVisible` the make chip.
   jest: `src/stores/__tests__/onboarding.store.test.ts` – migrate v9→v10 keeps fields and adds an empty `accountDraft`; `reset()` and `resetForSignOut()` clear it;
   `partialize` never contains a password.
4. **Production metric M-C:** completion after a resume, by resume target.
   ```sql
   SELECT toString(properties.$app_version) AS ver, toString(properties.ota_update_id) AS ota,
     toString(properties.resume_target) AS target,
     uniq(person_id) AS resumed,
     uniqIf(person_id, person_id IN (SELECT person_id FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'onboarding_completed')) AS completed
   FROM events
   WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'onboarding_resumed' AND {EXCL}
   GROUP BY ver, ota, target
   ```
   **Baseline:** bike-setup 7/27 (26%), account 5/15 (33%) [SOURCE: Q13]. **Target:** each ≥ 50% on the fixed build (read as counts; ~5 resumes/week,
   so judge after ≥ 15 resumes per target). Plus `onboarding_resumed.restored_draft = true` share ≥ 90% when `last_viewed = account` (new prop, T2).

### FS-R1-D: Welcome shows again in a live runtime (RC-D)

1. **Repro:** not reproduced. Candidates: Back to Welcome; the `(onboarding)` error boundary `retry`; Android activity recreation ("Don't keep activities").
2. **Expected after fix:** a Welcome mount in a live runtime after the rider had progress either resumes to the last screen (when `reason = remount`)
   or is a deliberate Back (`reason = back`). Never a silent Welcome with progress in the store.
3. **Automated:** jest `src/app/(onboarding)/__tests__/welcome-resume.test.tsx`: with `resumeHandledThisLaunch` already true **and** a store with `lastCompletedScreen`
   and no Back navigation param → expect a resume `router.replace`. The flag must be replaced by "resume unless this mount came from Back"
   (pass `params.from = 'back'` from `getPreviousRoute` callers). Maestro is not possible here, because the trigger is unknown; the Android "Don't keep activities" case
   is covered by FS-R1-C's flow.
4. **Production metric M-D:** Q4's `live_runtime` class per version: welcome `onboarding_step_viewed` after `onboarding_started`, whose last lifecycle event is
   `Application Became Active`/`Backgrounded`, minus the new `onboarding_back {to:'welcome'}` within 5 s. **Baseline:** 11 riders / 60 d, 7 on 3.26.0 [SOURCE: Q4, Q10]. **Target:** 0 unexplained (`reason` ≠ back) on the fixed build.

### FS-R1-E: A finished rider is routed back into onboarding (RC-E, OB6 loops)

1. **Repro:** iOS simulator, preview build. Complete onboarding (`onboarding.yaml`). Kill the app within 2 s of tapping "Open my garage" (the persisted `me` may still say not completed).
   Turn on airplane mode → relaunch. Or, in a dev build, seed the persisted query cache with `me.preferences.onboardingCompleted=false` and relaunch offline.
2. **Expected after fix:** relaunch lands on Home (or the offline banner on Home), never on Welcome/experience, for an account that completed onboarding on this device.
   "Open my garage" never shows personalizing again.
3. **Automated:** Maestro `flows/onboarding-complete-relaunch.yaml`: `runFlow: onboarding.yaml` (ends on Home) → `stopApp` → `setAirplaneMode: enabled` (Android; on iOS
   the runner toggles the network with `xcrun simctl status_bar`, which is not possible, so iOS runs online) → `launchApp` → `assertVisible` the Home tab
   → `assertNotVisible: "Let's get started"` → `setAirplaneMode: disabled`.
   jest: `src/app/__tests__/navigation-gate.test.tsx` – gate input {session, local `completedForUserId` = session user, `me` = cached `onboardingCompleted:false`} → `(tabs)`.
   {session, no local flag, `me` network `true`} → `(tabs)`. {session, no local flag, `me` error} → `(onboarding)` (unchanged).
4. **Production metric M-E:** completers who view any onboarding step (not paywall) after `onboarding_completed` + 5 s, and riders with `onboarding_completed` ≥ 2.
   SQL = Q7 grouped by `ver`/`ota`. **Baseline:** 10/291 (3.4%), 4 completed twice [SOURCE: Q7]. **Target:** 0 on the fixed build. Cross-check in Supabase:
   accounts with ≥2 bikes created by `complete_onboarding` (needs a `source` column, or use `motorcycles.created_at` within 2 min of each other).

### FS-R1-F: A session drops mid-onboarding and the run is wiped (RC-F, OB1-H2)

1. **Repro:** Android emulator, sign up at the account step, then revoke the session server-side (admin API: delete the user's refresh tokens, `auth.admin.signOut(userId)`)
   → background for 65 min or force a refresh → foreground.
2. **Expected after fix:** today, the login screen shows and the onboarding answers are gone. After the fix (only if the event shows it matters): the login screen says
   "Sign in to continue setting up", and after sign-in the rider resumes at the saved step (the store is kept for the **same** user id; it is wiped only for a different user).
3. **Automated:** jest `src/lib/__tests__/auth-state-change.test.ts`: add a decision output `shouldKeepOnboardingFor: prevUserId`, and in the listener test,
   a null session followed by SIGNED_IN for the same id keeps `lastCompletedScreen`; a different id wipes it. Maestro is not possible, because a server revocation cannot be scripted inside Maestro;
   the runner script could do it, so mark this as a candidate.
4. **Production metric M-F:** new event `auth_session_lost {during_onboarding, last_step, cause}` (T2). **Baseline:** unknown (not instrumented); proxy:
   riders with `onboarding_step_viewed` followed by a `$screen` `/(auth)/login` before `onboarding_completed` (run once T2 ships). **Target:** decide after 4 weeks of data;
   the fix ships only if ≥ 2 riders/month hit it.

## 6. Tasks (chronological)

**T0 – Release marker for every fix (S).**
- Why: fixes may ship by OTA, and `$app_version` does not change with an OTA (C14). Per-release before/after needs the update id.
- What: in `hooks/use-analytics-super-properties` register `ota_update_id: Updates.updateId ?? 'embedded'`, `ota_channel: Updates.channel` and
  `runtime_version`. Add a constant `ONBOARDING_NAV_FIXES = '2026-12-r1'` super property, `onboarding_fix_level`, bumped by each R1 PR, so a single property says
  which fixes a device runs. After each release, create a PostHog **annotation** "R1 onboarding fixes level N live (build/OTA id)". That is a PostHog write: owner-approved.
- Files: `hooks/use-analytics-super-properties.ts`, `lib/analytics.ts` (constant), `docs/research/activation-365/experiments.md` (ledger line).
- Acceptance: every RN event from the new build carries `ota_update_id` and `onboarding_fix_level`; jest test on the super-property hook.
- Verify: `SELECT properties.ota_update_id, properties.onboarding_fix_level, count() FROM events WHERE timestamp > now() - INTERVAL 1 DAY AND properties.$lib='posthog-react-native' GROUP BY 1,2`.
- Depends: none. Owner: approve the annotation write per release.

**T1 – The sign-in screen advances on session; OAuth double-tap guard (S). Fixes RC-A.**
- Why: Q11 (15/72 repeated auth, 9 never completed), Q12 (6/10 stuck on 3.26.0), C5.
- What: in `app/(onboarding)/sign-in.tsx`, a session effect like `account.tsx:125-148` (wait for `me`; if not onboarded → `router.replace(resumeOrExperience)`, show the
  "account ready" banner with i18n keys in all locales). In `hooks/use-oauth-sign-in.ts`, a module-level in-flight guard. Pass `surface` (`onboarding_sign_in` / `account` / `login`)
  on `user_signed_up/in`. Add `testID="onboarding-sign-in-screen"`. Light and dark theme tokens for the banner.
- Files: `app/(onboarding)/sign-in.tsx`, `hooks/use-oauth-sign-in.ts`, `src/i18n/locales/*.json`, new jest test, new Maestro flow + runner script.
- Acceptance: FS-R1-A automated checks pass; on main the Maestro flow fails at the `extendedWaitUntil` (proves the repro).
- Verify: M-A on the fixed build/OTA = 0 stuck after ≥ 5 sign-in-screen auths.
- Depends: T0, T2 (for `surface`). Owner: confirm this counts as a bug fix allowed during `onboarding_paywall_2026q4`.

**T2 – Onboarding navigation instrumentation (S). Prerequisite for the RC-B/C/D/E/F metrics.**
- Why: RC-B, RC-D, RC-E and RC-F cannot be separated with today's events (§2, Q4, Q9).
- What: `onboarding_back {from, to, trigger: hardware|gesture|button, ms_on_screen}`; enrich `onboarding_resumed` with `last_viewed`, `away_ms`
  (persist `lastViewedScreen` + `lastViewedAt` on every step mount), `cold_start: true`, `restored_draft`; `onboarding_welcome_mounted {reason: initial|back|remount, had_progress}`;
  `gate_routed {group, onboarding_completed_source: local|me_cache|me_network|none, me_age_s}` once per cold start; `auth_session_lost {during_onboarding, last_step}` in the null-session branch.
  Add them to `AnalyticsEvent` and the event schema package (`packages/analytics`).
- Files: `lib/analytics.ts`, `lib/onboarding-analytics.ts`, `hooks/use-onboarding-flow.ts`, `app/(onboarding)/index.tsx`, `app/_layout.tsx`, `packages/analytics`.
- Acceptance: jest tests assert each event fires with its properties; a manual run shows them in PostHog Live events (consented test device).
- Verify: `SELECT event, count() FROM events WHERE event IN ('onboarding_back','onboarding_welcome_mounted','gate_routed','auth_session_lost') AND timestamp > now() - INTERVAL 7 DAY GROUP BY event`.
- Depends: T0. Owner: none (new events, no PII; `auth_session_lost` carries no ids).

**T3 – Back that leaves, not rewinds (M). Fixes RC-B.**
- Why: Q8 (49 riders back-walked; 7 completed), Q9 replays.
- What: Android `BackHandler` in `hooks/use-onboarding-flow.ts` for all onboarding step screens: one step back via `getPreviousRoute` (`replace`, params `from:'back'`).
  On experience/Welcome → `BackHandler.exitApp()` (or `return false` to let the OS background the app). Debounce Back to one step per 400 ms so a held or repeated gesture cannot
  rewind several steps. Forward after Back keeps answers pre-selected (verify goals/bike). The code step keeps its own handler.
- Files: `hooks/use-onboarding-flow.ts`, `app/(onboarding)/*.tsx` (register), `src/config/__tests__/onboarding.test.ts`, new Maestro flow.
- Acceptance: FS-R1-B checks pass on Android; iOS unchanged.
- Verify: M-B ≥3-fast-back riders ≤ 5% on Android; harm check: completion of starters not below the trailing 8 weeks (P06.3 rule).
- Depends: T0, T2. Owner: decide whether the "Leave setup?" confirm (option C2) is wanted (default: no dialog).

**T4 – Persist the account draft and the bike draft; resume into them (M). Fixes RC-C / OB3.**
- Why: Q13 (bike-setup 7/27, account 5/15 complete after resume), C3, C4, replays 01a18023 / 01a151ef.
- What: onboarding store v10: `accountDraft {email, mode:'email'|'code', codeSentAt}` (never the password) and `bikeDraft {makeId, make, modelQuery, year}`.
  Account: write the draft when the code is sent; on mount with a draft whose `codeSentAt` is < 10 min old, open the code step for that address (resend available, password not needed for verifyOtp).
  Set `lastCompletedScreen`'s companion `lastViewedScreen` so a resume targets the screen the rider was **on** when that screen has a draft. Clear the drafts in `reset()`, `resetForSignOut()` and on success.
- Files: `stores/onboarding.store.ts` (+ migration), `app/(onboarding)/account.tsx`, `components/auth/email-code-step.tsx`, `hooks/use-email-code-step.ts`, `app/(onboarding)/bike-setup.tsx`,
  `config/onboarding.ts` (resume rule), tests, Maestro flows.
- Acceptance: FS-R1-C checks pass; the store test proves no password is persisted.
- Verify: M-C (completion after resume ≥ 50% for bike-setup and account) and `restored_draft` share.
- Depends: T2 (`lastViewedScreen`). Owner: OK to keep the email on the device until onboarding ends (privacy note in the store comment).

**T5 – Completion survives a cold start (S–M). Fixes RC-E / OB6 relapse.**
- Why: Q6 `532d475d`, Q7 (10/291), C9–C11.
- What: auth store persists `onboardingCompletedForUserId` (set where `setOnboardingCompleted(true)` is called, cleared on sign-out/user change). The gate's `onboardingCompleted`
  = local flag for the session's user || server `me` from the **network** (ignore a restored cache entry older than the session's sign-in for the "not completed" answer).
  Personalizing: a second `completeOnboarding` for an account already completed is a no-op server-side (check `complete_onboarding` idempotency; do not create a second bike).
- Files: `stores/auth.store.ts`, `app/_layout.tsx` (gate), `app/(onboarding)/personalizing.tsx`, API `complete_onboarding` service (idempotency check only; a migration only if needed),
  new gate test, Maestro flow.
- Acceptance: FS-R1-E checks pass.
- Verify: M-E = 0 on the fixed build; Supabase: no account with 2 bikes created within 2 min by onboarding.
- Depends: T0, T2 (`gate_routed` confirms the mechanism first; if `gate_routed` shows `me_cache` false in 0 cases after 4 weeks, re-scope). Owner: none.

**T6 – Welcome resumes on any non-Back mount (S). Fixes RC-D (residual).**
- Why: Q4/Q10 (11 riders in a live runtime), C2.
- What: replace the module flag with "resume unless `params.from === 'back'` or the store has no progress"; keep the double-fire guard per mount.
- Files: `app/(onboarding)/index.tsx`, the callers of `getPreviousRoute`, new jest test.
- Acceptance: FS-R1-D jest passes; Back to Welcome still shows Welcome.
- Verify: M-D unexplained = 0.
- Depends: T2, T3 (the `from:'back'` param). Owner: none.

**T7 – Keep the run across a same-user session drop (S, conditional). RC-F.**
- Why: C12; OB1-H2 is unconfirmed (Q9).
- What: only if `auth_session_lost {during_onboarding:true}` ≥ 2 riders/month after T2: keep the onboarding store when the next session is the same user id; login copy "Sign in to continue setting up".
- Files: `lib/auth-state-change.ts`, `app/_layout.tsx`, tests.
- Acceptance/Verify: FS-R1-F. Depends: T2 + 4 weeks of data. Owner: go/no-go after the data.

**T8 – Fix the OB1-E metric definition (S, docs only).**
- Why: the 22/73 headline counts auth-first riders (Q1: 12 had no `onboarding_started` before auth).
- What: in `experiments.md`, define "post-auth regression" = an early step viewed after auth **by a rider who had already completed that step before auth**, and report RC-A..F separately (M-A..M-F).
- Depends: none.

## 7. Risks

- **A/B interaction.** All fixes act on both `onboarding_paywall_2026q4` arms equally, but `commit_first` has more steps after account (paywall). T3/T4 change how often riders reach the paywall,
  which raises paywall views in both arms. Log the release in the ledger and cut the RevenueCat `expd7c1d56904` readout before and after.
- **Small numbers.** About 7 installs/day. M-A and M-E are near-binary (a stuck rider is a bug), M-B/M-C need 4–8 weeks. Use the P06.3 harm rule, never a lift claim.
- **Consent gap.** EEA riders who decline analytics are invisible; every metric is "of consenting riders".
- **Android `exitApp`** behaviour differs by OEM. Prefer `return false` from the handler at the root (the OS backgrounds the app) if `exitApp` kills the process and loses the resume.
- **Persisting the email** (T4) is personal data on the device; it is cleared on finish and sign-out. Do not send it to analytics.
- **Replay Vision misreads.** Q9 shows the AI calling Back presses "resets", and calling the account step "sign-in after Open my garage". Do not use AI summaries as metrics.
- **Version-null rows.** Builds before 3.21.0 lack `platform`, and old `$screen` names differ, so Q8/Q12 undercount older builds. Read the before/after on 3.26.0+ only.

## 8. Open questions

1. Owner: are navigation/persistence bug fixes in onboarding allowed while `onboarding_paywall_2026q4` runs (T1, T3–T6)? (The board's rule is about screen content.)
2. Owner: Back on experience/Welcome: leave the app silently, or show "Leave setup? Your answers are saved"?
3. RC-D: what remounts Welcome in a live runtime on 3.26.0 Android (7 riders)? T2's `onboarding_welcome_mounted.reason` should answer it in about 4 weeks.
4. RC-E: is the relapse the stale persisted `me` or a failed `me` after 18 s? `gate_routed.onboarding_completed_source` answers it.
5. OB6 "Open my garage opened a sign-in" (01a197a4, 01a151de): both replays end without events after the account/heard-about step. Is the second one a Google activity launched by
   something on personalizing? Rescan these two sessions with a prompt focused on the last 30 s (a Replay Vision scan costs credits, so it needs owner approval).
6. Does `complete_onboarding` create a second bike when run twice for the same account? Read the API service before T5 (not read in this run).
