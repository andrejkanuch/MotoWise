---
title: "feat: Onboarding V2 — 9-screen premium flow redesign"
type: feat
status: active
date: 2026-04-24
---

# Onboarding V2 — 9-Screen Premium Flow Redesign

## Overview

Replace the current 12-screen onboarding with a streamlined 9-screen flow focused on commitment over information gathering. Key changes: rider-type segmentation replaces experience level, consolidated bike step (year+make+model on one screen), combined preferences screen (units+currency), goals as a commitment device, explicit notification permission screen, and a premium dashboard reveal at the end. Paywall is removed (handled by RevenueCat downstream).

## Problem Statement / Motivation

The V1 onboarding has too many screens with too much friction: separate year/make/model/type screens, experience level that doesn't map to product value, a paywall that blocks before showing value, and social proof claims with no reviews. V2 is engineered around commitment (rider type, goals) and perceived value (building animation, dashboard reveal) rather than information extraction.

## Proposed Solution

### Screen Flow (9 screens)

| # | Route | Purpose | Back | Skip |
|---|-------|---------|------|------|
| 01 | `index.tsx` | Welcome — brand + CTA | No | No |
| 02 | `rider-type.tsx` | Single-select rider persona | Yes | No |
| 03 | `your-bike.tsx` | Consolidated year+make+model | Yes | Yes ("Skip for now") |
| 04 | `bike-photo.tsx` | Optional photo upload | Yes | Yes ("Skip — I'll add it later") |
| 05 | `preferences.tsx` | Units (metric/imperial) + currency | Yes | No |
| 06 | `goals.tsx` | Multi-select goals (6 options) | Yes | No |
| 07 | `notifications.tsx` | Push permission request | Yes | Yes ("Not now") |
| 08 | `building.tsx` | Anticipation loader + CompleteOnboarding mutation | No | No |
| 09 | `welcome-home.tsx` | Dashboard reveal + "Open my garage" | No | No |

### Implementation Phases

#### Phase 1: Foundation (Store + Config + Types + API)

**1a. Update Zustand onboarding store** (`apps/mobile/src/stores/onboarding.store.ts`)

- Replace `experienceLevel` with `riderType: RiderType | null` (values: `daily_rider`, `tourer`, `wrench`, `collector`)
- Remove: `ridingFrequency`, `learningFormats`, `annualRepairSpend`, `maintenanceStyle`, `reminderChannel`, `lastServiceDate`, `weeklySummary`
- Simplify `bikeData` — remove `type`, `currentMileage`, `mileageUnit` (V2 doesn't collect these)
- Add `goals: OnboardingGoal[]` (values: `maintenance`, `expenses`, `rides`, `trips`, `history`, `recalls`)
- Add `measurementSystem: MeasurementSystem | null`
- Keep: `currency`, `maintenanceReminders`, `seasonalTips`, `recallAlerts`
- Bump store version from 3 to 4 with migration function
- Update `partialize` to exclude new setter functions

**Gotcha** (from learnings): Must bump persist version AND add migration, or users mid-onboarding get `undefined` state.

**1b. Update onboarding config** (`apps/mobile/src/config/onboarding.ts`)

- Replace `ONBOARDING_SCREENS` array with 9 V2 screens
- Update `TOTAL_SCREENS` from 12 to 9
- Update section assignments: A (welcome, rider-type), B (your-bike, bike-photo), C (preferences, goals, notifications), D (building, welcome-home)
- Update `gestureEnabled` mapping: `false` for welcome, building, welcome-home; `true` for rest

**1c. Add types to `@motovault/types`** (`packages/types/src/constants/enums.ts`)

- Add `RIDER_TYPE` as const object: `{ DAILY_RIDER, TOURER, WRENCH, COLLECTOR }`
- Add `ONBOARDING_GOAL` as const object: `{ MAINTENANCE, EXPENSES, RIDES, TRIPS, HISTORY, RECALLS }`
- Export inferred types: `RiderType`, `OnboardingGoal`

**1d. Update CompleteOnboarding API input** (`apps/api/src/modules/users/dto/complete-onboarding.input.ts`)

- Replace `experienceLevel` with `riderType: string`
- Replace `ridingGoals` with `goals: string[]` (the new 6 options)
- Add `measurementSystem: string` (optional)
- Remove: `learningFormats`, `ridingFrequency`, `maintenanceStyle`, `annualRepairSpend`, `reminderChannel`, `lastServiceDate`, `weeklySummary`
- Keep: `maintenanceReminders`, `seasonalTips`, `recallAlerts`, `currency`, bike fields

**Gotcha** (from learnings): Update the Zod schema in `@motovault/types` AND the NestJS DTO AND the Supabase RPC function. `ZodValidationPipe` silently strips unknown keys.

**1e. Update Supabase RPC** (`supabase/migrations/`)

- Create migration to update `complete_onboarding` function signature
- `DROP FUNCTION IF EXISTS complete_onboarding(...)` the old signature first
- Add new parameters: `p_rider_type`, `p_goals`, `p_measurement_system`
- Remove old parameters: `p_riding_frequency`, `p_learning_formats`, etc.
- Store `riderType` and `goals` in user's `preferences` JSONB column

**Gotcha** (from learnings): PostgreSQL function overloading trap — `CREATE OR REPLACE` with new params creates a NEW overload. Must DROP old signature first.

**1f. Update GraphQL + codegen**

- Update `complete-onboarding.graphql` mutation if input shape changed
- Run `pnpm generate` to regenerate types
- Verify generated `CompleteOnboardingInput` type matches new DTO

#### Phase 2: Screen Implementation (9 screens)

All screens use existing patterns: `ONBOARDING_COLORS`, `OnboardingProgress`, `OnboardingContinueButton`, `FadeInUp` animations, `router.replace()` navigation, inline styles, `borderCurve: 'continuous'`.

**2a. `index.tsx` — Welcome (UPDATE existing)**

- Update copy: "Every bike\nhas a story." with `InstrumentSerif-Italic` on "has a story."
- Subtitle: "Your garage, your trips, your service history — kept beautifully in one place."
- CTA: "Let's get started"
- Keep: hero motorcycle image, MotoVault brand, analytics event
- Remove: any V1-specific copy

**2b. `rider-type.tsx` — Rider Type (NEW, replaces `experience.tsx`)**

- Title: "What kind of rider\nare you?"
- Subtitle: "We'll tune your dashboard, reminders, and tips for how you ride."
- 4 `OnboardingCard` options (single-select with icons from lucide):
  - `Bike` icon — Daily rider / "Commute & weekend loops"
  - `Map` icon — Tourer / "Long trips, mapped rides"
  - `Wrench` icon — Wrench at heart / "I do my own maintenance"
  - `Library` icon — Collector / "Multiple bikes, full logs"
- Auto-advance after 300ms on selection (existing pattern from `experience.tsx`)
- Store: `setRiderType()`
- Analytics: `ONBOARDING_STEP_COMPLETED` with `rider_type`

**2c. `your-bike.tsx` — Your Bike (NEW, consolidates 4 screens)**

- Title: "Tell us about\nyour ride."
- Subtitle: "We'll pre-fill service intervals, torque specs, and common issues."
- **Year section**: Label "YEAR" + numeric stepper with `-`/`+` buttons + editable `TextInput` (default 2023, range 1900-2030)
- **Make section**: Label "MAKE" + `TextInput` "Search any make..." + dropdown results from `MotorcycleMakesDocument` query, filtered by search text. Show clear button (X). Free-type fallback (if no match, use typed text as make).
- **Model section**: Label "MODEL" + `TextInput` "Search {make} models..." + dropdown results from `MotorcycleModelsDocument` query (filtered by makeId + year). Show clear button. Free-type fallback.
- CTA: "Continue" (enabled when at least year is set)
- Skip: "Skip for now" link → jumps to `preferences.tsx`
- Store: `setBikeData({ year, make, makeId, model })`
- Reuse existing NHTSA GraphQL queries from V1 bike screens
- `KeyboardAvoidingView` for text inputs

**2d. `bike-photo.tsx` — Bike Photo (UPDATE existing)**

- Title: "Add a photo of\nyour ride."
- Subtitle: "Optional — but it makes the garage feel like yours."
- Large dashed border upload area with camera icon
- "Tap to add a photo" + "Camera or library · JPG, PNG"
- Keep existing `ImagePicker` + `cropAndCompress` logic
- CTA: "Continue"
- Skip: "Skip — I'll add it later" → `preferences.tsx`
- Store: update `bikeData.photoUri`

**2e. `preferences.tsx` — Preferences (NEW, consolidates units + currency)**

- Title: "How do you\nmeasure up?"
- Subtitle: "Units for distance & fuel, and a currency for expenses. Change either later in Settings."
- **UNITS section**: Two toggle buttons side-by-side
  - "Metric km · L · °C" (selected state = warm accent fill)
  - "Imperial mi · gal · °F"
  - Auto-detect from device locale as default
  - Live preview below: "Next service in 1,240 km · 18 °C" (or "770 mi · 64 °F")
- **CURRENCY section**: Selected currency badge (€ EUR) + searchable list
  - `TextInput` "Search currencies..."
  - Scrollable list of 19 currencies with symbol + code + name
  - Auto-detect from device locale as default
- CTA: "Continue"
- Store: `setMeasurementSystem()`, `setCurrency()`

**Gotcha** (from learnings): `getLocales()[0]?.currencyCode` returns `null` on iOS Simulator — always fallback to USD. `Intl.NumberFormat.formatToParts()` broken on iOS Hermes — use static symbol map.

**2f. `goals.tsx` — Goals (NEW)**

- Title: "What matters\nto you?"
- Subtitle: "Pick a few — we'll focus your dashboard on what you care about."
- 6 `OnboardingCard` options (multi-select with icons):
  - `Wrench` — Never miss maintenance / "Service reminders, oil & chain"
  - `Receipt` — Track every expense / "Fuel, parts, insurance, TCO"
  - `Route` — Log my rides / "Routes, distance, moments"
  - `MapPin` — Plan epic trips / "Multi-day routes & stops"
  - `BookOpen` — Build a history / "Service log for resale value"
  - `ShieldAlert` — Recall & safety alerts / "If it affects your bike, you know"
- CTA: "Continue · {N} picked" (dynamic count, enabled when N >= 1)
- Store: `setGoals()`
- Analytics: `ONBOARDING_STEP_COMPLETED` with `goals` array + count

**2g. `notifications.tsx` — Notifications (NEW)**

- Title: "Gentle nudges,\nnever spam."
- Subtitle: "We only ping you when it matters. You can change any of this later."
- 3 toggle rows (all default ON):
  - Service reminders — "Before the oil, chain, or tyres need attention"
  - Recall & safety alerts — "If it affects your bike — you're the first to know"
  - Seasonal tips — "Winter prep, spring checkups, summer touring"
- CTA: "Turn on notifications" → requests push permission via `expo-notifications` `requestPermissionsAsync()`
- Skip: "Not now" → skips permission request, goes to building
- Store: `setMaintenanceReminders()`, `setRecallAlerts()`, `setSeasonalTips()`

**2h. `building.tsx` — Building (NEW, replaces `personalizing.tsx`)**

- Title: "Building your\ngarage."
- Subtitle: "Setting up {year} {make} {model}" (from store, or "your motorcycle" if skipped)
- 4 animated progress steps with staggered appearance:
  1. "Loading service intervals" — appears at 0ms
  2. "Matching recall history" — appears at 800ms
  3. "Preparing your dashboard" — appears at 1600ms
  4. "Almost there" — appears at 2400ms
- Each step: check icon + text, `FadeInUp` animation
- Fires `CompleteOnboarding` mutation at mount (same pattern as `personalizing.tsx`)
- Upload bike photo if exists (same `uploadBikePhoto` util)
- Auto-advances to `welcome-home` after mutation completes + minimum 3s display time
- Retry logic: 3 attempts, then "Skip and continue" fallback
- `gestureEnabled: false`, no back button

**2i. `welcome-home.tsx` — Welcome Home (NEW, replaces `insights.tsx`)**

- Badge: "GARAGE READY" (uppercase, small, warm accent)
- Title: "Welcome home,\nrider."
- Subtitle: "Your {year} {make} {model} is ready, with a few things already waiting." (or "Your garage is ready" if no bike)
- Bike photo hero (user's photo or default stock image)
- 3 preview cards (static/mock data for perceived value):
  - "Next service in 56 days" / "Valve inspection · 20,000 km"
  - "No active recalls" / "Your {make} is clean"
  - "Track your TCO ({currency})" / "Set a purchase price to unlock"
- CTA: "Open my garage" → `router.replace('/(tabs)/(home)')`
- Sets `onboardingCompleted: true` in auth store
- Analytics: `ONBOARDING_COMPLETED`
- `gestureEnabled: false`, no back button

#### Phase 3: Cleanup + i18n

**3a. Delete removed V1 screens**

- `experience.tsx`
- `bike-year.tsx`
- `bike-make.tsx`
- `bike-model.tsx`
- `bike-type.tsx`
- `currency.tsx`
- `smart-maintenance.tsx`
- `insights.tsx`
- `paywall.tsx`
- `personalizing.tsx`

**3b. Delete unused components**

- `MileageSlider` (if no longer used elsewhere — check first)

**3c. Update `_layout.tsx`**

- Remove deleted screen entries from Stack.Screen definitions
- Add new screen entries: `rider-type`, `your-bike`, `preferences`, `goals`, `notifications`, `building`, `welcome-home`
- Update `gestureEnabled` per screen

**3d. Update i18n translations — ALL 13 locales**

Add new keys to `en.json` under `"onboarding"`:
```
riderTypeTitle, riderTypeSubtitle,
dailyRider, dailyRiderDesc, tourer, tourerDesc, wrenchAtHeart, wrenchAtHeartDesc, collector, collectorDesc,
yourBikeTitle, yourBikeSubtitle, yearLabel, makeLabel, modelLabel, searchMake, searchModel, skipForNow,
bikePhotoTitle, bikePhotoSubtitle, tapToAddPhoto, cameraOrLibrary, skipAddLater,
preferencesTitle, preferencesSubtitle, unitsLabel, metric, metricDesc, imperial, imperialDesc, nextServicePreview, currencyLabel, searchCurrencies,
goalsTitle, goalsSubtitle, goalMaintenance, goalMaintenanceDesc, goalExpenses, goalExpensesDesc, goalRides, goalRidesDesc, goalTrips, goalTripsDesc, goalHistory, goalHistoryDesc, goalRecalls, goalRecallsDesc, continueNPicked,
notificationsTitle, notificationsSubtitle, serviceReminders, serviceRemindersDesc, recallAlerts, recallAlertsDesc, seasonalTipsLabel, seasonalTipsDesc, turnOnNotifications, notNow,
buildingTitle, buildingSubtitle, buildingStep1, buildingStep2, buildingStep3, buildingStep4,
welcomeHomeTitle, welcomeHomeBadge, welcomeHomeSubtitle, nextServiceCard, nextServiceDesc, noRecallsCard, noRecallsDesc, trackTcoCard, trackTcoDesc, openMyGarage
```

Remove V1-only keys that are no longer used.

Then add translations to all 12 non-English locale files.

**Gotcha** (from learnings): Test `i18n.test.ts` asserts key parity across all 13 locale files. Adding keys to `en.json` alone passes lint/typecheck but fails tests.

**3e. Update analytics events**

- Update `ONBOARDING_COMPLETED` properties to include `rider_type`, `goals`, `has_bike`, `measurement_system`
- Remove old step names from analytics calls
- Add new step names for V2 screens

#### Phase 4: Verification

**4a. Run `pnpm generate`** — regenerate all types after GraphQL changes

**4b. Run `pnpm test`** — catch i18n parity failures

**4c. Run `pnpm lint`** — catch formatting issues

**4d. Run `pnpm precheck`** — full CI-equivalent check

**4e. Manual test flow** — walk through all 9 screens on iOS simulator

## System-Wide Impact

### Interaction Graph

- `CompleteOnboarding` mutation → Supabase `complete_onboarding` RPC → updates `users.preferences` JSONB + creates motorcycle row + sets `currency` + `measurement_system`
- Auth store `onboardingCompleted` flag → root `_layout.tsx` `NavigationGate` → redirects to `(tabs)/(home)`
- Onboarding store `reset()` → clears AsyncStorage `onboarding-state` after completion

### Error Propagation

- `CompleteOnboarding` failure in `building.tsx` → retry 3x → show "Skip and continue" → still sets `onboardingCompleted: true` to prevent stuck state
- NHTSA API failure in `your-bike.tsx` → fallback to free-type input (user types make/model manually)
- Photo upload failure → skip photo, continue with no photo URL

### State Lifecycle Risks

- **Zustand store version bump**: Users mid-onboarding on V1 store (version 3) must migrate cleanly to V2 store (version 4). Migration function must map `experienceLevel` → `riderType` (or null to re-collect).
- **Partial completion**: If `building.tsx` mutation fails but user force-quits, onboarding state is persisted in Zustand. Re-opening app re-enters onboarding at appropriate screen.

### API Surface Parity

- `CompleteOnboardingInput` DTO must match Zod schema in `@motovault/types` must match Supabase RPC parameters
- `complete-onboarding.graphql` client mutation must match API schema after `pnpm generate`

## Acceptance Criteria

### Functional Requirements

- [ ] 9-screen flow works end-to-end: welcome → rider-type → your-bike → bike-photo → preferences → goals → notifications → building → welcome-home
- [ ] Back button works on all screens except welcome, building, welcome-home
- [ ] Skip works on your-bike, bike-photo, notifications
- [ ] Rider type is single-select with auto-advance
- [ ] Your Bike consolidates year stepper + make search + model search on one scrollable screen
- [ ] Make/model search uses existing NHTSA GraphQL queries with free-type fallback
- [ ] Preferences shows metric/imperial toggle with live preview + searchable currency list
- [ ] Goals is multi-select with dynamic "Continue · N picked" CTA
- [ ] Notifications requests push permission on "Turn on notifications"
- [ ] Building shows animated progress steps + fires CompleteOnboarding mutation
- [ ] Welcome Home shows dashboard preview cards + bike photo + "Open my garage" CTA
- [ ] All 13 locale files have all new keys (i18n parity test passes)
- [ ] `pnpm precheck` passes (lint + typecheck + test)

### Non-Functional Requirements

- [ ] All animations use reanimated v4, under 300ms
- [ ] All colors from `ONBOARDING_COLORS` / palette tokens
- [ ] `borderCurve: 'continuous'` on all rounded elements
- [ ] Haptics on iOS for CTA taps and selections

## Dependencies

- Existing NHTSA GraphQL queries (`MotorcycleMakesDocument`, `MotorcycleModelsDocument`)
- Existing `uploadBikePhoto` utility
- Existing `OnboardingCard`, `OnboardingProgress`, `OnboardingContinueButton` components
- Existing `CompleteOnboarding` mutation pattern
- `expo-notifications` for push permission request
- `expo-image-picker` for bike photo

## Sources & References

### Internal References

- Onboarding store: `apps/mobile/src/stores/onboarding.store.ts`
- Onboarding config: `apps/mobile/src/config/onboarding.ts`
- Onboarding colors: `apps/mobile/src/components/onboarding/onboarding-colors.ts`
- CompleteOnboarding DTO: `apps/api/src/modules/users/dto/complete-onboarding.input.ts`
- NHTSA service: `apps/api/src/modules/motorcycles/nhtsa.service.ts`
- Analytics: `apps/mobile/src/lib/analytics.ts`

### Institutional Learnings

- `docs/solutions/architecture/currency-preference-full-stack-implementation.md` — Zustand persist version bump, iOS Hermes Intl bug, three-layer validation
- `docs/solutions/integration-issues/i18n-missing-keys-ci-failure.md` — 13-locale batch updates required
- `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` — always run `pnpm generate`
- `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md` — Zustand + useEffect patterns, haptics ownership
