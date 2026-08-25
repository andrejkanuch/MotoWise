# Impression→page-view CTR: what the web-analytics series actually shows

**Date:** 2026-08-25
**Source:** first-party `asc web analytics metrics` (authenticated web session), App
Store only. Weekly buckets, 2026-03-16 → 2026-08-23.
**Verdict:** ⚠️ **No CTR regression is demonstrated.** An earlier draft of this document
claimed one. That claim was wrong and is retracted below, with the arithmetic that
refutes it, because it is a mistake this repo has now made twice.

## The retraction, first

The first version of this file claimed CTR "collapsed from ~18% to ~6% and never
recovered," anchored on two weeks:

| Week | Impressions | Page views | CTR |
|---|---|---|---|
| 2026-05-25 | 1,092 | 195 | 17.9% |
| 2026-08-17 | 1,028 | 65 | 6.3% |

Same impressions, one third the page views — which looks decisive. It is not, because
**there was never a stable ~18% regime to fall from.** Extending the series backwards
shows the pre-June period is violently unstable at low volume:

| Week | Impressions | Page views | CTR |
|---|---|---|---|
| 2026-03-16 | 230 | 3 | **1.3%** |
| 2026-03-23 | 335 | 93 | **27.8%** |
| 2026-03-30 | 185 | 31 | 16.8% |
| 2026-04-06 | 118 | 18 | 15.3% |
| 2026-04-13 | 91 | 10 | 11.0% |
| 2026-04-20 | 261 | 25 | 9.6% |
| 2026-04-27 | 232 | 16 | 6.9% |
| 2026-05-04 | 226 | 29 | 12.8% |
| 2026-05-11 | 218 | 31 | 14.2% |
| 2026-05-18 | 595 | 218 | **36.6%** |
| 2026-05-25 | 1,092 | 195 | 17.9% |

CTR ranges from **1.3% to 36.6%** across these weeks. Picking 05-25 as "the baseline"
is picking one point out of that spread. A 36.6% App Store search CTR is not a
plausible steady state for any app, which is itself the tell.

## What the series actually supports

Compare like with like — the trailing weeks either side of the 3.18.0 keyword release
(2026-07-29):

| Period | Weeks | CTR range | Rough mean |
|---|---|---|---|
| Six weeks before 3.18.0 | 06-15 → 07-20 | 5.7 – 11.2% | **~8.2%** |
| After 3.18.0 | 07-27 → 08-17 | 6.3 – 8.9% | **~7.4%** |

**Flat.** The difference is well inside the week-to-week spread. This *confirms* the
existing finding in `project_aso_snapshot_0824` — imp→PV 8.9% → 9.0%, ratios unchanged
while the funnel scaled — measured independently and from a different data source.

The step down therefore happens in **early June**, before the keyword change, out of a
volatile low-volume period and into a stable ~6–9% band that has held for eleven weeks.
The most economical explanation is **composition, not degradation**: the May spike weeks
(05-18, 05-25) carried unusually high-intent traffic — branded or referred visitors who
search the app by name and tap almost every time — while today's much larger impression
volume is broad keyword matching that converts at a normal-for-search rate. High CTR on
595 impressions and low CTR on 1,028 impressions can both be healthy; they are different
kinds of impression.

## The mistake, so it is not made a third time

`project_aso_snapshot_0824` already records a first pass of this analysis getting it
wrong in the *same direction* — reporting imp→PV "collapsing" 19.4% → 8.8% by diffing
against a Mar–Jun average inflated by low-denominator outlier weeks, with the stated
lesson: **never diff against a multi-month average when a trailing-window series is
available.**

This draft did not use an average. It picked two individual weeks, which is the same
error wearing a different hat: **anchoring on a favourable historical point instead of
the trailing window.** The general rule that covers both:

> Establish the baseline from the trailing window adjacent to the change, and only after
> checking that the window is stable. If the candidate baseline sits in a period whose
> week-to-week spread is wider than the effect being claimed, there is no baseline.

Volume-weight it, too: a 36.6% week on 595 impressions and a 1.3% week on 230 carry
almost no information individually.

## What does survive, and is still worth acting on

1. **Absolute page views are low and have not grown with impressions.** 195 page views
   in the week of 05-25 versus 65 in the week of 08-17 is a real, unexplained fact even
   though the *ratio* framing was wrong — impressions roughly tripled off the June trough
   while page views did not follow. Whether that is composition (likely) or a listing
   problem is exactly what STEP 5 is designed to read.
2. **The PPO experiment is still unread and still running at 66% traffic.** That remains
   worth the five-minute UI read — but on the original grounds (three months of accrual,
   directional only), **not** because a CTR collapse has been demonstrated. It has not.
   Nothing here justifies stopping `cc64b9d2` early.
3. **The two data sources disagree by ~8%, and that matters for STEP 5.** See below.

## Data-source caveat — the real STEP 5 problem

`docs/Activation-Store-Truth-Runbook-2026-08-24.md` STEP 5 records a pre-release weekly
impression series of **854** (Jul 27), **892** (Aug 3), **1,160** (Aug 10). This
document's `impressionsTotal` for the same weeks is **921 / 959 / 1,274** — consistently
~7–9% higher.

That is not data revision; it is too systematic. The two figures come from **two
different systems**:

- the **Analytics Reports API** (`asc analytics`, the `r14-WEEKLY` instances used for the
  ASO snapshots — see `reference_asc_analytics_pull`), and
- the **web dashboard endpoints** (`asc web analytics`, used here), which the CLI's own
  help explicitly describes as "separate from the official Analytics Reports API."

**Never mix them in one before/after comparison.** Pin one source and one measure key,
name it in the doc, and re-pull the baseline with the same command used for the
after-reading. Otherwise the 3.20.0 subtitle read starts with a built-in ~8% bias in
whichever direction the sources happen to differ.

Track `pageViewCount` next to impressions as well — point 1 above shows impressions alone
can rise while page views do not follow.

## Reproducing

```bash
# web dashboard source (this document)
asc web analytics metrics --app 6760291360 \
  --start 2026-03-16 --end 2026-08-23 --frequency week \
  --measures impressionsTotal,pageViewCount,units
```

Needs an authenticated web session (`asc web auth login --apple-id …`, interactive 2FA);
`asc web auth status` should report `{"authenticated":true}`. Apple rate-limits the whole
ASC API after a few hundred analytics calls, so batch measures into one call rather than
looping.
