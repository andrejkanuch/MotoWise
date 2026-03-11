# PRD: Bike Hub — The "At-a-Glance" Overview

**Author:** Claude (Product Spec)
**Date:** 2026-03-09
**Status:** Draft
**Version:** 1.0

---

## 1. Problem Statement

When a MotoLearn user taps on their bike today, they land on a screen that's essentially a long scrollable list: bike info at the top, then a flat list of maintenance tasks grouped by status. There's no hierarchy, no financial context, and no sense of *urgency*. A rider who just wants to know "is my bike healthy, what's due next, and how much am I spending?" has to mentally assemble that picture from scattered data points.

This matters because motorcycle owners are emotionally attached to their machines — they want to *feel* in control, not overwhelmed. The current experience treats the bike detail page as a data dump rather than a dashboard. As a result, users are likely to disengage from tracking maintenance, miss upcoming tasks, and never build the habit that makes MotoLearn indispensable.

The cost of not solving this: low retention past the first maintenance cycle, no differentiation from a simple spreadsheet, and zero path toward the expense-tracking features that would unlock monetization.

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| 1 | **Instant situational awareness** — a rider sees their bike's health, next action, and spend in under 3 seconds | Time-to-comprehension < 3s (usability test) |
| 2 | **Increase maintenance task completion rate** by making urgency visible | +30% task completion within 7 days of due date (vs. current baseline) |
| 3 | **Drive daily opens** — make the overview compelling enough to check regularly | DAU/MAU ratio improves from baseline by 15% within 60 days |
| 4 | **Lay the foundation for expense tracking** — introduce cost fields now so data accumulates | 40% of completed tasks have a cost entry within 90 days of launch |
| 5 | **Create the "AHA moment"** — first-time users who add a bike should immediately feel the value | 70%+ of new users who add a bike return within 48 hours |

---

## 3. Non-Goals

| # | Non-Goal | Why |
|---|----------|-----|
| 1 | Full expense reporting/analytics dashboard | Separate initiative — we need data accumulation first before analytics make sense |
| 2 | Multi-bike comparison view | Low priority until users average 2+ bikes; current data suggests most have 1 |
| 3 | Integration with parts stores or pricing APIs | Too complex for v1; manual cost entry is sufficient to validate demand |
| 4 | Social features (share ride logs, compare with friends) | Different product direction; share links for mechanic handoff are already covered |
| 5 | Predictive maintenance using AI | Requires OEM schedule data refinement and enough user data; premature for v1 |

---

## 4. User Stories

### Primary Persona: The Daily Rider
Rides 3-5 times per week, does some DIY maintenance, wants to stay on top of things without it feeling like a chore.

**US-1:** As a daily rider, I want to see my bike's health score, next upcoming task, and total spend *the instant I tap my bike*, so that I know whether everything is fine or I need to act.

**US-2:** As a daily rider, I want to tap into a focused "Upcoming" section that shows me what's due in the next 30 days (sorted by urgency), so I can plan my weekend maintenance.

**US-3:** As a daily rider, I want to log the cost of a maintenance task when I complete it, so I can track how much I'm spending over time without needing a separate app.

**US-4:** As a daily rider, I want to see a simple spending summary (this month / this year / all time) on my bike's overview, so I have a gut-feel for where my money goes.

**US-5:** As a daily rider, I want to quickly update my odometer reading from the bike overview, so the mileage-based maintenance reminders stay accurate.

### Secondary Persona: The Weekend Tinkerer
Works on their own bike, wants detailed records, cares about parts and costs.

**US-6:** As a tinkerer, I want to record parts cost vs. labor cost separately when completing a task, so I can see how much I save by doing it myself.

**US-7:** As a tinkerer, I want to see a "Maintenance Timeline" — a chronological history of everything done to my bike — so I have a complete service record.

**US-8:** As a tinkerer, I want to attach receipts (photos) to expense entries, so I have proof for warranty or resale purposes.

### Edge Cases

**US-9:** As a new user who just added their first bike, I want to see a helpful empty state that shows what the overview *will* look like once I start tracking, so I understand the value immediately and am motivated to complete my first task.

**US-10:** As a user with overdue tasks, I want the overview to clearly surface what's overdue (not bury it in a list), so I can't accidentally ignore critical maintenance.

**US-11:** As a user opening the app after weeks of inactivity, I want the overview to show me a "catch-up" summary of what I missed, so I can quickly get back on track.

---

## 5. Requirements

### Must-Have (P0) — The Bike Hub

These define the redesigned bike detail screen ("Bike Hub"):

#### P0-1: Hero Card with Vital Signs
The top of the screen shows a compact "hero" card:
- Bike photo (or gradient fallback with make/model)
- Make, model, year, nickname
- **Health Score Ring** (already exists — keep it prominent)
- **Current Mileage** displayed prominently with a quick-update tap target
- **Next Due Task** — single most urgent task with title + due date/mileage, tap to expand

**Acceptance Criteria:**
- [ ] Hero card renders in under 500ms on a mid-range device
- [ ] Health score ring matches current implementation (no regression)
- [ ] Tapping mileage opens an inline editor (number pad) — saves optimistically
- [ ] Next due task shows the task closest to its due date or target mileage
- [ ] If no tasks exist, shows "No tasks yet — add your first one" CTA
- [ ] If all tasks are completed, shows "All caught up!" with a checkmark animation

#### P0-2: Quick-Glance Stat Cards
Below the hero, a row of 3 tappable stat cards:

| Card | Content | Tap Destination |
|------|---------|-----------------|
| **Upcoming** | Count of tasks due in next 30 days | Upcoming tasks list |
| **Overdue** | Count of overdue tasks (red if > 0) | Overdue tasks list |
| **Total Spend** | Sum of all recorded costs (this year) | Expense summary |

**Acceptance Criteria:**
- [ ] Cards render as a horizontal row with equal width
- [ ] Overdue card turns red (#FF3B30) when count > 0, with haptic pulse on appear
- [ ] Total Spend shows "—" if no costs recorded, with subtitle "Start tracking"
- [ ] Tapping each card navigates to the corresponding detail section/screen
- [ ] Cards animate in with staggered FadeInUp (delay: index * 50ms)

#### P0-3: Upcoming Maintenance Section
A priority-sorted list of the next 5 tasks:
- Sorted by: overdue first, then by nearest due date, then by priority
- Each row: task title, due date (relative: "in 3 days", "overdue by 2 weeks"), priority badge
- "See all" link at bottom → full task list

**Acceptance Criteria:**
- [ ] Overdue tasks appear first with red accent
- [ ] Tasks with no due date appear after dated tasks, sorted by priority
- [ ] Tapping a task expands it inline (reuse existing SwipeableTaskCard behavior)
- [ ] "See all" navigates to the full maintenance list (existing screen, filtered to this bike)
- [ ] Empty state: illustration + "Add your first task" CTA

#### P0-4: Cost Field on Task Completion
When completing a maintenance task, the completion flow adds:
- **Total Cost** (required: no / optional input)
- **Cost Breakdown** toggle: Parts cost + Labor cost (optional)
- **Notes** field (already exists)

**Acceptance Criteria:**
- [ ] Cost field accepts decimal values (e.g., $123.45)
- [ ] Currency follows user locale (default USD)
- [ ] Cost is optional — user can skip and complete without entering cost
- [ ] If breakdown toggle is on, parts + labor must sum to total (auto-calculates)
- [ ] Cost is stored on the maintenance task record (new `cost`, `parts_cost`, `labor_cost` columns)
- [ ] Existing completed tasks without costs show "—" in cost displays

#### P0-5: Spending Summary Card
A card on the overview showing:
- **This Year** total spend (sum of all task costs for current calendar year)
- **All Time** total spend
- Tap → dedicated expense detail screen (P1)

**Acceptance Criteria:**
- [ ] Amounts formatted with locale-appropriate currency symbol and separators
- [ ] Shows "No expenses recorded" if no costs exist
- [ ] Updates in real-time when a task is completed with a cost
- [ ] Card uses the same visual style as stat cards

#### P0-6: Quick Mileage Update
Prominent mileage display with tap-to-edit:
- Shows current odometer reading + unit (mi/km)
- Tap opens number pad overlay
- Shows "last updated X days ago" subtitle
- Validates: new reading must be ≥ current reading

**Acceptance Criteria:**
- [ ] Mileage update persists immediately (optimistic update + API call)
- [ ] Cannot enter mileage lower than current value (shows error toast)
- [ ] After update, any mileage-based task due dates recalculate
- [ ] Shows relative time since last update ("Updated 3 days ago")

### Nice-to-Have (P1)

#### P1-1: Maintenance Timeline View
Chronological view of all completed maintenance:
- Vertical timeline with date markers
- Each entry: task title, date completed, cost (if recorded), photos thumbnail
- Filterable by year
- Exportable as PDF (extend existing PDF export)

#### P1-2: Expense Detail Screen
Dedicated screen accessed from spending summary:
- Monthly breakdown bar chart (simple, no external charting lib — use RN SVG or reanimated)
- Category breakdown (if we add task categories)
- List of all expenses sorted by date
- Export as CSV

#### P1-3: Seasonal / Contextual Tips
Based on time of year + bike type + location:
- "Winter is coming — consider these pre-storage tasks"
- "Your chain is due for adjustment based on mileage"
- Displayed as a dismissible card on the overview

#### P1-4: "Catch-Up" Mode
If user hasn't opened the app in 14+ days:
- Show a summary overlay: "While you were away..."
- Lists overdue tasks, mileage estimate, and any OEM schedule items that became due
- Single "Review All" CTA

#### P1-5: Bike Specs Card (Expandable)
Collapsible section showing:
- VIN, Engine CC, Type, Purchase Date
- Only shown on demand (collapsed by default)
- "Edit" link → existing edit-bike screen

### Future Considerations (P2)

#### P2-1: Predictive Maintenance Alerts
Use mileage velocity (average km/day) to predict when the next mileage-based task will come due and alert proactively.

#### P2-2: Cost Benchmarking
"Riders with your bike typically spend $X/year on maintenance" — requires aggregated anonymized data.

#### P2-3: Mechanic/Shop Tracking
Record which shop/mechanic performed each task, with ratings and cost comparison.

#### P2-4: Insurance & Document Vault
Store insurance docs, registration, title — accessible from the bike hub.

#### P2-5: Resale Value Tracker
Estimate current resale value based on make/model/year/mileage/condition + complete maintenance history as a selling point.

---

## 6. Data Model Changes

### New Columns on `maintenance_tasks`

```sql
ALTER TABLE maintenance_tasks
  ADD COLUMN cost DECIMAL(10,2),
  ADD COLUMN parts_cost DECIMAL(10,2),
  ADD COLUMN labor_cost DECIMAL(10,2),
  ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
```

### New Column on `motorcycles`

```sql
ALTER TABLE motorcycles
  ADD COLUMN mileage_updated_at TIMESTAMPTZ;
```

### Update Sequence
1. Create Supabase migration with above ALTER statements
2. Run `pnpm db:reset`
3. Run `pnpm generate:types`
4. Add cost fields to Zod schemas in `packages/types`
5. Update NestJS models + resolvers
6. Run `pnpm generate`
7. Update mobile GraphQL operations + screens

---

## 7. Success Metrics

### Leading Indicators (Week 1-2)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| Bike Hub screen load time | < 1s (p95) | < 500ms | Performance monitoring |
| Mileage update usage | 30% of active users update within 7 days | 50% | Event tracking: `mileage_updated` |
| Cost entry on completion | 25% of completed tasks include cost | 40% | DB query: `cost IS NOT NULL` on completed tasks |
| Task completion rate | +20% vs. current baseline | +30% | Compare 30-day completion rates pre/post |

### Lagging Indicators (Month 1-3)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| DAU/MAU ratio | +10% vs. baseline | +15% | Analytics dashboard |
| 48-hour return rate (new users) | 60% | 70% | Cohort analysis |
| Feature retention (still using at 30 days) | 50% of adopters | 65% | Event tracking |
| NPS improvement | +5 points | +10 points | In-app survey |

### Evaluation Schedule
- **Week 1:** Load times, crash rates, cost entry adoption
- **Week 4:** Completion rates, DAU/MAU, mileage update frequency
- **Week 12:** Retention, NPS, expense data accumulation rate

---

## 8. The "AHA" Moments

These are the moments designed to make a rider think *"this app gets me"*:

1. **First open after adding a bike:** The hub is already populated with OEM-recommended maintenance tasks, health score calculated, and a message like "Your 2019 Honda CB500F needs an oil change around 8,000 km — we'll remind you." The rider didn't have to do anything — it just knows.

2. **Overdue task pulse:** The overdue counter on the stat card pulses red with a subtle haptic when you land on the hub. It's not aggressive, but you can't miss it. It creates a "I should deal with this" impulse.

3. **First cost entry:** After completing a task and entering the cost, the spending card animates from "—" to "$45.00" with a satisfying number-roll animation. The rider thinks "oh cool, it's tracking this for me now."

4. **Mileage update triggers a task:** You update your odometer, and a task that was "due at 12,000 km" suddenly moves to the "Due Soon" section because you're at 11,800 km. The app feels *alive* and responsive to your real riding.

5. **Weekend planning moment:** Saturday morning, you open the app. The overview shows "2 tasks due this month" with estimated total cost of $85. You know exactly what to do and what to budget. No thinking required.

6. **Complete maintenance record for resale (future):** A year in, you have a full timeline of every oil change, tire swap, and chain adjustment — with costs and photos. When selling, you tap "Export" and hand the buyer a professional PDF. That's a feature they'd *pay* for.

---

## 9. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should currency be per-bike or per-user? (User might track bikes in different countries) | Product | Yes — affects data model |
| 2 | Do we want to track vendor/shop name on v1, or defer to P2? Adding the field now costs nothing. | Product | No |
| 3 | What's the right threshold for "overdue" — strictly past due date, or include a grace period? | Product + Design | No |
| 4 | Should mileage-based tasks auto-recalculate due status on mileage update, or only on app open? | Engineering | No |
| 5 | Do we need offline support for cost entry, or is online-only acceptable for v1? | Engineering | No |
| 6 | Should the spending summary include only completed tasks, or also allow logging standalone expenses (fuel, gear, insurance)? | Product | Yes — affects scope |

---

## 10. Timeline Considerations

- **No hard deadlines**, but expense tracking is a prerequisite for future monetization features
- **Phasing suggestion:**
  - **Phase 1 (2-3 weeks):** P0-1 through P0-3 — Hub layout, stat cards, upcoming section (pure frontend restructure + new queries)
  - **Phase 2 (1-2 weeks):** P0-4 through P0-6 — Cost fields, spending summary, mileage update (DB migration + API changes + frontend)
  - **Phase 3 (2-3 weeks):** P1 items — Timeline, expense detail, contextual tips
- **Dependencies:** Design needs to deliver the hub layout mockups before Phase 1 starts. DB migration for cost fields should be prepared in parallel.

---

## 11. Competitive Context

| Feature | MotoLearn (Current) | MotoLearn (Proposed) | Competitors (Motolog, Fuerly, BikeLogger) |
|---------|--------------------|--------------------|------------------------------------------|
| Health score at-a-glance | Yes (buried) | Yes (hero position) | Rare |
| Cost tracking per task | No | Yes | Basic (most lack breakdown) |
| OEM schedule auto-population | Yes | Yes | Uncommon |
| Mileage-based triggers | Partial | Full (with real-time recalc) | Some |
| Maintenance timeline | No | P1 | Common (usually basic list) |
| Receipt photos | Yes (on tasks) | Yes (extended to expenses) | Rare |
| Spending analytics | No | P1 | Basic in premium tiers |
| PDF export with costs | Partial | Full | Rare |

The proposed Bike Hub would put MotoLearn ahead on the "instant awareness" dimension that no competitor nails well. Most competitors are either too simple (basic task lists) or too complex (desktop-first with cluttered UIs). The hub design targets the sweet spot: glanceable yet deep.

---

*This PRD is a living document. Update as decisions are made on open questions and as user feedback comes in from early testing.*
