---
title: "Maintenance Alerts v2 — Task Lifecycle & Navigation Fix"
type: fix
status: completed
date: 2026-03-11
deepened: 2026-03-11
---

# Maintenance Alerts v2 — Task Lifecycle & Navigation Fix

## Enhancement Summary

**Deepened on:** 2026-03-11
**Research agents used:** 9 (TypeScript reviewer, Performance oracle, Security sentinel, Frontend races, Architecture strategist, Pattern recognition, Code simplicity, Learnings researcher, Best practices researcher) + Context7 (TanStack Query v5, Reanimated v4, Expo Router)

### Key Improvements from Deepening
1. **CRITICAL navigation fix corrected**: `router.navigate()` is correct for cross-tab (not `router.push()`). The real fix is adding a unique `_ts` param to bypass idempotency deduplication.
2. **Massive simplification**: Dropped Phase 4 (optimistic updates) and Phase 5 entirely. Stripped completion sheet to bare minimum. ~170 LOC never written, effort reduced from 6 days to 2 days.
3. **Security findings**: Existing `findAllHistory` leaks cross-user data via `adminClient` with no `user_id` filter. TOCTOU race in status check — use atomic UPDATE instead.
4. **Dropped `hasNextOccurrence`**: Redundant derived boolean. Check `nextOccurrence != null` instead.
5. **Dropped override args**: Removed `nextDueDate`/`nextTargetMileage` — server calculates correctly; edit-after-create covers edge cases.

### New Considerations Discovered
- `router.push()` for cross-tab pushes onto the CURRENT tab's stack (wrong). Must use `router.navigate()`.
- `@CurrentUser() user` must NOT be optional — remove `?` to prevent silent null propagation.
- `CompleteMaintenanceTaskInput` is the only resolver input missing `ZodValidationPipe` — must wire it.
- Use atomic `UPDATE ... WHERE status = 'pending'` instead of SELECT-then-UPDATE to prevent TOCTOU race.
- Use `useQuery` with `initialData` from cache for the formSheet (not raw `getQueryData`) to handle cold cache.

---

## Overview

Fix three interconnected issues in the maintenance alert system that degrade user trust: unreliable Home-to-task navigation (expo-router `navigate()` idempotency bug), ghost task reappearance after completion (silent auto-clone of recurring tasks), and lack of user control over recurrence scheduling. The solution introduces a completion confirmation sheet, compound mutation return types, and deterministic cross-tab navigation.

## Problem Statement

The current system creates a frustrating loop: user completes a task -> sees it reappear -> loses trust -> stops using maintenance tracking.

**P1 -- Unreliable navigation:** `router.navigate()` in `apps/mobile/src/app/(tabs)/(home)/index.tsx:151-155` is idempotent -- if `bike/[id]` with the same params is already in the Garage tab stack, navigation silently does nothing.

**P2 -- Ghost task reappearance:** `createNextRecurrence()` in `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:235-274` silently inserts a new `pending` task with the same title. After `invalidateQueries`, the user sees what appears to be the same task "coming back."

**P3 -- No recurrence control:** The server auto-creates next occurrences for recurring tasks. No user confirmation, no skip option. The `completeMaintenanceTask` mutation returns only the completed task -- the client has no awareness of the new task.

## Proposed Solution

### Phase 1: Navigation Fix
Keep `router.navigate()` (correct for cross-tab) but add a unique `_ts` timestamp param to bypass idempotency deduplication + add `highlightTask` param. Fix both `MaintenanceSummary.onTaskPress` and `PriorityActionCard.onPress` in `use-home-data.ts`.

### Phase 2: API -- Compound Mutation Result
New `CompleteTaskResult` return type with `completed` and `nextOccurrence?` (nullable). Client controls recurrence via single `createNextOccurrence` boolean. Server calculates next dates automatically.

### Phase 3: Minimal Completion Sheet + Animations
Route-based formSheet at `apps/mobile/src/app/(tabs)/(garage)/complete-task.tsx` with task name, bike name, "Schedule next" toggle (recurring tasks only), and Complete button. Exit animation on task cards via reanimated `exiting` prop.

## Technical Considerations

### Architecture Decisions

**Navigation: `router.navigate()` with unique params, NOT `router.push()`:**
Per Expo Router docs, `router.push()` for cross-tab navigation pushes the screen onto the CURRENT tab's stack (broken). `router.navigate()` correctly switches to the target tab. The idempotency bug is solved by adding a unique `_ts` timestamp param, which makes each navigation call produce a unique route identity.

> **Research insight (Best Practices Researcher):** "Do NOT use `router.push` for cross-tab navigation. It will push the screen onto the CURRENT tab's stack instead of switching tabs. This creates a broken navigation state."

**Completion sheet as route-based formSheet (not component-level modal):**
The codebase exclusively uses `presentation: 'formSheet'` via expo-router routes (see `add-bike.tsx`, `add-maintenance-task.tsx`, `edit-bike.tsx`). No `@gorhom/bottom-sheet` or similar library exists. Consistent with existing patterns.

> **Research insight (Pattern Recognition):** Existing formSheet routes use detents `[0.85, 1.0]`. The completion sheet uses `[0.65, 0.85]` -- justified because it has significantly less content than add-bike/add-task forms.

**No optimistic updates -- use `invalidateQueries` on success:**
The ghost task problem is caused by silent recurrence creation, not by slow refetch. Once the client controls whether recurrence happens and the server returns the compound result, `invalidateQueries` will fetch the correct final state. The task will be gone (completed) and any next occurrence will be present and distinguishable.

> **Research insight (Code Simplicity Reviewer):** "Optimistic updates are a new pattern in this codebase. Introducing them means: snapshot + rollback logic, dual-cache updates, deduplication for the race condition, and every future developer needs to understand this pattern. That is significant complexity for a problem that does not require it."

**Animation: reanimated `exiting` prop + `itemLayoutAnimation` on list:**
Use `FadeOutLeft.duration(250)` as the `exiting` prop on task card `Animated.View`. Use `LinearTransition` as `itemLayoutAnimation` on the parent `Animated.FlatList` for sibling reflow. New next occurrences get `entering={FadeInUp.delay(500)}` for visual separation from the exit -- no `setTimeout` needed.

> **Research insight (Reanimated docs + Performance Oracle):** "`itemLayoutAnimation` on `Animated.FlatList` handles sibling reflow. Use `entering`/`exiting` on items. `keyExtractor` is mandatory for reanimated to track additions/removals."

### Performance Implications
- Task lists already capped at 5 items (bike hub + home). No performance concern with exit animations at this scale.
- `invalidateQueries` in `onSettled` is sufficient. No optimistic cache manipulation needed.
- FormSheet uses `useQuery` with `initialData` from cache -- instant render when warm, automatic fetch when cold.

> **Research insight (Performance Oracle):** "FlashList is wrong here. Windowing only helps with hundreds of items. With 5-8 visible cards, the overhead is the animation itself, not the React tree. FlashList would actually *hurt* because it recycles views, which conflicts with reanimated's `exiting` animations."

### Security Considerations

**CRITICAL -- Fix existing `findAllHistory` cross-user data leak:**
`maintenanceTaskHistory` resolver at `maintenance-tasks.resolver.ts:43-49` uses `adminClient` with NO `user_id` filter. Any authenticated user who knows a `motorcycleId` UUID can read another user's full maintenance history. Switch to user-scoped `this.supabase` client.

> **Research insight (Security Sentinel):** "This is an existing bug, not introduced by the plan. Severity: Critical -- direct data exfiltration across user boundaries."

**Use atomic UPDATE for status guard (prevent TOCTOU race):**
Replace SELECT-then-UPDATE with single `UPDATE ... WHERE status IN ('pending', 'in_progress')`. If two concurrent requests race, only one matches and succeeds.

> **Research insight (Security Sentinel):** "Between the SELECT and the UPDATE, a concurrent request can complete the same task. Both see `status = 'pending'`, both proceed, and `createNextRecurrence` runs twice, producing duplicate tasks."

**Wire `ZodValidationPipe` to `completeMaintenanceTask` resolver:**
This is the only resolver input missing Zod validation. Add `new ZodValidationPipe(CompleteMaintenanceTaskSchema)`.

**`@CurrentUser() user: AuthUser` must NOT be optional:**
Remove `?` from the parameter. If `user` is optional, the resolver silently proceeds without authentication if the guard is bypassed.

> **Research insight (TypeScript Reviewer):** "Making it optional means you are deferring a runtime crash (or worse, a silent null propagation) into `this.service.complete()` where `user` could be `undefined`."

## System-Wide Impact

### Interaction Graph
1. User taps "Done" on task card -> navigates to formSheet route (`complete-task.tsx`)
2. Sheet shows task name, bike name, "Schedule next" toggle (recurring only), Complete button
3. User taps "Complete" -> button shows loading state -> mutation fires
4. Server: atomically updates task status -> optionally calls `createNextRecurrence` -> returns compound result
5. Client `onSuccess`: success haptic -> sheet auto-dismisses after 500ms -> `invalidateQueries` refetches both caches
6. Bike detail list re-renders: completed task exits with `FadeOutLeft`, siblings reflow via `LinearTransition`, next occurrence enters with `FadeInUp.delay(500)`

### Error Propagation
- Mutation failure -> error toast via `Alert.alert` -> sheet stays open for retry
- `createNextRecurrence` failure -> server returns `{ completed, nextOccurrence: null }` -- task is still completed, just no next occurrence. Silent degradation is acceptable.

### State Lifecycle Risks
- **Sheet dismissal mid-flow:** iOS swipe-down gesture dismisses formSheet without completing. Treat as Cancel -- no mutation fires.
- **Stale expanded state:** After completion, `expandedId` in `BikeDetailScreen` holds the old task ID. Clear `expandedId` when the task is removed from active list.
- **Cold cache on formSheet:** Use `useQuery` with `initialData` from cache. If cache is cold, TanStack Query fetches automatically. Sheet never renders blank.

> **Research insight (Performance Oracle):** "Use `useQuery` with `initialData` sourced from cache, not raw `getQueryData`. This gives you the best of both worlds: instant render from cache when warm, automatic fetch when cold."

### API Surface Parity
- `completeMaintenanceTask` mutation adds one optional arg (`createNextOccurrence: Boolean`) and changes return type to `CompleteTaskResult`. Old clients omitting the arg get backwards-compatible behavior (`createNextOccurrence ?? isRecurring`).
- New `.graphql` operation file needed. Run `pnpm generate` after changes.

### Integration Test Scenarios
1. Complete recurring task with "Schedule next" ON -> verify both completed task and new pending task returned
2. Complete recurring task with "Schedule next" OFF -> verify no next occurrence created
3. Complete task on bike detail -> switch to Home tab -> verify task is gone from both views
4. Complete already-completed task (multi-device race) -> verify atomic UPDATE rejects gracefully
5. Navigate from Home to task -> complete -> navigate back -> verify Home reflects change

## Acceptance Criteria

### Functional Requirements

- [x] **R1 Navigation:** Tapping any maintenance alert on Home reliably navigates to the bike detail page with the task visible, regardless of tab stack state
- [x] **R1 Navigation:** `PriorityActionCard.onPress` in `use-home-data.ts:175-178,197-200` also uses the fixed navigation
- [x] **R1 Navigation:** Uses `router.navigate()` with unique `_ts` param (NOT `router.push()`)
- [x] **R2 Sheet:** Tapping "Done" opens a formSheet with task title, bike name, and "Complete" button
- [x] **R2 Sheet:** For recurring tasks, sheet shows "Schedule next" toggle (default ON)
- [x] **R2 Sheet:** "Complete" button is disabled while mutation is pending (double-tap prevention)
- [x] **R2 Sheet:** On success, button transitions to green checkmark (300ms), then auto-dismisses after 500ms
- [x] **R3 Animation:** Completed task exits with `FadeOutLeft.duration(250)`, list reflows with `LinearTransition`
- [x] **R3 Animation:** Next occurrence enters with `FadeInUp.delay(500)` after refetch
- [x] **R4 API:** `completeMaintenanceTask` returns `CompleteTaskResult { completed, nextOccurrence? }`
- [x] **R4 API:** Client can pass `createNextOccurrence: Boolean` to control recurrence
- [x] **R4 API:** Status guard uses atomic UPDATE (not SELECT-then-UPDATE)
- [x] **R4 API:** `ZodValidationPipe(CompleteMaintenanceTaskSchema)` wired to resolver

### Non-Functional Requirements

- [x] Animations stay under 300ms per CLAUDE.md conventions
- [x] Haptic feedback on iOS for successful completion (`Haptics.notificationAsync(Success)`)
- [x] Sheet uses `borderCurve: 'continuous'` on all rounded elements
- [x] Use `palette.*` (hex) for native component props, not oklch
- [x] `pnpm generate` runs cleanly after all GraphQL changes
- [ ] Zod schema added for `CompleteTaskResult` in `@motovault/types`
- [x] `@CurrentUser() user: AuthUser` is non-optional (no `?`)

### Security Requirements

- [x] **CRITICAL:** Fix `findAllHistory` to filter by `user_id` or use RLS-scoped client
- [x] Atomic UPDATE prevents double-completion race condition
- [x] `ZodValidationPipe` validates completion input on server

## Implementation Phases

### Phase 1: Navigation Fix (P0) -- ~0.5 day

**Files to modify:**
- `apps/mobile/src/components/home/use-home-data.ts` -- fix `onTaskPress` and `priorityAction.onPress`
- `apps/mobile/src/components/home/maintenance-task-row.tsx` -- pass `taskId` alongside `motorcycleId` in onPress callback
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` -- read `highlightTask` param, auto-expand + scroll after data loads

**Implementation details:**

```typescript
// use-home-data.ts — fix both navigation paths
// Use router.navigate() for cross-tab (NOT router.push!)
// Add _ts param to bypass idempotency deduplication
onTaskPress: (motorcycleId: string, taskId: string) => {
  router.navigate({
    pathname: '/(tabs)/(garage)/bike/[id]',
    params: {
      id: motorcycleId,
      highlightTask: taskId,
      _ts: Date.now().toString(), // unique param defeats idempotency
    },
  });
}
```

```typescript
// bike/[id].tsx — handle highlightTask param
const params = useLocalSearchParams<{
  id: string;
  highlightTask?: string;
  _ts?: string;
}>();
const id = Array.isArray(params.id) ? params.id[0] : params.id;
const highlightTask = params.highlightTask;

// After tasks data loads, scroll to and expand the highlighted task
// Use ref to prevent re-triggering on subsequent re-renders
const hasHighlighted = useRef(false);
useEffect(() => {
  if (highlightTask && tasksData && !hasHighlighted.current) {
    hasHighlighted.current = true;
    setExpandedId(highlightTask);
    // scrollToTask logic using ref
  }
}, [highlightTask, tasksData]);
```

> **Research insight:** `useLocalSearchParams` generic does not enforce single-value at runtime. Always guard with `Array.isArray()` check for dynamic segments.

---

### Phase 2: API Changes (P0) -- ~0.5 day

**Files to modify:**
- `apps/api/src/modules/maintenance-tasks/models/complete-task-result.model.ts` -- **new file**
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` -- update return type, add `createNextOccurrence` arg, wire Zod pipe
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` -- atomic status guard in `complete()`
- `packages/types/src/validators/maintenance-task.ts` -- add `CompleteTaskResultSchema`
- `apps/mobile/src/graphql/mutations/complete-maintenance-task.graphql` -- update operation

**Also fix (security):**
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` -- `findAllHistory()`: switch from `adminClient` to `this.supabase` (or add `.eq('user_id', userId)`)

**New model (no `hasNextOccurrence` -- derived field is unnecessary):**

```typescript
// complete-task-result.model.ts
import { Field, ObjectType } from '@nestjs/graphql';
import { MaintenanceTask } from './maintenance-task.model';

@ObjectType()
export class CompleteTaskResult {
  @Field(() => MaintenanceTask, {
    description: 'The task that was marked as completed',
  })
  completed: MaintenanceTask;

  @Field(() => MaintenanceTask, {
    nullable: true,
    description: 'The next occurrence if recurring and user opted in, null otherwise',
  })
  nextOccurrence?: MaintenanceTask;
}
```

**Updated resolver (non-optional user, Zod pipe, single arg):**

```typescript
@UseGuards(GqlAuthGuard)
@Mutation(() => CompleteTaskResult)
async completeMaintenanceTask(
  @CurrentUser() user: AuthUser,   // NOT optional — guard guarantees this
  @Args('id') id: string,
  @Args('input', { nullable: true }, new ZodValidationPipe(CompleteMaintenanceTaskSchema))
  input: CompleteMaintenanceTaskInput | null,
  @Args('createNextOccurrence', { nullable: true })
  createNextOccurrence: boolean | null,
): Promise<CompleteTaskResult> {
  const completed = await this.service.complete(user.id, id, input);

  const shouldCreateNext = createNextOccurrence ?? completed.isRecurring;
  let nextOccurrence: MaintenanceTask | undefined;

  if (shouldCreateNext) {
    nextOccurrence = await this.service.createNextRecurrence(completed);
  }

  return { completed, nextOccurrence };
}
```

> **Research insight (TypeScript Reviewer):** "GraphQL nullable and TypeScript optional are different concepts. A nullable GraphQL arg is always present — it is just `null` when omitted. Use `param: Type | null` not `param?: Type`."

**Atomic status guard in `complete()` service:**

```typescript
async complete(userId: string, id: string, input?: CompleteMaintenanceTaskInput | null) {
  const updates = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    ...(input?.completedMileage != null && { completed_mileage: input.completedMileage }),
    ...(input?.cost != null && { cost: input.cost }),
    ...(input?.partsCost != null && { parts_cost: input.partsCost }),
    ...(input?.laborCost != null && { labor_cost: input.laborCost }),
    ...(input?.currency != null && { currency: input.currency }),
  };

  // Atomic: status guard + update in one query (prevents TOCTOU race)
  const { data, error } = await this.supabase
    .from('maintenance_tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .is('deleted_at', null)
    .select()
    .single();

  if (!data) {
    throw new BadRequestException('Task not found or already completed');
  }

  return this.mapRow(data);
}
```

**Updated GraphQL operation (simplified):**

```graphql
mutation CompleteMaintenanceTask(
  $id: String!
  $input: CompleteMaintenanceTaskInput
  $createNextOccurrence: Boolean
) {
  completeMaintenanceTask(
    id: $id
    input: $input
    createNextOccurrence: $createNextOccurrence
  ) {
    completed {
      id
      status
      completedAt
      completedMileage
      cost
      partsCost
      laborCost
      currency
    }
    nextOccurrence {
      id
      title
      description
      dueDate
      targetMileage
      priority
      status
      isRecurring
      intervalKm
      intervalDays
      source
      createdAt
    }
  }
}
```

Then run `pnpm generate`.

> **Research insight (Learnings):** "Always use `String!` (not `ID!`) for Supabase UUID arguments. Run `pnpm generate` BEFORE mobile component development begins."

---

### Phase 3: Minimal Completion Sheet + Animations (P0) -- ~1 day

**Files to create/modify:**
- `apps/mobile/src/app/(tabs)/(garage)/complete-task.tsx` -- **new file**: formSheet route
- `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` -- register formSheet route
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` -- navigate to sheet instead of direct mutate; add `exiting` + `layout` to task cards

**Layout registration:**

```typescript
// _layout.tsx — add to Stack
<Stack.Screen
  name="complete-task"
  options={{
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.65, 0.85, 1.0], // 1.0 for accessibility (large text)
    headerShown: false,
    contentStyle: {
      backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
    },
  }}
/>
```

**FormSheet route: `complete-task.tsx`**

Route params: `taskId`, `motorcycleId`, `bikeName`

Use `useQuery` with `initialData` from cache (not raw `getQueryData`) for cold-cache safety:

```typescript
const taskQuery = useQuery({
  queryKey: ['maintenance-tasks', 'detail', taskId],
  queryFn: () => gqlFetcher(GetMaintenanceTasksByMotorcycleDocument, {
    motorcycleId,
  }),
  select: (data) => data.maintenanceTasks.find((t) => t.id === taskId),
  initialData: () =>
    queryClient.getQueryData(
      queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    ),
  initialDataUpdatedAt: () =>
    queryClient.getQueryState(
      queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    )?.dataUpdatedAt,
});
```

**Minimal UI structure (stripped down per simplicity review):**

```
+----------------------------------+
|        [drag handle]             |
|                                  |
|   Complete: Oil Change           |
|   2024 Honda CB650R              |
|                                  |
|   ┌────────────────────────┐     |
|   │ Schedule next    [ON]  │     |  ← only for isRecurring tasks
|   └────────────────────────┘     |
|                                  |
|   [  Mark as Complete  ]         |  ← full-width primary CTA
|                                  |
|         Cancel                   |
+----------------------------------+
```

No mileage input, no cost input, no date/mileage override fields in V1. These can be added later if users request them.

> **Research insight (Code Simplicity):** "The mileage/cost fields add friction to the common case. The 'Schedule next' toggle for non-recurring tasks is scope creep — it solves no stated problem."

> **Research insight (Apple HIG):** "A formSheet should do ONE thing. Primary CTA at bottom. Show brief success state (checkmark, 300ms), then auto-dismiss."

**Completion mutation in the sheet:**

```typescript
const completeMutation = useMutation({
  mutationFn: (vars: CompleteMaintenanceTaskMutationVariables) =>
    gqlFetcher(CompleteMaintenanceTaskDocument, vars),

  onSuccess: (data) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Show success state in button (green checkmark) for 500ms
    setCompleted(true);
    setTimeout(() => router.back(), 500);
  },

  onSettled: () => {
    // Refetch both caches for full consistency
    queryClient.invalidateQueries({
      queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.maintenanceTasks.allUser,
    });
  },

  onError: (_err: Error) => {
    Alert.alert(t('common.error'), t('maintenance.completeError'));
  },
});
```

**Animation on `bike/[id].tsx` task cards:**

```typescript
// SwipeableTaskCard wrapper — add exiting animation
<Animated.View
  key={task.id}
  entering={FadeInUp.delay(index * 50).duration(300)}
  exiting={FadeOutLeft.duration(250)}
  layout={LinearTransition.duration(200)}
>
  {/* task card content */}
</Animated.View>
```

If using `Animated.FlatList`, add `itemLayoutAnimation`:

```typescript
<Animated.FlatList
  data={activeTasks}
  renderItem={renderTask}
  keyExtractor={(item) => item.id}
  itemLayoutAnimation={LinearTransition}
/>
```

> **Research insight (Reanimated docs):** "`keyExtractor` is mandatory for reanimated to track additions/removals. Without it, animations will break."

> **Research insight (Performance Oracle):** "The current 5-item cap is already the right boundary. Do not raise it beyond 8 if adding layout animations."

**Clear stale expanded state + sheet navigation:**

```typescript
// When task is removed from active list, clear expandedId
useEffect(() => {
  if (expandedId && !activeTasks.find((t) => t.id === expandedId)) {
    setExpandedId(null);
  }
}, [activeTasks, expandedId]);

// Navigate to completion sheet instead of direct mutate
const handleComplete = (taskId: string) => {
  router.push({
    pathname: '/(tabs)/(garage)/complete-task',
    params: { taskId, motorcycleId: id, bikeName: bikeData?.name ?? '' },
  });
};
```

**Design tokens (from learnings):**
- All `borderRadius` elements must use `borderCurve: 'continuous'`
- Use `palette.*` (hex) for native props (`backgroundColor`, `borderColor`, `color`)
- Use `useColorScheme() === 'dark'` for dark mode detection
- Use `useSafeAreaInsets()` for bottom padding in formSheet

## Alternative Approaches Considered

### 1. `router.push()` for cross-tab navigation
**Rejected (during deepening):** Best practices research confirmed `router.push()` for cross-tab pushes onto the CURRENT tab's stack, creating broken navigation. `router.navigate()` with unique params is the correct approach.

### 2. Optimistic updates for task completion
**Rejected (during deepening):** The ghost task problem is caused by silent recurrence creation, not by slow refetch. Once the client controls recurrence via `createNextOccurrence` and the server returns the compound result, `invalidateQueries` produces correct state. Optimistic updates add ~80 lines of complex cache manipulation for a problem that doesn't require it.

### 3. Component-level bottom sheet (e.g., @gorhom/bottom-sheet)
**Rejected:** Introduces a new dependency and contradicts the codebase's exclusive use of native `presentation: 'formSheet'`.

### 4. V2 schema with separate `maintenance_completions` table
**Deferred to future:** The current single-table approach is sufficient for V1. A separate completions table would eliminate the clone-on-complete pattern entirely but requires a migration and query refactor.

### 5. Full completion form with mileage/cost/date overrides
**Deferred (during deepening):** The simplicity reviewer correctly identified that mileage/cost inputs add friction for the common case and solve no stated problem. The server calculates next dates correctly. Edit-after-create covers edge cases. These can be added in a follow-up if users request them.

## Dependencies & Prerequisites

- No database migration required (V1 approach)
- No new npm dependencies required
- Expo Router `presentation: 'formSheet'` support (already in use)
- react-native-reanimated v4 `Layout` transition (already available)
- `pnpm generate` must run after GraphQL changes
- Contract-first: write resolver + `.graphql` -> `pnpm generate` -> mobile code

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `router.navigate()` + `_ts` param leaves stale params on re-render | Low | Low | Use `hasHighlighted` ref to prevent re-triggering |
| FormSheet route data loading from cache miss | Low | Medium | `useQuery` with `initialData` from cache; automatic fetch on cold cache |
| Animation `exiting` prop not working with `map()` inside `ScrollView` | Medium | Medium | Test explicitly; fallback to `Animated.FlatList` with `itemLayoutAnimation` |
| TOCTOU race in task completion | Medium | High | Atomic UPDATE with status guard eliminates the race |
| `findAllHistory` cross-user data leak (existing bug) | Already exists | Critical | Fix to use RLS-scoped client in this PR |

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/mobile/src/app/(tabs)/(garage)/complete-task.tsx` | Completion formSheet route |
| `apps/api/src/modules/maintenance-tasks/models/complete-task-result.model.ts` | `CompleteTaskResult` ObjectType |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` | New return type, `createNextOccurrence` arg, Zod pipe, non-optional user |
| `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` | Atomic status guard in `complete()`, fix `findAllHistory` security bug |
| `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` | Register `complete-task` formSheet route |
| `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | `highlightTask` param, navigate to sheet, exit animations, stale expandedId cleanup |
| `apps/mobile/src/components/home/use-home-data.ts` | Fix `onTaskPress` + `priorityAction` navigation with `_ts` param |
| `apps/mobile/src/components/home/maintenance-task-row.tsx` | Pass `taskId` in onPress callback |
| `apps/mobile/src/graphql/mutations/complete-maintenance-task.graphql` | Updated operation with compound return type |
| `packages/types/src/validators/maintenance-task.ts` | Add `CompleteTaskResultSchema` |

### Generated Files (auto-updated via `pnpm generate`)
| File | Purpose |
|------|---------|
| `packages/graphql/src/generated/graphql.ts` | TypedDocumentNode types |
| `packages/graphql/src/generated/gql.ts` | Document map |

## Sources & References

### Internal References
- Navigation bug: `apps/mobile/src/app/(tabs)/(home)/index.tsx:151-155`
- PriorityActionCard nav bug: `apps/mobile/src/components/home/use-home-data.ts:175-178,197-200`
- Current completion mutation: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts:72-87`
- createNextRecurrence: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:235-274`
- Complete service method: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:167-203`
- Security bug (findAllHistory): `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:221-233`
- FormSheet pattern: `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx`
- Query keys: `apps/mobile/src/lib/query-keys.ts`
- Design tokens: `packages/design-system/src/palette.ts`, `spacing.ts`, `typography.ts`

### Institutional Learnings
- GraphQL contract drift: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` -- always use `String!` for UUIDs, run `pnpm generate` after changes, verify field name parity
- UI patterns: `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md` -- use palette hex for native props, `borderCurve: continuous`, animations under 300ms
- RLS patterns: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` -- RLS `WITH CHECK` for writes, explicit SELECT columns

### External References
- [TanStack Query v5 Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [React Native Reanimated List Layout Animations](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/list-layout-animations/)
- [Apple HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Expo Router Navigating Pages](https://docs.expo.dev/router/navigating-pages)
