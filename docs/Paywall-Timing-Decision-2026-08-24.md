# Paywall timing — experiment declined, plus the stop-loss for shipping untested

**Date:** 2026-08-24
**Covers:** U6 (rollback trigger) and U7 (run-or-decline) of
`docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md`
**Verdict:** **Do not run the replacement experiment.** Ship the paywall-free flow
untested, read it before/after against the PostHog cutover annotation, and hold the
written stop-loss below.

The plan's own Deferred Implementation Notes anticipate this outcome: *"Whether U7 is
worth running at all. The power arithmetic is part of the unit; a 'declined, cannot
converge' outcome is a valid and honest result."* It is declined for two independent
reasons, and the first is the more important one.

---

## Reason 1 — the proposed primary metric cannot move (structural, not statistical)

This is not a sample-size problem and no amount of traffic fixes it.

The experiment as specified is:

| | Control | Treatment |
|---|---|---|
| Onboarding | no paywall | no paywall |
| Paywall | none | **presented after the first value-logging action** |
| Primary metric | first-value-logged | first-value-logged |

The treatment's only difference from control is a paywall that fires **after** the
primary metric's event has already occurred. The plan's own test scenarios state this
outright: *"The treatment arm presents the paywall only after the first value-logging
action"* and *"A user who never logs value never sees the treatment paywall."*

So a user in the treatment arm is, up to and including the moment the primary metric
fires, in an experience **identical** to control. The measured quantity is causally
upstream of the intervention. The expected effect on first-value-logged is zero by
construction, and observing zero would teach us nothing — it is what the design
guarantees regardless of whether a post-value paywall is a good idea.

The metric that *is* sensitive to the treatment is trial start — the one the plan
deliberately demoted to a guardrail (KTD6), precisely because optimising for it is what
put a paywall in step 5 of onboarding. Promoting it back would recreate the original
mistake. So the experiment either measures something it cannot move, or measures the
thing we decided not to optimise for.

**This corrects the plan.** KTD6's reasoning — that trial start is the wrong objective —
is sound and stands. What does not follow is that first-value-logged can serve as the
primary metric for *this particular* treatment. Inverting the objective was right;
inverting it while keeping a treatment that acts after the objective is measured is not
a testable design.

## Reason 2 — every metric that could move is years from significance

Measured on this project, weeks of 2026-05-18 → 2026-08-17 (14 complete weeks; the
partial week of 08-24 is excluded):

| Series | Weekly mean | Range | 14-week total |
|---|---|---|---|
| `onboarding_started` unique users | **44.6** | 28–78 | 625 |
| First-**ever** value logged (`expense_added` or `maintenance_log_added`) | **3.36** | 1–6 | 47 |
| `purchase_completed` unique users | **1.86** | 0–4 | 26 |

Note the plan estimated "~5–8 first-value events per week". The true first-ever rate is
**3.36/week** — the 5–8 figure counts users who logged in a given week including repeat
loggers, which is roughly 5.3/week. Sizing on the higher number would have understated
the required duration by about 60%.

Baseline first-value rate = 3.36 / 44.6 = **7.5%**. Two-arm split, α = 0.05 two-sided,
80% power, ~22.3 exposures per arm per week:

| Effect to detect | Rate needed | n per arm | Duration per arm |
|---|---|---|---|
| +20% relative | 9.0% | ~5,280 | **~4.5 years** |
| +50% relative | 11.3% | ~950 | ~10 months |
| +100% relative (doubling) | 15.0% | ~280 | ~3 months |

And on the sensitive metric, trial start (baseline 1.86 / 44.6 = **4.2%**):

| Effect to detect | n per arm | Duration per arm |
|---|---|---|
| +50% relative | ~1,770 | **~1.5 years** |

Only a doubling of first-value logging is readable inside a quarter, and a doubling is
not a plausible effect of paywall placement — especially from a treatment that adds
friction rather than removing it.

This mirrors the PPO finding in U4: at this traffic level, experiments are not the tool.
Shipping one change at a time and reading the series is.

## What to do instead

1. **Ship the paywall-free flow at 100%.** Already done in U6.
2. **Do not create the experiment.** The dormant PostHog flag from 2026-04-29
   (`showing paywall after first core action vs during onboarding`) stays unrolled-out.
   Leave it as flag cruft to be cleaned up per the plan's Deferred Follow-Up, or delete
   it — do not roll it out.
3. **Read it before/after, anchored on the cutover annotation.** The annotation R6
   requires is what makes this readable at all: it marks the boundary so nobody builds a
   funnel spanning two different flows. Compare the 8 weeks after the OTA reaches most
   users against the 14 weeks tabulated above.
4. **Watch session replays.** Replay is enabled on this project and has never been used
   for this question. At 44 onboarding starts a week, watching 20 real abandonments is
   both faster and more informative than any test the traffic can support. This is the
   plan's own deferred item and it is now the highest-value next step.

## The stop-loss (U6 rollback trigger)

Removing the onboarding paywall removes the placement responsible for most paywall
views (`onboarding_rides`, 327 users). **Trial starts are expected to fall.** That is the
accepted trade in KTD6. Writing the trigger down now is the point — otherwise it becomes
an argument later instead of a decision made in advance.

**Baseline, from the table above:** `purchase_completed` unique users, 14 complete weeks.
Weekly values, chronological: 1, 2, 1, 2, 4, 0, 3, 1, 2, 0, 3, 2, 1, 4.

Rolling 3-week sums range **3 to 7**, mean 5.4. The historical **floor is 3**.

**Trigger:** after the OTA has reached the majority of daily actives, if the rolling
3-week sum of `purchase_completed` unique users is **≤ 2** — i.e. below the historical
floor — in **two consecutive non-overlapping** 3-week windows, then **re-present the
paywall post-onboarding at a gated moment** (an existing `feature_gate` placement, not a
new onboarding step).

**Do not revert the flow.** The three removed screens are justified independently of
revenue: `maintenance` converted 2 of 150 and `scan_receipt` 0 of 40. Reverting them
would trade a measured friction win for a paywall placement that can be restored on its
own.

### Why two windows, not one

At λ ≈ 5.4 purchases per 3 weeks, a Poisson draw of ≤2 occurs with probability ≈ **9.5%**
by chance alone, with no real change whatsoever. A single-window trigger would therefore
fire spuriously roughly one time in ten and produce a revert that the data never
justified. Requiring two consecutive non-overlapping windows drops the false-alarm rate
to ≈ **0.9%**.

This is the honest cost of operating at ~2 purchases a week: the stop-loss is slow
because the signal is thin. Anyone wanting a faster trigger should be told that a faster
trigger at this volume is indistinguishable from noise.

## Honest limits of this record

- The before/after read is **not** causal. Anything else changing in the same window
  (the 3.19.1 release, the corrected Play listings, seasonality) is confounded with the
  flow change. The cutover annotation records the boundary; it does not remove the
  confound.
- The power figures use the normal approximation for two proportions at 80% power. At
  these rates the exact binomial is somewhat less optimistic, so the durations above are
  **lower bounds** — the real waits are longer, which only strengthens the decline.
- `purchase_completed` is used as the trial-start proxy. If a trial-bearing package is
  ever separated from an outright purchase, this baseline needs recomputing before the
  trigger is applied.
