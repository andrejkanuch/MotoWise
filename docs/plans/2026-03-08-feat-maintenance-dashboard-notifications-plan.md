---
title: "feat: Maintenance Dashboard UX/UI with In-App Notifications"
type: feat
status: active
date: 2026-03-08
---

# Maintenance Dashboard UX/UI with In-App Notifications

## Overview

Build a premium motorcycle maintenance dashboard experience with visual health scoring, in-app notification badges, home screen alerts widget, and local push notification scheduling. Transform the existing maintenance task list into a visually-rich, proactive system that nudges riders to keep their bikes in top shape.

## Problem Statement

Users can create and manage maintenance tasks per motorcycle, but:
- There is no visual summary of maintenance health — just a flat task list
- Users must manually navigate to each bike's maintenance tab to see overdue tasks
- No proactive notifications when tasks are due — users must remember to check
- The home screen has no awareness of maintenance state
- The garage tab badge shows nothing, so overdue tasks go unnoticed

## Proposed Solution

### 1. Health Score Gauge (Bike Detail)
Animated SVG circular gauge (0-100) computed client-side from overdue penalties, upcoming urgency, and completion rate. Rendered at the top of the maintenance tab.

### 2. Home Screen Maintenance Widget
New section on home screen showing up to 3 most urgent tasks across all motorcycles, with overdue tasks prioritized. Tapping navigates to the bike's maintenance tab.

### 3. Tab Badge on Garage
Red numeric badge on the IslandTabBar's Garage icon showing count of overdue + critical-soon tasks.

### 4. Local Push Notifications
Schedule reminders via `expo-notifications` 1 day before task due dates. Support notification actions: Mark Done, Snooze (1 day), View Details.

### 5. Enhanced Maintenance Tab
Add health gauge, next service countdown, and improved task cards with relative time labels ("due in 3 days", "2 days overdue").

## Technical Approach

### Architecture Decisions

**Health score: client-side computation.** The algorithm is pure math over cached task data. No new API query needed for single-bike view. For multi-bike aggregation (home widget, badge), we add a new `allMaintenanceTasks` query that returns tasks across all user motorcycles.

**Mileage-based tasks: informational only (Phase 1).** The `motorcycles` table lacks a `current_mileage` field. Adding odometer tracking is a separate feature. Mileage-based tasks will display their target but won't factor into overdue/urgency calculations.

**Notifications: local scheduling only (no server push).** Using `expo-notifications` local triggers. Notifications are scheduled/cancelled client-side when tasks are created/updated/completed/deleted. Snooze = reschedule notification only (no DB update).

### Implementation Phases

#### Phase 1: API — Aggregate Maintenance Query

Add `allMaintenanceTasks` query to the existing maintenance-tasks resolver that returns all pending/in_progress tasks across all user motorcycles (no motorcycleId filter). This powers the home widget and tab badge without N+1 queries.

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` | Edit — add `findAllForUser(userId)` method |
| 2 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` | Edit — add `allMaintenanceTasks` query |
| 3 | `apps/mobile/src/graphql/queries/all-maintenance-tasks.graphql` | Create |
| 4 | `apps/mobile/src/lib/query-keys.ts` | Edit — add `maintenanceTasks.allUser` key |
| 5 | Run `pnpm generate` | — |

**API additions:**

```graphql
# all-maintenance-tasks.graphql
query AllMaintenanceTasks {
  allMaintenanceTasks {
    id
    motorcycleId
    title
    dueDate
    targetMileage
    priority
    status
    completedAt
  }
}
```

```typescript
// Service: findAllForUser(userId)
// SELECT * FROM maintenance_tasks
//   WHERE user_id = $1 AND deleted_at IS NULL
//   AND status IN ('pending', 'in_progress')
//   ORDER BY due_date ASC NULLS LAST, priority ASC
```

#### Phase 2: Health Score Algorithm & Gauge Component

**Files:**

| # | File | Action |
|---|------|--------|
| 6 | `apps/mobile/src/lib/health-score.ts` | Create — pure function computing score |
| 7 | `apps/mobile/src/components/HealthScoreRing.tsx` | Create — animated SVG gauge |

**Health score algorithm (client-side, pure function):**

```
Score = overdueScore * 0.50 + urgencyScore * 0.25 + completionScore * 0.25

Overdue (50%): Each pending task past due_date penalizes proportional to priority weight × sqrt(days_overdue).
  - Tasks with no due_date: excluded from this factor
  - Priority weights: critical=4, high=3, medium=2, low=1

Urgency (25%): Tasks due within 7 days. Closer = higher penalty.
  - 0-3 days: full penalty
  - 4-7 days: partial penalty (linear interpolation)
  - Tasks with no due_date: excluded

Completion rate (25%): % of completed tasks done within 3-day grace of due_date.
  - No history: 100 (benefit of the doubt for new bikes)
  - Skipped tasks: excluded from rate calculation

Edge cases:
  - 0 tasks total → show "No Data" state, not 100
  - All completed, none pending → score = 100 with "All caught up!" label
  - All tasks have no due_date → score derived from completion rate only (100 if none completed either → "No Data")
```

**HealthScoreRing component:**
- `react-native-svg` Circle with animated `strokeDashoffset` via `useAnimatedProps`
- Color interpolation: red (0-40) → orange (40-60) → yellow (60-75) → green (75-100)
- Center: score number + grade label (A/B/C/D/F)
- `accessibilityLabel={`Maintenance health score: ${score} out of 100, grade ${grade}`}`
- Size: 140px, strokeWidth: 10

#### Phase 3: Enhanced Maintenance Tab

Enhance `bike/[id].tsx` MaintenanceTab with:

**Files:**

| # | File | Action |
|---|------|--------|
| 8 | `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | Edit — add gauge header, countdown, relative dates |

**Changes:**
1. **Health gauge header**: HealthScoreRing at top of maintenance tab, showing computed score
2. **Next service countdown**: Below gauge, show nearest due task with relative time ("Oil change in 3 days", "Chain lube — 2 days overdue")
3. **Relative date labels**: Replace raw date strings with relative formatting ("Due in 3 days", "Overdue by 5 days", "Due today")
4. **Overdue visual treatment**: Tasks past due_date get a red-tinted background and "OVERDUE" badge replacing the priority badge

#### Phase 4: Home Screen Maintenance Widget

**Files:**

| # | File | Action |
|---|------|--------|
| 9 | `apps/mobile/src/app/(tabs)/(home)/index.tsx` | Edit — add MaintenanceAlertsWidget |

**Widget design:**
- Placed between Quick Actions and Popular Topics
- Card with gradient header: "Maintenance Alerts" with Wrench icon
- Shows up to 3 most urgent tasks (overdue first, then by priority × days-until-due)
- Each row: motorcycle name (small), task title, urgency badge, relative date
- Tapping a row navigates to `/(garage)/bike/${motorcycleId}` (maintenance tab)
- "View All" link at bottom → navigates to garage tab
- Empty state: "All bikes are in great shape!" with checkmark icon
- Uses `AllMaintenanceTasksDocument` query + client-side sorting

#### Phase 5: Tab Badge on IslandTabBar

**Files:**

| # | File | Action |
|---|------|--------|
| 10 | `apps/mobile/src/components/TabBadge.tsx` | Create — badge dot/counter component |
| 11 | `apps/mobile/src/app/(tabs)/_layout.tsx` | Edit — add badge to Garage tab |

**Badge logic:**
- Count = overdue tasks + tasks due within 3 days (critical/high priority)
- Computed from `AllMaintenanceTasks` query data (same as home widget)
- Max display: "9+" for ≥10
- Position: top-right of Garage icon, red circle with white number
- Animation: `ZoomIn.springify()` on appearance
- Clears when user navigates to Garage tab
- Zustand store not needed — derive directly from TanStack Query cache

#### Phase 6: Local Push Notifications

**Files:**

| # | File | Action |
|---|------|--------|
| 12 | `apps/mobile/package.json` | Edit — add expo-notifications |
| 13 | `apps/mobile/app.json` | Edit — add expo-notifications plugin |
| 14 | `apps/mobile/src/lib/notifications.ts` | Create — setup, permissions, scheduling |
| 15 | `apps/mobile/src/hooks/useNotificationListeners.ts` | Create — response handler |
| 16 | `apps/mobile/src/app/_layout.tsx` | Edit — init notifications, add listeners |
| 17 | `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | Edit — schedule on task create/complete |
| 18 | `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` | Edit — schedule after create |

**Notification lifecycle:**
1. **Task created with due_date** → schedule notification 1 day before at 9:00 AM
2. **Task updated (due_date changed)** → cancel old notification, schedule new
3. **Task completed** → cancel pending notification
4. **Task deleted** → cancel pending notification
5. **App foreground** → prune stale notifications (tasks that were completed/deleted while app was closed)
6. **Logout** → cancel all scheduled notifications

**Notification content:**
```
Title: "🔧 {bikeName}: {taskTitle}"
Body: "Due tomorrow. Tap to view or mark as done."
Category: maintenance_action
Actions: [Mark Done, Snooze 1 Day, View Details]
Data: { taskId, motorcycleId }
```

**Permission request:** Triggered on first task creation with a due_date. If denied, tasks still work but without push reminders. Show a settings hint in the notification preferences screen.

**Android channel:** `maintenance` — "Maintenance Reminders", HIGH importance

#### Phase 7: i18n Keys

**Files:**

| # | File | Action |
|---|------|--------|
| 19 | `apps/mobile/src/i18n/locales/en.json` | Edit — ~25 new keys |
| 20 | `apps/mobile/src/i18n/locales/es.json` | Edit — ~25 new keys |
| 21 | `apps/mobile/src/i18n/locales/de.json` | Edit — ~25 new keys |

**New keys (maintenance namespace):**
```json
{
  "maintenance": {
    "healthScore": "Health Score",
    "grade": "Grade",
    "noData": "No maintenance data yet",
    "allCaughtUp": "All caught up!",
    "nextService": "Next Service",
    "dueInDays": "Due in {{count}} day(s)",
    "dueToday": "Due today",
    "overdueByDays": "{{count}} day(s) overdue",
    "overdue": "OVERDUE",
    "alertsTitle": "Maintenance Alerts",
    "alertsEmpty": "All bikes are in great shape!",
    "viewAll": "View All",
    "notificationTitle": "{{bikeName}}: {{taskTitle}}",
    "notificationBody": "Due tomorrow. Tap to view or mark as done.",
    "notificationSnooze": "Snooze 1 Day",
    "notificationMarkDone": "Mark Done",
    "notificationView": "View Details",
    "permissionTitle": "Enable Reminders",
    "permissionBody": "Get notified when maintenance is due",
    "permissionDenied": "Notifications disabled. Enable in Settings.",
    "tasksDue": "{{count}} task(s) due soon",
    "tasksOverdue": "{{count}} task(s) overdue"
  }
}
```

## System-Wide Impact

### Interaction Graph
- Task create → schedule notification → (on due date - 1 day) → OS fires notification → user taps → deep link to bike detail
- Task complete (from app or notification) → cancel notification → invalidate `maintenanceTasks.byMotorcycle` + `maintenanceTasks.allUser` → home widget & badge update
- App foreground → TanStack Query refetch → health score recalculated → badge count updated

### Error Propagation
- Notification scheduling failures are non-critical — silently log, don't block task creation
- "Mark Done" from notification while offline → queue locally, retry on next foreground (or show error banner)
- Health score computation is pure — cannot throw. Returns "No Data" state for edge cases.

### State Lifecycle Risks
- Scheduled notifications persist across app restarts but not across reinstalls
- Logout calls `queryClient.clear()` but must also call `Notifications.cancelAllScheduledNotificationsAsync()`
- Task deletion soft-deletes in DB but must also cancel the local notification

### API Surface Parity
- New `allMaintenanceTasks` query mirrors `maintenanceTasks(motorcycleId)` but without the motorcycleId filter
- No new mutations needed — existing complete/delete mutations are sufficient

## Acceptance Criteria

### Functional
- [ ] Health score ring displays animated gauge (0-100) on bike maintenance tab
- [ ] Health score shows "No Data" state when bike has zero tasks
- [ ] Home screen shows maintenance alerts widget with up to 3 urgent tasks
- [ ] Tapping a task in home widget navigates to bike detail maintenance tab
- [ ] Garage tab badge shows count of overdue + imminent tasks
- [ ] Badge clears when navigating to Garage tab
- [ ] Creating a task with due_date schedules a local notification 1 day before
- [ ] Completing/deleting a task cancels its scheduled notification
- [ ] Tapping notification opens bike detail maintenance tab
- [ ] "Mark Done" notification action completes the task
- [ ] "Snooze" reschedules notification for 1 day later
- [ ] Notification permission requested on first task with due_date
- [ ] All new strings translated to EN/ES/DE

### Non-Functional
- [ ] Health score computation < 5ms for 100 tasks
- [ ] SVG gauge animation runs at 60fps
- [ ] Home screen load time not increased by > 200ms
- [ ] Accessibility: gauge has accessibilityLabel with score
- [ ] Accessibility: urgency uses color + text (not color alone)

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| `expo-notifications` installation | Requires native rebuild (EAS Build) | Install early in Phase 6, test on device |
| Android notification channels | Must be configured in app.json | Add plugin config in Phase 6 |
| No `current_mileage` on motorcycles | Mileage-based urgency impossible | Phase 1 = date-only; mileage tracking = future feature |
| Custom IslandTabBar | Badge must be manually implemented | Simple overlay component |
| Multi-device notification sync | Notifications are local-only | Accept as known limitation |

## File Manifest

| # | File | Action | Phase |
|---|------|--------|-------|
| 1 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` | Edit | 1 |
| 2 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` | Edit | 1 |
| 3 | `apps/mobile/src/graphql/queries/all-maintenance-tasks.graphql` | Create | 1 |
| 4 | `apps/mobile/src/lib/query-keys.ts` | Edit | 1 |
| 5 | `apps/mobile/src/lib/health-score.ts` | Create | 2 |
| 6 | `apps/mobile/src/components/HealthScoreRing.tsx` | Create | 2 |
| 7 | `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | Edit | 3 |
| 8 | `apps/mobile/src/app/(tabs)/(home)/index.tsx` | Edit | 4 |
| 9 | `apps/mobile/src/components/TabBadge.tsx` | Create | 5 |
| 10 | `apps/mobile/src/app/(tabs)/_layout.tsx` | Edit | 5 |
| 11 | `apps/mobile/package.json` | Edit | 6 |
| 12 | `apps/mobile/app.json` | Edit | 6 |
| 13 | `apps/mobile/src/lib/notifications.ts` | Create | 6 |
| 14 | `apps/mobile/src/hooks/useNotificationListeners.ts` | Create | 6 |
| 15 | `apps/mobile/src/app/_layout.tsx` | Edit | 6 |
| 16 | `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` | Edit | 6 |
| 17 | `apps/mobile/src/i18n/locales/en.json` | Edit | 7 |
| 18 | `apps/mobile/src/i18n/locales/es.json` | Edit | 7 |
| 19 | `apps/mobile/src/i18n/locales/de.json` | Edit | 7 |

## Sources & References

- [Expo Notifications SDK](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Reanimated useAnimatedProps](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps/)
- [react-native-svg Usage](https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md)
- Existing patterns: `apps/mobile/src/components/BikeIcon.tsx` (SVG), `apps/mobile/src/components/progress-bar.tsx` (animated styles)
