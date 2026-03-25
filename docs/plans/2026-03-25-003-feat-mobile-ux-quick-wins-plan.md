---
title: "feat: Mobile UX Quick Wins — 10 High-Impact Low-Effort Improvements"
type: feat
status: active
date: 2026-03-25
deepened: 2026-03-25
---

# Mobile UX Quick Wins — 10 High-Impact Low-Effort Improvements

## Enhancement Summary

**Deepened on:** 2026-03-25
**Research agents used:** 7 (framework-docs, best-practices, architecture-strategist, performance-oracle, races-reviewer, security-sentinel, code-simplicity-reviewer)

### Key Improvements from Deepening
1. **Error Boundary corrected**: Use Expo Router's named `ErrorBoundary` function export (NOT class component) — simpler, idiomatic
2. **Quick Actions simplified**: Use `useQuickActionRouting()` from `expo-quick-actions/router` — handles all navigation automatically, no custom ref needed
3. **Store review race condition fixed**: Drop `setTimeout(800)` — `await requestReview()` before navigation instead
4. **Review counters moved to MMKV**: Out of auth store into self-contained MMKV keys — cleaner separation, no Zustand pollution
5. **Haptic consolidation simplified**: Keep existing `triggerImpact()`/`triggerNotification()` from utils/haptics.ts — delete lib/haptics.ts instead. 2 functions > 6 wrappers
6. **Skeleton uses shared animation value**: Single `useSharedValue` per screen via provider pattern — 1 animation driver instead of 10+
7. **Diagnostic PDF merged into existing files**: Add to `pdf-template.ts` + `pdf-export.ts` — 0 new files instead of 2
8. **New files reduced from 5 to 2**: `error-boundary.tsx` for Sentry wrapper + `store-review.ts` for MMKV-based review logic
9. **KeyboardAwareScrollView formSheet bug identified**: Known flickering (GitHub #726) — must skip formSheet modals
10. **Security hardening added**: UUID validation on deep link params, VIN excluded from diagnostic PDF, route allowlist

### Critical Issues Caught
- **GPS data loss during error boundary remount** — ride recording could lose waypoints during tab-level boundary reset
- **Review counters not persisted** — auth store `partialize` excludes new fields; counters would reset every restart
- **Cold-start notification deep link never consumed** — no code reads the pending ref after NavigationGate resolves
- **Notification deep link needs `useLastNotificationResponse()`** — listener alone misses cold-start responses

---

## Overview

Ten targeted UX improvements for the MotoVault mobile app that collectively elevate perceived quality, crash resilience, and user engagement with minimal implementation risk. Each item builds on established patterns already in the codebase. Total estimated effort: ~14 hours.

## Problem Statement

The app's core features are 100% implemented across 56 screens, but several polish-layer gaps remain that affect perceived quality and App Store competitiveness:
- No crash recovery (zero error boundaries)
- No App Store review prompts despite multiple "happy moments"
- Inconsistent loading states (ActivityIndicator vs. skeleton)
- Notification taps don't navigate to relevant content
- Forms missing keyboard avoidance on 6+ screens
- No home screen quick actions for power users

## Proposed Solution

Implement in two PRs, organized by dependency order:
- **PR 1 (Phases 1-3):** Error boundaries, keyboard, pull-to-refresh, skeletons, haptics, review prompts, empty state (~18 files, low-risk polish)
- **PR 2 (Phase 4):** Notification deep links, quick actions, diagnostic share (~8 files, platform integration)

---

## Implementation Plan

### Phase 1: Foundation (Error Boundary + Keyboard Fix)

These changes affect layout files and must land first to avoid merge conflicts.

#### 1. Error Boundary

**Two layers of error boundaries:**

**Layer 1: `Sentry.ErrorBoundary` in `(tabs)/_layout.tsx`**

Wrap the `<Tabs>` component with Sentry's error boundary for automatic crash reporting:

```tsx
// In (tabs)/_layout.tsx, wrap the Tabs component:
import * as Sentry from '@sentry/react-native';

<Sentry.ErrorBoundary
  fallback={({ error, resetError }) => (
    <ErrorFallback error={error} onRetry={resetError} />
  )}
  beforeCapture={(scope) => scope.setTag('boundary', 'tabs')}
>
  <Tabs>{/* ... */}</Tabs>
</Sentry.ErrorBoundary>
```

**Layer 2: Expo Router `ErrorBoundary` exports per tab layout**

Export a named `ErrorBoundary` function from each tab layout. This is NOT a class component — Expo Router provides `ErrorBoundaryProps` with `{ error, retry }`:

```tsx
// In each tab _layout.tsx:
import { type ErrorBoundaryProps } from 'expo-router';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // retry() re-renders the route in place (no navigation change)
  return <ErrorFallback error={error} onRetry={retry} />;
}
```

**New file: `src/components/error-fallback.tsx`** — shared UI component (functional, not class):
- AlertTriangle icon from lucide-react-native
- Error message text
- "Try Again" Pressable button
- All palette tokens, `borderCurve: 'continuous'`
- i18n via `useTranslation()`
- Keep it SIMPLE — avoid complex styling that could throw inside the boundary ([Expo Issue #24242](https://github.com/expo/expo/issues/24242))

**Add ErrorBoundary exports to:**
- `apps/mobile/src/app/(tabs)/(home)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/(learn)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/(diagnose)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/(profile)/_layout.tsx`
- `apps/mobile/src/app/(onboarding)/_layout.tsx` *(added per architecture review — crash during onboarding leaves user stuck)*

**Edge case — active ride recording**: The ride store persists to MMKV, so state survives remount. However, **GPS subscription is torn down during remount** via the module-level `locationSubscription` in `ride-location.ts`. There is a data gap between teardown and re-establishment.

**Mitigation**: In the ErrorBoundary retry handler, check `useRideStore.getState().status`. If `status === 'recording'`, show a toast error instead of full remount. Or better: move the GPS subscription listener registration to the root layout (outside any tab-level error boundary) so it survives boundary resets.

#### 2. KeyboardAwareScrollView on Forms

**Confirmed**: `react-native-keyboard-controller@1.20.7` exports `KeyboardAwareScrollView`. `KeyboardProvider` already wraps root at `_layout.tsx:288`.

**CRITICAL: Do NOT use inside formSheet modals** — [known flickering bug (GitHub #726)](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/726). iOS formSheet natively adjusts for keyboard. Skip these files: `add-bike.tsx`, `add-expense.tsx`, `add-ride-expense.tsx`.

**Full-screen forms to update:**

| File | Change |
|------|--------|
| `(garage)/add-maintenance-task.tsx` | Replace `ScrollView` with `KeyboardAwareScrollView` |
| `(garage)/edit-bike.tsx` | Replace `ScrollView` with `KeyboardAwareScrollView` |
| `(profile)/settings.tsx` | Replace `ScrollView` with `KeyboardAwareScrollView` |
| `diagnostic-flow/step-problem-description.tsx` | Replace `ScrollView` with `KeyboardAwareScrollView` |

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// Replace ScrollView with:
<KeyboardAwareScrollView
  bottomOffset={20}
  contentContainerStyle={{ paddingBottom: 100 }}
>
  {/* form content */}
</KeyboardAwareScrollView>
```

**Do NOT mix with RN's `KeyboardAvoidingView`** — causes double-offset. Remove any existing `KeyboardAvoidingView` wrappers on these screens.

---

### Phase 2: Data & Loading (Pull-to-Refresh + Skeletons)

#### 3. Pull-to-Refresh on Missing Screens

Add `RefreshControl` using the established pattern:

```tsx
<RefreshControl
  refreshing={isRefreshing}
  onRefresh={onRefresh}
  tintColor={isDark ? palette.white : palette.primary500}
/>
```

| Screen | File | Query Keys to Invalidate |
|--------|------|--------------------------|
| Learn tab | `(learn)/index.tsx` | `popular`, `progress`, `motorcycles` (skip `search` unless active) |
| Diagnose tab | `(diagnose)/index.tsx` | `diagnostics`, `motorcycles` |
| Expense dashboard | `(garage)/expense-dashboard.tsx` | `expenses`, `motorcycles` |
| Bike detail | `(garage)/bike/[id].tsx` | `motorcycle`, `maintenanceTasks`, `expenses` |

**Use `refetchType: 'active'`** to only refetch queries mounted in visible components:

```tsx
await queryClient.invalidateQueries({ queryKey: queryKeys.expenses, refetchType: 'active' });
```

**Guard against rapid pulls** with a ref:

```tsx
const isRefreshingRef = useRef(false);
const onRefresh = useCallback(async () => {
  if (isRefreshingRef.current) return;
  isRefreshingRef.current = true;
  setIsRefreshing(true);
  try {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses, refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all, refetchType: 'active' }),
    ]);
  } finally {
    isRefreshingRef.current = false;
    setIsRefreshing(false);
  }
}, []);
```

**Do NOT add haptics to pull-to-refresh** — iOS RefreshControl already provides built-in haptic feedback. Adding `hapticLight()` creates a "double buzz" that feels cheap. (Confirmed by races reviewer — test on physical device.)

#### 4. Skeleton Loading States

**Use a shared animation value via SkeletonProvider** — one animation driver per screen instead of 10+:

```tsx
// src/components/skeleton/skeleton-provider.tsx
const SkeletonContext = createContext<SharedValue<number> | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
    return () => cancelAnimation(progress);
  }, [progress]);
  return <SkeletonContext.Provider value={progress}>{children}</SkeletonContext.Provider>;
}
```

```tsx
// src/components/skeleton/skeleton.tsx
export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const progress = useContext(SkeletonContext);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress!.value, [0, 1], [0.4, 1]),
  }));
  return (
    <Animated.View style={[{
      width, height, borderRadius, borderCurve: 'continuous',
      backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
    }, animatedStyle, style]} />
  );
}
```

**Create layout-matched skeleton variants** (skeletons should mirror actual content proportions):

| Screen | Skeleton Layout | Replaces |
|--------|----------------|----------|
| Home (`(home)/index.tsx`) | Greeting bar + 3 card placeholders stacked | `ActivityIndicator` at line 56 |
| Garage (`(garage)/index.tsx`) | 2-3 bike card shapes | `ActivityIndicator` at line 312 |
| Learn (`(learn)/index.tsx`) | Hero card + 3 article rows | No loading state currently |

**Transition**: Each widget fades in independently with `FadeIn.duration(300)` as its query resolves. Stagger skeleton entrance with `FadeInUp.delay(i * 50)`.

**Learnings applied:**
- Keep `useDerivedValue` pure — no side effects (`docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`)
- Use `cancelAnimation()` in cleanup to avoid leaks

---

### Phase 3: Engagement (Haptics + Review + Empty State)

#### 5. Haptic Feedback Consolidation & Expansion

**Simplified approach**: Keep the existing `triggerImpact(style)` and `triggerNotification(type)` from `src/utils/haptics.ts` — these 2 parameterized functions cover all use cases. Delete `src/lib/haptics.ts` (which only has a one-liner `haptic()` function). Update its ~7 call sites to use `triggerImpact(ImpactFeedbackStyle.Light)`.

**No new wrapper functions needed** — callers pass the enum value directly. The existing functions already gate on `process.env.EXPO_OS === 'ios'`.

**Add haptics to these interactions:**

| Interaction | Call | File |
|------------|------|------|
| Complete maintenance task | `triggerNotification(NotificationFeedbackType.Success)` | `bike-tasks.tsx` mutation `onSuccess` |
| Delete item (bike/task/expense) | `triggerNotification(NotificationFeedbackType.Warning)` | Various delete mutation `onSuccess` |
| Ride save | `triggerNotification(NotificationFeedbackType.Success)` | `ride-summary.tsx` `handleSave` |

**Removed from plan**: Pull-to-refresh haptic (iOS already provides it), tab switch haptic (already implemented in IslandTabBar).

**Learnings**: Haptics must live in UI component press handlers, never in Zustand store actions (double-fire risk — `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`).

#### 6. App Store Review Prompt

**Install**: `npx expo install expo-store-review`

**Use MMKV for counters** (not Zustand auth store — keeps auth store clean, avoids `partialize` issues, no unnecessary re-renders):

```tsx
// src/lib/store-review.ts
import * as StoreReview from 'expo-store-review';
import { storage } from './mmkv'; // existing MMKV instance

const RIDE_COUNT_KEY = 'review:rideCount';
const TASK_COUNT_KEY = 'review:taskCount';
const REVIEWED_VERSION_KEY = 'review:version';

export function incrementRideCount(): number {
  const count = (storage.getNumber(RIDE_COUNT_KEY) ?? 0) + 1;
  storage.set(RIDE_COUNT_KEY, count);
  return count;
}

export function incrementTaskCount(): number {
  const count = (storage.getNumber(TASK_COUNT_KEY) ?? 0) + 1;
  storage.set(TASK_COUNT_KEY, count);
  return count;
}

export async function maybeRequestReview(): Promise<void> {
  const currentVersion = require('../../app.json').expo.version;
  if (storage.getString(REVIEWED_VERSION_KEY) === currentVersion) return;

  const rides = storage.getNumber(RIDE_COUNT_KEY) ?? 0;
  const tasks = storage.getNumber(TASK_COUNT_KEY) ?? 0;
  if (rides < 3 && tasks < 5) return;

  if (!(await StoreReview.hasAction())) return;

  // CRITICAL: await the review — do NOT use setTimeout
  // requestReview() returns after dialog is presented or suppressed
  await StoreReview.requestReview();
  storage.set(REVIEWED_VERSION_KEY, currentVersion);
}
```

**Call sites** — `await` the review BEFORE navigating away:

```tsx
// ride-summary.tsx handleSave:
incrementRideCount();
await maybeRequestReview(); // blocks until dialog dismissed/suppressed
router.replace('/(tabs)/(profile)');

// bike-tasks.tsx completeTask onSuccess:
incrementTaskCount();
await maybeRequestReview();
```

**Key behaviors:**
- Apple throttles to 3 prompts per 365 days at OS level — `requestReview()` silently no-ops when throttled
- Tracks per app version (allows re-prompting after major updates)
- No `setTimeout` — awaiting prevents the navigation race condition
- MMKV reads are synchronous — no async overhead on counter checks
- Never call from a button (Apple rejects this)

#### 7. Rich Empty State on Rides Tab

**File**: `apps/mobile/src/app/(tabs)/(profile)/rides.tsx` (lines 346-387)

Replace plain text with:
- `LottieMotorcycle` animation (use existing `emptyGarage` or `cardPlaceholder`)
- Title: "No rides yet" (already i18n'd)
- Subtitle: "Track your first ride to see stats, routes, and expenses"
- CTA button: Conditional on motorcycle count
  - Has bikes: "Start a Ride" -> `router.push('/(modals)/start-ride')`
  - No bikes: "Add Your First Bike" -> `router.push('/(tabs)/(garage)/add-bike')`
- Simple `FadeIn` on the entire container (not per-element stagger — only 3 elements)
- Match design pattern from `src/components/home/empty-state.tsx`

---

### Phase 4: Platform Integration (Notifications + Quick Actions + Share)

*Separate PR from Phases 1-3.*

#### 8. Notification Deep Links

**Create `src/hooks/use-notification-deep-link.ts`** — handles both cold start and warm start:

```tsx
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ROUTES = [
  '/(tabs)/(garage)/bike/',
] as const;

function extractRoute(data: Record<string, unknown> | undefined): string | null {
  if (!data?.motorcycleId) return null;
  const id = String(data.motorcycleId);
  if (!UUID_RE.test(id)) return null; // Security: validate UUID format
  return `/(tabs)/(garage)/bike/${id}`;
}

export function useNotificationDeepLink() {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pendingRoute = useRef<string | null>(null);
  const isReady = !isLoading && !!session && segments[0] === '(tabs)';

  // Cold start: useLastNotificationResponse hook (re-renders when response available)
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = extractRoute(lastResponse.notification.request.content.data as any);
    if (!route) return;

    if (isReady) {
      router.push(route as any);
      Notifications.clearLastNotificationResponse();
    } else {
      pendingRoute.current = route;
    }
  }, [lastResponse, isReady, router]);

  // Flush queued route when navigation becomes ready
  useEffect(() => {
    if (isReady && pendingRoute.current) {
      const route = pendingRoute.current;
      pendingRoute.current = null;
      router.push(route as any);
    }
  }, [isReady, router]);

  // Warm start: listener for taps while app is backgrounded
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const route = extractRoute(response.notification.request.content.data as any);
      if (!route) return;
      if (isReady) router.push(route as any);
      else pendingRoute.current = route;
    });
    return () => sub.remove();
  }, [isReady, router]);
}
```

**Integration**: Call `useNotificationDeepLink()` in `RootLayout` component body.

#### 9. Quick Actions (Home Screen Shortcuts)

**Install**: `npx expo install expo-quick-actions`

**Use the built-in Expo Router integration** — no custom deep link handling needed:

```tsx
// In root _layout.tsx:
import { useQuickActionRouting } from 'expo-quick-actions/router';
import * as QuickActions from 'expo-quick-actions';

export default function RootLayout() {
  useQuickActionRouting(); // Handles all navigation automatically via params.href

  useEffect(() => {
    QuickActions.setItems([
      {
        id: 'start-ride',
        title: 'Start Ride',
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:location.fill' : undefined,
        params: { href: '/(modals)/start-ride' },
      },
      {
        id: 'new-diagnostic',
        title: 'Diagnose Issue',
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:wrench.and.screwdriver.fill' : undefined,
        params: { href: '/(tabs)/(diagnose)/new' },
      },
      {
        id: 'add-expense',
        title: 'Add Expense',
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:dollarsign.circle.fill' : undefined,
        params: { href: '/(tabs)/(garage)' },
      },
    ]);
  }, []);

  // ... rest of layout
}
```

**`useQuickActionRouting()`** reads `params.href` and calls `router.push()` automatically for both cold start (`QuickActions.initial`) and warm start (listener). No `pendingDeepLinkRef` needed.

**Auth concern**: If session is expired on cold start, NavigationGate redirects to login. The quick action route is lost — this is acceptable. The user taps the quick action again after logging in. No replay queue needed (YAGNI).

**Max 4 items** recommended by Apple/Google. Currently 3 — room for 1 more later.

#### 10. Share Diagnostic Report

**Add to existing files** (no new files):

**In `src/lib/pdf-template.ts`**: Add `generateDiagnosticReportHTML()` alongside existing `generateMaintenanceHistoryHTML()`. Reuse the shared CSS, `escapeHtml()`, `formatDate()`, and MotoVault branding.

Content to include:
- Severity badge with color coding
- Confidence score
- Issues list with descriptions and probability
- Tools needed
- Next steps
- Difficulty rating
- Disclaimer: "This report is for informational purposes only"

**Exclude**: User photos (privacy), bike photos, **VIN** (PII — can be linked to owner via DMV records)

**In `src/lib/pdf-export.ts`**: Add `exportDiagnosticReport()` alongside existing `exportMaintenanceHistory()`:

```tsx
export async function exportDiagnosticReport(diagnostic: DiagnosticResult, bikeName: string) {
  const html = generateDiagnosticReportHTML(diagnostic, bikeName);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
}
```

**Add share button to `(diagnose)/[id].tsx`**:
- Header right: `Share2` icon from lucide-react-native
- Only visible when `diagnostic.status === 'completed'`
- `triggerImpact(ImpactFeedbackStyle.Light)` before share
- Wrap in try/catch (user may cancel share sheet)
- Use existing `escapeHtml()` for all dynamic content in the template

---

## System-Wide Impact

### Interaction Graph

- Error Boundary catches -> Sentry.captureException -> retry re-renders route -> TanStack Query refetches
- Pull-to-Refresh -> `queryClient.invalidateQueries(refetchType: 'active')` -> refetch -> skeleton -> content fade-in
- Notification tap -> `useLastNotificationResponse()` + listener -> UUID validation -> `router.push()`
- Quick Action -> `useQuickActionRouting()` reads `params.href` -> `router.push()` (built-in)
- Review prompt -> MMKV counter increment -> threshold check -> `await StoreReview.requestReview()` -> navigation

### State Lifecycle Risks

- **Review counters**: Persisted in MMKV (synchronous, fast). No server sync. Tracks per app version.
- **Error boundary remount**: Zustand stores persist (AsyncStorage/MMKV). TanStack Query cache survives. Only in-memory UI state lost.
- **Ride recording during error boundary**: MMKV persists waypoint buffer. **GPS subscription has a gap during remount** — mitigate by checking ride status before full remount, or move GPS listener to root layout.
- **Notification deep link on cold start**: `useLastNotificationResponse()` hook handles the race — re-renders when response becomes available after initial mount.

### API Surface Parity

No new GraphQL operations needed. All changes are client-side only.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Sentry.ErrorBoundary wraps tabs layout for crash reporting
- [ ] Expo Router ErrorBoundary exports on all 5 tab stacks + onboarding
- [ ] Error boundary checks ride recording status before remount
- [ ] Pull-to-refresh works on Learn, Diagnose, Expense Dashboard, Bike Detail
- [ ] Pull-to-refresh uses `refetchType: 'active'` and `Promise.allSettled`
- [ ] Skeleton shimmer uses shared animation value (SkeletonProvider)
- [ ] Home, Garage, Learn show layout-matched skeleton states
- [ ] Haptics consolidated: `lib/haptics.ts` deleted, all call sites use `utils/haptics.ts`
- [ ] Haptics fire on task completion and item deletion (iOS only)
- [ ] App Store review prompts after 3rd ride OR 5th task completion
- [ ] Review counters stored in MMKV, tracked per app version
- [ ] Review prompt awaited before navigation (no setTimeout)
- [ ] Tapping notification navigates to bike detail with UUID validation
- [ ] Cold-start notifications handled via `useLastNotificationResponse()`
- [ ] Quick actions use `useQuickActionRouting()` from expo-quick-actions/router
- [ ] Quick actions appear on iOS home screen long-press (max 3 items)
- [ ] Diagnostic share generates PDF via existing pdf-template.ts/pdf-export.ts
- [ ] Diagnostic PDF excludes VIN, photos, and user PII
- [ ] Share button hidden on processing/failed diagnostics
- [ ] KeyboardAwareScrollView on full-screen forms only (NOT formSheet modals)
- [ ] Rides empty state shows Lottie + conditional CTA
- [ ] All new UI uses palette tokens (no hardcoded colors)
- [ ] All new strings use i18n via useTranslation()

### Non-Functional Requirements

- [ ] No new packages beyond `expo-store-review` and `expo-quick-actions`
- [ ] Skeleton animations run at 60fps (single shared animation driver per screen)
- [ ] Error boundary does not tear down GPS during active ride
- [ ] All haptics gated by `process.env.EXPO_OS === 'ios'`
- [ ] Deep link route params validated as UUID before navigation
- [ ] ErrorBoundary fallback UI is simple (avoids NativeWind complexity — Issue #24242)

---

## Dependencies & Prerequisites

| Dependency | Status | Blocker For |
|-----------|--------|-------------|
| `expo-store-review` | Not installed | Feature 6 (Review) |
| `expo-quick-actions` | Not installed | Feature 9 (Quick Actions) |
| `react-native-keyboard-controller` | Installed (v1.20.7) | Feature 2 (Keyboard) |
| `expo-print` + `expo-sharing` | Installed | Feature 10 (Share) |
| `@sentry/react-native` | Installed | Feature 1 (Error Boundary) |

**Implicit dependency**: Feature 5 (haptic consolidation) must complete before Features 8-10 introduce new haptic call sites.

---

## File Change Summary

### New Files (2)
- `src/components/error-fallback.tsx` — Shared error UI (AlertTriangle, retry button, palette tokens)
- `src/lib/store-review.ts` — MMKV-based review counters + `maybeRequestReview()`

### New Directory (skeleton provider)
- `src/components/skeleton/skeleton-provider.tsx` — Shared animated value context
- `src/components/skeleton/skeleton.tsx` — Reusable shimmer primitive

### New Hook
- `src/hooks/use-notification-deep-link.ts` — Cold/warm start notification navigation

### Modified Files (~22)
- `src/utils/haptics.ts` — Becomes the single haptic file (no changes needed — already complete)
- `src/lib/pdf-template.ts` — Add `generateDiagnosticReportHTML()`
- `src/lib/pdf-export.ts` — Add `exportDiagnosticReport()`
- `src/app/_layout.tsx` — `useNotificationDeepLink()`, `useQuickActionRouting()`, `QuickActions.setItems()`
- `src/app/(tabs)/_layout.tsx` — Sentry.ErrorBoundary wrapper
- `src/app/(tabs)/(home)/_layout.tsx` — ErrorBoundary export
- `src/app/(tabs)/(garage)/_layout.tsx` — ErrorBoundary export
- `src/app/(tabs)/(learn)/_layout.tsx` — ErrorBoundary export
- `src/app/(tabs)/(diagnose)/_layout.tsx` — ErrorBoundary export
- `src/app/(tabs)/(profile)/_layout.tsx` — ErrorBoundary export
- `src/app/(onboarding)/_layout.tsx` — ErrorBoundary export
- `src/app/(tabs)/(learn)/index.tsx` — Pull-to-refresh + skeleton
- `src/app/(tabs)/(diagnose)/index.tsx` — Pull-to-refresh
- `src/app/(tabs)/(diagnose)/[id].tsx` — Share button
- `src/app/(tabs)/(garage)/expense-dashboard.tsx` — Pull-to-refresh
- `src/app/(tabs)/(garage)/bike/[id].tsx` — Pull-to-refresh
- `src/app/(tabs)/(garage)/index.tsx` — Skeleton loading
- `src/app/(tabs)/(home)/index.tsx` — Skeleton loading
- `src/app/(tabs)/(profile)/rides.tsx` — Rich empty state
- `src/app/(tabs)/(garage)/add-maintenance-task.tsx` — KeyboardAwareScrollView
- `src/app/(tabs)/(garage)/edit-bike.tsx` — KeyboardAwareScrollView
- `src/app/(tabs)/(profile)/settings.tsx` — KeyboardAwareScrollView
- `src/components/diagnostic-flow/step-problem-description.tsx` — KeyboardAwareScrollView
- `src/app/(modals)/ride-summary.tsx` — Review prompt trigger
- `src/app/(tabs)/(garage)/bike-tasks.tsx` — Review prompt trigger + haptics

### Deleted Files (1)
- `src/lib/haptics.ts` — Consolidated into `src/utils/haptics.ts`

### Files with haptic import migration (~7)
- All files importing `haptic` from `../../lib/haptics` — update to `triggerImpact` from `../../utils/haptics`

---

## Sources & References

### Internal References
- Inline error UI pattern: `apps/mobile/src/app/(tabs)/(home)/index.tsx:63-81`
- RefreshControl pattern: `apps/mobile/src/app/(tabs)/(home)/index.tsx:89-95`
- Shimmer animation: `apps/mobile/src/app/(onboarding)/insights.tsx:43-101`
- Empty state component: `apps/mobile/src/components/home/empty-state.tsx`
- Haptics (utils — keeping): `apps/mobile/src/utils/haptics.ts`
- Haptics (lib — deleting): `apps/mobile/src/lib/haptics.ts`
- Notification handler: `apps/mobile/src/app/_layout.tsx:241-283`
- PDF export: `apps/mobile/src/lib/pdf-export.ts`
- PDF template: `apps/mobile/src/lib/pdf-template.ts`
- Quick actions grid: `apps/mobile/src/components/home/quick-actions-grid.tsx`
- Ride location subscription: `apps/mobile/src/utils/ride-location.ts:49`

### Institutional Learnings Applied
- Haptics single-ownership rule: `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`
- Reanimated pure derivations: `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`
- Zustand + useShallow loops: `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`
- Polling timeout cutoff: `docs/solutions/ui-bugs/stuck-processing-diagnostics-infinite-spinner.md`
- Color system (palette.ts): `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md`

### External References
- [Expo Router Error Handling](https://docs.expo.dev/router/error-handling/)
- [Expo Router ErrorBoundary infinite loop (Issue #24242)](https://github.com/expo/expo/issues/24242)
- [Sentry React Native Error Boundary](https://docs.sentry.io/platforms/react-native/integrations/error-boundary/)
- [expo-quick-actions + Expo Router integration](https://github.com/EvanBacon/expo-quick-actions)
- [expo-quick-actions `useQuickActionRouting()`](https://expo.dev/blog/expo-quick-actions)
- [KeyboardAwareScrollView formSheet flickering (Issue #726)](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/726)
- [Apple SKStoreReviewController guidelines](https://developer.apple.com/documentation/storekit/skstorereviewcontroller)
- [Expo StoreReview docs](https://docs.expo.dev/versions/latest/sdk/storereview/)
- [Expo Notifications: useLastNotificationResponse](https://docs.expo.dev/versions/latest/sdk/notifications/#uselastnotificationresponse)
- [Callstack: Performant Shimmer Effects in React Native](https://www.callstack.com/blog/performant-and-cross-platform-shimmers-in-react-native-apps)
