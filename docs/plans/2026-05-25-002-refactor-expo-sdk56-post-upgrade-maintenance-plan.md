---
title: "refactor: Expo SDK 56 post-upgrade maintenance and enhancement pass"
type: refactor
status: active
date: 2026-05-25
deepened: 2026-05-25
---

# Expo SDK 56 Post-Upgrade Maintenance & Enhancement Pass

## Enhancement Summary

**Deepened on:** 2026-05-25
**Research agents used:** MMKV migration patterns, Sentry metro config, Expo UI community drop-ins, nativewind/RevenueCat versions, codebase learnings

### Key Improvements from Research
1. **Expo UI community drop-ins confirmed** — `@expo/ui/community/datetime-picker` and `@expo/ui/community/slider` are real, installed, and API-compatible
2. **MMKV migration pattern** — Use `onRehydrateStorage` callback in Zustand persist for one-time migration; migration is synchronous via JSI
3. **nativewind target version** — `5.0.0-preview.4` is latest; peer deps unchanged from preview.2, safe to update
4. **Sentry fix confirmed** — `determineDebugIdFromBundleSource` fixed in 7.4.0; chain order: `withSentryConfig(withNativeWind(config))`

### New Considerations Discovered
- AsyncStorage migration must use `onRehydrateStorage` hook (not a standalone init function) to avoid race with Zustand hydration
- `@expo/ui/community/datetime-picker` is a thin re-export wrapping `@react-native-community/datetimepicker` — same props, zero API migration needed
- The `ios/` directory is fully CNG-managed (`expo prebuild --clean`) — no manual plist edits needed
- Per `docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`: wrap native module removal in try/catch for graceful degradation in older builds

---

## Overview

After upgrading from Expo SDK 54 to 56 (React 19.2, RN 0.85, TS 6), several maintenance and enhancement opportunities remain. This plan consolidates dependency cleanup, Sentry re-enablement, storage unification, Expo UI community drop-in adoption, and config modernization into a single pass.

All items require a new native binary (no OTA-only path). Plan accordingly for the next App Store / Play Store release.

## Problem Statement / Motivation

The SDK 56 upgrade landed the major version bumps, but the codebase still contains:
- 2 unused native dependencies inflating bundle size
- Sentry source maps disabled due to a bug fixed 4 versions ago
- 3 Zustand stores on AsyncStorage while 10+ others already use MMKV
- 7 files using community DateTimePicker/Slider that have Expo UI drop-in replacements
- Stale nativewind preview version
- Duplicate Info.plist entries

These are low-risk, high-hygiene changes that compound into better DX, smaller bundles, and fewer native dependencies.

## Proposed Solution

8 discrete improvements, grouped by risk and dependency:

### Phase 1: Zero-Risk Cleanup (no behavior change)

**1.1 Remove unused `react-native-image-viewing`**
- Zero imports found in `src/` — unmaintained since 2021
- File: `apps/mobile/package.json`

**1.2 Remove unused `react-native-share`**
- All 4 sharing call sites use `expo-sharing` already
- Files: `apps/mobile/package.json`

**1.3 Remove duplicate `NSUserTrackingUsageDescription` from `infoPlist`**
- The `expo-tracking-transparency` plugin already injects this
- The manual entry in `ios.infoPlist` is redundant
- File: `apps/mobile/app.config.ts`
- Note: `ios/` is managed via `expo prebuild --clean` (CNG), so only `app.config.ts` matters

#### Research Insights — Phase 1

**Best Practices:**
- Per `docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`: When removing native modules, any code that previously imported them should have been removed first (verified: zero imports). No try/catch wrappers needed since there are zero call sites.
- After removal, run `npx expo-doctor@latest` to verify no broken native dependencies.

**Edge Cases:**
- If an OTA update ships to an older binary that still has these native modules linked, it's a no-op — the modules just won't be used. No crash risk.

### Phase 2: Sentry Source Maps (build infra)

**2.1 Re-enable `withSentryConfig` in metro.config.js**
- The `determineDebugIdFromBundleSource` crash was fixed in `@sentry/react-native` 7.4.0
- App is on `^7.11.0` — well past the fix
- File: `apps/mobile/metro.config.js`
- Acceptance: Run `npx expo export -p ios --clear` with Sentry enabled to verify no crash

#### Research Insights — Phase 2

**Implementation Detail — correct chain order:**
```js
const { withSentryConfig } = require('@sentry/react-native/metro');
// ... existing config ...
module.exports = withSentryConfig(withNativeWind(config));
```

Sentry must wrap the outermost config (after nativewind) because it hooks into the Metro serializer for debug ID injection. Putting nativewind inside Sentry ensures CSS transforms happen before source map processing.

**Verification Steps:**
1. `npx expo export -p ios --clear` — verifies Sentry serializer doesn't crash during export
2. `npx expo export -p android --clear` — same for Android
3. Check Sentry dashboard for uploaded source maps after next `eas update`

**Edge Cases:**
- The original crash was in the `eas update` export path specifically. The `eas build` path was unaffected. Both paths should be tested.
- If the Sentry DSN env var is empty (local dev), `withSentryConfig` is still safe — it's a no-op without credentials.

### Phase 3: Storage Consolidation (data migration required)

**3.1 Migrate 3 Zustand stores from AsyncStorage to MMKV**

Stores to migrate:
| Store | Zustand name | Persisted fields |
|-------|-------------|-----------------|
| `auth.store.ts` | `auth-preferences` | locale, colorScheme, measurementSystem, currency |
| `whats-new.store.ts` | `whats-new` | lastSeenVersion |
| `learn-onboarding.store.ts` | `learn-onboarding` | dismissed, visitCount, completedLessons |

#### Research Insights — Phase 3

**Migration Pattern (from codebase analysis):**

The existing MMKV stores (e.g. `checklist.store.ts`, `onboarding.store.ts`) use this pattern:

```ts
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'store-name' });

const mmkvStorage = {
  getItem: (name: string) => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkv.set(name, value),
  removeItem: (name: string) => mmkv.delete(name),
};

// In Zustand persist config:
storage: createJSONStorage(() => mmkvStorage),
```

**One-time migration helper:**

Create `src/lib/migrate-async-to-mmkv.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';

const MIGRATION_KEYS = ['auth-preferences', 'whats-new', 'learn-onboarding'] as const;

export async function migrateAsyncStorageToMMKV() {
  for (const key of MIGRATION_KEYS) {
    const mmkv = new MMKV({ id: key });
    // Skip if MMKV already has data (migration already done)
    if (mmkv.getString(key)) continue;

    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        mmkv.set(key, value);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // AsyncStorage may not be available — first install, no data to migrate
    }
  }
}
```

**When to call:** In `_layout.tsx` before the app renders, or in a `useEffect` on mount. Since MMKV is synchronous after migration, the Zustand stores will read from MMKV immediately on next access.

**Critical insight:** The Zustand `persist` middleware stores data under the store `name` key (e.g., `'auth-preferences'`). The MMKV instance `id` is the namespace. So `new MMKV({ id: 'auth-preferences' })` with key `'auth-preferences'` is correct — it matches what Zustand writes.

**After migration**: Remove `@react-native-async-storage/async-storage` from `package.json`. Grep entire `src/` to confirm zero remaining imports.

**Edge Cases:**
- First-time install: AsyncStorage has no data, migration is a no-op
- Re-migration: MMKV already has data from a previous migration, skip
- Corrupted AsyncStorage JSON: `try/catch` handles gracefully, user gets defaults

### Phase 4: Expo UI Community Drop-Ins

**4.1 Replace `@react-native-community/datetimepicker` with `@expo/ui/community/datetime-picker`**

Files (6):
- `src/app/(modals)/add-ride-expense.tsx`
- `src/app/(modals)/create-trip.tsx`
- `src/app/(modals)/create-group-ride.tsx`
- `src/app/(tabs)/(garage)/add-maintenance-task.tsx`
- `src/app/(tabs)/(garage)/record-maintenance.tsx`
- `src/app/(tabs)/(garage)/add-expense.tsx`

#### Research Insights — Phase 4.1

**Confirmed: The community drop-in is a thin re-export.** The `@expo/ui/community/datetime-picker` module wraps `@react-native-community/datetimepicker` with the same props. The import change is:

```ts
// Before
import DateTimePicker from '@react-native-community/datetimepicker';

// After
import DateTimePicker from '@expo/ui/community/datetime-picker';
```

**Props are 100% compatible** — `mode`, `display`, `value`, `onChange`, `minimumDate`, `maximumDate` all work identically. No wrapper component needed.

**Why bother if it's a re-export?** Expo UI community modules are versioned with the SDK. When Expo ships a native DatePicker (SwiftUI/Compose), the `@expo/ui/community/datetime-picker` path will transparently upgrade to the native implementation without code changes. This is future-proofing.

After replacing imports, remove `@react-native-community/datetimepicker` from `package.json` and its plugin entry in `app.config.ts`.

**4.2 Replace `@react-native-community/slider` with `@expo/ui/community/slider`**

File (1): `src/components/onboarding/mileage-slider.tsx`

```ts
// Before
import Slider from '@react-native-community/slider';

// After
import Slider from '@expo/ui/community/slider';
```

Same story — thin re-export with identical props. After replacing, remove `@react-native-community/slider` from `package.json`.

### Phase 5: Dependency Updates

**5.1 Update nativewind to `5.0.0-preview.4`**

#### Research Insights — Phase 5.1
- **Target version:** `5.0.0-preview.4` (latest on npm `preview` dist-tag)
- **Peer deps unchanged** from preview.2: `tailwindcss >4.1.11` and `react-native-css ^3.0.1`
- **Safe to update:** No breaking dependency changes; same runtime dependency (`tailwindcss-safe-area ^1.1.0`)
- **Pin exact:** `"nativewind": "5.0.0-preview.4"` (no caret)
- **Test screens:** Home, Garage, Profile, Onboarding, Ride HUD — these have the most Tailwind usage

**5.2 Update RevenueCat to latest 9.x**

#### Research Insights — Phase 5.2
- **Current:** Both `react-native-purchases` and `react-native-purchases-ui` at `9.12.0`
- **Must stay in lockstep** (same major.minor.patch)
- **Action:** Run `npm view react-native-purchases dist-tags.latest` at implementation time, bump both
- **The `getPurchases()` lazy-import pattern** in `src/lib/subscription.ts` uses `import('react-native-purchases')` — this returns the module, then accesses `.default`. Verify export shape hasn't changed in newer 9.x.

**Testing requirements:**
1. Paywall presentation on iOS and Android
2. Purchase flow (sandbox/TestFlight)
3. Restore purchases
4. Entitlement check after update

## Technical Considerations

### Storage Migration Risk
- `auth-preferences` contains user-visible settings (locale, measurement system) — losing this is a poor UX
- Per `docs/solutions/architecture/currency-preference-full-stack-implementation.md` and `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`: these preferences drive the entire display layer (currency formatting, km vs mi). A reset would be highly visible.
- Migration must run before first render to prevent flash of defaults
- MMKV reads are synchronous (JSI) so the migrated store is immediately available after the async migration completes

### Sentry + EAS Update
- The original crash was specifically during `eas update` exports, not EAS Build
- After re-enabling, verify with `npx expo export -p ios --clear` before merging
- If crash recurs, re-disable and file upstream issue
- Chain order matters: `withSentryConfig(withNativeWind(config))`

### nativewind Preview Stability
- v5 previews are not semver-protected — pin exact version `5.0.0-preview.4`
- If styles break: check `react-native-css` compatibility with RN 0.85
- Current `react-native-css: ^3.0.4` is compatible — peer dep requires `^3.0.1`

### Bundle Size Impact
Removing 2 unused native modules + AsyncStorage should reduce:
- iOS: ~200-400KB framework size
- Android: ~100-200KB AAR size

### Config Plugin Cleanup
After Phase 4, remove from `app.config.ts` plugins array:
- `'@react-native-community/datetimepicker'` — the Expo UI community module handles this
- No plugin entry for `@react-native-community/slider` exists (it doesn't need one)

## System-Wide Impact

- **Native build required**: All 8 items require `expo prebuild --clean` + new binary
- **OTA updates**: Not applicable — all changes involve native code or native module removal
- **Runtime version**: Stays at `appVersion: 3.7.0` policy — new binary will use next app version
- **Interaction graph**: Storage migration runs once on first launch of new binary → Zustand rehydrates from MMKV → all screens read preferences synchronously
- **Error propagation**: Migration failures are caught silently — user gets default preferences (acceptable degradation)

## Acceptance Criteria

### Phase 1 (Cleanup)
- [ ] `react-native-image-viewing` removed from package.json
- [ ] `react-native-share` removed from package.json
- [ ] Duplicate `NSUserTrackingUsageDescription` removed from `infoPlist` in app.config.ts
- [ ] `pnpm install` succeeds with no errors

### Phase 2 (Sentry)
- [ ] `withSentryConfig` uncommented and wrapping metro config
- [ ] `npx expo export -p ios --clear` succeeds without crash
- [ ] `npx expo export -p android --clear` succeeds without crash

### Phase 3 (Storage)
- [ ] Migration helper created in `src/lib/migrate-async-to-mmkv.ts`
- [ ] 3 stores switched from `createJSONStorage(() => AsyncStorage)` to MMKV adapter
- [ ] Migration called in `_layout.tsx` on app startup
- [ ] Existing AsyncStorage data migrates on first launch (verify: set locale to non-default, update, confirm it persists)
- [ ] `@react-native-async-storage/async-storage` removed from package.json
- [ ] All Zustand stores now use MMKV uniformly

### Phase 4 (Expo UI)
- [ ] DateTimePicker import changed in 6 files to `@expo/ui/community/datetime-picker`
- [ ] Slider import changed in 1 file to `@expo/ui/community/slider`
- [ ] `@react-native-community/datetimepicker` removed from package.json
- [ ] `@react-native-community/slider` removed from package.json
- [ ] `'@react-native-community/datetimepicker'` removed from plugins array in app.config.ts
- [ ] Date picker works on both iOS and Android

### Phase 5 (Updates)
- [ ] nativewind pinned to `5.0.0-preview.4` — styles render correctly on 5 key screens
- [ ] RevenueCat updated to latest 9.x — paywall displays, purchase + restore works on both platforms

### Quality Gates
- [ ] TypeScript passes (`tsc --noEmit`)
- [ ] expo-doctor 21/21 checks pass
- [ ] iOS simulator build succeeds
- [ ] Android build succeeds (or at minimum, `expo prebuild` for Android succeeds)
- [ ] Jest tests pass

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AsyncStorage migration loses data | Low | High | One-time migration reads old key before deleting; try/catch on errors |
| nativewind preview breaks styles | Low | Medium | Pin exact `5.0.0-preview.4`; test 5 key screens; revert if needed |
| Expo UI DateTimePicker API differs | None | None | Confirmed: thin re-export with identical props |
| Sentry crash returns on `eas update` | Low | Medium | Test both iOS + Android export before merging; re-disable if needed |
| RevenueCat breaks IAP flow | Low | High | Test paywall + restore on both platforms; keep old version as fallback |

## Implementation Order

```
Phase 1 (Cleanup)     ─┐
Phase 2 (Sentry)      ─┤── Can be done in parallel
Phase 4 (Expo UI)     ─┤
Phase 5.1 (nativewind)─┘
Phase 3 (Storage)      ── Do after Phase 1 (depends on AsyncStorage removal verification)
Phase 5.2 (RevenueCat) ── Do last (highest IAP risk, needs manual testing)
```

## Sources & References

- Expo SDK 56 changelog: https://expo.dev/changelog/sdk-56
- Sentry RN 7.4.0 fix: determineDebugIdFromBundleSource crash resolved
- Expo UI community replacements: https://docs.expo.dev/versions/v56.0.0/sdk/ui
- Existing learnings: `docs/solutions/build-errors/metro-workspace-zod-resolution.md`
- Existing learnings: `docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`
- Existing learnings: `docs/solutions/architecture/currency-preference-full-stack-implementation.md`
- Existing learnings: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
