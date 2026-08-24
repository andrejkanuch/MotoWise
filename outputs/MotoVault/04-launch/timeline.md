# MotoVault — 90-day ASO operating calendar

**Day 0: Monday 2026-08-24 · Day 90: Sunday 2026-11-22.**
App Store id `6760291360` · Play package `com.motovault.app`.
This app has been live since **2026-03-20**. There is no launch. This is an
operating calendar built around **release trains**, and its job is to make each
change *attributable*.

State at day 0 (all figures from `AUDIT-BRIEF-2026-08-24.md`):

| | App Store | Google Play |
|---|---|---|
| Live version | **3.18.0** (2026-07-29) | **3.19.0** (code 81) |
| Next release | **3.19.1 prepared, build 88, `releaseType: MANUAL`, not submitted** | ahead of iOS |
| Ratings | 7 total, avg 4.43 — SK 2@5★, BE 1@5★, MK 1@5★, CL 1@5★, DE 1@4★, **US 1@2★** | none displayed ("100+ Downloads", below Play's threshold) |
| Written reviews | 3, all 5★, all answered 2026-08-24 (`PENDING_PUBLISH`) | **zero** |

Reach is no longer the constraint. 3.18.0 took impressions from 56.5/day to
**138.4/day** with impression→page-view (9.0%) and page-view→download (10.0%)
both flat, so page views and first-time installs scaled by the same ×2.5. The
three live constraints are **trust** (7 ratings; the US storefront, 40% of
impressions, shows a lone 2★), **retention** (~65% of first-time installs
delete), and **a stuck iOS release** (the rating soft-ask merged
`c5fb8253` on 2026-08-03 into the 3.19.x tree, so it reaches Android users and
**zero** iOS users).

---

## The measurement rule this calendar is built on

**Never change keyword fields and screenshots in the same release.** The one
clean causal read this project has produced — 3.18.0, ×2.45 impressions — worked
*because* it was a metadata-only change with the screenshots untouched. Bundle
two levers and you get a number you cannot attribute, which is worse than not
measuring at all.

There is a harder version of the same point, and it changes what we should
bother testing:

**At MotoVault's traffic, conversion changes are not measurable and impression
changes are.** Weekly impressions run 854–1,160 — thousands of observations, so
a ×2.45 step is unmissable. Page views run ~12.4/day, so a three-week window
holds ~260 of them at a 10% download rate. The minimum detectable change on that
denominator is roughly **±5 percentage points on a 10% base** — a ~50% relative
swing. Anything smaller is invisible no matter how carefully it is scheduled.

Consequence: **keyword and text changes are experiments; screenshot and icon
changes are judgement calls.** Screenshots still get their own release train, so
they never contaminate a keyword read, but they are shipped on the strength of
the PostHog demand order (expenses > maintenance > rides > trips > AI) and read
*directionally over six weeks*, not gated behind a test that cannot conclude.
See "The PPO problem" below.

---

## Release trains

Three trains in 90 days. Each is ~3 weeks: submit → Apple review (1–3 days) →
21-day read window. Nothing else touches the store page inside a read window.

| Train | Submit | Expected live | Read window closes | Lever changed | Frozen |
|---|---|---|---|---|---|
| **R1 — 3.19.1** | Mon **2026-08-24** | Wed **2026-08-26** – Thu 08-27 | Thu **2026-09-17** | Keywords (7 locales) + promo text + description + **the soft-ask ships** | screenshots, icon, subtitle |
| **R2 — 3.20.0** | Mon **2026-09-28** | Wed **2026-09-30** | Wed **2026-10-21** | **Screenshot order only** (B1) | keywords, subtitle, promo text |
| **R3 — 3.21.0** | Mon **2026-10-26** | Wed **2026-10-28** | Wed **2026-11-18** | Keyword iteration #2 + description reorder (B5) | screenshots, icon |

R2 opens on **2026-09-28** for a specific reason: the live Apple PPO experiment
`cc64b9d2` runs to **2026-09-27**, and it is a *screenshot* test on 66% of
traffic. Changing the live screenshots while it runs changes its control.

### One confound inside R1 that we accept on purpose

R1 ships a keyword change *and* the rating soft-ask together. That is
unavoidable — the soft-ask is code, it only reaches users in a store build, and
it has already been dark for three weeks. The two effects land on **different
metrics**: keywords move impressions, the soft-ask moves rating count. Read them
separately and the bundle costs nothing. Do not read R1's *conversion* as a
keyword result — a rising rating count is moving that number at the same time.

---

## Critical path

```
Submit 3.19.1 (08-24) → Apple approves (08-26/27) → RELEASE MANUALLY
        │
        └── soft-ask reaches iOS users for the first time
                 │
                 └── US ratings accumulate → US storefront average leaves 2★
                          │
                          └── every conversion number downstream becomes trustworthy
```

Everything else in this calendar is parallel work. **If 3.19.1 does not go live
in week 1, nothing else in the 90 days matters** — trust cannot start
accumulating, and the 90-day trust target becomes unreachable because ratings
arrive at roughly one per install-week.

Note `releaseType` is **MANUAL** on the prepared version. Approval does not
publish it. Someone has to press the button.

---

## Week by week

### W1 · Mon 2026-08-24 → Sun 08-30 — unblock iOS

- **Mon 08-24** — Run `04-launch/prelaunch-checklist.md` against 3.19.1 end to
  end. Then **submit build 88 for review**. This is the day's only real deadline.
- **Mon 08-24** — Save the day-0 snapshot so the R1 read has a baseline:
  impressions/day 138.4, imp→PV 9.0%, PV→DL 10.0%, first-time installs 1.24/day
  (r6), 7 ratings @ 4.43, US 1@2★, deletes ÷ first-time installs 69%.
- **Mon 08-24** — Decide the support address (see
  `05-optimization/review-responses.md`): `support@motovault.app` and
  `hello@motovault.app` are both in circulation. Pick one; the loser becomes an
  alias. This has to be settled before R1's description ships with an address in it.
- **Tue 08-25** — Open the Play Console task: create the GCS statistics bucket
  and record the `gs://` URI (instructions in `05-optimization/ongoing-tasks.md`).
  Until this exists there is **no Play install or rating time series at all**, and
  half of this calendar's Play targets are unverifiable.
- **Wed 08-26 / Thu 08-27** — On approval, **release manually**. Verify the live
  listing renders in all 7 locales, then confirm via
  `curl -s "https://itunes.apple.com/lookup?id=6760291360&country=us"` that
  `version` reads 3.19.1 and note `currentVersionReleaseDate` — that date is the
  divider for every before/after comparison in the R1 read.
- **Fri 08-28** — Ship the matching Play release (3.19.1 or later) so the two
  stores stop diverging. Divergence is what created the dark-soft-ask problem.

### W2 · Mon 08-31 → Sun 09-06 — watch the soft-ask, touch nothing

- **Mon 08-31** — Weekly pull (weekly instances, serial). First partial post-R1 week.
- **Daily** — `asc reviews --app 6760291360 --only-unresponded`. Reply inside 24h.
- **Wed 09-02** — First soft-ask signal check: is `review_prompted` firing on
  3.19.1 in PostHog, and is `userRatingCount` on the US storefront above 1? If the
  event fires but no ratings land, the problem is prompt→rating conversion, not
  delivery — that is a different fix and it belongs in R3, not now.
- **No store-page changes this week.** R1's read window is open.

### W3 · Mon 09-07 → Sun 09-13 — parallel work only

- **Mon 09-07** — Weekly pull.
- Build the R2 screenshot set (Expenses → Maintenance → Receipt Scan → Rides →
  Trips → Discover → Crew). Assets exist in the `motovault-v2` set; this is
  re-ordering plus one new Receipt-Scan caption. Do **not** upload it.
- Investigate the **app-referrer decline** (−44% PV/day, −34% first-time DL/day —
  the only metric that moved the wrong way). It overlaps the web→app bridge work,
  it is not a store-page change, and it is safe to touch inside a read window.
- **Create the first Custom Product Page.** There are currently **zero**
  (`asc product-pages custom-pages list --app 6760291360` → `total: 0`). Target:
  SEO/blog inbound, expense-led creative, matching the article that sends the
  click. Web referrer is one of only two sources that *grew* while app referrer
  fell 44%, so this is where the intent is.
  ```bash
  asc product-pages custom-pages list --app 6760291360
  asc product-pages custom-pages create --app 6760291360 --name "SEO / blog inbound"
  ```
  **A CPP sits outside the release-train system entirely** — it is a separate page
  served only to traffic arriving on its own URL, so it cannot contaminate the
  default page's read window, and it needs no version release. It also has no
  significance requirement, which is why it is the one page-level lever that works
  at this traffic (see "The PPO problem"). It does go through App Review, so run
  Gates 1 and 3 of the checklist against its copy and assets.

### W4 · Mon 09-14 → Sun 09-20 — **R1 READ (day 24)**

- **Thu 09-17 — R1 read.** Three post-release weeks vs the three weeks of
  2026-07-27 → 08-16. Compare on weekly instances only.
  - **Primary:** impressions/day. Baseline 138.4. A further step up means the
    3.19.1 keyword field beat 3.18.0's; flat means 3.18.0 already captured the
    available demand and keyword iteration is done as a lever.
  - **Secondary:** rating count and the **US** average specifically. This is the
    number the whole quarter turns on.
  - **Do not** read PV→DL as a keyword result (see the R1 confound).
- **Fri 09-18** — Decide R2's contents from that read. If impressions *fell*, R2
  becomes a keyword rollback instead of the screenshot reorder, and screenshots
  slide to R3.

### W5 · Mon 09-21 → Sun 09-27 — read and retire PPO `cc64b9d2`

- **Mon 09-21** — CPP live (assuming review cleared). **Wire its URL into the blog
  CTAs** so SEO inbound lands on the expense-led page instead of the default one.
  This is the deliverable, not the CPP itself — an unwired CPP receives no traffic.
- **Wed 09-23 (day 30)** — 30-day checkpoint: full funnel + ratings + Play state.
- **Sun 09-27** — PPO `cc64b9d2` ends. Read it **in the ASC UI** (there is no API
  for PPO results) and record the numbers by hand into
  `03-testing/ab-test-setup.md`. Treat the result as **directional only** and say
  so in the record: it ran from 2026-06-29 across a ×2.45 traffic step change on
  2026-07-29, so its two halves are not comparable populations.
- Freeze all screenshot work until it is closed.

### W6 · Mon 09-28 → Sun 10-04 — R2 ships (screenshots)

- **Mon 09-28** — Checklist, then submit **3.20.0: screenshot order only.**
  Keywords, subtitle and promo text carry over byte-identical from 3.19.1. If any
  text field changes here, the R2 read is void.
- **Wed 09-30** — Release. Confirm the new order renders in every locale that has
  localized screenshots.
- **Thu 10-01** — Rotate promotional text for the autumn/winter season **only if
  R2 slipped**; otherwise hold it, because promo text is part of the page and
  moving it inside R2's window muddies the read. Promo text needs no review, so
  it is always available later.

### W7 · Mon 10-05 → Sun 10-11 — retention, not ASO

- **Mon 10-05** — Weekly pull.
- The ceiling on everything in this document is that **~65% of first-time installs
  delete**. Doubling impressions doubled installs and did nothing to that ratio.
  This week is for the activation work (empty-garage cliff), which is outside the
  store page and safe inside a read window.
- **Thu 10-08 (day 45)** — Mid-point sanity check on the three constraint metrics.

### W8 · Mon 10-12 → Sun 10-18 — build R3

- Draft keyword iteration #2 from the R1 read. Note the 3.19.1 fields run
  **92–96 characters of 100** in every locale (en-US 94, en-GB 96, de-DE 95,
  fr-FR 96, it 93, es-MX 92, pt-BR 93) — 4–8 characters of free indexing per
  locale is the cheapest change available and it belongs in R3.
- Draft the description reorder (B5: demote the AI block, lead with expenses and
  maintenance). Re-validate every claim against `FREE_TIER_LIMITS`.

### W9 · Mon 10-19 → Sun 10-25 — **R2 READ (day 58)**

- **Wed 10-21 — R2 read.** Three weeks post-screenshot-reorder vs the three weeks
  before. Report imp→PV and PV→DL with the honest caveat attached: on ~260 page
  views the minimum detectable change is ~±5pp, so **only a very large effect will
  be visible, and a null result is not evidence the reorder failed.** Keep the
  reorder regardless — it is justified by the demand order, not by this read.
- **Fri 10-23 (day 60)** — 60-day checkpoint.

### W10 · Mon 10-26 → Sun 11-01 — R3 ships (keywords + description)

- **Mon 10-26** — Checklist, then submit **3.21.0: keyword iteration #2 +
  description reorder.** Screenshots frozen at the R2 order.
- **Wed 10-28** — Release; verify all 7 locales.

### W11 · Mon 11-02 → Sun 11-08 — Play's turn

- **Mon 11-02** — Weekly pull. R3 read window open, no store-page changes.
- Play work, which has been the neglected half all quarter and does not touch the
  Apple read at all:
  - Play has **zero reviews** and shows **no star rating** at "100+ Downloads".
    The soft-ask has been live on Android since 3.19.0 and has produced nothing
    visible. Verify it actually fires on Android builds.
  - Configure a **Play Store Listing Experiment** by hand in Play Console —
    there is no API and `gplay` has no experiments command, so this cannot be
    scripted or scheduled from here.
  - Confirm the GCS statistics bucket from W1 is producing reports.

### W12 · Mon 11-09 → Sun 11-15 — hold

- **Mon 11-09** — Weekly pull. R3 read window still open. Parallel work only.
- **Sat 11-07 (day 75)** — light checkpoint.

### W13 · Mon 11-16 → Sun 11-22 — **R3 READ + 90-day report**

- **Wed 11-18 — R3 read.** Impressions/day vs the R1 and R2 windows.
- **Fri 11-20 — 90-day report.** Every metric against the day-0 snapshot, with
  each movement attributed to exactly one release train. State plainly which
  levers moved a number and which did not, and retire the ones that did not.
- **Sun 11-22 — day 90.** Draft the next quarter. The likely honest conclusion:
  keyword work is spent, and the next quarter is retention plus Apple Search Ads
  (the only way to buy enough volume to make conversion testing possible).

---

## Read gates

| Date | Gate | Reads |
|---|---|---|
| Wed 2026-08-26 | 3.19.1 live on the App Store | soft-ask reaching real iOS users |
| Wed 2026-09-02 | soft-ask firing | `review_prompted` on 3.19.1 + US `userRatingCount` > 1 |
| Thu 2026-09-17 | **R1 read** | keywords → impressions/day; soft-ask → rating count |
| Mon 2026-09-21 | CPP live and wired into blog CTAs | web-referrer intent captured |
| Wed 2026-09-23 | day 30 | full funnel |
| Sun 2026-09-27 | PPO `cc64b9d2` closes | screenshot direction (directional only) |
| Wed 2026-10-21 | **R2 read** | screenshot order → imp→PV / PV→DL (low power, expect null) |
| Fri 2026-10-23 | day 60 | full funnel |
| Wed 2026-11-18 | **R3 read** | keyword iteration #2 → impressions/day |
| Fri 2026-11-20 | **90-day report** | everything, attributed per train |

---

## Targets

Grounded in the day-0 figures. Where a target cannot be measured today, that is
stated rather than papered over.

| Metric | Day 0 (2026-08-24) | Day 90 (2026-11-22) | Moved by |
|---|---|---|---|
| Impressions / day (Apple) | 138.4 | 160–200 | R1, R3 keywords |
| Impression → page view | 9.0% | hold ≥ 9.0% | not a target; too noisy to steer |
| Page view → download | 10.0% (a PPO blend, not the control page's rate) | hold ≥ 10.0% | R2 screenshots (unmeasurable, ship anyway) |
| Custom product pages | **0** | ≥ 1 live and wired into blog CTAs | W3 → W5 |
| Web-referrer PV/day | 1.03 | ≥ 1.5 | the CPP |
| First-time installs / day (r6) | 1.24 | 1.6–2.0 | follows impressions |
| **US ratings** | **1 @ 2★** | **≥ 5, displayed avg ≥ 4.0★** | **R1 soft-ask** |
| Total ratings | 7 @ 4.43 | ≥ 20 | R1 soft-ask, both platforms |
| Play displayed rating | none | **a rating is displayed at all** | Android soft-ask verification (W11) |
| Play written reviews | 0 | ≥ 1 | same |
| Deletes ÷ first-time installs | 69% | < 60% | activation work (W7), not ASO |
| Play time series available | **no** | yes | GCS bucket task (W1) |

The US rating target is the one that matters and it is the tightest. One new
rating arrived in the five weeks before day 0 against ~90 new installs. Getting
to five *US* ratings in 90 days needs the soft-ask to convert far better than the
bare native prompt did — which is exactly what it was built to do, and has never
been observed doing, because it has never shipped.

Deliberately **not** a target: revenue. Proceeds went $0.52/day → $2.21/day, and
the entire delta is one $29.99 annual conversion. At this volume per-day revenue
rates are noise and should not be reported as rates.

---

## The PPO problem, stated once

The brief held that a screenshot test was underpowered at ~40 impressions/day and
is no longer underpowered at ~138/day. **The arithmetic does not support that**,
and the conclusion has been independently re-derived twice. Two-proportion test,
α=0.05, 80% power:

| Denominator | Base rate | n per arm | 2 arms | **3 arms (`cc64b9d2`'s actual)** |
|---|---|---|---|---|
| impression → download | 0.9% (9.0% × 10.0%) | ~47,500 | 2.9 years | **4.3 years** |
| page view → download | 10.0% | ~3,841 | 2.6 years | **3.9 years** |

**The verdict is denominator-independent.** That matters, because the obvious
objection is that PPO might report on page views rather than impressions — it
does not help. `cc64b9d2` runs three arms (control plus treatments "Know what your
bike really cost" and "One garage"), which is the worst case of the two. The ×3.5
traffic increase moved the requirement from impossible to impossible.

So:
1. Read `cc64b9d2` when it closes on 2026-09-27, record it, and label it
   directional. Do not promote a treatment on it.
2. Do not schedule a new PPO in this 90 days. It would occupy the screenshot
   lever for the whole quarter and return nothing.
3. Ship screenshot decisions on the demand order, one release train at a time,
   and accept directional reads.
4. **Use a Custom Product Page instead** (W6 below). A CPP is not an experiment,
   has no significance requirement, and is therefore the one page-level lever that
   works at this traffic.
5. Revisit PPO only if paid acquisition buys the volume that makes it viable.

### Never quote 10.0% as the live page's conversion rate

Two independent reasons, both about PPO contamination:

1. **Screenshots have been varied for most of traffic since 2026-06-29.**
   `cc64b9d2` runs at 66%, so the "flat 10.0% PV→DL" is a *blend across variants*,
   not the control page's rate.
2. **Allocation was not constant across the comparison window.** Experiment
   `060bdd96` ("Title Test – Maintenance Angles") ran at **75%** traffic through
   2026-06-24; nothing ran 2026-06-25 → 06-28; `cc64b9d2` started at **66%** on
   2026-06-29. The trailing-6-week pre-period (2026-06-15 → 07-26) therefore spans
   **three different allocation regimes**.

Neither threatens the ×2.45 impressions finding — an effect that size survives
this kind of noise easily, and impressions are upstream of the page anyway. Both
mean the absolute conversion figure is a blend of unknown composition and must
never be reported as the live page's CVR.

---

## Contingencies

- **3.19.1 rejected by App Review** → almost certainly a metadata-accuracy
  claim. Fix the copy, resubmit same day, slide every train by one week. The
  descriptions were rewritten for exactly this reason (the 3.18.0 text claimed
  unlimited free bikes and 5 free AI scans; both were false).
- **Apple review runs long** → the read windows shift, the sequence does not.
  Never compress two levers into one train to catch up.
- **A 1–2★ review lands with real text** → reply inside 4h, and if it names a
  bug, hotfix it. A hotfix build with **no metadata change** is always allowed
  inside a read window; that is the point of separating code from store copy.
- **Impressions flat after R1** → 3.18.0 captured the available search demand and
  keyword iteration is a spent lever. Stop iterating keywords in R3; spend R3 on
  the description and shift the quarter's remaining effort to retention.
- **US ratings still at 1 by 2026-09-23** → the soft-ask converts no better than
  the native prompt. Escalate to direct solicitation of known-happy users
  (in-app, email) rather than tuning the prompt further.
- **Play GCS bucket never gets configured** → every Play target above stays
  unverifiable for the quarter. Say so in the 90-day report instead of
  substituting Play Console screenshots for a time series.

---

## What this calendar deliberately does not contain

No pre-launch content, no submission countdown, no "launch day". The app has been
live for five months and the store page is already the single largest thing
either release train touches.
