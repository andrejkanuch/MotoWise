# Code audit — per-bike maintenance tasks

Date: 2026-10-01. Read-only audit of `main` at `965ad1de`. No app code changed.
Paths are relative to the repo root. "Mobile" = `apps/mobile/src`, "API" = `apps/api/src/modules`.

Every finding is marked **Confirmed** (read directly in code) or **Hypothesis** (inferred; needs data or a device to settle).

## 1. Verdict on the user feedback

| # | Feedback | Verdict |
|---|---|---|
| A | "Suzuki C90 page shows km instead of miles" | **Not reproducible as a per-bike bug from code.** Every unit label on bike detail and task screens comes from one per-user value. Three real km leaks exist, none of them per-bike. Most likely explanations listed below. |
| B | "I don't know what 786/600 km means" | **Confirmed, and it is not a maintenance string.** It is the Home "This month" card: distance ridden this month against a hardcoded 600 km goal. |
| C | "Two Critical tasks hidden until I tap see all; want manual reorder" | **Confirmed.** Priority is only a last-resort tiebreak, the preview is capped at 5, and no manual-order column exists. |
| D | "Section for random notes per bike/project" | **Confirmed absent for bikes.** Notes exist per task only. |

---

## 2. Feedback A — km shown to an imperial rider

### 2.1 How units work today (Confirmed)

- One source for every label: `useMileageUnit()` returns `'km' | 'mi'` from the user's `measurementSystem` in the auth store (`mobile/hooks/use-mileage-unit.ts:13-15`, `mobile/hooks/use-measurement-system.ts:5-7`).
- The per-bike `motorcycles.mileage_unit` column still exists and is still written at onboarding, but no garage screen reads it (`mobile/app/(tabs)/(garage)/bike/[id].tsx:76-78`, `bike-tasks.tsx:39-40`, `complete-task.tsx:64-65`).
- The store default is detected from device locale (`mobile/stores/auth.store.ts:14-22`, `:83`), then **overwritten by the server value** on every `me` fetch (`mobile/app/_layout.tsx:229-242`).
- The DB default for `users.measurement_system` is `'metric'` (`supabase/migrations/00049_add_measurement_system.sql:3-4`). Onboarding writes the chosen system afterwards, best-effort, in a `try/catch` that only logs on failure (`mobile/app/(onboarding)/personalizing.tsx:268-281`).
- Odometer, `target_mileage`, `completed_mileage` and user-entered `interval_km` are stored raw in the user's unit. Only OEM `interval_km` is true km.

Consequence: on bike detail, the task list, add, edit and complete screens, **two bikes of the same user cannot show different unit labels.** Places checked, all per-user:

| Surface | Location |
|---|---|
| Hero odometer chip | `bike/[id].tsx:642-644` |
| Odometer card and update prompt | `components/bike-hub/mileage-display.tsx:42-43`, `:104-106` |
| "COST / MI" stat | `components/bike-hub/bike-stats-row.tsx` (`costPerUnit` label) |
| Task row target mileage | `components/bike-hub/swipeable-task-card.tsx:170` |
| Completed row "@ 12,000 mi" | `swipeable-task-card.tsx:224-226` |
| Add task mileage and interval | `add-maintenance-task.tsx:669`, `:811` |
| Edit task mileage | `edit-maintenance-task.tsx:514` |
| Complete task odometer | `complete-task.tsx:271-273`, `:294` |
| Garage list | `(garage)/index.tsx:233`, `:515`, `:601`, `:759` |

### 2.2 Real km leaks found (Confirmed)

1. **Home "This month" card is hardcoded km** — value, goal, axis label and "km / day" (`components/home/focus-stats.tsx:57-59`, `:118`, `:178`, `:209`; strings `i18n/locales/en.json:168-171`). This is feedback B. It sits on Home directly under the primary bike hero.
2. **Complete-task "Schedule next" converts user intervals that are already in miles.** `convertIntervalDistance(task.intervalKm, system)` runs for every task regardless of `source` (`complete-task.tsx:385-390`). A user task "every 3,000 mi" displays as "In 1864 mi". The server does this correctly, converting only when `source === 'oem'` (`api/maintenance-tasks/maintenance-tasks.service.ts:484-487`), so the label lies but the next task is created with the right number. Only visible when the task has no `intervalDays`.
3. **OEM description text with literal km** for two models: Honda CB550 and Victory Vegas spark plugs (`supabase/migrations/00128_oem_schedules_normalize_and_expand.sql:1225`, `:1291`). Rendered verbatim as the task description (`swipeable-task-card.tsx:255-265`). No Suzuki row contains km text.

Minor, not on the bike page: onboarding sample copy "Oil change due in 200 km" (`en.json:922`); dead keys `maintenance.scheduleNextKm_*`, `garage.dotKm`, `garage.kmUnit`, `garage.mileageKm` (no code references).

### 2.3 Why this rider could see km (Hypotheses, ranked)

1. **Their account is `metric` in the DB.** If the onboarding write failed or they onboarded before it existed, the server value `'metric'` overwrites the locale-detected `'imperial'` on next launch. Every bike would then show km, not just the C90. Check `users.measurement_system` for this user — that one query settles it.
2. **They mean the Home card.** If the C90 is the primary bike, "the page for my C90" may be Home, where "786 / 600 km" is always km. A and B may be the same complaint.
3. **Stale numbers after a unit switch.** Changing the preference relabels every stored number without converting it (`components/profile/preferences-section.tsx:365-369` only sets the system). OEM `target_mileage` is computed once at import using the system at that moment (`api/oem-schedules/oem-schedules.service.ts:215-220`, `:240-242`). A bike whose OEM schedule was imported while the account was `metric` carries targets of `miles odometer + km interval`, inflated about 1.61x, now labelled "mi". This is the only mechanism that produces a per-bike difference, and it produces wrong numbers rather than a "km" label.

Could not confirm: any code path that prints "km" for one bike and "mi" for another under the same account on the current build.

---

## 3. Feedback B — "786/600 km"

**Confirmed.** Rendered by `FocusStats` (`mobile/components/home/focus-stats.tsx`), shown on Home when the focus tab is "stats" (`app/(tabs)/(home)/index.tsx:928`).

- **X (786)** = sum of `distanceM` for rides started this calendar month, divided by 1000 and rounded (`focus-stats.tsx:53-61`). Always kilometres.
- **Y (600)** = a literal `600` passed to `home.monthlyGoalSuffix` → `"/ {{goal}} km"` (`focus-stats.tsx:118`, `en.json:168`). Not user-set, not stored, not editable, not explained anywhere on the card.
- **X > Y**: the progress bar clamps at 100% (`focus-stats.tsx:163`). No "goal reached" state, no colour change, no overdue meaning. The number just exceeds the goal silently.
- The card has a month eyebrow ("OCT 2026") but no title saying it is ride distance; "goal" appears only in 10pt axis text (`:176-178`).
- X is computed from at most the 10 most recent rides (`components/home/use-home-data.ts:41`), so it undercounts for anyone with more than 10 rides in the month.
- Not converted for imperial users — value and label are both km.

Nothing in the maintenance UI renders an `X/Y km` string. Task rows show a single target odometer value, never progress.

---

## 4. Feedback C — Critical tasks hidden, manual reorder

### 4.1 Sort order (Confirmed)

Bike detail preview (`components/bike-hub/maintenance-section.tsx:56-74`) and full list (`bike-tasks.tsx:108-132`) use the same comparator, copy-pasted:

1. Full list "All" tab only: completed last (`bike-tasks.tsx:110-115`).
2. Overdue by date first.
3. Both have due dates → earlier date first. **Returns here even on a tie, so priority is never consulted between dated tasks.**
4. A task with a due date beats one without.
5. Only when neither has a due date: priority (`critical 0, high 1, medium 2, low 3` — `swipeable-task-card.tsx:26-31`).

`targetMileage`, `createdAt` and odometer proximity are not sort inputs. The API's own ordering is discarded by the client; it is also wrong on its face, since it orders the `priority` text column alphabetically — critical, high, low, medium (`api/maintenance-tasks/maintenance-tasks.service.ts:174-176`).

### 4.2 Truncation (Confirmed)

- Preview shows `activeTasks.slice(0, 5)`; "See all tasks (N)" appears only when there are more than 5 (`maintenance-section.tsx:97-100`, `:282-295`).
- The full list has no limit.

### 4.3 Why two Critical tasks vanish (Confirmed mechanism)

An OEM import creates up to about 10 recurring tasks, nearly all with a due date derived from `interval_days` (`oem-schedules.service.ts:236-238`). The Add form defaults the due date to none (`add-maintenance-task.tsx:78`). A hand-made Critical task without a date therefore sorts below every dated OEM task — "Tire Pressure Check, low, due in 14 days" outranks it — and lands past slot 5.

Related defects:

- **The overdue badge replaces the priority badge** (`swipeable-task-card.tsx:177-201`), so an overdue Critical task and an overdue Low task look identical.
- **Deep links to a hidden task do nothing.** Home's task cards navigate with `highlightTask` (`(home)/index.tsx:849-856`); the section sets `expandedId` (`maintenance-section.tsx:42-47`) but if the task is outside the top 5 it is not rendered, and there is no scroll-to.
- The full list has no priority filter (All / Overdue / Upcoming / Completed only — `bike-tasks.tsx:172-177`).

### 4.4 Manual order (Confirmed absent)

`maintenance_tasks` has no ordering column (`packages/types/src/database.types.ts`, `maintenance_tasks.Row`). `sort_order` exists only on `oem_maintenance_schedules` (`00022:24`) and on task line items (`00170:39`); it is not copied to tasks on import. No reorder mutation, no drag UI. Manual reorder needs a migration, an API field plus mutation, and a client change.

---

## 5. Feedback D — notes per bike

- **Tasks: yes.** `maintenance_tasks.notes TEXT` (`00020:12`), exposed in the GraphQL model and create/update inputs, editable in add and edit (`add-maintenance-task.tsx:931-949`, `edit-maintenance-task.tsx:570-588`), shown on the card.
- **Bikes: no.** `motorcycles` has no notes column (`database.types.ts`, `motorcycles.Row`). It has an unused-for-this `metadata Json` column. No notes field in the motorcycles API model or DTOs, none in `bike-details-card.tsx` or `edit-bike.tsx`.
- No "project" entity exists at all.

Nearest existing surfaces: per-task `notes` and `description`, and the Documents vault. A bike notes section is net-new across DB, API and UI.

---

## 6. Task data model (Confirmed)

Table `maintenance_tasks`; selected columns in `api/maintenance-tasks/maintenance-tasks.service.ts:44-75`.

| Group | Fields |
|---|---|
| Identity | `id`, `user_id`, `motorcycle_id`, `title`, `description`, `notes`, `parts_needed[]` |
| Schedule | `due_date` (DATE), `target_mileage` (INT, raw user unit) |
| Priority | `low`, `medium` (default), `high`, `critical` — CHECK constraint (`00020:10`) |
| Status | `pending` (default), `in_progress`, `completed`, `skipped` — CHECK constraint (`00020:11`) |
| Completion | `completed_at`, `completed_mileage` |
| Money | `cost`, `parts_cost`, `labor_cost`, `total_amount`, `tax_amount`, `tax_rate`, `currency` |
| Recurrence | `is_recurring`, `interval_km`, `interval_days` |
| Provenance | `source` (`user`, `oem`, `imported`, `receipt_scan`), `oem_schedule_id` |
| Reminders | `remind_30d`, `remind_7d`, `remind_1d` (default on) |
| Children | photos, line items (service type, label, total, `sort_order`) |
| Lifecycle | `created_at`, `updated_at`, `deleted_at` (soft delete via RPC) |

Recurrence: completing a recurring task inserts a new pending task. Next due date = completion time + `interval_days`; next target = `completed_mileage` + interval, and only if a completion odometer was entered (`service.ts:459-489`). The new task copies title, description, priority, source and intervals, but **not `notes` or `parts_needed`** (`:497-511`).

Unreachable states: nothing in mobile can set `in_progress` or `skipped`. The update input has no `status` field (`api/maintenance-tasks/dto/update-maintenance-task.input.ts`).

---

## 7. Task states and how each renders

All rendering is in `swipeable-task-card.tsx`. Despite the name, it has no swipe gestures.

| State | Rendering |
|---|---|
| Pending, future date | Title, one line of notes, calendar line "Due in N days", gauge line with target odometer, priority pill (`:128-173`, `:200`) |
| Pending, due today / tomorrow | Same, with "Due today" / "Due tomorrow" (`lib/health-score.ts:133-138`) |
| Overdue by date | Red-tinted card, red left border, red date text, "OVERDUE" pill **instead of** priority (`:89-99`, `:177-198`) |
| Past target mileage | **No state.** Target is never compared with the bike's odometer on the card. Only the API's post-ride check does this (`api/rides/rides.service.ts:570-575`) |
| No date and no mileage | Title and priority pill only |
| Completed | Strikethrough grey title, green row with date, "@ odometer", total cost (`:132-137`, `:211-241`). No priority pill |
| `in_progress` | Treated exactly as pending |
| `skipped` | Hidden on bike detail (matches neither tab filter, `maintenance-section.tsx:57`, `:88`). In the full list "All" tab it renders as an active task with a Done button |
| Recurring | **No indicator** on the card. Only visible as the "Schedule next" toggle on the complete sheet |
| OEM vs user | **No indicator** on the card. `source` is fetched but not shown |
| Expanded | Description, notes (again), parts needed, line items, photo gallery, then Done / Edit / Delete (`:244-470`). Completed tasks get Delete only |

Empty states: no tasks at all (`maintenance-section.tsx:110-139`), "All caught up!" / "No completed tasks yet" per tab (`:258-260`), and four per-filter messages in the full list (`bike-tasks.tsx:179-202`).

---

## 8. Screens and flow

| Screen | File | Presentation |
|---|---|---|
| Bike detail, Maintenance section | `bike/[id].tsx:845-856` → `maintenance-section.tsx` | Section 4 of a long scroll, below hero, quick actions, scan entry, stats, Service Report and Documents cards |
| All Tasks | `bike-tasks.tsx` | Pushed card, title "All Tasks" |
| Add task (Plan / Log) | `add-maintenance-task.tsx` | formSheet, 0.85 / 1.0 detents |
| Edit task | `edit-maintenance-task.tsx` | formSheet |
| Complete task | `complete-task.tsx` | formSheet, 0.65 / 0.85 / 1.0, no header |

Flow:

- **Add**: quick-action button (`bike-quick-actions.tsx:41-48`) or "Log past work" in the More sheet (`bike/[id].tsx:411-418`). Plan mode creates a pending task; Log mode creates a completed record dated in the past. There is no add button on the All Tasks screen.
- **View**: tap a card to expand inline. There is no task detail screen.
- **Edit**: expand → Edit. Pending tasks only.
- **Complete**: expand → Done → sheet asking odometer and cost, with a "Schedule next" toggle for recurring tasks → auto-dismiss after 800 ms.
- **History**: "History" tab on bike detail (5 newest) or "Completed" filter on All Tasks. A completed task with cost auto-creates a linked expense (`service.ts:256-281`); expense detail links back to All Tasks with the task expanded (`expense-detail.tsx:151`).
- **Delete**: expand → Delete → native alert.
- **OEM import**: More sheet → "Import OEM Schedule" (`bike/[id].tsx:360-397`), or automatically at onboarding.

---

## 9. Structural UX problems visible in code

### Duplication and inconsistency

1. **Add and Edit are two near-identical 650–1,000 line screens.** Priority selector, schedule card, date picker, details card and footer are copy-pasted (`add-maintenance-task.tsx:370-452` vs `edit-maintenance-task.tsx:242-319`, and so on). `PRIORITIES` and `PRIORITY_META` are declared in both.
2. **Two list UIs with different vocabularies.** Bike detail uses a segmented "Active / History" control; All Tasks uses "All / Overdue / Upcoming / Completed" pills. Sort logic is duplicated.
3. **Priority colours disagree.** Forms: medium = primary blue, high = warning (`add-maintenance-task.tsx:39-44`). Card pill: medium = info, high = copper (`components/ui/editorial.tsx:346-351`).
4. **Complete sheet uses a different visual system** from Add and Edit: no editorial header, `palette.neutral*` instead of editorial theme tokens, primary-blue CTA instead of copper, hardcoded `rgba()` (`complete-task.tsx:144-146`, `:238`, `:302`, `:413`).
5. **Two delete-error strings and uneven analytics.** `maintenance.deleteError` on bike detail vs `maintenance.deleteFailed` on All Tasks; only bike detail tracks `MAINTENANCE_TASK_DELETED` (`bike/[id].tsx:184` vs `bike-tasks.tsx:66-72`).
6. **Entry-point parameters differ.** Completing from All Tasks omits `currentMileage`, so the "Current: 12,345 mi" hint is missing there (`bike-tasks.tsx:140-145` vs `bike/[id].tsx:293-302`).

### Capability gaps

7. **Edit cannot change recurrence.** No repeat toggle or interval fields, and the API update input has none either. A recurring task's cadence is fixed at creation.
8. **Completed records are not editable.** Edit is hidden for completed tasks (`swipeable-task-card.tsx:427`). A wrong cost, date or odometer can only be fixed by deleting and re-logging.
9. **Complete always stamps "now".** No completion date field (`service.ts:347-350`), and no notes field on the sheet. Backdating exists only in Add → Log.
10. **Completing with an odometer does not update the bike's odometer.** Nothing in the maintenance module writes `motorcycles.current_mileage`.
11. **Mileage-based tasks never look due.** Overdue is date-only everywhere on the client, including the health score input (`bike/[id].tsx:212-219`).
12. **Target mileage has no context.** The row shows an absolute odometer value with no "in 400 mi" relative to the current reading.
13. **Mileage-only recurring tasks break the chain silently** if the rider skips the optional odometer on completion: the next task is created with no target and no date (`service.ts:476-489`).

### Form length and copy

14. **Add (Plan mode) is long:** mode switch, title, 4-way priority, date, mileage, repeat toggle with two interval fields, description, notes — six sections, with the title auto-focused so the keyboard covers most of it.
15. **Description and notes overlap.** Placeholders are "What needs to be done?" and "Add any notes..."; notes then render twice on an expanded card (`swipeable-task-card.tsx:142-149` and `:267-292`).
16. **`parts_needed` is displayed but cannot be entered** in either form.
17. **Reminder stages (30d / 7d / 1d) have no UI.** Flags exist end to end but nothing sets them.
18. **Hardcoded English:** priority pill labels (`editorial.tsx:347-350`) and `humanizeInterval` ("~6 months") on the complete sheet (`complete-task.tsx:39-49`).
19. **Label drift:** the interval field's i18n key is `maintenance.everyKm` with the text "Distance interval"; the same `targetMileage` key defaults to "Target mileage" in Add and "Mileage" in Edit.

### Information architecture

20. **Maintenance is far down bike detail** — below seven other blocks — and the preview's five slots are usually filled by OEM boilerplate.
21. **No inline add** in the Maintenance section header or on All Tasks; the only add entry is the quick-action row near the top.
22. **The OEM disclaimer card sits permanently under the list** (`bike/[id].tsx:858-861`), even when the bike has no OEM tasks.

---

## 10. What would settle the open questions

- **A**: read `users.measurement_system` for the reporting user, and the `source`, `target_mileage` and `created_at` of the C90's tasks against the bike's `current_mileage`. A screenshot of the page they mean would separate hypothesis 1 from 2.
- **C**: count of this user's active tasks with and without `due_date` on the affected bike.
