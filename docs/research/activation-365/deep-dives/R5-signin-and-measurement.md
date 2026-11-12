# R5: sign-in, bike search and measurement (OB2, OB3, OB4, OB5 + instrumentation spec)

#365 deep dive. 2026-11-12. **Research only**: no app code, flag, PostHog, RevenueCat, GitHub or Supabase write was made.
Code read from the clean checkout of `origin/main` at `52d281e9` (`/Users/andrejmacm5/personal/MotoWise-research`); paths below are
relative to `apps/mobile/src/` unless they start with `apps/`. PostHog = project 155556 (EU), read-only `execute-sql`, test persons
excluded in every query that counts riders (list in `queries/q00-excluded-persons.md`). Supabase = production, one read-only SELECT.

## 1. Question

1. **OB2**: Why do ~10 drop-off recordings show a blank white screen or a long spinner (11 s to 7 min) on Google sign-in, and how
   many riders does it cost?
2. **OB3**: Riders leave the app to read the email code and come back to a reset flow. How often, and why?
3. **OB4**: Bike search takes 30–100 s. Where does the time go?
4. **OB5**: Riders leave the sign-up screen without trying. How many, and can we tell "didn't try" from "tried and failed"?
5. **Measurement**: what do today's events allow, which are misleading, and what is the full instrumentation spec the plan needs
   *first*, including a way to read every fix **per release** (owner requirement: "a version that fixes all of these, and we can
   watch success or the trend of the statistics").

## 2. Evidence

### 2.1 Code read (origin/main 52d281e9)

| Id | What | Where |
|---|---|---|
| C1 | Google sign-in on both platforms is the **native** `@react-native-google-signin/google-signin` ^16.1.2 "original" module: `hasPlayServices()` then `GoogleSignin.signIn()`, then `supabase.auth.signInWithIdToken`. Not a browser flow. Apple is native `expo-apple-authentication`. | `lib/oauth.ts:121-182`; `apps/mobile/package.json:44` |
| C2 | The free "original" module on Android is built on the **deprecated legacy Google Sign-In SDK** ("The underlying SDK is deprecated but remains functional"; Google "may remove it from Play Services at their discretion"). The replacement, Credential Manager ("Universal sign in"), is the library's paid tier. | [SOURCE: Context7 `/react-native-google-signin/docs` original.mdx + install.mdx, fetched 2026-11-12] |
| C3 | One tap = haptic → provider → exactly one `user_signed_up`/`user_signed_in {auth_method}`. **No event on tap, on cancel or on error**; errors go to `presentOAuthError`. | `hooks/use-oauth-sign-in.ts:28-38` |
| C4 | A **cancel** (Android back on the Google sheet) throws `'Google sign-in was cancelled'`, classified `expected`, and is still shown as an alert: `showError(userFriendlyError(err))`. `userFriendlyError` has no mapping for it, so the rider sees **"Error — Something went wrong. Please try again."** | `lib/oauth.ts:169-171`, `lib/oauth.ts:56-67`, `lib/oauth-error-alert.ts:19`, `lib/graphql-errors.ts:42,72-83` |
| C5 | A second tap while a Google sheet is open is silently swallowed (`inProgress` → no-op). | `lib/oauth.ts:153-163`, `lib/oauth-error-alert.ts:15` |
| C6 | Account screen sets `busy` **only for the email path**. During OAuth (sheet open, then the `signInWithIdToken` network call) the screen shows no progress. Once a session exists, a full-screen `AuthBusyOverlay` "Creating your account…" covers the screen until `meQuery` settles. | `app/(onboarding)/account.tsx:85,152-207,344`, `components/auth/auth-field.tsx:138-160` |
| C7 | The overlay waits on `meQuery.isLoading && !meQuery.isError`. The default query client retries 3× with 2/4/8 s back-off, each request up to 30 s, `networkMode: 'offlineFirst'` (a paused query stays `isLoading`). **The wait has no upper bound on the account screen**: worst case ≈ 4×30 s + 14 s ≈ 134 s online, unbounded offline. The root gate has its own deadline (`SPLASH_FAILSAFE_MS`) but it applies only outside `(onboarding)` (`!inOnboarding`). | `app/(onboarding)/account.tsx:110,125-148`, `lib/query-client.ts:176-181`, `lib/graphql-client.ts` (`GQL_TIMEOUT_MS.DEFAULT 30_000`), `app/_layout.tsx` NavigationGate `holding` |
| C8 | Email code step is **component state only** ("the password stays in memory … never persisted. A relaunch reaches the code step again by signing up or in again"). A process death while the rider is in the mail app loses the code step; resume goes to `account` (via `lastCompletedScreen = goals|commitment`) with an empty email form. | `hooks/use-email-code-step.ts:4-13,54`; `app/(onboarding)/index.tsx:47-57,82-96`; `config/onboarding.ts` `getResumeRoute` |
| C9 | `account` never writes `lastCompletedScreen`; resume is decided once per JS runtime at Welcome mount (`resumeHandledThisLaunch`). `onboarding_resumed` carries only `{last_completed, resume_target}`: not the screen the rider was really on, not time away, not whether a code step or OAuth was pending. | `app/(onboarding)/index.tsx:29,47-57,85-88` |
| C10 | Bike setup: make grid shows 8 popular makes + a make-only search (max 8 results). Its placeholder says *"Start typing your bike — e.g. 'Yamaha MT-07'"*, but the search matches **makes only**; "Yamaha MT-07" returns the make, and the rider must type the model again in a second search. | `components/onboarding/bike-setup/make-grid.tsx:31-61`; `i18n/locales/en.json:750` |
| C11 | Model picker: with no query it shows **the first 6 models alphabetically** (`models.slice(0, 6)`), not the popular ones; search is substring on the NHTSA name; no match → "Use '<typed>'". Models are fetched per `(makeId, year)`; year defaults to `currentYear − 3` and the year stepper sits *below* the model picker, so a rider whose bike year differs searches the wrong year's catalog first. | `model-picker.tsx:35-54`; `bike-setup.tsx:96-98,231-237,520-535` |
| C12 | Model list comes live from NHTSA vPIC (`GetModelsForMakeIdYear`, US catalog) through the API, cached **in memory** per API instance for 7 days, 10 s per-attempt timeout + 1 retry. A cold cache (deploy/restart) means the first rider per make×year waits for NHTSA. | `apps/api/src/modules/motorcycles/nhtsa.service.ts:118-135,387-425` |
| C13 | "Make only" `bike_added {capture_level:'make'}` fires both for the quick-chip path **and** for "picked a make, pressed Continue without a model". | `bike-setup.tsx:280-311` |
| C14 | The onboarding account screen fired **no** OAuth sign-up event until PR #309 (merged 2026-10-15, shipped by OTA). | `git show 0d0cd9da` (plan text: "the onboarding account screen, where most new riders create their account, reports nothing") |
| C15 | Server-side sign-up count exists: `signup_completed {auth_method, emitted_by:'server_sweep'}`, distinct_id = user id, timestamp = `public.users.created_at`. Consent-declined riders go to one anonymous bucket. | `apps/api/src/modules/analytics/signup-events.service.ts:18,183-201` |
| C16 | Super properties registered on events: `isPro, isTrialing, bikeCount, measurementSystem, ridingGoals, platform`. **No OTA update id / JS release id.** | `hooks/use-analytics-super-properties.ts:60-79` |
| C17 | The account step is the **single auth gate**; a Supabase session is required to finish onboarding. It sits in both paywall arms (`garage_first`: goals → account; `commit_first`: commitment → account → paywall). | `app/(onboarding)/account.tsx:41-48`; `config/onboarding.ts` `GARAGE_FIRST_FLOW` / `COMMIT_FIRST_FLOW` |
| C18 | Maestro: shared sub-flow reaches the account step; email-code E2E is two flows because the code exists only after sign-up; RevenueCat paywall is closed with `optional: true`; flows need a preview/standalone build (`clearState`). | `apps/mobile/.maestro/README.md`, `flows/_shared/onboarding-to-account.yaml`, `flows/onboarding-email-code-verify.yaml` |

### 2.2 PostHog queries (all read-only `execute-sql`, 2026-11-12)

Exclusion list = the 12 test person ids from the task. "Since 10-15" = `timestamp >= '2026-10-15'` (first day #309's OAuth event could exist).

**Q1 — auth event inventory, 60 d, mobile** (`$lib='posthog-react-native'`, by event × method × platform)
Result (persons): `user_signed_up` google android 10, google ios 4, google `?` 8 (34 events!), apple ios 8, email android 9, email `?` 6;
`user_signed_in` small (≤11 per cell); `email_code_sent` signup android 11, `?` 6, ios 2, resend android 1; `email_code_verified` android 9, `?` 6, ios 1;
`email_code_failed` 1; `email_code_recovered` **0 (never seen)**; `auth_hydration_timeout` 11 persons; `onboarding_resumed` 83 persons.
`sign_in_oauth_clicked` / `sign_in_error`: **0 on mobile**.

**Q2/Q3 — where do `sign_in_oauth_clicked` / `sign_in_error` come from?** (365 d)
`sign_in_oauth_clicked` google 32 / apple 6, `sign_in_error` 64 events / 30 persons, `sign_in_submitted` 82 — **all `$lib = web`**, `$app_version` null.
→ The replay doc's "`sign_in_oauth_clicked` only on old builds" is wrong: **the mobile app never sent it**; it is the web sign-in page.

**Q5 — server sign-ups by method, 60 d** (`signup_completed`): google **247** persons, apple **60**, email **33** (72% / 18% / 10%).

**Q6 — server sign-ups vs client auth events, 60 d** (per person; joined on person_id)

| method | platform | sign-ups | client `user_signed_up` | no client auth event |
|---|---|---|---|---|
| google | android | 104 | 10 | 93 |
| google | (null) | 127 | 8 | 117 |
| google | ios | 14 | 4 | 10 |
| apple | ios | 22 | 7 | 14 |
| email | android | 11 | 10 | 0 |

**Q7 — same by first app version**: google 3.26.0 → 12/103 with a client event; 3.27.0 → 2/2; 3.28.0 → 2/2; apple 3.26.0 5/17, 3.27.0 5/5; email 100% on every version.
→ Client OAuth sign-up events were missing before #309 (C14); they now arrive. **Use `signup_completed` for sign-up counts.**

**Q8 — timing of successful sign-ups since 10-15** (account viewed → server `created_at` → next step viewed)

| method/platform | n | account→sign-up p50 / p90 | sign-up→next step p50 / p90 / max | >10 s after sign-up |
|---|---|---|---|---|
| google android | 78 | 10 s / 18 s | 2 s / 3.3 s / 66 s | 3 |
| apple ios | 17 | 13 s / 21 s | 2 s / 23.6 s / (1 outlier 27 h) | 2 |
| google ios | 10 | 17 s / 67 s | 2 s / 15.9 s / 141 s | 1 |
| email android | 9 | 26 s / 47 s | 47 s / 99 s (includes reading the code) | 9 |

→ **When OAuth succeeds it is fast**; the post-session spinner (C6/C7) exceeds 10 s for 6 of 105 OAuth riders (≈6%).

**Q9 — account-step outcomes since 10-15** (riders who viewed `account`)

| platform | viewed account | server sign-up | left without any account | of those: after `email_code_sent` | p50 last event after account view (left) |
|---|---|---|---|---|---|
| android | 124 | 103 (83%) | **20 (16.1%)** | 2 | 18 s |
| ios | 40 | 34 (85%) | 3 (7.5%) + 3 reached later steps with no sign-up row | 0 | 37 s |
| (null) | 5 | 1 | 4 | 0 | 18.5 s |

**Q10 — app backgrounded while on the account step, since 10-15**
android google sign-ups **80/81** backgrounded before their sign-up; android email sign-ups 2/11; ios apple 0/18; ios google 0/10; android no-sign-up **20/20**; ios no-sign-up 6/6.
→ On **Android, the Google sheet backgrounds the app** (`Application Backgrounded`); on iOS it does not. On Android, "backgrounded on account" is a proxy for "opened the Google sheet *or* left the app"; it cannot tell them apart.

**Q11 — time away during that backgrounding, since 10-15**
android google success: 81 came back, away p50 **5 s**, p90 12 s. **android no-sign-up: 20 backgrounded, only 5 ever came back** (away 2, 2, 3, 340, 81 580 s).
ios no-sign-up: 4 of 6 came back after 1–13 s.
→ 15 Android riders went to the background on the sign-up screen and never returned to the app.

**Q12 — device manufacturer / OS version on onboarding events**: null for every rider (not sent on custom events). Can't segment OB2 by device.

**Q13 — email code journeys, 60 d** (19 riders sent a code): 16 verified (84%), sent→verified p50 ≈ 35 s (11–260 s); every verifier but 2 backgrounded while waiting (mail app).
3 never verified: 1 Android backgrounded 4× and left; 1 Android moved on to other steps; **1 iOS relaunched twice (`onboarding_resumed`) after the send, then left** = the OB3 pattern. 2 verifiers also relaunched once and still made it (re-entered email; Supabase rate-limit path re-opened the step, C8).

**Q14 — bike_setup outcome and time since 10-15** (first view → completed/skipped)

| platform | outcome | n | p50 | p75 | p90 | ≥30 s | viewed bike_setup 2+ times |
|---|---|---|---|---|---|---|---|
| android | make only | 63 | 42 s | 70 s | 238 s | 45 | 24 |
| android | model from catalog | 33 | 41 s | 79 s | 380 s | 24 | 7 |
| android | custom make + model | 10 | 105 s | 120 s | 130 s | 10 | 2 |
| android | skipped | 15 | 53 s | 127 s | — | 10 | 8 |
| android | dropped on bike_setup | 11 | — | — | — | — | 2 |
| ios | model | 19 | 55 s | 82 s | 117 s | 13 | 4 |
| ios | make only | 16 | 44 s | 76 s | 133 s | 11 | 8 |
| ios | dropped | 2 | | | | | |

**Q15 — onboarding `bike_added` capture level by week (2026-08-31 → 11-09)**: make-only has been **60–75% every week** (e.g. 08-31: 13 model / 38 make; 11-02 android 16/18). Not a new break, a constant: two thirds of onboarding bikes have no model.

**Q16 — dwell per step (time to the next `step_viewed`), since 10-15**: bike_setup **p50 44 s / p90 146 s Android, 37 s / 109 s iOS** — the slowest step by 3×; next are account (12 s / 67 s Android; 15 s / 38 s iOS) and goals (13 s). bike_setup was *viewed* 193 times by Android riders vs 148 views of experience (re-entries).

**Q17 — platform of the replay sessions cited in the friction register**
All 10 OB2 sessions with data are **Android 3.26.0 (build 93)** (01a15602, 01a157e2, 01a14063, 01a142bd, 01a17396, 01a1ac55, 01a1cebb, 01a1ac74, 01a151de; 01a1a2d5 platform null, 3.26.0). OB3 sessions 01a18023, 01a1bb66, 01a151ef: Android.
OB5 sessions: 01a14563, 01a1ce49 reached `account`; **01a19e72, 01a19c1e, 01a1ba3f never reached `account`** (last steps bike_setup / no_bike_value) — they belong to OB4, not OB5.

**Q18 — versions on onboarding events, last 14 d**: Android **3.26.0 build 93** = 86 riders, 3.28.0 builds 96–99 ≈ 5 (internal/beta); iOS 3.26.0 b106 13, 3.27.0 b108 11, 3.28.0 b109–111 9.
→ Android production is still binary 3.26.0; every fix since then reached it by **OTA**, which `$app_version`/`$app_build` cannot see (C16).

### 2.3 Supabase (production, read-only)

**S1 — sign-ups since 2026-10-15 by auth provider** (`public.users` ⨝ `auth.users.raw_app_meta_data->>'provider'`, synthetic/test excluded, aggregated):

| provider | sign-ups | bike on day 0 | bike with a model on day 0 | onboarding completed |
|---|---|---|---|---|
| google | 119 | 87 | 50 | **95 (80%)** |
| apple | 26 | 23 | 18 | 25 (96%) |
| email | 22 | 18 | 11 | 19 (86%) |

Google sign-ups that never complete onboarding: 24/119. Q8 shows all Google Android sign-ups *reach* the next step, so that loss is after the account step (OB1 reset / OB6 / paywall — other deep dives). The DB model share (79/128) is higher than PostHog's because it counts garage re-adds within day 0 (PO1).

## 3. Root cause

### OB2 — Google sign-in "blank white screen / long spinner"
**Verdict.** Two different things look the same in a replay:
1. **Abandoned Google sheet on Android (most of OB2).** Google sign-in on Android opens a separate Google Play services activity (legacy SDK, C1/C2); the app goes to the background (80/81 successes, Q10). PostHog's RN replay records only the app's own window, so the recording shows a blank/white or frozen screen for the whole time the rider is in the Google sheet. 15 Android riders went to the background on the sign-up screen and **never came back** (Q11); every OB2 recording is Android (Q17). Whether the sheet hung (legacy SDK, outdated Play services) or the rider gave up inside it cannot be told today: no tap, cancel or error event (C3).
2. **The post-session overlay "Creating your account…"** (C6/C7) waits for `me` with retries and no deadline; >10 s for ≈6% of OAuth sign-ups (Q8), up to 141 s. This is the "long spinner" variant.
Contributing: a cancel shows "Something went wrong" (C4); no progress feedback while the token is exchanged (C6); double taps are swallowed (C5).
**Size.** Android account-step loss 20/124 = 16.1% since 10-15, of which ~15 left while backgrounded (Q9/Q11); iOS 3/40.
**Confidence: 60%** that most of the Android account-step loss is riders who opened the Google sheet and never came back (abandoned or hung), 35% that a meaningful share simply left the app without tapping anything (OB5 overlap), 5% other.
**What raises it:** `auth_oauth_started` / `auth_oauth_result` (§5 spec) for 2–3 weeks (~20 Android starts/week): the share of starts with no result and no return = hung/abandoned sheet; plus a device check of the legacy sheet on a low-end Android with outdated Play services.

### OB3 — email code reset
**Verdict.** On a process death while the rider is in the mail app, the code step (component state, C8) is lost; resume lands on the account form, not the code. Rare: 1 rider lost, 2 recovered, of 19 senders in 60 d (Q13); email is 10% of sign-ups (Q5). **Confidence 80%** (code is explicit; matches 3 recordings). Raise with a `stopApp`/`launchApp` Maestro repro (§5) and the new `onboarding_resumed.pending_code_step` property.

### OB4 — bike search slow
**Verdict.** Not latency first, but **search design**: (a) the make search promises a model search ("e.g. 'Yamaha MT-07'") but only finds makes (C10); (b) the model list shows 6 alphabetical rows, not likely ones (C11); (c) the model catalog is the US NHTSA list for one year, defaulting to current−3, with the year control below the list (C11/C12), so European models and other years miss and fall to "Use '<typed>'" or to no model. Result: bike_setup is the slowest step (p50 44 s, p90 146 s Android, Q16) and **two thirds of onboarding bikes have no model** every week since September (Q15), which also starves the model-level service schedule (Experiment 2). NHTSA cold-cache latency (C12) is a possible extra, unmeasured. **Confidence 70%** for design as the main cause; 30% that fetch latency is a material part. Raise with `bike_setup_summary` (`model_fetch_ms`, query counts, picked-via) for 2 weeks.

### OB5 — leave the sign-up screen without trying
**Verdict.** Real but overstated: 3 of the 5 cited recordings never reached the account step (Q17). The remaining account-step loss is the same 20 Android / 3 iOS riders as OB2 and cannot be split into "didn't try" vs "tried" without an OAuth start event (C3). The screen is a hard gate (C17), so some loss is the price of requiring an account. **Confidence 40%** for any cause beyond "gate + no measurement". Raise with `auth_oauth_started` + `onboarding_step_viewed{account}` → share with zero auth attempts.

### Measurement
**Verdict (100%, read from code and data):** today we cannot see OAuth attempts, cancels, errors or durations (C3, Q1–Q3); client `user_signed_up` under-counts OAuth sign-ups before #309 (Q6/Q7); and **we cannot attribute any fix to a release on Android**, because fixes ship by OTA on binary 3.26.0 and no event carries the update id (C16, Q18).

## 4. Fix options

| Friction | Option | Pros | Cons |
|---|---|---|---|
| OB2 | **A. Instrument first** (`auth_oauth_started/result`) | Splits hung vs abandoned vs never-tapped; cheap (S) | No rider benefit by itself |
| OB2 | **B. Account-screen hygiene**: busy state from tap to session; cancel is silent (no alert); bounded post-session wait (advance after ≤8 s and let `me` finish in the background, as the root gate already does) | Removes the "long spinner" and the false "Something went wrong"; both-arm, no copy change | Touches an onboarding screen during the paywall A/B (owner call) |
| OB2 | C. Switch Android Google to Credential Manager (library's paid "Universal sign in") or another Credential Manager wrapper | Bottom sheet over the app (no activity switch), Google-recommended, legacy SDK can be removed by Google | Paid licence or new dependency; native rebuild (store release, not OTA); needs a device check; decide only after A shows hung sheets |
| OB2 | D. Show "Continue with email" first on Android | No dependency | Email is the slowest path (Q8: 26 s + code); likely worse |
| OB3 | **Persist the pending code step** (email + sent-at, never the password) and restore it on resume; on restore ask only for the code (verifyOtp needs no password) | Fixes the reset; tiny | Must not store the password; recovery path (`email_code_recovered`) needs the password → fall back to the form |
| OB4 | **E. One search for "make + model"**: tokenise the make query, and when the rest of the query matches models, offer "Yamaha MT-07" rows directly | Matches the placeholder's promise; fewer screens | Needs models for several makes → fetch on demand |
| OB4 | **F. Model list ranked by popularity** (our `makeStats`/fleet counts, then alphabetical) and the year control above the list | Fewer scrolls; reuses existing data | Popularity data is thin for small makes |
| OB4 | G. Persist the NHTSA catalog (DB/Redis) instead of per-instance memory | Removes cold-cache waits | Only matters if `model_fetch_ms` shows it does |
| OB4 | H. Year-agnostic model search (union of ±3 years) | Fewer misses for wrong year | More NHTSA calls; dedupe needed |
| OB5 | Measure first (A); only then consider copy | Avoids changing the gate during the A/B | Slow at ~20 Android account views/week |
| All | **Release tagging** (`ota_update_id`, `activation_release`) + PostHog annotation per release | Lets every fix be read per release, the owner's ask | Annotation is a PostHog write → owner-approved |

**Recommended:** ship in this order: (1) release tagging + instrumentation PR (T1, T2); (2) account-screen hygiene B + OB3 persistence (T3, T4) as one both-arm "R1" OTA; (3) bike search E + F (T5) as "R2"; (4) decide C (T6) from two weeks of T2 data; G/H only if `model_fetch_ms` / no-match rates justify them.

## 5. Friction specs (verifiable definitions)

Conventions for every production metric:
- Rider = `person_id`; exclude the 12 test persons (`{EXCLUDED}` below = that list); `$lib = 'posthog-react-native'`.
- Platform = `lower(coalesce(properties.platform, properties.$os))`.
- **Per-release breakdown** = `properties.activation_release` (new, T1) and `properties.$app_version, properties.$app_build, properties.ota_update_id` (new, T1). Until T1 ships, use the date of the OTA as a before/after cut (`timestamp >= '<ota date>'`) and say so.
- Volume: ~124 Android + 40 iOS account views per 4 weeks → read each metric on a **4-week window after the release**, compare with the 4 weeks before, and treat the result as a harm/mechanical check, not a lift claim (board rule).

### F-OB2a — Google sign-in hangs or is abandoned (Android)
1. **Repro.** Android emulator with a Google Play system image (API 34) and a Google account added; preview build of 3.26.0 JS; fresh install. Walk onboarding to the account step (shared sub-flow). Tap **Continue with Google**. (a) Press Back on the account picker. (b) Tap Google twice fast. (c) Turn on airplane mode after picking the account.
2. **Expected after fix.** (a) Back returns to the account screen with **no alert** and all buttons enabled; `auth_oauth_result {outcome:'cancelled'}` fires. (b) One sheet; the screen shows a busy state from the first tap until the sheet closes. (c) A friendly network message within ≤ 10 s, buttons re-enabled, `auth_oauth_result {outcome:'error', stage:'token_exchange'}`.
3. **Automated check.** Maestro `flows/onboarding-oauth-cancel.yaml` (Android only, tag `android-oauth`): `runFlow _shared/onboarding-to-account.yaml` → `tapOn: "Continue with Google"` → `extendedWaitUntil: visible: "(?i)choose an account|sign in with google"` (timeout 20 s) → `back` → `extendedWaitUntil: visible: "Continue with Google"` → `assertNotVisible: "Something went wrong.*"` → `assertNotVisible: "Creating your account…"` → `tapOn: "Continue with Google"` twice in a row (second `optional: true`) → assert the picker appears once → `back`. A *successful* Google sign-in cannot run in CI (real Google account, 2FA, Play services consent), so the success path is covered by jest: `apps/mobile/src/__tests__/hooks/use-oauth-sign-in.test.ts` — mock `signInWithGoogle` to resolve / reject with cancel / `IN_PROGRESS` / network error; assert exactly one `auth_oauth_started` and one `auth_oauth_result` with the right `outcome`, `stage`, numeric `duration_ms`, and that `presentOAuthError` is **not** called for cancel.
4. **Production metric.** OAuth completion among Android starts, and account-step loss.
```sql
-- M-OB2: Google OAuth outcome per release (needs T2)
SELECT properties.activation_release AS rel, properties.$app_version AS ver, properties.ota_update_id AS ota,
       lower(coalesce(properties.platform, properties.$os)) AS plat,
       uniqIf(person_id, event='auth_oauth_started' AND properties.provider='google') AS started,
       uniqIf(person_id, event='auth_oauth_result' AND properties.provider='google' AND properties.outcome='success') AS succeeded,
       uniqIf(person_id, event='auth_oauth_result' AND properties.provider='google' AND properties.outcome='cancelled') AS cancelled,
       uniqIf(person_id, event='auth_oauth_result' AND properties.provider='google' AND properties.outcome='error') AS errored,
       quantileIf(0.9)(toFloat(properties.duration_ms), event='auth_oauth_result' AND properties.outcome='success') AS p90_ms
FROM events
WHERE timestamp >= now() - INTERVAL 28 DAY AND properties.$lib='posthog-react-native'
  AND event IN ('auth_oauth_started','auth_oauth_result') AND person_id NOT IN ({EXCLUDED})
GROUP BY rel, ver, ota, plat ORDER BY rel, plat
```
   "Started with no result" = `started − (succeeded+cancelled+errored)` = hung or killed in the sheet.
   **Baseline:** no OAuth events exist yet. Proxy baseline (works today): Android account viewers with no `signup_completed` = **20/124 (16.1%)** since 10-15; of them 15 backgrounded and never returned (Q9, Q11).
   ```sql
   -- M-OB2-proxy: account-step loss (works today; rerun per release window)
   WITH su AS (SELECT DISTINCT person_id FROM events WHERE timestamp >= {start} - INTERVAL 1 DAY AND event='signup_completed')
   SELECT lower(coalesce(properties.platform, properties.$os)) AS plat, properties.$app_version AS ver,
          uniq(person_id) AS viewed_account,
          uniqIf(person_id, person_id IN (SELECT person_id FROM su)) AS signed_up
   FROM events WHERE timestamp >= {start} AND timestamp < {end} AND event='onboarding_step_viewed'
     AND properties.step='account' AND properties.$lib='posthog-react-native' AND person_id NOT IN ({EXCLUDED})
   GROUP BY plat, ver
   ```
   **Target:** Android account-step loss ≤ 10% (from 16.1%); "started, no result" ≤ 5% of Google starts; cancel shows no alert (0 `$exception`/alerts tied to cancel).

### F-OB2b — long "Creating your account…" spinner after the session lands
1. **Repro.** iOS simulator or Android emulator, preview build; network link conditioner "100% loss" toggled on **after** the Apple/Google sheet returns (or block the API host); sign in on the account step.
2. **Expected.** The overlay never stays more than 8 s; the flow advances to the next step (heard_about / paywall) while `me` keeps loading; if `me` later says onboarding is already complete, the root gate routes to tabs as today.
3. **Automated check.** jest `apps/mobile/src/__tests__/screens/account-post-signin-wait.test.tsx`: render `account.tsx` with a session and a `me` query that never resolves (fake timers); advance 8 s; assert `goNext` was called once and `auth_post_signin_wait {outcome:'timeout', wait_ms≥8000}` fired; second case `me` resolves with `onboardingCompleted:true` at 1 s → no `goNext`, `outcome:'already_onboarded'`. E2E is not reliable here because Maestro cannot cut the network at the exact moment after the OAuth sheet.
4. **Production metric.** Time from `signup_completed` (server `created_at`) to the next onboarding step view (works today), and `auth_post_signin_wait.wait_ms` after T2.
```sql
-- M-OB2b: seconds from server sign-up to the next onboarding step, per release
WITH s AS (SELECT person_id, min(timestamp) AS su_at, any(properties.auth_method) AS method FROM events
           WHERE timestamp >= {start} - INTERVAL 1 DAY AND event='signup_completed' GROUP BY person_id),
     c AS (SELECT person_id, any(lower(coalesce(properties.platform, properties.$os))) AS plat, any(properties.$app_version) AS ver,
                  minIf(timestamp, properties.step IN ('heard_about','paywall','notifications')) AS next_at
           FROM events WHERE timestamp >= {start} AND event='onboarding_step_viewed' AND properties.$lib='posthog-react-native'
             AND person_id NOT IN ({EXCLUDED}) GROUP BY person_id)
SELECT s.method, c.plat, c.ver, count() AS n,
       quantile(0.9)(dateDiff('second', s.su_at, c.next_at)) AS p90_s,
       countIf(dateDiff('second', s.su_at, c.next_at) > 10) AS over_10s
FROM s INNER JOIN c ON c.person_id = s.person_id WHERE c.next_at > s.su_at AND s.method IN ('google','apple')
GROUP BY s.method, c.plat, c.ver
```
   **Baseline:** OAuth sign-ups with >10 s = **6/105** (Q8: 3/78 google-android, 2/17 apple-ios, 1/10 google-ios); max 141 s. **Target:** 0 above 10 s (excluding app-backgrounded gaps) in a 4-week window.

### F-OB3 — email code lost on relaunch
1. **Repro.** iOS simulator (or Android emulator), preview build, fresh install. Onboarding → account → Continue with email → new address (Resend `delivered+…@resend.dev`) + password → code step appears. Kill the app (`xcrun simctl terminate` / swipe away). Relaunch.
2. **Expected.** The app reopens on **"Enter your code"** for the same address (no password on screen), resend countdown correct; typing the code signs in and continues onboarding. If the pending code is older than 1 h, it opens the email form with the address pre-filled.
3. **Automated check.** Maestro: extend the email-code runner with a middle flow `flows/onboarding-email-code-relaunch.yaml` (between part 1 and part 2): `stopApp` → `launchApp: {stopApp: false, clearState: false}` → `extendedWaitUntil: visible: "Enter your code", timeout: 30000` → `assertVisible: "${TEST_EMAIL}"`; then the existing `onboarding-email-code-verify.yaml` types the code and asserts `.*hear about us.*|.*Today in your garage.*`. Runner: `scripts/run-onboarding-email-code-e2e.sh` gets a `RELAUNCH=1` switch. Unit test: `apps/mobile/src/__tests__/hooks/use-email-code-step.test.ts` — opening persists `{email, sentAt}` and never the password; restore within TTL returns the step; `close()` clears it.
4. **Production metric.**
```sql
-- M-OB3: code journeys per release (works today; restored count needs T2/T4)
SELECT properties.activation_release AS rel, properties.$app_version AS ver,
       uniqIf(person_id, event='email_code_sent' AND properties.source='signup') AS sent,
       uniqIf(person_id, event='email_code_verified') AS verified,
       uniqIf(person_id, event='onboarding_resumed' AND properties.pending_code_step=1) AS relaunched_with_code,
       uniqIf(person_id, event='email_code_step_restored') AS restored
FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND properties.$lib='posthog-react-native'
  AND event IN ('email_code_sent','email_code_verified','onboarding_resumed','email_code_step_restored')
  AND person_id NOT IN ({EXCLUDED}) GROUP BY rel, ver
```
   **Baseline:** 16/19 verified (84%) in 60 d; 1 rider lost after relaunch (Q13). **Target:** `restored = relaunched_with_code` (100%) and verified ≥ 90% over a 60-day window (small n: judge mainly by the Maestro check).

### F-OB4 — bike search is slow and ends without a model
1. **Repro.** Any platform, preview build, fresh install, reach bike setup. Task: "Yamaha MT-07, 2019". Type `Yamaha MT-07` in the make search; then find MT-07 for 2019.
2. **Expected.** Typing "Yamaha MT-07" (or "mt07") offers a "Yamaha MT-07" row directly; the year is chosen before or with the model; with no query the model list shows the most-owned models first. Completion in ≤ 20 s for a rider who knows their bike.
3. **Automated check.** Maestro `flows/onboarding-bike-search.yaml`: `runFlow` the shared steps up to "Popular makes" (split the existing shared file at the bike step into `_shared/onboarding-to-bike-setup.yaml`) → `tapOn: "Start typing your bike.*"` → `inputText: "Yamaha MT-07"` → `extendedWaitUntil: visible: "(?i)MT-07", timeout: 15000` → `tapOn: "(?i)MT-07"` → set year 2019 → `assertVisible: "(?i)MT-07"` on the plate → `tapOn: "Continue"` → `assertVisible:` reveal screen with "MT-07". Second case: `inputText: "mt07"` must also find it. Custom keyboard note: use `inputText` on the focused field, not key taps (`project_maestro_authoring`). Unit tests: `apps/mobile/src/__tests__/components/make-grid-search.test.tsx` (query → model rows), `model-picker-ranking.test.tsx` (popular first, then alphabetical).
4. **Production metric.**
```sql
-- M-OB4: bike_setup dwell and model capture per release (works today)
WITH c AS (SELECT person_id, any(lower(coalesce(properties.platform, properties.$os))) AS plat,
                  any(properties.$app_version) AS ver, any(properties.activation_release) AS rel,
                  minIf(timestamp, event='onboarding_step_viewed' AND properties.step='bike_setup') AS v_at,
                  minIf(timestamp, event IN ('onboarding_step_completed','onboarding_step_skipped') AND properties.step='bike_setup') AS end_at,
                  argMinIf(properties.capture_level, timestamp, event='bike_added') AS cap
           FROM events WHERE timestamp >= {start} AND timestamp < {end} AND properties.$lib='posthog-react-native'
             AND event IN ('onboarding_step_viewed','onboarding_step_completed','onboarding_step_skipped','bike_added')
             AND person_id NOT IN ({EXCLUDED}) GROUP BY person_id HAVING v_at > toDateTime('2026-01-01'))
SELECT plat, rel, ver, count() AS viewed,
       quantileIf(0.5)(dateDiff('second', v_at, end_at), end_at > v_at) AS p50_s,
       quantileIf(0.9)(dateDiff('second', v_at, end_at), end_at > v_at) AS p90_s,
       countIf(cap='model') AS with_model, countIf(cap='make') AS make_only
FROM c GROUP BY plat, rel, ver
```
   **Baseline (since 10-15, Q14/Q16):** dwell p50 **44 s Android / 37 s iOS**, p90 146 s / 109 s; with a model 62 of 141 bikes (**44%**: Android 43/106 incl. 10 custom, iOS 19/35). **Target:** p50 ≤ 25 s, p90 ≤ 75 s; model share ≥ 60%; bike_setup drop-off (ended there) not above the baseline 13/159.

### F-OB5 — riders leave the sign-up screen without trying
1. **Repro.** Not a defect to reproduce; a behaviour to measure. Device check only: on Android fresh install, reach the account step and confirm that the three options and the reassurance line are visible without scrolling on a 5.5" screen in light and dark mode.
2. **Expected after fix.** We know the split: riders who viewed `account` with **zero** `auth_oauth_started` and no `email` submit vs riders who tried and failed.
3. **Automated check.** Covered by the jest test in F-OB2a (start event fires on every tap) plus a jest test that the email submit fires `auth_email_submitted`. Maestro screenshot assertions: `flows/onboarding-account-visible.yaml` asserts "Continue with Google", "Continue with email" and "Already have an account?" visible without scrolling (iOS adds "Continue with Apple").
4. **Production metric.**
```sql
-- M-OB5: did the rider try? (needs T2)
SELECT lower(coalesce(properties.platform, properties.$os)) AS plat, properties.activation_release AS rel,
       uniqIf(person_id, event='onboarding_step_viewed' AND properties.step='account') AS viewed,
       uniqIf(person_id, event IN ('auth_oauth_started','auth_email_submitted')) AS tried
FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND properties.$lib='posthog-react-native'
  AND event IN ('onboarding_step_viewed','auth_oauth_started','auth_email_submitted') AND person_id NOT IN ({EXCLUDED})
GROUP BY plat, rel
```
   **Baseline:** unknown split; total account-step loss 20/124 Android, 3/40 iOS (Q9). **Target:** first establish the split (2–4 weeks); no target for "didn't try" until then [UNBACKED — own choice].

### F-M — fixes cannot be read per release
1. **Repro.** Query any event from Android in November: `$app_version = 3.26.0`, build 93 for every OTA (Q18).
2. **Expected.** Every event carries `ota_update_id` (expo-updates `Updates.updateId` or `'embedded'`), `ota_channel`, and `activation_release` (a constant bumped in the PR that ships each fix bundle, e.g. `365-r1`).
3. **Automated check.** jest `apps/mobile/src/__tests__/hooks/use-analytics-super-properties.test.ts`: the registered object contains `ota_update_id`, `activation_release` (equal to the exported constant) and `platform`. Contract test `__tests__/activation-release.test.ts`: the constant matches `/^365-r\d+$/`.
4. **Production metric.** `SELECT properties.activation_release, properties.ota_update_id, uniq(person_id) FROM events WHERE timestamp >= now() - INTERVAL 7 DAY AND event='onboarding_step_viewed' GROUP BY 1,2`. **Baseline 0%** carry it. **Target ≥ 95%** of onboarding events within 7 days of the OTA.

## 6. Tasks

**T1 — Release tagging for per-release reads.** Why: Android stays on binary 3.26.0; all fixes ship by OTA and are invisible to `$app_version` (C16, Q18). What: add `ota_update_id`, `ota_channel` (expo-updates) and `activation_release` (exported constant in `config/activation.ts`) to the super properties; register `platform` before consent-dependent registration so early onboarding events stop having `platform = null` (Q1, Q9 "(null)" rows). Files: `hooks/use-analytics-super-properties.ts`, `lib/analytics.ts` (register at client init), new `config/activation.ts`, tests. Acceptance: F-M check passes; ≥95% of onboarding events carry the props within 7 d of the OTA. Verify: jest F-M; PostHog F-M query. Size S. Depends: none. Owner decision: the PostHog annotation per release (write) — yes/no; who bumps `activation_release`.

**T2 — Instrumentation PR (the spec in §6a).** Why: OB2/OB5/OB3/OB4 are not measurable today (C3, C9, C13). What: the events in §6a, rows 1–9. Files: `hooks/use-oauth-sign-in.ts`, `app/(onboarding)/account.tsx`, `app/(onboarding)/sign-in.tsx`, `app/(onboarding)/index.tsx`, `stores/onboarding.store.ts` (`lastViewedScreen`, `lastViewedAt`), `hooks/use-email-code-step.ts`, `app/(onboarding)/bike-setup.tsx`, `components/onboarding/bike-setup/{make-grid,model-picker}.tsx`, `lib/analytics.ts` (event constants + JSDoc), `docs/onboarding-ab-event-schema.md`. Acceptance: each event fires once per action in jest; property types as specified; no PII (no email, no make free-text beyond `bike_make`). Verify: jest per event; after OTA, `read-data-schema` lists each event within 48 h; queries M-OB2/M-OB5 return rows. Size M. Depends: T1. Owner decision: none (events only; no UI change).

**T3 — Account screen: busy state, silent cancel, bounded post-sign-in wait (OB2).** Why: C4–C7, Q8 (6/105 waits >10 s), Q11. What: set a `oauthBusy` state from tap to settle and show the existing overlay label only after a session exists; map `expected` cancel to no alert; on the account screen advance after `ACCOUNT_ME_WAIT_MS = 8000` even if `me` is still loading (root gate keeps routing already-onboarded accounts to tabs); fire `auth_post_signin_wait`. Files: `app/(onboarding)/account.tsx`, `lib/oauth-error-alert.ts`, `hooks/use-oauth-sign-in.ts`, tests. Acceptance: F-OB2a (cancel) and F-OB2b checks pass; light + dark screenshots of the busy state. Verify: Maestro `onboarding-oauth-cancel.yaml` (Android emulator), jest `account-post-signin-wait.test.tsx`; M-OB2b / M-OB2 per release. Size S–M. Depends: T2. **Owner decision:** it changes an onboarding screen during `onboarding_paywall_2026q4`; it is identical in both arms (bug fix, no copy/order change) — approve as a both-arm fix and log its date in the experiments ledger?

**T4 — Persist and restore the pending email code step (OB3).** Why: C8, Q13. What: persist `{email, source, sentAt}` (never the password) in MMKV on `open`; on resume or remount within 1 h, reopen the code step; verification by code only; the "already confirmed → recover" branch, which needs the password, falls back to the form with the email pre-filled; fire `email_code_step_restored`. Files: `hooks/use-email-code-step.ts`, `components/auth/email-code-step.tsx`, `app/(onboarding)/account.tsx`, `app/(onboarding)/sign-in.tsx`, `config/onboarding.ts` (resume target when a pending code exists → `account`), tests. Acceptance: F-OB3 checks pass on iOS and Android. Verify: Maestro relaunch flow + jest; M-OB3. Size S. Depends: T2. Owner decision: same as T3 (both-arm fix).

**T5 — Bike search: make+model search, popular-first model list, year first (OB4).** Why: C10–C12, Q14–Q16; also feeds Experiment 2 (model-level schedules need a model). What: (a) make search returns "Make Model" rows when the query's remaining tokens match that make's models (fetch models for the top matched make on demand); (b) rank models by our fleet counts, then alphabetically; (c) move the year stepper above the model picker; (d) `bike_setup_summary` (T2) measures it. Files: `components/onboarding/bike-setup/{make-grid,model-picker,year-stepper}.tsx`, `app/(onboarding)/bike-setup.tsx`, API: a `popular` ordering or count on `motorcycleModels` (`apps/api/src/modules/motorcycles/{motorcycles.resolver,nhtsa.service}.ts`) or reuse `makeStats`; `pnpm generate`. Acceptance: F-OB4 Maestro passes on iOS + Android; light/dark screenshots; dwell p50 ≤ 25 s and model share ≥ 60% over 4 weeks after the release (mechanical read, no lift claim). Verify: Maestro `onboarding-bike-search.yaml`; jest ranking/search tests; M-OB4 by `activation_release`. Size M. Depends: T1, T2. **Owner decision:** onboarding screen change during the paywall A/B (bike setup is before the arms diverge, identical in both); API change needs a Render deploy coupled with the OTA (memory `project_vercel_render_deploy_race`) — ship API first.

**T6 — Decide on Credential Manager for Android Google sign-in (OB2, option C).** Why: legacy SDK is deprecated and may be removed by Google (C2); OB2 recordings are all Android (Q17). What: after 2–4 weeks of T2 data, if "started, no result" ≥ 10% of Android Google starts, spike a Credential Manager implementation (library's licensed Universal sign-in, or a maintained free wrapper) behind a flag; device check on a stock Pixel and a Samsung, light/dark. Files: `lib/oauth.ts`, `app.config.*`, native rebuild. Acceptance: decision note with the T2 numbers; if built, Android Google "started → success" ≥ 90% on the new build. Verify: M-OB2 by `$app_build`. Size M (L with store release). Depends: T2 data. **Owner decision:** licence cost / dependency choice; a native store release (not OTA).

**T7 — Persist the NHTSA model catalog (OB4, option G), only if needed.** Why: C12 in-memory cache. What: Redis or DB cache keyed by make×year. Files: `apps/api/src/modules/motorcycles/nhtsa.service.ts`, `apps/api/src/modules/redis/*`. Acceptance: `model_fetch_ms` p90 ≤ 1.5 s. Verify: M-OB4 extension on `bike_setup_summary.model_fetch_ms`. Size S. Depends: T2 data showing p90 > 3 s. Owner decision: none if no migration; migration → owner-approved apply.

**T8 — Saved views and the misleading-events note.** Why: §6b; avoid repeating Q6/Q7 mistakes. What: add §6b to the experiments ledger (`docs/research/activation-365/experiments.md`, board P06.1) and, with owner approval, save the M-* queries as PostHog insights on one "#365 friction tracker" dashboard plus an annotation per `activation_release`. Files: ledger doc; PostHog (write). Acceptance: dashboard shows each M-* metric broken down by `activation_release`. Size S. Depends: T1, T2. **Owner decision:** PostHog writes.

### 6a. Instrumentation spec (merged: board 99-synthesis "Instrumentation to add first" + 05 measurement gaps + this deep dive)

All events: snake_case, constants in `lib/analytics.ts` `AnalyticsEvent`, consent-gated by `trackEvent`, plus the T1 super properties (`platform`, `ota_update_id`, `ota_channel`, `activation_release`).

| # | Event (exact name) | Properties | Fire location | Serves |
|---|---|---|---|---|
| 1 | `auth_oauth_started` | `provider: 'google'\|'apple'`, `surface: 'onboarding_account'\|'onboarding_sign_in'\|'login'\|'register'` | `hooks/use-oauth-sign-in.ts` `signIn()` before `provider()` (hook gains a `surface` arg) | OB2, OB5 (05 gap 1) |
| 2 | `auth_oauth_result` | `provider`, `surface`, `outcome: 'success'\|'cancelled'\|'in_progress'\|'no_play_services'\|'cannot_present'\|'error'` (from `classifyOAuthError`), `stage: 'sheet'\|'token_exchange'`, `duration_ms`, `sheet_ms`, `exchange_ms`, `is_new_user` (success only), `error_code` (Google status code or Supabase `code`, no message text) | same hook, `finally`; `lib/oauth.ts` returns timing marks | OB2 |
| 3 | `auth_email_submitted` | `surface`, `mode: 'signup'\|'signin'` | `app/(onboarding)/account.tsx` `handleEmail`, `sign-in.tsx` `handleEmail` | OB5 |
| 4 | `auth_post_signin_wait` | `wait_ms`, `outcome: 'advanced'\|'already_onboarded'\|'me_error'\|'timeout'`, `me_failure_count` | `account.tsx` advance effect | OB2b |
| 5 | `onboarding_resumed` (extend) | add `resumed_from_screen` (persisted `lastViewedScreen`), `away_s` (now − persisted `lastViewedAt`), `cold_start: true`, `pending_code_step: 0\|1`, `had_session: 0\|1` | `app/(onboarding)/index.tsx:85`; writes in `useOnboardingStep`/`trackOnboardingEvent(STEP_VIEWED)` | OB1-H, OB3 (05 gap 2) |
| 6 | `email_code_step_restored` | `source`, `age_s` | `hooks/use-email-code-step.ts` restore | OB3 |
| 7 | `bike_setup_summary` | `outcome: 'completed'\|'skipped'\|'back'\|'left'` (left = unmount/background ≥ 60 s), `duration_ms`, `make_queries`, `model_queries`, `make_picked_via: 'popular'\|'search'\|'intent'\|'quick_chip'\|'other'`, `model_picked_via: 'list'\|'search'\|'custom'\|'none'`, `model_list_size`, `model_fetch_ms`, `year_changed: 0\|1`, `make_changes` | `app/(onboarding)/bike-setup.tsx` (on leave), counters from `make-grid.tsx`, `model-picker.tsx` | OB4 (05 "bike search time") |
| 8 | `post_onboarding_landed` | `screen` (route template), `onboarding_variant`, `ms_since_completed`, `whats_new_shown: 0\|1` | first focus of a `(tabs)` route after `onboarding_completed` (`hooks/use-screen-tracking.ts` with a once-flag in the onboarding store) | board #1; 05 gap 4 |
| 9 | `activation_exposure` | `experiment: 'activation_365_first_session'`, `arm`, `assigned_locally: 0\|1`, `onboarding_variant` | assignment point at `onboarding_completed` (`app/(onboarding)/personalizing.tsx`), arm drawn per `lib/onboarding-experiment.ts:24-33` | board #2, Experiment 1 |
| 10 | `ride_too_short_shown` (extend) | add `max_speed_kmh`, `gps_fix: 0\|1`, `variant: 'teaching'\|'default'`, `action` incl. `'remind_me'` | `lib/ride-analytics.ts` | board #3, PO4 |
| 11 | `reminder_scheduled` / `reminder_opened` (extend), `activation_nudge_presented` | `kind:'activation'`, `source: 'plan_card'\|'guard_sheet'\|'d1_fallback'`; presented via `getPresentedNotificationsAsync` | `lib/notifications.ts`, `app/_layout.tsx:975` | board #4 |
| 12 | `notification_permission_status` | `granted`, `previous`, `platform` | app foreground (`app/_layout.tsx` AppState listener) | board #5 |
| 13 | `push_token_registered` / `push_token_registration_failed` | `platform`, `error_code` | push registration (PR #393 added failure reporting — verify which of the two already exist before adding) | board #6 |
| 14 | `service_plan_imported`; `maintenance_task_completed.source` | `tier`, `source` | `apps/api` users/maintenance import + mobile completion | board #7, Experiment 2 |
| 15 | `paywall_present_requested` (extend) | add `session_paywall_index` (nth in this app session), `minutes_since_onboarding_completed` (null if not completed) | RC paywall wrapper | PO3 (05 gap 3) |
| 16 | `screen_load_timed` | `screen: 'discover'\|'diagnosis_result'\|'home'`, `ms_to_content`, `outcome: 'content'\|'empty'\|'error'\|'abandoned'` | Discover feed, AI result screen, Home (first content render vs mount) | PO7, PO2 (05 gap 5) |
| 17 | Super properties | `platform` (from init), `ota_update_id`, `ota_channel`, `activation_release` | `hooks/use-analytics-super-properties.ts`, `lib/analytics.ts` | every per-release read (owner ask) |
| 18 | Non-event items from the board | route allow-list constant for the F14 engaged-screen list; `experiments.md` ledger; saved weekly install-cohort table | board #8–#10 | Experiment 1 |

### 6b. Existing events that mislead

| Event / property | How it misleads | Use instead |
|---|---|---|
| `sign_in_oauth_clicked`, `sign_in_error`, `sign_in_submitted` | **Web only** (`$lib=web`, Q2/Q3); never sent by the app | `auth_oauth_*` (new) |
| client `user_signed_up` (OAuth) | Missing for onboarding OAuth before #309 (12/103 google 3.26.0, Q7); duplicates on old builds (34 events / 8 persons, Q1) | server `signup_completed {auth_method}` for counts; client event only for in-session ordering |
| `$app_version` / `$app_build` | Unchanged across OTAs (Android 3.26.0 b93, Q18) | `ota_update_id` + `activation_release` (T1) |
| `platform` | Null on ~10–15% of onboarding events (Q9, Q14 "(null)" rows) | `coalesce(platform, $os)` now; T1 fix |
| `bike_added {capture_level:'make'}` | Mixes quick-chip and "picked make, no model" (C13) | `bike_setup_summary.model_picked_via` |
| `onboarding_step_viewed` counts | Re-fires on back/remount (bike_setup 193 views vs 148 experience, Q16) | count persons, use first/last per person |
| `Application Backgrounded` on the account step | On Android it means "Google sheet opened" for 80/81 sign-ups (Q10), not "left the app" | `auth_oauth_started` |
| `email_code_recovered` | Defined, never seen in 60 d (Q1) | — (fine, rare path) |
| `onboarding_resumed.last_completed` | Not the screen the rider was on; `account`/`sign_in` never write it (C9) | extended props (row 5) |
| `$device_*` on custom events | Absent (Q12): no device segmentation of OB2 | add `$device_manufacturer`/model via super properties if needed for T6 |

## 7. Risks

- **Changing onboarding screens during the paywall A/B.** T3–T5 touch `account` and `bike_setup`, which both arms share. They are identical in both arms, so they shift both arms equally, but the board decided "no change to onboarding screens" while the tests run [SOURCE: board/99-synthesis.md §"What we decided not to do"]. Needs an owner call; log dates in the ledger.
- **Bike search changes can move `bike_added` and the paywall placement** (`GOAL_TO_PLACEMENT`, intent logic) — keep `capture_level` semantics stable and add, never rename, properties.
- **Coupled API + OTA release** for T5 (Render deploy before the OTA) — memory `project_vercel_render_deploy_race`.
- **Small n**: ~20 Android account-step losses per 4 weeks. Per-release reads are mechanical checks; a "no change" read is not proof of no effect.
- **Replay blindness**: PostHog RN replay cannot show the Google sheet; future OB2 recordings will keep looking "blank". Rely on `auth_oauth_result`.
- **Persisting the code step** must never store the password (security); restore TTL must respect Supabase OTP expiry.
- **Credential Manager (T6)** is a native change → store release, review time, and a licence/dependency decision.
- Consent: everything here is "of consenting riders" (EEA opt-in); `signup_completed` counts all sign-ups, so ratios that mix it with client events slightly over-count the denominator side for EEA decliners.

## 8. Open questions

1. Does the legacy Google sheet actually hang on some devices (white loading screen), or do riders abandon it? Needs T2 data plus a device check on an Android with outdated Play services.
2. Is the Android loss tied to specific manufacturers / Android versions? Not answerable: no device properties on custom events (Q12).
3. Owner: approve T3/T4/T5 as both-arm fixes during `onboarding_paywall_2026q4`, or wait for the A/B to end?
4. Owner: PostHog writes (annotation per `activation_release`, saved insights/dashboard) — yes/no?
5. Owner: is a paid Credential Manager licence acceptable if T2 shows hung sheets?
6. What happens to the 24/119 Google sign-ups that never complete onboarding (S1)? Q8 shows they pass the account step; this belongs to the OB1/OB6/paywall deep dives — needs a cross-check there.
7. How much of bike-setup time is NHTSA fetch latency? Needs `bike_setup_summary.model_fetch_ms`.
