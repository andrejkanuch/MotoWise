# MotoWise — Onboarding Redesign, Paywall & Monetization

**Product Requirements Document — Final Unified**

| Field | Value |
|-------|-------|
| Status | Draft — Pending Review |
| Target | Q2 2026 |
| Platform | iOS & Android (Expo 55, React Native 0.83) |
| Stack | NestJS 11, Next.js 16, Supabase, RevenueCat |
| Sources | Puff Count ($40K MRR), Mobbin, Airbridge, codebase audit |
| Prepared by | Andrej Kanuch · Product & Engineering |
| Date | March 2026 |

---

## 1. Problem Statement

### 1.1 Current State Audit

The existing MotoWise onboarding is a 7-step flow: Welcome → Add Bike → Riding Habits → Learning Prefs → AI Insights → Paywall → Personalizing. After a thorough code and UX audit, the following critical issues have been identified:

> **Issue #1: Overloaded Screens — Too Much Per Step**
>
> The "Add Your First Bike" screen (Step 2) crams 6 inputs onto a single scrollable page: Year, Make, Model, Nickname, Motorcycle Type (8 options in a 2-col grid), and Mileage Slider.
>
> The "Riding Habits" screen (Step 3) combines 3 distinct questions: riding frequency (4 options), riding goals (8 options in a 2-col grid), and maintenance style (3 options).
>
> This violates the one-information-per-step principle that high-converting onboarding flows follow. Puff Count achieves 93% completion with one question per screen.

> **Issue #2: Broken Card Layouts**
>
> The motorcycle type selector uses a 2-column grid (48% width) with `flex:1` text. Labels like "Dual Sport" and "Standard" wrap vertically inside the cards, creating an unreadable layout (visible in screenshot: "D u a l S p o r t" stacked vertically).
>
> The riding goals grid has the identical problem: "Learn Maintenance" and "Improve Riding" text wraps vertically, making them nearly impossible to read.
>
> Root cause: `OptionCard` component uses `flex: 1` for text with the icon taking fixed space, but cards are too narrow for multi-word labels.

> **Issue #3: Mileage Unit Problem**
>
> The mileage slider is hardcoded to miles (0–50,000 mi, step 1,000). The database has a `mileage_unit` column (`VARCHAR 2`, `CHECK IN ('mi', 'km')`) but the onboarding NEVER asks the user which unit they use.
>
> Users in metric countries (most of the world) will enter incorrect mileage data, corrupting all maintenance predictions and AI insights. The DB default is `'mi'` — metric users have no way to change this during onboarding.

### 1.2 Additional Problems

- No value demonstration before the paywall: The AI insights screen exists but users haven't invested enough emotionally by that point.
- No motorcycle photo upload: Users can't see their actual bike in the app, reducing emotional connection.
- No maintenance opt-in: Smart maintenance reminders (a key premium feature) aren't introduced during onboarding.
- No self-reflection questions: The survey collects data but doesn't make users think about WHY they need MotoWise (per Puff Count's behavioral science approach).
- Skip is too easy: The bike entry skip button is prominent, leading to poor personalization.

### 1.3 Industry Context

- 25% of users churn within the first 3 minutes (Airbridge, 2025).
- 77% churn within 3 days. Day-30 retention averages 5–6%.
- Puff Count achieves 93% onboarding completion with $40K MRR using one-question-per-screen and behavioral science survey design.
- Apps with personalized onboarding see 35% higher completion (UserGuiding, 2026).

---

## 2. Goals

### User Goals

1. Experience a focused, one-question-per-screen onboarding that feels fast and effortless.
2. See readable, beautiful UI on all screen sizes (no broken text wrapping).
3. Enter mileage in their preferred unit (mi or km) and have it stored correctly.
4. Upload a photo of their motorcycle and see it throughout the app.
5. See personalized AI insights that prove the app understands their specific bike.
6. Opt into maintenance reminders and smart care features during setup.

### Business Goals

1. Achieve >90% onboarding completion (benchmark: Puff Count 93%).
2. Achieve <3% drop-off per step (from current estimated ~5–8% on overloaded screens).
3. 6–10% free-to-paid conversion within 60 days.
4. Collect 15+ data points per user (vs. current 3–6).
5. Minimize platform fees: <5% on web checkout path.

---

## 3. Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Web/desktop paywall | Mobile-first; web monetization is Q3+. |
| Family/team plans | Validate individual pricing first. |
| Ad-supported free tier | Ads degrade premium feel. |
| Hard paywall (no free tier) | MotoWise needs free tier for word-of-mouth. |
| Social/community in onboarding | Focus on personal value. |
| OBD-II hardware integration | Separate hardware partnerships needed. |

---

## 4. Psychological Framework

Nine principles applied to make every screen feel worth completing:

### 4.1 Reaffirmation

The first screen validates the user's decision to download. "Your motorcycle just got smarter" — positive framing before any input is requested.

### 4.2 Endowed Progress

Progress bar starts at ~10% on arrival, acknowledging signup as a step. Research shows this increases completion by up to 30%.

### 4.3 One Thing Per Screen (Cognitive Load Reduction)

> **Core Design Principle**
>
> Each screen asks for exactly ONE piece of information or ONE decision. This is the single most impactful change. Puff Count, Duolingo, Noom, and Headspace all use this pattern.
>
> The current bike screen asks for 6 things at once. The new flow splits this across 5 dedicated screens.
>
> More screens ≠ more friction. Each individual screen is trivially easy, creating a flow state.

### 4.4 Foot-in-the-Door (Commitment)

Start with the easiest question (rider type). Each micro-commitment makes the next feel natural.

### 4.5 IKEA Effect + Photo Ownership

Users who upload their motorcycle photo value the app 3–5x more. The photo appears on dashboard, garage, and diagnostics, making MotoWise feel like THEIR app.

### 4.6 Survey as Self-Reflection

Questions like "How much did you spend on repairs?" and "Have you been unsure if your bike was safe?" aren't just data collection — they force the user to confront why they need MotoWise (per Puff Count's behavioral scientist approach).

### 4.7 Loss Aversion + Sunk Cost

By the paywall, users have invested 3+ minutes AND uploaded their bike's photo. The paywall shows their personalized dashboard blurred behind a translucent overlay.

### 4.8 Social Proof (Mid-Flow)

Appears AFTER engagement (Step 11), not at the start. More persuasive when user is already invested.

### 4.9 Peak-End Rule

The PEAK is the AI insight reveal. The END is the personalized dashboard with their motorcycle photo.

---

## 5. Redesigned Onboarding Flow

The flow is organized into **5 logical sections** with **17 total screens**. Each screen has exactly ONE focus. Target: 3–4 minutes, >90% completion.

---

### Section A: Welcome & Identity (Screens 1–2)

**Purpose:** Emotional hook + first micro-commitment. **Time:** ~15 sec.

#### Screen 1: Welcome

- Full-screen hero: "Your motorcycle just got smarter."
- Subtext: "AI-powered learning, diagnostics & maintenance — personalized to your ride."
- CTA: "Let's get started"
- Progress starts at 10%
- **Data:** none (emotional priming only)

#### Screen 2: Rider Experience

- "What kind of rider are you?"
- 3 large vertical cards (full width, stacked): Beginner / Intermediate / Advanced
- Each card: icon + title + one-line description. No wrapping issues because cards are full-width.
- Auto-advance on tap (no "Continue" button)
- **Data:** `experienceLevel`

---

### Section B: Your Motorcycle (Screens 3–8)

**Purpose:** Build the user's garage. This is where emotional investment begins. Each bike attribute gets its own screen. **Time:** ~60–90 sec.

> **Why Split the Bike Entry Into 6 Screens?**
>
> The current single screen with 6 inputs has the worst drop-off in the flow. Motorcycle type cards wrap text vertically ("Dual Sport" becomes unreadable) because the 2-col grid cards are too narrow.
>
> Splitting into individual screens means each UI element can be full-width and beautifully designed. Users feel each step is "trivially easy."
>
> Per Puff Count: more screens with less per screen = higher completion.

#### Screen 3: Bike Year

- "What year is your motorcycle?"
- Large numeric input or scrollable year picker (current year+1 down to 1970)
- Suggested default: current year − 3 (most common used bike age)
- **Data:** `bikeData.year`

#### Screen 4: Bike Make

- "Who makes your motorcycle?"
- Search input with filtered dropdown (existing NHTSA API integration)
- Show popular makes first: Honda, Yamaha, Kawasaki, Harley-Davidson, Suzuki, BMW, Ducati, KTM
- Full-width list items (no grid, no wrapping issues)
- **Data:** `bikeData.make`, `bikeData.makeId`

#### Screen 5: Bike Model

- "What's your model?"
- Conditional on make + year (existing API query)
- Full-width list items, scrollable
- If no results: allow free-text entry with note "We'll add your model to our database"
- **Data:** `bikeData.model`

#### Screen 6: Motorcycle Type

- "What type of motorcycle is it?"
- *Fix: Replace current broken 2-col grid with full-width horizontal cards (icon + label on one line).*
- Auto-detected from model name (existing regex), but shown for confirmation/override
- 8 options as full-width single-row cards: Cruiser, Sportbike, Standard, Touring, Dual Sport, Dirt Bike, Scooter, Other
- Each card: icon on left + label on right. No text wrapping possible.
- Pre-selected if auto-detected (with subtle "We guessed this based on your model" text)
- **Data:** `bikeData.type`

#### Screen 7: Current Mileage

- "How many miles (or km) is on your bike?"

> **Mileage Unit Solution**
>
> - Show a unit toggle at top of screen: `[mi] [km]` — defaulting based on device locale (`Intl` API or `expo-localization`).
> - If locale is US/UK/Myanmar: default `mi`. All others: default `km`.
> - Slider range adjusts: 0–80,000 mi (step 1,000) or 0–130,000 km (step 1,500).
> - Display format: "15,000 mi" or "24,000 km" with locale-appropriate number formatting.
> - Store BOTH values in DB: `current_mileage` (integer) + `mileage_unit` ('mi' or 'km').
> - API/AI layer normalizes to km internally for all calculations. Display converts back to user's preference.
> - User can change unit in settings post-onboarding.

- Large slider with haptic feedback every 5K increment (existing pattern)
- "Not sure?" link below slider — sets to null, AI uses make/model/year average
- **Data:** `bikeData.currentMileage`, `bikeData.mileageUnit`

#### Screen 8: Nickname & Photo

- "Give your bike a name" (optional nickname input)
- Below: "Add a photo of your ride" with camera/library picker (`expo-image-picker`)
- After upload: bike photo animates into card with nickname + year + make/model overlay
- Both are optional but the screen makes them feel fun, not mandatory
- "Looks great!" / "Retake" buttons for photo
- Skip option: "I'll add these later" (small muted text)
- **Data:** `bikeData.nickname`, `bikeData.primaryPhotoUrl`

*Section B also has a "Skip bike setup" option that appears on Screen 3 only (small text). If tapped, user jumps directly to Section C. The skip is NOT shown on individual screens 4–8 (once committed, keep going).*

---

### Section C: About Your Riding (Screens 9–12)

**Purpose:** Understand the rider + trigger self-reflection. One question per screen. **Time:** ~45–75 sec.

#### Screen 9: Riding Frequency

- "How often do you ride?"
- 4 full-width cards (stacked): Daily / Weekly / Monthly / Seasonally
- Each with icon + title + subtitle (e.g., "Weekly — A few times a week, usually weekends")
- **Data:** `ridingFrequency`

#### Screen 10: Riding Goals

- "What would you like to achieve?" (multi-select)
- *Fix: Replace current broken 2-col grid. Use full-width horizontal cards with icon + single-line label.*
- 8 options (full-width stacked): Learn Maintenance, Improve Riding Skills, Track Maintenance History, Save Money on Repairs, Find Riding Community, Ride Safer, Save on Maintenance Costs, Monitor Bike Health
- Each card is a single row: `[icon] [label] [checkmark]`. No wrapping.
- Min 1 selection required
- **Data:** `ridingGoals[]`

#### Screen 11: Maintenance Style

- "Do you work on your own bike?"
- 3 full-width cards with subtitles:
  - "Yes — I handle most repairs and maintenance myself"
  - "Sometimes — Oil changes and basics, but leave the hard stuff to a mechanic"
  - "No — I use a mechanic for everything"
- **Data:** `maintenanceStyle`

#### Screen 12: Repair Spending (Self-Reflection Trigger)

- "How much did you spend on motorcycle maintenance or repairs last year?"
- 5 options: Under $200 / $200–500 / $500–1,000 / $1,000+ / I'm not sure
- *Psychology: Forces the user to confront the COST of maintenance. "Not sure" itself is a pain point — MotoWise tracks this for you. Placed later in the flow per Puff Count's ordering strategy.*
- **Data:** `annualRepairSpend`

---

### Section D: Smart Features Setup (Screens 13–14)

**Purpose:** Opt into proactive features + learning preferences. Converts passive interest into active commitment. **Time:** ~30–45 sec.

#### Screen 13: Learning Preferences

- "How do you like to learn?" (multi-select)
- 4 full-width cards: Quick Tips (2–3 min reads) / Deep Dives (10+ min guides) / Video Walkthroughs / Hands-On Quizzes
- Min 1 selection required
- **Data:** `learningFormats[]`

#### Screen 14: Smart Maintenance Setup

- "Set up smart care for your [bike nickname or Make Model]"
- 4 toggles (default ON except weekly summary):
  - **Maintenance reminders** — "We'll remind you when service is due based on your mileage"
  - **Seasonal riding tips** — "Prep guides for winter storage, spring startup, and more"
  - **Recall & safety alerts** — "Instant alerts if a recall affects your bike"
  - **Weekly riding summary** — "Your maintenance status and learning progress" *(default OFF)*
- Bonus: "When did you last service your motorcycle?" (5 options including "Not sure")
- If maintenance reminders ON: follow-up "How would you like reminders?" (Push / Email / Both)
- **Data:** `maintenanceReminders`, `reminderChannel`, `seasonalTips`, `recallAlerts`, `weeklySummary`, `lastServiceDate`

---

### Section E: Value Reveal & Conversion (Screens 15–17)

**Purpose:** Demonstrate value, convert to paid, deliver the promise. **Time:** ~45–60 sec.

#### Screen 15: AI Insight Reveal (PEAK MOMENT)

> **This is the most important screen in the entire onboarding.**
>
> The user has invested ~3 minutes. Now the app MUST reward that investment. Show 3–4 personalized AI insights specific to their bike and profile. If they uploaded a photo, show it at the top. This is the emotional payoff.

- Personalized insights based on bike + profile:
  - "3 common issues [Make Model] owners report after [Mileage]" (teaser)
  - "Your next recommended maintenance: [task] (est. [X] mi/km away)"
  - If lastService >3mo: "Your bike may be overdue for a service"
  - "[N] articles matched to your experience level and learning style"
- Social proof: "Join [N]+ riders who use MotoWise for their [bike type]"
- If maintenance reminders ON: "Your first maintenance reminder is set"
- CTA: "See your full dashboard →"

#### Screen 16: Soft Paywall

- Background: blurred preview of their dashboard (with bike photo visible through blur)
- Headline: "Your MotoWise experience is ready"
- 3 dynamic value props adapted to survey answers:
  - If maintenance reminders: "Smart alerts for your [Make Model]"
  - If safety concern: "AI diagnostics to keep rides safe"
  - If high repair spend: "Save on repairs with predictive maintenance"
- Pricing: Monthly $6.99/mo (3-day trial) / Annual $39.99/yr (7-day trial, 52% savings)
- Free tier: 1 bike, 3 articles/wk, basic diagnostics, no maintenance reminders
- Trust: "Cancel anytime" / "No charge during trial"
- "Continue with Free" at bottom (muted text)
- Optional: "Subscribe on web & save" for US users (Epic v. Apple, ~3–4% fee)

#### Screen 17: Dashboard Landing (END)

- Personalized dashboard: bike photo + nickname, today's action, first matched article, maintenance countdown
- Free users: premium features visible with lock icon + "Upgrade" badge
- First-session tooltip: "Tap any locked feature to start your free trial"

---

## 6. Flow Summary

| # | Section | Screen | Data Collected | Psychology |
|---|---------|--------|---------------|------------|
| 1 | A: Welcome | Welcome | — | Reaffirmation |
| 2 | A: Welcome | Rider Experience | `experienceLevel` | Foot-in-door |
| 3 | B: Motorcycle | Bike Year | `year` | Investment begins |
| 4 | B: Motorcycle | Bike Make | `make`, `makeId` | Commitment |
| 5 | B: Motorcycle | Bike Model | `model` | Consistency |
| 6 | B: Motorcycle | Motorcycle Type | `type` | Full-width cards fix |
| 7 | B: Motorcycle | Mileage | `mileage`, `unit` | mi/km toggle fix |
| 8 | B: Motorcycle | Nickname & Photo | `nickname`, `photo` | IKEA Effect |
| 9 | C: Riding | Frequency | `ridingFrequency` | Easy question |
| 10 | C: Riding | Goals | `ridingGoals[]` | Full-width fix |
| 11 | C: Riding | Maintenance Style | `maintenanceStyle` | Self-reflection |
| 12 | C: Riding | Repair Spending | `annualRepairSpend` | Cost confrontation |
| 13 | D: Features | Learning Prefs | `learningFormats[]` | Personalization |
| 14 | D: Features | Smart Maintenance | reminders, alerts, etc. | Opt-in commitment |
| 15 | E: Convert | AI Insights | — | PEAK moment |
| 16 | E: Convert | Paywall | `subscription` | Loss aversion |
| 17 | E: Convert | Dashboard | — | Peak-End rule |

**Total:** 17 screens across 5 sections. ~15+ data points. ~3–4 minutes.

**vs. Current:** 7 screens with overloaded inputs. ~3–6 data points. ~90 sec but poor completion.

---

## 7. Specific UI/UX Fixes

### 7.1 Card Text Wrapping Fix

**Problem:** `OptionCard` uses a 2-column grid (48% width) with `flex:1` text. Multi-word labels like "Dual Sport" and "Learn Maintenance" wrap vertically because the card is too narrow.

**Solution:** On ALL onboarding screens, replace 2-column grid cards with full-width horizontal cards:

- Each card spans 100% width (not 48%)
- Layout: `[Icon 44px] [gap 12px] [Label flex:1] [Checkmark if selected]`
- All text stays on one line. No vertical wrapping possible.
- Cards are stacked vertically with 8px gap
- This matches the pattern used by Headspace, Noom, Duolingo, and Puff Count

### 7.2 Mileage Unit Solution

**Problem:** Slider is hardcoded to miles. DB supports km but onboarding never asks.

**Solution:**

1. **Auto-detect from locale:** Use `expo-localization` to get device region. US/UK/Myanmar default to mi. All others default to km.
2. **Toggle on screen:** Show `[mi] [km]` segmented control at top. User can override the auto-detected default.
3. **Adaptive slider:** mi mode: 0–80,000, step 1,000. km mode: 0–130,000, step 1,500.
4. **Store both in DB:** `current_mileage` (integer) + `mileage_unit` ('mi' or 'km'). Already supported in schema.
5. **Internal normalization:** API/AI layer converts to km for all calculations. Display converts back to user's preference.
6. **User preferences:** Store `mileage_unit` in user preferences JSONB so it applies app-wide (garage, maintenance, diagnostics).

### 7.3 Skip Button Strategy

**Problem:** Current skip button on bike screen is too prominent, leading to poor personalization.

**Solution:**

- Show "Skip bike setup" ONLY on Screen 3 (Bike Year) as small muted text at bottom.
- Screens 4–8 do NOT show skip — once user enters year, they're committed to completing the bike.
- If skipped: user jumps to Section C (Screen 9). AI insights (Screen 15) use generic, experience-level-based content.
- Post-onboarding: persistent "Add your motorcycle" card on dashboard until bike is added.

---

## 8. User Stories

- As a new user, I want each onboarding step to ask only one thing so I'm never overwhelmed.
- As a rider in Germany, I want to enter my mileage in kilometers so my maintenance predictions are accurate.
- As a Dual Sport rider, I want to read the motorcycle type label clearly on my phone screen.
- As a motorcycle owner, I want to upload a photo of my bike so the app feels personal.
- As a user, I want to opt into maintenance reminders during onboarding so they're ready when I start using the app.
- As a cost-conscious rider, I want to be prompted to think about my repair spending so I understand MotoWise's value.
- As a user who skipped bike setup, I want a reminder on my dashboard to add my bike later.
- As a metric-system user, I want the mileage slider to show km with appropriate ranges.
- As a user on the paywall, I want to see my personalized dashboard blurred behind the pricing so I know what I'm unlocking.
- As a subscriber, I want web checkout to save money vs. in-app purchase.

---

## 9. Requirements

### P0 — Must-Have

| # | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0.1 | One-question-per-screen redesign (17 screens, 5 sections) | Each screen has exactly 1 primary input. No scrolling required to see all options. >90% completion rate. |
| P0.2 | Full-width horizontal card layout (replace 2-col grid) | All OptionCards span 100% width. No vertical text wrapping on any screen size. Labels on one line. |
| P0.3 | Mileage unit toggle with locale auto-detection | Default unit from device locale. Toggle on mileage screen. Both value + unit stored in DB. Slider range adapts. |
| P0.4 | Motorcycle photo upload (Screen 8) | Camera + library picker. Upload to Supabase Storage. Photo shows on dashboard, garage, diagnostics. |
| P0.5 | Smart maintenance opt-in (Screen 14) | 4 toggles + last service date. Default ON (except weekly). Channel preference. Persisted to preferences. |
| P0.6 | Repair spending self-reflection (Screen 12) | 5 options including "Not sure." Data stored in `preferences.annualRepairSpend`. |
| P0.7 | AI Insight Reveal with bike photo (Screen 15) | 3+ insights within 5 sec. Fallback content. Shows bike photo if uploaded. |
| P0.8 | Soft paywall with dynamic copy (Screen 16) | Blurred dashboard preview. Copy adapts to survey answers. Free trial. "Continue Free" option. |
| P0.9 | RevenueCat integration (iOS + Android) | Purchase, restore, status check. Handles edge cases. |
| P0.10 | Free tier gating | 1 bike, 3 articles/wk, basic diagnostics. Premium visible but locked. |
| P0.11 | RevenueCat → Supabase webhook | Updates `subscription_status`. API validates for premium endpoints. |
| P0.12 | Trial management | 7-day annual, 3-day monthly. Countdown in app. Grace period. |
| P0.13 | Per-screen analytics | Drop-off, time, skip rates per screen. Mixpanel or PostHog. |

### P1 — Should-Have

| # | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P1.1 | Web checkout (Epic v. Apple) | Stripe + RevenueCat Web Billing. No Apple commission on US web purchases. |
| P1.2 | Superwall / RevenueCat paywall A/B testing | Test designs, pricing, copy without app updates. |
| P1.3 | Animated transitions between screens | Reanimated v4. Under 300ms. Smooth left-to-right flow. |
| P1.4 | Social proof pipeline | Real-time rider count by bike type. |
| P1.5 | Safety confidence question (Screen 12b) | "Have you been unsure if your bike was safe?" as optional follow-up. |
| P1.6 | Value recap screen (pre-paywall) | Dynamic summary from all survey answers. |

### P2 — Future

| # | Requirement | Notes |
|---|-------------|-------|
| P2.1 | Promotional pricing | RevenueCat Offerings. |
| P2.2 | Referral program | Invite code for free month. |
| P2.3 | Win-back campaigns | Push + email for churned subscribers. |
| P2.4 | Multi-bike free tier | 2 bikes free for stickiness. |

---

## 10. Data Model Changes

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| `subscription_status` | enum | `free` \| `trialing` \| `active` \| `past_due` \| `cancelled` \| `expired` |
| `subscription_tier` | enum | `free` \| `monthly` \| `annual` |
| `subscription_expires_at` | TIMESTAMPTZ | Current period end |
| `trial_ends_at` | TIMESTAMPTZ | Trial end (null if not on trial) |
| `revenuecat_id` | TEXT | RevenueCat app user ID |

### Preferences JSONB

| Key | Type | Description |
|-----|------|-------------|
| `ridingFrequency` | string | `daily` \| `weekly` \| `monthly` \| `seasonal` |
| `maintenanceStyle` | string | `diy` \| `sometimes` \| `mechanic` |
| `learningFormats` | string[] | `quick_tips` \| `deep_dives` \| `video` \| `quizzes` |
| `annualRepairSpend` | string | `under_200` \| `200_500` \| `500_1000` \| `1000_plus` \| `unsure` |
| `maintenanceReminders` | boolean | Opted into reminders |
| `reminderChannel` | string | `push` \| `email` \| `both` |
| `seasonalTips` | boolean | Seasonal tips opt-in |
| `recallAlerts` | boolean | Recall alerts opt-in |
| `weeklySummary` | boolean | Weekly digest opt-in |
| `lastServiceDate` | string | `under_1mo` \| `1_3mo` \| `3_6mo` \| `6mo_plus` \| `unsure` |
| `mileageUnit` | string | `mi` \| `km` (user preference, applied app-wide) |

---

## 11. Technology & Payment

| Component | Implementation |
|-----------|---------------|
| Subscriptions | RevenueCat `react-native-purchases` (Expo dev build). Free <$2,500 MTR, then 1%. |
| Paywall A/B | RevenueCat Paywalls (v1) → Superwall (v2 if needed) |
| Web Checkout | Next.js (`apps/web`) + Stripe + RevenueCat Web Billing. 0% Apple fee (Epic ruling). |
| Photo Upload | `expo-image-picker` → Supabase Storage. Resize to 800px max client-side. |
| Locale Detection | `expo-localization` for mileage unit default. |
| Analytics | Mixpanel or PostHog for per-screen funnel tracking. |
| Backend | RevenueCat webhook → NestJS → Supabase (subscription sync). |

### Fee Comparison

| Path | Platform Fee | Processing | RevenueCat | Total |
|------|-------------|------------|------------|-------|
| Apple IAP (small biz) | 15% | Included | 0–1% | **15–16%** |
| **Web checkout (US)** | **0%*** | ~2.9%+30¢ | 0–1% | **~3–4%** |
| Google Play | 15% | Included | 0–1% | **15–16%** |
| Google User Choice | 11–12% | Varies | 0–1% | **12–14%** |

*\*Epic v. Apple ruling (2025). Subject to change.*

---

## 12. Success Metrics

| Metric | Target | Stretch | Benchmark |
|--------|--------|---------|-----------|
| Onboarding completion | >90% | >93% | Puff Count: 93% |
| Per-screen drop-off | <2% | <1% | Puff Count: ~1%/step |
| Avg. onboarding time | <4 min | <3.5 min | 17 screens × ~15s avg |
| Photo upload rate | >50% | >70% | High retention impact |
| Maint. reminders opt-in | >70% | >85% | Default ON |
| Bike skip rate | <15% | <8% | Current: ~30% |
| Trial start rate | >25% | >35% | Industry: 15–25% |
| Free-to-paid (60 days) | >6% | >10% | Niche app avg: 3–5% |
| Day-7 retention | >40% | >55% | Industry avg: 25% |
| Web checkout (US) | >15% | >30% | Fee savings metric |

---

## 13. Open Questions

| # | Question | Owner | Priority |
|---|----------|-------|----------|
| Q1 | Should bike entry be required or keep skip? Mandatory = better AI but risks drop-off. | Product | Blocking |
| Q2 | Free tier limits: 3 articles/wk proposal. Validate with data. | Product | Blocking |
| Q3 | Legal review for external payment links (Epic v. Apple)? | Legal | Blocking |
| Q4 | Pricing A/B test from launch or survey first? | Growth | Blocking |
| Q5 | Photo: Supabase Storage public bucket or signed URLs? | Engineering | Non-blocking |
| Q6 | RevenueCat Paywalls vs. Superwall vs. custom? | Engineering | Non-blocking |
| Q7 | Analytics: Mixpanel vs. PostHog vs. Amplitude? | Engineering | Non-blocking |
| Q8 | AI insights: pre-generate during survey or on-demand? | Engineering | Non-blocking |

---

## 14. Timeline

| Phase | Scope | Duration |
|-------|-------|----------|
| 0 | Competitive research (Mobbin), wireframes, design | 1–2 weeks |
| 1 | Sections A–D: 14 onboarding screens + photo upload + mileage fix + analytics | 3–4 weeks |
| 2 | Section E: RevenueCat + paywall + feature gating + DB migrations | 2–3 weeks |
| 3 | Web checkout: Stripe + RevenueCat Web Billing on Next.js | 2 weeks |
| 4 | A/B testing, animations, social proof, polish | 1–2 weeks |

**Total: 9–13 weeks.** Apple review may add 1–2 extra weeks.

---

## Appendix: Current vs. Proposed

| Aspect | Current (7 screens) | Proposed (17 screens) |
|--------|---------------------|----------------------|
| Screens | 7 (overloaded) | 17 (one question each) |
| Card layout | 2-col grid, broken text wrapping | Full-width horizontal, no wrapping |
| Mileage | Hardcoded miles, no unit choice | Locale-detected mi/km toggle |
| Bike photo | None | Camera + library upload |
| Data points | 3–6 | 15+ |
| Self-reflection | None | Repair spending, maintenance habits |
| Smart care | None | 4 opt-in toggles + last service date |
| Value demo | AI insights (generic feel) | Insights + photo + personalized recap |
| Monetization | Paywall exists but weak conversion | Soft paywall + web checkout + A/B tests |
| Psychology | Basic progress bar | 9 principles across 5 sections |
