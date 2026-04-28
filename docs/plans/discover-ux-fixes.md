# Discover Screen UX Fixes — Implementation Plan (Deepened)

Based on UX Research Synthesis (April 2026). Addresses 8 identified breakdowns.
Deepened on 2026-04-28 with 7 parallel research agents (architecture, navigation, animation, race conditions, simplicity, performance, trip-architecture learning).

## Enhancement Summary

### Key Changes from Research
1. **`DiscoverRiderTripsDocument` is WRONG for drafts** — must use `MyTripsDocument` with `status === 'draft'` client-side filter (or create a purpose-built `myDraftTrips` query)
2. **Plan simplified from 6 items to 3+1** — P1-4 (context pill) dropped (redundant with TripBasket), P1-6 absorbed into P0-2, P1-3 reduced to one-line mode param pass
3. **Create `trip-planner.store.ts` (Zustand)** — basket + mode must survive tab switches; don't persist to MMKV
4. **Use Mapbox `reverseGeocodeShortLabel`** not expo-location — already exists at `utils/mapbox-geocoding.ts`
5. **7 race conditions identified** — most critical: FROM label triple-blink, TypeaheadSearch ghost dropdown
6. **Keep `selectedMode` inside PlanRideCard** — lifting to parent causes full-screen re-render of 15+ components

### New Considerations Discovered
- `discoverRiderTrips` is `@Public()` and filters `status IN ('published', 'active')` — will never return drafts
- TypeaheadSearch dropdown uses `position: 'absolute'` — render as header overlay, not inside ScrollView
- TripDetailSheet hardcoded mock props need wiring to real basket data
- Inline closures in `.map()` defeat `memo` on `AddableRouteRow` — fix with stable refs

---

## Scope

**P0 (this PR):** Fix 2 critical breakdowns + search wiring
**P1 (one-liner):** Pass mode param to create-trip
**Deferred:** Road Detail screen, social interactivity

---

## P0-1: Fix draft card navigation (Critical)

**Problem:** Draft cards have a TODO — tapping does nothing. Returning planners (est. 40% of users) can't resume trips.

**Solution:** Wire `handleDraftPress` to push navigate to the Trip Editor with real user drafts.

**Files:**
- `apps/mobile/src/components/discover/planner/draft-trip-strip.tsx`
- `apps/mobile/src/app/(tabs)/(discover)/index.tsx`

**Changes:**
1. Replace `MOCK_DRAFTS` with real data from `MyTripsDocument` (NOT `DiscoverRiderTripsDocument`)
2. Filter client-side: `edges.filter(e => e.node.status === 'draft')`
3. `handleDraftPress(tripId)` → `router.push({ pathname: '/(modals)/create-trip', params: { tripId } })`
4. Accept `drafts` + `isLoading` props from parent
5. The `create-trip` modal already supports `?tripId=X` for edit mode — no backend work needed

### Research Insights

**Architecture (trip-unification learning):**
- `DiscoverRiderTripsDocument` is a `@Public()` query that returns OTHER riders' published trips — not the current user's drafts
- `MyTripsDocument` at `apps/mobile/src/graphql/queries/my-trips.graphql` is authenticated, returns all user trips including drafts
- Filter on `status === 'draft'` client-side (the unified trips table has `TripStatusSchema = z.enum(['draft', 'published', 'active', 'completed', 'archived'])`)
- Also filter `is_template === false` to exclude any templates the user created

**Race condition (Race 1):**
- Gate `DraftTripStrip` on `isLoading` — don't render pressable cards until data settles
- Validate trip ID still exists before navigating:
```tsx
const handleDraftPress = useCallback((draftId: string) => {
  const stillExists = drafts?.some(d => d.id === draftId);
  if (!stillExists) return;
  router.push({ pathname: '/(modals)/create-trip', params: { tripId: draftId } });
}, [drafts, router]);
```

**Performance:**
- Defer drafts query with `enabled: belowFoldReady` since drafts section is below the hero card
- Wrap `DraftTripStrip` in `memo`, cap at 8 drafts + "See all"

**Verification:** Tap draft card → Trip Editor opens with that trip's waypoints pre-loaded.

---

## P0-2: Make hero card one pressable surface (Critical)

**Problem:** FROM and TO fields look tappable but only the orange arrow works. Three consecutive dead taps.

**Solution (simplified per simplicity review):** Make the entire FROM/TO row one `<Pressable>`. Remove the orange arrow button. This also accomplishes P1-6 (CTA consolidation).

**Files:**
- `apps/mobile/src/components/discover/planner/plan-ride-card.tsx`

**Changes:**
1. Wrap entire FROM/TO row in single `<Pressable onPress={handleGoPress}>`
2. Remove the orange arrow `<Pressable>` entirely
3. Rename "Pick or loop ↺" to "Pick destination"
4. Keep `fromLabel` as a prop — pre-fill from parent using `reverseGeocodeShortLabel()` from existing `utils/mapbox-geocoding.ts`
5. Pass `selectedMode` as `?mode=X` when navigating

### Research Insights

**Simplicity review:**
- Do NOT make FROM, TO, and ↺ each individually pressable — that's 3 separate handlers for a widget that should open one screen
- The create-trip modal already has a full location picker — let users pick FROM/TO there
- Loop toggle (swap FROM/TO) doesn't exist in create-trip yet — don't build it here

**Reverse geocoding (FROM label):**
- Use `reverseGeocodeShortLabel(lat, lng)` from `apps/mobile/src/utils/mapbox-geocoding.ts` — already exists, already used in `waypoint-place-label.ts`
- Do NOT use expo-location's `reverseGeocodeAsync` — not used anywhere in codebase, Mapbox gives better results
- `docs/specs/discovery-page-spec.md` line 83 explicitly calls for Mapbox reverse geocoding

**Race condition (Race 2 — FROM label triple-blink):**
- Keep "My garage" as default until geocode fully resolves — no loading intermediate
- Use a `geocodeDone` ref to prevent re-geocoding on re-renders:
```tsx
const [fromLabel, setFromLabel] = useState('My garage');
const geocodeDone = useRef(false);

useEffect(() => {
  if (!coords || geocodeDone.current) return;
  let canceled = false;
  reverseGeocodeShortLabel(coords.lat, coords.lon)
    .then(label => {
      if (canceled || geocodeDone.current) return;
      geocodeDone.current = true;
      if (label) setFromLabel(label);
    })
    .catch(() => {}); // keep "My garage"
  return () => { canceled = true; };
}, [coords]);
```

**Performance:**
- Do NOT lift `selectedMode` out of PlanRideCard — every mode tap would re-render 15+ components
- Keep it inside PlanRideCard, pass value via callback when navigating:
```tsx
// PlanRideCard reads mode from internal state for visual highlight
// handleGoPress passes it as a param
const handleGoPress = useCallback(() => {
  router.push({
    pathname: '/(modals)/create-trip',
    params: selectedMode ? { mode: selectedMode } : undefined,
  });
}, [router, selectedMode]);
```

**Verification:** Tap anywhere on FROM/TO row → create-trip opens with mode pre-selected.

---

## P0-3: Wire search icon to TypeaheadSearch (High)

**Problem:** Search icon has empty `onPress`. Visible unimplemented UI.

**Solution:** Reuse existing `TypeaheadSearch` component with animated show/hide.

**Files:**
- `apps/mobile/src/app/(tabs)/(discover)/index.tsx`

**Changes:**
1. Add `showSearch` state (or shared value) toggle
2. Search icon tap → animate TypeaheadSearch appearance
3. On route select → navigate to trip-detail
4. On place select → filter "Add Roads" by country

### Research Insights

**Animation pattern (reanimated v4):**
- Use `useAnimatedStyle` + `withTiming` on a fixed height — NOT layout animations:
```tsx
const SEARCH_HEIGHT = 52;
const isSearchOpen = useSharedValue(0);
const searchStyle = useAnimatedStyle(() => ({
  height: withTiming(isSearchOpen.value * SEARCH_HEIGHT, { duration: 250 }),
  opacity: withTiming(isSearchOpen.value, { duration: 200 }),
  overflow: 'hidden',
}));
```
- This keeps the component mounted (preserves TextInput focus) and gives smooth slide-down
- Do NOT use `entering`/`exiting` layout animations — they mount/unmount (lose focus state)

**Architecture:**
- Render TypeaheadSearch as a **header overlay** (not inside ScrollView) to avoid z-index clipping
- The component's absolute-positioned dropdown uses `zIndex: 10`
- The component is fully self-contained — clean dependency graph, no new deps needed

**Race condition (Race 3 — ghost dropdown):**
- On close, clear the typeahead query cache so reopening starts fresh:
```tsx
useEffect(() => {
  if (!showSearch) {
    queryClient.removeQueries({ queryKey: ['typeahead'] });
  }
}, [showSearch, queryClient]);
```
- Fix the existing `onBlur` setTimeout with a ref-tracked cleanup:
```tsx
const blurTimeout = useRef<ReturnType<typeof setTimeout>>();
// In onBlur: blurTimeout.current = setTimeout(...)
// In cleanup: clearTimeout(blurTimeout.current)
```

**Verification:** Tap search → typeahead appears → type "Gavia" → tap result → trip detail opens.

---

## P1-1: Pass mode param to create-trip (one-liner)

**Problem:** Day/Overnight/Multi-day pills update visual state only.

**Solution:** Pass `?mode` param when navigating. One line in PlanRideCard + one line in create-trip.

**Files:**
- `apps/mobile/src/components/discover/planner/plan-ride-card.tsx` (already done in P0-2)
- `apps/mobile/src/app/(modals)/create-trip.tsx`

**Changes:**
1. Widen `useLocalSearchParams` type in create-trip:
```tsx
// Before:
const params = useLocalSearchParams<{ tripId?: string; cloneFromTripId?: string }>();
// After:
const params = useLocalSearchParams<{ tripId?: string; cloneFromTripId?: string; mode?: string }>();
```
2. Use `params.mode` to pre-select trip duration picker if present

**Navigation pattern (confirmed):**
- `router.push({ pathname: '/(modals)/create-trip', params: { mode: 'day' } })` is correct
- All params are strings at runtime — validate/cast accordingly
- No typed routes configured — `useLocalSearchParams<T>` generic provides local type safety

---

## Infrastructure: Zustand Store

**Create `apps/mobile/src/stores/trip-planner.store.ts`**

Both basket state and mode need to survive tab switches (the Discover tab Stack unmounts screens on navigate).

```tsx
interface TripPlannerState {
  basketIds: string[];
  addToBasket: (id: string) => void;
  removeFromBasket: (id: string) => void;
  clearBasket: () => void;
}
```

- Do NOT persist to MMKV — ephemeral session state
- Follow existing store conventions in `apps/mobile/src/stores/`
- `selectedMode` stays inside PlanRideCard (per perf review) — not in the store

---

## Performance Checklist

| Item | Action | Impact |
|------|--------|--------|
| Fix inline closures on AddableRouteRow | Pass `tripId` + stable callbacks, let component call internally | Prevents 6 unnecessary re-renders per toggle |
| Wrap `onOpen` in useCallback + memo TripBasket | 2-line change | Prevents 2-4 unnecessary overlay re-renders |
| Defer below-fold sections | `InteractionManager.runAfterInteractions` | 80-120ms faster first paint on Android |
| Fire geocode parallel with weather | Both gated on `coords != null` via separate TanStack queries | Eliminates 1 sequential network hop |
| Defer drafts query | `enabled: belowFoldReady` | Reduces mount-time network pressure |
| Memo MiniRouteSchematic | Add `memo()` wrapper | ~1-2ms per parent re-render |

---

## Race Condition Mitigations

| Race | Severity | Mitigation |
|------|----------|------------|
| Draft tap during loading | Medium | Gate DraftTripStrip on `isLoading`, validate ID before nav |
| FROM label triple-blink | High | Single-swap with `geocodeDone` ref, no loading state |
| TypeaheadSearch ghost dropdown | High | Clear query cache on close, clean up blur setTimeout |
| Basket orphaned items after refetch | Low | useEffect to prune stale IDs from basketIds |
| FAB width jitter on mode change | Low | NOT APPLICABLE — FAB label stays static per simplified plan |
| TripDetailSheet exit animation | Medium | Use animated dismissal, not conditional render |
| Double permission request | Low | `isResolving` ref guard in weather hook |

---

## Execution Order

```
P0-1 (draft nav)     ← highest value, unblocks 40% of users
P0-2 (hero card)     ← eliminates dead taps, consolidates CTAs
P0-3 (search)        ← quick win, reuses existing component
P1-1 (mode param)    ← one-liner in create-trip.tsx
```

## Dropped Items (with reasoning)

| Item | Why dropped |
|------|-------------|
| P1-4 (context pill) | Redundant with TripBasket's "Your trip · X roads" — two indicators for same info |
| P1-6 (CTA reduction) | Absorbed into P0-2 — removing the orange arrow IS the consolidation |
| FAB label updates | Speculative decoration — user already chose mode, FAB doesn't need to confirm it |
| Mode-conditional subtext | "Home by 7pm" is speculative copy that will be wrong for many users |
| Individual FROM/TO/↺ pressables | Over-engineered — create-trip already has location picker |

## Not Changing

Per research "What's Working Well":
- SmartTripCard content and layout
- TripDetailSheet timeline design
- Draft card visual design (title, stops/km, progress bar)
- Social availability copy
- Invite Riders section (P2 — separate social initiative)
