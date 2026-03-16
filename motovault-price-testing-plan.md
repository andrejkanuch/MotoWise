# MotoVault — RevenueCat Price Testing Strategy

## Current Baseline

| Element | Monthly | Annual |
|---------|---------|--------|
| **Price** | $9.99/mo | $59.99/yr ($5.00/mo equivalent) |
| **Free trial** | 3 days | 7 days |
| **Savings vs. monthly** | — | ~50% |
| **Paywall copy** | "3-day free trial · $9.99/mo" | "7-day free trial · then $5.00/mo" |
| **CTA** | "Start Your Free Trial" | |
| **Entitlement** | MotoWise Pro | |

**Pro features gated:** Unlimited bikes, unlimited articles, full AI diagnostics, maintenance reminders, PDF export.

**Free tier limits:** 1 bike, 5 tasks/bike, 3 AI diagnostics/mo, 3 articles/week.

---

## How RevenueCat Experiments Work

Each experiment requires **two Offerings** (Control = current, Treatment = variant). RevenueCat splits new users 50/50 and tracks the full subscription lifecycle: initial conversion → trial → paid → renewal → churn. You launch experiments from the RevenueCat dashboard with zero app updates — the mobile app already uses `presentPaywallIfNeeded`, which automatically serves the assigned offering.

**Minimum sample size:** ~1,000 users per variant for statistical significance on conversion rate. At lower volumes, run experiments longer (4–6 weeks minimum).

**Key metric:** Realized LTV per customer (not just initial conversion rate). A higher conversion rate at a lower price can still lose revenue.

---

## Experiment Roadmap (Priority Order)

### Experiment 1: Trial Duration — 3-day vs. 7-day Monthly

**Hypothesis:** A 7-day monthly trial (matching annual) gives users more time to experience AI diagnostics and maintenance tracking, increasing trial-to-paid conversion without meaningfully increasing free usage abuse.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Monthly trial | 3 days | 7 days |
| Annual trial | 7 days | 7 days (unchanged) |
| Price | $9.99/mo | $9.99/mo |

**Why run this first:** Trial duration is the lowest-risk, highest-signal test. It costs nothing to extend, and the article mentions that understanding whether "more time spent exploring your product is persuasive and more sticky in the long run" is critical. MotoVault's value shows up after users add a bike and get their first maintenance reminder or AI diagnostic — 3 days may not be enough.

**Watch for:** Trial start rate (should stay flat), trial-to-paid conversion (target: +15%), Day 30 churn (should not increase).

**Duration:** 4–6 weeks.

---

### Experiment 2: Trial Presence — Trial vs. No Trial (Monthly)

**Hypothesis:** Some users treat free trials as "free access" with no intent to convert. Removing the trial from the monthly plan and keeping it only on annual may push more users toward annual (higher LTV) or reveal that the trial isn't moving the needle on monthly conversions.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Monthly | 3-day trial, $9.99/mo | No trial, $9.99/mo |
| Annual | 7-day trial, $59.99/yr | 7-day trial, $59.99/yr |

**Why this matters:** If monthly trial-to-paid conversion is already low, you're giving away free access. Removing it forces a purchase decision and may shift mix toward annual (where LTV is ~5x higher).

**Watch for:** Monthly conversion rate (may drop), annual conversion rate (target: +20% lift), overall revenue per customer, trial abuse rate.

**Duration:** 4–6 weeks.

---

### Experiment 3: Price Point — $9.99 vs. $6.99 Monthly

**Hypothesis:** At $6.99/mo the perceived value gap between free and pro narrows enough to significantly boost conversion, and the volume increase more than compensates for the per-user revenue drop.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Monthly | $9.99/mo | $6.99/mo |
| Annual | $59.99/yr | $59.99/yr (unchanged) |

**Why:** $9.99 is a psychological barrier for utility apps. Motorcycle enthusiasts who spend $200–$1,000+/yr on repairs (captured in your onboarding data via `AnnualRepairSpend`) may still balk at $10/mo for a digital tool. $6.99 keeps you in the "impulse" zone.

**Watch for:** Conversion rate lift (target: +30%+), revenue per customer at Day 30/60/90, annual mix shift (if monthly gets cheaper, fewer users may choose annual — monitor this).

**Duration:** 6–8 weeks (need renewal data).

---

### Experiment 4: Annual Price Anchoring — $59.99 vs. $49.99

**Hypothesis:** $49.99/yr ($4.17/mo) with a "Save 58%" badge vs. monthly creates stronger anchoring and drives more annual purchases.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Annual | $59.99/yr | $49.99/yr |
| Monthly | $9.99/mo | $9.99/mo |
| Paywall subtitle | "7-day free trial · then $5.00/mo" | "7-day free trial · then $4.17/mo — Save 58%" |

**Why:** Annual subscribers have dramatically higher LTV (12-month retention vs. monthly churn). Even at a lower price, shifting 10% more users to annual can increase aggregate LTV. The "$49.99" price point also feels like a "deal" in a way $59.99 doesn't.

**Watch for:** Annual selection rate (target: +15%), overall revenue per paywall impression, 12-month projected LTV.

**Duration:** 8–12 weeks (annual renewal cycle is long).

---

### Experiment 5: Duration Mix — Monthly + Annual vs. Weekly + Monthly + Annual

**Hypothesis:** Adding a $2.99/week option makes the monthly and annual plans look like better value by comparison (decoy effect), increasing conversion on higher-LTV plans.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Options shown | Monthly ($9.99) + Annual ($59.99) | Weekly ($2.99) + Monthly ($9.99) + Annual ($59.99) |

**Why:** The article specifically calls out duration mix as a high-impact test. A weekly plan at $2.99 ($155/yr equivalent) makes $9.99/mo look reasonable and $59.99/yr look like a steal. Few users will actually buy weekly, but it reframes the other options.

**Watch for:** Distribution shift across plans, overall conversion rate, weekly subscriber churn (expected to be very high — that's okay, it's a decoy).

**Duration:** 4–6 weeks.

---

### Experiment 6: Introductory Offer Type — Free Trial vs. Discounted First Period

**Hypothesis:** A $0.99 first month (instead of 3-day free trial) attracts more committed buyers and improves trial-to-paid conversion because users who pay even $0.99 have stronger purchase intent.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Monthly offer | 3-day free trial → $9.99/mo | $0.99 first month → $9.99/mo |
| Annual offer | 7-day free trial → $59.99/yr | 7-day free trial → $59.99/yr |

**Why:** The penny gap is real — users who enter payment info AND pay something (even a dollar) convert to full-price at much higher rates than free trial users. This also eliminates trial abuse entirely.

**Watch for:** Initial conversion rate (may drop 10-20%), trial-to-paid conversion (target: +40%+), revenue at Day 60 (where this should overtake free trial).

**Duration:** 8 weeks minimum.

---

### Experiment 7: Paywall Copy — Feature-Focused vs. Pain-Point-Focused

**Hypothesis:** Reframing the paywall carousel around pain points riders experience ("Stop guessing when your next oil change is due") converts better than feature descriptions ("Smart maintenance reminders").

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| Page 1 | "Your Garage, Digitized" | "Tired of Scattered Service Records?" |
| Page 2 | "Never Miss a Service" | "Stop Paying for Repairs You Could Prevent" |
| Page 3 | "Ride Smarter Every Day" | "Know Your Bike Like a Mechanic Does" |

**Why:** This is a zero-cost test (no pricing changes, just copy). Pain-focused copy targets the emotional trigger that brought users to MotoVault in the first place — especially relevant for users who selected "save_on_maintenance" or "track_bike_health" as riding goals during onboarding.

**Watch for:** Paywall-to-trial conversion rate, time spent on paywall (if trackable), per-goal segment performance.

**Duration:** 3–4 weeks.

---

### Experiment 8: Pricing Localization — US/EU/LATAM

**Hypothesis:** Localized pricing ($9.99 USD / €7.99 EUR / $4.99 for LATAM markets) significantly improves conversion in price-sensitive regions without cannibalizing US revenue.

| | Control (A) | Treatment (B) |
|--|-------------|---------------|
| US | $9.99/mo | $9.99/mo (same) |
| EU | $9.99/mo | €7.99/mo |
| LATAM | $9.99/mo | $4.99/mo |

**Why:** MotoVault already supports en/es/de locales. Motorcycle culture is huge in Latin America and Europe, but purchasing power differs significantly. A localized price can 3-5x conversion in emerging markets.

**Watch for:** Per-region conversion rates, per-region LTV, any VPN abuse patterns.

**Duration:** 6–8 weeks.

---

## Sequencing & Timeline

```
Month 1–2:  Experiment 1 (Trial Duration) ← lowest risk, fastest signal
Month 2–3:  Experiment 7 (Paywall Copy)   ← zero cost, run alongside #1
Month 3–4:  Experiment 2 (Trial Presence)  ← informed by #1 results
Month 4–6:  Experiment 3 (Price Point)     ← biggest revenue lever
Month 6–8:  Experiment 4 (Annual Pricing)  ← optimize annual after monthly is set
Month 8–9:  Experiment 5 (Duration Mix)    ← refinement
Month 9–11: Experiment 6 (Intro Offers)    ← advanced optimization
Month 11+:  Experiment 8 (Localization)    ← scale to new markets
```

Experiments 1 and 7 can run simultaneously since they test different variables (trial length vs. copy). All others should run sequentially to isolate variables.

---

## RevenueCat Setup Checklist (Per Experiment)

1. **Create a new Offering** in RevenueCat dashboard (e.g., "exp1_7day_trial")
2. **Attach the right products** — create new App Store/Play Store products if pricing changes (e.g., a $6.99/mo product for Experiment 3)
3. **Create the Experiment** in RevenueCat → Experiments → New Experiment
4. **Set variants**: Control = current default offering, Treatment = new offering
5. **Configure the paywall** for the treatment offering (copy, layout, products shown)
6. **Launch** — no app update needed, the SDK automatically resolves the correct offering
7. **Monitor** daily for the first week, then weekly — check for platform discrepancies (iOS vs. Android)
8. **Conclude** only when RevenueCat shows statistical significance (p < 0.05) or you've hit the minimum run time

---

## Metrics to Track Per Experiment

| Metric | Where to Find | What It Tells You |
|--------|---------------|-------------------|
| Initial conversion rate | RC Experiments | % of users who start a trial or purchase |
| Trial-to-paid conversion | RC Experiments | % of trial users who become paying |
| Realized LTV per customer | RC Experiments | Revenue generated per exposed user |
| MRR per paying customer | RC Charts | Average revenue per active subscriber |
| Plan mix (monthly vs. annual) | RC Charts | Whether you're shifting users to higher-LTV plans |
| Churn rate (Day 30, 60, 90) | RC Charts | Long-term retention impact |
| Refund rate | RC Charts | Quality of conversions (low = good) |

---

## What NOT to Do

- **Don't test price AND trial AND copy simultaneously.** Isolate one variable per experiment so you know what caused the result.
- **Don't stop experiments early** when you see a short-term conversion spike. Wait for renewal data — a lower price may convert better but churn faster.
- **Don't ignore platform differences.** iOS and Android users often have very different price sensitivity. Segment results by platform.
- **Don't run experiments during major seasonal events** (Black Friday, riding season start) — external factors will contaminate results.
- **Don't forget to update the webhook handler.** If you add new product IDs (weekly, $6.99/mo), make sure `revenuecat.service.ts` and the Supabase RPC handle them correctly.
