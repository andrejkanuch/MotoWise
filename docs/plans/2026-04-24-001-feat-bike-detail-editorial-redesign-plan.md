---
title: "feat: Bike detail editorial redesign with bottom sheets"
type: feat
status: active
date: 2026-04-24
deepened: 2026-04-24
---

# Bike Detail Editorial Redesign + Bottom Sheets

## Enhancement Summary

**Deepened on:** 2026-04-24
**Research agents used:** LinearGradient patterns, MyRides query analysis, SwipeableTaskCard analysis, Editorial UI components, Garage layout routes

### Key Findings
1. **Reuse editorial primitives**: `EStat`, `EKicker`, `EPriority`, `EDisplay`, `EDisplayAccent` all exist in `components/ui/editorial.tsx` — use them instead of building from scratch
2. **MyRides query ready**: `MyRidesDocument` already supports `motorcycleId` filter + returns `totalCount` — no API changes needed for rides stat
3. **LinearGradient pattern**: Home screen already uses `['transparent', 'rgba(0,0,0,0.65)']` with `locations={[0.35, 1]}` for hero overlay — follow same pattern
4. **complete-task route exists**: Already a formSheet modal for recording completed tasks — evaluate if `record-maintenance` (B3) should extend or replace it
5. **EPriority component exists**: Pill badge with colored dot + tinted bg + border — use directly in task cards instead of custom implementation

### Critical Implementation Notes
- Use `tint(theme.warm, 0.15)` for wrench icon circle bg (from `editorial.ts` helper)
- Hero gradient: use theme-aware `theme.bg` for bottom fade (not hardcoded rgba like home screen)
- Stats values: add `fontVariant: ['tabular-nums']` for numeric alignment
- MyRides query: use `first: 1` to minimize payload, read `totalCount` only
- Cost/km: compute from `ExpensesByMotorcycleDocument` (year: 0) `ytdTotal / bike.currentMileage`

## Overview

Redesign the bike detail screen and its three bottom sheets (Add task, Add expense, Record maintenance) to match the Claude design mockup. The redesign applies the editorial magazine aesthetic with Instrument Serif typography, warm copper accents, grouped card layouts, and editorial kicker labels.

## Problem Statement / Motivation

The current bike detail screen uses a functional but generic layout. The design mockup introduces a cohesive editorial aesthetic with:
- Smoother hero gradient transitions
- Simplified health score display (text badge vs ring)
- Weighted quick action buttons
- A new at-a-glance stats row
- Editorial typography in section headers
- Completely redesigned bottom sheets with kicker + serif title patterns

## Proposed Solution

### Part A: Bike Detail Screen (`bike/[id].tsx`)

#### A1. Hero Gradient — Replace View blocks with LinearGradient

**Current** (lines 570-589): Two solid `View` blocks — top at `{theme.bg}80` (30% height), bottom at solid `theme.bg` (45% height).

**Target**: Use `expo-linear-gradient` for smooth transitions:

```tsx
// apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx
import { LinearGradient } from 'expo-linear-gradient';

// Replace the two View gradient blocks with:
<LinearGradient
  colors={['rgba(0,0,0,0.3)', 'transparent']}
  locations={[0, 0.6]}
  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }}
/>
<LinearGradient
  colors={['transparent', theme.bg]}
  locations={[0.3, 1]}
  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
/>
```

#### A2. Health Score — Ring to Text Badge

**Current** (lines 701-715): `HealthScoreRing` + percentage text.

**Target**: Green text badge `● {score}% ready` next to mileage pill.

```tsx
// Replace HealthScoreRing block with:
{tasks.length > 0 && healthScore.hasData && (
  <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 999,
  }}>
    <View style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: healthScore.score >= 75
        ? palette.editorialSuccess
        : healthScore.score >= 40
          ? palette.warning500
          : palette.editorialDanger,
    }} />
    <Text style={{ fontSize: 12, fontWeight: '600',
      color: healthScore.score >= 75
        ? palette.editorialSuccess
        : healthScore.score >= 40
          ? palette.warning500
          : palette.editorialDanger,
    }}>
      {healthScore.score}% ready
    </Text>
  </View>
)}
```

#### A3. Quick Actions — Weighted Layout

**Current** (lines 727-844): Four equal `flex: 1` buttons.

**Target**: "Add task" (warm filled, wider) + "Expense" (outlined, medium) + Edit icon-only + More icon-only.

- `Add task`: `flex: 2`, warm background, wrench icon + text
- `Expense`: `flex: 1.5`, outlined, dollar icon + text
- Edit: fixed 48px width, outlined, icon only
- More: fixed 48px width, outlined, icon only

All icon-only buttons get `accessibilityLabel` props.

#### A4. NEW Stats Cards Row

**Insert between quick actions and maintenance section.**

Three equal `flex: 1` cards:

| Card | Label | Value | Source |
|---|---|---|---|
| COST / KM | uppercase kicker | `formatCurrency(ytdTotal / currentMileage)` | New `useQuery(ExpensesByMotorcycleDocument)` |
| RIDES | uppercase kicker | ride count number | New `useQuery(MyRidesDocument, { motorcycleId })` using `totalCount` |
| ANALYTICS | uppercase kicker | `View →` in warm color | Navigate to `expense-dashboard` route |

**Data sources:**
- Cost/km: Fetch `ExpensesByMotorcycleDocument` with `year: 0` (all time), divide `ytdTotal` by `bike.currentMileage`. Show `--` when mileage is 0 or no expenses.
- Rides: Fetch `MyRidesDocument` with `first: 1, motorcycleId: id`, read `totalCount`. Show `0` when none.
- Analytics: Static link to `/(tabs)/(garage)/expense-dashboard`.

Use `EStat`-like styling: `theme.surface` bg, `theme.line` border, 14px radius, uppercase 10px label (letterSpacing: 1), large 18px value.

#### A5. Maintenance Section Title — Serif Italic

**File**: `apps/mobile/src/components/bike-hub/maintenance-section.tsx` (line 139-147)

Change title from system font bold to Instrument Serif italic:

```tsx
<Text style={{
  fontFamily: 'InstrumentSerif-Italic',
  fontSize: 24,
  color: isDark ? palette.neutral50 : palette.neutral950,
}}>
  {t('bikeHub.maintenance', { defaultValue: 'Maintenance' })}
</Text>
```

#### A6. Maintenance Task Card — Priority Badge Styling

**File**: `apps/mobile/src/components/bike-hub/swipeable-task-card.tsx`

Update collapsed card to show:
- Left: Wrench icon in warm-tinted circle (`tint(theme.warm, 0.15)` background, warm icon color)
- Center: Task title (bold) + subtitle (description/interval text, muted)
- Right: Priority badge pill (`● HIGH` / `● MEDIUM` / `● CRITICAL`) with color-coded dot

---

### Part B: Bottom Sheet Redesigns

All three sheets share an **editorial header pattern**:

```
— KICKER_LABEL (uppercase, tracked, theme.ink3)
Display serif_word. (InstrumentSerif-Regular + italic warm word)
                                                    [X close]
```

All use:
- `presentation: 'formSheet'` (already configured in `_layout.tsx`)
- Warm cream sheet background (`theme.bg` or `palette.editorialLightBg`)
- Section labels: uppercase, letterSpacing: 1.5, 10px, `theme.ink3`
- Grouped card backgrounds for related fields
- Bottom footer: "Cancel" text link + warm-filled "Save" CTA button
- `borderCurve: 'continuous'` on all rounded elements

#### B1. Add Task Sheet (`add-maintenance-task.tsx`)

**Design spec** (from mockup):

```
— MAINTENANCE
New task.                                            [X]

TASK
[ Oil change, chain lube, brake pads...          ]

PRIORITY
[● Low] [● Medium*] [● High] [● Critical]

SCHEDULE
┌ 📅 Due date                    Jun 15, 2026  › ┐
│ ⊙ At mileage                      20,000 km  › │
└────────────────────────────────────────────────┘

OPTIONS
┌ 🔄 Repeat                              [toggle] ┐
│ 🔔 Remind me                   3 days before  › │
└──────────────────────────────────────────────────┘

Cancel                        [ Save task ]
```

**Changes from current:**
1. Add editorial header: "MAINTENANCE" kicker + "New *task.*" serif title
2. Add uppercase section labels (TASK, PRIORITY, SCHEDULE, OPTIONS)
3. Change save button: orange/warm background instead of blue primary
4. Keep existing functionality (all state/mutations unchanged)
5. Style priority pills to match design (colored dot + label, selected has tinted bg + border)

#### B2. Add Expense Sheet (`add-expense.tsx`)

**Design spec** (from mockup):

```
— EXPENSES
Log an expense.                                      [X]

AMOUNT
┌ €  [ 0.00                                       ] ┐
└────────────────────────────────────────────────────┘

CATEGORY
[ Fuel ] [ Service ] [ Parts ] [ Tyres ] [ Gear ] [ Insurance ]

DETAILS
[ Note — vendor, part number, etc.                   ]

┌ Date                                    Today    › ┐
│ Odometer                           14,520 km    › │
│ Litres                               13.8 L     › │
│ Receipt photo                            Add    › │
└────────────────────────────────────────────────────┘

Cancel                      [ Save expense ]
```

**Changes from current:**
1. Add editorial header: "EXPENSES" kicker + "Log an *expense.*" serif title
2. Change category from dropdown to horizontal chip selector (6 main categories: Fuel, Service, Parts, Tyres, Gear, Insurance)
3. Add grouped details card with Date, Odometer, Litres, Receipt rows
4. Change save button: orange/warm background
5. Add Odometer field (new — currently not in add-expense)
6. Add Litres field (new — for fuel tracking, conditional on category=fuel)

#### B3. Record Maintenance Sheet (NEW route)

**Design spec** (from mockup):

```
— SERVICE LOG
Record maintenance.                                  [X]

SERVICE TYPE
┌ Oil change          Every 10,000 km              ┐
│ Tyre change         Every ~15,000 km             │
│ Chain service       Every 500 km                 │
│ Brake pads          Every 20,000 km              │
│ Valve check         Every 20,000 km              │
│ Other               Describe…                    │
└──────────────────────────────────────────────────┘

WHEN
┌ Service date                           Today   › ┐
│ Odometer reading                  14,520 km   › │
└──────────────────────────────────────────────────┘

COST
┌ €  [ 0.00                              ] [DIY] ┐
└────────────────────────────────────────────────────┘

NEXT REMINDER
┌ Remind me at 24,520 km                           ┐
│ Based on typical oil change interval              │
└──────────────────────────────────────────────────┘

Cancel                      [ Save to log ]
```

**This is a NEW screen** — `apps/mobile/src/app/(tabs)/(garage)/record-maintenance.tsx`. It records a completed service (vs. add-maintenance-task which schedules a future task). The screen:
- Presents common service types with OEM interval hints
- Records when it was done (date + odometer)
- Records cost + DIY toggle
- Auto-suggests next reminder based on service type interval
- Saves as a completed maintenance task

**Note**: This may require a new GraphQL mutation or reuse `CreateMaintenanceTask` with `status: 'completed'` and `completedAt` set.

## Files to Modify

### Bike Detail (Part A)
1. `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` — Hero gradient, health badge, quick actions, stats row
2. `apps/mobile/src/components/bike-hub/maintenance-section.tsx` — Serif italic title
3. `apps/mobile/src/components/bike-hub/swipeable-task-card.tsx` — Card redesign with icon circle + priority badge

### Bottom Sheets (Part B)
4. `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` — Editorial header + section labels + orange CTA
5. `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` — Editorial header + chip categories + grouped details + orange CTA
6. `apps/mobile/src/app/(tabs)/(garage)/record-maintenance.tsx` — NEW: Record completed maintenance sheet
7. `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` — Add route for record-maintenance with formSheet presentation

### Supporting
8. `apps/mobile/src/graphql/queries/my-rides.graphql` — May need to verify motorcycleId filter exists for ride count

## Technical Considerations

- **Colors**: All from `palette.*` via `useEditorialTheme()` — never hardcode hex
- **Fonts**: `InstrumentSerif-Regular`/`InstrumentSerif-Italic` for display; system font for body
- **Animations**: `FadeInUp.delay(N).duration(300)`, stagger by 40-80ms per section
- **Haptics**: `triggerImpact()` on all interactive elements
- **`borderCurve: 'continuous'`** on all rounded elements
- **`boxShadow`** CSS string format (not legacy shadow props)
- **`fontVariant: ['tabular-nums']`** on numeric stat values
- **Dark mode**: All new elements must use editorial theme tokens
- **oklch bug**: Never use `oklch()` in inline styles — always use hex from `palette.*`

## Acceptance Criteria

### Part A: Bike Detail
- [ ] Hero gradient uses `expo-linear-gradient` with smooth transition (A1)
- [ ] Health score shows as colored text badge `● {score}% ready` (A2)
- [ ] Quick actions: Add task wider/warm, Expense outlined/medium, Edit+More icon-only (A3)
- [ ] Stats row shows Cost/km, Rides count, Analytics link (A4)
- [ ] Maintenance title in Instrument Serif italic (A5)
- [ ] Task cards show wrench icon circle + priority badge (A6)
- [ ] All works in both light and dark mode
- [ ] Icon-only buttons have `accessibilityLabel`

### Part B: Bottom Sheets
- [ ] Add Task has editorial header, section labels, orange CTA (B1)
- [ ] Add Expense has editorial header, chip categories, orange CTA (B2)
- [ ] Record Maintenance is a new working sheet (B3)
- [ ] All sheets use formSheet presentation
- [ ] All sheets work in dark mode

## Edge Cases

- **No photo**: Gradient overlays still work on placeholder
- **0 rides / 0 expenses**: Stats show `0` / `--` respectively
- **0 mileage**: Cost/km shows `--` (avoid division by zero)
- **No health data**: Badge hidden (same as current ring behavior)
- **Long bike names**: Title wraps naturally with serif font
- **i18n**: Button labels may be longer in German/Slovak — flex layout handles wrapping

## MVP

### Implementation Order

1. Bike detail: Hero gradient (A1) — quick visual win
2. Bike detail: Health badge (A2) — simple replacement
3. Bike detail: Quick actions (A3) — layout change
4. Bike detail: Stats row (A4) — new data + UI
5. Bike detail: Maintenance section (A5+A6) — typography + card styling
6. Add Task sheet (B1) — editorial header + styling
7. Add Expense sheet (B2) — editorial header + chip categories
8. Record Maintenance sheet (B3) — new screen

## Sources

- Design mockup: `/Users/andrejmacm5/Downloads/MotoVault - Mobile _standalone_.html` — screens iOS-07 (Bike detail), iOS-Add task, iOS-Add expense, iOS-Add maintenance
- Editorial theme: `apps/mobile/src/theme/editorial.ts`
- Design system: `packages/design-system/src/palette.ts`
- EStat pattern: `apps/mobile/src/components/ui/editorial.tsx:303`
- Learnings: `docs/solutions/ui-bugs/tab-screen-implementation-color-centralization.md` (color system), `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md` (oklch bug)
