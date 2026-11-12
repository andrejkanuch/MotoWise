# #365 Session-replay findings: first session and onboarding friction

Research only, 2026-11-12. Nothing was changed in the app. Source: PostHog session replay (project 155556),
analysed with Replay Vision (inline scans, model gemini-3-flash-preview, ~5 credits per recording), plus PostHog
SQL to check how often each pattern happens. Replay links open the recording:
`https://eu.posthog.com/project/155556/replay/<session_id>`.

**Status of every finding:** `CONFIRMED` (seen in recordings AND counted in events), `SEEN` (in recordings only,
not yet counted), `HYPOTHESIS` (a cause we suspect, not verified in code or on a device).

## Method and coverage

| Scan | Sessions | Scanner id | Prompt (short) |
|---|---|---|---|
| A. First session **after** onboarding | 107 (riders who finished onboarding 2026-10-15 → 11-12 and whose recording continues ≥20 s after it); 86 read, 21 re-submitted | `01a1cfa6-4f63-7b8b-bd0c-9dbd6bace7a1` | first screen + modals, taps in order, ride attempt, friction, last screen |
| B. Onboarding **drop-offs** | 67 (started onboarding, did not finish, recording ≥15 s); 60 analysed, 7 too short | `01a1cfa9-dc29-76b9-91f0-84a19deb33b0` | last screen, what they did before leaving, earlier friction, crash/reset |

- Replay coverage is high: 124 of 127 onboarding completers in the last 28 days have a recording. Recordings exist only
  for riders who allowed analytics (EEA is opt-in), same caveat as the evidence pack.
- AI summaries can be wrong. Every finding below names the sessions it rests on; the ones that drive decisions are also
  counted in events (column "Events").
- Selection SQL is in the session log; scan prompts are stored on the scanners above.

## A. Onboarding (why 54% never finish)

Where drop-outs stopped (last `onboarding_step_viewed`, 67 riders, 28 days): goals 17, bike_setup 13, account (sign-up) 12,
heard_about 6, notifications 4, experience 4, paywall 3, welcome 2, personalizing 2, no_bike_value 2, commitment 2.

| # | Finding | Status | Recordings | Events |
|---|---|---|---|---|
| OB1 | **Onboarding goes back to an earlier step by itself** — after sign-in, after fetching the email code, or after Continue on reveal/goals the rider lands on "experience" or bike setup again and usually leaves | SEEN (≈17 of 60 drop-offs) | 01a17cbb, 01a18023, 01a1bb66, 01a1b9e2, 01a1618f, 01a194f6, 01a1a786, 01a1aa67, 01a1b8a2, 01a1cee7, 01a1c94f, 01a162e3, 01a17544, 01a1cc8e, 01a1af01, 01a1c789, 01a1b359 | Only 9 of 233 starts log `experience` again after a later step; but **34 of 233 (15%) relaunch mid-onboarding** (`onboarding_resumed`). Most common resume: last_completed `experience` → back to bike setup (28 riders / 60 d) |
| OB1-E | **After signing up or in, 22 of 73 riders (30%) view an early onboarding step again** (experience / bike_setup / welcome); 9 of those 22 never finish (60 d; Android 7/24, iOS 5/18, unknown 10/31) | CONFIRMED (events) | — | PostHog ad-hoc 2026-11-12: min(user_signed_up/user_signed_in) vs max(step_viewed in experience,bike_setup,welcome). Caveat: `user_signed_in` may include returning riders who restart onboarding |
| OB1-H2 | Cause candidate 2: any null-session auth event after a user existed runs `useOnboardingStore.getState().resetForSignOut()` (`apps/mobile/src/app/_layout.tsx:698`, gated by `decideAuthStateChange` `hadUser`, `lib/auth-state-change.ts`), wiping onboarding progress mid-flow if the session blips during/after sign-up | HYPOTHESIS | 01a17cbb, 01a1c94f, 01a1cee7, 01a151de, 01a197a4 | `auth_hydration_timeout` seen for 4 of 73 |
| OB1-H | Cause: the app is killed/relaunched while the rider is in Google sign-in (a separate Android activity) or in the mail app fetching the code, and resume sends them to the last *persisted* step, which can be several steps back | HYPOTHESIS | as OB1 | resume logic `apps/mobile/src/app/(onboarding)/index.tsx:84-92` (`ONBOARDING_RESUMED {last_completed, resume_target}`) |
| OB2 | **Google sign-in shows a blank white screen or long spinner** (11 s to 7 min), rider leaves or gets stuck | SEEN (≈10) | 01a15602, 01a157e2, 01a1a2d5, 01a14063, 01a142bd, 01a17396, 01a1ac55, 01a1cebb, 01a1ac74, 01a151de | Not measurable: new builds do not log the OAuth click or its outcome (`sign_in_oauth_clicked` only on old builds) |
| OB3 | **Email code: riders leave the app to read the code and come back to a reset flow** | SEEN (3) | 01a18023, 01a1bb66, 01a151ef | email: 19 riders got a code, 16 verified (60 d) |
| OB4 | **Bike search is long**: 30–100 s scrolling brand/model lists, rage clicks, re-picking the bike several times | SEEN (≈8) | 01a18d27, 01a1bd21, 01a181bb, 01a15363, 01a16373, 01a1a5ae, 01a14063, 01a1ba3f | 13 drop-outs ended on bike_setup |
| OB5 | **Riders leave on the sign-up screen without trying** | SEEN (≈5) | 01a14563, 01a1ce49, 01a19e72, 01a1ba3f, 01a19c1e | 12 drop-outs ended on account |
| OB6 | **"Open my garage" loops back** into personalizing/bike selection (up to 4 times), or personalizing shows "Retry" with all items ticked, or a 10 s black screen | SEEN (completers, ≈5 of 85) | 01a185da (4×), 01a14a5c, 01a1b7b1, 01a1b7a8 (Retry), 01a18b3f (black 10 s); drop-offs 01a14ca9 (stuck spinner), 01a151de / 01a197a4 ("Open my garage" opened a sign-in) | `onboarding_completed` twice for 6 of 291 completers; personalizing viewed 2+ times for 4 (60 d) |
| OB7 | Paywall inside onboarding: a few leave right after it appears | SEEN (3) | 01a15446, 01a1b873, 01a1715f | 3 drop-outs ended on paywall. Out of scope to change (A/B running) — record only |

## B. First session after onboarding (why finishers don't come back)

| # | Finding | Status | Recordings | Events (60 d, 291 completers unless noted) |
|---|---|---|---|---|
| PO1 | **Adding "my" bike hits the paywall.** Free tier = 1 bike (`FREE_TIER_LIMITS.MAX_BIKES = 1`, `apps/api/src/modules/motorcycles/motorcycles.service.ts:208`); the onboarding bike already uses it. Riders then try to add their real bike (often because the onboarding bike is make-only or wrong) | CONFIRMED | 01a15d55, 01a18376, 01a16947, 01a19197 | **21 riders hit `MAX_BIKES` within 1 h of onboarding** (37 requests), +6 from garage header, +5 from profile. 109/324 onboarding-bike riders add a garage bike within a day (evidence pack §1) |
| PO1-H | Same root as the day-0 service-schedule drop: since week of 2026-10-12 many onboarding bikes have no model (make-only), so no schedule imports and the rider tries to "add" the bike properly | HYPOTHESIS | — | blank-model first bikes 9–15/week from 10-12 (synthesis Appendix A); make-only capture shipped in 3.26.0 (#313) |
| PO2 | **Diagnostics is the most common first thing riders do** (≈19 of 85), and it often ends in a limit paywall, an error, or a 30 s wait | CONFIRMED | 01a1bb5b, 01a1b858, 01a1aec7, 01a1a717, 01a1a274, 01a19cbe, 01a18376, 01a1844c, 01a17f5f, 01a1584a, 01a176ac, 01a163b0, 01a16cf9, 01a1569c, 01a1546d, 01a150c1 (error), 01a14fdf, 01a14087, 01a1405c | 47 riders started a diagnosis; **11 riders got 55 `full_ai_diagnostics` paywall requests in the first hour (~5 each)**; 4 hit the monthly limit, 4 `diagnostic_failed`. Policy note: AI is not the hero feature, but riders go there first |
| PO3 | **Repeated paywalls in the first hour** (3–4 in a row in some sessions) | CONFIRMED | 01a17a64 (4×), 01a17a12, 01a19bd1, 01a14a37 (on "Log route"), 01a1a94e, 01a163b0, 01a17532, 01a1755b | 43 riders (15%) saw ≥2 paywalls, 24 (8%) ≥3; non-onboarding first-hour requests come from MAX_BIKES (PO1) and AI diagnostics (PO2) |
| PO4 | **First ride attempt fails at a standstill** ("ride too short") | CONFIRMED | 01a18bae, 01a1815d, 01a14a5c, 01a1755b, 01a14517 | 73 tried a ride, **47 saw "too short"**; matches board finding (20/31 sheets at a standstill) |
| PO5 | **Ride HUD opens right after onboarding** without the rider starting a ride | SEEN (2) | 01a18bae, 01a1815d | not counted yet (`ride_started` within seconds of `onboarding_completed`) |
| PO6 | **Taps that do nothing / empty states**: checklist rows without visible response, empty lists tapped repeatedly, bike card, grey receipt-scan card, a repeating masked dialog, rage clicks | SEEN (≈7) | 01a1b7ee (3 checklist rows), 01a1a54c, 01a1a1dd, 01a1ba3a, 01a19e50, 01a14517, 01a1a9aa | Autocapture is off, so dead taps are not in events |
| PO7 | **Slow or stuck Discover**: spinner never finishes, 15 s empty feed | SEEN (2) | 01a18688, 01a1518f | not measured (no screen-load timing event) |
| PO8 | **"Download maps" modal** when starting a route | SEEN (1) | 01a19f85 | — |
| PO9 | **Leave almost immediately** after landing on the garage (≤20 s, no taps) | SEEN (≈5) | 01a1bd8d, 01a17e2e, 01a14526, 01a172c7, 01a16947 | — |
| PO10 | What works: the "Get started" checklist leads riders to log an expense, update the odometer and create a service task | SEEN (3) | 01a1731d, 01a197ba, 01a17491 | — |
| PO11 | What's New on day 0 is rare now (2 of 85) — consistent with the board ("fixed in 3.25.0") | SEEN | 01a1755b, 01a16a02 | — |

## Measurement gaps found (add to the instrumentation list)

1. OAuth sign-in start and outcome on current builds (provider, success / cancel / error, duration) — OB2 is invisible.
2. Onboarding relaunch context: `onboarding_resumed` with the screen the rider was actually on, time away, and whether the
   process was cold-started — needed to confirm OB1-H.
3. Paywall request count per session and the gate that caused it (exists: `feature`, `limit_key`) — make a saved view.
4. First screen after onboarding (`post_onboarding_landed`) — already on the board's list.
5. Screen load time for Discover / AI analysis.

## Open questions (research to do next)

- OB1: reproduce on an Android device — start Google sign-in or switch to the mail app, let the OS reclaim memory, return.
  Does the flow resume at the right step? Read `onboarding.store.ts` persistence and the resume-target code.
- PO1: what share of the 21 MAX_BIKES riders had a make-only / blank-model onboarding bike? (DB join, read-only.)
- PO2: how many first-hour diagnostics ended in `diagnostic_limit_reached` vs the paywall gate, by build?
- Read the remaining 21 post-onboarding recordings (scan A, re-submitted) and fold them in.
- Compare the 12–19 riders who came back on day 2 with those who did not (recordings A).
