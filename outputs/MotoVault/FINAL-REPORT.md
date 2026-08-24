# MotoVault ASO audit — executive summary, 2026-08-24

_Full ASO audit: three specialist phases (research / optimization / strategy) over
first-party App Store Connect and Play data. Every figure verified this session; no
modelled or estimated numbers. Action list: `00-MASTER-ACTION-PLAN.md`._

---

## 1. Are we growing? Yes at the top, no at the bottom.

3.18.0 shipped rebuilt keyword fields on 2026-07-29. Against the six weeks immediately
before it (matched window, same source, weekly series):

| Per day | Before | After | |
|---|---|---|---|
| Impressions | 56.5 | 138.4 | **×2.45** |
| Product-page views | 5.02 | 12.43 | **×2.47** |
| First-time installs | 0.50 | 1.24 | **×2.48** |
| Impression→page view | 8.9% | 9.0% | flat |
| Page view→download | 10.0% | 10.0% | flat |

Three metrics, three near-identical multiples, both ratios unchanged: **the funnel scaled
linearly and it is attributable**, because 3.18.0 was a metadata-only change. The week of
Aug 10 (1,160 impressions) is the highest ever; Aug 17–22 held at ~132/day, so it is not a
decaying spike.

Where growth stops: **7 ratings total**, **~65% of first-time installs delete**, 3 paying
users, and both v4 annual SKUs showing purchases at **$0.00 sales** (trials only). A wider
funnel was built on top of an unchanged leak.

## 2. The finding that outranks the rest

**31 of 46 Play locales advertise a free tier that does not exist.** Swept at source in
`store/play/metadata/`: 24 locales claim "unlimited bikes" as part of the free tier when
`MAX_BIKES` is 1, and 18 promise 5 free AI diagnostic scans when the limit is 1.

This is Play policy exposure (misrepresentation), EU consumer-protection exposure, and the
most plausible single explanation for the ~65% delete rate — a rider installs expecting a
free unlimited garage and hits a one-bike wall. That causal link is a hypothesis, not a
measured fact, but it is the right shape and it is testable by fixing the copy and watching
the deletion ratio.

The iOS 3.19.1 rewrite fixed this bug class for the App Store. Play never got it.

## 3. The next multiple is in the subtitle, not the keyword field

The field-weight ladder, measured on MotoVault's own listing (one app across its three
indexed fields, so the iTunes-vs-App-Store engine caveat cannot explain it; replicates in
all 7 locales):

| Query | Matching term lives in | US rank |
|---|---|---|
| `motorcycle garage` | **name** | **1 of 16** |
| `motorcycle expense` | **subtitle** | **3 of 18** |
| `motorcycle cost` | keyword field | 14 of 14 |
| `motorcycle carplay` | keyword field | 19 of 19 |
| `motorcycle maintenance` | keyword field | **absent from top 20** |

Name ≫ subtitle ≫ keyword field. **The ×2.45 came from the keyword field alone** — the
subtitle changed only word order in 3.18.0 (`Service, Expense, Trip & Ride` →
`Expense, Service, Trip & Ride`, identical token set, so nothing new was indexed) and
Apple does not index promotional text at all. So the *weakest* surface delivered ×2.45 by
itself, and **the two higher-weight surfaces have been untouched since launch.**

The priority edit is one string per locale: **subtitle → `Expense & Maintenance Tracker`**,
demoting `service` into the field to preserve the GB rank. `tracker` — the category's most
common name noun and July's #1 identified gap — is currently indexed nowhere at all. This
reverses July's B2 action, which put `maintenance` into the keyword field: right term,
wrong field.

## 4. You cannot test your way there

Two-proportion z-test, α=0.05, 80% power, against verified traffic:

| Test | Effect | Time needed |
|---|---|---|
| PPO, 2 arms | +20% relative | 2.9 years |
| PPO, 3 arms (`cc64b9d2` as configured) | +20% relative | **4.3 years** |
| PPO, 2 arms | +50% relative | 6 months |

PPO's denominator is impressions, so the base rate is 9.0% × 10.0% ≈ 0.9%. Checked against
the alternative reading (page-view→download, base 10%): 2.6–3.9 years. **Denominator-
independent.** Conversion is not measurable here by any method (±5–10pp MDE on a 10% base).
Impressions *are* measurable — which is precisely why 3.18.0 gave a clean read.

Consequences: stop `cc64b9d2` (read it in the ASC UI first — it is attached to 3.18.0 and
3.19.1 has zero experiments attached, so release will orphan ~3 months of accrual); ship
screenshot and copy changes directly at 100% of traffic; run sequential one-lever-per-
release tests on 21-day reads; do **not** open a Play experiment at "100+ downloads".

## 5. Three free discovery channels have never been used once

- `asc nominations list` → 0 draft, 0 submitted, 0 archived. **The editorial/featuring
  channel has never been touched.** Apple asks ~3 weeks' lead; the CarPlay Driving Task
  entitlement (case 20710293) is a rare hook and 3.19.1 is in review now.
- `asc app-events list` → one in-app event, `6772116373`, state `DRAFT`, never published.
  In-app events surface on Today/category/search and need no chart velocity.
- `asc app-tags list` → empty. Zero Apple discoverability tags attached.
- `custom-pages list` → 0. No Custom Product Page exists for blog/SEO inbound.

**Do not change primary category.** All 57 Apple categories were enumerated: there is no
automotive or motorcycle category, charts run on download velocity (1.24 installs/day is
nowhere near Top 200 of anything), and a change forfeits five months of category-relevance
signal. Also killed: there is no App Store "CarPlay apps" browse collection, so any plan
premised on CarPlay creating a browse surface is void.

## 6. The competitive picture changed since July

The direct motorcycle cluster is still wide open — ceiling 11 ratings across our 7
storefronts, and 8 of 22 apps at literally zero. But "the whole cluster is 0–6 ratings" is
**refuted in two target markets**: Italy has My Garage at **1,428 @ 4.4** (abandoned since
2020, beatable on freshness) and France has EMX at **88 @ 4.7, shipping today**.

**A clone farm arrived.** The same queries that returned 7 competitors in July return 22.
Fifteen entrants are one product under locale-exact-match names (`Motorrad Wartung–FixioMoto`,
`Entretien moto–FixioMoto`, Iron, Garagely, Cylabike, MotorApp, Revvo). Zero ratings, zero
retention — and they outrank MotoVault in every localized maintenance query, purely because
the query string is their app name. That is the field-weight ladder weaponised, and it is
beatable with a metadata change. The cluster now ships weekly: move competitor review from
quarterly to monthly.

## 7. Trust is narrower than 4.43★ suggests

7 ratings / 4.43 average resolves to **exactly 2 ratings inside the seven storefronts we
maintain listings for** (US 1@2.0, DE 1@4.0). Every positive rating we own is in a
storefront with no localized listing (SK, BE, MK, CL). In the US — 40% of impressions — we
display **the worst visible rating in the entire result set**, and a zero-rating competitor
shows no stars at all, which is strictly better than showing 2.0.

The rating soft-ask exists but is a bare `Alert.alert` (`store-review.ts:116`) despite its
docstring promising a themed sheet, and it stamps `REVIEWED_VERSION_KEY` at line 103 —
*before* the alert renders — so a dismissal burns that version's only attempt. It is live on
Android (3.19.0) and reaches **zero iOS users**, who are all on 3.18.0.

## 8. Corrections this audit made to prior work

| Prior claim | Reality |
|---|---|
| "Reply to the US 2★" (top of the July plan) | **Impossible.** Star-only rating; Apple has no response mechanism. Never was executable. |
| "1 rating, US 2★, zero elsewhere" | 7 ratings / 4.43 across 6 countries. Prior audits queried only the 8 localized storefronts. |
| "~15% deletion rate" | Divided by *all* install events (mostly auto-updates). Real figure ≈ **65% of first-time installs**. |
| "Impression→PV collapsed 19.4% → 8.8%" | Artifact of a Mar–Jun average inflated by two tiny-denominator outlier weeks. True pre-release rate was 8.9%; it is **flat**. |
| "At ~138 impr/day PPO is no longer underpowered" | Wrong by >1 order of magnitude. 2.9–4.3 years. |
| "Proceeds flat at $0.43/day" | Sparse daily pull missed a sale. $0.52 → $2.21/day, but the whole delta is one $29.99 conversion. |
| Keyword volumes like "45K/month" in the July file | **Invented.** No Apple search volume exists without a Search Ads campaign. Removed, not carried forward. |
| "B4 localized keyword fields — open" | Already done in the prepared 3.19.1. |
| "PPO results are entirely un-queryable" | Config *is* queryable via `asc product-pages`; only results are UI-only. |

## 9. Biggest remaining blind spot

**No Apple Search Ads campaign exists**, so there are no Apple search volumes and no
term-level impression data. Every demand judgement in this audit is ordinal. A $5/day ASA
campaign is the cheapest way to close that gap and would make the keyword work measurable
per-term rather than per-release.

Secondary: Play install/rating time series are unavailable until the Play Console GCS
reports bucket is configured.

## 10. Do these, in this order

1. **Rewrite the 31 Play descriptions** to match the free tier that actually ships.
2. **Press release on 3.19.1** — it is `WAITING_FOR_REVIEW` with `releaseType: MANUAL`, so
   approval will not publish it. This is what finally delivers the soft-ask to iOS.
3. **Submit a featuring nomination** while the CarPlay hook and a release are both live.
4. **Change the subtitle** in all 7 locales (3.20.0, on its own, so the read is clean).
5. **Read then stop `cc64b9d2`**; build a Custom Product Page for blog inbound.
6. **Start a $5/day ASA campaign** to get real search volumes.
