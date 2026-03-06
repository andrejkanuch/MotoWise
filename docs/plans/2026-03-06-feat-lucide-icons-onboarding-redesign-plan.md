---
title: "feat: Lucide icons + onboarding redesign"
type: feat
status: active
date: 2026-03-06
---

# Lucide Icons + Onboarding Redesign

## Overview

Replace all SF Symbol (expo-image sf:, expo-symbols SymbolView) icon usage with lucide-react-native across the entire mobile app. Simultaneously redesign all 4 onboarding screens with premium dark UI following building-native-ui and frontend-design skills.

## Scope

### Icon Migration (all screens)

| File | Current | Lucide Replacement |
|------|---------|-------------------|
| `(tabs)/_layout.tsx` | SymbolView: book.fill, wrench.and.screwdriver.fill, car.fill, person.fill | BookOpen, Wrench, Bike, User |
| `(onboarding)/index.tsx` | sf:bicycle, sf:car.fill, sf:flame.fill, sf:checkmark | Bike, Gauge, Flame, Check |
| `(auth)/login.tsx` | sf:apple.logo | Apple icon (keep text fallback) |
| `(auth)/register.tsx` | sf:apple.logo | Apple icon (keep text fallback) |
| `(tabs)/(garage)/index.tsx` | Text "+" | Plus icon |
| `(onboarding)/personalizing.tsx` | No icons | Add Sparkles, Search, LayoutDashboard |

### Onboarding Redesign (4 screens)

1. **Welcome/Experience** (`index.tsx`) — Rich cards with lucide icons, gradient-like colored icon containers, improved spacing and typography
2. **Select Bike** (`select-bike.tsx`) — Better visual hierarchy, search icon in input, calendar icon for year, bike icon for models section
3. **Riding Goals** (`riding-goals.tsx`) — Icon-enhanced goal cards in 2-column grid with lucide icons per goal
4. **Personalizing** (`personalizing.tsx`) — Animated checkmarks per step, sparkles icon, richer loading state

### Progress Bar Enhancement

Update `components/progress-bar.tsx` with thicker bars and smoother animations.

## Technical Approach

- `lucide-react-native` + `react-native-svg` already installed
- Import icons directly: `import { Bike, Wrench } from 'lucide-react-native'`
- Lucide icons accept `size`, `color`, `strokeWidth` props
- Remove `expo-symbols` dependency after migration
- All screens use inline styles (no className/Tailwind in onboarding)
- Dark theme: `#0F172A` background, white/rgba text
- Haptic feedback on all interactive elements (iOS only)
- Staggered FadeInUp animations on list items
- `borderCurve: 'continuous'` on all rounded elements

## Implementation Phases

### Phase 1: Onboarding screens (parallel agents)
- Agent 1: `(onboarding)/index.tsx` — experience level with lucide icons
- Agent 2: `(onboarding)/select-bike.tsx` — bike selection with icons + visual polish
- Agent 3: `(onboarding)/riding-goals.tsx` — goal cards with per-goal lucide icons
- Agent 4: `(onboarding)/personalizing.tsx` — animated loading with lucide icons

### Phase 2: Auth + Tabs + Garage (parallel agents)
- Agent 5: `(auth)/login.tsx` + `(auth)/register.tsx` — replace sf:apple.logo
- Agent 6: `(tabs)/_layout.tsx` — SymbolView → lucide
- Agent 7: `(tabs)/(garage)/index.tsx` — Plus FAB icon

### Phase 3: Cleanup
- Remove `expo-symbols` from package.json if no longer used
- Update progress-bar component

## Acceptance Criteria

- [ ] All SF Symbol usage replaced with lucide-react-native
- [ ] All 4 onboarding screens redesigned with premium dark UI
- [ ] Each riding goal has a unique lucide icon
- [ ] Each experience level has a unique lucide icon with color coding
- [ ] Tab bar uses lucide icons
- [ ] Garage FAB uses lucide Plus icon
- [ ] No expo-symbols imports remain
- [ ] Haptic feedback preserved on all interactions
- [ ] Animations preserved (FadeIn, stagger, spring)
- [ ] App runs in Expo Go without errors
