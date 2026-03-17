---
title: "Expense Dashboard: Server-Side Aggregation + Gifted Charts Integration"
category: integration-issues
date: 2026-03-17
tags: [graphql, aggregation, react-native-gifted-charts, expense, dashboard, performance, useMemo, TanStack Query]
module: expenses
symptom: "Flat expense list with no visual insights; multiple redundant client queries for dashboard data"
root_cause: "No server-side aggregation endpoint; charting library selection and hook-ordering issues with React.memo + early returns"
---

# Expense Dashboard: Server-Side Aggregation + Gifted Charts Integration

## Problem

MotoVault's expense feature returned raw expense records via `expenses(motorcycleId, year)` grouped by category. Building a dashboard required:
1. Multiple redundant queries (current year, previous year, all-time) — the all-time response is a superset of the other two
2. Client-side `reduce()` over hundreds of records to compute monthly buckets
3. A charting library compatible with Expo 55 / React Native 0.83 / New Architecture

## Root Cause

The existing API was designed for a flat list view, not aggregated insights. No GROUP BY aggregation existed server-side. The naive approach (3 parallel client queries + JS aggregation) would send ~90KB of redundant JSON for a user with 300 expenses vs ~2KB of aggregates.

## Solution

### 1. Server-Side Aggregation Resolver

Added `expenseDashboard(motorcycleId)` GraphQL query that fetches only `amount, category, date` columns and aggregates in TypeScript using a `Map<string, Record<string, number>>` keyed by `year-month`:

```typescript
// apps/api/src/modules/expenses/expenses.service.ts
async getDashboard(userId: string, motorcycleId: string): Promise<ExpenseDashboardSummary> {
  const supabase = this.supabaseUserFactory(userId); // per-request RLS client
  const { data } = await supabase
    .from('expenses')
    .select('amount, category, date')
    .eq('user_id', userId)
    .eq('motorcycle_id', motorcycleId)
    .is('deleted_at', null)
    .limit(5000);

  // Aggregate in-memory: build monthlyBuckets, categoryTotals, year totals
  const bucketMap = new Map<string, Record<string, number>>();
  // ... group by year-month-category
}
```

Key: returns `ExpenseDashboardSummary { currentYearTotal, previousYearTotal, allTimeTotal, expenseCount, monthlyBuckets[], categoryTotals[] }` — all pre-computed, no raw records.

### 2. Charting Library: react-native-gifted-charts

**Chosen**: `react-native-gifted-charts` v1.4.76+

**Why not others**:
- `victory-native` + Skia: adds 4-6MB binary, requires dev client rebuild
- Custom SVG: 3-5 days extra development
- `react-native-chart-kit`: abandoned, no donut support

**Critical gotchas discovered**:
- **Default font is Comic Sans MS** — always override `xAxisLabelTextStyle` and `yAxisTextStyle`
- **Use `stackData` prop (NOT `data`)** for stacked bar charts — they are mutually exclusive
- **`centerLabelComponent`** receives `selectedIndex` for dynamic donut center labels
- **Hooks before early returns**: `useMemo` inside `React.memo` components cannot be placed after an early `return null`. Move the early-return check into the `useMemo` computation and return a flag instead:

```typescript
// ❌ Wrong: hook after conditional return (lint error: useHookAtTopLevel)
const allZero = buckets.every(b => b.total === 0);
if (allZero) return null;
const { stackData } = useMemo(() => { ... }, [buckets]);

// ✅ Correct: compute flag inside useMemo, return after
const { stackData, allZero } = useMemo(() => {
  const isEmpty = buckets.every(b => b.total === 0);
  if (isEmpty) return { stackData: [], maxValue: 400, allZero: true };
  // ... build data
  return { stackData: data, maxValue: rounded, allZero: false };
}, [buckets]);
if (allZero) return null;
```

### 3. Client-Side Period Filtering (No Network Call)

The dashboard query returns ALL monthly buckets (all years). Time period selection filters in `useMemo` — instant, no spinner:

```typescript
const filteredBuckets = useMemo(() => {
  switch (period) {
    case 'thisYear': return buckets.filter(b => b.year === currentYear);
    case 'lastYear': return buckets.filter(b => b.year === previousYear);
    case 'allTime': return [...buckets].sort(...).slice(0, 12).reverse();
  }
}, [dashboard, period]);
```

### 4. SwipeableExpense Extraction

The `SwipeableExpense` component (130 lines, gesture handler + reanimated) was duplicated between ExpensesSection and the dashboard. Extracted to `components/shared/swipeable-expense.tsx`. Required props: `expense`, `isDark`, `index`, `onDelete`.

## Prevention

1. **When building dashboard/analytics features**: always add a dedicated aggregation resolver rather than reusing list endpoints. The payload difference is 10-50x.
2. **When using react-native-gifted-charts**: override the default font immediately, use `stackData` for stacked bars, and keep hooks before early returns in `React.memo` components.
3. **When extracting shared components**: ensure all required props are documented in the interface — TypeScript will catch missing props but only at the consumer site, not at extraction time.

## Related

- `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` — run `pnpm generate` after adding resolvers
- `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md` — paddingBottom: 100 for floating tab bar
- `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md` — RLS ownership pattern
- PR #33: https://github.com/andrejkanuch/MotoWise/pull/33
