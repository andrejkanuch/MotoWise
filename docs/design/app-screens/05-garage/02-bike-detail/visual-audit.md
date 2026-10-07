# Bike detail — visual audit

Date: 2026-10-02 · Source: simulator captures in `05-garage/*/screenshots/` (dark theme, test account, Honda Africa Twin 2022, metric, EUR).
Companion reports: `code-audit-information-architecture.md` (this folder) and `../03-maintenance-tasks/code-audit-maintenance-tasks.md`.

Capture caveat: screens were taken on the 3.19.1 dev client running current `main` JS (3.20.0). Anything marked **verify** could be affected by that mix and should be re-checked on a real build.

## What the page looks like today

One scroll, about five screen heights for this bike (`02-bike-detail/screenshots/01-scroll-01` → `05`), in this order:

1. Hero photo with name (about 40% of the first screen)
2. Odometer pill + "48% ready" pill
3. A second odometer chip ("38,167 km · Updated today")
4. Add Task (copper) · Add Expense · edit icon · ⋯ icon
5. "Scan a receipt" banner (copper)
6. Three stat cards: COST / KM · RIDES · ANALYTICS "View →"
7. Service Report card
8. Documents card
9. Maintenance: Active / History tabs, 5 task cards, "See all tasks (10)"
10. OEM disclaimer banner
11. Expenses: total, year picker, chart icon, "+", category bar with 11 legends, 5 rows, "See all (22)"
12. Documents section (empty state)
13. Details (collapsed)

## Findings

### Structure and hierarchy

| # | Finding | Evidence |
|---|---|---|
| 1 | The first screen answers no question. It shows a photo, the odometer twice, four actions, a promo and three small stats. The only status signal is "48% ready", which is not tappable and not explained. | `01-scroll-01` |
| 2 | The page has no sections a rider can jump between. Maintenance, expenses and documents are stacked, so reaching expenses means scrolling past every task card. | `01-scroll-02` → `04` |
| 3 | Once the hero scrolls away there is no header. Content slides under the status bar and collides with the clock; the bike name and back button are gone. | `01-scroll-02`, `01-scroll-04`, `02-details-expanded` |
| 4 | Analytics is the third of three look-alike stat cards. "COST / KM" and "RIDES" are plain values; "ANALYTICS · View →" is the only tappable one. | `01-scroll-01` |
| 5 | Service Report and Documents are full-width cards above the fold, ahead of Maintenance. Service Report opens a page with one button; Documents is empty for this bike and appears again as a section further down. | `01-scroll-02`, `06-health-report/…/01-service-report-01`, `01-scroll-05` |
| 6 | The bike has **2 open safety recalls**. They appear nowhere on the page; the only path is ⋯ → "Check Safety Recalls". | `05-more-menu`, `06-recalls` |
| 7 | "See all (22)" under Expenses expands the list in place, making the page 22 rows longer, with Documents and Details pushed below it. | `04-expenses-analytics/…/04-see-all-expenses-expanded-inline` |
| 8 | Bike facts (make, model, year, purchase price and date) are last, collapsed. | `02-details-expanded` |

### Maintenance block

| # | Finding | Evidence |
|---|---|---|
| 9 | Overdue tasks show an OVERDUE pill instead of their priority. Brake Pads Inspection is High priority (visible only in the edit sheet); on the card it is indistinguishable from an overdue tyre-pressure check. | `01-scroll-02`, `03-maintenance-tasks/…/04-edit-task-01` |
| 10 | Four of the five visible cards are overdue, each in red with a red bar and a red pill. The block reads as one alarm, not a ranked list. | `01-scroll-02` |
| 11 | Each card shows a target odometer ("42,100 km") with no relation to the current one (38,167 km). The rider has to do the subtraction. | `01-scroll-02` |
| 12 | "201 day(s) overdue" — unresolved plural in the copy. | `01-scroll-02` |
| 13 | History is not in date order: 8/25/2026, 8/16/2026, 7/16/2026, 10/4/2025, 3/15/2025 on the bike page, and a different order again on All Tasks (8/16/2026, 8/25/2026, 3/15/2025, 4/22/2023, 9/30/2023, 5/11/2024, 10/4/2025). | `03-maintenance-history-tab`, `03-maintenance-tasks/…/01-all-tasks-02`, `-03` |
| 14 | Completed tasks are shown struck through and dimmed, which makes the service history — the valuable record — the hardest text on the page to read. | `03-maintenance-history-tab` |
| 15 | Every task uses the same wrench icon, so the icon column carries no information. | all task captures |
| 16 | The chevron on a task card suggests navigation, but tapping expands the card in place (photo slot, Done / Edit / Delete). | `03-maintenance-tasks/…/02-task-card-expanded` |
| 17 | The OEM disclaimer is a full-width warning-coloured banner between Maintenance and Expenses, visually louder than either section header. | `01-scroll-03` |

### All Tasks, add, edit, complete

| # | Finding | Evidence |
|---|---|---|
| 18 | All Tasks mixes active and completed tasks in one list under "All"; filter labels are inconsistent ("OVERDUE" in capitals, the others in title case). | `03-maintenance-tasks/…/01-all-tasks-01`, `-02` |
| 19 | All Tasks has no add button and no bike name. | `01-all-tasks-01` |
| 20 | Add and Edit sheets show the title twice ("Add task" and "New task."; "Edit Task" and "Edit task."). | `05-add-task-01`, `04-edit-task-01` |
| 21 | Edit has no Repeat control; Add does. | `04-edit-task-02`, `05-add-task-02` |
| 22 | Complete sheet: the odometer field is empty with an "e.g. 15000" placeholder, although the bike's current reading is known. | `03-complete-task-01` |
| 23 | Primary button colour changes by sheet: blue "Mark Complete", copper "Save changes", grey "Save task". | `03-complete-task-01`, `04-edit-task-01`, `05-add-task-01` |

### Expenses and analytics

| # | Finding | Evidence |
|---|---|---|
| 24 | Expenses uses a different visual system from Maintenance: sans header vs serif italic, blue "+" vs copper, blue links. | `01-scroll-03` |
| 25 | The category bar has 11 legend entries wrapping over five lines; several colours are near-identical blues and purples. | `01-scroll-03` |
| 26 | Expense Insights is the most structured screen in the flow (period switch, total, year-on-year, cost of ownership, categories, monthly trend), and it is two taps deep behind an unlabelled entry. | `04-expenses-analytics/…/01-analytics-01` → `04` |
| 27 | Monthly trend runs newest-to-oldest (Sep on the left, Feb on the right). | `01-analytics-04` |
| 28 | Cost of ownership shows four figures (Bike purchase, All expenses, Invested in bike, Running costs) with no explanation of how they relate. | `01-analytics-01` |
| 29 | Expense detail has a light page background behind dark cards in dark mode, and no edit action — only Delete. **Verify** the background on a real build. | `03-expense-detail` |
| 30 | Add Expense: 14 category chips take a full screen before the date field. | `02-add-expense-01` |

### Other screens touched

| # | Finding | Evidence |
|---|---|---|
| 31 | Recalls: the date is clipped off the right edge of both cards. | `06-recalls` |
| 32 | Edit Motorcycle has two Save buttons (header and bottom) and a duplicate title. | `07-add-edit-bike/…/01-edit-bike-01`, `-04` |
| 33 | Garage list: "Open tasks" shows "—" although the tab badge says 4. | `01-garage-list/…/01-garage-list-top` |
| 34 | Home "This month" card shows "24 / 600 km" against a "600 km goal" the rider never set — the string from the user feedback. | `03-home/…/02-home-scroll-02` |

## Rider feedback mapped to what is on screen

| Feedback | Where it shows |
|---|---|
| "786/600 km" is unclear | Home, "This month" card (finding 34). Not on the bike page. |
| Critical tasks hidden until "See all" | Bike page shows 5 tasks sorted by due date; priority is replaced by OVERDUE or ignored (findings 9, 10). |
| Wants manual task order | No reorder affordance on either list. |
| Wants a notes section | No notes area anywhere on the bike page; the nearest is a per-task notes field in the edit sheet (`04-edit-task-02`). |
| C90 shows km | Not reproducible here (metric account). Units come from one per-user setting; see the maintenance code audit. |

## Questions the redesign has to answer

1. What is the one thing the first screen should tell a rider: what is due, what the bike costs, or what the bike is?
2. Do Maintenance, Costs, Documents and Details become tabs or segments under a compact header, or stay on one page with a sticky section switcher?
3. Where do alerts live (overdue tasks, open recalls, expiring documents), and how are they ranked against each other?
4. How is a task ordered: priority first, due date first, or manual? What does "overdue and critical" look like next to "overdue and low"?
5. Should "due" be shown as distance and time remaining ("in 3,900 km / 2 days") instead of target values?
6. Is analytics a destination (its own tab) or a summary that lives on the bike page with a drill-down?
7. Where do notes go: per bike, per task, or both?
8. What does "48% ready" mean, and does it earn a place if it cannot be tapped?
9. Which of the ⋯ items deserve a visible home (recalls, log past work, OEM import)?
