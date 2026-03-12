# Garage UX Overhaul — PRD + Architecture Spec

**Author:** Claude (AI-assisted)
**Date:** 2026-03-11
**Status:** Draft
**Related:** `docs/specs/maintenance-alerts-v2.md` (maintenance completion flow)

---

## 1. Problem Statement

The Garage section of MotoLearn has accumulated several UX and engineering issues that together make the motorcycle management experience frustrating:

**P1 — Ambiguous floating "+" button:** A generic `+` FAB appears on both the garage list (adds a bike) and the bike detail (adds a maintenance task). Users don't know what the `+` does in each context. The same icon is overloaded for three different actions (add bike, add task, add expense) with no visual distinction.

**P2 — Edit motorcycle sheet has massive blank space:** The edit-bike screen opens as a `formSheet` at 85% height, but only contains 5 small fields (nickname, year, make, model, primary toggle). This leaves approximately 40% of the sheet as empty white space between the grabber/header and the first input field (visible in the screenshot — the "NICKNAME" label doesn't appear until the very bottom of the sheet).

**P3 — Health score ring renders broken at small size:** The `HealthScoreRing` component uses hardcoded `fontSize: 32` for the score and `fontSize: 13` for the grade regardless of the `size` prop. When rendered at `size={64}` on the bike detail page, the text overflows the circle container, causing the "A" grade text to clip or overlap with the score number. The screenshot confirms this — the grade letter is partially cut off.

**P4 — Bike detail is a single endless scroll:** The bike detail page (1300+ lines) crams 11 distinct sections into one ScrollView: hero photo, bike info, mileage, health score, stat cards, upcoming tasks, spending summary, active tasks, completed tasks, export PDF, and delete bike. There's no logical grouping or navigation between sections. Users must scroll extensively to find what they need.

**P5 — No direct add-expense flow:** There is no dedicated "add expense" entry point. Expenses are only recorded as optional fields when completing a maintenance task. Users who want to log standalone expenses (fuel, insurance, gear) have no way to do so.

**P6 — Broken navigation routes:** The bike detail FAB navigates to `/(tabs)/(garage)/add-task` but the actual route is registered as `add-maintenance-task` in `_layout.tsx`. The FAB on the bike detail page is completely non-functional.

**P7 — Garage list route paths inconsistent:** The garage list uses `/(garage)/bike/${bike.id}` (missing `(tabs)` prefix) for bike card navigation and `/(garage)/add-bike` for the FAB. These work in some cases due to expo-router's relative resolution but are fragile and may break with navigation state changes.

---

## 2. Root Cause Analysis

### Edit Sheet Blank Space

**File:** `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` (line 60–71)

```typescript
sheetAllowedDetents: [0.85, 1.0],
```

The sheet opens at 85% of screen height (~720px on iPhone 15). The form content (5 fields + save button) only needs ~450px. The content starts at the top of the sheet body (below the header), but because the sheet itself is much taller than needed, the form sits at the top with a vast empty area below it. However, in the screenshot, the content appears pushed to the **bottom** — this is because `KeyboardAvoidingView` with `behavior="padding"` adds padding that pushes content down when no keyboard is active, combined with `flex: 1` on the ScrollView which spreads the content.

Actually, the real issue is simpler: the `ScrollView` has `flex: 1` and the content is only ~450px tall in a ~720px container. The scroll view fills the sheet but the content is top-aligned with a lot of empty space below. The screenshot shows the user has scrolled down and sees just the bottom fields, which means the content IS at the top but there's so much empty space that it looks like the sheet is mostly empty.

**Fix:** Use a smaller `sheetAllowedDetents` value (e.g., `[0.55, 0.85]`) or switch to a full-screen push navigation for editing.

### Health Score Ring Overflow

**File:** `apps/mobile/src/components/HealthScoreRing.tsx`

```typescript
const SIZE = 140;        // default
const STROKE_WIDTH = 10; // fixed

// Text sizes are hardcoded:
fontSize: 32,  // score number — "100"
fontSize: 13,  // grade letter — "A"
```

When called with `size={64}` from bike detail (line 956):
- Available inner diameter = 64 - 10 - 10 = 44px
- Score text "100" at fontSize 32 needs ~55px width → overflows
- Grade "A" at fontSize 13 placed at `marginTop: -2` clips against score

**Fix:** Scale font sizes proportionally to the `size` prop.

### FAB Route Mismatch

**File:** `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` (line 1296)

```typescript
pathname: '/(tabs)/(garage)/add-task', // ← WRONG
```

**File:** `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` (line 49)

```typescript
<Stack.Screen name="add-maintenance-task" ... /> // ← ACTUAL route name
```

**Fix:** Change to `/(tabs)/(garage)/add-maintenance-task`.

---

## 3. Design Proposal

### 3.1 Replace FABs with Contextual Action Bars

**Rationale:** A generic `+` FAB fails the "don't make me think" principle. Users on the garage list want to add a bike. Users on the bike detail want to add a task, an expense, or edit the bike. Each context needs different actions, and those actions should be labeled.

#### Garage List Screen

Replace the floating `+` FAB with an inline "Add Motorcycle" button at the top of the bike list, directly below the count text ("2 motorcycles"). This is more discoverable and removes ambiguity.

```
┌─────────────────────────────┐
│  < Garage                   │
│                             │
│  2 motorcycles              │
│  ┌─────────────────────┐    │
│  │  + Add Motorcycle    │   │  ← Primary button, inline
│  └─────────────────────┘    │
│                             │
│  ┌───────────────────────┐  │
│  │  [Gradient]           │  │
│  │  BMW G 310 GS         │  │
│  │  2020 · Service       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  [Gradient]           │  │
│  │  Honda CB650R         │  │
│  │  2023 · Service       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

#### Bike Detail Screen

Replace the floating `+` FAB with a **contextual quick-action bar** below the stat cards. This bar contains 2–3 labeled pill buttons:

```
┌─────────────────────────────┐
│ ┌─────────┐ ┌───────┐ ┌──┐ │
│ │+ Task   │ │$ Cost │ │⋯ │ │  ← Quick action bar
│ └─────────┘ └───────┘ └──┘ │
└─────────────────────────────┘
```

Each button is labeled and colored:
- **"+ Task"** (primary color) → opens add-maintenance-task sheet
- **"$ Cost"** (success/green color) → opens add-expense sheet (new)
- **"⋯"** (neutral) → opens action menu (Edit bike, Export PDF, Delete)

This eliminates the ambiguous FAB, provides clear affordances, and reduces the bike detail page's reliance on scrolling to find the Edit/Export/Delete buttons currently at the very bottom.

### 3.2 Fix Edit Motorcycle Sheet

Two options:

**Option A (Recommended): Smaller sheet detent**

Change `sheetAllowedDetents` from `[0.85, 1.0]` to `[0.55, 0.85]`. The sheet opens at 55% height (just enough for the 5 fields + save button), and can be pulled up to 85% if the user needs more space (e.g., keyboard). This eliminates the blank space problem entirely.

```typescript
// _layout.tsx
<Stack.Screen
  name="edit-bike"
  options={{
    sheetAllowedDetents: [0.55, 0.85], // ← smaller initial detent
    // ...rest unchanged
  }}
/>
```

Additionally, remove the `KeyboardAvoidingView` wrapper and rely on the sheet's native keyboard avoidance behavior (which is better for `formSheet` presentations on iOS).

**Option B: Full-screen push navigation**

Change `edit-bike` from a `formSheet` to a regular push navigation screen. This gives more room for future additions (photo management, VIN entry, insurance info) and avoids the sheet sizing problem entirely.

### 3.3 Fix Health Score Ring

Scale all internal dimensions proportionally to the `size` prop:

```typescript
export function HealthScoreRing({ score, grade, hasData, isDark, size = SIZE }: Props) {
  const scale = size / SIZE; // 64/140 = 0.457 for small variant
  const strokeWidth = STROKE_WIDTH * scale;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const scoreFontSize = Math.round(32 * scale);   // 32 → 15 at 64px
  const gradeFontSize = Math.round(13 * scale);    // 13 → 6 at 64px (too small)
  // Better: use min/max bounds
  const scoreFontSize = Math.max(14, Math.round(32 * scale));  // 14–32
  const gradeFontSize = Math.max(9, Math.round(13 * scale));   // 9–13
}
```

Additionally, clamp the score value to prevent animation bugs:

```typescript
const clampedScore = Math.min(100, Math.max(0, score));
progress.value = withTiming(hasData ? clampedScore / 100 : 0, { duration: 800 });
```

### 3.4 Restructure Bike Detail with Section Tabs

Replace the single endless scroll with a sectioned layout using a sticky tab bar:

```
┌─────────────────────────────┐
│ [Hero Photo / Gradient]     │
│ BMW G 310 GS                │
│ 2020 · 300 mi               │
│                             │
│ ┌──────────────────────────┐│
│ │ Overview │ Tasks │ Costs  ││  ← Sticky tab bar
│ └──────────────────────────┘│
│                             │
│  [Tab content below]        │
│                             │
└─────────────────────────────┘
```

**Tab: Overview** (default)
- Health score card (inline, current design but fixed)
- Stat cards (Upcoming / Overdue / Spend)
- Quick action bar (+ Task, $ Cost, ⋯)
- Upcoming tasks preview (top 5)

**Tab: Tasks**
- Full active task list with completion actions
- Completed task history (collapsible)
- "Add Task" button at top

**Tab: Costs**
- Spending summary (this year / all time)
- Cost history list (maintenance costs + standalone expenses)
- "Add Expense" button at top
- Export PDF button

This reduces the scroll depth per tab by 60–70% and lets users jump directly to what they need.

**Implementation:** Use a `StickyHeaderTabView` pattern (or `react-native-tab-view` with a header) where the hero + bike info section scrolls away but the tab bar sticks to the top.

### 3.5 Add Expense Flow (New Feature)

#### New route: `add-expense.tsx`

```
┌────────────────────────────┐
│  ─── Add Expense           │
│                            │
│  CATEGORY                  │
│  [Fuel ▼]                  │
│                            │
│  AMOUNT                    │
│  [$ ___________]           │
│                            │
│  DATE                      │
│  [Today ▼]                 │
│                            │
│  NOTE (OPTIONAL)           │
│  [________________]        │
│                            │
│  ┌──────────────────────┐  │
│  │     Save Expense      │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

Categories: Fuel, Insurance, Gear, Tires, Registration, Parts, Other

This requires a new database table (see Section 5).

---

## 4. Requirements

### P0 — Must-Have

**R1. Fix FAB route mismatch (bike detail)**
- Change `pathname` from `/(tabs)/(garage)/add-task` to `/(tabs)/(garage)/add-maintenance-task`
- Immediately unblocks the broken add-task navigation
- **Effort:** 5 minutes

**R2. Fix inconsistent route paths (garage list)**
- Standardize all route paths to include `(tabs)` prefix: `/(tabs)/(garage)/bike/${id}` and `/(tabs)/(garage)/add-bike`
- Audit and fix same issue in profile screen
- **Effort:** 30 minutes

**R3. Fix Health Score Ring text overflow**
- Scale `fontSize` proportionally to `size` prop with min/max bounds
- Clamp score to 0–100 range
- Scale `STROKE_WIDTH` proportionally
- Test at sizes: 48, 64, 80, 100, 140
- Acceptance criteria: score "100" + grade "A" fully visible and non-overlapping at all sizes
- **Effort:** 1 hour

**R4. Fix edit motorcycle sheet blank space**
- Change `sheetAllowedDetents` to `[0.55, 0.85]`
- Remove `KeyboardAvoidingView` wrapper (let sheet handle keyboard natively)
- Add `keyboardDismissMode="interactive"` to ScrollView
- Acceptance criteria: form fields are visible immediately when sheet opens with no large blank areas
- **Effort:** 30 minutes

**R5. Remove FAB from garage list**
- Replace floating `+` with inline "Add Motorcycle" button below the bike count
- Style as a secondary action button (outlined or subtle fill) so it doesn't compete with bike cards
- Acceptance criteria: no floating elements on the garage list screen
- **Effort:** 1 hour

**R6. Remove FAB from bike detail**
- Replace floating `+` with contextual quick-action bar below stat cards
- Bar contains labeled pill buttons: "+ Task" and "⋯ More"
- "⋯ More" opens ActionSheet with: Edit Bike, Export PDF, Delete Motorcycle
- Remove the edit pencil icon from the hero area (moved to More menu)
- Remove the Export PDF and Delete Motorcycle buttons from the bottom of the scroll (moved to More menu)
- Acceptance criteria: no floating elements on bike detail screen; all actions accessible via quick-action bar or More menu
- **Effort:** 3 hours

### P1 — Should-Have

**R7. Section tabs on bike detail**
- Add sticky tab bar with "Overview", "Tasks", "Costs" tabs
- Move content into appropriate tabs per Section 3.4
- Use `react-native-tab-view` or custom implementation with `Animated.ScrollView`
- Header (hero + bike info) scrolls with content; tab bar sticks
- **Effort:** 2–3 days

**R8. Add standalone expense flow**
- New `add-expense.tsx` route as `formSheet`
- New `expenses` database table (see Section 5)
- New GraphQL mutations: `createExpense`, expense queries
- "$ Cost" pill button in quick-action bar navigates to add-expense
- Costs tab on bike detail shows combined maintenance costs + standalone expenses
- **Effort:** 3–4 days

### P2 — Nice-to-Have

**R9. Bike card enhancements**
- Show health score badge (small ring or colored dot) on each bike card in the garage list
- Show active task count on each card (e.g., "3 upcoming")
- This gives at-a-glance status without opening the detail page

**R10. Edit motorcycle — add photo management**
- Allow changing/removing the bike photo from the edit screen
- Currently only possible from the hero area tap (confusing flow)

**R11. Shadow styling fix**
- Replace all `boxShadow` CSS properties with proper React Native shadow props
- Create shared `getShadowStyle(isDark)` utility
- Applies to: garage list cards, FAB (being removed but pattern reusable), stat cards

---

## 5. Database Changes

### New table: `expenses` (for R8)

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  motorcycle_id UUID NOT NULL REFERENCES motorcycles(id),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('fuel', 'insurance', 'gear', 'tires', 'registration', 'parts', 'other')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- RLS policies (same pattern as maintenance_tasks)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Spending query update

The `SpendingSummary` component currently only shows maintenance task costs. With the `expenses` table, the query needs to aggregate both sources:

```sql
-- Combined spending = SUM(maintenance_tasks.cost) + SUM(expenses.amount)
-- WHERE motorcycle_id = ? AND status = 'completed' (for tasks)
-- AND deleted_at IS NULL (for both)
```

---

## 6. Files to Modify

### P0 fixes (immediate)

| File | Change |
|------|--------|
| `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` line 1296 | Fix route: `add-task` → `add-maintenance-task` |
| `apps/mobile/src/app/(tabs)/(garage)/index.tsx` line 377 | Fix route: add `(tabs)` prefix |
| `apps/mobile/src/app/(tabs)/(garage)/index.tsx` line 339 | Fix route: add `(tabs)` prefix |
| `apps/mobile/src/app/(tabs)/(garage)/index.tsx` line 382–412 | Remove FAB, add inline "Add Motorcycle" button |
| `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` line 1291–1314 | Remove FAB |
| `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` line 66 | Change detent: `[0.85, 1.0]` → `[0.55, 0.85]` |
| `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx` line 107 | Remove `KeyboardAvoidingView` wrapper |
| `apps/mobile/src/components/HealthScoreRing.tsx` | Scale fonts/stroke proportionally to size prop |

### New files (P1)

| File | Purpose |
|------|---------|
| `apps/mobile/src/components/bike-hub/quick-action-bar.tsx` | Labeled action pills for bike detail |
| `apps/mobile/src/components/bike-hub/bike-detail-tabs.tsx` | Sticky tab bar component |
| `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` | Add expense form sheet |
| `apps/api/src/modules/expenses/` | NestJS expense module (resolver, service, models, DTOs) |
| `apps/mobile/src/graphql/mutations/create-expense.graphql` | GraphQL operation |
| `supabase/migrations/00026_create_expenses_table.sql` | DB migration |
| `packages/types/src/validators/expense.ts` | Zod schemas |

---

## 7. Implementation Plan

### Phase 1: Critical Fixes (1 day)

1. Fix route mismatch (`add-task` → `add-maintenance-task`)
2. Fix route path inconsistencies (add `(tabs)` prefix)
3. Fix HealthScoreRing text scaling
4. Fix edit sheet detent (`[0.55, 0.85]`) + remove KeyboardAvoidingView
5. Test all navigation paths end-to-end

### Phase 2: FAB Removal + Quick Actions (1–2 days)

1. Remove FAB from garage list
2. Add inline "Add Motorcycle" button at top of list
3. Remove FAB from bike detail
4. Build `QuickActionBar` component with labeled pills
5. Build "More" ActionSheet (Edit, Export, Delete)
6. Remove bottom-of-page Edit/Export/Delete buttons
7. Test all action entry points

### Phase 3: Section Tabs (2–3 days)

1. Refactor bike detail into tabbed sections
2. Build sticky header + tab bar
3. Move content into Overview / Tasks / Costs tabs
4. Preserve all existing functionality
5. Test scroll performance with 100+ tasks

### Phase 4: Expense Tracking (3–4 days)

1. Create `expenses` table migration
2. Build NestJS expense module
3. Build add-expense form sheet
4. Update spending summary to include expenses
5. Build cost history list in Costs tab
6. Run `pnpm generate` for types pipeline

**Total estimate: 7–10 days**

---

## 8. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| FAB confusion (support tickets about "what does + do") | Exists | Eliminated |
| Navigation failures from bike detail | FAB broken (wrong route) | 0 failures |
| Edit sheet usability (blank space complaint) | Major blank space | Content fills sheet appropriately |
| Health score visual integrity | Text clips at small sizes | Fully visible at all sizes |
| Average scroll depth to reach "Add Task" | Bottom of page (FAB or scroll) | 1 tap (Quick Action Bar visible on Overview tab) |
| Average scroll depth to reach "Delete Bike" | Bottom of ~2000px page | 1 tap (More menu) |

---

## 9. Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| Q1 | Should "Edit Bike" remain a sheet or become a full push screen? Sheet is faster for quick edits but limiting if we add photo management, VIN, insurance. | Design | P1 |
| Q2 | For the tab bar, should we use `react-native-tab-view` (Material-style swipe) or a custom segmented control? Segmented control is more iOS-native. | Engineering | P1 |
| Q3 | Should expense categories be user-customizable or fixed? Fixed is simpler but less flexible. | Product | P2 |
| Q4 | Should the "More" menu include a "Share" option for sharing bike details? | Product | P2 |
