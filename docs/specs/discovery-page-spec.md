# PRD: Discovery Page — Interaction Design & Feature Spec

**Status**: Ready for implementation
**Author**: Andrej Kanuch
**Date**: 2026-04-28
**App**: MotoVault · apps/mobile
**Research basis**: Heuristic evaluation of `discover-redesign/index.html` prototype + 5 screen recordings of live implementation + code inspection of `plan-ride-card.tsx`, `draft-trip-strip.tsx`, `create-trip.tsx`

---

## Background

The Discovery page is MotoVault's primary planning surface. The visual design and editorial content are strong — the AI-contextual route suggestions, weather integration, and TripDetailSheet interaction are genuinely differentiated. However, a design audit identified 8 UX breakdowns that prevent the screen from delivering on its visual promise. Two are critical severity and block the majority of returning sessions before a user can complete any meaningful action.

This PRD documents every interaction on the Discovery page, the rationale for each decision, and the exact expected behaviour an engineer needs to implement. There are no open-ended recommendations — every section has a defined outcome for every tap.

---

## User Segments

Understanding who uses Discovery drives every prioritisation decision in this spec.

**The Returning Planner (~40% of active users)** has 1–3 drafts in progress and opens Discovery to continue what they started. This is the highest-retention cohort — if they can resume, they convert to a completed trip. They are currently blocked by the broken draft continuation flow.

**The Spontaneous Rider (~30% of active users)** has no plan and wants to ride today or this weekend. They are looking for a quick suggestion they can act on immediately. They convert fast or leave fast — decision paralysis from competing CTAs is the biggest risk for this segment.

**The Weekend Optimizer (~20% of active users)** uses AI suggestions heavily and reads context carefully before acting. They are the primary audience for the SmartTripCard and use "Use as my trip" or "Tweak" as their entry point. Their biggest frustration is that mode selection doesn't filter the content below it.

**The Route Collector (~10% of active users)** browses roads across multiple sessions, builds trip baskets, and coordinates with friends. They are the primary audience for the Add Roads section and the Trip Basket. They are currently blocked by the undefined road card body tap and the display-only social section.

---

## Problem Statement

The Discovery page has 2 critical and 3 high-severity UX failures that create dead ends for the majority of user sessions. The most critical is the draft continuation flow: tapping a draft card triggers an unnecessary intermediate banner, opens a sheet with empty content and no primary CTA, and provides no path to the Trip Editor — blocking the Returning Planner cohort entirely. The second critical failure is the FROM/TO widget, which visually presents as a two-field form but only one element (the orange arrow) is actually interactive, systematically teaching users that taps on this screen do not work. Every failed interaction on the page reduces confidence in the next one. These must be resolved before other Discovery improvements deliver value.

---

## Goals

1. Every tap on the Discovery page has exactly one defined outcome — no dead ends, empty sheets, or silent no-ops.
2. Returning Planners can resume a draft in a single tap with no intermediate states.
3. The hero planner card eliminates the form-field affordance confusion — Model A: entire card is one pressable zone.
4. Trip type selection (Day / Overnight / Multi-day) visibly filters the SmartTripCard recommendations below it.
5. The Add Roads section always shows which trip roads will be added to before any "+" is tapped.
6. The green FAB and the hero card arrow communicate clearly and do not contradict each other.

---

## Non-Goals

- Redesigning the visual layout, typography, or colour system of Discovery.
- Building a new route editor — "Tweak" and "Use as my trip" route into the existing `create-trip` modal.
- Implementing the social/rider matching backend — Invite Riders section is display-only in this release (separate initiative).
- Changing how drafts are saved or structured in the backend schema.
- Building the Road Detail screen — defined in this spec as a dependency but built in a separate sprint.

---

## What Must Not Change

The following elements are well-designed and should not be modified as part of this work:

- **SmartTripCard content** — AI context (bike + forecast), insight bullets (weather, pass status, refuel), and stats row are correct and differentiated.
- **TripDetailSheet** — the day-by-day timeline with time-gated stops, per-day weather, "Riding with" section, and Edit + nav CTAs are the most complete interaction in the design. This sheet opens from the Trip Basket "Open" button only — not from draft card taps.
- **Draft card visual design** — title, stops/km, progress bar, note text are the right information hierarchy.
- **Social availability copy** — "Marek & Sara are free Saturday. Kai is riding the Dolomites." framing and pace-matching hint are correct and should remain AI-generated.

---

## Section-by-Section Breakdown

### 1. Hero Planner — PlanRideCard

**Research finding:** The FROM/TO widget visually resembles a two-input form (label + value + 1px divider + label + value). Neither field is independently tappable. The ↺ loop icon is static text inside a string, not a Pressable. Only the orange arrow button calls `router.push`. Users tap FROM — nothing. They tap TO — nothing. They tap ↺ — nothing. Three consecutive failed interactions on the most prominent element of the page.

**Decision: Model A — entire card is one pressable zone.**

The entire `PlanRideCard` component is wrapped in a single `<Pressable>`. Tapping anywhere — FROM field, TO field, mode pills area, or arrow — all trigger the same action: open `create-trip`. The arrow remains as the visual affordance for the CTA. The fields are display-only and communicate what will be pre-filled when `create-trip` opens.

**FROM field — current location pre-fill:**
- On `PlanRideCard` mount, request location via `expo-location` (permission already handled via `locationDenied` / `onRequestLocation` props).
- If permission granted: reverse geocode coordinates via Mapbox to get a readable street/area label. Display as `fromLabel`. Pass `fromLat`, `fromLng`, `fromLabel` as params to `create-trip`.
- If permission denied: display "My garage" (current default). No coordinates passed. `create-trip` opens without a pre-set departure.
- This is display only — the FROM field is not independently tappable.

**TO field — rename:**
- Change "Pick or loop ↺" to "Pick destination".
- Remove the ↺ character entirely from this field.
- Loop mode (point-to-point vs. loop route) is a toggle that lives inside `create-trip`, next to the destination search bar.

**Divider — remove:**
- Remove the 1px vertical line between the FROM and TO fields.
- This visual change eliminates the form-field affordance that causes users to expect independent tappability.

**Trip mode pills (Day ride / Overnight / Multi-day):**
- Pills already have a working selected state (`startMode` state in `PlanRideCard`). This is correct — keep it.
- Add: pass the selected mode as a URL param when navigating: `router.push('/(modals)/create-trip?mode=day')` / `?mode=overnight` / `?mode=multi`.
- Add: when a mode is selected, the SmartTripCard section below filters to match:
  - `day` → single-day routes (< 6h, < 400km)
  - `overnight` → 2-day routes with hotel/camp waypoint suggestions
  - `multi` → 3+ day tours
- Add: update the TO field hint text based on selected mode — "Home by 7pm" for day, "1 night away" for overnight, "Multi-day tour" for multi.
- If no pill is selected (default): SmartTripCard shows the AI-chosen best match for the weekend.

**Green FAB — "Create trip":**
- Same action as the hero card: `router.push('/(modals)/create-trip?mode=[selectedMode]')`.
- When a mode pill is selected, the FAB label updates: "Create day ride" / "Create overnight" / "Create tour".
- When no mode is selected: label stays "Create trip".
- The FAB and the hero card arrow are not competing — they are the same action with the same context. The FAB is persistent as the user scrolls past the hero card.

**Acceptance criteria:**
- [ ] Tapping anywhere on `PlanRideCard` (except mode pills) opens `create-trip`
- [ ] Tapping a mode pill selects it but does not immediately navigate — navigation happens via the card tap or FAB
- [ ] Selected mode passes as `?mode=` param to `create-trip`
- [ ] SmartTripCard filters content based on selected mode
- [ ] FROM field shows current location address when location permission is granted
- [ ] FROM field shows "My garage" when location permission is denied
- [ ] TO field reads "Pick destination" (no ↺ icon)
- [ ] 1px vertical divider between FROM and TO is removed
- [ ] FAB label reflects selected mode
- [ ] All interactions have haptic feedback via `expo-haptics` (iOS only)

---

### 2. Continue Planning — Draft Cards

**Research finding:** `handleDraftPress` in `draft-trip-strip.tsx` has a confirmed TODO: `// TODO: navigate to draft detail when backend supports it`. All draft data in the component is currently mock data (`MOCK_DRAFTS`). The current live behaviour triggers an intermediate white banner (a selection UI from a multi-select pattern) then opens a sheet that is mostly empty. The `RIDING WITH` relation is either not queried or returning null. There is no "Open trip" button in the sheet.

**Broken flow (current):**
```
Tap draft card → white banner (step 1, unnecessary)
                → tap banner (step 2, unnecessary)
                → empty sheet, no CTA (step 3, dead end)
```

**Correct flow:**
```
Tap draft card → push navigate to Trip Editor for that draft (1 step)
```

**Single tap — primary action:**
- `router.push({ pathname: '/(modals)/create-trip', params: { tripId: draft.id } })`.
- Push navigation (not modal) — back button returns to Discovery.
- `create-trip.tsx` already reads `tripId` from `useLocalSearchParams`, sets `isEditMode = true`, and fires a `TripDetailDocument` query to load the full trip on mount. No backend work required — this is a frontend-only change in `handleDraftPress`.

**Long press — secondary action:**
- iOS `UIContextMenu` with 3 items (in order):
  1. **Rename** — presents inline text input on the card title
  2. **Duplicate** — creates a copy of the draft, navigates to the new draft in Trip Editor
  3. **Delete** — `Alert.alert` confirm dialog ("Delete this draft? This can't be undone.") → on confirm: delete mutation via `SUPABASE_USER` → remove card from list with fade animation
- Note: no "Open" in the context menu — single tap already handles that.

**Progress bar — 4 defined milestones:**

The `progress` value on each draft represents completion across exactly 4 milestones, each worth 25%:

| Milestone | Condition | Progress contribution |
|-----------|-----------|----------------------|
| Route saved | `stops.length >= 1` | 25% |
| All stops confirmed | No stops in unresolved state | 25% |
| Accommodation added | At least 1 `sleep` waypoint (for overnight/multi-day) | 25% |
| Riders invited | At least 1 rider in RIDING WITH | 25% |

The `note` text below the progress bar displays the label of the next incomplete milestone: "Add your first stop", "Confirm all stops", "Add accommodation", "Invite riders". Single-day trips skip the accommodation milestone (max progress 75% until riders are added, or 100% if riders milestone is waived for solo trips by product decision).

**"3 drafts" link:**
- Tapping opens a `formSheet` (not full screen) showing all drafts sorted by last modified date.
- Each item in the list is tappable — same single-tap navigation to Trip Editor.
- Sheet has a "New trip" button at the top right.

**New Draft card (dashed border):**
- `router.push('/(modals)/create-trip')` — blank trip, no params. Existing behaviour is correct.

**Acceptance criteria:**
- [ ] Single tap on draft card push navigates to Trip Editor for that draft
- [ ] No intermediate white banner on draft card tap
- [ ] Long press shows UIContextMenu: Rename / Duplicate / Delete
- [ ] Delete requires confirm alert before executing mutation
- [ ] Progress bar reflects the 4-milestone formula
- [ ] Note text shows next incomplete milestone label
- [ ] "3 drafts" link opens formSheet sorted by last modified
- [ ] `handleDraftPress` calls `router.push` with `tripId` param (single line change)

---

### 3. Pre-built Route Card — SmartTripCard

**Context:** The SmartTripCard is the primary surface for the Weekend Optimizer segment. It shows a pre-built route suggestion contextualised to the user's bike, the current forecast, and daylight window. The stats row, weather insights, and pass-status bullets are correct and should not change. Only the two CTA buttons need defined behaviour.

**"Use as my trip" button:**

1. Check if user has an existing draft with 1 or more confirmed stops (the "substantive draft" threshold).
2. If NO substantive draft exists (user has no drafts, or only drafts with 0 stops):
   - Create a new draft from the pre-built template, pre-populating all stops, distances, and timing suggestions.
   - Push navigate to `create-trip?tripId=[newDraftId]`.
3. If YES a substantive draft exists:
   - Show action sheet with two options: "Create new trip" and "Cancel". Do NOT offer to replace — the user's existing work must be preserved.
   - On "Create new trip": same flow as above.
4. After creation in either case: push navigate to Trip Editor for the new draft.

**"Tweak" button:**

- Opens `create-trip` modal with the pre-built route loaded in edit mode.
- The route is NOT automatically saved as a draft — the user must explicitly save.
- If the user presses back or closes the modal without saving:
  - Show an action sheet with 3 options:
    1. **"Save as draft"** — saves the tweaked version as a new draft, navigates back to Discovery
    2. **"Discard changes"** — exits without saving, navigates back to Discovery
    3. **"Keep editing"** — dismisses the action sheet, user stays in the editor
- This action sheet must appear on any exit gesture (swipe down, back button) when the route has been modified.

**SmartTripCard content filtering:**
- When a mode pill is selected on the hero card: SmartTripCard reloads to show a route appropriate for that duration.
- When no pill is selected: card shows the AI's best pick for the upcoming weekend based on bike + forecast.
- Loading state: skeleton animation while content reloads after mode change.

**Acceptance criteria:**
- [ ] "Use as my trip" creates a new draft from the template and navigates to Trip Editor
- [ ] If substantive draft (1+ stops) exists, action sheet asks "Create new trip" or "Cancel" — no replace option
- [ ] "Tweak" opens Trip Editor in edit mode, route is not auto-saved
- [ ] Exiting Tweak without saving shows 3-option action sheet: Save / Discard / Keep editing
- [ ] SmartTripCard content filters based on selected mode pill
- [ ] Loading skeleton shown while SmartTripCard reloads

---

### 4. Add Roads to Your Trip

**Research finding:** The "+" button has no indicator of which trip it adds to. No active trip context is shown. The road card body tap is undefined. The Trip Basket (floating) is the only live trip indicator on the page but only appears after a successful "+" action — which itself has no context.

**Active trip definition:**
Active trip = the most recently opened or edited draft in the current session. Stored in local app state (Zustand or React context). Resets when the app is backgrounded for more than 30 minutes or on full restart. If no draft has been opened this session, there is no active trip.

The Trip Basket (when it has roads) is the visual representation of the active trip. The two are in sync.

**Section header — context pill:**
- When an active trip exists: show a small pill at the top of the "ADD ROADS" section: "Adding to: [Trip Name]".
- When no active trip: do not show the pill. The section header copy remains as-is.
- The subtitle "Stitched well with [Last Road]" dynamically references the most recent road in the active trip.

**"+" button — when active trip exists:**
1. Add the road as a waypoint/stop to the active trip (mutation via `SUPABASE_USER`).
2. Haptic feedback: `impactAsync(Light)`.
3. The "+" icon animates to "✓" for 1.5 seconds, then returns to "+".
4. The road appears in the Trip Basket strip immediately (optimistic update).

**"+" button — when no active trip:**
1. Show action sheet with options:
   - "Add to [Draft Name]" for each of the user's most recent 3 drafts (if any exist)
   - "Start new trip with this road"
   - "Cancel"
2. On selection: the chosen draft becomes the active trip for this session. The road is added and the Trip Basket appears.

**Road card body tap — Road Detail screen:**
- Tapping anywhere on the road card EXCEPT the "+" button navigates to Road Detail.
- ⚠ **New screen — not yet built.** Road Detail is a push-navigated screen containing:
  - Full Mapbox map showing the road polyline
  - Photos carousel
  - Elevation profile chart
  - Stats: distance, surface, difficulty, estimated time
  - User reviews (rating + count)
  - Seasonal access info (open/closed status, opening dates)
  - "Add to trip" CTA at the bottom (same behaviour as "+" on the card)
- This screen is a dependency for Route Collector engagement. Build in a separate sprint. Until it exists, road card body taps should be a no-op (not a broken dead zone — do not add an empty onPress).

**Acceptance criteria:**
- [ ] "Adding to: [Trip Name]" pill shown at section header when active trip exists
- [ ] "+" adds road to active trip with haptic + animated ✓ confirmation
- [ ] "+" with no active trip shows action sheet with draft list + new trip option
- [ ] Road is reflected in Trip Basket immediately after "+" tap (optimistic update)
- [ ] Road card body tap is a defined no-op until Road Detail screen is built
- [ ] Road Detail screen spec is referenced as a dependency, with its own implementation ticket

---

### 5. Trip Basket

**Context:** The Trip Basket is the most complete interactive surface on the Discovery page. It appears as a floating card when `basket.length > 0`, shows live km/elevation/fuel stats, and the "Open" button reveals the fully-specified TripDetailSheet with day-by-day itinerary. This is the correct behaviour — no changes needed to the core mechanic.

**Clarifications and additions:**

**Empty state (basket.length === 0):**
- Do not show the basket as a large empty card. Instead show a minimal placeholder: a small pill at the bottom of the page reading "Your trip · 0 roads" with a faint border. This makes the trip container visible before any roads are added, so users understand there is a trip being built even before they add anything.

**"Open" button → TripDetailSheet:**
- This is correct. The TripDetailSheet opens from the basket only — never from draft card taps (those go directly to Trip Editor). Do not change this flow.

**Road chip × close:**
- Tapping × on a road chip in the basket removes it immediately (optimistic update with haptic).

**TripDetailSheet — "Edit" button:**
- `router.push({ pathname: '/(modals)/create-trip', params: { tripId: activeTrip.id } })`.
- This is push navigation — back returns to Discovery with the basket still populated.

**TripDetailSheet — "RIDING WITH" empty state:**
- If no riders have been invited yet: show "No riders invited · Add from Discover →" with a small link that scrolls Discovery to the Invite Riders section.
- This replaces the current empty/blank state confirmed in the screen recordings.

**Acceptance criteria:**
- [ ] Basket shows minimal "0 roads" pill state when empty
- [ ] "Open" button opens TripDetailSheet (not draft card sheet)
- [ ] Road chip × removes road from basket with haptic
- [ ] TripDetailSheet "Edit" push navigates to Trip Editor
- [ ] TripDetailSheet "RIDING WITH" shows empty state copy when no riders invited

---

### 6. Search

**Research finding:** The search button in the header has a confirmed empty `onPress` handler in the codebase: `onPress={() => { // TODO: open search }}`. A visible UI element with no behaviour is a credibility failure — users tap it, nothing happens, and they lose confidence in the app.

**Decision: implement ride template search.**

Tapping the search icon opens a search screen (push navigate or `formSheet`) that queries the curated route library. Search is scoped to ride templates only — it is not a general-purpose place search (that lives inside `create-trip` via `GeocodingSearchBar`).

**Search screen:**
- Search bar auto-focused on open (keyboard up immediately).
- Query fields: route name, region/country, surface type, difficulty tag.
- Results show road cards identical in design to the "Add Roads" section rows.
- Tapping a result opens Road Detail (same screen as road card body tap above — shared screen).
- Empty state: "No routes found for '[query]'" with a suggestion to try a region name.
- If the Road Detail screen is not yet built: tapping a search result is a no-op until that sprint.

**Acceptance criteria:**
- [ ] Search icon opens search screen with keyboard auto-focused
- [ ] Search queries route library by name, region, surface, difficulty
- [ ] Results use road card row design
- [ ] No dead end if Road Detail screen not yet built — results are visible, taps are deferred

---

## User Stories

**As a returning planner**, I want to tap a draft card and be in the Trip Editor in one tap, so that I can continue exactly where I left off without hunting through sheets.

**As a spontaneous rider**, I want to tap the hero card and land in a pre-configured trip creation with my current location already set as departure, so that I spend zero time on setup and all my time on the destination.

**As a weekend optimizer**, I want to select "Day ride" and see the route suggestions immediately update to show only rides I can finish before dark, so that every recommendation is relevant to my actual available time.

**As a route collector**, I want to tap "+" on a suggested road and immediately see it appear in my trip basket with a km total update, so that I know the action worked and which trip I'm building.

**As a road explorer**, I want to tap on a road card and see its full detail — map, elevation, photos, access status — so that I can decide if it's worth adding before I commit to it.

---

## Success Metrics

| Metric | Target | Baseline | How to measure |
|--------|--------|----------|----------------|
| Draft resumption rate | > 60% of users with a draft resume it within 7 days | Unknown — currently broken | `trip_editor_open` event with `source=discovery_draft_card` |
| Discovery → Trip creation conversion | > 30% of Discovery sessions end in a draft or trip | Measure after P0 fixes | Session funnel: Discovery open → create-trip open |
| Mode pill → SmartTripCard engagement | > 40% of users who select a mode tap the SmartTripCard | Not measured | `mode_pill_select` → `smart_trip_card_tap` funnel |
| Add Roads context awareness | > 80% of "+" taps result in a road added (not abandoned) | Currently unknown | `add_road_tap` → `add_road_success` completion rate |
| "Use as my trip" adoption | > 15% of users who see the SmartTripCard use it | Not measured | `use_as_my_trip_tap` event |
| Search engagement | > 20% of Discovery sessions include a search | 0% (unimplemented) | `search_open` event |

---

## Dependencies

| Dependency | Required for | Status |
|------------|-------------|--------|
| Backend: `create-trip` modal accepts `?tripId=` param and loads existing trip | Draft card single-tap navigation | ✅ Already implemented — `isEditMode`, `TripDetailDocument` query, full form hydration all exist in `create-trip.tsx` |
| Road Detail screen | Road card body tap, Search results tap | New screen — separate sprint |
| `expo-location` permission flow | FROM field current location | Already partially implemented (`locationDenied` prop exists) |
| Active trip local state (Zustand/context) | Add Roads context pill, "+" button routing | New state — required before Add Roads work |

---

## Open Questions

These are the only genuinely unresolved questions. Everything else has been decided.

| Question | Owner | Blocking? |
|----------|-------|-----------|
| Should drafts in "Continue Planning" sort by last modified or scheduled ride date? | Product | No — default to last modified until data shows otherwise |
| Is SmartTripCard content AI-generated per user on request, or pre-curated and cached? | Engineering | No — affects loading state design but not interaction spec |
| For single-day trips, is the Accommodation milestone skipped (max 75% progress) or replaced with a different milestone? | Product | No — spec defaults to skip for now |
| What is the backend schema for "confirmed stop" vs "unconfirmed stop"? | Engineering | Yes — needed before progress bar milestone 2 can be implemented |

---

## Implementation Notes

**MotoVault conventions — must follow:**
- All animations: `FadeInUp.delay(index * 50)` from `react-native-reanimated` v4. Never use the RN `Animated` API.
- Haptic feedback: `expo-haptics` only. iOS only. `impactAsync(Light)` for content interactions, `impactAsync(Medium)` for primary CTAs, `selectionAsync()` for selections.
- Colors: `palette` from `@motovault/design-system` only. No hardcoded hex or rgba.
- Modals: `presentation: 'formSheet'` for drafts list, search, and rider profile sheets.
- Navigation: push navigate (not modal) for Discovery → Trip Editor. Back button must return to Discovery.
- Data fetching: TanStack Query + `TypedDocumentNode` from `@motovault/graphql`. Never use `any` for GraphQL data.
- Mutations: `SUPABASE_USER` client (per-request JWT, RLS enforced) for all user-scoped writes. Never use `SUPABASE_ADMIN` for user data.
- Border treatment: `borderCurve: 'continuous'` on all rounded elements.
- Rounded corners only on elements with borders on all 4 sides. `border-left` accents use `borderRadius: 0`.

**Key file locations:**
- Discovery screen: `apps/mobile/src/app/(tabs)/(discover)/index.tsx`
- Hero planner card: `apps/mobile/src/components/discover/planner/plan-ride-card.tsx`
- Draft strip: `apps/mobile/src/components/discover/planner/draft-trip-strip.tsx`
- Trip creation modal: `apps/mobile/src/app/(modals)/create-trip.tsx`
- Geocoding search: `apps/mobile/src/components/geocoding-search-bar.tsx`
- Map picker: `apps/mobile/src/components/map-picker.tsx`
