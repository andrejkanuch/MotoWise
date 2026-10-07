# Prompt for Claude Design — redesign the MotoVault bike detail

Paste everything below the line into Claude Design, and attach the files listed under "Attached material".

---

## The job

Redesign the **bike detail** area of MotoVault, a mobile app (iOS and Android, React Native) where motorcycle riders manage maintenance, expenses, documents and rides for each bike they own.

The current bike detail is one long scroll of thirteen stacked blocks. Riders cannot tell what needs attention, the cost analytics is hard to find, and the maintenance tasks are ordered in a way that hides the important ones. I want a new information architecture and a new visual design for this area that makes the page answer a rider's questions in order of importance.

Design for a phone, dark theme first. The scope is the bike detail and the screens reached from it. Home, Discover, Profile, onboarding and the tab bar are out of scope, with one exception noted under "Rider feedback".

## Who uses it and when

Hands-on riders in Europe and the Americas. They open a bike's page at three moments:

- **Before a ride:** is the bike ready, is anything overdue?
- **After a service or a purchase:** log what was done and what it cost.
- **When planning or wondering:** what is coming up, what has this bike cost me, where is the insurance paper?

They want depth and real numbers, and they dislike being simplified at. They own between one and several bikes.

## Attached material

Read these before designing. Paths are relative to `docs/design/app-screens/`.

| File | What it gives you |
|---|---|
| `05-garage/02-bike-detail/visual-audit.md` | 34 findings on the current screens, each tied to a screenshot, plus nine open design questions. Start here. |
| `05-garage/02-bike-detail/code-audit-information-architecture.md` | Every block on the page in render order, every tappable element and where it leads, tap counts, and the analytics entry points. |
| `05-garage/03-maintenance-tasks/code-audit-maintenance-tasks.md` | The task data model, every task state, how tasks are sorted and truncated, and the flow between add, edit, complete and history. |
| `05-garage/02-bike-detail/screenshots/` | The current bike detail: full scroll (`01-scroll-01` to `05`), details expanded, history tab, the ⋯ menu, recalls. |
| `05-garage/03-maintenance-tasks/screenshots/` | All Tasks list, expanded task card, complete sheet, edit sheet, add sheet. |
| `05-garage/04-expenses-analytics/screenshots/` | Expense Insights (`01-analytics-01` to `04`), add expense, expense detail, the expanded expense list. |
| `05-garage/06-health-report/screenshots/` | The Service Report screen. |
| `05-garage/07-add-edit-bike/screenshots/` | Edit Motorcycle. |
| `05-garage/01-garage-list/screenshots/` | The Garage list the rider arrives from. |
| `03-home/screenshots/` | Home, for context and for the "This month" card. |

The screenshots show a test account: a 2022 Honda Africa Twin, metric units, euros, ten active tasks (four overdue), ten completed, 22 expenses this year, no documents, two open safety recalls.

## What is wrong today

The visual audit has the full list. The problems that should drive the redesign:

1. **The first screen answers no question.** It shows a photo, the odometer twice, four actions, a promo banner and three small stats. The only status signal is "48% ready", which cannot be tapped and is not explained.
2. **No structure.** Maintenance, expenses, documents and bike facts are stacked. Reaching expenses means scrolling past every task. Once the photo scrolls away there is no header: no bike name, no back button, and content runs under the status bar.
3. **Analytics is hidden.** The entry is the third of three look-alike stat cards, and the other two are not tappable. Expense Insights is the best-organised screen in the flow and almost nobody will find it.
4. **Alerts are not ranked.** Four overdue tasks are each painted fully red. Two open safety recalls appear nowhere on the page; the only path is the ⋯ menu.
5. **Task priority is lost.** An overdue task shows an OVERDUE pill in place of its priority, so a High-priority brake inspection looks identical to an overdue tyre-pressure check. The list sorts by due date; priority only breaks ties between undated tasks. The page shows five tasks.
6. **"Due" is hard to read.** Cards show a target odometer ("42,100 km") and leave the rider to subtract the current reading.
7. **Service history is degraded.** Completed work is struck through and dimmed, and it is not in date order.
8. **"Health" is three unrelated things:** the "% ready" pill, a Service Report card, and a screen with a single "Generate Health Report" button that produces a PDF.
9. **Duplication.** The odometer appears twice. Documents appears as a card, a section and a menu item. Add-expense has four triggers.
10. **Mixed visual systems.** Serif italic header for Maintenance, sans for Expenses and Documents. The primary button is copper, blue or grey depending on the sheet. Sheets show their title twice.

## Rider feedback to solve

These came from a real rider with several bikes, on imperial units:

- **"Two tasks tagged Critical don't even show up unless I click to see all the tasks. I'd like to manually rearrange tasks."** Design a task order that respects priority, and a way to reorder by hand. Show what "overdue and critical" looks like next to "overdue and low".
- **"It would be helpful to have a section for random notes — an idea, or something I need to remember on whatever project I'm working on."** Design a per-bike notes area. Notes today exist only inside a task. This is a new feature; treat it as free-form, quick to add to, and not a task.
- **"I don't really know what 786/600 km means."** This is the "This month" card on Home (`03-home/screenshots/02-home-scroll-02`): distance ridden this month against a 600 km goal the rider never set. It is outside the bike page, but propose a fix for this one card.
- **Units.** Every distance must follow the rider's unit setting, miles or kilometres. Design with both in mind: show at least one key screen in miles.

## What the page has to hold

Everything below exists today and must have a home in the new design. You decide where and how prominent.

**Bike identity:** photo, year, make, model, optional nickname, primary-bike flag, odometer (editable in place), purchase price and date, VIN.

**Maintenance tasks.** Each task has a title, a priority (Low, Medium, High, Critical), an optional due date, an optional target odometer, an optional repeat interval, a description, notes, and up to five photos. Some tasks come from an imported manufacturer schedule. A task is upcoming, overdue or completed. A completed task records the date, the odometer and an optional cost. Actions on a task: mark done, edit, delete. The rider can also log past work that was never a planned task.

**Expenses.** Each has an amount, one of 14 categories, a date, an optional item name, details, and up to three receipt photos. Receipts can be scanned to create an expense. Some expenses are linked to a completed service.

**Cost analytics (per bike):** total for this year, last year or all time; change against last year; total cost of ownership (purchase price plus expenses, split into money invested in the bike and running costs); average per month; cost per distance; breakdown by category with drill-down; monthly trend.

**Documents:** insurance, registration, title, service records, in rider-managed categories.

**Safety recalls:** looked up from the public recall database for the bike's make, model and year. Each has a component, a description, a consequence, a remedy and a campaign number.

**Service report:** a generated PDF of the bike's maintenance history, expenses and condition.

**Rides:** a count of rides on this bike.

**Other actions:** import the manufacturer service schedule, edit the bike, delete the bike.

**New in this redesign:** per-bike notes, and manual task ordering.

## Questions I want the design to answer

Take a position on each. Where two answers are both strong, show both.

1. What does the first screen tell the rider? My view: what needs attention on this bike now, then what it costs, then what it is.
2. How is the page divided: tabs or segments under a compact, persistent header, or one page with a sticky section switcher?
3. Where do alerts live (overdue tasks, open recalls, expiring documents), and how are they ranked against each other?
4. How are tasks ordered and how is urgency shown, so that priority and lateness are both readable at once?
5. How is "due" expressed? I lean towards remaining distance and time ("in 3,900 km" or "2 days late") over target values.
6. Is analytics its own destination within the bike, or a summary on the main view with a drill-down? Either way it needs a labelled, obvious entry.
7. What does "ready" mean? Either define the readiness score, make it tappable and show what moves it, or replace it.
8. Which of the hidden menu items earn a visible place: recalls, log past work, import schedule?
9. How should service history read? It is the record a rider shows a buyer, so it should be the clearest list on the page, in date order.

## Brand and visual direction

**Rugged. Premium. Confident.** A precision instrument for riders: forged steel with a leather grip.

- **Surfaces:** dark and warm, never cold blue-grey. Neutrals carry a slight warm tint. Cards are warm dark (around `#1E1C19`), not pure black. Elevation through subtle transparency, not drop shadows. Rounded corners use continuous curves.
- **Colour:** exhaust copper (`#D4622E`) is the signature and the primary action colour. Blue signals trust, teal signals growth, amber signals encouragement. Keep bright colour for interactive elements and key numbers. Use one primary button colour throughout.
- **Type:** Plus Jakarta Sans for interface text, Instrument Serif for display and editorial moments, Geist Mono for data. Use the serif sparingly and consistently.
- **References:** Strava and Komoot for data-rich but clean activity views; the Porsche and BMW companion apps for dark surfaces and precise typography.
- **Avoid:** generic SaaS dashboards, gamification (badges, streaks, cartoon icons), cluttered forum looks, and minimalism so stripped that it loses character.
- **Density:** riders want depth. Show meaningful data, and make every element earn its space.

## Constraints

- **Platform-native.** It must feel like a native iOS and Android tool: standard navigation, sheets for forms, haptics on interactive moments. Motion under 300 ms and purposeful.
- **Logging is always free.** Adding a maintenance task or an expense must never sit behind a paywall or a count limit.
- **No new data beyond notes and manual order.** Every other element must be buildable from the data listed above.
- **States matter.** The design must work for a brand-new bike with no tasks, expenses or documents, and for a bike with ten years of history.
- **One-handed use.** Primary actions reachable with a thumb; the tab bar and a central ride button occupy the bottom of the screen (see any screenshot).

## What I want back

1. **A proposed information architecture** for the bike detail: the sections, their order, what sits on the first screen, and where each item in "What the page has to hold" now lives. One short rationale per decision.
2. **High-fidelity mobile screens, dark theme**, for:
   - Bike detail main view, top and scrolled
   - Maintenance: active tasks, service history, an expanded or opened task
   - Add task, edit task, complete task
   - Costs: the summary on the bike page and the full analytics view
   - Recalls and other alerts as they appear on the bike page
   - Notes
   - Documents
   - Bike facts and edit
3. **States:** empty bike, one overdue critical task alongside several low ones, a long history, and one screen in miles.
4. **A component sheet:** task row, alert, stat, section header, primary and secondary buttons, with their rules.
5. **The Home "This month" card fix**, as a single card.
6. **A short list of what you removed or merged**, and why.
