---
title: "feat: Home Dashboard Screen"
type: feat
status: active
date: 2026-03-08
linear_issue: MOT-22
---

# feat: Home Dashboard Screen

## Overview

Redesign the mobile home screen from its current placeholder layout into a personalized dashboard with time-of-day greeting, rider profile card, quick action CTAs, and horizontally scrolling popular topics. This is the P0 MVP entry point — the first thing users see after onboarding.

**Linear issue:** [MOT-22](https://linear.app/lominic/issue/MOT-22/home-dashboard-screen) — Priority 2, Phase 1 MVP

## Problem Statement / Motivation

The current home screen (`apps/mobile/src/app/(tabs)/(home)/index.tsx`) is a placeholder with:
- Static hero title text
- Placeholder "Bike Illustration Area" boxes
- Basic spec pills for the primary motorcycle
- A single "Check Your Bike" CTA

It doesn't surface the app's key value: learning content, diagnostics, and progress tracking. Users have to navigate to other tabs to discover features. A proper dashboard will increase engagement by showing personalized content and quick-access actions from the first screen.

## Proposed Solution

Replace the current home screen with a dashboard layout consisting of 5 sections:

### 1. Time-of-Day Greeting Header
- "Good morning, [Name]! Ready to learn?" (variants: morning/afternoon/evening)
- User avatar button (navigates to profile)
- Uses `MeDocument` query for user data

### 2. Rider Profile Card
- Pressable card showing: avatar, full name, experience level badge, active motorcycle (make/model/year)
- Tapping opens Profile screen via `router.push('/(tabs)/(profile)')`
- Uses `MeDocument` + `MyMotorcyclesDocument` (primary bike)
- Gradient background matching app brand

### 3. Quick Action Cards (3 cards in a row)
- **"Take a Diagnostic"** — icon: `Camera`, navigates to `/(tabs)/(diagnose)`
- **"Learn Something New"** — icon: `BookOpen`, navigates to `/(tabs)/(learn)`
- **"Test Your Knowledge"** — icon: `Brain`, navigates to `/(tabs)/(learn)` (quiz section)
- Each card: icon, title, short description, pressable with haptic feedback
- Animated entry with staggered FadeInUp

### 4. Popular Topics (Horizontal ScrollView)
- Horizontally scrolling article cards fetched via `SearchArticlesDocument`
- Each card: thumbnail placeholder, title, difficulty badge (beginner/intermediate/advanced), AI-generated badge
- Pressable → navigates to article detail
- Uses `queryKeys.articles.list({ sortBy: 'popular' })` or similar

### 5. Setup Profile CTA (Conditional)
- Shown only if `onboardingCompleted === false` or no motorcycles added
- Gradient CTA linking to onboarding/add-bike flow
- Already exists in current implementation — keep and polish

## Technical Considerations

### Data Fetching
- **Queries needed:** `MeDocument`, `MyMotorcyclesDocument`, `SearchArticlesDocument`
- All use TanStack Query v5 with `queryKeys` factory
- `gqlFetcher` from `lib/graphql-client.ts` handles auth token
- Pull-to-refresh via `RefreshControl` invalidating all three queries

### Styling
- Dark theme: `bg-neutral-950` / `dark:bg-neutral-950`
- Colors from `palette.ts` hex constants (NOT oklch from design system)
- `borderCurve: 'continuous'` on all rounded elements
- Icons from `lucide-react-native`
- Gradients from `expo-linear-gradient`

### Animations
- `react-native-reanimated` v4
- `FadeIn.duration(300)` for container
- `FadeInUp.delay(index * 50).duration(400)` for staggered cards
- Keep all animations under 300ms

### i18n
- Add new translation keys under `home.*` namespace
- Time-of-day variants: `home.greetingMorning`, `home.greetingAfternoon`, `home.greetingEvening`
- Quick action labels: `home.takeDiagnostic`, `home.learnNew`, `home.testKnowledge`
- Section titles: `home.quickActions`, `home.popularTopics`
- Add to all 3 locales: en.json, es.json, de.json

### Navigation
- Quick action cards use `router.push()` for cross-tab navigation
- Profile card uses `router.push('/(tabs)/(profile)')`
- Article cards use `router.push()` to article detail (if exists) or Learn tab

## Acceptance Criteria

- [ ] Personalized greeting with time-of-day variant (Morning before 12, Afternoon 12-17, Evening after 17)
- [ ] Rider profile card showing avatar, name, experience badge, active motorcycle
- [ ] Tapping profile card navigates to Profile screen
- [ ] 3 quick action cards: Diagnostic, Learn, Quiz — each navigates correctly
- [ ] Quick action cards have haptic feedback on press (iOS)
- [ ] Popular Topics horizontal scroll with article cards (thumbnail, title, difficulty badge)
- [ ] Setup Profile CTA shown when onboarding incomplete or no motorcycles
- [ ] Pull-to-refresh refreshes all dashboard data
- [ ] Staggered enter animations on all sections
- [ ] All text uses i18n translation keys (en/es/de)
- [ ] Dark mode support
- [ ] Loading states with ActivityIndicator
- [ ] Empty states handled gracefully
- [ ] Biome lint passes
- [ ] TypeScript compiles without errors

## Implementation Phases

### Phase 1: Data & Translations
- [x] Add i18n keys to en.json, es.json, de.json for all new home screen text
- [x] Verify GraphQL queries work: `MeDocument`, `MyMotorcyclesDocument`, `SearchArticlesDocument`
- [x] Create time-of-day greeting utility function

### Phase 2: Screen Layout & Components
- [x] Rewrite `apps/mobile/src/app/(tabs)/(home)/index.tsx`
- [x] Greeting header with avatar button
- [x] Rider profile card component (pressable, gradient)
- [x] Quick action cards (3-column grid)
- [x] Popular topics horizontal scroll
- [x] Setup profile CTA (conditional, existing pattern)

### Phase 3: Interactivity & Polish
- [x] Pull-to-refresh with RefreshControl
- [x] Haptic feedback on card presses
- [x] Staggered FadeInUp animations
- [x] Loading/error/empty states
- [x] Dark mode styling

### Phase 4: Verification
- [x] Biome lint + TypeScript check
- [ ] Test all 3 locales
- [ ] Test dark/light modes
- [ ] Verify navigation to all target screens

## Success Metrics

- Dashboard loads in under 1 second (queries are cached after first load)
- All 3 quick actions navigate correctly
- Popular topics show real article data
- All text translated in 3 languages

## Dependencies & Risks

- **SearchArticlesDocument availability** — need to verify the query supports sorting/filtering for "popular" articles. May need a simple `first: 5` limit.
- **Article detail screen** — popular topics cards need a destination. If no article detail screen exists yet, cards can navigate to the Learn tab instead.
- **User avatar** — if no avatar system exists, use initials-based avatar (first letter of name in colored circle).

## Sources & References

- Similar patterns: `apps/mobile/src/app/(tabs)/(garage)/index.tsx` (card grid, FAB, animations)
- Profile card: `apps/mobile/src/app/(tabs)/(profile)/index.tsx` (avatar, stats, gradient)
- Data fetching: `apps/mobile/src/lib/query-keys.ts`, `apps/mobile/src/lib/graphql-client.ts`
- Design tokens: `packages/design-system/src/colors.ts`, `packages/design-system/src/spacing.ts`
- Solution: `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md`
- Solution: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`
