# The account gate is not the largest onboarding drop-off

**Date:** 2026-08-25
**Source:** first-party PostHog HogQL over `events`, 30 days, project 155556, Slovakia
excluded to match the project's test-account convention.
**Verdict:** ⚠️ **The claim that `account` is the biggest onboarding drop-off is wrong.**
It is a measurement artefact. The real loss is upstream and roughly three times larger.

This claim has been repeated across `docs/Activation-Store-Truth-Runbook-2026-08-24.md`,
`docs/Paywall-Timing-Decision-2026-08-24.md`, the session handoffs, and by me repeatedly
in this session, always as the recommended next plan. It should stop being repeated.

## What the claim was

> "Onboarding abandonment by last step over 30 days puts **`account` first at 62
> sessions** — more than 3× the paywall's 19, ahead of `bike_setup`'s 32. With the paywall
> removed, the account gate is the largest remaining reason to leave — and U6 moved it
> *earlier* in the flow."

The number reproduces. Grouping sessions by their **last** `onboarding_step_viewed`:

| Final step in session | Sessions |
|---|---|
| `personalizing` | **98** |
| `account` | **63** |
| `welcome` | 51 |
| `bike_setup` | 32 |
| `goals` | 25 |
| `paywall` | 18 |

So `account` at ~63 and `bike_setup` at 32 and `paywall` at 18 are all correct. But
`account` is **second**, not first, and the step above it is the tell.

## Why the metric misleads

**`personalizing` is a success state, not an abandonment.** Every one of the 99 users who
reach it completes onboarding — `pct_finished` is 100%. A session ending there means the
user *finished*. Whoever produced the original ranking evidently excluded it for exactly
that reason, then took the next row down as "the largest abandonment."

**But `account` is mostly a success state too.** Of the 157 users who reached it:

| | |
|---|---|
| Reached `account` | **157** |
| …later emitted `onboarding_completed` | **96** (61%) |
| …later emitted `account_created` / `user_signed_up` | **100** (64%) |

Roughly **62% of people who reach the account screen get through it.** Counting all 63
"sessions ending at account" as abandonment double-counts successes as failures.

Two things make `account` look terminal when it is not:

1. **It emits no `onboarding_step_completed` event — ever.** Zero, across 30 days, for
   157 viewers. It is not alone: `welcome`, `building_plan`, `heard_about`, `commitment`,
   `personalizing` and `scan_receipt` also never emit a completion. Any funnel keyed on
   step-completion shows every one of them as a wall.
2. **Account creation crosses a session boundary.** Sign-up involves an OAuth hop or an
   email round-trip, so the following screen frequently lands in a *new* session. The
   old session's last step is `account` even though the user continued.

## What the data actually says

Conditional completion — of the users who reached each step, how many finished onboarding:

| Step | Reached | Finished | Never finished | % finished |
|---|---|---|---|---|
| `welcome` | 295 | 97 | **198** | **32.9%** |
| `experience` | 264 | 97 | 167 | 36.7% |
| `bike_setup` | 230 | 97 | **133** | **42.2%** |
| `goals` | 202 | 97 | 105 | 48.0% |
| `frequency` | 125 | 40 | 85 | 32.0% |
| `stay_on_top` | 118 | 40 | 78 | 33.9% |
| `paywall` | 172 | 97 | 75 | 56.4% |
| `maintenance` | 163 | 90 | 73 | 55.2% |
| `commitment` | 159 | 87 | 72 | 54.7% |
| `last_service` | 111 | 40 | 71 | 36.0% |
| **`account`** | 157 | 96 | **61** | **61.1%** |
| `notifications` | 102 | 99 | 3 | 97.1% |
| `personalizing` | 99 | 99 | 0 | 100.0% |

**`account` has the best conversion of any substantive step in the flow.** Reaching it
makes a user *more* likely to finish than reaching anything before it. That is the opposite
of a wall.

### The actual headline

**Only 32.9% of users who see the first onboarding screen ever complete onboarding.**
295 reach `welcome`; 97 finish. Two-thirds are lost — and they are lost early, spread
across `welcome → experience → bike_setup`, long before the account screen.

The largest single identifiable sink is **`bike_setup`**: 230 reach it, 42.2% finish, and
26 users explicitly *skipped* it. That is where a real investigation belongs.

## Caveats, stated rather than buried

- The 30-day window spans the A/B test, so two different step sets are mixed. The
  `finished: 40` rows (`frequency`, `stay_on_top`, `last_service`, `building_plan`) are the
  old control flow; the `finished: 99` rows (`heard_about`, `notifications`,
  `personalizing`) are the new one. Comparing a control-only step against a
  treatment-only step is not meaningful; compare within a column.
- `never_finished` counts anyone without an `onboarding_completed` event, which includes
  users who started recently and may still finish. It therefore slightly overstates loss,
  uniformly across steps.
- Ranking by `never_finished` largely recovers funnel order — earlier steps have more
  users, so more non-finishers. **`pct_finished` is the column that carries information**,
  not `never_finished`.
- Slovakia is excluded to match the project's test-account filter. `execute-sql` does not
  apply that filter automatically.

## What to do instead

1. **Stop citing `account` as the top drop-off.** It is second on a metric that
   miscounts successes, and best-in-class on the metric that does not.
2. **Fix the instrumentation before planning against it.** Six steps emit no
   `onboarding_step_completed`. Until `account` in particular emits one, no funnel tool
   can distinguish "left at the account screen" from "signed up and continued in a new
   session". This is the same class of defect as the signup event itself: the number
   looked authoritative and measured something else.
3. **Point the next investigation at `welcome → experience → bike_setup`**, which is where
   two-thirds of the loss actually is.
4. **Mobile session replay would settle it** — and is now one native build away
   (`@posthog/react-native-plugin` is installed; see the solutions doc). Watching 20 real
   abandonments at `bike_setup` beats any funnel query this traffic can support.

## Reproducing

```sql
-- conditional completion by step
WITH done AS (
  SELECT DISTINCT person_id FROM events
  WHERE event='onboarding_completed' AND timestamp > now() - INTERVAL 30 DAY
)
SELECT properties.step AS step,
       uniqExact(person_id) AS reached,
       uniqExactIf(person_id, person_id IN (SELECT person_id FROM done)) AS finished
FROM events
WHERE event='onboarding_step_viewed'
  AND timestamp > now() - INTERVAL 30 DAY
  AND coalesce(properties.$geoip_country_code,'') != 'SK'
GROUP BY step ORDER BY reached DESC
```
