# MotoVault — ongoing ASO measurement cadence

**Rewritten 2026-08-24.** App Store id `6760291360` · Play package `com.motovault.app`.
Pairs with `04-launch/timeline.md` (the 90-day release-train calendar) and
`04-launch/prelaunch-checklist.md` (the per-release gate).

What this cadence exists to watch, in priority order:

1. **Trust** — 7 ratings @ 4.43 total, but the **US storefront shows a lone 2★** and the US is 40% of impressions. Play shows **no rating at all** and has **zero reviews**.
2. **Reach** — 138.4 impressions/day post-3.18.0, up ×2.45 from 56.5. Already fixed once; watch for decay.
3. **Conversion** — imp→PV 9.0%, PV→DL 10.0%. Both flat. Monitor, do not chase (see "What is measurable" below).
4. **Retention** — ~65–69% of first-time installs delete. The ceiling on everything above, and not an ASO lever.

---

## Read this before you pull a single number

### Trap 1 — an ASC "DAILY" instance is not one day of data

Each DAILY analytics instance carries a **rolling multi-day window**. r14
instances hold ~3 calendar days, r3/r12 hold 1–2, and one r6 instance restated
five months back to 2026-03-24. **Consecutive instances overlap, so summing rows
across files multi-counts every shared date.** Naive summing produced 5,882
impressions where the true figure was 3,919 — a 50% overstatement.

Two rules, and both are mandatory:

- **Attribute each calendar date to exactly one instance** — the newest that
  reports it — and ignore that date's rows everywhere else.
- **Never mix granularities in one sum.** WEEKLY and MONTHLY instances restate the
  same calendar time as the DAILY ones. A single `r12-MONTHLY` row for 2026-07-01
  silently double-counted all of July until it was excluded.

**Prefer WEEKLY instances.** They cover a month in ~5 requests where DAILY takes
~35, and one periodically ships a **full backfill** — the `r14-WEEKLY` instance
with processing date 2026-08-14 restated everything from 2026-03-16, which is a
single authoritative source spanning both sides of the 3.18.0 release and is why
the before/after comparison carries no methodology mismatch. When you see a
backfill instance, use it and throw away your stitched daily series.

Validation that this rule works, worth repeating on future pulls: of 17 dates
reported by more than one instance, **15 were byte-identical**, and the
daily-derived weekly totals matched the WEEKLY instances exactly (405 / 854 / 892
for the weeks of Jul 20, Jul 27, Aug 3).

### Trap 2 — analytics calls throttle the entire App Store Connect API

A few hundred analytics calls throttles **everything**, not just analytics.
Unrelated endpoints (`asc versions list`, `asc builds list`) start failing with
`context deadline exceeded` for tens of minutes. **Run every analytics pull
serially** — `-P 1` or `-P 2`, never a fan-out. This is also the second reason to
prefer WEEKLY instances: ~5 requests instead of ~35 for the same month.

If a non-analytics `asc` command starts timing out, assume you throttled yourself
and wait it out. Do not retry in a loop; that extends the penalty.

### Trap 3 — ratings do not need ASC at all

`itunes.apple.com/lookup` is public, unthrottled, and per-territory. Use it for
every daily ratings check and spend zero ASC budget.

---

## What is measurable at this volume, and what is not

Weekly impressions run 854–1,160 — thousands of observations, so an impression
change of the size 3.18.0 produced (×2.45) is unmissable. Page views run
~12.4/day, so a 21-day window holds ~260 of them at a 10% download rate; the
minimum detectable change there is roughly **±5 percentage points on a 10% base**.

So: **report conversion, steer on impressions and ratings.** A PV→DL number that
moves 1–2pp between windows is noise, and treating it as a signal is how you end
up "fixing" something that never changed.

This is also why no Product Page Optimization test is scheduled. At α=0.05 / 80%
power, a +20% relative lift needs ~47,500 impressions per arm on the 0.9%
impression→download base (**4.3 years** at `cc64b9d2`'s three arms) or ~3,841 page
views per arm on the 10% page-view→download base (**3.9 years** at three arms).
**The verdict is denominator-independent** — it does not matter which one PPO
reports on. Full working in `timeline.md`.

### Never quote 10.0% as the live page's conversion rate

Two independent reasons:

1. `cc64b9d2` (2026-06-29 → 2026-09-27, 3 arms) varies **screenshots on 66% of
   traffic**, so every PV→DL figure is a **blend across variants**.
2. **Allocation was not constant** across the comparison window: `060bdd96`
   ("Title Test – Maintenance Angles") ran at **75%** through 2026-06-24, nothing
   ran 06-25 → 06-28, then `cc64b9d2` at **66%** from 06-29. The trailing-6-week
   pre-period (06-15 → 07-26) spans **three allocation regimes**.

Neither threatens the ×2.45 impressions finding — impressions are upstream of the
page and an effect that size survives this noise. Both mean the absolute
conversion number is a blend of unknown composition. Cite it as such or not at all.

---

## Daily — ~10 minutes

```bash
APP=6760291360

# 1. Unanswered reviews. Reply 1-2★ < 4h, everything < 24h.
asc reviews --app $APP --only-unresponded --sort -createdDate

# 2. US ratings — the one number that matters most right now.
curl -s "https://itunes.apple.com/lookup?id=$APP&country=us" \
  | python3 -c "import json,sys;d=json.load(sys.stdin)['results'][0];print(d['version'],d['userRatingCount'],d['averageUserRating'])"
```

- [ ] Reply to anything unanswered (templates: `review-responses.md`).
- [ ] US `userRatingCount` — has it moved off 1? That is the 90-day headline metric.
- [ ] Crash-free rate (Sentry, and Play Vitals for Android — **Sentry has JS source
      maps only, no ProGuard/NDK symbols**, so Android native crashes are not
      symbolicated there). A crash spike drives the already-bad delete rate higher.
- [ ] **No ASC analytics calls in the daily loop.** They are the throttling risk and
      the data does not change fast enough to justify it.

**While waiting on 3.19.1 to go live:** also check PostHog for
`review_soft_ask_shown` on the 3.19.1 build. Zero shows means the soft-ask is not
reaching anyone and the trust plan is still blocked.

---

## Weekly — ~45 minutes, Mondays

Full ratings picture. **`--all` is not optional** — querying only the 8 localized
storefronts is exactly what produced the false "1 rating, zero elsewhere"
baseline and missed SK, BE, MK and CL, where every positive rating lives.

```bash
asc reviews ratings --app 6760291360 --all
```

Then the analytics pull. Serial. Weekly instances only.

```bash
export ASC_TIMEOUT=240s
APP=6760291360
REQ=f25db9b3-06e1-4442-a33b-98cf84224602    # ONGOING request, daily since 2026-07-15

# report ids for the request
asc analytics view --request-id $REQ --paginate --output json

# instance ids for a report (r14 = Discovery & Engagement)
asc analytics reports links --report-id r14-$REQ --paginate

# granularity + processing date for an instance — check this BEFORE downloading
asc analytics instances view --instance-id <IID>

# segment ids
asc analytics instances links --instance-id <IID>

# the data
asc analytics download --request-id $REQ --instance-id <IID> --segment-id <SID> --decompress
```

Reports that matter:

| Report | Contains |
|---|---|
| **r14** App Store Discovery & Engagement | impressions, product page views, by source and territory |
| **r3** App Store Downloads | first-time downloads |
| **r6** App Store Installs & Deletions | deletes, first-time installs |
| **r12** App Store Purchases | purchase events, sales, proceeds |

Weekly checklist:

- [ ] Impressions/day vs the 138.4 baseline. **Decay is the thing to catch** — a
      keyword win can be re-ranked away by a competitor.
- [ ] Source mix. It has been **96% search / 4% browse** throughout. Search converts
      impressions to page views at ~4.8%, browse at ~42%, so the 4% is
      disproportionately valuable and any movement there is worth noticing.
- [ ] **App referrer** — the one metric that went backwards: PV/day 3.09 → 1.73
      (−44%), first-time DL/day 0.97 → 0.64 (−34%), while every other source grew.
      It is the bucket deep links, share sheets and the web→app bridge land in.
- [ ] Territory mix. Top-18 is 87% target markets; US 40%, **BR now #2 at ~10× its
      baseline rate**. Non-target (AU, IN, TR, PH, TH, VN) is organic — do not spend
      to serve it, do not optimise copy for it.
- [ ] New ratings this week, by territory.
- [ ] Review themes. Three reviews naming the same gap jumps the roadmap; at this
      volume that pattern is worth more than the individual reviews.
- [ ] If a read window is open: **confirm nothing changed on the store page.** A
      promo-text rotation needs no App Review and is therefore the easiest way to
      accidentally void a read.

**Do not** report a revenue rate weekly. Proceeds went $0.52/day → $2.21/day and
the entire delta is one $29.99 annual conversion. At this volume per-day revenue
is noise; report absolute counts (purchase events, and whether any **v4** annual
SKU has produced a non-zero sale yet — as of 2026-08-24 both show purchases with
$0.00, i.e. trials only).

---

## Per release train — at submit, at go-live, and at +21 days

Driven by `timeline.md`. Three points per train:

1. **At submit** — run `prelaunch-checklist.md` Gate 6 and save the pre-release
   baseline. No baseline, no read.
2. **At go-live** — record `currentVersionReleaseDate` from the iTunes lookup. That
   date is the divider for the whole comparison, and it is the only reliable way to
   date a metric ramp against a metadata change.
3. **At +21 days** — the read. Three post-release weeks vs the three weeks before,
   weekly instances on both sides, and **attribute the movement to the one lever
   that train changed.** If two levers changed, write down that the read is void
   rather than picking a story.

---

## Monthly — ~2 hours

- [ ] Full funnel table vs the previous month: impressions/day, source split,
      imp→PV, PV→DL, first-time installs/day, deletes.
- [ ] Ratings scorecard by territory vs the `timeline.md` targets.
- [ ] Keyword field audit. The 3.19.1 fields run **92–96 of 100 characters** in
      every locale — unused characters are wasted indexing and the cheapest
      available change. Also worth a look:
      `asc app-tags` (Apple-generated discoverability tags) for what Apple thinks
      the app is about, versus what the keyword field claims.
- [ ] Competitor glance (Fuelio, Drivvo, Simply Auto, aCar) — new screenshots or
      subtitles worth reacting to next train.
- [ ] Retire figures that were wrong. Two are already retired and must not be
      re-quoted: **"~15% deletion rate"** (wrong denominator — it divided deletes
      by all install events, mostly auto-updates; the real figure is ~65% of
      *first-time* installs) and **"1 rating, US 2★, nothing elsewhere"** (an
      artifact of not passing `--all`).

---

## Open task — Play statistics have no time series at all

**Status: blocked, and it blocks half the Play targets in `timeline.md`.**

`gplay reports stats` requires a **GCS bucket URI** that does not exist in this
account's configuration. Without it there is **no Play install, rating or
store-performance time series available from the CLI** — the only Play numbers we
have are the public store page ("100+ Downloads", no rating displayed) and
`gplay reviews list` returning zero.

To unblock it:

1. Play Console → **Download reports** (any of Statistics / Reviews / Financial).
2. Click **Copy Cloud Storage URI**. It looks like `gs://pubsite_prod_rev_<numeric-id>`.
3. Confirm the service account `gplay` authenticates as has **Storage Object
   Viewer** on that bucket — Play Console access alone is not enough; the bucket is
   a separate GCS permission and this is the step that usually fails.
4. Record the URI in `.gplay/config.yaml` (or export it) so it is not re-discovered
   every time.
5. Verify:

```bash
gplay reports stats list \
  --bucket-id "gs://pubsite_prod_rev_XXXXXXXXXXXX" \
  --package com.motovault.app \
  --from 2026-03 --output table

gplay reports stats download \
  --bucket-id "gs://pubsite_prod_rev_XXXXXXXXXXXX" \
  --package com.motovault.app \
  --type installs --from 2026-03 --to 2026-08 --dir ./aso-data/play

gplay reports stats download \
  --bucket-id "gs://pubsite_prod_rev_XXXXXXXXXXXX" \
  --package com.motovault.app \
  --type ratings --from 2026-03 --to 2026-08 --dir ./aso-data/play
```

`--type` also accepts `crashes`, `store_performance`, `subscriptions`, `all`.
`store_performance` is the Play analogue of Apple's r14 and is what makes the two
platforms comparable at all.

Until this exists, say "unavailable" in reports. Do not substitute a Play Console
screenshot for a time series and do not estimate.

---

## What has no API and must be done by hand

| Thing | Why |
|---|---|
| **Apple PPO *results*** (`cc64b9d2`) | the numbers are visible only in the ASC UI. Transcribe into `03-testing/ab-test-setup.md` when it closes 2026-09-27. **The config is *not* UI-only** — see the commands below; only the results are. |
| **Play Store Listing Experiments** | no public API at all; `gplay` has no experiments command. Configure in Play Console, record the config in the repo. |
| **Review replies** | technically scriptable (`asc reviews respond`), deliberately manual. A solo-built app's replies are its voice. |
| **Replying to the US 2★** | **not possible by any means.** It is a star-only rating with no review text; Apple offers no response mechanism for those. See `review-responses.md`. |

---

## Product pages — what you *can* query

Experiment **configuration** and custom product pages are fully scriptable. Only
experiment *results* are UI-only. Check this before every release (it is Gate 0 of
`prelaunch-checklist.md`) rather than relying on memory of what is running:

```bash
APP=6760291360

# What experiments exist, at what traffic proportion, over what dates
asc product-pages experiments list --v2 --app $APP
asc product-pages experiments view --id <EXPERIMENT_ID>
asc product-pages experiments treatments list --experiment-id <EXPERIMENT_ID>

# Custom product pages
asc product-pages custom-pages list --app $APP
asc product-pages custom-pages create --app $APP --name "SEO / blog inbound"
```

Known experiment history, worth keeping here because it is what makes the
conversion numbers uninterpretable: `060bdd96` "Title Test – Maintenance Angles"
at **75%** through 2026-06-24 → gap 06-25 to 06-28 → `cc64b9d2` "Title Test",
3 arms (control + "Know what your bike really cost" + "One garage") at **66%**,
2026-06-29 to 2026-09-27. Both vary **screenshots**; PPO cannot vary text no
matter what the experiment is named.

**Custom product pages: `total: 0` as of 2026-08-24.** That is the notable finding
here. A CPP has no significance requirement, so it is the only page-level lever
that functions at this traffic, and none exists. Once one is live, monitor it
monthly: its page views and conversion are reported separately in ASC, and the
comparison against the default page is a genuinely usable read because the
populations are self-selected by source, not split by an underpowered experiment.

---

## Automate vs keep manual

**Worth automating:** the daily `asc reviews --only-unresponded` check and the
iTunes ratings lookup (cheap, unthrottled, and the US count is the headline
metric); the weekly weekly-instance download into `./aso-data/`; crash alerts.

**Keep manual:** review replies; keyword and subtitle wording; screenshot
decisions; and every analytics *interpretation* step — the DAILY-window trap above
is exactly the kind of thing a script will happily sum into a 50% overstatement.

---

**North star.** Reach was the constraint and it was fixed: 3.18.0 tripled
impressions with conversion flat. What remains is trust — one 2★ in the storefront
that supplies 40% of impressions, and a Play page with no rating at all — and
retention, where two-thirds of new installs delete. Neither is fixed by another
keyword field. Ship 3.19.1, get the soft-ask in front of real iOS users, and
measure one lever at a time.
