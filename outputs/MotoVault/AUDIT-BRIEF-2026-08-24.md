# Audit brief — verified facts as of 2026-08-24

**Every number here was pulled first-party this session. Do NOT invent, round, or
"estimate" figures. If you need a number that is not here, either fetch it yourself from
a real source (iTunes API, `asc`, `gplay`, store page) or state explicitly that it is
unknown.** This is an established app with 5 months of real data, NOT a pre-launch app —
do not produce launch-countdown content.

## App identity

- **App**: MotoVault — motorcycle ownership app (expenses, maintenance, rides, trips, routes, AI diagnostics)
- **Apple**: app id `6760291360`, iOS, free + Pro IAP. Categories **Utilities** (primary) + **Lifestyle**. First released **2026-03-20**.
- **Google Play**: package `com.motovault.app`
- **Positioning truth (PostHog-validated)**: feature demand order is **expenses > maintenance > rides > trips > AI**. AI diagnostics is the LEAST used feature and must NOT be the hero.
- **Target markets**: Europe + Americas only. Not India.
- **Free-tier constraint**: logging maintenance + expenses is free forever and must never be paywalled or count-limited. `FREE_TIER_LIMITS.MAX_BIKES` is 1; free AI diagnostic scans = 1.
- **Live Pro pricing** (offering `paywall_v4`): iOS monthly $9.99, annual $79.99, lifetime $149.99. Play annual $59.99. **Never hardcode a price into localized store copy** — localized listings serve many territories and a USD figure is wrong in most.

## Version state — the two stores are OUT OF SYNC

| | Live version | Notes |
|---|---|---|
| App Store | **3.18.0** (released 2026-07-29) | 3.19.1 metadata prepared (`outputs/appstore-release-3.19.1/metadata-3.19.1.json`, build 88, MANUAL release) but NOT submitted/live |
| Google Play | **3.19.0** (version code 81, production, completed) | ahead of iOS |

Consequence: the rating **soft-ask** (merged `c5fb8253`, 2026-08-03) is in the 3.19.0 tree,
so it **is live on Android** but reaches **zero iOS users** (they are all on 3.18.0).

## Apple funnel — WEEKLY series, one full backfill instance covering 2026-03-16 onward

| Per day | Full pre-period (03-16→07-26, 19wk) | Trailing 6 weeks (06-15→07-26) | Post-3.18.0 (07-27→08-16, 3wk) |
|---|---|---|---|
| Impressions | 47.1 | 56.5 | **138.4** |
| Product-page views | 7.98 | 5.02 | **12.43** |
| First-time installs (r6 sample) | 0.83 | 0.50 | **1.24** |
| Impression→page view | 17.0% | **8.9%** | **9.0%** |
| Page view→download | 10.5% | **10.0%** | **10.0%** |

**Against the trailing 6 weeks: impressions ×2.45, page views ×2.47, first-time installs
×2.48, with both conversion ratios FLAT.** The funnel scaled linearly after 3.18.0 shipped
the rebuilt keyword fields + expense-first subtitle + first non-empty promo text on
2026-07-29.

Weekly impressions: 06-29 331 · 07-06 310 · 07-13 485 · 07-20 405 · **07-27 854 · 08-03 892 · 08-10 1,160** (highest ever, 165.7/day).

- Impression source mix: **96% App Store search / 4% browse** (unchanged). Search converts impressions to page views at ~4.8%; browse at ~42%.
- **App referrer went BACKWARDS** — was the largest baseline page-view source, now −44% PV/day (3.09→1.73) and −34% first-time-DL/day (0.97→0.64). Everything else grew.
- Territories, top-18 impressions = **87% target markets**. US 1,565 (40%), **BR 325 (now #2, ~10× its baseline rate)**, GB 261, DE 156, MX 155, FR 96. Non-target: AU 95, IN 93, TR 80, PH 69, TH 45, VN 43.
- r3 cross-check (24 matched days): first-time downloads **3.08/day** vs 2.66/day in the July baseline.

## Trust — authoritative via `asc reviews ratings --app 6760291360 --all`

**7 ratings, average 4.43, across 6 countries**: SK 2@5★ · BE 1@5★ · MK 1@5★ · CL 1@5★ · DE 1@4★ · **US 1@2★**.

- Earlier audits claimed "1 rating, US 2★, zero elsewhere" — that was an artifact of only querying the 8 localized storefronts. All the positive ratings are in storefronts nobody checked.
- The real problem is narrow: **the US storefront shows a lone 2★ and the US is 40% of impressions.**
- **Three written reviews existed, all 5★, all unanswered; all three were answered 2026-08-24** (SVK ch8659, CHL Moqueca19, BEL ing.roman) — state `PENDING_PUBLISH`.
- **The US 2★ CANNOT be replied to** — it is a star-only rating with no review text and Apple has no mechanism for responding. Any recommendation to "reply to the US 2★" is invalid; strike it.
- Play Store: `gplay reviews list` returns **zero reviews**. Play page shows **"100+ Downloads"** and **no star rating** (below Play's display threshold).

## Monetization — too small for rate comparisons

Proceeds $0.52/day pre-release → $2.21/day post, but the entire delta is **one** `MotoVault Pro Annual v2` conversion ($29.99 / $21.00 proceeds, week of 08-03 — first annual sale since June). Most purchase events are $0 trial starts. **Both v4 annual SKUs show purchases with $0.00 sales** — trials only, no v4 annual conversion yet.

## Retention

The old "~15% deletion rate" divided deletes by ALL install events (mostly auto-updates) and is wrong. Against **first-time** installs in the r6 sample: **72/111 = 65% pre-release, 18/26 = 69% post**. Roughly two-thirds of new installs delete. Rough cohort proxy (deletes lag installs) but the right order of magnitude.

## Current live Apple metadata (as of 3.18.0)

- Name en-US: `MotoVault: Motorcycle Garage`; localized names exist (de-DE `Motorrad-Garage`, es-MX `Garaje de Motos`, pt-BR `Garagem de Motos`, en-GB uses "Motorbike").
- Subtitle en-US: expense-first ordering shipped in 3.18.0.
- Description opens: "Know exactly what your motorcycle costs you—and never miss a service again."
- 7 fully-localized listings: en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR. Play listings expanded to **46 locales** (2026-08-10).
- Screenshots: `motovault-v2` set, captioned, but **MIS-ORDERED** — Trips → Rides → Expenses(#3) → Maintenance(#4). Should lead with Expenses → Maintenance → Receipt Scan.
- 3.19.1 prepared keywords en-US: `receipt,maintenance,fuel,reminder,cost,mileage,repair,budget,oil,tire,chain,carplay,rider,bike`; promo text leads on CarPlay + receipt scanning.

## Existing experiment state

- Apple **PPO experiment `cc64b9d2`** ("Title Test", 66% traffic, Jun 29 – Sep 27) is really a **screenshot** test — PPO can only vary icon / screenshots / preview, **never text**. It was badly underpowered at ~40 impressions/day; at ~138/day it no longer is. Results are visible only in the ASC UI, not via API.
- Google Play **Store Listing Experiments have no public API** — `gplay` has no experiments command. They must be configured by hand in Play Console.
- Play statistics reports need a GCS bucket URI from Play Console that is **not configured**, so Play install/rating time series are unavailable via CLI right now.

## Tooling notes

- `asc` CLI is authenticated (app 6760291360). **A few hundred analytics calls throttles the WHOLE ASC API** — run serially.
- An ASC "DAILY" analytics instance carries a **rolling multi-day window**; summing across instances multi-counts. Prefer WEEKLY instances.
- Ratings need no ASC call: `curl -s "https://itunes.apple.com/lookup?id=6760291360&country=XX"`.
- Two support addresses are in circulation: `support@motovault.app` (privacy policy, web) and `hello@motovault.app` (`apps/mobile/src/lib/store-review.ts:25`). Needs consolidating.

## Prior deliverables to build ON, not duplicate

`docs/ASO-Snapshot-2026-08-24.md` (this session's diff), `outputs/MotoVault/DATA-FOUNDATION.md` + `00-MASTER-ACTION-PLAN.md` (2026-07-22, now partly superseded), `docs/ASO-Review-2026-07-15.md`.
