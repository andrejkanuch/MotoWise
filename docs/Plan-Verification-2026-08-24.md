# Independent verification of the activation + store-truth plan

**Date:** 2026-08-24
**Plan:** `docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md`
**Why this exists:** the plan was never independently reviewed. `ce-doc-review`
dispatched 7 persona reviewers and none returned findings; a single-context pass
substituted. This is the review, done by re-deriving every load-bearing number
from first-party sources rather than by reading the plan again.

Sources: production `public.users` via service-role REST (read-only), PostHog
project 155556 via SQL, App Store Connect via `asc`, Google Play via `gplay`.

---

## Verdict

**The plan's core diagnosis is sound and its numbers are accurate.** Of ~25
load-bearing claims checked, 19 verified exactly or within ±1, three were
materially wrong, and three could not be verified as stated.

Nothing found here invalidates a decision already made. Two findings change what
should happen **next**, and one retracts a recommendation that appears in the
plan, the handoff, this session's runbook, and the paywall decision record.

---

## Verified exactly (or within ±1)

| Claim | Plan | Measured |
|---|---|---|
| Users lifetime | 577 | **577** |
| Users last 90 days | 320 | **320** |
| Added a bike | 286 | **286** |
| Ever logged an expense | 66 | **66** |
| Logged an expense >1 day after signup | 28 (4.9%) | **28 (4.9%)** |
| Logged an expense >7 days after signup | 22 (3.8%) | **22 (3.8%)** |
| Rides, same two cuts | 34 / 23 | **34 / 23** |
| `lean` started → completed | 222 → 90 (40.5%) | **223 → 90** |
| `lean` bike-added | 167 (75.2%) | **168** |
| `lean` expense / purchased | 20 / 12 | **20 / 12** |
| `invested` started → completed | 201 → 59 (29.4%) | **201 → 59** |
| `invested` bike-added / expense / purchased | 130 / 12 / 6 | **130 / 12 / 6** |
| NULL-variant users | 33 | **33** |
| `maintenance` viewed / completed / skipped | 150 / 2 / 146 | **151 / 2 / 147** |
| `scan_receipt` viewed / completed / skipped | 40 / 0 / 40 | **40 / 0 / 40** |
| `paywall` step viewed (lean) | 165 | **166** |
| `heard_about` viewed | 85 | **85** |
| `MAX_BIKES` gate users, 90d | 24 | **24** |
| AI diagnostics users | 19 | **19** |
| iOS live version | 3.18.0 | **3.18.0** |
| iOS 3.19.1 state | WAITING_FOR_REVIEW, build 88, MANUAL | **confirmed** |
| Play production | 3.19.0, version code 81 | **confirmed** |
| App Store category | Utilities (+ Lifestyle) | **confirmed** |
| Nominations / CPPs / in-app events | 0 / 0 / 1 draft | **confirmed** |

The two decisions that rest on these — retire the experiment in favour of `lean`,
and cut those three steps — are supported by the data as stated. `scan_receipt`
at **0 of 40** is exact.

---

## Materially wrong

### 1. "20 on `pro`" overstates paying customers by roughly 2×

Measured: **19** rows have `subscription_tier = 'pro'` lifetime; **16** are not
soft-deleted. Of those 16, `subscription_status` is:

| Status | Users |
|---|---|
| `active` | **7** |
| `cancelled` | **7** |
| `trialing` | **2** |

So the currently-entitled paying base is **7 active + 2 trialing = 9**, not 20.
Seven users retain `tier = pro` after cancelling.

This makes the revenue picture worse than the plan implies, which strengthens
rather than weakens the case for the work. It also matters for U6's stop-loss:
at 7 active subscribers, trial-start noise dominates even more than the
`purchase_completed` series suggested, and the two-window trigger is if anything
too aggressive rather than too slow.

### 2. `account_created` **over**-counts; the plan describes only undercounting

The plan frames the instrumentation gap as an undercount. Per calendar month,
the union of the two legacy events runs **7% → 22% → 43% → 104% → 98%** of real
signups. July is above 100%.

`account_created` fired from a `useEffect` that ran whenever a Supabase session
appeared on the account screen — a screen that explicitly accepts returning
users, because Apple and Google do not separate sign-up from sign-in. Every
returning sign-in was counted as an account creation.
`docs/onboarding-ab-event-schema.md` even documents it as *"account created **or
signed in**"*.

The two events fail in opposite directions, and their recent near-parity is two
errors partially cancelling, not a working measurement. The plan's remedy is
unchanged and correct; its justification was half the story. Full detail in
`docs/Signup-Reconciliation-2026-08-24.md`.

### 3. The 33 NULL-variant users are old app builds, not an assignment failure

The plan asks whether this is "an assignment failure or offline defaulting". It
is neither. All 33 are on **3.8.0 (29), 3.9.0 (3) and 3.3.0 (1)** — builds that
predate the assignment code. They are the slow-updating tail.

I initially guessed analytics-consent gating. That is provably impossible: with
consent off `trackEvent` no-ops, so those users emit **no events at all** and
cannot appear in PostHog as a null-variant cohort. My own code comment asserting
it has been corrected.

Related: `control` accumulated **8 users** despite a 0% rollout, via the old
"flag fetched but disabled/unknown value → CONTROL" branch. That branch is now
gone, so both anomalies are closed by construction.

---

## ⚠️ Retracted recommendation — mobile session replay is NOT capturing

The plan says *"Watch the session replays first (replay is enabled on this
project)"* and *"Mobile session replay is enabled on this PostHog project, so
watching real abandonment is available and has not been done."* The handoff
repeats it. I repeated it twice more, in the runbook and the paywall decision.

**It is not available.** Measured 2026-08-24:

- Project has `session_recording_opt_in: true`, and `session_replay_config: null`.
- Recordings **do** exist and are arriving today — every one with
  `snapshot_source: web` and a `motovault.app/blog/...` entry URL.
- Filtering recordings to `snapshot_source = mobile` over **90 days returns
  zero**. Not a sampling artefact: zero.
- No event in 30 days carries a `$recording_status` property at all (0 of 10,377).

The mobile SDK does enable replay (`enableSessionReplay: !__DEV__` in
`analytics.ts`) and native builds have shipped since (3.10.1 → 3.19.0), so the
client side is not obviously the blocker. The most likely cause is the one the
2026-06-09 fix wrote down as still outstanding and never ticked off: *"Still
requires: a fresh native build (not OTA) **+ the project-side 'Record mobile
sessions' toggle in PostHog settings**."* `session_replay_config: null` is
consistent with that toggle never having been set.

**Consequence:** "watch 20 abandonments" is a one-toggle-away recommendation, not
a today recommendation. Flip it in PostHog → Session Replay settings, confirm
mobile recordings start arriving, and only then treat replay as the tool for the
day-2 retention question. Until then the honest fallback is event-sequence
analysis, which is what the section below does.

---

## Could not verify as stated

- **"395 of 692 people who start onboarding see it."** The ratio holds but neither
  window I measured reproduces those figures: since the experiment launched it is
  308 of 458 (67%); since 2026-01-01 it is 449 of 733 (61%); the plan's is 57%.
  Substance intact ("a majority see a paywall before creating an account"), window
  unstated.
- **"7 App Store ratings, average 4.43, only 2 inside the 7 localized
  storefronts, US is the 2★."** The public lookup returns no rating fields for
  this app, so this needs the ASC UI. Not load-bearing for anything implemented.
- **"15 app-info locales carry an indexed name/subtitle pair but only 7 have a
  keyword field."** `asc metadata pull` returns only the 7 locales that have
  version localizations, so the extra 8 could not be enumerated from the CLI.
  The 7 pulled all match the plan's description exactly, including the
  untranslated English "Ride" in `es-MX` and `pt-BR`.

---

## The finding that changes what to do next

Onboarding abandonment by last step reached, sessions in the last 30 days:

| Last step before abandoning | Sessions |
|---|---|
| **`account`** | **62** |
| `welcome` | 50 |
| `bike_setup` | 32 |
| `goals` | 25 |
| `paywall` | 19 |
| `experience` | 17 |
| `notifications` | 12 |
| `commitment` | 10 |
| `maintenance` | 8 |
| `scan_receipt` | 6 |

**The account wall is the single largest drop-off — more than three times the
paywall's.** `welcome` at 50 is mostly open-and-bounce, so among riders who
engaged at all, `account` dominates.

The plan noted this in passing under U6 — *"`account` leaks 33% today (139 viewed
→ 93 created); this unit does not fix that, but it moves earlier in the flow, so
watch whether the leak moves with it"* — and deferred it. The 30-day ranking says
it should not stay deferred: with the paywall gone, the account gate is now both
the biggest remaining reason to leave **and** earlier in the flow than before.

That is a concrete answer to the "we removed reasons to leave but added no reason
to return" tension, and it is a better next move than any experiment this traffic
can support. It is not in scope for this plan; it is the strongest candidate for
the next one.
