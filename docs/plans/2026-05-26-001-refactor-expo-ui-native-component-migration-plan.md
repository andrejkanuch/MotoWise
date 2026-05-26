---
title: "refactor: Replace custom UI components with @expo/ui native equivalents"
type: refactor
status: active
date: 2026-05-26
---

# Replace Custom UI Components with @expo/ui Native Equivalents

## Overview

Migrate custom-built UI components to native `@expo/ui` equivalents shipped with Expo SDK 56. This reduces custom code, improves platform-native feel, and leverages SwiftUI (iOS) / Jetpack Compose (Android) rendering. The migration targets 3 active replacements and 2 dead code removals, keeping complex custom components (editorial design system, @gorhom/bottom-sheet, etc.) untouched.

## Problem Statement / Motivation

The app already uses `@expo/ui` for 3 components (DateTimePicker, Slider, Toggle) but still has custom implementations for patterns that Expo UI now handles natively. These custom components add maintenance burden and miss platform-native behavior (e.g., native segmented controls, native picker wheels, native context menus). Two shared components (`PickerSheet`, `ListGroup`) are dead code with zero consumers.

## Proposed Solution

### Phase 1: FocusPicker → SegmentedControl (Low risk)

**Current**: `src/components/home/focus-picker.tsx` — custom horizontal ScrollView with Pressable pills
**Consumer**: `src/app/(tabs)/(home)/index.tsx:881`
**Replace with**: `@expo/ui/community/segmented-control` (cross-platform drop-in)

```tsx
// Before: ~80 lines of custom Pressable + ScrollView + theme logic
<FocusPicker selected={focus} onSelect={setFocus} />

// After: native SegmentedControl
import SegmentedControl from '@expo/ui/community/segmented-control';

<SegmentedControl
  values={['This Month', 'Upcoming Trip', 'Ride History']}
  selectedIndex={focusIndex}
  onChange={(e) => setFocusIndex(e.nativeEvent.selectedSegmentIndex)}
  appearance={isDark ? 'dark' : 'light'}
/>
```

**Files to modify**:
- `src/components/home/focus-picker.tsx` — delete file
- `src/app/(tabs)/(home)/index.tsx` — replace import + usage

### Phase 2: Profile Pickers → @expo/ui Picker (Low risk)

**Current**: Inline `<Modal presentationStyle="formSheet">` with ScrollView option list in profile screen
**Location**: `src/app/(tabs)/(profile)/index.tsx` — language picker (~line 1100) and currency picker (~line 1328)
**Replace with**: `@expo/ui/swift-ui` `Picker` with `pickerStyle('menu')` on iOS, existing inline Modal on Android

```tsx
// iOS: native SwiftUI Picker menu
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

{process.env.EXPO_OS === 'ios' ? (
  <Host matchContents>
    <Picker
      selection={selectedLanguage}
      onSelectionChange={setSelectedLanguage}
      modifiers={[pickerStyle('menu')]}
    >
      {languages.map(lang => (
        <Text key={lang.code} modifiers={[tag(lang.code)]}>{lang.name}</Text>
      ))}
    </Picker>
  </Host>
) : (
  // Android: keep existing Modal implementation or use Alert picker
)}
```

**Files to modify**:
- `src/app/(tabs)/(profile)/index.tsx` — replace language + currency picker sections

### Phase 3: ActionSheetIOS → Utility wrapper (Medium risk)

**Current**: 10 call sites across 8 files, each with `if (Platform.OS === 'ios') ActionSheetIOS... else Alert.alert...`
**Replace with**: A cross-platform utility that uses `ActionSheetIOS` on iOS and `Alert.alert` on Android (consolidate the existing pattern)

> **Note**: `@expo/ui` ContextMenu requires wrapping content in a `<Host>` and is trigger-based (long-press). It's not a drop-in for imperative `ActionSheetIOS.showActionSheetWithOptions()` calls. Instead, create a unified utility.

```tsx
// src/utils/action-sheet.ts
import { ActionSheetIOS, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ActionSheetOption {
  label: string;
  onPress: () => void;
  style?: 'destructive' | 'cancel';
}

export function showActionSheet(title: string, options: ActionSheetOption[]) {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const labels = options.map(o => o.label);
    const destructiveIndex = options.findIndex(o => o.style === 'destructive');
    const cancelIndex = options.findIndex(o => o.style === 'cancel');

    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: labels, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
      (index) => { options[index]?.onPress(); }
    );
  } else {
    const buttons = options.map(o => ({
      text: o.label,
      onPress: o.onPress,
      style: o.style as 'destructive' | 'cancel' | 'default' | undefined,
    }));
    Alert.alert(title, undefined, buttons);
  }
}
```

**Files to modify**:
- `src/utils/action-sheet.ts` — new utility (extract from `marker-action-sheet.ts`)
- `src/utils/marker-action-sheet.ts` — refactor to use new utility
- `src/app/(modals)/create-trip.tsx` — replace inline ActionSheetIOS
- `src/app/(tabs)/(garage)/edit-bike.tsx` — replace inline ActionSheetIOS
- `src/app/(tabs)/(garage)/bike/[id].tsx` — replace inline ActionSheetIOS (2 sites)
- `src/app/(tabs)/(profile)/saved.tsx` — replace inline ActionSheetIOS
- `src/app/(tabs)/(profile)/trips.tsx` — replace inline ActionSheetIOS
- `src/components/comments/comment-item.tsx` — replace inline ActionSheetIOS
- `src/components/TaskPhotoGallery.tsx` — replace inline ActionSheetIOS
- `src/components/ExpensePhotoGallery.tsx` — replace inline ActionSheetIOS
- `src/components/trip/role-picker-sheet.tsx` — replace inline ActionSheetIOS

### Phase 4: Dead Code Cleanup (No risk)

**Delete unused components**:
- `src/components/profile/shared/picker-sheet.tsx` — zero consumers (profile screen has inline implementations)
- `src/components/profile/shared/list-group.tsx` — zero consumers
- Update barrel export: `src/components/profile/shared/index.ts`

## Technical Considerations

### Color Safety (Critical)
All `@expo/ui` component color props **must** use `palette.*` hex tokens from `@motovault/design-system`. The oklch tokens from `colors.ts` are for NativeWind/CSS only and are **silently ignored** by React Native's native style engine. This was documented as a gotcha in `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`.

### Platform Parity
- `@expo/ui/swift-ui` components render only on iOS — Android gets nothing (no error)
- `@expo/ui/community/*` components (SegmentedControl, DateTimePicker, Slider) are cross-platform
- For iOS-only components, always wrap in `process.env.EXPO_OS === 'ios'` guard with Android fallback
- Follow the established `NativeToggle` pattern at `src/components/ui/native-toggle.tsx`

### React 19 Compatibility
- Avoid render-time side effects when wrapping `@expo/ui` native views
- Use `useEffect` for initialization, not inline conditionals in render body
- Be careful with Zustand `useShallow` selectors — they create new references each render, causing unnecessary re-renders of expensive native views

### Dark Theme
- `@expo/ui/community/segmented-control` supports `appearance` prop ('dark' | 'light')
- `@expo/ui/swift-ui` Picker inherits system appearance automatically inside `<Host>`
- Verify dark mode rendering on both platforms after migration

### Haptic Feedback
- Current FocusPicker fires haptics on selection — replicate in SegmentedControl's onChange
- ActionSheet utility must fire haptics before showing sheet (iOS only)
- Follow pattern: `if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(...)`

## Acceptance Criteria

### Functional
- [ ] FocusPicker replaced with native SegmentedControl — same 3 options, same state management
- [ ] Language picker in profile uses native Picker on iOS, existing Modal on Android
- [ ] Currency picker in profile uses native Picker on iOS, existing Modal on Android
- [ ] All 10 ActionSheetIOS call sites use the new `showActionSheet` utility
- [ ] Dead code removed: `picker-sheet.tsx`, `list-group.tsx`, barrel export updated
- [ ] All colors use `palette.*` hex tokens (no oklch)

### Non-Functional
- [ ] Both iOS and Android render correctly (no blank/invisible components)
- [ ] Dark theme preserved on all migrated components
- [ ] Haptic feedback maintained on iOS
- [ ] No React 19 Strict Mode warnings from new native component wrappers
- [ ] Biome lint passes (`pnpm lint`)
- [ ] TypeScript compiles (`pnpm typecheck`)

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SegmentedControl styling doesn't match editorial theme | Medium | Test appearance prop; can add wrapper with padding/margin adjustments |
| Picker menu positioning issues in scrollable profile screen | Low | Test on multiple screen sizes; fall back to wheel style if menu clips |
| ActionSheet utility misses edge case in one of 10 call sites | Low | Test each call site individually; keep existing behavior as reference |
| @expo/ui component breaks on Android | Medium | All SwiftUI components guarded with `EXPO_OS` check + Android fallback |

## Sources

- **Expo UI docs**: SegmentedControl, Picker, BottomSheet — fetched via Context7
- **Prior learning**: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md` — oklch color gotcha
- **Prior learning**: `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md` — palette vs colors convention
- **Established pattern**: `src/components/ui/native-toggle.tsx` — iOS @expo/ui + Android RN fallback
- **Existing utility**: `src/utils/marker-action-sheet.ts` — ActionSheetIOS consolidation precedent
