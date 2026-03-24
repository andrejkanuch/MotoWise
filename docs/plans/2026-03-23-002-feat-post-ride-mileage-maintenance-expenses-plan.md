---
title: "feat: Auto-apply ride mileage, trigger maintenance alerts, and post-ride expense flow"
type: feat
status: active
date: 2026-03-23
---

# Auto-Apply Ride Mileage, Trigger Maintenance Alerts & Post-Ride Expense Flow

## Overview

When a ride ends, the motorcycle's total mileage should automatically update. If any maintenance tasks have mileage-based thresholds that are now reached, the user should be notified. The ride summary screen should also offer a quick "Add Expense" action (fuel, tolls, etc.).

## Current State

| Feature | Status |
|---------|--------|
| Motorcycle `currentMileage` field | Exists in DB + GraphQL model |
| Ride `mileageApplied` flag | Exists but always `false` |
| `endRide` mutation | Saves ride stats but does NOT update bike mileage |
| Maintenance tasks with `targetMileage` | Fully implemented — tasks can have mileage thresholds |
| Push notifications | Not configured (only haptic + preferences UI) |
| Expenses | Full CRUD exists, but NOT accessible from ride flow |
| Ride summary screen | Shows stats + map + naming, but no mileage/expense actions |

## Proposed Solution

### Phase 1: Auto-Apply Mileage on Ride End

**Files:** `apps/api/src/modules/rides/rides.service.ts`

When `endRide` is called with a valid `distanceM` and the ride has a `motorcycleId`:

1. Add the ride's `distanceM` to the motorcycle's `currentMileage`
2. Set `mileage_applied = true` on the ride
3. Update `mileage_updated_at` on the motorcycle

```typescript
// rides.service.ts — inside endRide method, after updating ride stats
if (motorcycleId && distanceM > 0) {
  // Atomically increment motorcycle mileage
  const { data: bike } = await this.supabaseAdmin
    .from('motorcycles')
    .select('current_mileage')
    .eq('id', motorcycleId)
    .single();

  const newMileage = (bike?.current_mileage ?? 0) + distanceM;

  await this.supabaseAdmin
    .from('motorcycles')
    .update({
      current_mileage: newMileage,
      mileage_updated_at: new Date().toISOString(),
    })
    .eq('id', motorcycleId);

  // Mark ride as mileage-applied
  await this.supabaseAdmin
    .from('rides')
    .update({ mileage_applied: true })
    .eq('id', rideId);
}
```

### Phase 2: Check Maintenance Thresholds After Mileage Update

**Files:** `apps/api/src/modules/rides/rides.service.ts`, `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts`

After applying mileage, query pending maintenance tasks for this motorcycle where `target_mileage <= newMileage`:

```typescript
// After mileage update in endRide:
const { data: dueTasks } = await this.supabaseAdmin
  .from('maintenance_tasks')
  .select('id, title, target_mileage, priority')
  .eq('motorcycle_id', motorcycleId)
  .eq('status', 'pending')
  .not('target_mileage', 'is', null)
  .lte('target_mileage', newMileage);

// Return dueTasks in the endRide response so the client can show an alert
```

**Update the `EndRideResponse` model** to include triggered maintenance tasks:

```typescript
@ObjectType()
class TriggeredMaintenanceTask {
  @Field() id: string;
  @Field() title: string;
  @Field() priority: string;
}

// Add to EndRideResponse:
@Field(() => [TriggeredMaintenanceTask], { nullable: true })
triggeredMaintenanceTasks?: TriggeredMaintenanceTask[];
```

**On the mobile side (ride-summary.tsx):** If `triggeredMaintenanceTasks` is non-empty, show an alert/banner:
- "Maintenance Due: Oil Change (12,000 km reached)"
- Tappable to navigate to the maintenance detail screen

### Phase 3: Post-Ride Expense Quick-Add

**Files:** `apps/mobile/src/app/(modals)/ride-summary.tsx`

Add an "Add Expense" button below the ride name input on the summary screen. Tapping it opens a compact inline form or navigates to the expense screen pre-filled with:
- `motorcycleId` from the ride
- `date` = today
- `category` = 'fuel' (pre-selected, changeable)

**Simple approach — navigate to expense screen:**

```tsx
// ride-summary.tsx — add button after the ride name section
<Pressable
  onPress={() => router.push({
    pathname: '/(modals)/add-expense',
    params: { motorcycleId, rideId, date: new Date().toISOString() },
  })}
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: palette.surfaceSubtle,
    borderRadius: 14,
    borderCurve: 'continuous',
  }}
>
  <Receipt size={16} color={palette.neutral400} />
  <Text style={{ fontSize: 14, color: palette.neutral400 }}>Add Expense</Text>
</Pressable>
```

If no `add-expense` modal exists yet, create a simple one with:
- Amount input (numeric keyboard)
- Category picker (fuel, tolls, parking, other)
- Optional note
- Save button calling `logExpense` mutation

### Phase 4: Link Expenses to Rides (Optional Enhancement)

**Files:** Supabase migration, expense model

Add an optional `ride_id` column to the `expenses` table:

```sql
ALTER TABLE public.expenses ADD COLUMN ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL;
```

This allows querying "expenses for this ride" in the ride detail screen later.

## Acceptance Criteria

- [ ] When a ride ends with a linked motorcycle, the bike's `currentMileage` is incremented by `distanceM`
- [ ] `mileageApplied` is set to `true` on the ride after mileage is applied
- [ ] If any pending maintenance tasks have `targetMileage <= newMileage`, they are returned in the `endRide` response
- [ ] Ride summary screen shows a maintenance alert banner if tasks were triggered
- [ ] Ride summary screen has an "Add Expense" button that opens an expense form
- [ ] Expense form is pre-filled with the ride's motorcycle and today's date

## Files to Modify

| File | Change |
|---|---|
| `apps/api/src/modules/rides/rides.service.ts` | Add mileage update + maintenance check to endRide |
| `apps/api/src/modules/rides/models/ride.model.ts` | Add `TriggeredMaintenanceTask` type to response |
| `apps/api/schema.graphql` | Regenerated after model changes |
| `apps/mobile/src/app/(modals)/ride-summary.tsx` | Add maintenance alert banner + "Add Expense" button |
| `apps/mobile/src/graphql/mutations/end-ride.graphql` | Request `triggeredMaintenanceTasks` in response |
| `supabase/migrations/` | Optional: add `ride_id` to expenses table |

## Out of Scope

- Push notifications (no expo-notifications configured yet — separate effort)
- Inline expense form on ride summary (navigate to separate screen instead)
- Automatic fuel expense estimation based on ride distance
- Mileage correction/manual override on ride summary

## Sources

- Rides service: `apps/api/src/modules/rides/rides.service.ts`
- Maintenance service: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts`
- Expense resolver: `apps/api/src/modules/expenses/expenses.resolver.ts`
- Ride summary: `apps/mobile/src/app/(modals)/ride-summary.tsx`
- DB schema rides: `supabase/migrations/00047_create_rides_table.sql`
- DB schema maintenance: `supabase/migrations/00020_create_maintenance_tasks_table.sql`
- Learnings: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
