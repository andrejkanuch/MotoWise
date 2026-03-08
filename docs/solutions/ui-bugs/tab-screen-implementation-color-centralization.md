---
title: "Tab Screen Implementation & Color Centralization"
problem_type: ui-bugs
component: apps/mobile
severity: medium
date_solved: 2026-03-06
tags:
  - expo-router
  - nativewind
  - design-system
  - dark-mode
  - color-tokens
  - tab-bar
  - react-native-reanimated
symptoms:
  - "Placeholder tab screens with no real UI"
  - "20+ hardcoded hex colors scattered across tab screens"
  - "No dark mode support on custom tab bar"
  - "Standard tab bar instead of design-spec island-style floating nav"
root_cause: "Missing screen implementations and no centralized color system for native props"
related_files:
  - packages/design-system/src/palette.ts
  - apps/mobile/src/app/(tabs)/_layout.tsx
  - apps/mobile/src/app/(tabs)/(home)/index.tsx
  - apps/mobile/src/app/(tabs)/(learn)/index.tsx
  - apps/mobile/src/app/(tabs)/(diagnose)/index.tsx
  - apps/mobile/src/app/(tabs)/(profile)/index.tsx
---

# Tab Screen Implementation & Color Centralization

## Problem

The mobile app had placeholder tab screens with minimal UI and no design consistency. Colors were hardcoded as hex strings throughout components, making theme changes impossible from a single location. The tab bar was a standard bottom navigation instead of the island-style floating design specified in the Figma prototype.

## Investigation

1. Reviewed the Figma design prototype for all 5 tab screens (Home, Learn, Diagnose, Garage, Profile)
2. Audited existing code for hardcoded hex values - found 20+ instances across 4 tab screens
3. Identified the dual color system requirement: NativeWind uses oklch (via `colors.ts`), but native component props (icon `color`, gradient `colors`, `backgroundColor` in style objects) require hex values
4. Checked Expo Router tab customization options for island-style navigation

## Root Cause

Two distinct issues:

1. **Missing implementations**: Tab screens were stubs with no real content, missing GraphQL queries, animations, and interactive elements
2. **Color fragmentation**: NativeWind's oklch color system (`colors.ts`) cannot be used in native props like `<Icon color={...} />` or `style={{ backgroundColor: ... }}`. Developers were writing raw hex strings inline, creating an unmaintainable web of color references.

## Solution

### 1. Created `packages/design-system/src/palette.ts`

A centralized hex color palette for all native contexts where oklch doesn't work:

```ts
export const palette = {
  // Brand
  primary500: '#3366e6',
  primary950: '#0a1628',
  // Neutral
  neutral100: '#f5f5f5',
  neutral300: '#d4d4d4',
  neutral400: '#a3a3a3',
  neutral500: '#737373',
  // Semantic
  danger500: '#ef4444',
  success500: '#22c55e',
  warning500: '#f59e0b',
  // Severity backgrounds (for diagnose screen)
  dangerBgLight: '#fee2e2',
  warningBgLight: '#fef3c7',
  successBgLight: '#dcfce7',
  // Module accent colors (for learn screen)
  moduleEngine: '#ef4444',
  moduleSuspension: '#3b82f6',
  moduleElectrical: '#f59e0b',
  moduleMaintenance: '#22c55e',
  // Gradient stops
  gradientCTAStart: '#1b3a6b',
  gradientCTAEnd: '#2563eb',
  // Tab bar
  tabActive: '#3366e6',
  tabInactive: '#a3a3a3',
  tabBarLight: '#ffffff',
  tabBarDark: '#1c1c1e',
  white: '#ffffff',
} as const;
```

Exported from `packages/design-system/src/index.ts` so all apps import via `@motolearn/design-system`.

### 2. Island-Style Floating Tab Bar

Replaced the standard tab bar with a custom `IslandTabBar` component using the `tabBar` prop on Expo Router's `<Tabs>`:

```tsx
function IslandTabBar({ state, navigation }: BottomTabBarProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{
      position: 'absolute',
      bottom: Math.max(insets.bottom, 12),
      left: 20, right: 20,
      backgroundColor: isDark ? palette.tabBarDark : palette.tabBarLight,
      borderRadius: 28,
      borderCurve: 'continuous',
      boxShadow: isDark
        ? '0 8px 24px rgba(0,0,0,0.4)'
        : '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      {/* Tab items with Haptics.impactAsync on iOS */}
    </Animated.View>
  );
}
```

### 3. Implemented 4 Full Tab Screens

Each screen follows consistent patterns:
- `useSafeAreaInsets()` for safe area (not SafeAreaView)
- `react-native-reanimated` FadeIn/FadeInUp with staggered delays
- `borderCurve: 'continuous'` on all rounded elements
- `palette.*` for all native color props
- NativeWind `className` for layout (oklch colors via Tailwind classes)
- `useTranslation()` for all user-facing strings (en/es/de)
- urql `useQuery` for GraphQL data

**Home**: App icon header, Setup Rider Profile gradient CTA (shows when onboarding incomplete), hero text, bike illustration area, primary bike spec pills, "Check Your Bike" scan CTA.

**Learn**: Search bar, progress card with animated bar, 4-module grid (Engine, Suspension, Electrical, Maintenance) with category-specific accent colors.

**Diagnose**: Camera scan CTA card, recent diagnostics list with severity-based color coding (critical/warning/default).

**Profile**: Avatar + name, stats grid with `tabular-nums`, MotoLearn PRO banner, settings menu, language picker, theme picker, sign out button.

### 4. Added Home Tab

Added a 5th tab `(home)` with its own Stack layout, making the tab count match the Figma design (Home, Learn, Diagnose, Garage, Profile).

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `palette.ts` from `colors.ts` | oklch (NativeWind/CSS) and hex (native props) serve different contexts; keeping them separate avoids confusion |
| `as const` on palette object | Enables type-safe palette keys and literal types |
| `boxShadow` string (not legacy shadow props) | Expo 55 / New Architecture supports CSS boxShadow; legacy props are deprecated |
| `useColorScheme() === 'dark'` for tab bar | NativeWind's hook provides real-time dark mode detection |
| `expo-haptics` guarded by `process.env.EXPO_OS` | Haptics only available on iOS; avoids Android crashes |
| `paddingBottom: 100` on ScrollViews | Accounts for floating tab bar height so content isn't obscured |

## Prevention Strategies

1. **Lint rule**: If adding a new color, add it to `palette.ts` first. Never use raw hex strings in component files.
2. **Code review checkpoint**: Search for `/\#[0-9a-fA-F]{3,8}/` in PRs touching `apps/mobile/` - any match should reference `palette.*` instead.
3. **Design system contract**: `colors.ts` = oklch for NativeWind className, `palette.ts` = hex for native props. Document this duality in the design system README.
4. **Tab bar testing**: Always test the floating tab bar in both light and dark mode, and on devices with different safe area insets (notch vs no-notch).

## Related Issues

- Design system setup: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`
- i18n implementation: All new screens use `useTranslation()` with keys added to en/es/de locale files

## Dependencies Added

- `expo-linear-gradient` - for gradient CTA backgrounds on Home screen
