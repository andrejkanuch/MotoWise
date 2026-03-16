# Experiment 1: Trial Duration — 3-day vs 7-day Monthly

## Status: Prerequisites Needed

Experiment 7 (Paywall Copy) is now live (`prexpcae71e03d1`). Experiment 1 can run simultaneously since it tests a different variable (trial length vs. copy).

---

## Hypothesis

A 7-day monthly trial (matching annual) gives users more time to experience AI diagnostics and maintenance tracking, increasing trial-to-paid conversion without meaningfully increasing free usage abuse.

## Variants

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Monthly trial | 3 days | **7 days** |
| Annual trial | 7 days | 7 days (unchanged) |
| Price | $9.99/mo | $9.99/mo |

## What Needs to Be Done

### 1. Create a new subscription product in App Store Connect

The current monthly product (`monthly`) has a 3-day free trial baked in. Apple doesn't let you A/B test trial durations on the same product — you need a separate product with a 7-day trial.

**Steps:**

1. Go to **App Store Connect > MotoVault > Subscriptions > MotoVault Pro** (subscription group)
2. Click **+** to create a new subscription product:
   - **Reference Name:** `MotoVault Pro Monthly (7-day trial)`
   - **Product ID:** `monthly_7day_trial`
   - **Subscription Duration:** 1 Month
   - **Price:** $9.99 (same as current)
3. Under **Subscription Prices**, set to $9.99 for all territories (match existing monthly)
4. Under **Introductory Offers**, create:
   - **Type:** Free Trial
   - **Duration:** 7 Days
   - **Eligibility:** All new subscribers
5. Submit for review (products need Apple approval before they can be purchased)

### 2. Create a new subscription product in Google Play Console

Same concept — a new product ID with a 7-day trial.

**Steps:**

1. Go to **Google Play Console > MotoVault > Monetize > Subscriptions**
2. Create a new subscription:
   - **Product ID:** `motovault_pro_monthly_7day_trial`
   - **Name:** MotoVault Pro Monthly (7-day Trial)
3. Add a **base plan** with:
   - **Billing period:** 1 Month
   - **Price:** $9.99
4. Add an **offer** to the base plan:
   - **Offer type:** Free trial
   - **Duration:** 7 days
   - **Eligibility:** New customer acquisition
5. Activate the subscription

### 3. Add products to RevenueCat

Once both store products are created and approved:

1. Go to **RevenueCat > MotoVault > Product Catalog > Products**
2. Add two new products:
   - **App Store:** `monthly_7day_trial`
   - **Play Store:** `motovault_pro_monthly_7day_trial`
3. Map both to the **MotoWise Pro** entitlement

### 4. Create a new Offering in RevenueCat

1. Go to **RevenueCat > Offerings**
2. Create a new offering:
   - **Identifier:** `exp1_7day_trial`
   - **Description:** Experiment 1 - Monthly with 7-day trial
3. Add a **Monthly** package with the new 7-day trial products (App Store + Play Store)
4. Add the existing **Annual** package (unchanged — already has 7-day trial)
5. Add the existing **Lifetime** package (unchanged)

### 5. Configure the paywall for the new offering

1. Go to **RevenueCat > Paywalls**
2. Either duplicate the current "MotoVault 1" paywall or create a new one
3. Attach it to the `exp1_7day_trial` offering
4. Update the monthly subtitle copy from "3-day free trial" to "7-day free trial"
5. Publish the paywall

### 6. Create the experiment

1. Go to **RevenueCat > Experiments > New Experiment**
2. Configure:
   - **Name:** `Exp1: Trial Duration — 3-day vs 7-day Monthly`
   - **Type:** Paywall design
   - **Variant A (Control):** `default` offering (3-day monthly trial)
   - **Variant B (Treatment):** `exp1_7day_trial` offering (7-day monthly trial)
   - **Primary metric:** Initial conversion rate
   - **Secondary metrics:** Trial-to-paid conversion, Realized LTV per customer
3. Start the experiment

### 7. Update webhook handler (if needed)

Check that `apps/api/src/modules/subscription/revenuecat.service.ts` handles the new product IDs. The webhook receives product identifiers from RevenueCat — if the new `monthly_7day_trial` / `motovault_pro_monthly_7day_trial` products aren't mapped, subscription events won't be processed correctly.

**Key file:** `apps/api/src/modules/subscription/revenuecat.service.ts`

Look for where product IDs are mapped to subscription tiers/periods and add the new ones.

---

## Metrics to Watch

| Metric | Target | Red Flag |
|--------|--------|----------|
| Trial start rate | Should stay flat | Drops > 5% |
| Trial-to-paid conversion | +15% lift | No change after 2 weeks |
| Day 30 churn | Should not increase | Increases > 10% |
| Free usage during trial | Monitor | Significant spike in AI diagnostic usage |

## Duration

4-6 weeks minimum. Do not stop early even if short-term conversion looks good — wait for renewal data.

## Timeline Estimate

| Task | Time Estimate |
|------|--------------|
| Create App Store product + approval | 1-3 days (Apple review) |
| Create Play Store product | Same day (instant activation) |
| Add to RevenueCat + configure offering | 30 minutes |
| Configure paywall | 30 minutes |
| Create experiment | 15 minutes |
| Update webhook handler | 1-2 hours (if needed) |
| **Total** | **2-4 days** (mostly waiting for Apple) |
