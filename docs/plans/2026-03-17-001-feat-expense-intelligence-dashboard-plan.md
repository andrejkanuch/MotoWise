---
title: "feat: Expense Intelligence Dashboard"
type: feat
status: completed
date: 2026-03-17
deepened: 2026-03-17
---

# Expense Intelligence Dashboard

## Enhancement Summary

**Deepened on:** 2026-03-17
**Agents used:** architecture-strategist, performance-oracle, security-sentinel, code-simplicity-reviewer, best-practices-researcher

### Key Improvements from Deepening
1. **New `expenseDashboard` server-side resolver** — replaces 3 redundant client queries with a single aggregated query (90% payload reduction)
2. **Simplified file structure** — reduced from 8 new files to 5 (dropped Zustand store, separate utils, inline small components)
3. **Critical gifted-charts configuration** — documented key props, font override requirement (defaults to Comic Sans MS), memoization requirements
4. **TanStack Query `useQueries` with `combine`** — proper parallel query pattern with structural sharing
5. **Security hardening** — year range validation, shared expense model restrictions for Phase 2

---

## Overview

Transform MotoVault's flat expense list into an interactive visual dashboard with summary cards, donut chart, stacked bar trend chart, time period selector, and recent expenses. A new lightweight `expenseDashboard` GraphQL resolver returns pre-aggregated data, keeping the client simple. Phase 1 focuses on single-bike insights; Phase 2 adds multi-bike comparison.

## Problem Statement

MotoVault captures expense data across 4 categories (fuel, maintenance, parts, gear) per motorcycle, including auto-generated expenses from completed maintenance tasks. Yet the mobile app presents this as a flat chronological list with no charts, trends, cost-per-mile calculations, or exportable summaries. Users can't visualize spending patterns, leading to logging fatigue and churn.

## Proposed Solution

Build a dedicated Expense Dashboard screen accessible from the bike detail view. The dashboard provides:

1. **Summary cards** — YTD, all-time, cost-per-mile, expense count
2. **Category donut chart** — tappable segments showing spend distribution
3. **Monthly stacked bar chart** — 12-month trend by category
4. **Time period selector** — This Year / Last Year / All Time
5. **Recent expense list** — top 10 with swipe-to-delete

## Technical Considerations

### Charting Library: `react-native-gifted-charts`

**Decision:** Use `react-native-gifted-charts` (v1.4.76+).

**Rationale:**
- All 3 required chart types (donut, stacked bar, horizontal bar) are first-class
- Zero new native dependencies — uses `react-native-svg` (already installed) + `expo-linear-gradient` (already installed)
- Active maintenance (March 2026 release)
- Minimal bundle size (JS only, no Skia)
- Works in Expo Go — no dev client rebuild needed
- `onPress` per donut segment built-in

**Rejected alternatives:**
- `victory-native` + Skia: 4-6 MB binary bloat, requires dev client, overkill for 3 charts
- Custom SVG: 3-5 days extra dev time for what gifted-charts provides out of the box
- `react-native-chart-kit`: Abandoned, no donut, no tap interaction
- `react-native-wagmi-charts`: No pie/bar/donut support

#### Gifted Charts — Critical Implementation Details

**Donut chart key props:**
- `donut={true}`, `radius`, `innerRadius` for the hole
- `centerLabelComponent={(selectedIndex) => JSX}` — renders dynamic content in the donut hole; receives index of tapped segment (-1 = none selected)
- `focusOnPress={true}` — pressed segment enlarges
- `onPress` per `pieDataItem` for segment tap handling
- `isAnimated={true}`, `animationDuration={300}` — keep under 300ms per CLAUDE.md

**Stacked bar chart key props:**
- Use `stackData` prop (NOT `data`) — they are mutually exclusive
- Each entry: `{ stacks: [{ value, color, onPress }], label: 'Jan' }`
- `barWidth={20}`, `spacing={10}` — fits 12 bars on screen
- `noOfSections`, `maxValue` for Y-axis scaling
- `stackBorderRadius` for rounded top/bottom segments

**Critical gotchas:**
- **Override default font** — gifted-charts defaults to Comic Sans MS. Always set `xAxisLabelTextStyle={{ fontFamily: 'PlusJakartaSans-Medium', ... }}` and `yAxisTextStyle` with the design system font
- **Memoize data arrays** — chart re-renders on every reference change. Always wrap `pieData`/`stackData` in `useMemo`
- **Wrap chart components in `React.memo`** — prevents unnecessary re-renders when parent state changes
- **No built-in dark mode** — pass all colors explicitly via props; this is fine since we control everything via `palette.*`
- **Import types:** `import { pieDataItem } from 'react-native-gifted-charts'`

### API Strategy: Server-Side Aggregation

**Decision:** Add a lightweight `expenseDashboard` GraphQL resolver that returns pre-aggregated monthly buckets. This replaces the original plan of 3 parallel client-side queries.

**Rationale (from performance review):**
- The original approach (3 parallel `expenses()` queries) sends overlapping raw data 3 times — the all-time response is a superset of the other two
- For a user with 300 expenses, that's ~90KB of redundant JSON vs ~2KB of aggregates
- Client-side `reduce()` over hundreds of records is wasteful on the JS thread
- With aggregates, time period selector becomes a pure client-side filter — instant, no network call

**New GraphQL types:**

```graphql
type MonthlyBucket {
  month: Int!
  year: Int!
  fuel: Float!
  maintenance: Float!
  parts: Float!
  gear: Float!
  total: Float!
}

type ExpenseDashboardSummary {
  currentYearTotal: Float!
  previousYearTotal: Float!
  allTimeTotal: Float!
  expenseCount: Int!
  monthlyBuckets: [MonthlyBucket!]!
  categoryTotals: [CategoryTotal!]!
  recentExpenses: [Expense!]!  # 10 most recent
}
```

**SQL aggregation** (single query via Supabase):

```sql
SELECT
  EXTRACT(year FROM date)::int AS yr,
  EXTRACT(month FROM date)::int AS mo,
  category,
  SUM(amount) AS total
FROM expenses
WHERE user_id = $1
  AND motorcycle_id = $2
  AND deleted_at IS NULL
GROUP BY yr, mo, category
ORDER BY yr DESC, mo DESC;
```

This leverages the existing composite index `idx_expenses_user_motorcycle_date`. The NestJS service slices the result into current year, previous year, and all-time aggregates in O(n) where n is the number of distinct (year, month, category) tuples — typically under 100 even for a decade of data.

**Fallback:** If the resolver adds too much scope, fall back to 2 parallel client queries using `year: currentYear` and `year: 0` (all-time). Use `year: 0` — NOT `year: null` — because the existing `.graphql` operation types `$year` as `Int!`. The service already treats `year === 0` as "all time" (line 52: `if (year && year > 0)`). The existing `ExpensesSection` uses this convention at line 266.

### Navigation Entry Point

**Decision:** New screen at `apps/mobile/src/app/(tabs)/(garage)/expense-dashboard.tsx`.

**Entry:** "View Insights" button added to the existing `ExpensesSection` header in `bike/[id].tsx`.

**Params:** Receives `motorcycleId` via route params.

**Screen registration:** Add to `_layout.tsx` with `presentation: 'card'` (standard push navigation, NOT `formSheet` — that's reserved for modal input flows in this codebase).

### State Management: Time Period

**Decision:** `useState` in the dashboard screen component. No Zustand store.

**Rationale (from simplicity review):** The time period is consumed by a single screen. The existing `expenses-section.tsx` manages its year filter with `useState`. With Expo Router's Stack, the dashboard stays mounted when pushing `add-expense` as a formSheet, so `useState` survives that navigation. A Zustand store for a single enum value is overkill — the existing stores (`auth.store.ts`, `diagnostic-flow.store.ts`) serve genuinely cross-cutting, complex state.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Donut interaction | Center label in donut hole via `centerLabelComponent` | Better than tooltip (no finger occlusion on mobile) |
| Monthly chart under "All Time" | Most recent 12 months | Full history would be unreadable |
| Bar chart tap interaction | View-only for V1 | Donut already shows category breakdown; bar tap is gold-plating |
| YoY comparison | Hide when prev year = $0 | Avoids misleading ∞% for new users |
| Cost-per-mile denominator | Odometer as-is | Known limitation; `purchaseMileage` is P2 |
| Currency | Hardcode USD (matches existing) | Multi-currency is a separate PRD |
| Time period options | 3 fixed (This Year / Last Year / All Time) | Custom year picker deferred |
| Chart enter animation | Wrap with Reanimated FadeInUp | Matches existing app patterns |
| Loading state | `ActivityIndicator` (not skeleton) | Matches existing codebase pattern in `expenses-section.tsx` |

## System-Wide Impact

### Interaction Graph
- Dashboard screen → `gqlFetcher(ExpenseDashboardDocument)` x1 → TanStack Query cache
- Time period toggle → `useMemo` filter over cached aggregates → instant chart update (no network call)
- Delete swipe → `gqlFetcher(DeleteExpenseDocument)` → invalidates `queryKeys.expenses.byMotorcycle(id)` → dashboard refetches
- "Log Expense" CTA → navigates to `add-expense.tsx` modal → on success, invalidates same query keys → dashboard auto-refreshes

### Error Propagation
- Network failure → TanStack Query `isError` state → error UI with retry button using `refetch()`
- Delete mutation failure → Alert dialog with error message (existing pattern from `expenses-section.tsx`)
- No cascading failures — dashboard is read-only except for delete

### State Lifecycle Risks
- Time period in `useState` is component-scoped — no orphan risk
- Delete mutation + query invalidation is atomic from UI perspective (TanStack Query handles refetch)

### API Surface Parity
- New `expenseDashboard(motorcycleId)` resolver (lightweight aggregation)
- Existing `expenses(motorcycleId, year)` query unchanged — still used by `ExpensesSection`
- `myMotorcycles` query provides bike metadata (mileage, unit, photo)

## Acceptance Criteria

### R0: Server-Side Aggregation (New)
- [ ] New `ExpenseDashboardSummary` GraphQL ObjectType with monthly buckets, category totals, counts
- [ ] New `expenseDashboard(motorcycleId: String!)` resolver returning pre-aggregated data
- [ ] Service method uses `GROUP BY year, month, category` SQL — no raw row fetching
- [ ] Separate query for 10 most recent expenses (with `.limit(10).order('date', { ascending: false })`)
- [ ] Add `@Args('motorcycleId', ParseUUIDPipe)` for UUID validation
- [ ] New `.graphql` operation file + run `pnpm generate`
- [ ] Files: `apps/api/src/modules/expenses/models/expense-dashboard.model.ts`, `expenses.service.ts` (new method), `expenses.resolver.ts` (new query), `apps/mobile/src/graphql/queries/expense-dashboard.graphql`

### R1: Summary Cards
- [ ] Display 4 cards: Total Spend YTD, Total Spend All-Time, Cost-per-Mile, Expense Count
- [ ] Format amounts as `$X,XXX.XX` using `Intl.NumberFormat`
- [ ] Show YoY comparison badge ("+12% vs 2025") when previous year has data
- [ ] Hide YoY badge when previous year total is $0
- [ ] Cost-per-mile card shows "—" with "Update mileage" link when `currentMileage` is null/0
- [ ] "Update mileage" navigates to edit-bike screen
- [ ] Respect `mileageUnit` — show "Cost/mi" or "Cost/km"
- [ ] File: `apps/mobile/src/components/expense-dashboard/summary-cards.tsx`

### R2: Category Donut Chart
- [ ] Donut chart with 4 segments: fuel (warning500), maintenance (primary500), parts (success500), gear (danger500)
- [ ] Tapping a segment updates center label with "$X,XXX (XX%)" via `centerLabelComponent`
- [ ] Default center label shows total amount
- [ ] Single-category data renders full circle
- [ ] Zero expenses renders empty state (no chart)
- [ ] Animated enter with `FadeInUp`
- [ ] Override font to Plus Jakarta Sans (gifted-charts defaults to Comic Sans MS)
- [ ] Wrap `pieData` in `useMemo`, component in `React.memo`
- [ ] File: `apps/mobile/src/components/expense-dashboard/category-donut.tsx`

### R3: Monthly Trend Bar Chart
- [ ] Stacked vertical bar chart using `stackData` prop (NOT `data`)
- [ ] Under "This Year": Jan–Dec of current year (future months empty)
- [ ] Under "Last Year": Jan–Dec of previous year
- [ ] Under "All Time": most recent 12 calendar months
- [ ] $0 months show as zero-height (not omitted)
- [ ] Bars stacked by category with consistent colors
- [ ] Y-axis auto-scales to max monthly spend
- [ ] View-only for V1 (no tap interaction — defer to V2)
- [ ] Override font to Plus Jakarta Sans
- [ ] Wrap `stackData` in `useMemo`, component in `React.memo`
- [ ] File: `apps/mobile/src/components/expense-dashboard/monthly-trend.tsx`

### R4: Time Period Selector
- [ ] Horizontal pill selector: "This Year" / "Last Year" / "All Time"
- [ ] Changing period triggers `useMemo` recomputation — NO network call (filters cached aggregates)
- [ ] `useState` in dashboard screen (no Zustand store)
- [ ] Resets to "This Year" on component mount
- [ ] Haptic feedback on iOS when toggling (guard with `process.env.EXPO_OS`)
- [ ] Inline in dashboard screen (~30 lines, not a separate component file)

### R5: Recent Expense List
- [ ] Show 10 most recent expenses from `recentExpenses` field (server-side limited)
- [ ] Each row: category icon/color, description (or category name), amount, date
- [ ] Swipe-to-delete: extract `SwipeableExpense` from `expenses-section.tsx` into shared component
- [ ] "See All" button navigates to full expense list
- [ ] Staggered FadeInUp animations: `delay(index * 50)`
- [ ] Recent expense list rendered inline in dashboard screen (uses shared `SwipeableExpense`)

### Empty State
- [ ] Zero expenses: illustration + "Log Your First Expense" CTA → navigates to `add-expense.tsx`
- [ ] Error state: centered message + "Retry" button using `refetch()`
- [ ] Inline in dashboard screen (not a separate component — matches existing pattern)

### Dashboard Screen
- [ ] New route: `apps/mobile/src/app/(tabs)/(garage)/expense-dashboard.tsx`
- [ ] Register in `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` with `presentation: 'card'`
- [ ] ScrollView with `paddingBottom: 100` (floating tab bar)
- [ ] Section ordering: Period Selector → Summary Cards → Donut → Monthly Trend → Recent Expenses
- [ ] Staggered section enter animations matching bike detail pattern
- [ ] `borderCurve: 'continuous'` on all rounded elements
- [ ] `ActivityIndicator` while query resolves (not skeleton — matches existing patterns)

### Integration Points
- [ ] Add "View Insights" button to `ExpensesSection` header in `bike/[id].tsx`
- [ ] Wire navigation with `motorcycleId` route param
- [ ] Extract shared constants from `expenses-section.tsx` to `lib/expense-constants.ts`: `CATEGORY_COLORS`, `CATEGORY_LABELS`, `formatCurrency`, `formatExpenseDate`
- [ ] Reuse `queryKeys.expenses.byMotorcycle(id)` — do NOT create separate dashboard query keys (ensures cache invalidation works across both views)

### Non-Functional
- [ ] p95 dashboard load < 3s on iPhone 12
- [ ] Charts render within 300ms of data availability
- [ ] Accessibility: `accessibilityLabel` on all chart segments
- [ ] Accessibility: `accessibilityActions` for swipe-to-delete alternative
- [ ] Dark mode: all chart colors from design system `palette.*`
- [ ] Use `process.env.EXPO_OS` for platform checks (not `Platform.OS`)
- [ ] TanStack Query: `staleTime: 5 * 60 * 1000` on dashboard query

### Security Requirements
- [ ] Add year range validation on `expenses` resolver: `z.number().int().min(2000).max(2100).optional()`
- [ ] New `expenseDashboard` resolver: `ParseUUIDPipe` on `motorcycleId` + `GqlAuthGuard`
- [ ] Service uses per-request user client (never `SUPABASE_ADMIN`) for all expense queries
- [ ] Phase 2: `expensesSummaryAll` must derive motorcycle list server-side (never accept client-supplied IDs)
- [ ] Phase 2: `SharedExpenseSummary` model for public share links — aggregates only, no individual records

## Success Metrics

- **Dashboard adoption**: 60% of active users view within 30 days
- **Expense logging frequency**: +30% avg expenses/user/month
- **Time-to-first-insight**: p95 < 5s from navigation to chart render
- **Error rate**: < 1% of dashboard loads result in error state

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| gifted-charts doesn't match design specs | Medium | Medium | Prototype donut + bar in isolation first; fall back to custom SVG if needed |
| gifted-charts font default (Comic Sans MS) | High | Low | Always override `xAxisLabelTextStyle` and `yAxisTextStyle` with Plus Jakarta Sans |
| Reanimated v4 + gifted-charts conflict | Low | High | gifted-charts uses RN Animated (separate from Reanimated); no conflict expected |
| New resolver adds scope to Phase 1 | Medium | Low | Resolver is lightweight (~50 lines); fallback to `year: 0` client query if needed |
| Chart data not memoized → re-render perf | High | Medium | Wrap all chart data in `useMemo`, components in `React.memo` |

## Implementation Phases

### Phase 1: Core Dashboard (This Plan)
1. Extract shared constants from `expenses-section.tsx` → `lib/expense-constants.ts`
2. Extract `SwipeableExpense` from `expenses-section.tsx` → shared component
3. Add `expenseDashboard` resolver + model + service method + migration (if needed)
4. Add `.graphql` operation + run `pnpm generate`
5. Install `react-native-gifted-charts`
6. Build custom hook: `useExpenseDashboard(motorcycleId)` — owns query + `useMemo` aggregation
7. Build components: SummaryCards, CategoryDonut, MonthlyTrend
8. Build dashboard screen with period selector, empty/error states inline
9. Register route in garage layout
10. Add "View Insights" button to `ExpensesSection`

### Phase 2: Multi-Bike Comparison (Future)
- New `expensesSummaryAll(year)` resolver (server-side motorcycle enumeration — never accept client IDs)
- Comparison view with side-by-side bike cards
- Mini horizontal bar charts per bike

### Phase 3: Pro Features (Future)
- PDF export (Pro-gated)
- Smart spending alerts (server-side computation only)
- Enhanced share link with restricted `SharedExpenseSummary` model (aggregates only)

## File Structure

```
apps/mobile/src/
├── app/(tabs)/(garage)/
│   ├── _layout.tsx                          # Add expense-dashboard route
│   └── expense-dashboard.tsx                # Dashboard screen (period selector + empty state inline)
├── components/expense-dashboard/
│   ├── summary-cards.tsx                    # R1: 4 metric cards
│   ├── category-donut.tsx                   # R2: Donut chart (React.memo wrapped)
│   └── monthly-trend.tsx                    # R3: Stacked bar chart (React.memo wrapped)
├── components/shared/
│   └── swipeable-expense.tsx                # Extracted from expenses-section.tsx
├── hooks/
│   └── use-expense-dashboard.ts             # Query + useMemo aggregation
└── lib/
    └── expense-constants.ts                 # CATEGORY_COLORS, CATEGORY_LABELS, formatCurrency, formatExpenseDate

apps/api/src/modules/expenses/
├── models/
│   └── expense-dashboard.model.ts           # ExpenseDashboardSummary, MonthlyBucket, CategoryTotal
├── expenses.resolver.ts                     # Add expenseDashboard query
└── expenses.service.ts                      # Add getDashboard method

apps/mobile/src/graphql/queries/
└── expense-dashboard.graphql                # New operation
```

## Sources & References

### Internal References
- Existing expense section: `apps/mobile/src/components/bike-hub/expenses-section.tsx`
- Expense resolver: `apps/api/src/modules/expenses/expenses.resolver.ts`
- Expense service: `apps/api/src/modules/expenses/expenses.service.ts`
- ExpenseSummary model: `apps/api/src/modules/expenses/models/expense-summary.model.ts`
- Design system palette: `packages/design-system/src/palette.ts`
- Category colors: fuel=warning500, maintenance=primary500, parts=success500, gear=danger500
- Animation patterns: `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` (staggered FadeInUp)
- Health score ring (SVG animation example): `apps/mobile/src/components/HealthScoreRing.tsx`
- Query keys: `apps/mobile/src/lib/query-keys.ts:44`
- Bike detail screen: `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`
- Garage layout: `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx`
- Year=0 convention for all-time: `expenses-section.tsx:266`, `expenses.service.ts:52`

### Institutional Learnings
- RLS motorcycle ownership check required on all expense operations: `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md`
- Never use adminClient for user-scoped queries: `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`
- GraphQL contract drift prevention (run `pnpm generate` after resolver changes): `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- Tab screen color patterns (use `palette.*` for native, `paddingBottom: 100` for tab bar): `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md`
- Zustand + useEffect gotchas (use `store.getState()` in effects): `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md`
- Service method patterns (explicit columns, `.limit()`, `.map((row) => this.mapRow(row))`): `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`

### External References
- react-native-gifted-charts docs: https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts
- PieChart props: https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/blob/master/docs/PieChart/PieChartProps.md
- BarChart props: https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/blob/master/docs/BarChart/BarChartProps.md
- TanStack Query useQueries: https://tanstack.com/query/v5/docs/framework/react/reference/useQueries
