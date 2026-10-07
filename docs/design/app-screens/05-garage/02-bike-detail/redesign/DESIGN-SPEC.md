# Bike detail redesign — implementation spec

Source of truth for the mobile redesign of the bike detail area. The screens are the `.dc.html` files in `screens/` (one per artboard, 390×844 unless noted); `screens/canvas.json` lists them with titles and their row on the canvas. Open any `.dc.html` in a browser to see the screen — the markup *is* the design: every colour, size, spacing and copy string is literal in the file. The live canvas with comments is the Design artifact in claude.ai ("MotoVault — Bike detail redesign").

Companion documents in this folder: `code-audit-information-architecture.md`, `visual-audit.md`, `claude-design-prompt.md` (the brief), `screenshots/` (the current app).

## 1. Structure

Bike detail = one persistent header + four segments, each its own scroll:

| Segment | Holds | Primary action (copper pill, bottom-right) |
|---|---|---|
| **Overview** | photo band · ride status · Needs attention (ranked) · Next up · Costs card · Notes (quick add) · Documents row · Bike row | **Log** → bottom drawer: Expense · Maintenance task · Work already done · Note · Document |
| **Service** | Active (Overdue / Due soon / Later groups) and History (year groups, PDF export, Past work) | **Task** → Add task sheet |
| **Costs** | year chips · total + YoY · stats · TCO card · By category · Month by month · Recent | **Expense** → Add expense sheet |
| **Bike** | Documents · Safety recalls · Notes row · Facts (photo, model, year, nickname, VIN, primary, bought, odometer, rides, unit) · Honda schedule · Service report · Edit · Remove | **Document** → Add document sheet |

Header (never scrolls away): origin-aware back (Garage / Home / Profile) · bike name in Instrument Serif 22 + eyebrow "2022 · Honda" · odometer chip (mono, the only odometer on the page; tap → Odometer sheet). Under it the segment bar: 36 px pills, 14 px side padding, 6 px gap, horizontally scrollable; Service carries a badge = count of overdue **Critical/High** tasks only. On scroll the name and chip merge into one 44 px row. Android renders the bar as Material tabs.

Removed from today's screen: second odometer chip, Service Report card, Scan-a-receipt banner, 3-stat row, Documents entry card, ⋯ menu, OEM disclaimer banner, serif section titles, duplicated sheet titles, second Save in Edit bike, inline "See all (22)" expansion, four add-expense triggers.

## 2. Rules (also drawn on `screens/Components.dc.html`)

**Ride status** (three words, serif, in a tinted card at the top of Overview, links to the top attention row):
- *Not ready* — an overdue **Critical** task, or an **expired** document in a category that blocks riding (insurance, inspection, registration).
- *Check before riding* — an open recall, an overdue **High** task, or a required document expiring within 30 days.
- *Ready* — otherwise. *Nothing tracked yet* (neutral grey) when the bike has no tasks and no documents.
- Overdue Low and Medium never change it.

**Needs attention ranking**: recalls → overdue Critical/High → expiring documents → other overdue → due soon. Max three rows then "N more"; count in the eyebrow.

**Task row**: `[priority tag 44px mono] [title / due line] [mark-done circle 44px]`. Row is a View with two sibling Pressables (title block opens the task; circle completes it) + `accessibilityActions` Mark done / Reorder — never a button inside a pressable. Only an overdue Critical row gets a tinted background (`#241715`, border `rgba(255,122,107,.4)`). History rows: date column (mono) instead of tag, cost instead of circle, full-contrast text, no strikethrough.

**Priority tags**: CRIT `#3A1A16/#FF7A6B`, HIGH `#3A2412/#F0A050`, MED `#172538/#7DA9F0`, LOW `#2A2824/#A39B8F`. Priority is always the tag; lateness is always the due line; neither replaces the other (no "OVERDUE" pill anywhere).

**Due line**: leads with whichever limit is closer, as remaining or elapsed, in the bike's unit; the other limit in grey. "201 days late · 3,933 km to target", "In 2 days · or in 8,733 km", "In 9,833 km · Honda schedule". Colour: `#FF7A6B` when past, `#F0A050` within 30 days or 2,000 km (1,200 mi), otherwise `#B5ADA2`. Groups: Overdue / Due soon / Later / (Someday for undated). Sort within a group: priority desc, then nearest due. Sort control: Priority, then due · Soonest due · My order (drag, grip left of the tag, circle stays).

**Mark done**: tap circle = instant complete with today + current odometer, success haptic, 180 ms fill, 5 s snackbar "Done · Add details · Undo". Swipe right completes; swipe left = Edit · Delete; long-press = context menu. Multi-select via long-press (Android) / "Select" in the sort menu (iOS) → bottom action bar Mark N done · Priority ▸ · Delete → Bulk complete sheet (shared date/odometer, per-task next-due, optional shared cost linked to all).

**Deletes**: tasks, notes, expenses = 5 s Undo snackbar, no dialog. Documents and the bike = typed confirmation sheet.

**Buttons**: one primary per screen, copper `#D4622E` with ink `#1A1410` (white on copper fails contrast); secondary raised `#2A2724`; destructive = red text `#FF7A6B` only, at the bottom. Heights 52/48/36, radius 14, `borderCurve: 'continuous'`. Every control ≥ 44 pt (48 dp Android).

**Colours**: ground `#141210`, card `#1E1C19`, raised `#2A2724`, text `#F3EEE6`, dim `#B5ADA2`, muted `#9C958A` (≥4.5:1 on raised), ok `#5FC8A0`. Copper is action only — never status, never a chart highlight. Colour never carries meaning alone (text beside every status; chart bars carry accessibility labels). Category colours: amber `#E8A040`, blue `#5B8DEF`, violet `#8B7CE8`, teal `#3FBF9A`, copper `#D4622E`, sand `#C9A86A`, stone `#B8B2A8`, slate `#6F685E`.

**Type**: Plus Jakarta Sans (UI); Instrument Serif only for the bike name, sheet titles and the ride-status line; Geist Mono for every number, tag and eyebrow. Eyebrow = 11 px mono uppercase, 0.08 em.

**Presentation**: create/edit = form sheet (`presentation: 'formSheet'`); view = push; chooser (Log, picker) = bottom drawer; camera = full-screen modal. Keyboard-attached Save on sheets; forms scroll.

**Costs**: no cost-per-distance figure anywhere. Stats = eyebrow · mono value · one-line basis (period + denominator) — the basis line is mandatory. Year chips (2026 · 2025 · … · All); All-time hides YoY and shows per-year bars. TCO = paid for the bike + invested (categories flagged *invested*: Accessories, Upgrades) + running (everything else, rider gear included); "what counts where" opens the explainer. Category rows and month bars are tappable and open the filtered list. Scan receipt lives **inside** Add expense; its review screen marks every read field confident/unsure and never auto-saves. Logging is always free; the scan quota is shown only beside the Scan button.

**Notes**: per bike, text + odometer stamp + photo + optional link to a job/expense, "also make it a task" switch. Entry points: Log drawer, Overview notes block, Notes screen, Bike segment row.

**Units**: per bike (`distance_unit` km|mi, set in Edit bike); never converted on the bike's own screens; Home totals convert to the profile unit.

**Recalls**: per-rider state open / fixed (date, shop, odometer, linked to history) / not my VIN / snoozed 4 weeks. CRIT when the summary mentions stall, brakes, steering, fuel or fire, else HIGH. Fixed recalls clear from ride status.

## 3. Data-model additions (all other screens use existing data)

| Change | Why |
|---|---|
| `notes` table (bike_id, user_id, text, odometer, photo_ids[], linked_task_id?, linked_expense_id?) | per-bike notes |
| `maintenance_tasks.manual_position int` | "My order" sort |
| `recall_acknowledgements` (user_id, bike_id, campaign_id, state, fixed_at, odometer, shop, snoozed_until) | recall lifecycle |
| `motorcycles.distance_unit` ('km'/'mi') | per-bike units |
| `expense_categories.bucket` ('running'/'invested'), `.colour`, `.position`, `.archived`, `.extra_field` (none/litres/valid_until) | manage categories, TCO split |
| `expenses.odometer`, `expenses.litres?`, `expenses.shop?`, `expenses.linked_task_id?` | add-expense fields, link to job |
| `document_categories.blocks_riding bool` | ride-status rule for expired papers |
| `odometer_readings` log (bike_id, value, at, source) | "due soon at your pace", odometer history |

Each is a Supabase migration + `pnpm generate:types` + Zod + NestJS model per CLAUDE.md "Update Sequence".

## 4. Screen index

Rows on the canvas and their files. Each row is one implementation phase.

**Row 1 — Overview**: `Main` (top), `OverviewScrolled`, `OverviewEmpty` (new bike), `LogSheet`.
**Row 2 — Service**: `ServiceActive`, `ServiceMiles` (critical overdue + lows, miles), `ServiceReorder` (My order), `ServiceHistory`, `ServiceHistoryLong` (ten years, search, year chips).
**Row 3 — Task flows**: `TaskDetail`, `AddTask`, `EditTask`, `CompleteTask`.
**Row 4 — Costs, recalls, notes**: `Costs`, `CostsScrolled`, `Recalls`, `Notes`.
**Row 5 — Bike segment**: `Bike` (documents, safety, notes, facts top), `BikeDetails` (facts, schedule, report, edit, remove), `EditBike`.
**Row 6 — Spec**: `Components` (1240×1180), `HomeCard` (390×300, Home "This month" fix).
**Row 7 — Service extras**: `OdometerSheet`, `ServiceDone` (undo snackbar), `TaskSelect` (multi-select), `BulkComplete`, `LogPastWork`, `JobDetail` (completed job).
**Row 8 — Leaves**: `AddExpense`, `ExpenseDetail`, `AllExpenses`, `AddDocument`, `DocumentDetail`, `DeleteBike`, `ImportSchedule`, `CategoryGear` (category drill-down).
**Row 9 — Costs flow**: `CostsEmpty`, `CostsAllTime`, `ScanReceipt`, `ScanReview`, `CategoryPicker`, `ManageCategories`, `EditCategory`, `EditExpense`, `LinkJob`, `MonthAugust`, `TcoExplainer`, `NoteSheet`.

Links between files (`<a href="X.dc.html">`) are the intended navigation; every target exists.

## 5. Mapping to the app (today → new)

| Today (`apps/mobile/src/…`) | New |
|---|---|
| `app/(tabs)/(garage)/bike/[id].tsx` one ScrollView, 13 blocks | header + segmented container; `components/bike-hub/*` split into `overview/`, `service/`, `costs/`, `bike/` |
| `hub/bike-stats-row`, `hub/mileage-display`, Service Report card, Documents entry card, receipt-scan banner | removed (see §1) |
| `hub/maintenance-section` + `swipeable-task-card` + `bike-tasks.tsx` | Service segment (`ServiceActive`, groups, sort, select mode); `TaskDetail` push replaces inline expand |
| `expense-dashboard.tsx` + `hub/expenses-section` | Costs segment (`Costs`, `CostsScrolled`, `CostsAllTime`, `CostsEmpty`) + leaves |
| `hub/documents-section` + `document/[id]` | Bike segment Documents block + `DocumentDetail` |
| `(modals)/recalls` (formSheet from ⋯) | `Recalls` push from Overview/Bike, with acknowledgement state |
| `health-report.tsx` | removed as a screen; PDF export action on History and Bike |
| `Alert.prompt` odometer | `OdometerSheet` (both platforms) |
| `add-maintenance-task?mode=log` | `LogPastWork` sheet |
| `expense-detail.tsx` (delete only) | `ExpenseDetail` + `EditExpense` |
| `manage-document-categories` | unchanged, reached from Bike › Documents › Categories |
| Home "This month" card | `HomeCard` |
