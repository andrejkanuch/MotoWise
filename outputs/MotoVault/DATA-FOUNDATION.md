# MotoVault — First-Party ASO Data Foundation
_Source: App Store Connect Analytics API (request f25db9b3 ONGOING + 58166e75 snapshot), iTunes lookup, live listing. Pulled 2026-07-22._

## App identity
- **Title (28/30):** `MotoVault: Motorcycle Garage`
- **Subtitle (29/30):** `Service, Expense, Trip & Ride`
- **Keywords (100):** `log,cost,reminder,gas,record,bike,repair,chain,tire,part,mileage,mpg,fuel,oil,history,budget,vehicle`
- **Categories:** Utilities (primary) + Lifestyle
- **Price:** Free + MotoVault Pro ($4/mo, $36/yr)
- **First released:** 2026-03-20 (~4 months old). Live store version 3.16.0; 3.18.0 in review.
- **App Store locales:** en-US, en-GB, de-DE, it, es-MX, fr-FR, pt-BR

## THE headline problem: no social proof
- **US: 2.0★ from 1 rating.** All other territories: 0 ratings.
- A single 2★ review is the first thing a shopper sees → measurable CVR drag. This is the #1 fixable ASO lever.

## Funnel (App Store Discovery & Engagement, Mar–Jun 2026, monthly)
| Month | Impressions | Product-page views | Imp→PV |
|---|---|---|---|
| 2026-03 | 541 | 108 | 20.0% |
| 2026-04 | 610 | 89 | 14.6% |
| 2026-05 | 1,763 | 493 | 28.0% |
| 2026-06 | 1,926 | 247 | 12.8% |
| **Total** | **4,840** | **937** | **19.4%** |
- Also: 553 "Tap" events.
- **~40 impressions/day.** Top-of-funnel reach is the biggest constraint — the app is barely surfaced.

### Impressions by source
- App Store **search 4,606 (95%)** · browse 234 (5%). Almost **zero browse/featured discovery** — no editorial/category surfacing.

### Product-page views by source
- **App referrer 377 (largest)** · App Store search 351 · browse 117 · Web referrer 86.
- Search drives 95% of impressions but under-delivers page views; app/web referrals (deep links, our own web) punch above their weight.

### Top territories by impressions
US 2,066 (43%) · DE 379 · GB 256 · FR 141 · IN 132 · BR 124 · IT 119 · TR 108 · AU 88 · SK 83 · CA 79 · ES 68.
- Note: IN/TR appear despite EU+Americas targeting (see memory `feedback_no_india_market`).

## Downloads (App Downloads, daily history)
- **First-time downloads: 325 total** — Mar 51, Apr 36, **May 142 (spike)**, Jun 72, Jul 24 (partial).
- By source: search 150 · **app referrer 118** · web referrer 46 · browse 10.
- Other: 1,010 auto-updates, 68 manual updates, 47 redownloads, 6 restores.
- **Page-view→download ≈ 35%** (325/937) — conversion is respectable *once people reach the page*; the leak is upstream (impressions) and trust (ratings).

## Retention proxy (Install & Deletion)
- Installs 467 · Deletions 71 → **~15% deletion rate.**

## Monetization (App Store Purchases, historical)
- **Lifetime: $96.16 sales / $62.32 proceeds.** 23 purchase events, only **7 paying-user rows**; 17 events were $0 (free-trial/intro starts).
- Revenue only from `Pro Annual v2` ($45.20) + `Pro Monthly v2` ($10.50) + one `monthly_v4` ($6.62). v3/v4 products so far only produce trials.
- Proceeds by territory: US $31.50 · BR $24.20 · IT $6.62.

## Cross-source context (from prior audits / PostHog)
- Feature demand order: **expenses > maintenance > rides > trips > AI** (PostHog-validated).
- SEO is a traffic win (56k impressions/28d) but converts poorly to store/paid — the web→app bridge is the gap.
- Logging (maintenance + expenses) must stay free — never paywalled.

## ASO diagnosis (structure)
1. **Reach is the ceiling** (~40 impr/day, 95% search-only). Keyword breadth + browse/category presence are underdeveloped.
2. **Trust is broken** (2★/1 rating). Zero-rating in 6 of 7 markets. Ratings prompt + review generation is the highest-ROI fix.
3. **Conversion mechanics are OK** (~35% PV→DL) — don't over-invest here first.
4. **Subtitle/keywords under-use high-intent terms** the data rewards (see optimizer output).
5. **Monetization is pre-product-market-fit on paid**; ASO should optimize free installs + rating volume before squeezing Pro.
