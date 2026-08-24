# ASO snapshot — 2026-08-24 (diff vs the 2026-07-22 baseline)

Re-pull of the ONGOING App Store Connect analytics request
`f25db9b3-06e1-4442-a33b-98cf84224602`, diffed against
`outputs/MotoVault/DATA-FOUNDATION.md` (pulled 2026-07-22, covering Mar–Jun 2026).

**Headline: the funnel scaled ~2.5× end to end, with every conversion ratio flat.**
3.18.0's rebuilt keyword fields went live 2026-07-29 and impressions went from ~57/day
to ~138/day. Page views and first-time installs both grew by the *same* multiple, and
impression→page-view and page-view→download are unchanged to the first decimal. This is
the cleanest win the ASO work has produced. Trust is the constraint that did not move —
and the fix that was built for it has been reaching zero users for three weeks.

---

## Method, and two traps worth recording

**1. An ASC "DAILY" report instance is not one day of data.** Each carries a rolling
multi-day window — r14 (Discovery & Engagement) instances hold 3 calendar days, r3/r12
hold 1–2, and one r6 instance restated 5 months back to 2026-03-24. Consecutive
instances overlap, so summing rows across files multi-counts every shared date (naive
summing gave 5,882 impressions where the true figure is 3,919 — a 50% overstatement).
Rule used throughout: attribute each date to exactly **one** instance, the newest that
reports it, and ignore that date's rows everywhere else. Validated two ways — of 17
dates reported by more than one instance, **15 were byte-identical**; and the
daily-derived weekly totals match the WEEKLY instances **exactly** (405 / 854 / 892 for
the weeks of Jul 20, Jul 27, Aug 3).

**2. Never mix granularities in one sum.** WEEKLY and MONTHLY instances restate the same
calendar time as the DAILY ones. One `r12-MONTHLY` row for 2026-07-01 silently
double-counted all of July until it was excluded.

**All figures below come from the WEEKLY series**, because one instance
(`r14-WEEKLY`, processing date 2026-08-14) is a **full backfill to 2026-03-16** — a
single authoritative source covering both the before and after period, so the comparison
carries no methodology mismatch at all. Rate-limiting note: a few hundred analytics
calls throttles the *entire* ASC API (unrelated endpoints like `asc versions list` start
failing with `context deadline exceeded`). Run these serially. Weekly instances cover a
month in ~5 requests where daily takes ~35.

---

## A correction to the first read of this data

An earlier pass of this analysis, using only the partial daily set, reported that
impression→page-view had **collapsed from 19.4% to 8.8%** and concluded that
"impression→tap is the new #1 leak." **That was wrong**, and the weekly backfill is what
shows why.

19.4% was the Mar–Jun *average*, and that average is dominated by two outlier weeks —
the week of 2026-05-18 converted at 57.8% and 2026-03-23 at 38.4% (both tiny-denominator
weeks: 377 and 242 impressions). In the six weeks immediately before 3.18.0 shipped,
imp→PV was already running at **8.9%**. After 3.18.0 it is **9.0%**.

So conversion did not degrade. It is flat, while impressions grew 2.5×. There is no new
leak.

---

## The funnel, weekly series

| Per day | Full pre-period (03-16 → 07-26, 19wk) | Trailing 6 weeks (06-15 → 07-26) | Post-3.18.0 (07-27 → 08-16, 3wk) |
|---|---|---|---|
| Impressions | 47.1 | 56.5 | **138.4** |
| Product-page views | 7.98 | 5.02 | **12.43** |
| First-time installs¹ | 0.83 | 0.50 | **1.24** |
| Impression → page view | 17.0% | **8.9%** | **9.0%** |
| Page view → download¹ | 10.5% | **10.0%** | **10.0%** |

¹ from r6 (Install & Deletion), whose population is smaller than r3's download counts —
use it for internal comparison across periods, not against the r3 figures below.

**Against the trailing six weeks: impressions ×2.45, page views ×2.47, first-time
installs ×2.48.** The funnel scaled linearly. Both conversion ratios are identical
before and after.

Cross-check from the r3 (App Downloads) daily pull, 24 matched days: first-time downloads
**3.08/day vs the 2.66/day** recorded in the July baseline, and page-view→download 30.1%
vs 34.7% — same direction, wider error bars because daily coverage is partial.

### The ramp is dated, and it lines up with the release

| Week starting | Impressions | Per day |
|---|---|---|
| 2026-06-29 | 331 | 47.3 |
| 2026-07-06 | 310 | 44.3 |
| 2026-07-13 | 485 | 69.3 |
| 2026-07-20 | 405 | 57.9 |
| **2026-07-27** | **854** | **122.0** |
| 2026-08-03 | 892 | 127.4 |
| 2026-08-10 | **1,160** | **165.7** |

**3.18.0 went live 2026-07-29** (`currentVersionReleaseDate` via iTunes lookup) carrying
the rebuilt keyword fields, the expense-first subtitle and the first non-empty
promotional text in all 7 locales. Impressions doubled that week and have climbed since;
the week of Aug 10 is the highest ever recorded, ~3.5× the pre-release average. The
**B2/B3/B4 keyword-and-subtitle items did exactly what they were supposed to do.**

### Growth is in the right markets

Top-18 territories by impression are **87% target (Europe + Americas)**. Non-target
entries total 425 impressions: AU 95, IN 93, TR 80, PH 69, TH 45, VN 43. The new reach is
not junk geography.

Notable movers: **BR is now #2** (325 impressions in 33 days ≈ 9.8/day, against 124 in
122 baseline days ≈ 1.0/day — roughly 10×). US 1,565 (40% share, essentially unchanged
from 43%), GB 261, DE 156, MX 155.

### By source — and the one thing that went backwards

Impression mix is unchanged at **96% App Store search / 4% browse**: search is still the
whole acquisition engine. But the per-day source detail hides a decline:

| Source | PV/day baseline → now | First-time DL/day baseline → now |
|---|---|---|
| App Store search | 2.88 → **5.42** | 1.23 → **2.00** |
| App Store browse | 0.96 → 2.12 | 0.08 → 0.12 |
| Web referrer | 0.70 → 1.03 | 0.38 → 0.44 |
| **App referrer** | **3.09 → 1.73** | **0.97 → 0.64** |

App referrer was the *largest* single page-view source at baseline and it has dropped
~44% in page views and ~34% in downloads per day, while everything else grew. It is the
bucket deep links, share sheets and the web→app bridge land in. Worth a look.

Browse converts impressions at ~42% against search's ~4.8%, on 4% of impressions — true
since the baseline, and still the argument for category/editorial surfacing.

---

## Trust: ~6 ratings averaging ≈4.3, but the US storefront still shows 2★

| Territory | Baseline 2026-07-15 | Now |
|---|---|---|
| US | 1 rating @ 2★ | 1 rating @ 2★ |
| DE | 0 | **1 rating @ 4★** |
| SK | not checked | **2 ratings @ 5★** |
| BE | not checked | **1 rating @ 5★** |
| CL | not checked | **1 rating @ 5★** |
| GB / FR / IT / ES / MX / BR / CA / AU | 0 | 0 |

The baseline recorded "US 2★, everything else 0" because it only queried the eight
localized storefronts. It missed SK, BE and CL — which is where all of the actual
positive ratings are. Globally the app sits at roughly **4.3★ from 6 ratings**, not
"no social proof."

What *is* still true, and is the thing that matters: **the US storefront shows a lone
2★**, and the US supplies 40% of impressions. A shopper in the market that drives the
funnel sees the single worst rating the app has.

### There were three unanswered 5★ reviews, and the US 2★ cannot be answered

`asc reviews --app 6760291360` returns **three written reviews, all 5★, none of which
had a response**:

| Date | Rating | Territory | Title | Reviewer |
|---|---|---|---|---|
| 2026-05-22 | 5★ | SVK | "Best app for every motorcycle rider" | ch8659 |
| 2026-05-31 | 5★ | CHL | "Reseña" | Moqueca19 |
| 2026-08-10 | 5★ | BEL | "Nice app with great potential" | ing.roman |

All three were answered on 2026-08-24 (state `PENDING_PUBLISH`). The Belgian reviewer had
specifically thanked "the developer who is actively responding" — while having no reply
on file.

**Action A1 in the master action plan ("Reply to the existing US 2★") is not executable
and should be struck.** That 2★ is a star-only rating with no review text, and Apple
provides no mechanism to respond to a rating without a review. The only lever on the US
storefront is generating *new* US ratings — which is the soft-ask, below.

One new rating in five weeks against ~90 new installs. With impressions now 2.5× higher,
rating volume is the clearest remaining bottleneck.

**The fix that was built has not shipped.** The rating soft-ask merged to `main` on
2026-08-03 (`c5fb8253`, PR #181) — five days *after* 3.18.0 went live. `app.config.ts` is
at version `3.19.1` with a `runtimeVersion` policy of `appVersion`, so OTA updates built
from `main` target the 3.19.1 runtime and **cannot reach anyone on 3.18.0** — which is
every live user, since the store still serves 3.18.0. The soft-ask has therefore been
delivering to zero users for three weeks. It ships only when the 3.19.1 store build does.

3.19.1 metadata was prepared today (`outputs/appstore-release-3.19.1/metadata-3.19.1.json`,
build 88, `releaseType: MANUAL`) but 3.19.1 is not live.

---

## Retention: the baseline's "15% deletion" used the wrong denominator

`DATA-FOUNDATION.md` recorded "Installs 467 · Deletions 71 → ~15% deletion rate." That
denominator is *all* install events — overwhelmingly auto- and manual-updates from
existing users — which flatters the number. Against **first-time** installs in the same
r6 sample:

| Period | First-time installs | Deletes | Deletes ÷ first-time installs |
|---|---|---|---|
| Pre-release (17wk with data) | 111 | 72 | **65%** |
| Post-release (3wk) | 26 | 18 | **69%** |

Roughly two-thirds of new installs delete the app, and that has not changed. Deletes lag
installs (a delete today can be of a months-old install) so this is a rough cohort proxy,
not a clean churn rate — but it is the right order of magnitude, and it is bad. This is
consistent with the standing activation/retention diagnosis, not a new finding; what is
new is that the "15%" figure should not be quoted again.

---

## Monetization: still tiny, and not measurable at this scale

| | Pre-release (03-23 → 07-26, 133d) | Post-release (07-27 → 08-09, 14d) |
|---|---|---|
| Purchase events | 25 | 7 |
| Sales | $106.42 | $46.33 |
| Proceeds | $68.94 (**$0.52/day**) | $30.96 (**$2.21/day**) |

The ×4.3 in proceeds/day is **one event**: a single `MotoVault Pro Annual v2` conversion
at $29.99 ($21.00 proceeds) in the week of Aug 3 — the first annual sale since June. At
this volume, per-day revenue rates are noise. What is safely sayable: purchases are up
roughly in line with installs, most events remain $0 trial starts, and both v4 annual
SKUs still show purchases with **$0.00 sales** — trials only, no v4 annual conversion yet.

(An earlier pass reported proceeds *flat* at $0.43/day. That came from the sparse daily
pull, which covered 9 of 31 days and missed the $29.99 sale. The weekly series above
supersedes it.)

---

## What this changes about the plan

`outputs/MotoVault/00-MASTER-ACTION-PLAN.md` ordered the work **trust → reach →
conversion polish**. After this snapshot:

1. **Priority 2 (REACH) is largely done and demonstrably worked.** B2/B3/B4 shipped in
   3.18.0 and produced ×2.45 impressions with no conversion loss. B1 (screenshot reorder)
   and B5 (description reorder) remain.
2. **Trust (Priority 1) is now the whole game, and it is blocked on one action:
   shipping 3.19.1.** That is what delivers the soft-ask to real users. A1 (reply to the
   US 2★) is **impossible** — it is a star-only rating; strike it. The three 5★ written
   reviews were answered 2026-08-24, so the review queue is clear.
3. **Conversion polish stays Priority 3, but a PPO test is now worth running** — ~138
   impressions/day instead of ~40 means a screenshot test is no longer hopelessly
   underpowered. Test to *raise* the flat 9%, not to repair a regression.
4. **Investigate the app-referrer decline** (−44% PV/day) — the only metric that moved
   the wrong way, and it overlaps the web→app bridge work.
5. **Retire the "15% deletion rate" figure** in favour of ~65% of first-time installs
   deleting. It reinforces that activation/retention, not acquisition, is the ceiling on
   everything above.

## Re-pull instructions

```bash
export ASC_TIMEOUT=240s
REQ=f25db9b3-06e1-4442-a33b-98cf84224602          # ONGOING, daily since 2026-07-15
asc analytics view --request-id $REQ --paginate --output json     # report ids
asc analytics reports links --report-id r14-$REQ --paginate       # instance ids
asc analytics instances view --instance-id <iid>                  # date + granularity
asc analytics instances links --instance-id <iid>                 # segment ids
asc analytics download --request-id $REQ --instance-id <iid> --segment-id <sid> --decompress
```

Reports that matter: **r14** Discovery & Engagement (impressions/page views/taps),
**r3** App Downloads, **r6** Install & Deletion, **r12** Purchases.

Prefer **WEEKLY** instances: fewer requests, and they periodically ship a full backfill
that makes long-range comparison trivial. Run serially (`-P 1`/`-P 2`) — fanning out
throttles the whole API for tens of minutes.

Ratings need no ASC call:
`curl -s "https://itunes.apple.com/lookup?id=6760291360&country=us"` returns
`averageUserRating`, `userRatingCount` and `currentVersionReleaseDate` per territory —
that release date is what lets you date a metric ramp against a metadata change.
