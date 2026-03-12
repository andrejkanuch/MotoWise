---
title: "feat: Foundation — Auth + Garage CRUD + Onboarding"
type: feat
status: active
date: 2026-03-06
linear: MOT-5, MOT-6, MOT-7
---

# Foundation — Auth + Garage CRUD + Onboarding

## Overview

Wire up the foundational user flows: social auth (Google + Apple + email), motorcycle CRUD with NHTSA-powered make/model picker, and a stunning 4-step onboarding experience. Most backend infrastructure already exists — this is primarily about completing the mobile client and adding OAuth + NHTSA integration.

## Current State

| Area | Backend | Mobile | Gap |
|------|---------|--------|-----|
| Auth (email) | Supabase Auth + JWT guard | Login/register screens | Working |
| Auth (OAuth) | Not configured | Not built | Full build |
| Motorcycle CRUD | Resolvers + service + RLS | Empty screens, no .graphql files | Wire up |
| NHTSA integration | None | None | Full build |
| Onboarding | None | None | Full build |

## Phase 1: OAuth — Google + Apple Sign-In

### 1a. Supabase Dashboard Config
- [ ] Enable Google provider in Supabase Auth settings (need Google Cloud Console OAuth credentials)
- [ ] Enable Apple provider in Supabase Auth settings (need Apple Developer credentials)
- [ ] Add redirect URL: `motovault://` to Supabase Auth URL Configuration

### 1b. Mobile Dependencies
- [ ] `npx expo install expo-apple-authentication expo-crypto`
- [ ] `npx expo install @react-native-google-signin/google-signin`
- [ ] Update `app.json` — add Apple Sign-In entitlement + Google config plugin

### 1c. Auth Screen Redesign (`apps/mobile/src/app/(auth)/`)

**sign-in.tsx** (replace login.tsx):
- Social buttons at top: "Continue with Apple" (iOS only), "Continue with Google"
- Divider: "or"
- Email + password fields below
- Link to sign-up
- Apple Sign-In: `expo-apple-authentication` + `signInWithIdToken`
- Google Sign-In: `@react-native-google-signin/google-signin` + `signInWithIdToken`

**sign-up.tsx** (replace register.tsx):
- Same social buttons
- Full name + email + password fields
- Link to sign-in

### Files modified:
- `apps/mobile/src/app/(auth)/login.tsx` — rename to sign-in, add OAuth
- `apps/mobile/src/app/(auth)/register.tsx` — rename to sign-up, add OAuth
- `apps/mobile/app.json` — add plugins + entitlements
- `apps/mobile/package.json` — new deps

## Phase 2: NHTSA Motorcycle Data Integration

### 2a. API — NHTSA Proxy Service (`apps/api/src/modules/motorcycles/`)

Create `nhtsa.service.ts`:
- [ ] `getMakes()` — calls `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/motorcycle?format=json`, caches in memory (TTL 24h)
- [ ] `getModels(makeId, year)` — calls `GetModelsForMakeIdYear/makeId/{id}/modelyear/{year}/vehicletype/motorcycle?format=json`
- [ ] Flag top ~50 popular makes (Honda, Yamaha, Kawasaki, Suzuki, Harley-Davidson, BMW, Ducati, KTM, Triumph, Royal Enfield, Indian, Aprilia, Husqvarna, etc.)
- [ ] Return sorted: popular first, then alphabetical

### 2b. API — New Resolvers

Add to `motorcycles.resolver.ts`:
- [ ] `motorcycleMakes` query (public, no auth needed) — returns make list
- [ ] `motorcycleModels(makeId, year)` query (public) — returns model list
- [ ] `updateMotorcycle(id, input)` mutation (auth guarded)
- [ ] `deleteMotorcycle(id)` mutation (auth guarded, soft delete)

### 2c. GraphQL Operations for Mobile

Create `apps/mobile/src/graphql/`:
- [ ] `queries/my-motorcycles.graphql`
- [ ] `queries/motorcycle-makes.graphql`
- [ ] `queries/motorcycle-models.graphql`
- [ ] `mutations/create-motorcycle.graphql`
- [ ] `mutations/update-motorcycle.graphql`
- [ ] `mutations/delete-motorcycle.graphql`
- [ ] Run `pnpm generate` to create TypedDocumentNode types

### Files created:
- `apps/api/src/modules/motorcycles/nhtsa.service.ts`
- `apps/api/src/modules/motorcycles/models/motorcycle-make.model.ts`
- `apps/api/src/modules/motorcycles/models/motorcycle-model-result.model.ts`
- `apps/mobile/src/graphql/queries/*.graphql` (3 files)
- `apps/mobile/src/graphql/mutations/*.graphql` (3 files)

### Files modified:
- `apps/api/src/modules/motorcycles/motorcycles.resolver.ts` — add queries/mutations
- `apps/api/src/modules/motorcycles/motorcycles.service.ts` — add update/delete
- `apps/api/src/modules/motorcycles/motorcycles.module.ts` — register NhtsaService

## Phase 3: Wire Garage Screens

### 3a. Garage List (`apps/mobile/src/app/(tabs)/(garage)/index.tsx`)
- [ ] Fetch `myMotorcycles` via urql query
- [ ] Render motorcycle cards (make, model, year, primary badge)
- [ ] Pull-to-refresh
- [ ] Empty state with CTA to add bike
- [ ] Tap card → navigate to bike/[id]

### 3b. Add Bike (`apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx`)
- [ ] Year picker (simple numeric input or scroll picker)
- [ ] Make dropdown — fetch from `motorcycleMakes`, show popular first, searchable
- [ ] Model dropdown — fetch from `motorcycleModels(makeId, year)`, filtered by selected make+year
- [ ] Optional nickname field
- [ ] Submit calls `createMotorcycle` mutation
- [ ] Success → navigate back to garage
- [ ] Use `presentation: 'formSheet'` for native feel

### 3c. Bike Detail (`apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`)
- [ ] Show motorcycle details
- [ ] Edit button (inline editing or navigate to edit screen)
- [ ] Delete button (confirmation → soft delete → navigate back)

### Files modified:
- `apps/mobile/src/app/(tabs)/(garage)/index.tsx`
- `apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx`
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`

## Phase 4: Onboarding Flow

### Design Direction
Stunning first contact. Step-by-step continuous flow with:
- Staggered `FadeInUp` animations via `react-native-reanimated`
- `borderCurve: 'continuous'` on all rounded elements
- Brand colors from `@motovault/design-system`
- Haptic feedback on selections (expo-haptics, iOS only)
- Linear progress indicator at top

### Route Structure
```
apps/mobile/src/app/(onboarding)/
  _layout.tsx              — Stack, headerShown: false
  index.tsx                — Step 1: Welcome + experience level
  select-bike.tsx          — Step 2: Add first motorcycle (NHTSA picker)
  riding-goals.tsx         — Step 3: Riding goals multi-select
  personalizing.tsx        — Step 4: AI setup animation → redirect to tabs
```

### 4a. Root Layout Auth Gating Update
- [ ] Check `users.preferences.onboarding_completed` flag
- [ ] If authenticated but NOT onboarded → redirect to `/(onboarding)`
- [ ] If authenticated AND onboarded → redirect to `/(tabs)`

### 4b. Step 1: Welcome + Experience Level (`index.tsx`)
- [ ] MotoVault branding with tagline
- [ ] Three experience cards: Beginner / Intermediate / Advanced
- [ ] Animated card selection with scale + haptics
- [ ] "Continue" button at bottom

### 4c. Step 2: Select Bike (`select-bike.tsx`)
- [ ] Year input
- [ ] Make searchable dropdown (NHTSA data, popular first)
- [ ] Model dropdown (filtered by make + year)
- [ ] Optional nickname
- [ ] Calls `createMotorcycle` mutation
- [ ] "Skip" option (can add later)

### 4d. Step 3: Riding Goals (`riding-goals.tsx`)
- [ ] Multi-select chips: Commute, Weekend rides, Track days, Touring, Learning, DIY maintenance
- [ ] Animated selection state
- [ ] Saves to user preferences via `updateUser` mutation

### 4e. Step 4: Personalizing (`personalizing.tsx`)
- [ ] Full-screen animated "Personalizing your MotoVault experience..."
- [ ] 2-3 second animation with progress indicators
- [ ] Sets `onboarding_completed: true` in user preferences
- [ ] Auto-navigates to `/(tabs)/(learn)`

### Files created:
- `apps/mobile/src/app/(onboarding)/_layout.tsx`
- `apps/mobile/src/app/(onboarding)/index.tsx`
- `apps/mobile/src/app/(onboarding)/select-bike.tsx`
- `apps/mobile/src/app/(onboarding)/riding-goals.tsx`
- `apps/mobile/src/app/(onboarding)/personalizing.tsx`

### Files modified:
- `apps/mobile/src/app/_layout.tsx` — add onboarding gating
- `apps/api/src/modules/users/dto/update-user.input.ts` — add preferences field

## Phase 5: i18n Keys

- [ ] Add onboarding keys to en.json, es.json, de.json
- [ ] Add auth OAuth keys (signInWithGoogle, signInWithApple, orDivider)
- [ ] Add garage action keys (editBike, deleteBike, confirmDelete, emptyGarage)

## Acceptance Criteria

### Functional
- [ ] Users can sign in with Google
- [ ] Users can sign in with Apple (iOS)
- [ ] Users can sign in with email/password (existing)
- [ ] Users can sign up with email/password (existing)
- [ ] New users see onboarding flow before main app
- [ ] Onboarding collects: experience level, first motorcycle, riding goals
- [ ] Motorcycle make/model populated from NHTSA API
- [ ] Users can add, view, and delete motorcycles
- [ ] Garage screen shows all user motorcycles
- [ ] Onboarding state persists (completed flag in user preferences)

### Quality
- [ ] All screens use design tokens from `@motovault/design-system`
- [ ] Onboarding has smooth animations (reanimated)
- [ ] `borderCurve: 'continuous'` on all rounded elements
- [ ] All user-facing strings use i18n `t()` calls
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

## Dependencies
- Google Cloud Console OAuth 2.0 credentials (web client ID + iOS client ID)
- Apple Developer account with Sign-In with Apple capability
- Supabase dashboard provider configuration
