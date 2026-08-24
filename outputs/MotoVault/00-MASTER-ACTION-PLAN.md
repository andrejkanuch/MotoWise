# MotoVault — ASO Master Action Plan

_Rebuilt 2026-08-24 from first-party App Store Connect + Play data and three specialist audits.
Every figure verified this session. Supersedes the 2026-07-22 version._
_Data: `AUDIT-BRIEF-2026-08-24.md` · `docs/ASO-Snapshot-2026-08-24.md`_

## The one-paragraph diagnosis

**Reach is fixed. The Play listing is lying about the free tier, and that is now the
biggest problem in the funnel.** 3.18.0's keyword rebuild (live 2026-07-29) multiplied App
Store impressions ×2.45, and page views and installs followed at ×2.47 and ×2.48 with
conversion ratios dead flat — a clean, attributable win. But **24 of 26 sampled Play
locales advertise "unlimited bikes, free forever" when `MAX_BIKES` is 1**, and 9 of them
promise "5 AI diagnostic scans per month" when the limit is 1. Meanwhile ~65% of
first-time installs delete the app. You cannot A/B test your way out of that; no
experiment at this traffic can reach significance anyway. The order is now
**accuracy → trust → measurable text changes**, and PPO comes off the board entirely.

---

## Priority 0 — STOP MIS-SELLING THE FREE TIER (this week)

Swept at source across all 46 locale dirs in `store/play/metadata/` (authoritative — this
is what ships), cross-checked against the live public listing:

| False claim | Truth (`packages/types/src/constants/limits.ts`) | Locales |
|---|---|---|
| "unlimited bikes" as part of the **free** tier | `MAX_BIKES: 1` | **24 of 46** |
| "5 free AI diagnostic scans / month" | `MAX_AI_DIAGNOSTICS_PER_MONTH: 1` | **18 of 46** |

**31 of 46 locales carry at least one false claim** — 11 carry both, 13 the bike claim
only, 7 the scan claim only:

```
cs-CZ da-DK de-DE el-GR en-AU en-CA en-GB en-IN en-US es-419 es-ES es-US et fi-FI fil
hu-HU it-IT ja-JP ko-KR lt lv nl-NL no-NO pt-BR pt-PT ro ru-RU sk sl sv-SE uk
```

Clean, and to be left alone: **fr-FR, hu-HU, pl-PL and tr-TR mention "unlimited" only in a
Pro/paid context, which is correct** — do not "fix" those four. (An earlier scrape-based
pass put the count at 21 of 26 and marked pl-PL clean; the source sweep supersedes it. The
lesson: scraping missed locales whose phrasing the patterns didn't match, which is exactly
the failure mode the caveat predicted.)

The iOS 3.19.1 description rewrite fixed exactly this bug class for the App Store.
**Play never got the fix.**

- [x] **P0-1 — Sweep all 46 Play locales.** Done 2026-08-24 at source; lists above.
- [ ] **P0-2 — Rewrite the 31 affected Play descriptions** to match source constants. This
      needs translated copy in ~30 languages — it is the largest single piece of work in
      this plan and it is not mechanical. Full free-tier table (7 constants) is in
      `04-launch/prelaunch-checklist.md`. Never quote a price.
- [ ] **P0-3 — fr-FR needs a full rewrite, not a patch** — it is a structurally different,
      stale template (its own free-scan number, 3, disagrees with every other locale).
- [ ] **P0-4 — Add Receipt Scan to Play copy.** It has been live on Android since 3.19.0
      and **zero** Play locales mention it.

Why this outranks every ASO task: it is a Play policy exposure (misrepresentation), an
EU consumer-protection exposure, and the most plausible single explanation for a ~65%
delete rate — a rider installs expecting a garage of bikes, finds a one-bike wall, and
leaves. That last link is a hypothesis, not a measured fact, but it is the right shape.

## Priority 1 — TRUST (weeks 1–4)

7 ratings, 4.43 average: SK 2@5★ · BE 1@5★ · MK 1@5★ · CL 1@5★ · DE 1@4★ · **US 1@2★**.
The US supplies 40% of impressions and shows the single worst rating the app has.

- [ ] **A1 — ~~Reply to the US 2★~~ STRUCK. Not possible.** It is a star-only rating with
      no review text; Apple provides no mechanism to respond. This item sat at the top of
      the plan since July and was never executable.
- [ ] **A2 — Release 3.19.1.** It is `WAITING_FOR_REVIEW` with `releaseType: MANUAL`, so
      **approval will not publish it — someone must press release.** This is the only
      action that puts the rating soft-ask in front of an iOS user; it has reached zero of
      them for three weeks (Android has had it since 3.19.0).
- [ ] **A3 — Replace the soft-ask `Alert.alert` with a designed sheet.** `store-review.ts:116`
      is a bare OS alert despite its docstring promising a themed confirm. Prompt→rating
      conversion is the only link in this chain we control; Apple's dialog is a black box.
- [ ] **A4 — Fix the key-stamp ordering.** `REVIEWED_VERSION_KEY` is set at line 103,
      *before* the alert renders, so a dismissal burns that version's only attempt. Not a
      bug by intent (it prevents nagging) but it makes frequent release trains
      load-bearing for rating volume.
- [x] **A5 — Answer the three 5★ reviews.** Done 2026-08-24 (SVK, CHL, BEL), all
      `PENDING_PUBLISH`. The BEL reviewer had thanked "the developer who is actively
      responding" while having no reply on file.
- [ ] **A6 — Consolidate on `support@motovault.app`** (owner decision, 2026-08-24). Change
      `store-review.ts:25` (`hello@`) and the App Store support URL; privacy policy and
      web footer already agree.

## Priority 2 — REACH: the next multiple is in the SUBTITLE, not the keyword field

**The field-weight ladder, measured on our own live listing** (same engine, same app, so
the iTunes-vs-App-Store engine difference cannot explain it — and it replicates across all
7 locales):

| Query | Where our matching term lives | Our US rank |
|---|---|---|
| `motorcycle garage` | **name** | **1 of 16** |
| `motorcycle expense` | **subtitle** | **3 of 18** |
| `motorbike service` (GB) | **subtitle** | **4 of 14** |
| `motorcycle cost` | keyword field | 14 of 14 |
| `motorcycle carplay` | keyword field | 19 of 19 |
| `motorcycle maintenance` | keyword field | **absent from top 20** |
| `motorcycle repair` | keyword field | **absent from top 15** |

Name ≫ subtitle ≫ keyword field, and the gap is not subtle. **We do not rank at all for
`motorcycle maintenance` — the #2 demand term — because it sits in the weakest field.**
Meanwhile the subtitle spends 11 of its 29 characters on `Trip` and `Ride` (demand #4 and
#3) in queries owned by REVER (16,125 ratings), Scenic (7,387) and Detecht (3,795) —
slots that cannot be won and are not what our users came for.

- [x] **B2/B3/B4 — keyword rebuild, expense-first subtitle, localized keyword fields.**
      Shipped in 3.18.0 → ×2.45 impressions. B4 is done in the prepared 3.19.1; the old
      plan still listed it open.
- [ ] **B8 — THE PRIORITY EDIT: subtitle → `Expense & Maintenance Tracker`** (29/30), with
      `service` demoted into the keyword field so the GB `motorbike service` rank survives.
      One string per locale. Full copy-paste set with verified limits and zero cross-field
      token duplication is in `01-research/keyword-list.md`. Note this **reverses** July's
      B2, which put `maintenance` into the keyword field — that was the wrong field.
- [ ] **B9 — Fix two untranslated subtitles**: es-MX is `Gasto, Servicio, Viaje & Ride` and
      pt-BR is `Custo, Serviço, Viagem & Ride` — the English word **"Ride"** is live in both
      Spanish and Portuguese listings.
- [ ] **B10 — Fix the 8 unmanaged app-info localizations.** 15 locales carry an indexed
      name/subtitle pair but only 7 have a keyword field. Worst string in the account: the
      **`fi` subtitle is `Service, Trips & AI Mechanic` — English text in a Finnish listing
      that leads on AI**, the least-used feature. `es-ES` and `pl` are routes-first,
      contradicting demand order. Decide deliberately on `hi`/`th`/`id`/`tr`: they cost
      nothing but dilute imp→PV with traffic that will never convert, and they correlate
      with the junk-geography tail (IN 93, TR 80, PH 69, TH 45 impressions).
- [ ] **B6 — Spend the unused keyword characters** (3.19.1 fields are 92–96 of 100).
- [ ] **B7 — Fix keyword/subtitle duplication** in de-DE (`Wartung`), fr-FR (`entretien`),
      pt-BR (`custo`). Swap to `Inspektion` / `révision` / `revisão`.
- [ ] **B1 — Reorder screenshots** to Expenses → Maintenance → Receipt Scan → Rides →
      Trips. Ship directly at 100% of traffic; do **not** put it in a PPO arm (Priority 3).
      The `motovault-v2` assets are already captioned — a reorder of 4 approved assets plus
      one new Receipt Scan slide.

### The competitive picture changed since July

- **The direct motorcycle cluster is still wide open**: ceiling is 11 ratings across our 7
  storefronts, and 8 of 22 apps have literally zero. But the July "whole cluster is 0–6"
  claim is **refuted in two target markets** — Italy has **My Garage at 1,428 ratings**
  (abandoned since 2020, so beatable on freshness) and France has **EMX at 88 @ 4.7,
  shipping today**. IT and FR need a different argument than "nobody here has reviews."
- **A clone farm arrived.** The same queries that returned 7 competitors in July return
  **22**. Fifteen new entrants are one product shipped under locale-exact-match names
  (FixioMoto, Iron, Garagely, Cylabike, MotorApp, Revvo — e.g. `Motorrad Wartung–FixioMoto`,
  `Entretien moto–FixioMoto`). **They have zero ratings and zero retention, and they
  outrank us in every localized maintenance query** — purely because the query string is
  their app name. That is the field-weight ladder above, weaponised. It is also beatable
  with a metadata change, and once we hold the rank we hold it with a real product.
- **Update cadence is now weekly across this cluster.** A quarterly competitor review is
  too slow; make it monthly.
- **Our trust position is narrower than 4.43★ suggests: inside the 7 storefronts we
  actually localize, we have exactly 2 ratings** (US 1@2.0, DE 1@4.0). Every positive
  rating we own is in a storefront with no localized listing (SK, BE, MK, CL). In the US we
  display **the worst visible rating in the entire result set** — and an app with zero
  ratings shows no stars at all, which is strictly better than showing 2.0.

### Browse: don't change category, use the channel that has never been touched

Browse is 4% of impressions but already 21% of page views (2.12 of 10.3/day) at ~42%
imp→PV. **Do not change the primary category**: the full Apple category list was pulled —
57 entries, **no vehicle/automotive category exists** — and category charts run on download
velocity, which at 1.24 installs/day is nowhere near Top 200 of anything. A change would
forfeit five months of category-relevance signal for a chart position unreachable either way.

- [ ] **B11 — Submit a featuring nomination.** `asc nominations list` returns **0 DRAFT, 0
      SUBMITTED, 0 ARCHIVED — the editorial channel has never been used once.** This is the
      sanctioned route to Today-tab and collection placement, it is free, and it is the one
      genuinely untapped acquisition channel found in this audit.
- [ ] **B1 — Reorder screenshots** to Expenses → Maintenance → Receipt Scan → Rides →
      Trips. Ship it directly at 100% of traffic; do **not** put it in a PPO arm (see
      Priority 3). The `motovault-v2` assets are already captioned — this is a reorder of
      4 approved assets plus one new Receipt Scan slide.

## Priority 3 — TESTING: PPO is off the board, and here is the arithmetic

Two-proportion z-test, α=0.05, 80% power, against verified traffic (138.4 impressions/day,
12.43 page views/day, imp→PV 9.0%, PV→DL 10.0%):

| Test | Effect | Days needed |
|---|---|---|
| PPO, 2 arms | +20% relative | **2.9 years** |
| PPO, 3 arms (`cc64b9d2` as configured) | +20% relative | **4.3 years** |
| PPO, 2 arms | +50% relative | 6 months |

PPO's conversion denominator is impressions, so the base rate is 9.0% × 10.0% ≈ **0.9%**.
Checked against the alternative reading (page-view→download, base 10%): 2.6–3.9 years.
**The verdict is denominator-independent.** Tripling traffic moved PPO from impossible to
impossible.

Conversion is not measurable here *by any method* — ~12.4 page views/day gives ±5–10pp
MDE on a 10% base, i.e. 50–100% relative. **Impressions are measurable** (854–1,160/week
against a ~400/week baseline), which is exactly why the 3.18.0 metadata-only change gave
a clean read.

- [ ] **C1 — Read `cc64b9d2` in the ASC UI before 3.19.1 goes live, then stop it.**
      Directional only, never significant. **Time-critical:** the experiment is attached to
      version 3.18.0 and 3.19.1 has **zero** experiments attached — experiments do not
      carry across versions, so ~3 months of accrual becomes unreadable at release. Results
      are UI-only; `asc product-pages experiments` exposes config but not results.
- [ ] **C2 — Build a Custom Product Page** for SEO/blog inbound. **Zero exist today**
      (`custom-pages list` → `total: 0`). A CPP is not an experiment, has no power
      requirement, and is addressable by URL — the only page-level lever that works at this
      traffic. Web referrer is one of two sources that grew while app referrer fell 44%.
- [ ] **C3 — Do NOT run a Play Listing Experiment.** Play is at "100+ downloads" with zero
      reviews; lifetime exposure does not clear a single power threshold. Revisit above 500+.
- [ ] **C4 — Sequential text tests on release trains instead.** One lever per release,
      never keywords and screenshots together, 21-day read. This is the only design that
      yields a signal at this volume.

## Priority 4 — MEASUREMENT (unblock, then keep honest)

- [ ] **D1 — Configure the Play GCS stats bucket.** Play install/rating time series are
      currently unavailable via CLI. URI from Play Console → Download reports → Copy Cloud
      Storage URI, then `gplay reports stats list --bucket-id gs://pubsite_prod_rev_<id>
      --package com.motovault.app --type installs|ratings`. The step that usually fails is
      Storage Object Viewer on the bucket, which is separate from Play Console access.
- [ ] **D2 — Retire two wrong numbers from all docs**: the "~15% deletion rate" (divided by
      all install events, mostly auto-updates; real figure is ~65% of first-time installs)
      and the "19.4% impression→page-view baseline" (a Mar–Jun average inflated by two
      tiny-denominator outlier weeks; the true pre-release rate was 8.9%).
- [ ] **D3 — Never quote 10.0% as the live page's conversion rate.** A PPO experiment has
      been varying screenshots on 66–75% of traffic since 2026-05-29 (`060bdd96` at 75% to
      06-24, `cc64b9d2` at 66% from 06-29), so it is a blend across variants under three
      different allocation regimes. The before/after ×2.48 survives; the absolute does not.

## Release trains (from `04-launch/timeline.md`)

| Train | Submit | Live | Read closes | Lever | Frozen |
|---|---|---|---|---|---|
| R1 3.19.1 | 08-24 | ~08-27 | 09-17 | keywords ×7 + promo + description; soft-ask ships | screenshots, subtitle |
| R2 3.20.0 | 09-28 | ~09-30 | 10-21 | screenshot reorder ONLY | keywords, subtitle, promo |
| R3 3.21.0 | 10-26 | ~10-28 | 11-18 | keyword iteration #2 + description reorder | screenshots |

R2 opens 09-28 because `cc64b9d2` ends 09-27 and it is a screenshot test — changing live
screenshots earlier rewrites its control. R1 deliberately bundles keywords with the
soft-ask: the effects land on different metrics (keywords→impressions,
soft-ask→rating count) and the soft-ask cannot wait.

## Deliverables map

| Area | File |
|---|---|
| Verified data brief | `AUDIT-BRIEF-2026-08-24.md` |
| Funnel diff + method traps | `docs/ASO-Snapshot-2026-08-24.md` |
| Keywords | `01-research/keyword-list.md` |
| Competitor gaps | `01-research/competitor-gaps.md` |
| Apple metadata, 7 locales | `02-metadata/apple-metadata.md` |
| Play metadata | `02-metadata/google-metadata.md` |
| Screenshot / PPO asset spec | `02-metadata/visual-assets-spec.md` |
| Experiment programme + power tables | `03-testing/ab-test-setup.md` |
| 90-day operating calendar | `04-launch/timeline.md` |
| Per-release ASO gate | `04-launch/prelaunch-checklist.md` |
| Review responses + rating playbook | `05-optimization/review-responses.md` |
| Measurement cadence + real commands | `05-optimization/ongoing-tasks.md` |

## Single most important move

**Fix the Play listing, then press release on 3.19.1.** Everything else is optimisation on
top of a store page that currently promises riders a free unlimited garage and delivers
one bike.
