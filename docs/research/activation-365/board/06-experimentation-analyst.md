# 06 Data and experimentation analyst

First draft 2026-11-12, revised the same day after the Skeptic's rounds 1 and 2 (answers at the end). Round 2 added two read-only PostHog queries, `q06-r2-enrolment` (weekly completers and granted completers through 2026-11-08) and `q06-r2-tooshort-canonical` (the board's merged too-short trigger by build), and a second simulation, `r2sim` (power at the calendar cap, harm-rule error rates). Both are in Appendices A and B. Research and planning only: nothing in this file changed code, flags, PostHog, RevenueCat or GitHub.
Two read-only PostHog SQL queries were run for the first draft (weekly cohort table, notification-skip check). Their results are below, tagged `[SOURCE: PostHog q06-board-weekly]` and `[SOURCE: PostHog q06-board-notif-skip]`. The SQL is the same base CTE as `queries/q02-segments.sql`, grouped by `toStartOfWeek(fs, 1)`. Three more read-only queries were run for the revision, on the same cohort and exclusions: `q06-rev-tooshort-build` (the too-short guard by app build), `q06-rev-engaged` (day-2 engaged return) and `q06-rev-completers` (activation among onboarding completers). Their SQL is in Appendix B. The simulation behind every stopping-rule number is in Appendix A, so anyone can re-run it. Code references are to `origin/main` (5a497a1c). The local checkout (63e98d17) is behind it.

## Diagnosis

1. **Activation happens in the first 24 hours or it doesn't happen.** Of the 61 riders who did a core action in week 1, 40 did it within 1 hour and 56 within 24 hours [SOURCE: evidence pack §3; SOURCE: PostHog q06-board-weekly, `core_24h` summed = 56]. So "core action within 24 h of first open" captures 92% (56/61) of the week-1 metric, and it can be read 6 days sooner. **All 56 are onboarding completers**: no rider who left onboarding did a core action [SOURCE: PostHog q06-rev-completers]. So among the riders a post-onboarding test can enrol, the baseline is **56/367 = 15.3%**, not 7.1%.
2. **The first action that predicts return is a saved ride, and most first ride attempts fail.** Ride-first riders return on day 2 at 83% (20/24) and maintenance-first riders at 7% (1/15) [SOURCE: evidence pack §3]. But 66 of 103 riders who tapped Start saw "ride too short" [SOURCE: evidence pack §3, PostHog q05]. On builds **≥ 3.21.0** (#259, commit 54146980, 2026-10-04), `ride_too_short_shown` fires only when elapsed time is under 120 s, and longer rides with no distance go to `ride_zero_distance_shown` [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:55-67]. Before 3.21.0 the same event fired at any elapsed time. Split by the build of each rider's first sheet: on ≥ 3.21.0, 17 riders and **0** with a sheet at 120 s or more; on older builds, 49 riders and **9** with at least one sheet at 120 s or more (3 with only such sheets) [SOURCE: PostHog q06-rev-tooshort-build]. So "a stop within two minutes" holds for ≥ 3.21.0 only. For the older builds, 40 of 49 riders saw only sub-2-minute sheets, which still fits testing the button at home, and 02 shows most sheets came at under 10 m and 30 s [SOURCE: board/02-onboarding-ux.md, q-02a]. Any too-short analysis must be split by build. Also note the event fires once per *action* (`shown`, `keep`, `end`; `shown` exists only from 3.20.0), so sheet counts such as "221 times" count taps, not sheets. Count riders.
3. **Money is decided before activation can happen.** Every trial and the one web annual sale happened at hour 0 inside onboarding, before any core action [SOURCE: evidence pack §6]. Industry data shows the same pattern (see Findings F9). For experiment design, this means a change that starts *after* the onboarding paywall cannot change the initial purchase. It can only change cancellations and later renewals. That makes the paywall guardrail much easier to protect (P06.2).
4. **Our volume is too low for a classic A/B test of a modest effect, and the season is turning.** Installs fell from 70–90 a week in September to 41–53 a week in late October [SOURCE: PostHog q06-board-weekly]. A 50/50 test needs about 1,530 installs (about 235 days at 6.5 a day) to detect +50% on day-2 return, and about 540 installs (about 83 days) to detect a doubling of week-1 core action (computed below, F2). Any design we pick has to aim at large effects, or accept that it can only rule out harm.
5. **The weekly swing is sampling noise, not drift, so far.** Weekly day-2 return varies by 0.6× the variance expected from binomial noise alone, and weekly week-1 core action by 0.53× [SOURCE: PostHog q06-board-weekly; computation in F3]. So the 3%–12% weekly swing [SOURCE: evidence pack §2] is what you would expect from 40–90 installs a week. The weekly rate carries no information smaller than that. The bigger risk for a before/after comparison is the season: the mix of who installs in November (off-season in Europe and the northern US) differs from September.
6. **Several events measure something other than what their names suggest** (§9 review in F12). The most important: day-2 "return" also counts app opens caused by our own reminders, and its calendar day is UTC.

## Findings

**F1. Primary metric and leading indicator**
- Use **"core action within 24 h of first open" (`activation_24h`)** as the scoreboard metric for the whole funnel, with **day-2 return** as the metric issue #365 names. Baseline per install: 56/793 = **7.1%** [SOURCE: PostHog q06-board-weekly]. Day-2 return: 72/793 = **9.1%** [SOURCE: evidence pack §2]. Per onboarding completer (the population a post-onboarding test enrols): `activation_24h` **56/367 = 15.3%**, week-1 core action **61/367 = 16.6%**, week-1 saved ride **27/367 = 7.4%** [SOURCE: PostHog q06-rev-completers].
- A **single test's** primary metric is chosen per test and written in the P06.1 ledger (table there). It is not always `activation_24h`: a test that deliberately moves the first ride past 24 h needs a 7-day window, and a day-1 message needs a day-2 metric that does not count its own taps.
- Why this metric leads D7: riders who saved a ride first reached D7 at 54% (13/24), and riders with no week-1 core action at 4.6% (32/690) [SOURCE: evidence pack §3]. A ride on day 0 led to day-2 return for 11 of 13 riders [SOURCE: evidence pack §3].
- How to choose an activation metric: write 5–10 candidate definitions and check each for reach and retention. A definition where "only 1% activate, and 100% of those 1% retain" is too narrow [SOURCE: https://posthog.com/handbook/growth/growth-engineering/per-product-activation — "only 1% activate, and 100% of those 1% retain" (PostHog handbook (vendor), undated)]. A good activation metric is "causal for your retention, not just correlative", which needs an experiment to show [SOURCE: https://www.lennysnewsletter.com/p/how-to-determine-your-activation — "causal for your retention, not just correlative" (Lenny's Newsletter, 2022-11-08)].
- Caveat: our ride–return link is partly selection, because people who ride at all are riders [SOURCE: evidence pack §3]. Pushing more riders to *a* ride should therefore lift return by less than 83% vs 5.7% suggests. [UNBACKED — own idea] I would expect a real but much smaller causal effect. No number is available.

**F2. Sample sizes from our baselines** (two-sided α = 0.05, power 0.8, 50/50 split, normal approximation; my computation from evidence-pack baselines; 6.5 installs a day ≈ recent weekly volume [SOURCE: PostHog q06-board-weekly])

| Metric (baseline) | Lift to detect | Installs needed (both arms) | Days at 6.5 a day |
|---|---|---|---|
| day-2 return (9.1%) | +25% → 11.4% | 5,572 | ~857 |
| day-2 return (9.1%) | +50% → 13.7% | 1,528 | ~235 |
| day-2 return (9.1%) | ×2 → 18.2% | 446 | ~69 |
| week-1 core action (7.7%) | +50% → 11.5% | 1,842 | ~283 |
| week-1 core action (7.7%) | ×2 → 15.4% | 540 | ~83 |
| activation_24h (7.1%) | ×2 → 14.1% | 594 | ~91 |
| day-2 return among onboarding completers (15.8%) | ×2 → 31.6% | 226 completers | ~76 (only 46% complete) |

Only a doubling can be detected within one quarter. A 25–50% lift, which is a more typical result for one change [UNBACKED — own idea], cannot be detected at all this season.

**F3. The weekly swing is binomial noise.** Over the 11 full install weeks (08-17 → 10-26), the variance of weekly day-2 return is 0.00077, against 0.00128 expected from binomial noise (ratio 0.60). For week-1 core action the figures are 0.00060 against 0.00114 (ratio 0.53) [SOURCE: PostHog q06-board-weekly; my computation]. So pooling several weeks into one before or after window is fine, as long as nothing else changed at the same time. With 4 weeks before and 4 after (~190 installs each), the smallest detectable change is ×2.2 for core action and ×2.1 for day-2 return. With 8 weeks each side (~380), it is ×1.8 and ×1.7 [my computation].

**F4. Peeking breaks fixed-sample tests, and this matters because we will peek.** "Repeated significance testing always increases the rate of false positives". With 10 peeks, a nominal 1% is really about 5% [SOURCE: https://www.evanmiller.org/how-not-to-run-an-ab-test.html — "what you think is 1% significance is actually just 5% significance" (Evan Miller, undated)].

**F5. A simple sequential test fits our volume.** Evan Miller's procedure: fix N (a cap on total *successes* in both arms), stop and ship if T − C ≥ 2√N, stop with no winner if T + C = N. It can "reduce the number of observations required … by 50% or more", but a no-effect test "will take longer to complete" [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — "reduce the number of observations required for a successful experiment by 50% or more" (Evan Miller, 2015-10-13)]. Simulation, 4,000 runs per cell, treatment = 2× control, script in Appendix A [UNBACKED — own simulation]. The first draft simulated a 7.7% control and called it `activation_24h`; 7.7% is week-1 core action. Re-run here at the two correct `activation_24h` baselines:

| Enrolled population (baseline, enrolment rate) | N | Ship if T − C ≥ | Power for ×2 | Median enrolled when it ships | False positives, no effect | Median time to stop when there is no effect |
|---|---|---|---|---|---|---|
| all installs (7.1%, 6.5/day) | 36 | 12 | 0.62 | 239 (~37 days) | 4.1% | ~77 days |
| all installs (7.1%, 6.5/day) | 64 | 16 | 0.83 | 377 (~58 days) | 4.4% | ~137 days |
| all installs (7.1%, 6.5/day) | 100 | 20 | 0.95 | 515 (~79 days) | 4.3% | ~214 days |
| onboarding completers (15.3%, 3.0/day) | 64 | 16 | 0.82 | 175 (~58 days) | 4.8% | ~138 days |

The calendar time is the same for both populations because every activation comes from a completer (Diagnosis 1): enrolling completers only removes riders who could never succeed. So N = 64 still gives about 0.83 power in about 58 days when the effect is a doubling. The new fact is the last column: **with no effect, the test runs about 4.5 months before it stops**. Pre-register a calendar cap as well (P06.2). The owner can look every day without inflating false positives. **These powers assume the test runs until it stops on its own.** With the 2026-03-31 calendar cap and a December launch, power is lower for the smaller populations. The capped figures in P06.2 are the ones to pre-register (R2.1).

**F6. Always-valid p-values are the general form of this.** Johari et al. define "always valid p-values and confidence intervals" that stay valid whenever the user chooses to stop [SOURCE: https://arxiv.org/abs/1512.04922 — "always valid p-values and confidence intervals" (Johari, Pekelis, Walsh, arXiv 2015, rev. 2019)]. Optimizely has used this method (mSPRT) since January 2015 [SOURCE: https://blog.acolyer.org/2017/09/28/peeking-at-ab-tests-continuous-monitoring-without-pain/ — "no matter when the user chooses to stop the test" (The Morning Paper, 2017-09-28)]. For a two-arm binary metric, Evan Miller's rule is enough. mSPRT is the upgrade if we ever need confidence intervals.

**F7. PostHog's Bayesian "chance to win" does not protect against peeking.** PostHog experiments use a Bayesian engine with non-informative priors. They require at least 50 exposures per variant and at least 5 conversions, and they apply "no correction for multiple comparisons". The docs say nothing about peeking [SOURCE: https://posthog.com/docs/experiments/statistics — "at least 50 exposures per variant" (PostHog docs (vendor), undated)]. Spotify: a flat prior with posterior-probability stopping "reproduces the false positive rate of frequentist peeking" [SOURCE: https://engineering.atspotify.com/2026/9/why-spotify-is-not-using-bayesian-a-b-testing/ — "reproduces the false positive rate of frequentist peeking" (Spotify Engineering, 2026-09-08)]. Same conclusion from a testing-tool vendor, which cites a Bayes-factor stopping simulation with about 3.33× higher type I error than fixed horizon [SOURCE: https://blog.analytics-toolkit.com/2017/bayesian-ab-testing-not-immune-to-optional-stopping-issues/ — "about 3.33 times higher type I error" (Analytics-Toolkit (vendor), 2017, upd. 2019-05-21)]. → Use PostHog Experiments to assign and log exposure, but make the decision with the pre-registered sequential rule from SQL, not with "chance to win".

**F8. Variance reduction is limited for new users. Stratification still helps.** CUPED needs pre-experiment history. For onboarding tests "there is no prior data to leverage, just the assignment dimensions". Eppo also uses assignment properties as covariates [SOURCE: https://docs.geteppo.com/statistics/cuped/ — "there is no prior data to leverage, just the assignment dimensions" (Eppo docs (vendor), undated)]. Our usable assignment dimensions are platform (iOS day-2 12.7% vs Android 7.7%), onboarding arm (`onboarding_variant`, a super property, [SOURCE: apps/mobile/src/lib/onboarding-experiment.ts:60-64]) and region [SOURCE: evidence pack §2, §4]. Stratify on these, and report results per stratum as well as pooled.

**F9. Money happens on day 0 everywhere, not only for us.** "82% of trial starts occur the same day a user installs an app". The median trial start rate is 6.2%, and p90 is 20.3% [SOURCE: https://www.revenuecat.com/state-of-subscription-apps-2025 — "82% of trial starts occur the same day a user installs an app" (RevenueCat (vendor), 2025)]. This covers all categories and applies to us: a post-onboarding activation test cannot move trial *starts*. It can move trial *cancels* and later conversions, and at our volume those are 15 trials in 12 weeks [SOURCE: evidence pack §6]. No test can power them, so guardrails have to be protected by design (P06.2), not by statistics.

**F10. Guardrails: show no harm, don't search for wins.** Spotify ships only if the treatment is better on a success metric and "significantly non-inferior on all guardrail metrics" [SOURCE: https://engineering.atspotify.com/2024/03/risk-aware-product-decisions-in-a-b-tests-with-multiple-metrics — "Ship if and only if" (Spotify Engineering, 2024-03-05)]. Sample-ratio mismatch (SRM) is a trust guardrail. Ratio metrics "can be misleading or potentially invalid if the denominator of the metric changes" [SOURCE: https://blog.acolyer.org/2017/09/25/a-dirty-dozen-twelve-common-metric-interpretation-pitfalls-in-online-controlled-experiments/ — "Ratio metrics can be misleading or potentially invalid if the denominator of the metric changes" (The Morning Paper on Dmitriev et al. KDD 2017, 2017-09-25)]. At our volume no non-inferiority test can pass on trials. So the guardrails become (a) designed so the paywall cannot be affected, (b) SRM per platform and region, and (c) a manual red-flag rule (P06.2).

**F11. Before/after (interrupted time series) is legitimate, but the season is exactly its weak spot.** Interrupted time series is "one of the strongest evaluative designs when randomization is not possible". Its threats are time-varying confounders, co-interventions and seasonality when the seasons before and after the change are unevenly split. The model should be specified in advance [SOURCE: https://academic.oup.com/ije/article/46/1/348/2622842 — "ITS analyses are one of the strongest evaluative designs when randomization is not possible" (Bernal, Cummins, Gasparrini, Int J Epidemiol, 2017)]. Our install volume halved between September and November [SOURCE: PostHog q06-board-weekly]. A November-vs-September comparison mixes the change with the season. → Before/after only for no-harm changes judged on guardrails (P06.3), never to claim a lift this winter.

**F12. Switchback designs don't fit this problem. Neither does interleaving.** A switchback alternates the treatment over time for one unit, and the main design issue is carryover, "the length of time a treatment persists in impacting the outcome" [SOURCE: https://arxiv.org/abs/2009.00148 — "the length of time a treatment persists in impacting the outcome" (Bojinov, Simchi-Levi, Zhao, arXiv 2020, rev. 2025)]. It exists for marketplaces with interference between users, which we don't have. Our unit (one install) can be randomized directly. A week-on/week-off schedule would give only about 6 blocks per arm per quarter. The one exception is a change that cannot be flagged per install, such as a store listing or a web landing change. [UNBACKED — own idea] Interleaving compares two ranked lists shown to the same user, and we have no ranked list in onboarding.

**F13. Benchmarks for scale, with caveats.** Average Android app: D1 29.17%, D7 17.28%. Top 10 apps: D1 74.67% [SOURCE: https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/ — "D1 29.17%" (Andrew Chen using Quettra data, ~mid-2015)]. It does not transfer cleanly. The data is from 2015, covers all categories (games, social, messaging), is Android only, and defines D1 differently from our calendar day 2. A seasonal motorcycle utility used when riding should have a lower daily cadence [UNBACKED — own idea]. I would not use 29% as a target, only to show that our 9.1% is low on any scale.

**F14. Review of evidence-pack §1/§9 events: missing or misleading**
- **Correction to the pack: "Not now" on the notifications step is tracked.** `handleSkip` sends `onboarding_step_completed {step:'notifications', skipped:true, permission_granted:false}` [SOURCE: apps/mobile/src/app/(onboarding)/notifications.tsx:207-213]. In PostHog: 224 riders skipped, 198 granted, 9 tapped Enable but were not granted (2026-08-14 → 11-12, all app persons, test accounts not removed) [SOURCE: PostHog q06-board-notif-skip]. So the grant rate among riders who answered is about 46%, not about 96%. Only `notification_permission_result` is missing on the skip path. No new event is needed: use `onboarding_step_completed.skipped`.
- **Day-2 return includes returns we caused ourselves.** Any `Application Became Active` counts [SOURCE: evidence pack §0], and that includes opens from the forgotten-ride reminder [SOURCE: evidence pack §3 caveat]. A day-1 notification test would then win partly by counting its own taps. Fix: a second metric, **day-2 engaged return**, defined exactly as follows (SQL in Appendix B):
  - day-2 return as in the pack (calendar day after first seen, UTC), **and** on that day either a core action, or a `$screen` whose `$screen_name` is **not** in this list: home `/`, `/(tabs)/(home)`, `/(tabs)`; What's New `/whats-new`, `/(modals)/whats-new`; onboarding and sign-in `/login`, `/account`, `/commitment`, `/goals`, `/reveal`, `/bike-setup`, `/personalizing`, `/notifications`, `/paywall`, `/heard-about`, `/experience`, `/welcome`, `/consent`, `/no-bike-value`, and any name starting with `/(onboarding)` or `/(auth)`. The list covers both name formats seen in the cohort (`/goals` and `/(onboarding)/goals`) [SOURCE: PostHog q06-rev-engaged, all `$screen_name` values on day 2].
  - Baselines [SOURCE: PostHog q06-rev-engaged]: all installs **39/793 (4.9%)**; onboarding completers **37/367 (10.1%)**; completers who granted notifications **23/171 (13.5%)**. Strict version (core action on day 2): 18/793, 18/367, 12/171. Raw day-2 return for the same groups: 72, 58, 35. Day-2 returns with a `reminder_opened` that day: 2.
  - `reminder_opened` is still reported separately.
- **"Day 2" is the next UTC calendar day.** [UNBACKED — own idea] A US rider who installs at 7 pm Pacific time is already on the next UTC day. Their "day 2" therefore starts 5 hours later and lasts 24 hours, so the window differs by region. Fix: also report "returned 24–48 h after first open", which is region-neutral. Baseline: 42/793 all, 34/367 completers, 21/171 granted completers [SOURCE: PostHog q06-rev-engaged].
- **Push tokens: 57 in the DB vs 176 permission grants in PostHog — explained.** Android has no FCM configuration, so it has never stored a token, and all 105 tokens ever stored are iOS [SOURCE: evidence pack §8b; push-tokens-investigation.md]. Rule now: **server push** experiments are out until Android FCM ships (P04.2); **local** notifications need only the OS permission and are fine to test [SOURCE: board/04-lifecycle-crm.md, answer on the token gap, citing apps/mobile/src/lib/notifications.ts:124-127].
- **The paywall-seen rate per install week ranges from 10/72 to 46/83** [SOURCE: PostHog q06-board-weekly]. That is far outside binomial noise and probably reflects arm or placement changes. Any guardrail on "paywall viewed" must be read per `onboarding_variant`, never pooled.
- **Still missing:** `post_onboarding_landed {screen, variant}`; `max_speed_kmh` on `ride_too_short_shown` (`elapsed_s` and `distance_m` are already sent on every action [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:220-252 on origin/main], so the pack's §9 row is only partly open); `is_first_garage_bike`; an experiment exposure event that fires at the *assignment point* of any activation test [SOURCE: evidence pack §9].
- **Consent:** EEA riders who decline analytics are invisible [SOURCE: evidence pack §1]. A test read in PostHog is therefore "of consenting riders". The onboarding experiment already draws a local arm for pre-consent installs [SOURCE: apps/mobile/src/lib/onboarding-experiment.ts:24-33]. Any new activation flag should reuse that pattern so that Europe is not all in one arm.

## Proposals

### P06.1 Activation scoreboard and pre-registration (measurement before experiments)
- **Hypothesis:** with one primary metric, a 24-hour readout and correct events, the board's experiments can be judged in weeks, not quarters, and without false wins from reminder taps or UTC days.
- **Exact change:**
  1. Define and save in PostHog (owner-approved writes, not done here) a weekly install-cohort table: `n`, `ob_done`, `activation_24h`, `core_w1`, `day2_return`, `day2_engaged_return` (definition in F14), `return_24_48h`, `D7`, split by `platform` and `onboarding_variant`, with completers as a second denominator. The SQL is the q02 base CTE grouped by week plus the Appendix B join.
  2. Add events (one small mobile PR): `post_onboarding_landed {screen, onboarding_variant}` in the first route after `personalizing`; `max_speed_kmh` on `ride_too_short_shown` (`elapsed_s` and `distance_m` already exist); `is_first_garage_bike` on `garage_bike_added`; `activation_exposure {experiment, arm}` at the assignment point of any activation test. Add a `$screen_name` allow-list test or constant for the home/onboarding route names, so the F14 list cannot drift silently when routes are renamed [UNBACKED — own idea].
  3. One `docs/research/activation-365/experiments.md` ledger. Before launch, each test writes down **one** primary metric with its baseline in the enrolled population, N, the stopping rule, a calendar cap, strata, guardrails and review triggers [SOURCE: https://academic.oup.com/ije/article/46/1/348/2622842 — model "specified a priori" (2017)]. Starting entries, one primary each:

**Slot decision (R2.2): one bundle in the slot.** The randomized slot holds **one bundle**: the first-session package (plan sheet + too-short sheet + in-context permission ask: P01.1, P02.1/P02.2, P03.1/P03.2, P05.1) **and** the day-1 local nudge (P04.1 / P01.2) as the in-arm fallback for riders who set no plan, all behind the one flag `activation_365_first_session`. Assignment is at `onboarding_completed` for **all** completers. This is option (a)/(c) in the review, and it matches 02's design. 01's order (P01.1, then P01.2) and 04's "granted completers only" are superseded for the slot. The reasons, from the capped simulation in P06.2:
- The nudge alone reaches only 0.17–0.26 power by 2026-03-31 at N = 64. The bundle reaches 0.83.
- The nudge alone would block the package all winter, under P06.3's rule.
- Assigning all completers removes R3's problem: the package's permission ask no longer changes who is eligible.

The cost is attribution. A win shows that the bundle works, not which part. The mechanism events (`reminder_opened {kind, source}`, `ride_too_short_shown {action}`, `post_onboarding_landed`) give a partial within-arm split, which is descriptive only [UNBACKED — own design].

**Canonical definitions (supersede the other files' figures, R2.3).**
- **Too-short trigger:** a `ride_too_short_shown` with `action = 'shown'`, `distance_m < 10` and `elapsed_s < 120` (the too-short branch, not `isNoGpsRide`) [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:55-67, 214-226 on origin/main], for a rider with no saved real ride before it, on any day, every sheet. Baseline: the rider's first such sheet on a build ≥ 3.21.0, then a real ride saved within 7 days: **1/13** (sheets 2026-10-06 → 11-04) [SOURCE: PostHog q06-r2-tooshort-canonical]. This agrees with 02's q-02c (1/13). The figures 11/49 (01), 11/45 (02, all builds), 11/46 and 1/14 (05), and my own earlier 1/10 and 6/44 (first sheet on day 0) are superseded. Older builds cannot be cut the same way, because `action:'shown'` only exists from 3.20.0.
- **Day-2 engaged return:** the F14 list and the Appendix B SQL only. Baseline: 23/171 granted completers and 37/367 completers. 04's shorter list (23/171) and 01's list with unmapped platform (26/171) are superseded.
- **Week-1 core action:** a core action within 7 days of first open. This is the q02 core-event set, with `below_min_ride` rides excluded. Baseline 61/367 among completers.

| Test | Path | Enrolled at | Primary (baseline) | `activation_24h` role | Other metrics |
|---|---|---|---|---|---|
| **Bundle: first-session package + day-1 nudge fallback** | P06.2 randomized slot | `onboarding_completed`, all completers | week-1 core action among completers (61/367 = 16.6%) | **diagnostic only, neither primary nor guardrail**: the package deliberately moves the first ride past 24 h | week-1 saved ride (27/367 = 7.4%); day-2 engaged return (37/367; 23/171 in the granted stratum); permission grant rate; too-short trigger → ride within 7 days (1/13), descriptive only |
| Day-1 nudge alone | not run this winter (inside the bundle) | — | — | — | if it ever runs alone: day-2 engaged return, granted completers, 23/171 |
| Android FCM (P04.2) | P06.3 | n/a (infrastructure) | harm check, P06.3 rule | harm check | tokens stored per Android grant |
- **Target metric:** none directly. It makes `activation_24h` (7.1% per install, 15.3% per completer) and day-2 return (9.1%) trustworthy.
- **Expected effect:** no change to riders. It removes two known biases: reminder taps counted as returns, and UTC-day windows [UNBACKED — own idea].
- **Effort:** S (events) + S (saved queries).
- **Risk to onboarding paywall:** none. The events fire after `onboarding_completed` or on the ride HUD.
- **Measurement at ~7 installs/day:** this proposal *is* the measurement. Check that events arrive by comparing the counts with the DB for a week, the q08 cross-check [SOURCE: evidence pack §8b].
- **Light/dark:** no UI.

### P06.2 Concurrent-control holdout with sequential stopping for the board's one randomized test
- **Hypothesis:** the bundle in the single randomized slot (P06.1 slot decision) doubles week-1 core action among completers. Only a doubling can be detected this season (F2). The first revision recommended the day-1 nudge alone. Simulated at the calendar cap, the nudge alone cannot be read in time, so I withdraw that recommendation (R2.1, R2.2).
- **Exact change (design, not the feature):**
  - New PostHog flag `activation_365_first_session` (arms `control` / `test`, 50/50). It is **assigned at `onboarding_completed`, after the onboarding paywall has been shown or skipped**, for every completer. Permission status is a stratum, not an eligibility filter. The arm is drawn locally for pre-consent installs and the exposure is flushed later, the same pattern as `onboarding-experiment.ts:24-33`. Fire `activation_exposure`.
  - Stratify the analysis on `platform` × `onboarding_variant` (`garage_first` / `commit_first`) [SOURCE: https://docs.geteppo.com/statistics/cuped/ — assignment properties as covariates (vendor)]. The paywall A/B and RevenueCat `expd7c1d56904` keep running untouched. The new flag is crossed with them (factorial), never nested.
  - **Primary metric:** week-1 core action among completers (16.6%), as in the P06.1 ledger. Stratum report: granted / not granted × platform × `onboarding_variant`.
  - **Stopping rule:** Evan Miller sequential with N = 64 successes on the primary. Ship if T − C ≥ 16. Stop with no winner when T + C = 64 [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html (2015)]. **Calendar cap:** enrolment stops 2026-03-24, so every enrolled rider has a full 7-day window, and the readout is on 2026-03-31 whatever the count. Look daily. The decision comes from the rule, not from PostHog's "chance to win" (F7).
  - **Power at the cap, pre-registered (R2.1).** Stated launch: **2026-12-15**. It needs a build or OTA and 04's Android device gate first. The window is 99 enrolment days for a week-1 metric and 104 for a day-2 metric. Winter enrolment: 3.0 completers/day and 1.4 granted completers/day. Observed in the last four full weeks (10-12 → 11-08) were 112 completers (4.0/day) and 44 granted completers (1.6/day) [SOURCE: PostHog q06-r2-enrolment], so 3.0 and 1.4 are deliberately conservative for December–March [UNBACKED — own assumption]. Simulated with 4,000 runs, treatment = 2× control [UNBACKED — own simulation, Appendix A `r2sim`]:

    | Occupant (primary, baseline) | Enrolment | N | Power for ×2 by the cap | False positives by the cap | ±90% interval half-width of the difference at the cap |
    |---|---|---|---|---|---|
    | **Bundle** (week-1 core action, 16.6%) | 3.0/day → ~297 | 64 | **0.83** | 2.1% | ±7.1 pts |
    | Bundle | 4.0/day → ~396 | 64 | 0.84 | 4.4% | ±6.2 pts |
    | Bundle, winter baseline 25% lower (12.4%) | 3.0/day | 64 | 0.71 | 0.7% | ±6.3 pts |
    | Bundle | 3.0/day | 36 | 0.62 | 4.2% | ±7.1 pts |
    | Nudge alone (day-2 engaged, 13.5%) | 1.4/day → ~145 | 64 | 0.17 | 0.0% | ±9.3 pts |
    | Nudge alone | 1.6/day → ~166 | 64 | 0.26 | 0.1% | ±8.7 pts |
    | Nudge alone | 1.4/day | 36 | 0.42 | 0.9% | ±9.3 pts |
    | Nudge alone, winter baseline 25% lower | 1.4/day | 36 | 0.21 | 0.2% | ±8.2 pts |

    The "25% lower" rows are a sensitivity check. We have no winter data, because the app has no previous December–March cohort of this size [UNBACKED — own assumption]. Fewer people ride in the European and northern-US winter, so a ride-led core action may fall. A concurrent control keeps the comparison fair, but the test gets slower. **The 0.83 that 01 and 04 quoted for the nudge is not achievable by the cap.** It was the uncapped figure.
  - **What a capped readout can and cannot say.**
    - *Can:* (1) "doubling shown" if the rule fires; (2) the observed difference with a 90% interval of about ±7 points on a 16.6% baseline; (3) a no-harm statement if the interval's lower bound is above about −7 points.
    - *Cannot:* rule out a real lift of up to about +40% relative (≈ +7 pts) when the rule has not fired. A capped "no winner" means "no doubling shown", never "no effect". It cannot say which part of the bundle worked.
    - What happens after a capped "no winner" is the owner's call, written down before launch. My default: keep the bundle if the interval's lower bound is above −3 pts and the qualitative signals (P06.3) are not negative. Otherwise revert [UNBACKED — own rule].
  - **Guardrails (by design, F9–F10):** (a) assignment after the paywall means trial starts *cannot* differ, so check that `paywall_viewed` and trial starts by arm are equal as a randomization check, not as an outcome; (b) SRM χ² per platform and region weekly (Kohavi-style trust guardrail). An SRM failure or a crash-rate jump in the test arm is the only **automatic stop**.
  - **Manual review triggers (not kill rules).** At this volume a rider-count gap is mostly noise, so these only prompt the owner to look at the riders involved; they never stop the test by themselves. Simulated false-alarm rate with no effect, at any daily look [UNBACKED — own simulation, Appendix A; inputs: 15 trials per 367 completers with 3 of 4 cancelled → ~3.1% "trial cancelled within 3 days" per completer, day-2 return 15.8% per completer, evidence pack §2, §6]:

    | Trigger | 60 per arm | 100 per arm | 150 per arm |
    |---|---|---|---|
    | test-arm trial cancels within 3 days exceed control by ≥ 2 (first draft) | 30% | 42% | 51% |
    | same, by ≥ 4 | 4% | 11% | 19% |
    | test-arm day-2 return trails control by ≥ 6 (first draft) | 17% | 29% | 38% |
    | same, by ≥ 10 | 2% | 8% | 15% |

    Use the ≥ 4 and ≥ 10 thresholds. Even these fire by chance 1 time in 7–10 by 100–150 riders per arm, which is why they are review prompts. Revenue is read in RevenueCat, not PostHog [SOURCE: evidence pack §6].
- **Target metric with baseline (in the enrolled population):** bundle: week-1 core action among completers 16.6% → 33% (×2). Secondary: day-2 engaged return among completers 10.1% (37/367), and 13.5% in the granted stratum. `activation_24h` 15.3% per completer is diagnostic only (ledger).
- **Expected effect:** UNBACKED. The ×2 is the *detectable* effect, not a forecast. Upper bound of plausibility: ride-first riders return on day 2 at 83% vs 5.7% for riders with no core action, but much of that is selection [SOURCE: evidence pack §3].
- **Effort:** M (flag plus assignment plumbing, reusing the onboarding-experiment pattern; the feature itself is costed by its owner).
- **Risk to onboarding paywall:** low by construction (post-paywall assignment). The remaining risk is that a day-1 change prompts trial cancels, which the cancel review trigger watches.
- **Measurement at ~7 installs/day:** as above, with the capped powers in the table. These use winter rates, not the August–November averages. A concurrent control is not biased by the season, only slowed by it.
- **Light/dark:** the design itself has no UI. The tested feature must pass light and dark mode before launch (owner rule).

### P06.3 Ship-on-no-harm path for small, cheap changes, judged before/after against a trailing 8-week window
- **Hypothesis:** some changes are cheap, low-risk and not worth a 60-day flag test. They should ship and only be checked for harm. Pending example: **Android FCM** (P04.2), which only adds server push reach and should not change first-session behaviour [SOURCE: board/04-lifecycle-crm.md P04.2]. The too-short sheet is no longer an example, because it is now part of the P06.2 bundle (R2.2). (The first draft's example, hiding What's New for new riders, is already live since 3.25.0: 0 of 90 completers saw it after 10-12 [SOURCE: apps/mobile/src/app/(onboarding)/personalizing.tsx:191 on origin/main; board/02-onboarding-ux.md q-02b].)
- **Exact change:** a pre-registered before/after ledger entry per change: ship date, 8-week trailing baseline (the comparison window must start after 2026-10-07, so both are under the same onboarding arms), the after-windows, the metrics, and the **harm rule only**, written exactly (R2.4):
  - **Metrics:** `activation_24h` per install (before-window baseline about 7.1%) and day-2 return per install (about 9.1%).
  - **Looks:** exactly two, at 4 weeks and at 8 weeks after the ship date. Each look compares the after-window so far with the fixed 8-week before-window. No other looks count.
  - **Rule:** at each look, for each metric, compute d = after − before and its standard error with the unpooled normal approximation. **Revert if the upper bound of the 90% two-sided interval for d is below 0**, i.e. d + 1.645·SE < 0. That is a one-sided 5% test per metric per look.
  - **Error rates** at about 7 installs a day (392 before, 196 / 392 after), simulated [UNBACKED — own simulation, Appendix A `r2sim`]:
    - With no change and both metrics treated as independent (the conservative case), the false-revert rate over all 4 checks is **16%**.
    - Probability of reverting a real harm: 86% if day-2 return halves (9.1% → 4.55%), 79% if `activation_24h` halves, 52% for a 30% drop in day-2 return.
    - For comparison, the 80% interval the first revision named gives a 29% false-revert rate over the same 4 checks (10% for a single look on a single metric). That is too high for a revert rule.
  - A revert is a ledger entry with the numbers, not a silent rollback. A rider-visible revert also needs the qualitative check below.
  - Include a calendar-matched check against last year's same weeks where data exists, and the install-volume trend as a season marker [SOURCE: https://academic.oup.com/ije/article/46/1/348/2622842 — seasonality and co-interventions as main threats (2017)].
  - **Concurrency rule (revised, R2.2):** only **one** before/after change in flight at a time. While P06.2 runs, a change to the **first session** (onboarding end → first week's Home, ride HUD, reminders) ships only inside the bundle's test arm. A change that reaches **both arms equally**, such as Android FCM, may ship during P06.2. Randomization protects the concurrent comparison from it. It is logged in the ledger with its date, and the P06.2 readout is also cut before and after that date.
- **Target metric:** day-2 return 9.1% and `activation_24h` 7.1% as **harm checks**, not lift claims. With 8 weeks per side, the smallest detectable change is ×1.7–1.8 (F3), so a lift will not be claimed.
- **Expected effect:** none claimed. This path exists to stop cheap changes from taking up the only randomized slot [UNBACKED — own idea].
- **Effort:** S per change (a ledger entry plus a re-run of the P06.1 query).
- **Risk to onboarding paywall:** none if the changes are after `onboarding_completed`. Any change inside onboarding is excluded from this path, because the paywall A/B makes it non-comparable.
- **Measurement at ~7 installs/day:** pooled-window comparison is fine because weekly variance is binomial (F3). Add a qualitative signal: watch the session replays of 10 riders after each change (if replay is enabled; not verified) [UNBACKED — own idea].
- **Light/dark:** FCM has no UI. Any first-session UI goes through P06.2 and must pass light and dark mode before launch (owner rule).

## What I'd NOT do, and why
- **No test of the day-1 nudge on its own this winter.** By the 2026-03-31 cap it reaches 0.17–0.42 power for a doubling (P06.2 table). It runs inside the bundle instead.
- **No classic 50/50 test powered for +20–30%.** It needs 5,500+ installs, more than two years at our volume (F2).
- **No decisions on PostHog "chance to win" or "significant" badges after daily looks.** A flat-prior Bayesian rule plus peeking behaves like naive peeking (F7).
- **No before/after claim of a *lift* this winter.** Install volume halved from September to November, and seasonality is the main threat to such a comparison (F11). Before/after is for harm checks only (P06.3).
- **No server-push experiment until Android FCM ships (P04.2), and no day-1 notification test judged on raw day-2 return** (F14). The token gap is explained: Android has no FCM, so server push reaches iOS only. Local notifications are fine to test, judged on day-2 engaged return so the test does not count its own opens.
- **No D7 or revenue as the primary metric.** D7 at 6.7% with a 13-day lag, and 15 trials a quarter, can't support a decision in time. Revenue moves at hour 0, before activation (F9).
- **No switchback or interleaving.** There is no interference between users and no ranked list. The install is the natural unit to randomize (F12).
- **No nesting the activation test inside one onboarding arm, and no pausing of `onboarding_paywall_2026q4` or `expd7c1d56904` to free traffic.** Crossing the two (factorial) costs nothing at this effect size. The paywall tests are revenue-critical and must keep running (hard constraint).
- **No mixing of maintenance logging into "activation" for the web-schedule audience without a separate metric.** Maintenance-first riders return at 7% [SOURCE: evidence pack §3]. If the board targets them, measure them as their own stratum, or a winning ride change could hide a losing maintenance change [UNBACKED — own idea].

## Responses

Written after reading drafts 01–05. **Superseded in part by round 2:** the slot now holds the bundle (P06.1, R2.2); R1's too-short baseline is replaced by the canonical 1/13 (R2.3); R2's nudge-alone recommendation and its uncapped powers are withdrawn (R2.1); R3's "ship the permission ask before or after the nudge test" no longer applies, because the ask is inside the bundle. The text below is kept as it was written, so the reasoning can be traced. One more read-only PostHog query was run for this section (same cohort and exclusions as q02: 793 installs, first seen 2026-08-14 → 11-04, plus per-rider day arrays for `reminder_opened` and the first `ride_too_short_shown`). Its results are tagged `[SOURCE: PostHog q06-resp-subgroups]`. The sequential-test numbers come from the same simulation as F5, rerun at these baselines (4,000 runs each) and are tagged `[UNBACKED — own simulation]`.

**R1. On P01.1 (PM), P02.2 (Onboarding UX), P03.2 (Behavioural) and P05.1 (Rider voice): four versions of the same "too short" change. I agree with the change, but the baseline they quote is about 2.4× too high, and the subgroup is too small for any test.**
- All four use "34 of 103 Start-tappers saved a real ride" (≈33%) as the baseline, or "34 of 66" [SOURCE: evidence pack §3]. That counts saves *at any time* in the window. P03.2 correctly notes that the week-1 subgroup cut is missing. Here it is:
  - Riders whose first `ride_too_short_shown` came on day 0, with no saved ride before it: **52**. Of these, **14 (27%)** saved a real ride within 7 days [SOURCE: PostHog q06-resp-subgroups].
  - The same riders who also saved nothing later on day 0 (the group the new sheet is meant for): **44**. **6 of 44 (13.6%)** saved a real ride in week 1, and **12 of 44 (27%)** came back on day 2 [SOURCE: PostHog q06-resp-subgroups].
  - So the pre-launch baseline for "too short on day 0 → real ride in week 1" is **6/44 ≈ 14%**, not 33%. A post-launch read against 33% would call a real improvement a failure.
  - Split by build (revision, R1.1): of the 44, **34 were on builds before 3.21.0** (5 later saved a ride) and **10 on ≥ 3.21.0** (1 did) [SOURCE: PostHog q06-rev-tooshort-build]. The sheet the board would change exists only on ≥ 3.21.0, so the comparable baseline is 1/10, which is anecdote. The before-window for this change must be ≥ 3.21.0 only.
- Volume: 44 riders in 12 weeks is about 3.7 a week, and on ≥ 3.21.0 only 10 in about 4.5 weeks [SOURCE: PostHog q06-resp-subgroups, q06-rev-tooshort-build; my arithmetic]. A sequential test for a doubling (14% → 27%) with N = 36 has power 0.63, and when it works it needs a median of 125 eligible riders, about 34 weeks [UNBACKED — own simulation]. This confirms what P02.2, P03.2 and P05.1 say: no split test for this sheet. It belongs on my P06.3 ship-on-no-harm path, read as a mechanism chain (sheet → remind_me → `reminder_opened` → saved ride within 48 h). Treat any outcome read with fewer than about 40 post-launch riders as anecdote [UNBACKED — own threshold].
- Pick one copy and one event schema. If four drafts are merged into one sheet, the `ride_too_short_shown` property set (`is_first_attempt`, `variant`, `max_speed_kmh`, `action:'remind_me'`) has to be agreed once. Otherwise the before and after windows stop being comparable [UNBACKED — own idea].

**R2. On P04.1 (Lifecycle) and P01.2 (PM): the day-1 nudge is the one change we *can* test properly. Use a 50/50 holdout with a stopping rule fixed in advance, not a 20% holdout that is only "reported", and don't let the metric count the nudge's own taps.**
- The eligible group is larger and has a higher baseline than any other: riders who finished onboarding and granted permission number **171**, and **35 (20.5%)** came back on day 2 [SOURCE: PostHog q06-resp-subgroups]. That is about 14 a week (my arithmetic). The pack's per-platform split (Android 20/119, iOS 15/57 [SOURCE: evidence pack §4]) is the right stratification.
- The first draft simulated raw day-2 return (20.5% → 41%). The primary must be day-2 engaged return (next bullet), whose baseline in this group is **23/171 = 13.5%** [SOURCE: PostHog q06-rev-engaged]. Re-run for a doubling (13.5% → 27%) at ~2 eligible riders a day [UNBACKED — own simulation, Appendix A; rule from SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — "If T − C reaches 2√N, stop" (Evan Miller, 2015-10-13)]:

  | N (total day-2 engaged returns, both arms) | Ship if T − C ≥ | Power for ×2 | Median eligible riders when it works | False positives with no effect | Median time to stop with no effect |
  |---|---|---|---|---|---|
  | 36 | 12 | 0.62 | 124 (~9 weeks) | 4.5% | ~19 weeks |
  | 64 | 16 | 0.83 | 198 (~14 weeks) | 4.4% | ~34 weeks |
  | 100 | 20 | 0.94 | 271 (~19 weeks) | 4.8% | ~53 weeks |

  - The honest metric costs about 4 extra weeks against the first draft's ~10. N = 64 with the 2026-03-31 calendar cap (P06.2) is my recommendation; N = 36 is acceptable if the owner prefers a 9-week answer and accepts a 38% chance of missing a real doubling.
  - **Challenge to P04.1:** a 20% holdout that is "reported, not tested" gives about 17 control riders in 8 weeks, which supports no conclusion. A 50/50 split with N = 64 reaches 0.83 power in about 14 weeks. The cost is that half of the reachable riders go without one message for that time, which is at most a few day-2 returns. Then ship to everyone.
  - **Correction to P01.2:** Miller's N counts *successes* (day-2 returns in both arms), not enrolled riders. "N fixed at about 160 granted riders" would either stop far too early (if 160 is read as riders) or run for about 9 months (if 160 is read as successes at a ~30% average rate) [my arithmetic].
- **The metric must not count the nudge's own taps.** Today only **2 of the 72** day-2 returns had a `reminder_opened` on that day [SOURCE: PostHog q06-resp-subgroups], so the current baseline is clean. A day-1 notification sent to every eligible rider in the test arm, but to no one in control, makes "opened the notification" count as a return in one arm only. The primary metric for this test should be **day-2 engaged return** (a day-2 core action, or a `$screen` other than home after the open, as F14 says), with raw day-2 return and open rate as secondary metrics. P04.1's own leading indicator ("core action within 2 h of an open") is the right instinct. It should be the success definition, not a side metric.
- I agree with P04.1's "cancel on any core action" and "one message only". Both keep the treatment clean. Assign the arm at `onboarding_completed`, after the paywall, exactly as P06.2 says, so trial starts cannot differ between arms [SOURCE: https://www.revenuecat.com/state-of-subscription-apps-2025 — "82% of trial starts occur the same day a user installs an app" (RevenueCat (vendor), 2025)].
- Since the token-gap explanation (F14), this is a **local** notification and is valid on both platforms; server push is not involved. This makes the nudge the board's best candidate for the single randomized slot in P06.2. The ride-plan and too-short changes go on the no-harm path. This is a re-ranking of my own P06.2 example ("routing riders to a first saved ride"): that population is too small to test.

**R3. On P02.1 (Onboarding UX), P03.1 (Behavioural), P03.3 (Behavioural) and P04.1 (Lifecycle): combine them under one rule, "one activation reminder per rider", or the experiments contaminate each other.**
- As drafted, a rider who finishes onboarding could get a plan reminder (P02.1 / P03.1), a too-short "remind me" (R1 group), a day-1 18:00 nudge (P04.1 / P01.2) and a Saturday 12:30 message (P03.3), all in week 1. Each draft measures its own reminder's open → action chain. But a rider who gets two messages will be counted as a success by both, and the day-2 metric of the P04.1 test would include opens of P02.1 reminders in one arm only if the two interact [UNBACKED — own idea].
- Proposed combination (design only): one local scheduler with a priority order. (1) A rider-chosen time from the plan sheet or the too-short sheet wins. (2) Otherwise the P04.1 day-1 nudge fires, if the rider is in the test arm. (3) P03.3's weekend message stays off until the P04.1 test has stopped. Every reminder carries `reminder_opened {kind, source}`, so each chain can still be read on its own. P04.1's randomization then compares "default nudge" against "no default nudge" among riders who set no plan. The plan-setters are reported separately as a stratum, not dropped [UNBACKED — own design].
- One thing this leaves open: P02.1 and P03.1 put a permission ask in context on Home. If that raises the grant rate, the P04.1 eligible group grows *during* the test. This is fine for randomization (assignment happens at eligibility), but the baseline of 171/793 granted completers can't be used as the denominator for a before/after read [SOURCE: https://blog.acolyer.org/2017/09/25/a-dirty-dozen-twelve-common-metric-interpretation-pitfalls-in-online-controlled-experiments/ — "Ratio metrics can be misleading or potentially invalid if the denominator of the metric changes" (The Morning Paper on Dmitriev et al. KDD 2017, 2017-09-25)]. So ship P02.1's permission ask either before the P04.1 test starts or after it ends, not during it.

## Answers to review

**R1.1 — fixed.** Diagnosis 2 now limits "a stop within two minutes" to builds ≥ 3.21.0 (#259, commit 54146980, 2026-10-04). New split by build of each rider's first sheet: ≥ 3.21.0, 17 riders, 0 with a sheet at 120 s or more; older builds, 49 riders, 9 with at least one such sheet [SOURCE: PostHog q06-rev-tooshort-build]. The 9 riders' sheets add up to the 36 events at 120 s or more that 02 found. R1 now splits its 44-rider subgroup by build (34 old, 10 new), and the ledger requires a ≥ 3.21.0-only before-window. I also found that the event fires once per action (`shown`/`keep`/`end`), so sheet counts are tap counts; the file now counts riders.

**R1.2 — fixed.** `elapsed_s` and `distance_m` are sent on every `ride_too_short_shown` action [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:220-252 on origin/main]. F14's "still missing" list and P06.1 step 2 now ask only for `max_speed_kmh`.

**R1.3 — fixed.** The What's New suppression is live since 3.25.0 [SOURCE: apps/mobile/src/app/(onboarding)/personalizing.tsx:191 on origin/main; board/02-onboarding-ux.md q-02b, 0 of 90 completers after 10-12]. P06.3's examples are now Android FCM (P04.2) and, if the randomized slot goes to the nudge, the too-short sheet.

**R1.4 — fixed.** F14 and "What I'd NOT do" now say: the gap is explained (no FCM on Android, all 105 tokens iOS) [SOURCE: evidence pack §8b; push-tokens-investigation.md]; server-push experiments wait for P04.2; local notifications, including R2's day-1 nudge, are valid now.

**R1.5 — fixed.** One primary per test, in a ledger table in P06.1: nudge → day-2 engaged return (13.5% in granted completers); first-session package → week-1 core action among completers (16.6%); too-short sheet alone → real ride within 7 days; FCM → harm checks only. For the package, `activation_24h` is explicitly **neither primary nor guardrail**, only a diagnostic, because the package moves the first ride past 24 h on purpose. `activation_24h` stays the funnel scoreboard metric (F1). While doing this I found a bigger error: P06.2 enrols at `onboarding_completed`, but its baseline was per install (7.1%). All 56 riders active within 24 h are completers, so the enrolled baseline is 15.3% [SOURCE: PostHog q06-rev-completers]. Calendar durations do not change (Appendix A), because the riders removed could never have succeeded.

**R1.6 — fixed.** The full script is in Appendix A. I can only write this one file, so it is inline here and not checked in as a separate `.py`; copy it to a file and run `python3 -I` to reproduce. It uses fixed seeds. It is re-run at `activation_24h` 7.1% per install and 15.3% per completer, and the first draft's "control 7.7%" label is corrected in F5. The results barely move (N = 64: power 0.83, ~58 days). The new runs add one number the board should pre-register: with no effect, the test needs about 4.5 months to stop. P06.2 now has a calendar cap of 2026-03-31.

**R1.7 — fixed.** F14 now gives the exact `$screen_name` exclusion list. It covers both name formats seen on day 2 in this cohort, the SQL is in Appendix B, and the baselines are computed: all 39/793 (4.9%), completers 37/367 (10.1%), granted completers **23/171 (13.5%)**, against raw day-2 return 72, 58 and 35 [SOURCE: PostHog q06-rev-engaged]. R2's simulation is re-run at 13.5%: N = 64 needs about 14 weeks, not 10. P06.1 adds a guard so the route list cannot drift silently. One limitation remains: `/start-ride` counts as engaged even when the rider only opens the sheet. The strict variant (core action on day 2: 12/171) is reported next to it for that reason.

**R1.8 — fixed.** The thresholds are now called manual review triggers, not kill rules, and their false-alarm rates with no effect are simulated (Appendix A). The first draft's "≥ 2 cancels" fires by chance 30–51% of the time at 60–150 riders per arm, and "≥ 6 day-2 riders" 17–38% of the time. The revised thresholds (≥ 4 and ≥ 10) give 4–19% and 2–15%. They are still not safe as automatic stops. Only an SRM failure or a crash-rate jump stops the test automatically (P06.2).

**R2.1 — fixed.**
- The capped simulation is now in P06.2. Launch 2026-12-15; enrolment stops 2026-03-24 for a week-1 metric (99 days) and 2026-03-29 for a day-2 metric (104 days); readout 2026-03-31.
- Winter enrolment is 1.4 granted completers a day and 3.0 completers a day. The observed rates for 10-12 → 11-08 were 1.6 and 4.0 a day [SOURCE: PostHog q06-r2-enrolment].
- Result: the nudge alone has power **0.17** at N = 64, and 0.42 at N = 36. You were right that the 0.83 quoted by 01, 04 and this file is not reachable by the cap.
- The bundle at N = 64 reaches **0.83**, or 0.71 if the winter baseline falls by 25% (an UNBACKED sensitivity).
- P06.2 also states what a capped readout can say (a doubling shown; the difference ±7 pts; a no-harm bound) and what it cannot say (no lift up to about +40% ruled out; no attribution).
- One correction to my earlier rates: "3.0 completers/day" came from 6.5 installs × 46%. The real window average is about 4.4 a day (367 over 83 days), and the recent rate is 4.0. I keep 3.0 as the conservative winter figure and label it as such.

**R2.2 — fixed: decision recorded in P06.1.**
- The decision is option (a)/(c): the **package and the day-1 nudge go in the slot as one bundle**, assigned at all completers. The primary is week-1 core action among completers (16.6%).
- Consequences:
  - (1) Nothing first-session waits for the winter, and P06.3's concurrency rule no longer blocks it. That rule now says first-session changes ship only inside the test arm, and both-arm changes such as FCM may ship and are logged.
  - (2) R3's eligibility drift goes away, because grant status is a stratum, not a filter.
  - (3) We lose attribution between parts. The mechanism events give only a descriptive split.
  - (4) 01's sequencing (P01.1, then P01.2) and 04's "granted completers only" are superseded for the slot. 02's design is adopted.
- The reason is R2.1: the nudge alone cannot be read by the cap, and the bundle can.

**R2.3 — fixed.**
- The ledger now states the canonical too-short trigger: `action='shown'`, `distance_m < 10`, `elapsed_s < 120`, no saved ride before it, any day, every sheet.
- Its ≥ 3.21.0 baseline query, `q06-r2-tooshort-canonical` in Appendix B, gives **1/13**. That matches 02's q-02c.
- F14 is the only definition of day-2 engaged return (23/171, 37/367).
- The other figures are marked superseded by name in the ledger: 11/49, 11/45, 11/46, 1/14, my 1/10 and 6/44, 04's 23/171 list, and 01's 26/171.
- Older builds cannot use the canonical cut, because `action:'shown'` starts at 3.20.0. So no all-builds baseline is given.

**R2.4 — fixed.** P06.3 now gives an exact rule.
- The rule: two looks only (4 and 8 weeks), two metrics (`activation_24h`, day-2 return), each against a fixed 8-week before-window. Revert if **d + 1.645·SE < 0**, that is, if the upper bound of the 90% two-sided interval for (after − before) is below 0.
- Simulated with no change [UNBACKED — own simulation, Appendix A `r2sim`]: the false-revert rate is 16% across all 4 checks.
- Power: it catches a halving of day-2 return 86% of the time and a 30% drop 52% of the time.
- Your suggested 80% interval would give 10% per single check but 29% across 4 checks. That is why I tightened it to 90%.

## Appendix A — sequential-test and trigger simulation

`[UNBACKED — own simulation]`. Python 3 standard library only, fixed seeds. Re-run of 2026-11-12 printed the numbers used in F5, P06.2 and R2.

```python
# Evan Miller sequential test (https://www.evanmiller.org/sequential-ab-testing.html):
# each enrolled unit goes 50/50 to T or C; a success adds 1 to T or C.
# Ship if T - C >= ceil(2*sqrt(N)); stop with no winner when T + C = N.
import random, math
def miller(pc, pt, N, reps=4000, cap=20000, seed=1):
    rnd = random.Random(seed); d = math.ceil(2*math.sqrt(N)); wins = 0; ns = []; all_n = []
    for _ in range(reps):
        T = C = n = 0
        while n < cap:
            n += 1
            if rnd.random() < 0.5: T += rnd.random() < pt
            else: C += rnd.random() < pc
            if T - C >= d: wins += 1; ns.append(n); break
            if T + C >= N: break
        all_n.append(n)
    ns.sort(); all_n.sort()
    return d, wins/reps, (ns[len(ns)//2] if ns else None), all_n[len(all_n)//2]
def show(label, pc, N, enrol_per_day):
    d, pw, med, _ = miller(pc, 2*pc, N)
    _, fp, _, med0 = miller(pc, pc, N, seed=2)
    print(f"{label} pc={pc} N={N} ship T-C>={d}: power(x2)={pw:.2f} median enrolled when it ships={med} (~{med/enrol_per_day:.0f} d); "
          f"FPR(null)={fp:.3f} median enrolled to stop under null={med0} (~{med0/enrol_per_day:.0f} d)")
# P06.2: activation_24h, enrolled at onboarding_completed. Baseline among completers.
for N in (36, 64, 100): show("activation_24h(all installs 7.1%)", 0.071, N, 6.5)
# Day-1 nudge: granted completers, ~14/week = 2.0/day; primary = day-2 engaged return 23/171
for N in (36, 64, 100): show("d2_engaged(granted completers 13.5%)", 0.135, N, 2.0)
# Review triggers false-alarm rate under no effect (R1.8)
def trigger(p, gap, per_arm, reps=20000, seed=3):
    rnd = random.Random(seed); hits = 0
    for _ in range(reps):
        T = C = 0; fired = False
        for _ in range(2*per_arm):
            if rnd.random() < 0.5: T += rnd.random() < p
            else: C += rnd.random() < p
            if C - T >= gap: fired = True; break
        hits += fired
    return hits/reps
# trial started and cancelled within 3 days, per completer: 15 trials/367 completers x 3/4 cancelled (pack §6) ~ 3.1%
for per_arm in (60, 100, 150):
    print(f"trigger cancels>=2 one-sided, p=0.031, {per_arm}/arm: false alarm={trigger(0.031,2,per_arm):.2f}; >=4: {trigger(0.031,4,per_arm):.2f}")
    print(f"trigger day2 trails >=6, p=0.158 (completers), {per_arm}/arm: false alarm={trigger(0.158,6,per_arm):.2f}; >=10: {trigger(0.158,10,per_arm):.2f}")
# Added runs (completer baselines, 3.0 completers/day)
for N in (36, 64, 100): show("activation_24h(completers 15.3%)", 0.153, N, 3.0)
show("core_w1(completers 16.6%)", 0.166, 64, 3.0)
for N in (36, 64): show("ride_w1(completers 7.4%)", 0.074, N, 3.0)
```

`r2sim` (round 2): power at the calendar cap and the P06.3 harm rule. Same rule as above, but enrolment stops at `max_enrol`. Re-run with `python3 -I`.

```python
import random, math
def miller_cap(pc, pt, N, max_enrol, reps=4000, seed=11):
    rnd = random.Random(seed); d = math.ceil(2*math.sqrt(N)); wins = 0
    for _ in range(reps):
        T = C = n = 0; won = False
        while n < max_enrol:
            n += 1
            if rnd.random() < 0.5: T += rnd.random() < pt
            else: C += rnd.random() < pc
            if T - C >= d: won = True; break
            if T + C >= N: break
        wins += won
    return d, wins/reps
def show(label, pc, rate, days, N=64):
    m = int(rate*days); d, pw = miller_cap(pc, 2*pc, N, m); _, fp = miller_cap(pc, pc, N, m, seed=12)
    hw = 1.645*math.sqrt(2*pc*(1-pc)/(m/2))
    print(f"{label}: enrolled~{m} N={N} ship>={d} power_at_cap={pw:.2f} FPR={fp:.3f} CI90 half-width={hw*100:.1f}pts")
# launch 2026-12-15; week-1 metric enrols to 03-24 (99 d), day-2 metric to 03-29 (104 d)
for N in (36, 64):
    show("nudge 1.4/d", 0.135, 1.4, 104, N); show("nudge 1.6/d", 0.135, 1.6, 104, N)
    show("nudge x0.75", 0.135*0.75, 1.4, 104, N)
    show("bundle 3.0/d", 0.166, 3.0, 99, N); show("bundle 4.0/d", 0.166, 4.0, 99, N)
    show("bundle x0.75", 0.166*0.75, 3.0, 99, N)
def harm(p_b, p_a, n_b, looks, z=1.2816, reps=20000, seed=21):
    # metrics simulated independently: conservative for the family-wise rate
    rnd = random.Random(seed); fired = 0; nmax = max(looks)
    for _ in range(reps):
        f = False
        for pbm, pam in zip(p_b, p_a):
            xb = sum(rnd.random() < pbm for _ in range(n_b)); ya = [rnd.random() < pam for _ in range(nmax)]
            for L in looks:
                pb = xb/n_b; pa = sum(ya[:L])/L
                se = math.sqrt(pb*(1-pb)/n_b + pa*(1-pa)/L) or 1e-9
                if (pa - pb) + z*se < 0: f = True
        fired += f
    return fired/reps
nb = 392; looks = [196, 392]; pb = [0.071, 0.091]   # 8-week before, 4/8-week after, 7 installs/day
print(harm(pb, pb, nb, looks))                       # 80% CI, 2 metrics x 2 looks, null -> 0.29
print(harm([0.091], [0.091], nb, [392]))             # 80% CI, single check, null -> 0.10
print(harm(pb, pb, nb, looks, z=1.645))              # 90% CI (adopted), null -> 0.16
print(harm(pb, [0.071, 0.0455], nb, looks, z=1.645)) # day-2 halves -> 0.86
print(harm(pb, [0.071, 0.0637], nb, looks, z=1.645)) # day-2 -30% -> 0.52
print(harm(pb, [0.0355, 0.091], nb, looks, z=1.645)) # activation_24h halves -> 0.79
```

Printed 2026-11-12 (`r2sim`): N = 64 power at the cap: nudge 0.17 (1.4/d), 0.26 (1.6/d), 0.05 (×0.75); bundle 0.83 (3.0/d), 0.84 (4.0/d), 0.71 (×0.75). N = 36: nudge 0.42 / 0.53 / 0.21; bundle 0.62 / 0.62 / 0.62.

## Appendix B — revision queries (PostHog `execute-sql`, read-only, run 2026-11-12)

All three use the q02 cohort: app persons (`$lib = 'posthog-react-native'`) first seen 2026-08-14 → 11-04, with `person_id NOT IN (<the 12 ids in queries/q00-excluded-persons.md>)`.

```sql
-- shared CTE
WITH base AS (
  SELECT person_id AS pid, min(timestamp) AS fs,
    maxIf(1, event = 'onboarding_completed') AS ob_done,
    argMaxIf(toString(properties.permission_granted), timestamp, event = 'notification_permission_result') AS push,
    minIf(timestamp, (event = 'ride_completed' AND coalesce(properties.below_min_ride, false) = false)
      OR event IN ('expense_added','maintenance_task_created','maintenance_task_completed')) AS t_core,
    minIf(timestamp, event = 'ride_completed' AND coalesce(properties.below_min_ride, false) = false) AS t_ride
  FROM events
  WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native' AND person_id NOT IN (<the 12 ids in queries/q00-excluded-persons.md>)
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05')

-- q06-rev-completers: activation_24h / core_w1 / ride_w1 by group
SELECT grp, count() AS n,
  countIf(t_core > '2000-01-01' AND t_core < fs + INTERVAL 24 HOUR) AS act24,
  countIf(t_core > '2000-01-01' AND t_core < fs + INTERVAL 7 DAY) AS core_w1,
  countIf(t_ride > '2000-01-01' AND t_ride < fs + INTERVAL 7 DAY) AS ride_w1
FROM base ARRAY JOIN ['all', if(ob_done = 1, 'ob_done', 'ob_not_done'),
  if(ob_done = 1 AND push = 'true', 'ob_done_granted', '')] AS grp
WHERE grp != '' GROUP BY grp;
-- result: all 793/56/61/27; ob_done 367/56/61/27; ob_done_granted 171/33/36/17; ob_not_done 426/0/0/0

-- q06-rev-engaged: day-2 engaged return
, ev AS (
  SELECT e.person_id AS pid,
    maxIf(1, e.event IN ('Application Opened','Application Became Active','$screen') AND toDate(e.timestamp) = toDate(b.fs) + 1) AS d2,
    maxIf(1, e.event = '$screen' AND toDate(e.timestamp) = toDate(b.fs) + 1
      AND toString(e.properties.$screen_name) NOT IN ('/','/(tabs)/(home)','/(tabs)','/whats-new','/(modals)/whats-new',
        '/login','/account','/commitment','/goals','/reveal','/bike-setup','/personalizing','/notifications','/paywall',
        '/heard-about','/experience','/welcome','/consent','/no-bike-value')
      AND NOT startsWith(toString(e.properties.$screen_name), '/(onboarding)')
      AND NOT startsWith(toString(e.properties.$screen_name), '/(auth)')) AS d2_scr,
    maxIf(1, toDate(e.timestamp) = toDate(b.fs) + 1 AND ((e.event = 'ride_completed' AND coalesce(e.properties.below_min_ride, false) = false)
      OR e.event IN ('expense_added','maintenance_task_created','maintenance_task_completed'))) AS d2_core,
    maxIf(1, e.event = 'reminder_opened' AND toDate(e.timestamp) = toDate(b.fs) + 1) AS d2_rem,
    maxIf(1, e.event IN ('Application Opened','Application Became Active','$screen')
      AND e.timestamp >= b.fs + INTERVAL 24 HOUR AND e.timestamp < b.fs + INTERVAL 48 HOUR) AS r2448
  FROM events e INNER JOIN base b ON e.person_id = b.pid
  WHERE e.timestamp >= '2026-08-14' AND e.timestamp < '2026-11-08' GROUP BY pid)
SELECT grp, count() AS n, sum(d2) AS day2, sum(d2 AND (d2_scr OR d2_core)) AS day2_engaged,
  sum(d2 AND d2_core) AS day2_core, sum(d2 AND d2_rem) AS day2_with_reminder, sum(r2448) AS ret_24_48h
FROM (SELECT b.*, ev.* FROM base b LEFT JOIN ev ON ev.pid = b.pid)
ARRAY JOIN ['all', if(ob_done = 1, 'ob_done', ''), if(ob_done = 1 AND push = 'true', 'ob_done_granted', '')] AS grp
WHERE grp != '' GROUP BY grp;
-- result: all 793/72/39/18/2/42; ob_done 367/58/37/18/2/34; ob_done_granted 171/35/23/12/2/21

-- q06-rev-tooshort-build: riders by build of their first ride_too_short_shown
, ts AS (
  SELECT e.person_id AS pid, min(e.timestamp) AS t_ts, argMin(toString(e.properties.$app_version), e.timestamp) AS ver,
    max(toFloat(e.properties.elapsed_s)) AS max_el, min(toFloat(e.properties.elapsed_s)) AS min_el
  FROM events e INNER JOIN base b ON e.person_id = b.pid
  WHERE e.event = 'ride_too_short_shown' AND e.timestamp >= '2026-08-14' GROUP BY pid)
SELECT if(ver IN ('3.18.0','3.19.0','3.19.1','3.20.0'), 'pre_3.21', 'ge_3.21') AS build, count() AS riders,
  countIf(max_el >= 120) AS any_sheet_ge120s, countIf(min_el >= 120) AS all_sheets_ge120s,
  countIf(toDate(t_ts) = toDate(b.fs) AND NOT (t_ride > '2000-01-01' AND t_ride < t_ts)) AS d0_first,
  countIf(toDate(t_ts) = toDate(b.fs) AND NOT (t_ride > '2000-01-01' AND toDate(t_ride) = toDate(b.fs))) AS d0_no_save_d0,
  countIf(toDate(t_ts) = toDate(b.fs) AND NOT (t_ride > '2000-01-01' AND toDate(t_ride) = toDate(b.fs))
    AND t_ride > '2000-01-01' AND t_ride < b.fs + INTERVAL 7 DAY) AS d0_no_save_d0_then_w1_ride
FROM ts INNER JOIN base b ON ts.pid = b.pid GROUP BY build;
-- result: ge_3.21 17/0/0/11/10/1; pre_3.21 49/9/3/41/34/5

-- q06-r2-enrolment (round 2): weekly enrolment for the capped simulation (same base person CTE, fs 2026-08-17 → 11-09)
SELECT toStartOfWeek(fs, 1) AS wk, count() AS installs, sum(ob_done) AS completers,
  countIf(ob_done = 1 AND push = 'true') AS granted_completers
FROM base GROUP BY wk ORDER BY wk;
-- result (last four full weeks): 10-12 48/28/10; 10-19 53/25/13; 10-26 41/22/7; 11-02 69/37/14 → 4.0 completers/day, 1.6 granted/day

-- q06-r2-tooshort-canonical (round 2): the board's merged trigger, first qualifying sheet, by build
, ts AS (
  SELECT e.person_id AS pid, e.timestamp AS t, toString(e.properties.$app_version) AS ver
  FROM events e
  WHERE e.event = 'ride_too_short_shown' AND e.timestamp >= '2026-08-14' AND e.timestamp < '2026-11-05'
    AND toString(e.properties.action) = 'shown' AND toFloat(e.properties.distance_m) < 10 AND toFloat(e.properties.elapsed_s) < 120),
firsts AS (
  SELECT ts.pid AS pid, min(ts.t) AS t_trig, argMin(ts.ver, ts.t) AS ver, any(b.t_ride) AS t_ride
  FROM ts INNER JOIN base b ON ts.pid = b.pid
  WHERE NOT (b.t_ride > '2000-01-01' AND b.t_ride < ts.t)   -- no saved real ride before the sheet
  GROUP BY ts.pid)
SELECT if(toInt(splitByChar('.', ver)[1])*100 + toInt(splitByChar('.', ver)[2]) >= 321, 'ge_3.21', 'lt_3.21') AS build,
  count() AS riders, countIf(t_ride > '2000-01-01' AND t_ride < t_trig + INTERVAL 7 DAY) AS saved_ride_7d
FROM firsts GROUP BY build;
-- result: ge_3.21 13 riders / 1 saved within 7 days (sheets 2026-10-06 → 11-04, all with a full 7-day window by 11-12);
-- no lt_3.21 rows, because action 'shown' exists only from 3.20.0 and no 3.20.0 sheet met the cut
```
