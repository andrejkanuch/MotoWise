# R3: First-hour paywalls (PO2 / PO3)

Issue #365. Research only, 2026-11-12. No app code, flag, PostHog, RevenueCat, GitHub or Supabase change was made.
I read code from the clean checkout of `origin/main` at `52d281e9` (`/Users/andrejmacm5/personal/MotoWise-research`).
PostHog project 155556 (EU). Every query below excludes the 12 test persons listed in the run brief, except where it says otherwise.
All PostHog numbers are one-off derivations, not saved metrics. The project's metric catalog is empty.

---

## 1. Question

PO3 says 15% of riders see 2+ paywalls in their first hour after onboarding. PO2 says diagnostics is the most common first action and often ends in a limit paywall, an error or a long wait. Its headline was "11 riders got 55 `full_ai_diagnostics` paywall requests in the first hour (~5 each)" [SOURCE: 05-session-replay-findings.md PO2, PO3].

This deep dive answers four questions:

1. Which gate and which surface produce the post-onboarding paywalls, and on which builds?
2. Why does one rider get several diagnostics paywalls: repeat presentations, retries or re-entry?
3. Why do some diagnoses end in errors or long waits?
4. What fix removes the repeats and keeps three things intact: the onboarding paywall, its A/B tests (`onboarding_paywall_2026q4`, RC `expd7c1d56904`) and the free tier? The fix must also not promote AI diagnostics.

## 2. Evidence

### 2.1 Code read (origin/main 52d281e9)

| # | File:line | What it does |
|---|---|---|
| C1 | `packages/types/src/constants/limits.ts:4-7` | `FREE_TIER_LIMITS.MAX_BIKES = 1` and `MAX_AI_DIAGNOSTICS_PER_MONTH = 1`. |
| C2 | `apps/api/src/modules/ai-budget/ai-budget.service.ts:62-66, 320-345, 363-373` | The server diagnostic limit is a monthly count of `content_generation_log` rows with `status='success'`. At ≥1 it throws `ForbiddenException` with an **English** upsell string: "Free plan allows 1 AI diagnostics per month. Upgrade to Pro for unlimited diagnostics." A failed generation does not use up the free diagnosis. |
| C3 | `apps/api/src/modules/diagnostics/diagnostics.resolver.ts:67-193` | `submitDiagnostic` is synchronous. It checks the limit, creates the row, builds bike context (≤4 s, `diagnostic-context.builder.ts:36`), then **awaits** the AI analysis and returns. It is throttled at 3 requests per 60 s (`apps/api/src/config/constants.ts:65`). |
| C4 | `apps/api/src/config/constants.ts:41-44` | `AI_CLIENT`: 60 s timeout and 3 retries. |
| C5 | `apps/mobile/src/lib/graphql-client.ts:30-41, 55-63` | `SubmitDiagnosticDocument` has a **300 s** client timeout (`LONG_RUNNING`), so a stalled submit can hold the spinner for up to 5 minutes. |
| C6 | `apps/mobile/src/hooks/use-pro-gate.ts:64-76` | `requirePro(feature)` presents the paywall (`surface: 'use_pro_gate'`, `source/placement: 'feature_gate'`, **no `limit_key`**) **every time it is called**. There is no cap. |
| C7 | `apps/mobile/src/hooks/use-pro-gate.ts:78-105` | `requireAccess(limitKey, count)` presents the paywall with `metadata.limit_key` **every time** a rider is over the limit. There is no cap. |
| C8 | `apps/mobile/src/components/diagnosis/use-diagnostic-quota.ts:46-82` | Quota from the server (`diagnosticQuota`) plus RevenueCat `isPro`. `requireDiagnosticAccess` is optimistic until `isKnown` (server count loaded and RevenueCat verified). |
| C9 | `apps/mobile/src/components/diagnosis/use-start-diagnosis.ts:6-13` | The "Start a diagnosis" CTA (list `index.tsx:106-110`, detail `[id].tsx:116`) calls `requireDiagnosticAccess()`. That opens the paywall with `limit_key = MAX_AI_DIAGNOSTICS_PER_MONTH` on **every tap** once the quota is used. |
| C10 | `apps/mobile/src/components/diagnosis/use-diagnostic-entry-gate.ts:22-46` | In-flow gate (`surface: 'diagnose_entry_gate'`) for the iOS quick action. It is evaluated once per mount. |
| C11 | `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx:154-232` | Submit. On `FORBIDDEN` it fires `diagnostic_limit_reached`, calls `requirePro('full_ai_diagnostics')` (paywall, no `limit_key`) and then `state.setSubmitError(message)`, where `message` is the **raw server string** (`:209-219, 228`). |
| C12 | `apps/mobile/src/components/diagnostic-flow/step-review-submit.tsx:145, 414-454` | When `submitError` is set, the error text shows and the submit button reads **"Try Again"** (`diagnoseV2.tryAgain`). It stays enabled (`submitDisabled = isSubmitting || !hasProblemInput`). **Every "Try Again" re-submits, gets FORBIDDEN again and presents the paywall again.** |
| C13 | `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx:70-79` | `diagnostic_started` fires inside `useFocusEffect` on **every focus** of the form, not once per flow. It also calls `reset()`. |
| C14 | `apps/mobile/src/components/diagnosis/quota-note.tsx:13-30` | The limit is shown only as a small centred caption under the CTA ("This month's free diagnosis is used. It's back on {date}, or go Pro for unlimited.", `en.json:213`). The CTA itself (`index.tsx:141-163`) looks the same whether or not the quota is used. |
| C15 | `apps/mobile/src/lib/subscription.ts:770-792` | `presentPaywall` only de-duplicates *concurrent* requests ("joins" a flight in progress). Once one paywall closes, the next request presents again. There is no session or time cap. |
| C16 | `apps/mobile/src/lib/subscription.ts:189-224` | The only existing cool-down: after an *onboarding* paywall dismissal, `recordOnboardingPaywallDismissed()` mutes the ride-moment teaser for 72 h (`RIDE_MILESTONE_PAYWALL.ONBOARDING_PAYWALL_COOLDOWN_H`, `limits.ts:152`). Feature gates have nothing like it. |
| C17 | `apps/mobile/src/lib/subscription.ts:776-778`, `src/lib/paywall-error-alert.ts:7-9` | A paywall `error` shows the "upgrade unavailable" alert. This was added after "98 `paywall_result: error` events from three Android users at one gate" (file header). |
| C18 | MAX_BIKES call sites: `(home)/index.tsx:363`, `(garage)/index.tsx:123`, `(garage)/index.tsx:128-130` (header), `(garage)/add-bike.tsx:141`, `hooks/use-profile-data.ts:118-128` | Five entry points. Each presents the bike paywall on every tap. None of them caps. |
| C19 | `apps/mobile/app.config.ts:59-64` | `runtimeVersion.policy: 'appVersion'` and `updates.url`. `fallbackToCacheTimeout` is not set, so it keeps the default 0. |
| C20 | Expo docs (context7 `/expo/expo`, `docs/pages/eas-update/how-it-works.mdx` and `eas/observe/reference/metrics.mdx`) | With `fallbackToCacheTimeout` 0, the default, an update that isn't downloaded at launch "will run it upon the next launch". **A fresh install's first session therefore runs the JS embedded in the store binary, not the latest OTA.** |
| C21 | git history: `apps/mobile/app.config.ts` version → `3.26.0` set in `17629203` (#311, 2026-10-13); #318 "show the free diagnosis quota up front and gate before the form" is `7f4f35e5` (2026-10-16); version → `3.27.0` in `52710558` (2026-11-04) | 3.26.0 was cut before #318. The upfront gate reached 3.26.0 riders only by OTA. |

### 2.2 PostHog queries (60 days to 2026-11-12, test persons excluded)

All queries filter `toString(person_id) NOT IN (<12 test ids>)`; I abbreviate that as `<EXCL>` below.

**Q1 — paywall requests by gate (all riders, 60 d)**

```sql
SELECT properties.surface, properties.feature, properties.limit_key, properties.source, properties.placement,
       count() AS requests, uniq(person_id) AS riders
FROM events WHERE event='paywall_present_requested' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
GROUP BY 1,2,3,4,5 ORDER BY requests DESC
```

| surface | feature | limit_key | source / placement | requests | riders |
|---|---|---|---|---|---|
| onboarding_paywall | subscription | — | onboarding / onboarding_rides | 130 | 125 |
| **use_pro_gate** | **full_ai_diagnostics** | **— (post-submit `requirePro`, C11)** | feature_gate | **115** | **12** |
| onboarding_garage_ready | subscription | — | onboarding / onboarding_rides | 60 | 60 |
| use_pro_gate | unlimited_bikes | MAX_BIKES | feature_gate | 38 | 22 |
| onboarding_paywall | subscription | — | onboarding / onboarding_default | 23 | 22 |
| profile_subscriptions_row | subscription | — | profile | 23 | 18 |
| profile_add_bike | unlimited_bikes | — | profile | 11 | 8 |
| profile_pro_banner / garage_add_bike_header | … | — | … | 8 / 8 | 7 / 7 |
| use_pro_gate | full_ai_diagnostics | MAX_AI_DIAGNOSTICS_PER_MONTH (upfront gate C9) | feature_gate | 6 | 3 |
| `diagnose_entry_gate` (C10) | — | — | — | **0** | 0 |
| others (onboarding_routes/maintenance, gpx_export) | | | | 8 | 8 |

[SOURCE: PostHog Q1]

**Q2 — per-rider anatomy of every rider with a diagnostics paywall (60 d).** For each person: post-submit paywalls (no `limit_key`), upfront-gate paywalls (with `limit_key`), entry-gate paywalls, `paywall_viewed`, paywall errors, and `diagnostic_started/submitted/completed/limit_reached/failed`.

| rider (8 chars) | version | post-submit pw | upfront pw | viewed | pw errors | started | submitted | completed | limit_reached | failed |
|---|---|---|---|---|---|---|---|---|---|---|
| 6118cf3e | 3.19.0 | **90** | 0 | 0 | **90** | 5 | 0 | 0 | 0 | 0 |
| 5eb72280 | 3.19.0 | 6 | 0 | 6 | 0 | 1 | 0 | 0 | 0 | 0 |
| f0630c4c | 3.19.1 | 5 | 0 | 5 | 0 | 3 | 0 | 2 | 0 | 0 |
| **fcb930a7** | **3.26.0** | **3** | 0 | 3 | 0 | 3 | 4 | 1 | **3** | 0 |
| **bf502a53** | **3.26.0** | **2** | 0 | 2 | 0 | 2 | 3 | 1 | **2** | 0 |
| **8c1a35dd** | **3.26.0** | **2** | 0 | 2 | 0 | 3 | 3 | 1 | **2** | 0 |
| e591d96b | 3.19.0 | 2 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 |
| 170f74cd, 9c3f0c3d, 4be8e620 | 3.19.1 | 1 each | 0 | 1 | 0 | … | 0 | ≤1 | 0 | 0 |
| 79e93ae5 | 3.19.1→3.26.0 | 1 | 0 | 1 | 0 | 5 | 7 | 3 | 1 | 3 |
| **26eb4689** | **3.26.0** | **1** | 0 | 1 | 0 | 3 | 2 | 1 | **1** | 0 |
| 07ffd495 | 3.26.0 | 0 | **2** | 2 | 0 | 1 | 1 | 1 | 0 | 0 |
| e056b0b2 | 3.26.0 | 0 | **2** | 2 | 0 | 1 | 1 | 1 | 0 | 0 |
| f525e575 | 3.28.0 | 0 | **2** | 2 | 0 | 1 | 1 | 1 | 0 | 0 |

[SOURCE: PostHog Q2]

- On 3.19.x, `diagnostic_submitted` did not exist and the paywall came before any submit. #250 (2026-10-01) made the first diagnosis free.
- 90 of the 115 post-submit requests come from one rider whose paywall failed 90 times (a `paywall_result: error` loop on 3.19.0). That is the case `paywall-error-alert.ts` was written for (C17).

**Q3 — event timeline of the four 3.26.0 limit-loop riders** (diagnostic_*, paywall_*, onboarding_completed, diagnose `$screen`s; full output in the session). The pattern is the same for all four:

1. Onboarding paywall, then `onboarding_completed`.
2. About 10 s later the rider opens the Diagnose tab (`diagnostic_list_viewed`). **Their first post-onboarding action.**
3. The first diagnosis succeeds: `diagnostic_submitted`, then `diagnostic_completed` 5–13 s later.
4. The rider returns to the list and taps "Start a diagnosis" again. **No upfront paywall fires.**
5. They fill in the form for 40–130 s.
6. They submit, get `diagnostic_limit_reached` and the paywall, and dismiss it.
7. **They tap again 3–11 s later.** `diagnostic_submitted`, `diagnostic_limit_reached` and the paywall fire again.

| Rider | Limit paywalls in a row | Time between them |
|---|---|---|
| fcb930a7 | 3 | 13:23:06 → 13:23:15 → 13:23:18 |
| bf502a53 | 2 | 6 s apart |
| 8c1a35dd | 2 | 13 s apart |

The rider then leaves to the list. [SOURCE: PostHog Q3]

- Rider 8c1a35dd shows `diagnostic_started` with `$screen_name = /(modals)/start-ride`, the form re-firing on focus (C13).

**Q4 — first-hour paywall requests by gate, onboarding completers.** Window: −15 min → +60 min around the first `onboarding_completed`. 291 completers.

```sql
WITH c AS (SELECT person_id, min(timestamp) AS t0 FROM events
           WHERE event='onboarding_completed' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL> GROUP BY person_id)
SELECT e.properties.surface, e.properties.feature, e.properties.limit_key, count(), uniq(e.person_id),
       countIf(e.properties.$app_version='3.26.0'), countIf(e.properties.$app_version IN ('3.27.0','3.28.0'))
FROM events e INNER JOIN c ON e.person_id=c.person_id
WHERE e.event='paywall_present_requested' AND e.timestamp >= now() - INTERVAL 61 DAY
  AND e.timestamp >= c.t0 - INTERVAL 15 MINUTE AND e.timestamp <= c.t0 + INTERVAL 60 MINUTE
GROUP BY 1,2,3 ORDER BY 4 DESC
```

| surface / feature / limit_key | requests | riders | on 3.26.0 | on 3.27+ |
|---|---|---|---|---|
| onboarding_paywall | 103 | 100 | 58 | 1 |
| onboarding_garage_ready | 65 | 65 | 57 | 7 |
| **use_pro_gate / full_ai_diagnostics / — (post-submit)** | **55** | **11** | 8 | 0 |
| **use_pro_gate / unlimited_bikes / MAX_BIKES** | **37** | **21** | 11 | 0 |
| profile_subscriptions_row | 9 | 7 | 2 | 0 |
| garage_add_bike_header | 7 | 6 | 1 | 0 |
| profile_add_bike | 5 | 5 | 0 | 0 |
| profile_pro_banner | 5 | 5 | 0 | 0 |
| use_pro_gate / full_ai_diagnostics / MAX_AI_DIAGNOSTICS_PER_MONTH | 4 | 2 | 2 | 2 |
| use_pro_gate / gpx_export | 1 | 1 | 0 | 0 |

This reproduces PO2's "11 riders, 55 requests". **But 47 of the 55 are on builds older than 3.26.0, and 31 of those come from one rider's error loop (Q6).** [SOURCE: PostHog Q4]

**Q5 — first-hour paywall frequency per completer, by build of first event.** Same window as Q4. `post` means surface not starting with `onboarding`.

| build | completers | ≥2 requests (any) | ≥3 (any) | ≥1 post-onboarding | ≥2 post-onboarding | post-onb. requests | ≥2 post-onb. *viewed* | diag riders / req | bike riders / req | paywall errors |
|---|---|---|---|---|---|---|---|---|---|---|
| <3.26 | 161 | 23 (14.3%) | 12 | 34 | 18 (11.2%) | 97 | 17 | 7 / 47 | 22 / 37 | 34 |
| **3.26.0** | **121** | **13 (10.7%)** | 7 | 13 | **8 (6.6%)** | 24 | 8 | 5 / 10 | 7 / 12 | **0** |
| 3.27.0–3.28.0 | 9 | 1 | 1 | 1 | 1 | 2 | 1 | 1 / 2 | 0 / 0 | 0 |

[SOURCE: PostHog Q5]

- Baseline for current builds (3.26.0): **8 of 121 completers (6.6%) see ≥2 post-onboarding paywalls in their first hour**, and 13/121 (10.7%) see ≥2 paywalls in total.
- 3.27+ has n = 9, so it can't be read yet.

**Q6 — first-hour detail per rider with a diagnostics or bike gate request** (42 riders; top rows).

- Diagnostics:
  - 6118cf3e (3.19.0): 31 requests, 31 errors.
  - 5eb72280 (3.19.0): 6 viewed.
  - f0630c4c (3.19.1): 5 viewed.
  - fcb930a7 (3.26.0): 3, from 4 submits and 3 limit hits.
  - 8c1a35dd, bf502a53, 07ffd495 (3.26.0) and f525e575 (3.28.0): 2 each.
- Bikes: 1–4 requests per rider, mostly 1–2. ff0d6e6e and 4de26acc (3.19.1) had 4 each, and 5a471095 (3.26.0) had 3.
- 17 of the 42 also logged a `garage_bike_added` in the hour (PO1 re-add pattern).

**Excluding the 3.19.0 error-loop rider, the first-hour diagnostics figure is 24 requests from 10 riders, ≈2.4 each, not ~5.** [SOURCE: PostHog Q6]

**Q7 — timelines of the upfront-gate riders on fixed code (07ffd495 on 3.26.0, f525e575 on 3.28.0).**

1. The first diagnosis succeeds.
2. The rider goes back to the list and taps "Start a diagnosis".
3. The upfront paywall appears (`limit_key = MAX_AI_DIAGNOSTICS_PER_MONTH`, `current_count = 1`) and is dismissed after 2–3 s.
4. **The rider taps the same CTA again 1.4 s (07ffd495) or 7 s (f525e575) later and gets the same paywall.**
5. The rider leaves.

The CTA looks unchanged after the dismissal (C14), so the second tap is a "did that work?" tap. [SOURCE: PostHog Q7]

**Q8 — diagnostic submit outcome and latency (60 d).** Each `diagnostic_submitted` is paired with the first outcome within 10 min.

| outcome | n | riders | p50 | p90 | max | >30 s | offline |
|---|---|---|---|---|---|---|---|
| diagnostic_completed | 27 | 23 | **6 s** | **11 s** | 16 s | 0 | 0 |
| diagnostic_limit_reached | 9 | 5 | 1 s | 1 s | 2 s | 0 | 0 |
| diagnostic_failed | 14 | 5 | 1 s | **47 s** | **141 s** | 2 | **7** |

[SOURCE: PostHog Q8]

Successful diagnoses are fast. **The long waits in PO2 are failures:** 2 of 14 took >30 s and one 141 s, under a 300 s client timeout (C5). Half of all failures were offline.

**Q9 — diagnostic events by build (60 d)**

| build | started (riders) | submitted (riders) | completed (riders) | limit_reached (riders) | failed (riders, offline) |
|---|---|---|---|---|---|
| 3.19.0 / 3.19.1 | 17 (10) | 0 | 3 (2) | 0 | 0 |
| 3.21.0 / 3.22.0 / 3.25.0 | 7 (6) | 4 (2) | 0 | 0 | 4 (2, 0) |
| **3.26.0** | **51 (32)** | **47 (23)** | **26 (22)** | **9 (5)** | **10 (3, 7 offline)** |
| 3.28.0 | 1 | 1 | 1 | 0 | 0 |

[SOURCE: PostHog Q9]

- On 3.26.0, 47 submits produced 26 completions, 9 limit hits and 10 failures, and **3 riders account for all 10 failures** (retry loop).
- `started` (51) > `submitted` (47) partly because of C13.

**Q10 — post-onboarding paywall views per app session** (`$session_id`, surfaces not starting with `onboarding`, 60 d).

| build | sessions with a gate paywall | ≥2 views | ≥3 views | views | repeat views | sessions with a same-feature repeat ≤60 s |
|---|---|---|---|---|---|---|
| <3.26 | 50 | 18 | 8 | 83 | 33 | 14 |
| **3.26.0** | **22** | **9 (41%)** | 2 | 34 | 12 | **8 (36%)** |
| 3.27+ | 2 | 1 | 0 | 3 | 1 | 1 |

[SOURCE: PostHog Q10]

**Q11 — non-onboarding paywall outcomes (60 d)**

- `use_pro_gate`: error 90 (1 rider), cancelled 67 (36), **purchased 2 (2)**.
- Profile and garage surfaces: cancelled 42; restored 1; `profile_add_bike` **purchased 1**.

[SOURCE: PostHog Q11]

**Q12 — what preceded the 3 gate purchases** (all on 3.19.1, September):

| Rider | Feature | Bought on | Context |
|---|---|---|---|
| 170f74cd | diagnostics | the **1st** view | — |
| f0630c4c | diagnostics | the **5th** view in 8 min | 4 cancels first |
| a30a2b80 | bikes | the **3rd** view, 4 h later | — |

**No gate purchase on 3.26.0 or later.** [SOURCE: PostHog Q12]

This is the harm check for any cap: repeat views have produced a sale twice in 60 days, so the cap must keep a **rider-initiated** path to the paywall.

**Q13 — cold launches before the diagnostic gate** (`Application Opened`, 60 d)

| Rider group | Riders | Launches before diagnosing | What they got |
|---|---|---|---|
| 3.26.0 limit-loop riders | 4 (fcb930a7, bf502a53, 8c1a35dd, 26eb4689) | **exactly one**, the install launch | no upfront gate |
| 3.26.0 upfront-gate rider | 1 (07ffd495) | **a second cold launch at 06:32**, 2 min before the 06:34 diagnosis | upfront gate |
| 3.28.0 upfront-gate rider | 1 (f525e575) | one launch | upfront gate (#318 is embedded in the 3.28.0 binary) |

[SOURCE: PostHog Q13; C19–C21]

### 2.3 Supabase production (read-only SELECT, aggregates only; test accounts *not* excluded here)

| id | Query | Result |
|---|---|---|
| S1 | `select status, count(*), count(distinct user_id) from content_generation_log where content_type='diagnostic' and created_at >= now()-interval '60 days' group by status` | success 35 / 29 users. There are **no `failed` rows**. |
| S2 | `select status, count(*), count(distinct user_id) from diagnostics where created_at >= now()-interval '60 days' group by status` | completed 35 / 29 users. There are **no failed or processing rows**. |
| S3 | users with ≥2 successful diagnoses in the same calendar month (60 d) | 4 of 30 |
| S4 | tier of users with a diagnostic log row (60 d) | free 25, pro 4 |

[SOURCE: Supabase prod S1–S4]

- Every client-side `diagnostic_failed` (Q8/Q9) left **no row** on the server. The failures happen before or outside `submitDiagnostic`'s write: offline (7 of 14), throttle (3/min, C3), or a transport timeout.
- The free diagnosis is never burned by a failure (C2).

## 3. Root cause

### RC-1. The "Try Again" limit loop (PO2, repeated diagnostics paywalls)

**Verdict.**
- After `FORBIDDEN`, the form presents the paywall (C11) and leaves an enabled "Try Again" button under a raw English server message (C12).
- Every tap re-submits, hits the limit again and presents the paywall again. Within seconds, 3 of 4 riders on 3.26.0 did this 2–3 times (Q3).
- The code that does this is **still on `origin/main`**. Any rider who reaches the form with a used quota (offline, RevenueCat not yet verified, or the case in RC-2) loops the same way.

**Confidence: 90%.** [SOURCE: C11, C12, Q3]

What would raise it:
- reproduce on a simulator with a test account whose monthly diagnosis is used (spec F-R3-1);
- confirm that the `FORBIDDEN` code comes from `enforceFeatureLimit`, not from the daily `checkBudget` limit. Both throw `ForbiddenException` (C2).

### RC-2. New installs run the first session on the store binary's JS, so the #318 upfront gate missed every first-session 3.26.0 rider

**Verdict.**
- The upfront gate (#318) shipped on 2026-10-16 as an OTA on top of 3.26.0, which was cut on 10-13 (C21).
- With `fallbackToCacheTimeout` 0, an OTA runs only on the *next* launch (C19, C20). A brand-new rider's first session therefore ran the old 3.26.0 JS: no upfront gate, straight into the form, then RC-1.
- Every limit-loop rider had exactly one cold launch. The 3.26.0 rider who *did* get the upfront gate had a second launch first (Q13).
- So **first-hour fixes reach first-hour riders only through a store binary, never through an OTA alone.**

**Confidence: 80%.** [SOURCE: Q13, C19–C21]

What would raise it:
- the EAS build list for the 3.26.0 store binaries (git commit of each build), to confirm no 3.26.0 binary embedded #318;
- an `ota_update_id` / `is_embedded_launch` property on events (task T1), which would make this provable per event.

### RC-3. Feature-gate paywalls have no frequency cap, and an exhausted gate looks the same as an open one (PO3)

**Verdict.**
- `requirePro`, `requireAccess` and the five MAX_BIKES entry points present on every tap (C6, C7, C9, C18).
- `presentPaywall` de-duplicates only concurrent requests (C15).
- Once the quota is used, the diagnose CTA keeps its normal look, with the limit only in a caption (C14).
- Riders therefore re-tap 1–11 s after dismissing (Q7). 36% of current-build sessions with a gate paywall contain a same-feature repeat within 60 s (Q10).

**Confidence: 85%.** [SOURCE: C6, C7, C9, C14, C15, C18, Q7, Q10]

What would raise it:
- replay review of the Q7/Q10 sessions to confirm "re-tap because nothing changed", not a deliberate second look;
- this needs the replay links only. No new Vision scan.

### RC-4. Long waits and errors are failures, mostly offline, with no deadline and no localized message

**Verdict.**
- Successful diagnoses finish in 6 s p50 / 11 s p90.
- The "30 s waits" in PO2 are the failure path: p90 47 s, max 141 s, against a 300 s client timeout (Q8, C5).
- Half of all failures were offline (Q8). The server never saw them (S1, S2).
- The error text shown is the raw `error.message` (C11). That text is English and is not written for riders.

**Confidence: 70%.**

What would raise it:
- Sentry events tagged `source: diagnose.submitDiagnostic` for the 3 non-offline failure riders, to tell throttle (429) from timeout from 5xx. I did not open Sentry in this run.

### RC-5 (historic, now guarded). The 3.19.0 paywall-error loop

- One rider produced 90 failed presentations (Q2), the source of PO2's "~5 each" average.
- On 3.26.0+, first-hour paywall errors are 0 (Q5).
- C17's alert exists, but nothing caps repeated errors.

Kept as a regression guard in F-R3-3. **Confidence that it is not a current problem: 85%** (3.26.0 shows 0 errors over 121 completers).

### Corrected headline numbers (for the plan)

- First-hour diagnostics paywalls on current builds: **10 requests from 5 riders on 3.26.0, plus 2 from 1 rider on 3.28.0**, not "55 from 11". The 55 is dominated by pre-3.26 builds (Q4, Q6).
- ≥2 post-onboarding paywalls in the first hour, current build: **8/121 = 6.6%**. ≥2 paywalls of any kind: **13/121 = 10.7%** (Q5).

## 4. Fix options

| Option | What | Pros | Cons |
|---|---|---|---|
| A. Fix only the submit loop (RC-1) | After `FORBIDDEN`: show a localized limit state in the form instead of "Try Again" plus the raw text, no automatic re-present, a "See Pro" button the rider taps | S; removes the worst repeat; no policy change | Leaves the upfront and bike repeats (RC-3) |
| B. Hard cap: at most one feature-gate paywall per session | Drop every gate paywall after the first in a session | Simplest rule; kills every repeat | Hides the paywall from a rider who wants to buy. Q12 shows 2 of 3 gate purchases came on a repeat view. **Rejected** |
| **C. Soft cap: automatic presentation once per feature per session, then an app-owned "limit sheet" with a rider-tapped "See Pro"** | Non-onboarding gate calls (`requirePro`, `requireAccess`, garage header, profile add-bike) consult a session ledger. The 1st call per feature presents RevenueCat as today. Later calls open a light/dark `LimitSheet`: what's limited, when it resets (diagnostics) or how to swap the bike (bikes), and a secondary "See Pro plans" that presents the paywall as `trigger: 'rider_tap'`. A global cap of 2 automatic gate paywalls per session, plus a cooldown after any paywall error (no auto re-present for 10 min) | Removes the "re-tap → same modal" loop; keeps a purchase path; a clear, testable rule; onboarding surfaces exempt by `isOnboardingPaywallSurface` | M; a new sheet in 7+ locales; must not touch onboarding or the RC experiment |
| D. Exhausted-state CTA (limit messaging) | When the diagnosis quota is used, the CTA reads e.g. "Free diagnosis used · back on {date}" in a muted style; tapping opens the limit sheet (C). Same for the "Add bike" buttons at the bike limit ("1 bike on Free") | Riders know before they tap; no AI promotion (it *lowers* the CTA's weight) | S; copy in all locales |
| E. Error and timeout handling (RC-4) | Client deadline for `submitDiagnostic` (e.g. 75 s, above the 6–16 s success range and the 60 s server AI timeout); offline pre-check before submit; map errors to localized messages (offline / busy-throttled / timeout / server); "Try again" only for retryable classes; after 10 s show "Still working…" | Turns 47–141 s waits into a clear message; no free quota lost (server counts successes only) | Needs care that a timed-out client does not double-submit while the server still finishes (server then logs success and uses the quota). Mitigation: disable re-submit until the quota refetch says still 0 |
| F. Release rule (RC-2) | First-session fixes ship in a store binary; record OTA id on events | Makes first-hour metrics readable per release | Process, not code |

**Recommended: A + C + D + E + F, plus the instrumentation in T1 first.**

- Onboarding paywalls (`onboarding_paywall`, `onboarding_garage_ready`) are untouched and exempt from the cap.
- `onboarding_paywall_2026q4` and `expd7c1d56904` keep running.
- Nothing becomes paywalled that is free today.
- The diagnose CTA gets *less* prominent when the quota is used, so AI diagnostics is not promoted.

## 5. Friction specs

Common setup for the E2E specs:
- A **preview/standalone build** (README "Build target") on an iOS simulator, or an Android emulator where noted.
- A free test user created by `scripts/run-onboarding-e2e.sh` (the `E2E_FLOW` pattern), with the default onboarding Honda in the garage.
- RevenueCat may be unavailable in test runs (memory `feedback_no_revenuecat_in_tests`). The first automatic presentation can therefore end either in the native paywall or in the "upgrade unavailable" alert (C17). Flows dismiss both with `optional: true`, and **assert only app-owned UI**: the limit sheet, the exhausted CTA and the form state.

Seeding a used diagnosis without calling the AI:
- the runner inserts one `content_generation_log` row (`content_type='diagnostic'`, `status='success'`, `created_at=now()`) for the test user through the admin API it already uses to create and delete the user;
- the row goes away when the user is deleted.

[UNBACKED — own design; the runner's admin access is confirmed in README "onboarding.yaml" section]

Production metrics:
- Every HogQL below adds `AND <EXCL>`.
- Each one breaks down by `properties.$app_version`, plus `properties.ota_update_id` once T1 ships. `$app_version` alone cannot separate OTAs (RC-2).
- The reference point for "before" is 3.26.0 (cut 2026-10-13). Read 3.27.0/3.28.0 as they accrue.

### F-R3-1 — Diagnostics limit "Try Again" loop

1. **Repro.**
   - iOS simulator, preview build of `origin/main`, free test user with the seeded used diagnosis.
   - To bypass the upfront gate (RC-2/RC-3), reach the form before the quota loads. Simplest: turn on airplane mode, open Diagnose and tap Start (the gate is optimistic offline, C8), fill steps 1–4, then turn the network back on.
   - Tap Analyze → paywall or alert → dismiss → the button reads "Try Again" under "Free plan allows 1 AI diagnostics per month…" → tap → paywall again.
2. **Expected after fix.**
   - After `FORBIDDEN`, the form shows a localized limit panel ("This month's free diagnosis is used. It's back on {date}.") with buttons "See Pro plans" (rider tap) and "Done".
   - There is no "Try Again".
   - At most **one** paywall presentation per form instance. Tapping Analyze again is impossible (the button is replaced).
3. **Automated check.**
   - Maestro `apps/mobile/.maestro/flows/diagnose-limit-loop.yaml`, runner `test:e2e:diagnose-limit` (seeds the row). Steps:
     1. `runFlow: onboarding.yaml`.
     2. `setAirplaneMode: enabled` (Android emulator; on iOS use a mock-network launch arg, see the open question).
     3. Tap "Diagnose" tab → "Start a diagnosis".
     4. Walk the 4 steps by testID.
     5. Airplane off → tap "Analyze".
     6. Optional dismiss of paywall or alert.
     7. `assertVisible: ".*free diagnosis is used.*"` and `assertNotVisible: "Try Again"`.
     8. `assertVisible: "See Pro plans"`.
   - Plus a Jest test `apps/mobile/src/app/(tabs)/(diagnose)/__tests__/new-limit.test.tsx`: mock `gqlFetcher` to reject with `FORBIDDEN`; assert `presentPaywall` is called once, `submitError` is not the raw message, and a second `handleSubmit` is a no-op.
4. **Production metric.**
   - Definition: share of `diagnostic_limit_reached` riders with ≥2 `diagnostic_limit_reached` in one `$session_id`.
   - **Baseline 3.26.0: 3 of 5 riders (fcb930a7 3×, bf502a53 2×, 8c1a35dd 2×), 9 limit events from 5 riders** [SOURCE: Q2, Q9].
   - **Target: 0 riders with ≥2 per session on the fixed build.**

   ```sql
   SELECT properties.$app_version AS ver, uniq(person_id) AS limit_riders,
          uniqIf(person_id, n >= 2) AS looping_riders, sum(n) AS limit_events
   FROM (SELECT person_id, properties.$app_version, properties.$session_id AS sid, count() AS n
         FROM events WHERE event='diagnostic_limit_reached' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
         GROUP BY person_id, properties.$app_version, sid)
   GROUP BY ver ORDER BY ver
   ```

   (Also break down by `properties.ota_update_id` once T1 ships.)

### F-R3-2 — First session runs stale JS, so the upfront gate is missing

1. **Repro.**
   - Install a store or preview binary built *before* a JS fix, publish the fix as an OTA, delete the app, reinstall, and complete onboarding in one launch.
   - The JS in that session is the embedded one, so the fix is absent.
   - Check `Updates.isEmbeddedLaunch` in the dev menu, or the new event property from T1.
2. **Expected after fix.**
   - Every first-hour fix in this plan is embedded in the store binary riders install, not only in an OTA.
   - Each event carries `ota_update_id` and `is_embedded_launch`, so a metric can be split by "first launch on embedded JS".
3. **Automated check.**
   - Jest test `apps/mobile/src/lib/__tests__/analytics-super-props.test.ts`: assert the PostHog super properties include `ota_update_id` and `is_embedded_launch` read from `expo-updates`, with `expo-updates` mocked.
   - E2E is not useful: Maestro cannot install an OTA in a controlled order on a store binary.
   - A release checklist line in `docs/runbooks/mobile-release.md`: "first-hour fixes listed in the release notes are in this binary" (manual).
4. **Production metric.**
   - Definition: riders whose first `diagnostic_limit_reached` happened in their install session, i.e. no second `Application Opened` before it.
   - **Baseline 3.26.0: 4 of 5 limit riders** [SOURCE: Q13].
   - **Target on the first binary that embeds T2–T4: 0.**

   ```sql
   WITH lr AS (SELECT person_id, min(timestamp) AS t, argMin(properties.$app_version, timestamp) AS ver
               FROM events WHERE event='diagnostic_limit_reached' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
               GROUP BY person_id)
   SELECT lr.ver AS ver, count() AS limit_riders,
          countIf(arrayCount(x -> x <= lr.t, o.opens) <= 1) AS first_launch_limit_riders
   FROM lr LEFT JOIN (SELECT person_id, groupArray(timestamp) AS opens
                      FROM events WHERE event='Application Opened' AND timestamp >= now() - INTERVAL 61 DAY
                      GROUP BY person_id) o
     ON lr.person_id = o.person_id
   GROUP BY ver ORDER BY ver
   ```

   After T1, replace the opens heuristic with `countIf(properties.is_embedded_launch = true)` on `diagnostic_limit_reached`.

### F-R3-3 — Repeated automatic gate paywalls in one session (diagnostics upfront gate, MAX_BIKES, error loops)

1. **Repro (diagnostics).**
   - iOS simulator, free user with the seeded used diagnosis, network on.
   - Diagnose tab → "Start a diagnosis" → paywall or alert → dismiss → tap "Start a diagnosis" again → the same paywall opens again (Q7).
2. **Repro (bikes).**
   - Free user with the onboarding Honda.
   - Garage → "Add a Bike" → paywall → dismiss → Home bike switcher "+" → paywall again → Profile "Add bike" → paywall again.
3. **Expected after fix.**
   - In one app session, a feature-gate paywall opens **automatically at most once per feature** and at most twice across all features.
   - Later gated taps open the app-owned `LimitSheet` (light and dark), which has a "See Pro plans" button. That button presents the paywall with `trigger: 'rider_tap'`, and it is never capped.
   - After a `paywall_result: error`, no automatic re-present for 10 minutes. The sheet shows instead.
   - Onboarding surfaces are exempt and unchanged.
4. **Automated check.**
   - Maestro `apps/mobile/.maestro/flows/gate-frequency-cap.yaml`, runner `test:e2e:gate-cap` (default Honda, seeded diagnosis). Steps:
     1. `runFlow: onboarding.yaml`.
     2. Tap `.*Garage.*` → "Add a Bike" → optional dismiss of paywall or alert (RevenueCat may be absent).
     3. Tap "Add a Bike" again → `assertVisible: id: limit-sheet` + `assertVisible: ".*1 bike.*Free.*"` → close.
     4. Go to the Diagnose tab → tap "Start a diagnosis" → optional dismiss → tap again → `assertVisible: id: limit-sheet`. This is the global cap of 2 automatic paywalls per session.
     5. `assertVisible: "See Pro plans"`.
     6. Run in light, then in dark (`setOrientation` is not needed; launch with the simulator appearance toggled by the runner).
   - Plus a Jest unit test `apps/mobile/src/lib/__tests__/paywall-frequency.test.ts` for the ledger:
     - 1st automatic call presents; 2nd same-feature call returns `'capped'`;
     - `rider_tap` is always presented;
     - onboarding surfaces are never capped;
     - after an `error` result, the next automatic call within 10 min is capped;
     - the ledger resets on a new session (AppState background > 30 min, or a cold start).
5. **Production metric.**
   - Definition: share of app sessions with a non-onboarding **automatic** gate paywall that contain ≥2 automatic views of the same feature.
   - **Baseline 3.26.0: 9/22 sessions with ≥2 gate views (41%), 8/22 with a same-feature repeat within 60 s (36%)** [SOURCE: Q10].
   - **Target: 0% of sessions with ≥2 automatic same-feature views; ≤1 automatic view per feature per session by construction.**
   - Guardrail: gate purchases + `rider_tap` paywall views must not fall to zero over 8 weeks. Baseline: 3 gate purchases in 60 d, all on 3.19.1 (Q11, Q12). Read as counts, not rates.

   ```sql
   SELECT ver, count() AS gate_sessions,
          countIf(max_same >= 2) AS sessions_repeat_same_feature
   FROM (SELECT sid, any(v) AS ver, max(cnt) AS max_same
         FROM (SELECT properties.$session_id AS sid, any(properties.$app_version) AS v,
                      properties.feature AS feat, count() AS cnt
               FROM events
               WHERE event='paywall_viewed' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
                 AND NOT startsWith(coalesce(properties.surface,''),'onboarding')
                 AND coalesce(properties.trigger,'auto') = 'auto'   -- T1 adds `trigger`
               GROUP BY sid, feat)
         GROUP BY sid)
   GROUP BY ver ORDER BY ver
   ```

   Plus `paywall_suppressed {feature, surface, reason}` counts by version. These prove the cap fires: they should be >0 and roughly equal to the repeats that existed before.

### F-R3-4 — The exhausted diagnose CTA (and the bike-limit add button) looks available

1. **Repro.** Free user, seeded used diagnosis. The Diagnose tab shows the full-colour "Start a diagnosis" button; the limit sits only in a caption below it (C14).
2. **Expected after fix.**
   - With the quota used and known, the CTA reads "Free diagnosis used · back on {date}" with a muted (not warm) fill, and opens the `LimitSheet`, never the paywall directly.
   - The same applies to the `[id]` screen's "Start new".
   - The garage "Add a Bike" at the limit shows "1 bike on Free" helper text.
   - Light and dark both pass contrast.
   - The CTA's look while the quota is available stays as it is today. The diagnose tab does not get more prominent.
3. **Automated check.**
   - Maestro `apps/mobile/.maestro/flows/diagnose-quota-used.yaml`. Steps:
     1. Onboarding setup and seeded row.
     2. Diagnose tab → `assertVisible: ".*Free diagnosis used.*"`.
     3. Tap it → `assertVisible: id: limit-sheet` → `assertNotVisible: id: diagnose-step-bike` (the form did not open).
   - Plus a Jest component test `apps/mobile/src/components/diagnosis/__tests__/diagnose-cta.test.tsx`, covering three states: available / exhausted / unknown (unknown keeps today's optimistic CTA).
4. **Production metric.**
   - Definition: share of riders who saw the exhausted state and then started the form anyway. Upfront-gate paywall requests (`limit_key = MAX_AI_DIAGNOSTICS_PER_MONTH`) per rider should go to 0, replaced by `limit_sheet_viewed`. Also `diagnostic_started` with quota exhausted should be 0.
   - **Baseline: 6 requests / 3 riders (2.0 per rider) over 60 d** [SOURCE: Q1, Q7].
   - **Target: 0 automatic upfront paywalls; `limit_sheet_viewed` by the same riders.**

   ```sql
   SELECT properties.$app_version AS ver,
          countIf(event='paywall_present_requested' AND properties.limit_key='MAX_AI_DIAGNOSTICS_PER_MONTH') AS upfront_paywalls,
          uniqIf(person_id, event='paywall_present_requested' AND properties.limit_key='MAX_AI_DIAGNOSTICS_PER_MONTH') AS upfront_riders,
          countIf(event='limit_sheet_viewed' AND properties.feature='full_ai_diagnostics') AS limit_sheets
   FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
     AND event IN ('paywall_present_requested','limit_sheet_viewed')
   GROUP BY ver ORDER BY ver
   ```

### F-R3-5 — Diagnosis failures: long waits, raw error text, offline submits

1. **Repro.**
   - (a) Offline: free user with no diagnosis used. Fill the form, enable airplane mode, tap Analyze. Today: fails after the transport error, the raw message shows, and "Try Again" sends again.
   - (b) Slow server: point the API URL at a proxy that delays `submitDiagnostic` by 120 s. The spinner holds for 120 s (the client limit is 300 s, C5).
2. **Expected after fix.**
   - (a) Analyze is blocked with "You're offline. Your answers are kept; try again when you're connected." No request is sent, and `diagnostic_failed {reason:'offline_precheck'}` fires.
   - (b) After 10 s the spinner caption changes to "Still working…". At 75 s it stops with "This is taking longer than usual. Your free diagnosis wasn't used." and offers a retry. The retry stays disabled until the quota refetch shows the diagnosis unused.
   - No raw server text is ever shown, in any locale.
3. **Automated check.**
   - Maestro `apps/mobile/.maestro/flows/diagnose-offline.yaml` (Android emulator, `setAirplaneMode`). Steps:
     1. Onboarding setup.
     2. Diagnose tab → Start → fill steps.
     3. Airplane mode on → tap "Analyze".
     4. `assertVisible: ".*offline.*"`.
     5. `assertNotVisible: ".*Failed to analyze.*|.*Network request failed.*"`.
     6. Airplane mode off.
   - The slow-server case is a Jest test, `apps/mobile/src/app/(tabs)/(diagnose)/__tests__/new-timeout.test.tsx`, with fake timers and a never-resolving `gqlFetcher`. It asserts the 10 s caption, the 75 s message and `diagnostic_failed {reason:'timeout', elapsed_s}`. E2E is not used because Maestro cannot delay one GraphQL operation without a proxy in CI.
4. **Production metric.** Read with `quantile`, as in Q8.

   | Measure | Baseline [SOURCE: Q8, Q9] | Target |
   |---|---|---|
   | p90 seconds from `diagnostic_submitted` to `diagnostic_failed` | 47 s (max 141) | ≤ 75 s, by construction |
   | `diagnostic_failed` per failing rider | 10 failures / 3 riders on 3.26.0 (3.3) | ≤ 1.5 |
   | `diagnostic_failed` with `offline=true` *after a request was sent* | 7 / 14 | 0 (moved to `reason:'offline_precheck'`) |

   ```sql
   SELECT properties.$app_version AS ver, properties.reason AS reason, count() AS n, uniq(person_id) AS riders,
          quantile(0.9)(toFloat(properties.elapsed_s)) AS p90_elapsed
   FROM events WHERE event='diagnostic_failed' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL>
   GROUP BY ver, reason ORDER BY ver
   ```

   (`reason` / `elapsed_s` are added by T5. On older builds they read null, so use the Q8 pairing as the baseline.)

### F-R3-6 — Measurement gaps that make the above unreadable

1. **Repro.** In PostHog, `diagnostic_started` fires on every focus of the form (C13: 51 started vs 47 submitted on 3.26.0, and one fired from `/(modals)/start-ride`). Paywall events cannot tell automatic from rider-tapped. Events cannot tell OTA from embedded JS (RC-2).
2. **Expected after fix.**
   - `diagnostic_started` fires once per flow entry (from `useStartDiagnosis` or the entry gate), with `entry: 'list'|'detail'|'quick_action'`.
   - `paywall_present_requested/viewed/result` carry `trigger: 'auto'|'rider_tap'` and `gate_policy: 'capped_v1'`.
   - A new event `paywall_suppressed {feature, surface, reason: 'session_feature_cap'|'session_global_cap'|'error_cooldown'}` and a new event `limit_sheet_viewed {feature, surface}`.
   - Super properties `ota_update_id` and `is_embedded_launch` on every event.
3. **Automated check.**
   - Jest, `apps/mobile/src/lib/__tests__/subscription.test.ts` (extend it): `trigger` and `gate_policy` are present on all three paywall events.
   - Jest, `apps/mobile/src/components/diagnosis/__tests__/use-start-diagnosis.test.tsx`: one `diagnostic_started` per start, and none on refocus.
   - Jest, `analytics-super-props.test.ts` (as in F-R3-2).
4. **Production metric.**
   - Definition: ratio of `diagnostic_started` to distinct form entries. Target ≈1.0. **Baseline 51/47 started/submitted on 3.26.0** [SOURCE: Q9].
   - Definition: share of paywall events with `trigger` set on the new build. Target 100%.

   ```sql
   SELECT properties.$app_version AS ver, countIf(properties.trigger IS NULL) AS missing, count() AS total
   FROM events WHERE event IN ('paywall_present_requested','paywall_viewed','paywall_result')
     AND timestamp >= now() - INTERVAL 14 DAY AND <EXCL> GROUP BY ver
   ```

### Release marker in PostHog (owner requirement)

- The build that ships T2–T5 sets `gate_policy: 'capped_v1'` on paywall events. Every metric above can then be split by `$app_version` *and* by `gate_policy`, which is valid across OTAs.
- At release, a PostHog annotation "R3 first-hour paywall fixes — <version> (build N), OTA <id>" is created on project 155556. That is a PostHog **write**, so it needs owner approval or an agent run with write permission, not this research run.
- A saved insight "R3 first-hour paywalls" holds the 6 HogQL queries above, broken down by `$app_version`. The owner decides whether it is saved.

**Headline before/after for the release:** share of completers with ≥2 post-onboarding automatic paywalls in the first hour.
- **Baseline 8/121 = 6.6% on 3.26.0** [SOURCE: Q5].
- **Target ≤2% on the fixed binary.** That is UNBACKED as an effect size. Mechanically, each feature can auto-present once, so ≥2 means two different features. Note that 3.27+ already shows 1/9.

```sql
WITH c AS (SELECT person_id, min(timestamp) AS t0, argMin(properties.$app_version, timestamp) AS ver
           FROM events WHERE event='onboarding_completed' AND timestamp >= now() - INTERVAL 60 DAY AND <EXCL> GROUP BY person_id)
SELECT c.ver, count() AS completers,
       countIf(post_auto >= 2) AS completers_2plus_post_auto
FROM c LEFT JOIN (
  SELECT e.person_id AS person_id,
         countIf(NOT startsWith(coalesce(e.properties.surface,''),'onboarding') AND coalesce(e.properties.trigger,'auto')='auto') AS post_auto
  FROM events e INNER JOIN c c2 ON e.person_id = c2.person_id
  WHERE e.event='paywall_viewed' AND e.timestamp >= now() - INTERVAL 61 DAY
    AND e.timestamp >= c2.t0 AND e.timestamp <= c2.t0 + INTERVAL 60 MINUTE
  GROUP BY e.person_id) p ON p.person_id = c.person_id
GROUP BY c.ver ORDER BY c.ver
```

## 6. Tasks (in order)

**T1 — Instrumentation for gate paywalls and diagnostics (S).**
- *Why:* RC-2 and RC-3 can't be proven per release without it. `diagnostic_started` overcounts (Q9, C13). `$app_version` hides OTAs (Q13).
- *What:*
  - add `trigger` and `gate_policy` to `paywallProperties` (`apps/mobile/src/lib/subscription.ts:133-149`);
  - new `AnalyticsEvent.PAYWALL_SUPPRESSED` and `LIMIT_SHEET_VIEWED` (`apps/mobile/src/lib/analytics.ts:586-593, 775-778`);
  - register `ota_update_id` (`Updates.updateId ?? 'embedded'`) and `is_embedded_launch` as super properties where PostHog is initialised (`analytics.ts:68`);
  - move `diagnostic_started` out of `useFocusEffect` (`(diagnose)/new.tsx:70-79`) into the entry points (`use-start-diagnosis.ts`, `use-diagnostic-entry-gate.ts`), with `entry`;
  - add `reason`/`elapsed_s` to `diagnostic_failed`.
- *Files:* `apps/mobile/src/lib/subscription.ts`, `apps/mobile/src/lib/analytics.ts`, `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`, `apps/mobile/src/components/diagnosis/use-start-diagnosis.ts`, tests listed in F-R3-6.
- *Acceptance:* the F-R3-6 Jest tests pass; on a preview build PostHog Live shows `trigger`, `gate_policy` and `ota_update_id`.
- *Verify:* F-R3-6 metric query.
- *Depends on:* none. *Owner decision:* none. Super properties carry no personal data.

**T2 — Stop the "Try Again" limit loop (S).**
- *Why:* RC-1. 3 of 5 limit riders repeated it 2–3× (Q2, Q3), and the code is still on main (C11, C12).
- *What:* in `handleSubmit`'s `FORBIDDEN` branch, set a typed `limitReached` state instead of `submitError`. `StepReviewSubmit` renders a localized limit panel (reset date from `useDiagnosticQuota().resetDate`) with "See Pro plans" (`presentPaywall` with `trigger:'rider_tap'`) and "Done". Remove "Try Again" for this state. Present the automatic paywall at most once per form instance. Never render server text.
- *Files:* `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`, `apps/mobile/src/components/diagnostic-flow/step-review-submit.tsx`, `apps/mobile/src/stores/diagnostic-flow.store.ts`, locale files `apps/mobile/src/i18n/locales/*.json`.
- *Acceptance:* the F-R3-1 Jest test and Maestro flow pass; light and dark screenshots.
- *Verify:* F-R3-1 metric. 0 riders with ≥2 limit events per session on the fixed build.
- *Depends on:* T1 (for `trigger`). *Owner decision:* the copy.

**T3 — Session frequency cap for feature-gate paywalls plus `LimitSheet` (M).**
- *Why:* RC-3. 36–41% of current-build gate sessions repeat (Q10). Riders re-tap 1–11 s after dismissing (Q7).
- *What:*
  - a `paywall-frequency.ts` ledger: per-session, in memory, reset on a cold start or after 30 min in the background;
  - consulted by `requirePro`/`requireAccess` (`use-pro-gate.ts:64-105`), the garage header (`(garage)/index.tsx:128-130`) and `use-profile-data.ts:118-128`;
  - rules: one automatic present per feature per session; 2 automatic gate presents per session in total; 10-min cooldown after an `error`; onboarding surfaces and explicit "Upgrade" surfaces (`profile_subscriptions_row`, `profile_pro_banner`) exempt;
  - once capped, open a `LimitSheet` (feature-specific copy; bikes: "Free includes 1 bike. Edit your bike instead, or see Pro"; diagnostics: reset date), light and dark, with "See Pro plans" sent as `rider_tap`;
  - fire `paywall_suppressed`.
- *Files:* new `apps/mobile/src/lib/paywall-frequency.ts`, new `apps/mobile/src/components/paywall/limit-sheet.tsx`, `apps/mobile/src/hooks/use-pro-gate.ts`, `apps/mobile/src/app/(tabs)/(garage)/index.tsx`, `apps/mobile/src/hooks/use-profile-data.ts`, locales; Maestro `gate-frequency-cap.yaml` plus a runner script entry in `apps/mobile/package.json`.
- *Acceptance:* the F-R3-3 unit test and Maestro flow pass; onboarding flows (`onboarding.yaml`, `onboarding-paywall-verify.yaml`) still pass unchanged.
- *Verify:* F-R3-3 metric plus the purchase guardrail.
- *Depends on:* T1. *Owner decision:* **yes**: the cap values (1 per feature, 2 per session, 10 min error cooldown) and whether the bike sheet offers "Edit my bike" (this overlaps the PO1 deep dive).

**T4 — Exhausted-state CTA for diagnostics and the bike-limit hint (S).**
- *Why:* RC-3. The limit is in a caption only (C14).
- *What:* the Diagnose list CTA (`(diagnose)/index.tsx:141-165`) and `[id].tsx` "Start new" render an exhausted variant when `quota.isExhausted`, opening the `LimitSheet`; the garage add button shows "1 bike on Free".
- *Files:* `apps/mobile/src/app/(tabs)/(diagnose)/index.tsx`, `apps/mobile/src/app/(tabs)/(diagnose)/[id].tsx`, `apps/mobile/src/components/diagnosis/quota-note.tsx`, `apps/mobile/src/app/(tabs)/(garage)/index.tsx`, locales.
- *Acceptance:* F-R3-4 tests pass; `pnpm check:mobile-colors` passes; light and dark screenshots.
- *Verify:* F-R3-4 metric.
- *Depends on:* T3 (`LimitSheet`). *Owner decision:* the copy; confirm it doesn't read as promoting AI.

**T5 — Diagnosis error, offline and timeout handling (S–M).**
- *Why:* RC-4. Failure p90 47 s and max 141 s; 7/14 offline; raw text shown (Q8, C5, C11).
- *What:*
  - offline pre-check (the existing `isNetworkError` / NetInfo) before submit;
  - `gqlFetcher(SubmitDiagnosticDocument, …, { timeoutMs })` with a new `GQL_TIMEOUT_MS.DIAGNOSIS` of 75 s;
  - a "Still working…" caption after 10 s;
  - error classes mapped to i18n keys (offline, throttled = `TOO_MANY_REQUESTS`, timeout, server);
  - after a timeout, re-submit is disabled until `diagnosticQuota` is refetched (so a late server success isn't followed by a FORBIDDEN loop);
  - `diagnostic_failed {reason, elapsed_s}`.
- *Files:* `apps/mobile/src/lib/graphql-client.ts`, `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`, `apps/mobile/src/components/diagnostic-flow/step-review-submit.tsx`, locales.
- *Acceptance:* the F-R3-5 Jest test and Maestro offline flow pass.
- *Verify:* F-R3-5 metric.
- *Depends on:* T1, T2. *Owner decision:* the 75 s value. Server `AI_CLIENT` is 60 s × up to 3 retries (C4); the owner may prefer reducing server retries for diagnostics instead.

**T6 — Ship in a store binary, plus the release marker (S, process).**
- *Why:* RC-2. OTA-only fixes miss every first session (Q13).
- *What:*
  - T2–T5 go into the next store build (3.29.0+), not only an OTA;
  - add a line to `docs/runbooks/mobile-release.md`: "first-session fixes must be embedded";
  - at release, create the PostHog annotation and the saved insight from §5;
  - read F-R3-1…F-R3-5 at 2, 4 and 8 weeks by `$app_version` and `ota_update_id`.
- *Files:* `docs/runbooks/mobile-release.md`.
- *Acceptance:* the release notes list R3; the annotation exists; the first `gate_policy='capped_v1'` events appear with `is_embedded_launch=true`.
- *Depends on:* T1–T5. *Owner decision:* **yes**: the store-release timing, and approval for the PostHog writes (annotation, saved insight).

**T7 — E2E runner support for a used diagnosis (S).**
- *Why:* F-R3-1, F-R3-3 and F-R3-4 need a free user whose diagnosis is used, without a real AI call.
- *What:* extend `apps/mobile/scripts/run-onboarding-e2e.sh` with an opt-in `E2E_SEED_DIAGNOSIS_USED=1` that inserts one `content_generation_log` success row for the created user via the admin API, deleted with the user; add `test:e2e:diagnose-limit`, `test:e2e:gate-cap`, `test:e2e:diagnose-quota-used` and `test:e2e:diagnose-offline` to `apps/mobile/package.json`; document them in `apps/mobile/.maestro/README.md`.
- *Acceptance:* flows run green on a preview build via the Maestro MCP; selectors are taken from `inspect_screen`, not invented.
- *Depends on:* T2–T5 for the assertions. *Owner decision:* none beyond the existing runner's use of the admin key against prod (already accepted for the onboarding E2E).

## 7. Risks

- **Revenue.** A cap could cost a purchase made on a repeat view (2 of 3 gate purchases in 60 d, Q12). Mitigation: the cap only stops *automatic* re-presents, "See Pro plans" is always one tap away, and the guardrail counts sit in F-R3-3. Gate purchases on 3.26.0+ are 0, so the expected loss is small but [UNBACKED].
- **Experiment contamination.** None expected. Onboarding surfaces are exempt by `isOnboardingPaywallSurface`, and the RevenueCat `feature_gate` placement is unchanged. Check that `onboarding-paywall-verify.yaml` still passes.
- **Diagnostics prominence.** The exhausted CTA must not become a bigger upsell than today. T4 makes it quieter.
- **Small numbers.** 5 limit riders and 22 gate sessions in 60 days. Read every metric as counts per release, not rates with intervals. ~7 installs a day means a clean before/after needs ≥4 weeks on the fixed binary.
- **A timeout racing a late success** (T5): the server may finish after the client gives up, and that uses the quota. Mitigated by refetching the quota before allowing a retry.
- **Overlap with PO1.** The bike paywalls are mostly riders re-adding their onboarding bike. The cap stops the repeats but not the cause. The PO1 deep dive owns the "edit my bike" path.
- **Session definition.** The cap's "session" (cold start or >30 min background) differs from PostHog's `$session_id`. Metrics use `$session_id`, so small mismatches are expected.

## 8. Open questions

1. Which commit was each 3.26.0 store binary (iOS and Android) built from? Did any embed #318? (EAS build list; confirms RC-2.)
2. Were the 3 non-offline `diagnostic_failed` riders on 3.26.0 throttled (3/min), timed out, or 5xx? Check Sentry `source: diagnose.submitDiagnostic` (RC-4).
3. Is `FORBIDDEN` on submit ever the daily `checkBudget` limit (50/day) or the global circuit breaker rather than the monthly limit? Both throw `ForbiddenException` (C2), and the limit panel copy would then be wrong.
4. Owner: the cap values (1 per feature per session, 2 per session, 10 min error cooldown) and whether explicit "Upgrade" surfaces stay uncapped.
5. Owner: may the PostHog annotation and saved insight be created at release (a write)?
6. On iOS simulators Maestro cannot toggle airplane mode. Should F-R3-1 / F-R3-5 run on the Android emulator only, or should we add a test-only network-off launch arg?
7. Does the diagnostics free tier (1 per month) make riders' first session end in a dead end by design? 4 of 30 diagnosing users had ≥2 successes in one month (S3), and 3 of 4 limit-loop riders had used their free diagnosis minutes earlier. This is a product question, not a friction fix, and it is outside R3's scope.
