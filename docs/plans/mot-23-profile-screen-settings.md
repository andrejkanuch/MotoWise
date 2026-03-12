# MOT-23: Profile Screen + Settings

## Status: Planning
## Linear: https://linear.app/lominic/issue/MOT-23/profile-screen-settings

## Context

The profile screen and settings are ~80% complete. Three gaps remain against the acceptance criteria.

## Gap Analysis

### What Exists
- Profile header with avatar (initials), full name, experience level badge
- Stats row (level, rank, badges — hardcoded placeholders)
- Pro upgrade banner (CTA)
- Settings section: Profile Settings, Notifications, Privacy, Help & Support
- Language selector (en/es/de) and theme selector (system/light/dark)
- Logout button
- Profile Settings screen (edit name, experience level, riding goals)
- GraphQL `me` query + `updateUser` mutation — fully wired

### What's Missing (3 items)

1. **"Edit Profile" button** on the profile header card — AC says there should be an explicit button
2. **Motorcycle list section** on profile screen — AC says "all registered bikes with thumbnails, make/model, year, 'Add Another Bike' button"
3. **Subscriptions settings row** — AC lists "Subscriptions" as a settings menu item; currently missing

## Implementation Plan

### Task 1: Add "Edit Profile" button to profile header card
**File:** `apps/mobile/src/app/(tabs)/(profile)/index.tsx`
**Changes:**
- Add an "Edit Profile" button below the experience level text, before the stats row
- Pressing it navigates to `/(profile)/settings`
- Style: outlined or subtle filled button matching the design language
- Add i18n key `profile.editProfile`

### Task 2: Add motorcycle list section to profile screen
**File:** `apps/mobile/src/app/(tabs)/(profile)/index.tsx`
**Changes:**
- Import `MyMotorcyclesDocument` from `@motovault/graphql`
- Add a `useQuery` call for the user's motorcycles
- Render a "My Bikes" section between the User Card and Pro Banner
- Each bike shows: make, model, year (no photo thumbnails exist yet — use a bike icon placeholder)
- Show "primary" badge on the primary bike
- Add an "Add Another Bike" pressable at the bottom → navigates to `/(garage)/add-bike`
- If no bikes, show an empty state with "Add Your First Bike" CTA
- Stagger animations with `FadeInUp.delay(index * 50)`
- Add i18n keys: `profile.myBikes`, `profile.addAnotherBike`, `profile.addFirstBike`

### Task 3: Add Subscriptions settings row
**File:** `apps/mobile/src/app/(tabs)/(profile)/index.tsx`
**Changes:**
- Add a `CreditCard` icon import from lucide-react-native
- Add a "Subscriptions" `SettingsRow` between Privacy and Help & Support
- On press: for now, can navigate to a placeholder or trigger the Pro banner action
- Add i18n key `profile.subscriptions`

### Task 4: Update i18n translation files
**Files:** `apps/mobile/src/i18n/locales/{en,es,de}.json`
**Changes:**
- Add all new i18n keys with translations for all 3 locales

### Task 5: Verify typecheck passes
- Run `pnpm --filter mobile tsc --noEmit` to confirm no type errors
- Run `pnpm lint` to confirm formatting

## Files Modified
- `apps/mobile/src/app/(tabs)/(profile)/index.tsx` (main changes)
- `apps/mobile/src/i18n/locales/en.json`
- `apps/mobile/src/i18n/locales/es.json`
- `apps/mobile/src/i18n/locales/de.json`

## Out of Scope
- Avatar image upload (no avatar_url infrastructure yet beyond DB column)
- Real stats data (level, rank, badges are placeholders — separate feature)
- Subscriptions screen implementation (just the nav row for now)
- Notifications/Privacy screen completion
