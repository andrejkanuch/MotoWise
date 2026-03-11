# PRD: Motorcycle Expense Tracking

**Reference:** P0-17, Section 17.5 Garage Dashboard (Spendings Tab)
**Status:** Draft
**Author:** Andrej
**Date:** 2026-03-08

---

## 1. Problem Statement

Motorcycle owners spend hundreds to thousands of dollars per year on fuel, maintenance, parts, and gear but have no centralized way to track those costs within MotoLearn. Users currently rely on spreadsheets, notes apps, or simply don't track spending at all, which makes it difficult to budget, compare cost-of-ownership across bikes, or understand where money is going. Without visibility into spending patterns, riders are surprised by annual costs and struggle to make informed decisions about maintenance timing and bike ownership economics.

This is a natural extension of the Garage Dashboard: users already manage bikes and maintenance tasks inside MotoLearn, but the financial dimension is missing.

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| 1 | Riders can see their year-to-date spending at a glance | YTD total card renders within 1s on the Spendings tab |
| 2 | Riders understand *where* their money goes | Expenses are grouped by category with per-category subtotals |
| 3 | Logging an expense is fast enough to do at the gas pump | Add-expense flow completes in < 15 seconds (open sheet → save) |
| 4 | Foundation for future cost analytics (cost-per-mile, comparisons) | Data model supports querying by motorcycle, category, date range |

**User goal:** Know how much I've spent on my bike this year, broken down by category.
**Business goal:** Increase daily-active engagement by giving riders a reason to open the app after every ride or purchase.

---

## 3. Non-Goals

- **Multi-year trend charts or cost-per-mile analytics** — Valuable but premature; ship tracking first, analytics in v2 once we have data.
- **Receipt photo scanning / OCR** — Adds complexity and AI cost; keep the input manual for v1.
- **Recurring/scheduled expenses (e.g., insurance)** — Different UX pattern; better handled as a separate feature.
- **Currency conversion or multi-currency support** — MotoLearn currently operates single-currency; revisit when internationalizing.
- **Shared/multi-rider expense splitting** — Out of scope; bikes are single-owner entities.

---

## 4. User Stories

**As a motorcycle owner**, I want to see my year-to-date total spending on a specific bike so that I know how much it's costing me this year.

**As a motorcycle owner**, I want to see my expenses grouped by category (Fuel, Maintenance, Parts, Gear) so that I understand where the biggest costs are.

**As a rider who just filled up**, I want to quickly log a fuel expense with amount and date so that I capture costs in the moment before I forget.

**As a rider reviewing my spending**, I want to see each individual transaction (date, amount, optional description) within a category so that I can verify my records.

**As a motorcycle owner with multiple bikes**, I want expenses scoped to a specific motorcycle so that I can compare cost-of-ownership between bikes.

**As a new user**, I want to see a meaningful empty state on the Spendings tab so that I understand the feature and am motivated to log my first expense.

---

## 5. Requirements

### Must-Have (P0)

**5.1 — YTD Total Card**
Display a prominent card at the top of the Spendings tab showing the year-to-date expense total for the selected motorcycle.

Acceptance criteria:

- [ ] Card shows the summed total of all expenses for the current calendar year
- [ ] Amount is formatted with locale-appropriate currency symbol and separators
- [ ] Card label reads "Year to Date" with the current year (e.g., "2026")
- [ ] Card updates immediately after logging a new expense (optimistic or invalidation)
- [ ] Shows "$0" (or equivalent) when no expenses exist, not a loading spinner

**5.2 — Categorized Expense List**
Below the YTD card, display expenses grouped into four fixed categories: Fuel, Maintenance, Parts, Gear.

Acceptance criteria:

- [ ] Each category section shows its name, icon, and category subtotal
- [ ] Within each category, transactions are listed newest-first with date and amount
- [ ] Optional description text is shown when present
- [ ] Categories with zero expenses are either collapsed or hidden (design decision — see Open Questions)
- [ ] List supports pull-to-refresh

**5.3 — Add Expense FAB**
A floating action button on the Spendings tab opens the add-expense flow.

Acceptance criteria:

- [ ] FAB is visible and tappable while scrolling the expense list
- [ ] FAB opens a bottom sheet modal (`presentation: 'formSheet'`)
- [ ] FAB icon clearly communicates "add" (e.g., plus icon)

**5.4 — Add Expense Bottom Sheet**
A form sheet for logging a new expense with amount, category, date, and optional description.

Acceptance criteria:

- [ ] Custom numpad-style input for entering the dollar amount (no system keyboard for amount)
- [ ] Amount input shows formatted value with currency symbol as the user types
- [ ] Category selection is required; four options presented as tappable pills (Fuel, Maintenance, Parts, Gear)
- [ ] Date defaults to today; tapping opens a date picker to change
- [ ] Description is optional, free-text, max 200 characters
- [ ] "Save" button is disabled until amount > 0 and category is selected
- [ ] On success: dismiss sheet, invalidate queries, haptic feedback (iOS)
- [ ] On error: show inline error message, do not dismiss sheet
- [ ] Enter animation: `FadeInUp` / `SlideInUp`, under 300ms

**5.5 — GraphQL `expenses` Query**
A query that returns expenses for a motorcycle within a year, with YTD total and category grouping.

Acceptance criteria:

- [ ] Signature: `expenses(motorcycleId: ID!, year: Int!): ExpenseSummary!`
- [ ] `ExpenseSummary` includes `ytdTotal: Float!` and `categories: [CategoryGroup!]!`
- [ ] `CategoryGroup` includes `category: ExpenseCategory!`, `total: Float!`, `expenses: [Expense!]!`
- [ ] `Expense` includes `id`, `amount`, `category`, `description`, `date`, `createdAt`
- [ ] Protected by `GqlAuthGuard`; user can only see their own expenses
- [ ] Returns empty categories array and `ytdTotal: 0` when no data exists

**5.6 — GraphQL `logExpense` Mutation**
A mutation for creating a new expense record.

Acceptance criteria:

- [ ] Signature: `logExpense(input: LogExpenseInput!): Expense!`
- [ ] Input validated by Zod schema: `motorcycleId` (UUID), `amount` (positive number, max 99999.99), `category` (enum), `date` (YYYY-MM-DD), `description` (optional, max 200 chars)
- [ ] Validates that the motorcycle belongs to the authenticated user
- [ ] Returns the created expense
- [ ] Protected by `GqlAuthGuard`

**5.7 — Database Table & RLS**
An `expenses` table in Supabase with appropriate columns, indexes, and row-level security.

Acceptance criteria:

- [ ] Columns: `id` (UUID PK), `user_id`, `motorcycle_id` (FK), `amount` (numeric(10,2)), `category` (text, constrained), `description` (text, nullable), `date` (date), `created_at`, `updated_at`, `deleted_at` (nullable, soft-delete)
- [ ] Indexes on `(user_id, motorcycle_id, date)` and `(user_id, deleted_at)`
- [ ] RLS enabled: users can only access own expenses where `deleted_at IS NULL`
- [ ] Admin read-all policy
- [ ] `updated_at` auto-trigger

### Nice-to-Have (P1)

**5.8 — Delete Expense**
Swipe-to-delete on individual transactions with confirmation.

- [ ] Swipe gesture reveals delete action
- [ ] Confirmation alert before soft-deleting
- [ ] `deleteExpense(id: ID!): Boolean!` mutation

**5.9 — Edit Expense**
Tap a transaction to open the bottom sheet pre-filled for editing.

- [ ] `updateExpense(id: ID!, input: UpdateExpenseInput!): Expense!` mutation
- [ ] Only owner can edit

**5.10 — Monthly Subtotal**
Within each category, optionally group transactions by month with month subtotals.

### Future Considerations (P2)

**5.11 — Cost-per-mile calculation** — Requires odometer readings (separate feature). Design the expense data model so it can be joined with mileage data later.

**5.12 — Year-over-year comparison** — Show spending trends across years. The `year` parameter on the query already supports this.

**5.13 — Export to CSV** — Allow riders to export expense history for tax or personal records.

**5.14 — Budget alerts** — Notify riders when category spending approaches a user-defined threshold.

---

## 6. Technical Design Notes

These are not prescriptive but capture patterns from the existing codebase to guide implementation.

**New files (following existing conventions):**

```
supabase/migrations/
  000XX_create_expenses_table.sql

packages/types/src/
  validators/expense.ts              # Zod schemas + inferred types
  constants/enums.ts                 # Add ExpenseCategory const

apps/api/src/modules/expenses/
  expenses.module.ts
  expenses.resolver.ts
  expenses.service.ts
  models/expense.model.ts            # @ObjectType()
  models/expense-summary.model.ts    # @ObjectType() for grouped response
  models/category-group.model.ts
  dto/log-expense.input.ts           # @InputType()

apps/mobile/src/graphql/
  queries/expenses-by-motorcycle.graphql
  mutations/log-expense.graphql

apps/mobile/src/app/(tabs)/(garage)/
  spendings.tsx                      # or integrate into existing garage tab
  add-expense.tsx                    # formSheet modal
```

**Expense category enum** (as const, not TypeScript enum):
```typescript
export const ExpenseCategory = {
  FUEL: 'fuel',
  MAINTENANCE: 'maintenance',
  PARTS: 'parts',
  GEAR: 'gear',
} as const;
```

**Amount storage:** Use `numeric(10,2)` in Postgres and `Float` in GraphQL. Perform all summing in SQL (`SUM(amount)`) for accuracy, not in application code.

**Query strategy:** A single `expenses` query that returns the full YTD summary with categories. The API service computes `ytdTotal` and category totals via SQL aggregation, then attaches the individual expense rows. This avoids N+1 queries and keeps the mobile client simple (one query, one cache key).

**Numpad component:** A custom React Native component that renders digit buttons (0-9, decimal, backspace) and manages a string-based amount state, formatting it on display. No system keyboard involved. Follow the existing pill-selector pattern for button styling with `borderCurve: 'continuous'` and haptic feedback.

---

## 7. Success Metrics

| Metric | Type | Target (30 days post-launch) | Stretch |
|--------|------|------------------------------|---------|
| Adoption rate | Leading | 40% of active garage users log ≥1 expense | 60% |
| Logging frequency | Leading | Average 3+ expenses/week among adopters | 5+/week |
| Task completion rate | Leading | 90% of users who open the sheet successfully save | 95% |
| Time-to-log | Leading | Median < 12 seconds (open → save) | < 8s |
| Garage DAU lift | Lagging | +15% daily active users on Garage tab | +25% |
| Retention impact | Lagging | +5pp 7-day retention among expense loggers vs. non-loggers | +10pp |

**Measurement:** Analytics events on `expense_sheet_opened`, `expense_logged`, `expense_deleted` with timestamps. YTD card impressions tracked via screen-view events on Spendings tab.

---

## 8. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should empty categories be hidden entirely or shown collapsed with "$0"? | Design | Yes — affects layout and empty state |
| 2 | Should the Spendings tab be a new tab in the Garage, or a section within the existing bike detail screen? | Design / PM | Yes — affects navigation structure |
| 3 | Do we need an "Other" expense category for items that don't fit the four fixed categories? | PM | No — can add later without schema change |
| 4 | Should amount input support cents (decimal)? Or round to whole dollars? | PM | Yes — affects numpad design and validation |
| 5 | What currency symbol to display? Hardcode "$" or derive from device locale? | Engineering | No — start with "$", localize in v2 |

---

## 9. Timeline Considerations

- **No hard deadline** — this is a feature enhancement, not a compliance or contractual commitment.
- **Dependency:** Requires the Garage Dashboard bike-detail screen to exist (already shipped).
- **Suggested phasing:**
  - **Phase 1 (P0):** DB migration, API (query + mutation), mobile Spendings tab with YTD card, category list, and add-expense sheet. Ship and measure.
  - **Phase 2 (P1):** Edit/delete, monthly grouping. Ship based on Phase 1 adoption data.
  - **Phase 3 (P2):** Cost-per-mile, year-over-year, export. Plan based on user feedback.
