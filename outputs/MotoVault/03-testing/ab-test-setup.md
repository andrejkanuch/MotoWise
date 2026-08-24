# MotoVault — ASO Experiment Programme (2026-08-24)

**Supersedes** the 2026-07-22 version of this file. **App:** MotoVault, Apple ID
`6760291360` (iOS) + `com.motovault.app` (Play). This is an **established app**
(first released 2026-03-20), not a pre-launch app — every test below is sized
against real traffic pulled this session, not assumptions.

**The question this file answers: what can we actually test to grow faster, and
which of the obvious ideas are a waste of calendar time at our current volume.**
Two platform facts drive every design choice here and are non-negotiable:

- **Apple Product Page Optimization (PPO) can only vary icon, screenshots, and
  the app preview video — never text.** Title/subtitle/keywords/description
  changes are **not A/B-testable on iOS**; they are sequential before/after
  changes tied to a version release, read with the same WEEKLY-analytics
  methodology used to validate 3.18.0's ×2.45 impression lift.
- **Apple Custom Product Pages (CPP)** are a separate, non-experimental,
  URL-addressable surface — not a test, a dedicated landing page. Right tool
  for SEO/blog inbound traffic, not for hypothesis testing.
- **Google Play Store Listing Experiments are the only true text A/B test we
  have** (short description, full description, icon, screenshots, feature
  graphic) — but there is no public API for them (`gplay` has no `experiments`
  command; confirmed again this session). They must be built by hand in Play
  Console, and — see Test 7 — our Play install base is currently too small for
  one to ever reach significance.

Every power calculation below uses a two-proportion z-test at **α=0.05,
80% power** (`n/arm = (1.96+0.84)² · [p₁(1-p₁)+p₂(1-p₂)] / (p₁-p₂)²`) against
these **verified, first-party** rates (`AUDIT-BRIEF-2026-08-24.md`,
`docs/ASO-Snapshot-2026-08-24.md`, re-confirmed live via `asc` this session):

| Metric | Value |
|---|---|
| Impressions/day | **138.4** (post-3.18.0, 07-27→08-16) |
| Product-page views/day | **12.43** |
| First-time installs/day | **1.24** |
| Impression → page view | **9.0%** |
| Page view → download | **10.0%** |
| Impression → download (combined) | **0.90%** |

No figure below is invented. Where a number doesn't exist (Play traffic), that
is stated plainly rather than estimated.

---

## Program, in priority order (expected value per day of calendar time)

| # | Surface | Action | Type | Time-to-signal |
|---|---|---|---|---|
| 0 | Release pipeline | Ship 3.19.1 | Prerequisite, not a test | Immediate — already queued |
| 1 | Screenshots (default page) | Render captions + fix lead order | Ship directly, sequential read | ~3 weeks |
| 2 | Play listing text | Fix 2 false claims + reorder | Ship directly | ~3 weeks |
| 3 | Apple keyword field | Fix 2 duplicate-token bugs (fr-FR, pt-BR) | Ship directly, zero risk | N/A — just do it |
| 4 | PPO screenshots | Stop `cc64b9d2`, restart clean 2-arm test | True A/B (visual only) | ~4 months for a 50%+ lift |
| 5 | Custom Product Page | Build expense-led CPP for web/blog referrers | Dedicated surface, not a test | ~90 days to read |
| 6 | PPO icon | 2-arm test, launch Q4 | True A/B (visual only) | ~4.5 months for a 50%+ lift |
| 7 | Play Listing Experiment | **Do not run yet** | Blocked | Unsizeable — see verdict |

---

## Test 0 — Ship 3.19.1 (prerequisite, not an experiment)

**Status, verified live this session:** version `3.19.1` (build 88) is
**`WAITING_FOR_REVIEW`** in App Store Connect right now — not merely
"prepared," as the audit brief (written earlier the same day) stated. Its
version-locale fields (keywords, promotional text, description, what's-new)
are already pushed to ASC for all 7 locales — confirmed by pulling the live
`fr-FR`/`pt-BR`/`en-US` keyword strings from the `WAITING_FOR_REVIEW`
version and diffing them against `metadata-3.19.1.json` byte-for-byte.

**Why this sits above every test below:** it's what delivers the rating
soft-ask (`c5fb8253`, merged 2026-08-03) to real users for the first time —
the soft-ask has reached **zero** users for three weeks because the
`runtimeVersion` policy is `appVersion` and every live user is still on
3.18.0. Trust (currently one US 2★ pulling down the storefront that supplies
40% of impressions) is the standing bottleneck on every conversion number a
test below would measure. This is not a test because there's no hypothesis
to disprove — just review latency to wait out.

**Action:** nothing to configure. Track `asc versions list --app 6760291360`
for the state transition; expect it live within Apple's typical review
window (historically 24–48h for this app once submitted, per prior release
cadence).

---

## Test 1 — Fix the screenshot caption/order gap (ship directly, not PPO)

**This is not an A/B test. It should not be one.** The live screenshots
**are captioned** (correcting an earlier draft of this program that said
otherwise) but are ordered **Trips → Rides → Expenses(#3) → Maintenance(#4)**
— inverted against the PostHog-validated demand order (expenses >
maintenance > rides > trips > AI). Every asset for the correct order already
exists and is already approved (see `visual-assets-spec.md`); the only new
work is one receipt-scan slide and the upload order itself. A demand-inverted
default page isn't a hypothesis to test against a control — there's no
plausible story where PostHog's own usage data is wrong and the current
order is right. Fixing it outright reaches **100% of traffic immediately**,
where locking the same fix inside a PPO treatment arm would only reach
22–45% of it (see Test 4) and take months to read.

**Hypothesis (for the sequential read, once shipped):** captioned,
correctly-ordered screenshots raise page-view→download above the flat 10.0%
baseline.

**How to read it (sequential before/after, the same method that validated
3.18.0):** pull WEEKLY `r14`+`r6` instances for the 3 weeks before and the 3
weeks after the screenshot re-upload, compare PV→DL. **Honest caveat:** at
12.43 PV/day, 21 days ≈ 261 PV total — enough to see a clean directional
move if the fix is as large as the reasoning in `visual-assets-spec.md`
suggests (going from zero informational content to captioned, ordered
screenshots is not a marginal copy tweak), but not enough for a
publication-grade confidence interval. Treat the read as "did it move the
needle," not as a certified lift percentage — and don't let that uncertainty
be an excuse to leave a confirmed bug live for a full PPO test.

**Action:** see `visual-assets-spec.md` for the exact caption/order spec and
`02-metadata/action-metadata.md` Step 4 for the upload checklist. Bundle into
the 3.19.1 screenshot set if it hasn't shipped yet; otherwise fast-follow.

---

## Test 2 — Fix two Play listing accuracy bugs + demand reorder (ship directly)

Pulled the **live Play listing** this session via `gplay listings get
--package com.motovault.app` (edit `17982315747694595646`). Two claims in the
current en-US full description are **factually false against verified
product limits**, and are the exact class of bug the 3.19.1 iOS description
rewrite was built to eliminate — Play just never got the same fix:

1. `"Unlimited bikes—track every bike you own, free forever"` and `"Free
   forever includes unlimited bikes"` — **`FREE_TIER_LIMITS.MAX_BIKES` is 1.**
2. `"5 AI diagnostic scans per month"` — **the free limit is 1**, per the same
   audit brief and matching what iOS 3.19.1 already says correctly ("1 AI
   diagnostic ... every month").
3. The short description leads with **"Motorcycle maintenance tracker"**
   (maintenance-first), not expense — same ordering mistake the Apple
   subtitle already fixed in 3.18.0.

This is not a hypothesis to test; it's App Review 2.3.1/3.1.2-class metadata
accuracy risk sitting live on the store that has zero reviews and thus zero
buffer if a rider notices the mismatch and reports it. Fix outright — see
`google-metadata.md` for the corrected copy for all locales this touches.

---

## Test 3 — Fix two Apple keyword-field waste bugs (ship directly, zero risk)

Character-by-character diff of the live `WAITING_FOR_REVIEW` (3.19.1)
localizations against their own subtitles found **two locales duplicating a
word across subtitle and keyword field** — wasted bytes that could hold a
new term instead, in a field that is already the identified growth lever:

| Locale | Subtitle (live) | Keyword field (live) | Duplicate |
|---|---|---|---|
| fr-FR | `Frais, Entretien & Trajets` | `...,entretien,...` | **entretien** |
| pt-BR | `Custo, Serviço, Viagem & Ride` | `...,custo,...` | **custo** |

Apple indexes both fields as one search surface, so the duplicate word buys
nothing it wasn't already getting from the subtitle. See
`02-metadata/apple-metadata.md` for the exact replacement keywords and the
`asc` command to push them. This has no controversy to A/B — it is strictly
better to spend the freed characters on an unindexed term.

---

## Test 4 — PPO screenshot experiment: stop the stale one, restart clean

**Current state, pulled live this session** (`asc product-pages experiments
list --v2 --app 6760291360`):

| Field | Value |
|---|---|
| ID | `cc64b9d2-5365-47fb-be9e-05332168dddc` |
| Name in ASC | "Title Test - " *(misnamed — its two treatments are named "Know what your bike really cost" and "One garage," which are screenshot-hero themes, not titles — confirming the audit brief's correction: **PPO cannot vary text, so this was always a screenshot test mislabeled**)* |
| Traffic | 66% (split across control + 2 treatments ≈ 22% each) |
| State | APPROVED / running |
| Window | 2026-06-29 → 2026-09-27 |

There is also an older, already-**STOPPED** experiment (`060bdd96...`,
"Title Test - Maintenance Angles", 75% traffic, 2026-05-29 → 2026-06-24) —
same mislabeling pattern, already concluded with no read surfaced outside
the ASC UI (the API exposes no results endpoint for v2 experiments).

### The power math for `cc64b9d2`, using real accumulated traffic

`cc64b9d2` started 2026-06-29, **30 days before** the 3.18.0 ramp
(2026-07-29) that took impressions from ~47/day to 138/day. Most of its
lifetime traffic accrued at the *old*, much lower rate. Reconstructing PV
from the verified weekly-impression series and the verified imp→PV rates:

| Period | Weeks | Impressions | Est. PV (×8.9–9.0%) |
|---|---|---|---|
| Pre-ramp (06-29→07-26) | 4 | 1,531 | 136 |
| Post-ramp, known weeks (07-27→08-16) | 3 | 2,906 | 262 |
| Last ~8 days (through 08-24, at 12.43 PV/day) | — | — | 99 |
| **Total PV since start** | | | **≈497** |

At 66% experiment traffic split 3 ways: **≈497 × 0.66 ÷ 3 ≈ 109 PV per arm**
accumulated so far. From today to the 2026-09-27 end date is 34 more days at
the *current* 12.43 PV/day rate: **+90 PV per arm**. **Total per arm at
natural expiry ≈ 200 PV.**

Required PV per arm to detect a lift over the 10.0% PV→DL baseline at 80%
power / 95% confidence:

| Relative lift | p₂ | Required PV/arm |
|---|---|---|
| 20% (10%→12%) | 0.120 | 3,834 |
| 30% (10%→13%) | 0.130 | 1,769 |
| **50% (10%→15%)** | **0.150** | **682** |

**Verdict: letting `cc64b9d2` run to its natural 2026-09-27 end date gives
~200 PV/arm — 3.4× short of the ~682 needed even to detect a 50% relative
lift, the largest lift worth planning around.** It cannot produce a
meaningful read regardless of which arm "wins" in the ASC dashboard. Do not
trust whatever the UI shows at expiry as a real signal.

**Decision: stop it now, don't let it quietly expire.** Restarting
immediately (rather than at the 09-27 boundary) buys 34 extra days of the
*current*, higher traffic rate instead of losing them to an already-diluted
test.

```
asc product-pages experiments update --experiment-id cc64b9d2-5365-47fb-be9e-05332168dddc --started false --v2
```

### The restart: fewer arms, higher traffic share, timed after Test 1 ships

Two efficiency fixes vs. the old config:
- **2 arms (control + 1 treatment), not 3.** Halves the traffic dilution per
  arm for the same `trafficProportion`.
- **Push `trafficProportion` as high as ASC accepts.** The CLI's own help
  text and both historical experiments here (66%, 75%) show no documented
  ceiling; treat 90% as the target and use whatever ASC actually allows at
  creation time — there's no confirmed hard cap to cite.
- **Wait for Test 1 to ship first.** The *control* arm of a new test should
  be the corrected, captioned, correctly-ordered screenshots — not the
  currently-broken blank ones. Testing a treatment against a known-broken
  control wastes the whole test on re-discovering Test 1's fix.

**Hypothesis:** leading with a receipt-scan/CarPlay-forward hero frame (the
2 new 3.19.1 differentiators) out-converts the expense-led hero once the
caption/order baseline is fixed.

**Power math at the restart's best-case config (90% traffic, 2 arms):**

| Relative lift | Required PV/arm | PV/day/arm (12.43×0.90÷2=5.59) | Days | Months |
|---|---|---|---|---|
| 20% | 3,834 | 5.59 | 685 | 22.8 |
| 30% | 1,769 | 5.59 | 316 | 10.5 |
| **50%** | **682** | 5.59 | **122** | **4.1** |

**Honest verdict: this test can only reach significance for a large (≈50%+
relative) lift, and only in about 4 months even under the most efficient
config.** Smaller, more typical screenshot lifts (10–20%) are not detectable
in any planning horizon shorter than 1.5–4 years at current traffic. Run it
anyway — it's cheap (no engineering cost) and 4 months is within the
program's horizon — but do not schedule a decision before ~2026-12-24
(started ~2026-08-31, +~4 months), and do not stop it early on a "trending"
result; the math above says trends before then are noise.

```
asc product-pages experiments create --v2 --app 6760291360 --platform IOS \
  --name "PPO_Hero_ReceiptCarPlay_vs_Expense" --traffic-proportion 90
# then, once the experiment ID is returned:
asc product-pages experiments treatments create --experiment-id <NEW_ID> --name "Receipt+CarPlay hero"
# Screenshot image assets for control/treatment are uploaded in the ASC web UI
# under Product Page Optimization — the CLI manages the experiment container
# and treatment names, not per-treatment image uploads.
```

---

## Test 5 — Custom Product Page for web/blog referral traffic (not a test)

**Not an experiment — a dedicated, URL-addressable page**, and the right
tool for the traffic bucket that's actually declining. Verified this
session: **app referrer PV/day fell from 3.09 (baseline) to 1.73 (post-3.18.0)
— down 44%** — while every other source grew. Web referrer PV/day grew from
0.70 to 1.03 but is still tiny. Combined app+web referrer traffic is
**≈2.76 PV/day** — small, but it's the highest-intent bucket (visitors who
already clicked a specific CTA) and the one place a CPP reads faster than a
PPO test because we control which visitors land on it.

**Build:** expense-tracker-led hero (matches the SEO blog intent — "track
motorcycle costs/fuel/service history") wired as the destination URL from
every blog/web store CTA, replacing the generic App Store link.

**Sizing the read honestly:** at ~2.76 PV/day feeding the CPP once wired in,
even a full quarter (90 days) yields only ~250 PV total — not enough for a
formal significance test against the default page, only a before/after
directional comparison of that one source's own PV→DL rate. Budget 90 days
minimum before drawing any conclusion, and treat this as a fix for a
declining metric, not a statistically-validated optimization.

**Also flag, don't block on:** the app-referrer regression overlaps the
web→app attribution bridge work already tracked separately (deep links,
share sheets, Play-referrer-seeded onboarding). The CPP addresses where
that traffic *lands*; it doesn't explain why referrer volume dropped. That
investigation is separate engineering work, not an ASO metadata fix.

---

## Test 6 — PPO icon test (longest horizon; start in Q4)

Icon is visible in **search results** (impressions), not just the product
page, so its relevant metric is the combined **impression→download rate,
currently 0.90%** — a much smaller base rate than PV→DL, which means an icon
test needs far more raw traffic to move the needle statistically.

| Relative lift | Required impressions/arm | At 90% traffic / 2 arms (62.3 impr/day/arm) | Months |
|---|---|---|---|
| 20% | 47,433 | 762 days | 25.4 |
| 30% | 22,027 | 354 days | 11.8 |
| **50%** | **8,609** | **138 days** | **4.6** |

**Verdict: same shape as the screenshot test — only a ≈50%+ relative lift is
detectable in a sane window (~4.5 months), and only with a 2-arm, high-
traffic-share config.** Icon changes are historically capable of that size
of lift (10–30% is the commonly-cited range elsewhere in this program's
prior draft, but note that figure is not sourced from our own data — treat
it as an industry prior, not a MotoVault-verified number). Given it needs
more runway than the screenshot test, sequence it to start once Test 4 has
already been running a few weeks so they don't compete for review-review
bandwidth, target a **2026-Q4 launch date**, expect a read no earlier than
**~2027-Q1**.

---

## Test 7 — Google Play Listing Experiment: do not run yet

This is the one true text A/B test in the entire program, and it is also the
one test with **no real number to power it**. What's actually known,
verified this session:

- Play's install-count badge shows the **"100+" bucket** — Play's
  lowest-nonzero display tier, meaning cumulative installs since the app's
  Play listing went up are somewhere in **[100, 499]**.
- `gplay reviews list` returns **zero reviews**, confirming volume this low.
- The Play Console statistics GCS bucket needed for any real traffic report
  is **not configured**, so there is no install/PV time series to pull via
  API right now — this is a blocker, not a missing analysis step.

**Order-of-magnitude reasoning (explicitly not a real estimate — a bound):**
even a generous read of "100–499 installs over ~5 months" is at most ~3.3
installs/day *averaged over the app's whole life*, an order of magnitude
below Apple's own already-underpowered 1.24 first-time-installs/day. Apple's
own PV (12.43/day) needed 682–14,731 exposures per arm to detect anything
above a 50%-relative lift; Play's total *lifetime* exposure to date doesn't
clear a single one of those thresholds, let alone per arm, let alone per
day. There is no traffic configuration — no traffic-proportion knob, no
2-arm vs 3-arm choice — that fixes an order-of-magnitude traffic gap.

**Verdict: do not build a Play Listing Experiment now. It cannot reach
significance within any planning horizon this program would consider (a
year or more), and every day spent configuring one is better spent making
the sequential fixes in Test 2 live, since those reach 100% of Play's
(small) traffic immediately instead of splitting it further.**

**What to do instead, in order:**
1. Configure the Play Console statistics GCS bucket now so this stops being
   unmeasurable — that alone is a bigger unlock than any test design.
2. Ship the Test 2 accuracy/reorder fixes directly (no experiment needed).
3. Revisit a real Play Listing Experiment once Play crosses the **next**
   Play install-count bucket (500+) — that's a real, observable trigger to
   re-run this section's math with actual numbers, not a calendar date.

---

## Cadence rules (unchanged from the prior pass, still correct)

- One PPO experiment running at a time — concurrent tests pollute
  attribution and both would be reading through the same 12.43 PV/day.
- Never hand-edit a field a sequential test is mid-read on.
- Promote a PPO winner only at ≥95% confidence *and* the relative lift the
  power table above says was actually reachable in the elapsed time — a
  "trending" result before the required sample size is noise, not signal.
- Re-baseline every conversion number once 3.19.1's rating soft-ask has had
  a few weeks to move the US storefront off 2★ — a lift measured under a
  visibly bad rating may not hold once trust improves.
- Never lead a hero frame, subtitle, or short description with **AI** — it's
  demand rank #5. Every treatment/control pair above keeps AI last.
- Don't target India/Turkey audiences in any variant — Europe + Americas
  only.

---

## Tracking table

| ID | Surface | Type | Variant(s) | Start | Read-by | Power verdict |
|---|---|---|---|---|---|---|
| 0 | Release | Ship | 3.19.1 | now (WAITING_FOR_REVIEW) | on approval | N/A |
| 1 | Screenshots | Ship + sequential read | Captioned/reordered vs current blank | with 3.19.1 or fast-follow | +21 days | Directional only, ~261 PV |
| 2 | Play listing | Ship | Corrected copy | immediate | +21 days | N/A (bug fix) |
| 3 | Apple keywords | Ship | fr-FR/pt-BR dedupe | immediate | N/A | N/A (zero-risk) |
| 4 | PPO screenshots | True A/B | Receipt+CarPlay hero vs Expense hero, 2-arm/90% | after Test 1 ships | ~2026-12-24 | Only ≥50% lift detectable (~682 PV/arm) |
| 5 | CPP | Ship, non-experimental | Expense-led landing page | wire into blog CTAs now | +90 days | Directional only, ~250 PV total |
| 6 | PPO icon | True A/B | Current vs 1 new icon, 2-arm/90% | 2026-Q4 | ~2027-Q1 | Only ≥50% lift detectable (~8,609 impr/arm) |
| 7 | Play experiment | Blocked | — | not now | revisit at 500+ installs bucket | Unsizeable — no traffic data exists |
