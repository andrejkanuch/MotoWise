# Onboarding paywall A/B: garage_first vs commit_first

**Date:** 2026-10-07
**Decision:** The onboarding flow contains a paywall again (owner, 2026-10-07). This overrules the 2026-08-24 removal recorded in `docs/Paywall-Timing-Decision-2026-08-24.md`; that document's stop-loss no longer governs.
**Plan:** `docs/plans/2026-10-07-1317-feat-onboarding-paywall-ab-plan.md`

## Why

After the 2026-08-24 removal, paywall views fell from about 32 to about 9 a week, and riders who never saw an onboarding paywall produced 5 purchases in about 6 weeks. The old onboarding paywall sold (14 of 329 viewers, 4.3%; iOS 7.7%, Android 3.2%) but sat **before** the account step. In that position onboarding completion was 36.7% (iOS) vs 69.2% without it, 39% of riders who closed it then quit onboarding, and a rider could pay and then abandon sign-up with no way into the app. It did not measurably change first-week activity (12.2% vs 16.0% logged a ride, expense or service in 7 days, p≈0.33).

So the paywall returns **after** the account step, and the two candidate positions are tested against each other.

## The two flows

| | `garage_first` | `commit_first` |
|---|---|---|
| Flow | welcome → experience → bike-setup → reveal / no-bike-value → goals → account → heard-about → notifications → personalizing ("Garage ready") | welcome → experience → bike-setup → reveal / no-bike-value → goals → commitment → account → **paywall** → heard-about → notifications → personalizing |
| Paywall | when the rider taps "Open my garage" | straight after account |
| Commitment screen | none | yes (bike riders only), shortened |

The flows differ in two ways, paywall position and the commitment screen, so results compare the whole flows rather than paywall position alone.

Both use the same RevenueCat placements (`onboarding_rides`, `onboarding_routes`, `onboarding_default`, `onboarding_maintenance`, chosen by primary goal or maintenance intent) and present with the Pro entitlement gate, so riders who already have Pro skip it. Closing, buying, an error, or the escape link all continue onboarding.

Both ship with the same onboarding fixes: no invented rider count on reveal, bike make validation, shorter fixed waits, and a progress bar counted over the screens the rider actually sees.

## Assignment

- New installs only. Installs that already hold `shipped` (2026-08-24 → 2026-10-07) or a 2026 A/B value (`lean`, `invested`, `control`) keep the paywall-free flow.
- PostHog multivariate flag **`onboarding_paywall_2026q4`**, variant keys `garage_first` and `commit_first`, 50/50.
- If PostHog cannot be asked, the arm is drawn on-device 50/50 (`source = local`). This covers analytics off before consent (every EEA/UK/CH install: the consent screen comes after onboarding) and a failed or 2 s timed-out fetch. A fixed default would put all of Europe in one arm.
- If PostHog answers with a disabled or unknown value, the install gets `garage_first` (`source = fallback`). Turning the flag off is the kill switch.
- The variant is stored per install and sent as the `onboarding_variant` super and person property. `$feature_flag_called` is captured manually with `locally_defaulted` for non-PostHog assignments.

**Riders in opt-in regions emit no PostHog events before they consent**, so their onboarding steps are invisible to PostHog even though they are in an arm. Their purchases still reach PostHog through the RevenueCat server capture when the consent rule allows.

## Owner setup in PostHog (not done by this change)

1. Create a multivariate feature flag `onboarding_paywall_2026q4` with variants `garage_first` (50%) and `commit_first` (50%), rollout 100%, no property filters except an app version filter of `>=` the first store build containing this code.
2. Create an experiment on that flag. Exposure: `$feature_flag_called` with `$feature_flag = onboarding_paywall_2026q4`.
3. Exclude the internal/test cohort and `$geoip_country_code = SK`.
4. Primary metric: trial start or purchase (`purchase_completed`) within 7 days of `onboarding_started`, per rider who started onboarding.
5. Guardrail metrics: onboarding completion (`onboarding_completed` per starter) and first core action within 7 days (first ride completed, expense added or maintenance logged).
6. Secondary: paywall view → trial start by surface (`onboarding_paywall`, `onboarding_garage_ready`), trial → paid, refunds (read 3+ weeks after trials end).
7. Add an annotation on the launch date.

## Launch prerequisites

- **A store build.** Fresh installs run the bundle inside the binary on first launch, and that launch persists the variant before any OTA can apply. An OTA to 3.21.0 would lock every new install into `shipped`. The experiment starts when the next store build is live in both stores.
- **RevenueCat onboarding placements checked:** close button visible from the start and lifetime present (owner decisions 2026-10-07). These are dashboard settings this change does not touch.
- The Android onboarding paywall error investigation (U5) is resolved or understood.

## Reading the result

- Traffic: about 80–100 riders start onboarding a week, so about 45 per arm. A 10-point difference in completion is readable in about 8 weeks; a purchase difference needs to be about 2× to be clear within a quarter.
- **Decision rule at week 12:** if one arm wins on the primary metric without losing on a guardrail, ship it. If neither clearly wins on purchases, keep the arm with better onboarding completion.
- Treat any result with fewer than 10 conversions per arm as anecdote.

## Trial reminder

Riders in a renewing 7-day trial get one local notification 2 days before billing (day 5): "Your Pro trial ends in 2 days". It is cancelled when the trial is cancelled or converted, never asks for notification permission, and is rescheduled if sign-out cleared it. The paywall's trial timeline may now promise this reminder.
