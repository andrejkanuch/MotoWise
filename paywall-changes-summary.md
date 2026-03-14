# MotoVault Paywall Changes — March 14, 2026

## Pricing Decision

**New pricing (psychological optimization):** $9.99/mo + $59.99/yr ($4.99/mo, 50% savings)

Rationale: Charm pricing (.99 endings), 50% annual savings anchor, "less than a coffee" monthly equivalent ($4.99/mo). Based on 2025-2026 subscription pricing psychology research.

### Action Required (App Store Connect / Google Play Console)

You must update the actual product prices in your store accounts to:
- **Monthly product:** $9.99/mo with 3-day free trial
- **Annual product:** $59.99/yr with 7-day free trial

The RevenueCat paywall uses dynamic `{{ product.* }}` variables that pull prices from your store products automatically. Once you update the store prices, the paywall will display the correct amounts and the `relative_discount` badge will auto-calculate to ~50%.

## Changes Made

### 1. RevenueCat Paywall (in browser)

| Field | Before | After |
|-------|--------|-------|
| Page 3 title | Route & Trip Planner | **Learn & Master** |
| Page 3 subtitle | Plan routes, track rides, and save favorites | **AI articles, quizzes, and skill tracking** |
| Page 1 subtitle | Store registrations, keys, and photos securely | **Track your fleet with photos, specs, and service history** |
| Terms URL | https://example.com | **https://motovault.app/terms** |
| Privacy URL | https://example.com | **https://motovault.app/privacy** |

**Status:** Published (March 14, 2026)

### 2. Codebase Files Updated

| File | Change |
|------|--------|
| `MotoWise_PRD_Final.md` (line 339) | $6.99/$39.99/52% → $9.99/$59.99/50% |
| `docs/plans/2026-03-08-feat-onboarding-revamp-paywall-plan.md` (lines 722-725) | Pricing table + savings updated |
| `project-validation-report.md` (7 references) | All $6.99/$39.99 → $9.99/$59.99, ARR projections recalculated |

### 3. No Code Changes Needed

The `upgrade.tsx` screen uses dynamic pricing from `Purchases.getOfferings()` — no hardcoded dollar amounts. The i18n files (`en.json`, `es.json`, `de.json`) use dynamic variables for pricing. Trial days (7 annual, 3 monthly) are correctly hardcoded and unchanged.

### 4. App Store Connect Pricing Updated

| Product | Price | Status |
|---------|-------|--------|
| MotoVault Pro Annual (`motovault_pro_annual`) | $59.99/yr | Set (March 14, 2026) |
| MotoVault Pro Monthly (`motovault_pro_monthly`) | $9.99/mo | Set (March 14, 2026) |

Prices were set with "Recalculate prices for all countries or regions" — equivalent prices auto-calculated for all 175 countries.

### 5. RevenueCat Paywall Published

Published March 14, 2026. All localization changes (page titles, subtitles, terms/privacy URLs) are now live.

## Remaining Action Items

1. ~~Update App Store Connect product prices~~ — DONE
2. **Update Google Play Console product prices** to $9.99/mo and $59.99/yr to match
3. ~~Click "Publish changes" in RevenueCat paywall builder~~ — DONE
4. **Consider adding trust signals** to the RevenueCat paywall (e.g., "Cancel anytime" text component near the Continue button) — the in-app `upgrade.tsx` already has these, but the remote RevenueCat paywall does not
5. **Update the carousel image on Page 3** — currently shows the Route & Trip Planner illustration. Replace with a learning/education themed image to match "Learn & Master"
