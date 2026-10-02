# Bike detail — code audit: information architecture

Date: 2026-10-01 · Scope: `apps/mobile` on `main` (965ad1de) · Read-only audit, no app code changed.

All paths are relative to `apps/mobile/src/`. "Bike detail" = `app/(tabs)/(garage)/bike/[id].tsx`.

Abbreviations used for files:

| Short | File |
|---|---|
| `[id]` | `app/(tabs)/(garage)/bike/[id].tsx` |
| `layout` | `app/(tabs)/(garage)/_layout.tsx` |
| `garage` | `app/(tabs)/(garage)/index.tsx` |
| `dash` | `app/(tabs)/(garage)/expense-dashboard.tsx` |
| `health` | `app/(tabs)/(garage)/health-report.tsx` |
| `tasks` | `app/(tabs)/(garage)/bike-tasks.tsx` |
| `hub/*` | `components/bike-hub/*` |

---

## 1. Section inventory (exact render order)

The screen is one vertical `ScrollView` (`[id]:473-890`) with the native header hidden (`layout:35-41`). There are no tabs, no sticky header and no anchors other than one programmatic scroll-to for Documents (`[id]:117-120`). 13 stacked blocks:

| # | Block | Data shown | States / conditions | Source |
|---|---|---|---|---|
| 0 | Screen-level states | Full-screen spinner while bikes load; plain "Not found" text if the id is not in `myMotorcycles` (no back button in either state — header is hidden) | `isLoading && !data`; `!bike` | `[id]:433-464` |
| 1 | **Hero photo** (320pt, full-bleed) | Bike photo or "Add Photo" placeholder; two gradients; upload overlay | The *entire hero* is a `Pressable` that opens the photo action sheet (`[id]:484`); no photo viewer | `[id]:482-602` |
| 1a | Top bar (overlaid on hero) | Back pill with hardcoded label "Garage"; camera button (same action as tapping the hero) | Camera button hidden while uploading | `[id]:551-599` |
| 2 | **Bike meta** (overlaps hero by -40) | Year · "nickname"; Make *Model* (serif 36); odometer pill; "% ready" pill | "% ready" pill only when `tasks.length > 0 && healthScore.hasData`; colour thresholds 75/40; pill is not tappable | `[id]:604-685` |
| 2a | `MileageDisplay` | Odometer again (same number as the pill directly above) + "Updated Nd ago"; tap = edit odometer | Uses `Alert.prompt` (iOS-only API) | `[id]:687-693`, `hub/mileage-display.tsx:37-76,104-108` |
| 3 | **Quick actions** row | Add task (copper, flex 2) · Expense (flex 1.5) · Edit (icon-only pencil) · More (icon-only ⋯) | — | `[id]:696-702`, `hub/bike-quick-actions.tsx:40-136` |
| 4 | **Scan a receipt** entry | Title/subtitle; "N free" badge or upsell badge or chevron | Free with scans left → badge; free exhausted → press opens paywall; Pro → chevron | `[id]:704-707`, `features/receipt-scan/receipt-scan-entry.tsx:43-56,101-139` |
| 5 | **Stats row** (3 cards) | COST / KM (all-time expenses ÷ odometer) · RIDES (count) · ANALYTICS "View →" | Cost shows "—" when no mileage or no expenses; only the third card is tappable; no loading state (renders 0 / "—" until queries resolve) | `[id]:709-717`, `hub/bike-stats-row.tsx:58-102` |
| 6 | **Service Report** card | Static title + subtitle "Maintenance history, expenses & condition overview"; chevron | Always shown; no status, no score, no gating. Code comment still says "AI Health Report — contextual paywall trigger" | `[id]:719-776` |
| 7 | **Documents entry** card | "Documents"; "N stored · N expiring" or a static hint when 0 | Tap does **not** navigate — it scrolls to block 11 | `[id]:778-842` |
| 8 | **Maintenance** section | Header (serif italic 24) + red overdue-count badge; Active (n) / History (n) segmented control; max 5 task cards; "See all tasks (n)" | `tasks.length === 0` → non-tappable empty state with no header and no CTA (`hub/maintenance-section.tsx:110-139`); empty tab → "All caught up!" / "No completed tasks yet"; "See all" only when the current tab has > 5 (`:97-100,282-295`); no loading state; no add button in the header | `[id]:844-856`, `hub/maintenance-section.tsx` |
| 8a | Task card (expandable) | Title, notes, relative due date, target mileage, priority/overdue badge; completed: date @ mileage + total; expanded: description, notes, parts, line items, photo gallery, Done / Edit / Delete | Edit + Done hidden for completed tasks. Component is named `SwipeableTaskCard` but contains no gesture code | `hub/swipeable-task-card.tsx:103-208,244-471` |
| 9 | **OEM disclaimer** card | Amber "informative only" warning | Rendered unconditionally — also when the bike has zero tasks | `[id]:858-861` |
| 10 | **Expenses** section | Header (sans 18/700) + period total; year pill; insights icon; "+" icon; category segment bar + legend; max 5 expense rows; inline "See all (n)" / "Show less" | Loading → spinner card; empty → tappable card → add-expense; bar only when total > 0; year pill is a 2-state toggle (current year ⇄ All Time) drawn with a dropdown chevron (`hub/expenses-section.tsx:98-104,141-167`) | `[id]:863-871`, `hub/expenses-section.tsx` |
| 11 | **Documents** section | Header (sans 18/700) + manage-categories icon + "+" icon; "Pinned" group; groups per category; "Show hidden categories" toggle | Loading → spinner card; empty → tappable card → add-document; no cap on rows; row long-press = delete (undiscoverable) | `[id]:873-886`, `hub/documents-section.tsx` |
| 12 | **Details** card (collapsed by default) | Make, Model, Year, Nickname, Primary yes/no, Purchase price, Purchase date | Read-only; VIN is not shown although `edit-bike` stores it (`edit-bike.tsx:91,154`) | `[id]:888-889`, `hub/bike-details-card.tsx:58,102-134` |

Notes on the fold: blocks 1–3 consume the hero (320) + meta + mileage chip + action row before any analytic value appears; the first analytics entry ("ANALYTICS / View →") is the third card in block 5, styled identically to two non-tappable siblings.

Pro gating on this screen: **none** except the scan-quota paywall in block 4. Health report, analytics, documents and recalls are all ungated in the client code read.

---

## 2. Navigation map

### 2.1 Every tappable element on bike detail

| Element | Destination | Presentation | Source |
|---|---|---|---|
| Back pill "Garage" | `router.back()` | pop | `[id]:562-581` |
| Hero photo (whole area) / camera button | Action sheet: Take Photo / Choose from Library | action sheet | `[id]:247-288,484,583-597` |
| Mileage chip | `Alert.prompt` → update odometer | system alert (iOS-only API) | `hub/mileage-display.tsx:37-76` |
| Add task | `/(tabs)/(garage)/add-maintenance-task` | formSheet | `hub/bike-quick-actions.tsx:40-48`, `layout:55-67` |
| Expense | `/(tabs)/(garage)/add-expense` | formSheet | `hub/bike-quick-actions.tsx:66-74`, `layout:94-106` |
| Edit (pencil) | `/(tabs)/(garage)/edit-bike` | card push | `hub/bike-quick-actions.tsx:94-102`, `layout:81-93` |
| More (⋯) | Action sheet ↓ | action sheet | `[id]:399-425` |
| More → Log past work | `add-maintenance-task?mode=log` | formSheet | `[id]:411-418` |
| More → Documents | scroll to block 11 | in-page scroll | `[id]:419` |
| More → Check Safety Recalls | `/(modals)/recalls` | formSheet (root modal stack) | `[id]:340-357,420`, `app/(modals)/_layout.tsx:72-75` |
| More → Import OEM Schedule | mutation + result alert | none | `[id]:360-397,421` |
| More → Delete Motorcycle | confirm alert → delete → back | alert | `[id]:223-245,422` |
| Scan a receipt | `/(modals)/scan-receipt` or paywall | fullScreenModal | `receipt-scan-entry.tsx:46-56` |
| ANALYTICS "View →" card | `/(tabs)/(garage)/expense-dashboard` | card push | `hub/bike-stats-row.tsx:83-95` |
| Service Report card | `/(tabs)/(garage)/health-report` | default push | `[id]:724-737`, `layout:147-158` |
| Documents entry card | scroll to block 11 | in-page scroll | `[id]:784-785` |
| Maintenance Active / History | local tab state | — | `hub/maintenance-section.tsx:203-208` |
| Task card | expand/collapse inline | — | `hub/swipeable-task-card.tsx:103-107` |
| Task → Done | `/(tabs)/(garage)/complete-task` | formSheet, header hidden | `[id]:290-305`, `layout:159-168` |
| Task → Edit | `/(tabs)/(garage)/edit-maintenance-task` | formSheet | `[id]:307-316` |
| Task → Delete | confirm alert | alert | `[id]:318-337` |
| See all tasks (n) | `/(tabs)/(garage)/bike-tasks` | default push | `hub/maintenance-section.tsx:102-108` |
| Expenses: year pill | toggle current year ⇄ all time | — | `hub/expenses-section.tsx:98-104` |
| Expenses: bar-chart icon (28×28, no label) | `expense-dashboard` | card push | `hub/expenses-section.tsx:170-196` |
| Expenses: "+" icon / empty card | `add-expense` | formSheet | `hub/expenses-section.tsx:199-221,243-252` |
| Expense row tap | `/(tabs)/(garage)/expense-detail` | card push | `components/shared/swipeable-expense.tsx:59-70` |
| Expense row swipe-left / long-press | delete confirm | alert | `swipeable-expense.tsx:72-108` |
| Expenses: See all (n) | expands inline (no screen) | — | `hub/expenses-section.tsx:396-423` |
| Documents: settings icon | `manage-document-categories` | fullScreenModal | `hub/documents-section.tsx:160-164`, `layout:189-200` |
| Documents: "+" icon / empty card | `add-document` | fullScreenModal | `hub/documents-section.tsx:178-186,221-228`, `layout:169-180` |
| Document row tap | `document/[id]` | fullScreenModal, header hidden | `hub/documents-section.tsx:128-137`, `layout:181-188` |
| Document row long-press | delete confirm | alert | `hub/documents-section.tsx:108-126,382` |
| Show/Hide hidden categories | local toggle | — | `hub/documents-section.tsx:297-308` |
| Details header | expand/collapse | — | `hub/bike-details-card.tsx:65-69` |

### 2.2 Tap counts starting from the Garage tab (bike list visible, tap on bike card = tap 1)

| Destination | Taps | Shortest path | Other paths |
|---|---|---|---|
| Expense analytics | 2 | bike → "ANALYTICS / View →" stat card | bike → scroll ~2 screens → unlabeled bar-chart icon in Expenses header (2 + scroll) |
| Health / Service report | 2 | bike → Service Report card | none |
| Full task list (`bike-tasks`) | 2 + scroll, **conditional** | bike → scroll → "See all tasks" | Link only exists when the visible tab has > 5 tasks. Otherwise the only route is expense-detail → "service record" link (`expense-detail.tsx:146-155`), i.e. 4 taps and only for expenses linked to a task |
| Documents (list) | 2 | bike → Documents card (scrolls) | bike → More → Documents (3, also scrolls); or scroll manually |
| A specific document | 3 | bike → Documents card → row | 1 tap from the Garage list when it is expiring (`components/garage/document-expiry-alerts.tsx:44-57`, shelf view only) |
| Recalls | 3 | bike → More (⋯) → Check Safety Recalls | **Only path in the app** (only `router` reference to `/(modals)/recalls` is `[id]:351`) |
| Edit bike | 2 | bike → pencil icon (icon-only, no label) | Dashboard "add purchase price" hint (`dash:753-761`) when price is missing |
| Add expense | 2 | bike → Expense | Expenses "+" / empty card; dashboard empty state; Home quick action (1 tap from Home) |
| Add task | 2 | bike → Add task | none on this screen; Maintenance section has no "+" and its empty state is not tappable |
| Log past work | 3 | bike → More → Log past work | bike → Add task → mode toggle inside the form (`add-maintenance-task.tsx:288-293`) |
| Import OEM schedule | 3 | bike → More → Import OEM Schedule | **Only path** |
| Delete bike | 3 | bike → More → Delete (simple confirm) | bike → Edit → scroll to bottom → Delete (type-the-name confirm on iOS, `edit-bike.tsx:370-414,1166`) |
| Manage document categories | 2 + scroll | bike → scroll → settings icon | **Only path** |

Destinations with a single, obscure path: **recalls**, **OEM import**, **manage document categories**, **full task list with filters** (conditional), and the **bar-chart icon** as the only analytics entry near the expense data itself.

### 2.3 Entry points *into* bike detail

| From | Mechanism | Source |
|---|---|---|
| Garage list (shelf card / grid cell) | `router.push` | `garage:346-349,651-654` |
| Home hero bike card | `router.navigate` (cross-tab) + `_ts` | `app/(tabs)/(home)/index.tsx:383-393` |
| Home upcoming task / priority card | `router.navigate` + `highlightTask` | `home/index.tsx:849-858`, `components/home/use-home-data.ts:207-216,233-242` |
| Profile → account section bike row | `router.push('/(garage)/bike/…')` | `components/profile/account-section.tsx:402-405` |
| Push notification | `router.push` | `hooks/use-notification-deep-link.ts:8-13` |
| What's New CTA | `router.push` | `app/(modals)/whats-new.tsx:76-81` |

The back pill always reads "Garage" (`[id]:579`) regardless of which of these opened the screen.

---

## 3. Expense dashboard: entry points and contents

### 3.1 Every entry point in the app

| # | Entry | Visibility | Params passed | Source |
|---|---|---|---|---|
| 1 | Bike detail stats row, third card "ANALYTICS / View →" | Looks like its two static neighbours; only copper text hints it is a link | `motorcycleId`, `currentMileage`, `mileageUnit` | `hub/bike-stats-row.tsx:83-102` |
| 2 | Bike detail Expenses header, bar-chart icon | 28×28 icon, no label, no accessibility label, below Maintenance | same | `hub/expenses-section.tsx:170-196` |
| 3 | Home onboarding checklist item "Track first expense" | Only while the checklist is shown; always the **first** bike | `motorcycleId` only — no `currentMileage`, so COST/KM renders "—" (`dash:436,456-457`) | `components/home/onboarding-checklist.tsx:149-166` |

`GARAGE_ROUTE.EXPENSE_DASHBOARD` in `stores/checklist.store.ts:58` is a documentation fallback, not a live route call. There is **no** entry from the tab bar, the Garage list, the Home screen (outside the checklist), the Profile tab, expense-detail, or the add-expense success path. Home's "Expenses" quick action opens **add-expense**, not analytics (`home/index.tsx:762-774`). The iOS home-screen quick action "Add Expense" lands on the Garage list root (`app/_layout.tsx:837-842`).

### 3.2 What the dashboard contains (`dash`)

Scope: **one bike only.** `motorcycleId` is a required route param (`dash:267-270`); there is no all-bikes view, no bike switcher, and no cross-bike aggregate anywhere in the app.

Render order:

1. Native header "Expense Insights" (`layout:122-134`) **plus** an in-content eyebrow repeating "Expense Insights" and the bike name (`dash:494-519`).
2. Period selector — This Year / Last Year / All Time; the only filter (`dash:521-565`).
3. Hero total for the period; YoY delta line (This Year only); top-category pill (`dash:567-669`).
4. Total Cost of Ownership card — purchase + all expenses, split into purchase / all expenses / invested / running costs; always all-time. If no purchase price: a hint row linking to edit-bike (`dash:671-788`).
5. Three summary pills: AVG/MO · ENTRIES · COST/KM (`dash:790-800`, `components/expense-dashboard/summary-cards.tsx:27-43`).
6. "By category" — `CategoryDonut`, which is actually a horizontal proportional bar + tappable legend rows, not a donut (`components/expense-dashboard/category-donut.tsx:52-60,91-92`).
7. Category drill-down list (appears on legend tap): description, date, amount; rows are not tappable (`dash:836-938`).
8. "Monthly trend" — stacked bar chart per month by category (`dash:940-954`, `components/expense-dashboard/monthly-trend.tsx`).

States: spinner (`dash:368-381`), error + retry (`dash:383-429`), empty state with 3 quick-add category chips, "Add first expense" CTA and receipt-scan entry (`dash:100-264,432-434`).

Not present: date-range filter, category filter on the trend, per-month drill-down, expense list / search, export, add-expense button on the populated dashboard, link back to individual expense detail, comparison between bikes.

### 3.3 Data-consistency facts a redesign should know

- "All Time" trend and category breakdown use only the **most recent 12 monthly buckets** (`hooks/use-expense-dashboard.ts:47-53,69-82`) while the hero total uses the true all-time total (`:64-65`); category percentages are computed against the all-time total (`category-donut.tsx:37-39`), so for bikes with > 12 months of history they do not sum to 100%.
- The category drill-down list is always all-time (`year: 0`), regardless of the selected period (`dash:301-313`), so its "(n)" count can disagree with the period shown above it.
- YoY compares this year-to-date against the *full* previous year (`dash:452-454`).
- AVG/MO divides by months that have spend, not calendar months (`dash:438-443`).
- COST/KM = all-time expenses ÷ **odometer reading** (`dash:456-457`, same on bike detail `hub/bike-stats-row.tsx:58-59`), not distance ridden while owned.
- `dash` and `health` both cache `ExpensesByMotorcycle` under the same bare key `['expenses','byMotorcycle',id]` with different variables — `year: 0` (`dash:302-303`) vs current year (`health:66-72`). Whichever screen runs first determines what the other reads within the stale window.
- Several dashboard strings bypass i18n (`dash:49-53,468-475`; `summary-cards.tsx:29,33`).

---

## 4. Structural problems seen in code

### 4.1 Duplicated information

- **Odometer shown twice, 40pt apart**: pill (`[id]:641-645`) and `MileageDisplay` (`[id]:687-693`). A third edit path lives in edit-bike (`edit-bike.tsx:977-991`).
- **Identity shown three times**: meta block (`[id]:609-625`), Details card make/model/year/nickname (`hub/bike-details-card.tsx:102-110`), edit-bike form.
- **Documents appear twice on the same scroll**: entry card (`[id]:780-842`) and full section (`[id]:873-886`), plus a third "Documents" item in the More sheet (`[id]:419`). All three resolve to the same scroll position.
- **Expense total in three shapes**: COST/KM (all-time, block 5), Expenses header total (current year by default, block 10), and the dashboard hero — three periods, none labelled on the bike detail except via the year pill.
- **Category breakdown bar** is drawn on bike detail (`hub/expenses-section.tsx:299-376`) and again on the dashboard (`category-donut.tsx`), with different period semantics.
- **Add expense has four triggers on one screen**: quick action, scan entry, Expenses "+", Expenses empty card.
- **Delete bike has two paths with different safety levels**: More sheet = one confirm (`[id]:223-245`); edit-bike = type-the-name on iOS (`edit-bike.tsx:370-414`).
- `HEALTH_REPORT_VIEWED` fires twice per visit with different property names: on card tap (`motorcycle_id`, `[id]:727-732`) and on screen mount (`bike_id`, `health:44-48`).

### 4.2 Mixed concerns / unclear grouping

- The order interleaves actions, promos, stats, links, lists and reference data with no grouping: actions (3) → feature promo (4) → stats (5) → link card (6) → scroll-anchor card (7) → list (8) → legal notice (9) → list (10) → list (11) → reference (12).
- Blocks 6 and 7 are visually identical cards with chevrons, but one pushes a screen and the other scrolls the page (`[id]:724-737` vs `:784-785`).
- The stats row mixes two read-only numbers with one navigation link in the same card style (`hub/bike-stats-row.tsx:66-102`).
- "Health" means three unrelated things: the "% ready" pill (client-computed readiness from due dates, `[id]:211-219`), the "Service Report" card (PDF generator), and the screen file/route/analytics still named `health-report`. The Service Report screen shows **no score, no charts and no on-screen analysis** — only generate / download-PDF / past-reports rows (`health:200-433`). The card subtitle promises "Maintenance history, expenses & condition overview" (`[id]:769-771`).
- Generate is disabled until ≥ 3 tasks or ≥ 3 expenses (current year only) (`health:32,76-82`), but the entry card gives no hint of that.
- The OEM disclaimer sits between Maintenance and Expenses as a standalone card and renders even with no tasks (`[id]:858-861`).

### 4.3 Competing primary actions

- "Add task" is the only copper-filled button and the widest (`hub/bike-quick-actions.tsx:50-54`), while product data ranks expenses above maintenance; "Expense" is a secondary outline.
- Directly beneath, the copper-tinted Scan-a-receipt banner competes for the same attention (`receipt-scan-entry.tsx:72-74`).
- Section-level add buttons use different colours: Expenses "+" is blue `primary500` (`hub/expenses-section.tsx:215`), Documents "+" is copper `theme.warm` (`hub/documents-section.tsx:193`), Maintenance has none.
- Edit and More are unlabeled 48×48 icons (`hub/bike-quick-actions.tsx:94-136`); six distinct functions hide behind More.

### 4.4 Inconsistent headers, typography and theming

- Section titles: Maintenance = InstrumentSerif-Italic 24 (`hub/maintenance-section.tsx:153-161`); Expenses and Documents = sans 18/700 (`hub/expenses-section.tsx:118-125`, `hub/documents-section.tsx:150-158`).
- Two colour systems on one screen: the screen, quick actions, stats and Documents use the editorial theme (`theme.surface/ink/warm`); Maintenance, task cards, Expenses, MileageDisplay and `bike-tasks` use raw `palette.neutral*` + blue `primary500` (`hub/maintenance-section.tsx:187,291`, `hub/expenses-section.tsx:89,195,215,413`, `hub/mileage-display.tsx:89,95`, `tasks:205,228`).
- Sub-screen headers: bike detail = hidden header + custom back pill; dashboard = native header + duplicate in-content title; health report = native header + bike header card; `bike-tasks` = native "All Tasks" with no bike name anywhere on the screen (`layout:135-146`, `tasks:204-251`).
- List truncation behaves three ways: tasks "See all" pushes a screen; expenses "See all" expands inline; documents are never truncated.
- Row interaction differs per list: tasks expand inline with action buttons; expenses push a detail screen and swipe/long-press to delete; documents open a full-screen modal and long-press to delete.

### 4.5 Modal vs push inconsistencies

| Flow | Presentation | Source |
|---|---|---|
| Add task / edit task / complete task / add expense | formSheet | `layout:55-80,94-106,159-168` |
| Add document / document detail / manage categories | fullScreenModal | `layout:169-200` |
| Edit bike | card push with header Save | `layout:81-93`, `edit-bike.tsx:491-493` |
| Expense detail / dashboard / task list / health report | push | `layout:107-158` |
| Recalls | formSheet in the root `(modals)` stack | `app/(modals)/_layout.tsx:72-75` |
| Scan receipt | fullScreenModal in the root stack | `app/(modals)/_layout.tsx:20-30` |
| Odometer edit | system `Alert.prompt` | `hub/mileage-display.tsx:39` |

Three "add an object to this bike" flows use two different presentations; viewing a document is a modal while viewing an expense is a push.

### 4.6 Dead, hidden or broken features

- `components/health-score-ring.tsx` (`HealthScoreRing`) and `components/garage/health-report-card.tsx` (`HealthReportCard`) have **zero importers** — a ready-made visual health ring exists but is not rendered anywhere.
- Odometer chip uses `Alert.prompt`, which is iOS-only; no platform branch (`hub/mileage-display.tsx:37-76`). On Android the chip's edit path cannot work; edit-bike is the fallback.
- `highlightTask` deep link (from Home / notifications) only sets the expanded id (`hub/maintenance-section.tsx:42-47`); the list is capped to the first 5 active tasks (`:97-98`) and nothing scrolls to the Maintenance section, so the highlighted task can be off-screen or not rendered at all.
- Full task list filters (Overdue / Upcoming / Completed, `tasks:172-177`) are unreachable for bikes with ≤ 5 tasks per tab. `bike-tasks` has no add-task button, and "Done" from there omits `currentMileage` and passes an empty `bikeName` because "See all" does not forward it (`hub/maintenance-section.tsx:104-107`, `tasks:140-145` vs `[id]:293-302`).
- No edit path for an expense was found in `expense-detail.tsx` (delete only, `:575`).
- Garage list: the ⋯ badge on each shelf card is a non-interactive `View` (`garage:427-443`); "Open tasks" in "By the numbers" is hardcoded to "—" (`garage:610`); "Sorted by primary" is a static label (`garage:330`); expiry alerts and "By the numbers" exist only in shelf view, not grid (`garage:333-639` vs `:640-790`). The list shows no health or cost signal per bike.
- Pull-to-refresh on bike detail does not refresh documents (`[id]:127-144`).
- Loading / not-found states on bike detail have no back affordance (`[id]:433-464`).
- Stale comment: "AI Health Report — contextual paywall trigger" (`[id]:719`); no paywall exists on that path.
- VIN is editable (`edit-bike.tsx:91`) and drives recalls, but is not displayed on bike detail.

---

## 5. IA questions a designer must decide

1. **Hub or dashboard?** Is bike detail a launcher into four areas (Maintenance, Costs, Documents, Info) or one long page that inlines all of them? Today it is both.
2. **Segmentation model**: top-level tabs/segments per area, collapsible sections, or dedicated sub-screens with summary tiles — and does each area get a real "see all" screen (expenses and documents have none)?
3. **Where do analytics live?** Per-bike only (today), or also an all-bikes cost view reachable from the Garage list / Home / tab level? Should the dashboard have a bike switcher?
4. **What is "health"?** One concept or three: the readiness %, an on-screen health/condition view (the unused ring exists), and the PDF Service Report. Which gets the name, and does the readiness pill link anywhere?
5. **Single primary action**: add task, add expense, or scan receipt — and is it per-screen or contextual per section? Should every section carry its own add affordance (Maintenance has none)?
6. **Above-the-fold budget**: how much height the hero photo may take versus next-service, cost and health signals.
7. **Odometer**: one display with one edit pattern (and a cross-platform one).
8. **What belongs in "More"?** Recalls, OEM import and log-past-work are single-path features; should recalls be a visible status (safety) rather than an overflow action?
9. **Presentation rules**: one rule for create (sheet vs full-screen), one for view (push vs modal), one for edit — currently five patterns.
10. **Row interaction grammar**: expand-inline vs push-to-detail vs modal, and one delete gesture across tasks, expenses and documents.
11. **Reference data**: where make/model/year/VIN/purchase info lives, and whether it is read-only on detail or edit-in-place (Details card vs Edit screen overlap).
12. **Period semantics for money**: which period the bike-level cost figure uses by default and how it is labelled, so bike detail and dashboard agree.
13. **Back/context label**: fixed "Garage" or origin-aware, given five entry points from other tabs.
14. **Garage list role**: should cards surface health / next service / cost so that fewer visits to detail are needed, and what the card's ⋯ should do.
