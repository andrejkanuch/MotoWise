---
title: iOS Widget Data Sync Failures — Multiple Root Causes
category: integration-issues
date: 2026-05-26
tags: [ios-widgets, expo-widgets, supabase, postgrest, widget-sync]
components: [widget-sync.ts, ride-analytics.service.ts, RideStatsWidget, LastRideWidget, ExpenseTrackerWidget]
severity: high
---

## Problem

All 4 iOS home screen widgets showed empty/error states despite the user having ride, expense, and maintenance data in Supabase. Symptoms varied by widget:

- **LastRideWidget**: "Complete your first ride" (empty state)
- **RideStatsWidget**: "Please adopt containerBackground API" (render crash)
- **ExpenseTrackerWidget**: "Please adopt containerBackground API" (render crash)
- **NextServiceWidget**: Working but showing stale data

## Root Causes (4 independent bugs)

### 1. Ambiguous PostgREST FK join (lastRide=null)

`getLastRide()` used `motorcycles(name)` in the Supabase `.select()`, but `rides` and `motorcycles` have TWO foreign key relationships (`rides.motorcycle_id → motorcycles.id` AND `motorcycles.odometer_last_ride_id → rides.id`). PostgREST returned error `PGRST201` which was silently ignored because only `data` was destructured from the response.

```typescript
// ❌ Ambiguous — PostgREST can't resolve which FK to follow
const { data } = await supabaseAdmin.from('rides')
  .select('id, motorcycle_id, motorcycles(name)')

// ✅ Fixed — separate query avoids the join ambiguity
const { data } = await supabaseAdmin.from('rides')
  .select('id, motorcycle_id')
// Then fetch motorcycle name separately
```

### 2. Wrong column name on ride_summaries (crash)

`getLastRide()` queried `ride_summaries.title` but the column is `summary_text`. The Supabase error was silently swallowed.

### 3. Widget never receives updateSnapshot (containerBackground error)

When a fetch returned `null` or was rejected, the corresponding widget's `updateSnapshot()` was never called. iOS WidgetKit renders a placeholder with `props: nil`, the JS runtime crashes on `props.hasData`, and iOS falls back to "Please adopt containerBackground API".

Fix: Always push empty state to every widget, even when fetches fail. Also add `!props ||` null-safety guard in every widget function.

### 4. Missing ride rollups (RideStatsWidget showing 0)

Rides inserted directly into the DB (e.g., via seeds) don't trigger the `ride.completed` event, so `record_ride_analytics` RPC never runs and `ride_rollups` stays empty. The `getThisWeek()`/`getThisMonth()` queries read from rollups, not from `rides` directly.

Fix: Manual backfill via `SELECT public.record_ride_analytics(...)` for each unprocessed ride.

## Prevention

- **Always destructure `error` from Supabase responses** in service methods that feed user-visible features. Log it even if the method returns a fallback.
- **When tables have multiple FK relationships**, avoid PostgREST embedded joins. Use separate queries or the `!fk_name` hint syntax.
- **Widget sync must call `updateSnapshot` for every widget on every sync cycle** — iOS WidgetKit shows a broken placeholder if no snapshot has ever been pushed.
- **Seed scripts that insert rides must also call `record_ride_analytics`** to populate rollups, or the rollup-dependent queries will return zeros.
