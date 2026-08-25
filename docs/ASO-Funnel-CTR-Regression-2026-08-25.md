# The impression→page-view CTR has collapsed and has not recovered

**Date:** 2026-08-25
**Source:** first-party `asc web analytics metrics` (authenticated web session), App
Store only. 13 weekly buckets, 2026-05-25 → 2026-08-23.
**Status:** ⚠️ finding, with a leading hypothesis that is **not yet confirmed**. The
confirming read is UI-only (see "What would confirm it").

## The numbers

| Week | Impressions | Page views | Units | CTR (impr→PV) | PV→DL |
|---|---|---|---|---|---|
| 2026-05-25 | 1,092 | 195 | 51 | **17.9%** | 26% |
| 2026-06-01 | 731 | 132 | 34 | **18.1%** | 26% |
| 2026-06-08 | 430 | 50 | 11 | **11.6%** | 22% |
| 2026-06-15 | 508 | 29 | 16 | 5.7% | 55% |
| 2026-06-22 | 395 | 33 | 9 | 8.4% | 27% |
| 2026-06-29 | 361 | 30 | 10 | 8.3% | 33% |
| 2026-07-06 | 343 | 33 | 6 | 9.6% | 18% |
| 2026-07-13 | 546 | 61 | 12 | 11.2% | 20% |
| 2026-07-20 | 430 | 25 | 8 | 5.8% | 32% |
| 2026-07-27 | 921 | 67 | 18 | 7.3% | 27% |
| 2026-08-03 | 959 | 67 | 27 | 7.0% | 40% |
| 2026-08-10 | 1,274 | 114 | 39 | 8.9% | 34% |
| 2026-08-17 | 1,028 | 65 | 23 | 6.3% | 35% |

Same pattern on unique counts, so it is **not a counting artifact**: unique CTR runs
16.7% / 18.4% in late May, then 8.0% / 5.5% / 7.8% / 8.2% from 2026-06-08 onward, and
5.6% in the most recent week.

## The one comparison that matters

**2026-05-25: 1,092 impressions → 195 page views.**
**2026-08-17: 1,028 impressions → 65 page views.**

Essentially identical impression volume, **one third** the page views. Impressions fully
recovered from the June trough; CTR did not recover at all.

`PV→DL` held up (26% → 35%, if anything better). So the leak is specifically
**impression → page view**, i.e. people see the listing in search and do not tap.

## This corrects a previous conclusion

`project_aso_snapshot_0824` records that the funnel "scaled ×2.5 end-to-end after 3.18.0
keywords went live 07-29, conversion ratios FLAT." That is right for `PV→DL` and **wrong
for `impr→PV`**, which roughly halved. Reading the funnel as uniformly scaled hides the
regression, because impressions and downloads both rose while the middle step decayed.

## Leading hypothesis: the running PPO experiment

The cliff sits between the weeks of **2026-06-01 (18.1%)** and **2026-06-08 (11.6%)**,
landing inside the window of PPO experiment `060bdd96` "Title Test - Maintenance Angles"
(2026-05-29 → 2026-06-24, **75% traffic**). CTR never recovered afterwards, and experiment
`cc64b9d2` "Title Test" has been running since **2026-06-29 at 66% traffic** ever since.

So for nearly three months, most search traffic has been served a **non-control title**.
If the treatments underperform control, this is exactly the shape it would produce: normal
impressions, depressed tap-through.

### Why this reframes the PPO read

`outputs/MotoVault/03-testing/ppo-experiment-cc64b9d2-record.md` concludes the result is
statistically meaningless, on the grounds that detecting a **+20%** relative lift needs
~47,500 impressions per arm ≈ 4.3 years. That arithmetic is correct **for +20%**. It does
not apply here: the effect visible above is a **~60–65% relative decline**, which is an
order of magnitude larger and needs far fewer impressions to detect.

A test that cannot resolve a small win can still resolve a large loss. The read is
therefore worth doing — not to harvest a winner, but to check whether the experiment is
**actively costing page views** and should be stopped immediately rather than allowed to
run to its 2026-09-27 end date.

## Competing explanations, not excluded

Be honest that this is correlational:

1. **The 3.18.0 keyword change (2026-07-29)** could be buying broader, lower-intent
   impressions — more people see it, fewer want it. This predicts the *August* CTR level
   but **cannot** explain the June cliff, which precedes it by seven weeks.
2. **Composition shift from losing rank.** Impressions fell 3× into June; if the app lost
   high-intent branded/near-branded queries and kept broad ones, CTR falls without any
   listing change. The August recovery in impressions was driven by the keyword change, so
   the recovered impressions are not the same impressions.
3. **Trust.** 2★/1 rating suppresses tap-through, but that was equally true in May at 18%
   CTR, so it cannot explain a *change*.
4. **Seasonality.** Northern-hemisphere riding season peaks in May–June; May could simply
   be a high-intent month.

Explanations 1 and 2 are both plausible and both point at the **same corrective action**
as the PPO hypothesis: get the head terms into the fields that actually rank (STEP 5), and
stop paying for impressions that do not convert.

## What would confirm it

The decisive read is **UI-only** — no App Store Connect API exposes PPO results
(exhaustively established in the record file, including with an authenticated web session).
In App Store Connect → MotoVault → Product Page Optimization, for `cc64b9d2`:

- If **control** shows materially higher conversion than both treatments, the experiment is
  the cause. **Stop it immediately** — do not wait for 2026-09-27. At 66% traffic this is a
  live, ongoing cost.
- If the arms are indistinguishable, the cause is composition/keywords, and STEP 5 is the
  fix.

Read `060bdd96` in the same sitting; it covers the June cliff itself.

## Measurement caveat for STEP 5

`docs/Activation-Store-Truth-Runbook-2026-08-24.md` STEP 5 says to read the 3.20.0 subtitle
change against a recorded pre-release weekly impression series of **854** (Jul 27), **892**
(Aug 3), **1,160** (Aug 10).

Those numbers **do not reproduce**. `impressionsTotal` for the same weeks is **921 / 959 /
1,274** — consistently ~7–9% higher, which is too systematic to be data revision. The
recorded series was evidently pulled with a different measure key or aggregation.

**Pin the exact measure key before using any before/after comparison**, or the 3.20.0 read
starts with a built-in ~8% bias. Recommended: quote `impressionsTotal` *and*
`impressionsTotalUnique`, name the measure in the doc, and re-pull the baseline with the
same command used for the after-reading.

Also worth tracking `pageViewCount` alongside impressions, since this finding shows
impressions alone can rise while the funnel gets worse.

## Reproducing

```bash
asc web analytics metrics --app 6760291360 \
  --start 2026-05-25 --end 2026-08-23 --frequency week \
  --measures impressionsTotal,pageViewCount,units
```

Needs an authenticated web session (`asc web auth login --apple-id ...`, interactive 2FA);
`asc web auth status` should report `{"authenticated":true}`. Apple rate-limits the whole
ASC API after a few hundred analytics calls, so batch measures into one call rather than
looping.
