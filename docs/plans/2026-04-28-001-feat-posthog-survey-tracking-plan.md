---
title: "feat: PostHog CSAT survey after key actions"
type: feat
status: completed
date: 2026-04-28
deepened: 2026-04-28
---

# feat: PostHog CSAT survey after key actions

## Enhancement Summary

**Deepened on:** 2026-04-28
**Review agents used:** TypeScript reviewer, frontend race conditions, performance oracle, architecture strategist, security sentinel, code simplicity reviewer, pattern recognition specialist

### Key Improvements
1. Simplified from 11-member store to ~5-member store (dropped YAGNI: action counting, dynamic survey fetch, custom analytics events)
2. Atomic `tryShow()` method prevents double-show race condition
3. Centralized trigger via `maybeTriggerSurvey()` in analytics.ts — feature screens don't know the survey exists
4. Fixed 2 blockers: nonexistent `@/lib/mmkv` import and phantom `store_review_last_shown` key

### Simplifications Applied
- Dropped `actionCounts` / first-action skip (get data first, filter quality later)
- Dropped `surveyQuestions` from state (hardcode known 2-question survey)
- Dropped 3 custom `AnalyticsEvent` entries (PostHog `survey sent`/`survey dismissed` already track everything)
- Dropped store review mutex (no timestamp exists to check; speculative)
- Dropped `fetchActiveSurvey()` dynamic fetch (hardcode known survey ID; add feature flag kill-switch if needed)

---

## Overview

Wire up the existing PostHog "Key action feedback" API survey to show a custom CSAT modal after four key mobile actions: `expense_added`, `maintenance_task_created`, `trip_created`, and `diagnostic_completed`. The survey has two questions: a 1-5 star rating and an optional open-text follow-up.

## Problem Statement / Motivation

We have no structured in-app feedback mechanism beyond the native App Store review prompt. The PostHog survey was already created server-side but has zero submissions because the mobile app has no integration. This feature closes the loop — capturing actionable CSAT data at the moments users complete core workflows.

## Proposed Solution

### Architecture: Global Overlay (not route-based modal)

**Critical insight from SpecFlow analysis**: Three of four trigger sites navigate away immediately in `onSuccess` (`router.back()` or `router.replace()`). A route-based modal (Expo Router) would be destroyed by this navigation. Instead, use a **global overlay component** rendered at the root `_layout.tsx` level, triggered via Zustand state, so it persists across any navigation.

```
_layout.tsx
  GestureHandlerRootView
    PostHogProvider
      AnimatedSplash
        KeyboardProvider
          PersistedQueryClientBoundary
            NavigationGate
              Stack
            SurveyOverlay  ← after Stack, inside NavigationGate (has auth context)
```

> **Note**: This is architecturally different from the what's-new modal (which uses route-based navigation). The what's-new modal can be route-based because it triggers from NavigationGate with a delay, not from an `onSuccess` callback that navigates away. The survey overlay must survive arbitrary navigation.

### Rate Limiting Strategy (simplified)

- **Per-action-type**: Once per action type per 7 days (MMKV-persisted timestamps)
- **Global session cooldown**: Max one survey per app foreground session (in-memory boolean)
- **Analytics opt-out**: Respect `analyticsEnabled` — no survey if PostHog is opted out

> **Dropped from original plan**: First-action skip (YAGNI — get volume first), store review mutex (no timestamp data exists), action counting.

### MMKV for Rate Limits

Use MMKV with individual keys per action type (synchronous reads, no hydration needed). Follow the `store-review.ts` pattern with a dedicated MMKV instance.

> **Research insight**: Using individual MMKV keys (`survey:lastShown:expense_added` → number) instead of a JSON blob eliminates all JSON.parse/stringify overhead and needs no `hydrate()` call. MMKV `getNumber()` is synchronous and O(1) in MMKV's B+ tree.

## Technical Approach

### Phase 1: Survey Store + Rate Limiting

**New file: `apps/mobile/src/stores/survey.store.ts`**

```typescript
import { create } from 'zustand'
import { createMMKV } from '@/lib/mmkv-factory' // or inline: new MMKV({ id: 'survey' })

// Dedicated MMKV instance (follows store-review.ts pattern)
const surveyStorage = createMMKV({ id: 'survey' })

// Known survey ID from PostHog dashboard
const SURVEY_ID = '<posthog-survey-uuid>'

const SURVEY_TRIGGER_ACTIONS = [
  'expense_added',
  'maintenance_task_created',
  'trip_created',
  'diagnostic_completed',
] as const

type SurveyTriggerAction = (typeof SURVEY_TRIGGER_ACTIONS)[number]

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface SurveyState {
  visible: boolean
  triggerAction: SurveyTriggerAction | null
  shownThisSession: boolean

  // Atomic check-and-show: prevents double-show race condition
  tryShow: (actionType: SurveyTriggerAction) => boolean
  dismiss: () => void
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  visible: false,
  triggerAction: null,
  shownThisSession: false,

  tryShow: (actionType) => {
    const state = get()
    // Guard: already shown this session
    if (state.shownThisSession) return false
    // Guard: analytics opted out
    if (!isAnalyticsEnabled()) return false
    // Guard: per-action-type cooldown (read MMKV directly — synchronous)
    const lastShown = surveyStorage.getNumber(`survey:lastShown:${actionType}`) ?? 0
    if (lastShown > Date.now()) return false // clock manipulation guard
    if (Date.now() - lastShown < COOLDOWN_MS) return false

    // Atomically mark as shown + set visibility in one set() call
    set({
      shownThisSession: true,
      triggerAction: actionType,
    })
    // Persist timestamp to MMKV
    surveyStorage.set(`survey:lastShown:${actionType}`, Date.now())
    // Delay visual appearance to avoid colliding with navigation animations
    // (~400ms matches Expo Router's default push/pop transition duration)
    setTimeout(() => {
      if (!get().visible) {
        set({ visible: true })
      }
    }, 400)
    return true
  },

  dismiss: () => {
    set({ visible: false, triggerAction: null })
  },
}))

export { SURVEY_ID, type SurveyTriggerAction }
```

> **Race condition fix (from review)**: `tryShow()` is a single atomic method that checks eligibility AND sets `shownThisSession: true` in one `set()` call. This prevents double-show when rapid actions fire before the 400ms delay resolves. The visibility delay is separate from the guard — the guard fires synchronously, the visual appearance is delayed.

> **Clock manipulation guard**: If `lastShown` is in the future (device clock tampered), return false.

### Phase 2: Centralized Trigger in Analytics

**Modified file: `apps/mobile/src/lib/analytics.ts`**

Instead of modifying 4 feature files with inline store calls, centralize the survey trigger:

```typescript
import { useSurveyStore, type SurveyTriggerAction } from '@/stores/survey.store'

const SURVEY_TRIGGER_MAP: Partial<Record<string, SurveyTriggerAction>> = {
  [AnalyticsEvent.EXPENSE_ADDED]: 'expense_added',
  [AnalyticsEvent.MAINTENANCE_TASK_CREATED]: 'maintenance_task_created',
  [AnalyticsEvent.TRIP_CREATED]: 'trip_created',
  [AnalyticsEvent.DIAGNOSTIC_COMPLETED]: 'diagnostic_completed',
}

/**
 * Track an event and maybe trigger the CSAT survey.
 * Drop-in replacement for trackEvent() at qualifying action sites.
 */
export function trackEventWithSurvey(
  event: string,
  properties?: Record<string, JsonType>
) {
  trackEvent(event, properties)
  const actionType = SURVEY_TRIGGER_MAP[event]
  if (actionType) {
    useSurveyStore.getState().tryShow(actionType)
  }
}
```

> **Architecture insight (from review)**: Feature screens should not know the survey system exists. Each trigger site changes from `trackEvent(...)` to `trackEventWithSurvey(...)` — a single-token change with no new imports. Adding future surveys or changing eligibility rules modifies one file, not four.

### Phase 3: Survey Overlay UI

**New file: `apps/mobile/src/components/survey/survey-overlay.tsx`**

Split into a thin wrapper + animated child to avoid Rules of Hooks issues:

```typescript
// Wrapper — only subscribes to `visible`, returns null when hidden
export function SurveyOverlay() {
  const visible = useSurveyStore((s) => s.visible)
  if (!visible) return null
  return <SurveyModal />
}

// Child — all animation hooks live here, only mounted when visible
function SurveyModal() {
  const { t } = useEditorialTheme()
  const triggerAction = useSurveyStore((s) => s.triggerAction)
  const [rating, setRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ... animations, handlers, render
}
```

**UI specifications**:

- **Backdrop**: `tint(t.ink, 0.6)` (uses editorial theme, NOT hardcoded rgba) with `FadeIn` animation
- **Card**: Bottom-aligned, `borderCurve: 'continuous'`, `borderRadius: radii.card` (20), background `t.surface`
- **Star rating**: 5 tappable stars (44x44pt touch targets), `FadeInUp.delay(i * 50)` stagger
- **Text input**: Appears after star selection with `FadeInUp`, `maxLength={500}`, placeholder: "Share your thoughts (no personal info please)"
- **Buttons**: `EButton` — "Submit" (primary, disabled after first tap) + "Not now" (text button)
- **Haptics**: `impactAsync(ImpactFeedbackStyle.Light)` on star selection, `notificationAsync(Success)` on submit

**Exit animation guard** (prevents ghost overlay on rapid re-trigger):

```typescript
const [isExiting, setIsExiting] = useState(false)

const handleDismiss = () => {
  setIsExiting(true)
}

// On the card's exiting animation:
<Animated.View
  exiting={SlideOutDown.duration(200).withCallback((finished) => {
    'worklet'
    if (finished) {
      runOnJS(onExitComplete)()
    }
  })}
>

const onExitComplete = () => {
  useSurveyStore.getState().dismiss()
  setIsExiting(false)
}
```

**Accessibility**:
- Stars: `accessibilityRole="radio"`, `accessibilityLabel="Rate {n} out of 5"`, `accessibilityState={{ selected: rating === n }}`
- Modal: `accessibilityViewIsModal={true}`
- Respect `useReducedMotion()` — skip stagger delays, use instant layout
- Minimum 44x44pt touch targets (Apple HIG)

**Layout**:
```
┌─────────────────────────────┐
│      (backdrop: t.ink 60%)  │
│                             │
│  ┌───────────────────────┐  │
│  │ How satisfied are you │  │
│  │ with this experience? │  │
│  │                       │  │
│  │   ★ ★ ★ ★ ★          │  │
│  │                       │  │
│  │ ┌───────────────────┐ │  │
│  │ │ Share your thoughts│ │  │
│  │ │ (no personal info) │ │  │
│  │ └───────────────────┘ │  │
│  │                       │  │
│  │  [Not now]  [Submit]  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Phase 4: Trigger Integration (4 files, 1-token change each)

Replace `trackEvent` with `trackEventWithSurvey` at each qualifying action site:

| File | Line | Change |
|------|------|--------|
| `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` | ~97 | `trackEvent(` → `trackEventWithSurvey(` |
| `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` | ~99 | `trackEvent(` → `trackEventWithSurvey(` |
| `apps/mobile/src/app/(modals)/create-trip.tsx` | ~556 | `trackEvent(` → `trackEventWithSurvey(` |
| `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx` | ~183 | `trackEvent(` → `trackEventWithSurvey(` |

Each file adds `trackEventWithSurvey` to the existing import from `@/lib/analytics`. No new imports, no new store references.

### Phase 5: Submit + Dismiss Handlers

**Submit handler** (in `survey-overlay.tsx`):

```typescript
const handleSubmit = async () => {
  if (isSubmitting) return // prevent double-tap
  setIsSubmitting(true)

  posthogClient.capture('survey sent', {
    $survey_id: SURVEY_ID,
    $survey_response: rating,
    ...(feedback.trim() ? { $survey_response_1: feedback.trim() } : {}),
    trigger_action: triggerAction, // custom property for segmentation
  })

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  handleDismiss() // triggers exit animation → onExitComplete → store.dismiss()
}
```

**Dismiss handler**:

```typescript
const handleDismiss = () => {
  if (isExiting) return
  setIsExiting(true)
  posthogClient.capture('survey dismissed', {
    $survey_id: SURVEY_ID,
    trigger_action: triggerAction,
  })
}
```

> **No custom analytics events needed**: PostHog's `survey sent` and `survey dismissed` are the standard protocol. The `trigger_action` custom property lets you segment by action type in PostHog dashboards. Dropped the planned `SURVEY_SHOWN`/`SURVEY_COMPLETED`/`SURVEY_DISMISSED` events.

### Phase 6: Root Layout Integration

**Modified file: `apps/mobile/src/app/_layout.tsx`**

```typescript
import { SurveyOverlay } from '@/components/survey/survey-overlay'

// In the render tree, after <Stack /> inside NavigationGate:
function NavigationGate({ children }: { children: React.ReactNode }) {
  // ...existing auth/onboarding logic...

  return (
    <>
      {children}
      <SurveyOverlay />
    </>
  )
}
```

> **Placement note**: `SurveyOverlay` renders after `Stack` but inside `NavigationGate`, so it has access to auth context and only mounts when the user is authenticated. When `visible` is false, it returns null — zero native views, zero performance cost.

## System-Wide Impact

### Interaction Graph

1. User completes action → `trackEventWithSurvey()` fires → analytics event sent → `tryShow()` checks eligibility atomically
2. If eligible: `shownThisSession = true` set synchronously (prevents double-show), then after 400ms delay, `visible = true`
3. `SurveyOverlay` (at root) observes `visible` → mounts `SurveyModal` with enter animation
4. On submit: `posthogClient.capture('survey sent')` → PostHog ingests → survey dashboard
5. On dismiss: exit animation → `onExitComplete()` → `store.dismiss()` → `SurveyModal` unmounts

### Error Propagation

- `posthogClient.capture()` failure → PostHog SDK handles retry/queue internally
- MMKV read failure → `getNumber()` returns `undefined`, coalesced to `0`, survey shows (safe)

### State Lifecycle Risks

- **Partial completion**: User selects stars, app killed → state lost, no submission — acceptable
- **No hydration race**: MMKV reads are synchronous, no async hydration needed
- **Exit + re-entry**: `isExiting` state guard prevents ghost overlay from rapid re-trigger

## Acceptance Criteria

### Functional

- [ ] Survey overlay appears after `expense_added` (within rate limits)
- [ ] Survey overlay appears after `maintenance_task_created` (within rate limits)
- [ ] Survey overlay appears after `trip_created` / clone (within rate limits)
- [ ] Survey overlay appears after `diagnostic_completed` (within rate limits)
- [ ] Star rating (1-5) is selectable with haptic feedback
- [ ] Optional text field appears after star selection (maxLength 500)
- [ ] Submit sends `survey sent` event with correct PostHog payload
- [ ] Dismiss sends `survey dismissed` event
- [ ] Rate limit: max once per action type per 7 days
- [ ] Rate limit: max once per app session (global cooldown)
- [ ] Respects analytics opt-out (`analyticsEnabled === false` → no survey)
- [ ] Survey overlay survives navigation (renders at root layout level)
- [ ] Submit button disabled after first tap (prevents double-submit)
- [ ] 400ms delay before overlay appears (avoids animation collision with navigation)

### Non-Functional

- [ ] All colors from `useEditorialTheme()` / `palette` tokens — no hardcoded hex/rgba
- [ ] Star touch targets >= 44x44pt (Apple HIG)
- [ ] VoiceOver/TalkBack labels on all interactive elements
- [ ] `accessibilityViewIsModal={true}` on overlay
- [ ] Respects `useReducedMotion()` for animations (skip staggers)
- [ ] MMKV for rate-limit persistence (synchronous, no hydration race)
- [ ] Dedicated MMKV instance (`id: 'survey'`)
- [ ] MMKV keys use colon-namespaced format: `survey:lastShown:<action>`
- [ ] Text input placeholder discourages PII entry

## Files to Create

| File | Purpose |
|------|---------|
| `apps/mobile/src/stores/survey.store.ts` | Zustand store with MMKV persistence (~35 lines) |
| `apps/mobile/src/components/survey/survey-overlay.tsx` | Global overlay UI (wrapper + modal child, ~120 lines) |

## Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `apps/mobile/src/lib/analytics.ts` | Add `trackEventWithSurvey()` + `SURVEY_TRIGGER_MAP` | ~15 lines added |
| `apps/mobile/src/app/_layout.tsx` | Import `SurveyOverlay`, render after Stack in NavigationGate | ~3 lines added |
| `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` | `trackEvent(` → `trackEventWithSurvey(` | 1-token change |
| `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` | `trackEvent(` → `trackEventWithSurvey(` | 1-token change |
| `apps/mobile/src/app/(modals)/create-trip.tsx` | `trackEvent(` → `trackEventWithSurvey(` | 1-token change |
| `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx` | `trackEvent(` → `trackEventWithSurvey(` | 1-token change |

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| PostHog survey ID changes if recreated | Single constant `SURVEY_ID` — update in one place |
| MMKV storage cleared (app reinstall) | Rate limits reset — user sees survey sooner, not a bug |
| Survey overlay blocks touch events | Backdrop captures all touches; dismiss returns control |
| Exit animation + rapid re-trigger | `isExiting` state guard prevents ghost overlay |
| PII in free-text feedback (GDPR) | maxLength={500}, PII-discouraging placeholder, update privacy policy |

## Security Considerations

1. **PII in free-text**: Add placeholder discouraging personal info. Set PostHog data retention policy for survey events (90 days recommended). Update privacy policy to disclose survey data collection.
2. **Analytics opt-out**: `tryShow()` checks `isAnalyticsEnabled()` before showing survey. No PostHog calls when opted out.
3. **Double-submit**: Submit button disabled after first tap via `isSubmitting` state.
4. **Input limits**: `maxLength={500}` on TextInput, trim whitespace before submission.

## Sources & References

### Internal References

- PostHog integration: `apps/mobile/src/lib/analytics.ts`
- Store review pattern (MMKV): `apps/mobile/src/lib/store-review.ts`
- Editorial theme: `apps/mobile/src/theme/editorial.ts`
- UI primitives: `apps/mobile/src/components/ui/editorial.tsx`

### Learnings Applied

- Zustand + useEffect: use `store.getState()` in callbacks, not hook values (from `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`)
- Zustand persist writes on every `set()` — guard with value checks (from `docs/solutions/architecture/currency-preference-full-stack-implementation.md`)
- Never mutate shared values inside `useDerivedValue` (from `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`)

### Review Agents Applied

- **TypeScript reviewer**: Use SDK types (`SurveyTriggerAction` union), extract `maybeTriggerSurvey`, fix `feedback || undefined` to explicit trim
- **Race conditions reviewer**: Atomic `tryShow()`, 400ms navigation delay, exit animation guard, cancel token pattern
- **Performance oracle**: Split overlay into wrapper/child, individual MMKV keys, skip stagger under reduceMotion
- **Architecture strategist**: Centralize triggers in analytics.ts, place overlay inside NavigationGate after Stack
- **Security sentinel**: maxLength on TextInput, PII placeholder, analytics opt-out guard, disable submit after tap
- **Simplicity reviewer**: Drop actionCounts, surveyQuestions, custom events, dynamic fetch, store review mutex (~40% LOC reduction)
- **Pattern recognition**: Dedicated MMKV instance, colon-namespaced keys, use editorial theme for backdrop color
