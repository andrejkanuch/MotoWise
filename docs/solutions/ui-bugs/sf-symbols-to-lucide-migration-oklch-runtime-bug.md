---
title: "SF Symbols to Lucide Migration + oklch Runtime Bug"
category: ui-bugs
tags: [lucide-react-native, expo-symbols, sf-symbols, oklch, react-native, icons, design-system]
module: Mobile
symptom: "Icons only render on iOS (SF Symbols), oklch colors invisible in RN inline styles"
root_cause: "SF Symbols are iOS-only; oklch() color format not supported by React Native style engine"
date: 2026-03-06
severity: high
---

# SF Symbols to Lucide Migration + oklch Runtime Bug

## Problem

Two related issues in the MotoWise mobile app:

1. **SF Symbols are iOS-only** — The app used `expo-symbols` (SymbolView) and `expo-image` with `source="sf:..."` for all icons. These only render on iOS, leaving Android with no icons.

2. **oklch colors cause invisible UI on native** — The design system (`@motolearn/design-system`) exports all colors as `oklch()` strings (e.g., `oklch(0.55 0.17 230)`). While CSS/web can parse oklch, React Native's inline style engine cannot. Any component using `colors.primary[500]` as a `color` or `backgroundColor` prop silently fails — the color renders as transparent/invisible.

### Symptoms

- Tab bar icons invisible on Android
- Tab bar active tint color not showing (oklch string passed to `tabBarActiveTintColor`)
- Experience level icons, checkmarks, and goal icons missing on Android
- No error thrown — oklch silently fails in RN

## Root Cause

### SF Symbols
`expo-symbols` wraps Apple's SF Symbols framework, which is unavailable on Android. The `expo-image` `source="sf:name"` syntax also maps to SF Symbols.

### oklch Colors
React Native's style system only supports: hex (`#RRGGBB`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, and named colors. The `oklch()` format is a CSS Color Level 4 feature supported by modern browsers but not by React Native's Yoga/style engine.

The design system was built for web (Tailwind CSS) and exports oklch tokens. When imported in RN inline styles, the string is silently ignored.

## Solution

### Icon Migration: expo-symbols/SF Symbols -> lucide-react-native

```bash
pnpm --filter @motolearn/mobile add lucide-react-native react-native-svg
pnpm --filter @motolearn/mobile remove expo-symbols
```

Replace SF Symbol usage:

```tsx
// BEFORE (iOS only)
import { SymbolView } from 'expo-symbols';
<SymbolView name="book.fill" tintColor={color} size={22} />

// BEFORE (iOS only, expo-image)
import { Image } from 'expo-image';
<Image source="sf:bicycle" style={{ width: 26, height: 26 }} tintColor="#34D399" />

// AFTER (cross-platform)
import { BookOpen, Bike } from 'lucide-react-native';
<BookOpen size={22} color={color} strokeWidth={2} />
<Bike size={26} color="#34D399" strokeWidth={2} />
```

Lucide icons accept `size`, `color`, and `strokeWidth` props. They render as SVG via `react-native-svg` and work on both iOS and Android.

### oklch Fix: Use hex constants in RN code

```tsx
// BEFORE (broken on native - oklch not supported)
import { colors } from '@motolearn/design-system';
<Text style={{ color: colors.primary[500] }}>Hello</Text>
// colors.primary[500] = 'oklch(0.55 0.17 230)' -> RN ignores this

// AFTER (works everywhere)
const ACTIVE_COLOR = '#4F6BED';  // hex equivalent of primary-500
const INACTIVE_COLOR = '#9CA3AF';
<Text style={{ color: ACTIVE_COLOR }}>Hello</Text>
```

**Rule**: Never use `colors.*` from `@motolearn/design-system` in React Native inline styles. The design system tokens are for CSS/Tailwind only. In RN, use hex constants.

## Files Changed

| File | Change |
|------|--------|
| `(tabs)/_layout.tsx` | SymbolView -> lucide icons, oklch -> hex constants |
| `(onboarding)/index.tsx` | sf:bicycle/car/flame/checkmark -> Bike/Gauge/Flame/Check |
| `(onboarding)/riding-goals.tsx` | Added 6 lucide icons per goal |
| `(onboarding)/personalizing.tsx` | Added Sparkles/Search/Bike/LayoutDashboard/Check |
| `(onboarding)/select-bike.tsx` | Added Calendar/Search/Bike/Tag/ChevronRight/SkipForward |
| `(tabs)/(garage)/index.tsx` | Text "+" -> lucide Plus icon |
| `(auth)/login.tsx` + `register.tsx` | Removed sf:apple.logo |

## Prevention Strategies

1. **Lint rule**: Add a custom Biome/ESLint rule or code review checklist item: "Never import `colors` from `@motolearn/design-system` in `.tsx` files under `apps/mobile/`"
2. **Design system hex export**: Consider adding a parallel `colors-hex.ts` export in the design system package that provides RN-compatible hex values
3. **Icon convention**: Document in CLAUDE.md: "Use `lucide-react-native` for all icons, never `expo-symbols` or `@expo/vector-icons`" (already done)
4. **Cross-platform testing**: Always test on both iOS and Android before merging icon/color changes

## Related

- `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — previous PR review findings
- oklch browser support: CSS Color Level 4 spec, not supported in RN
- lucide-react-native docs: icons accept `size`, `color`, `strokeWidth` props
- Expo SDK 54 compatible with `react-native-svg` (required by lucide)
