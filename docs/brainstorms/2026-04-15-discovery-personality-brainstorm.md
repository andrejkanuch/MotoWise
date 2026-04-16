---
date: 2026-04-15
topic: discovery-personality
---

# Discovery With Personality

## What We're Building

Transform the Discover tab from an algorithmic infinite list into a curated, editorial-feeling experience that makes riders *want* to explore. The web already has country chips, editorial picks, typeahead search, and curated collections — mobile has none of it, just a map + flat FlatList.

Three connected changes:
1. **Discover tab** — hero card, curated collections, search + country chips, filter chips
2. **Route detail** — kill the 2x2 action grid, let content breathe
3. **Trip planner** — lead with the map, collapse metadata, animate route building

## Why This Approach

Calimoto wins on curation (tag-based collections: forest, mountains, coast, twisty). REVER wins on geographic discovery ("Best Roads by Country", AI Route Scout). MotoVault currently wins on neither — it's a data dump sorted by distance. The web already solved this with country browsing, editorial picks, and typeahead search. Mobile just needs a native-feeling version.

Confidence means curation over completeness. An editorial voice ("Road of the Week", one-line hooks) transforms route cards from data rows into destinations.

---

## Part 1: Discover Tab Redesign

### Current State
```
┌──────────────────────────┐
│ MAPBOX MAP (280px hero)  │  ← Shrinks to 140px on scroll
├──────────────────────────┤
│ TripSection (horizontal) │  ← "Multi-day trips" carousel
│ "Roads worth riding"     │  ← Flat section header
│ RouteCard                │  ← Infinite list, no categories
│ RouteCard                │
│ RouteCard...             │
└──────────────────────────┘
```

### Proposed State
```
┌──────────────────────────┐
│ MAPBOX MAP (280px hero)  │  ← Same collapsible behavior
├──────────────────────────┤
│ Search bar               │  ← Typeahead (routes + places)
│ [Twisty] [Scenic] [Off-  │  ← Filter chips (tag-based)
│  road] [Coastal] [Alpine]│
├──────────────────────────┤
│ ★ ROAD OF THE WEEK       │  ← Hero card, larger, editorial
│ "Monte Grappa Ring"      │    one-line hook + route thumbnail
│ "A 94km loop through..." │    static map image or photo
├──────────────────────────┤
│ Editor's Picks ──── See  │  ← Horizontal scroll (isMotovaultPick)
│ [Card] [Card] [Card] →   │    uses editorialDescription field
├──────────────────────────┤
│ 🇮🇹 🇪🇸 🇦🇹 🇩🇪 🇫🇷 🇨🇭  🇭🇷  │  ← Country chips (same 12 as web)
│ 🇬🇷 🇳🇴 🇷🇴 🇵🇹 🇺🇸          │    tap → filtered route list
├──────────────────────────┤
│ Multi-day trips ── See   │  ← Existing TripSection (unchanged)
│ [TripCard] [TripCard] →  │
├──────────────────────────┤
│ Top Rated ────── See all │  ← Sorted by rating, horizontal
│ [Card] [Card] [Card] →   │
├──────────────────────────┤
│ Near You (if detected)   │  ← Country detection like web
│ RouteCard                │    (CF/Vercel headers or device locale)
│ RouteCard...             │
└──────────────────────────┘
```

### Key Decisions

**Search bar**: Port the web's typeahead search (routes + places, grouped results) — NOT the current GeocodingSearchBar which only does Mapbox places. The GraphQL query already exists. Place it below the map, sticky on scroll.

**Filter chips**: Tag-based, not faceted. Chips: `Twisty`, `Scenic`, `Off-road`, `Coastal`, `Alpine`, `Forest`. These map to route tags/surface types. Single-select or multi-select TBD — start with single for simplicity.

**Road of the Week**: One featured route, rotated weekly. Could be the highest-rated `isMotovaultPick` route, or a manual selection stored as a simple flag/field. Start with automatic (highest-rated pick not yet featured) — manual curation is a later concern.

**Country chips**: Same 12 countries as web (`TOP_COUNTRIES` in `explore/page.tsx`). Emoji flag + country name. Tapping opens a filtered view (new screen or inline filter). Horizontal scroll, one row.

**Editor's Picks section**: Filter to `isMotovaultPick`, use `editorialDescription` for card subtitle. Horizontal scroll, larger cards than the regular list.

**Near You**: Detect country from device locale (`Localization.getLocales()` from expo-localization). Show "Popular in [Country]" if we have routes there.

### What This Removes
- The "Roads worth riding" flat infinite list as the primary content
- The feeling of a data dump

### What This Keeps
- Collapsible Mapbox map hero
- TripSection horizontal carousel
- Infinite scroll (moved to "Near You" / bottom section as fallback)

---

## Part 2: Route Detail — Kill the 2x2 Grid

### Current State
```
Bottom Sheet Content:
├─ Route name + contributor
├─ Stats grid (distance, elevation, surface, rating, fuel)
├─ Description
├─ ACTION GRID (2x2):           ← REMOVE THIS
│  [Export GPX] [Save]
│  [Offline]    [Share]
├─ Reviews
└─ Comments
```

### Proposed State
```
Floating Header (top-right):
├─ Map Style button (existing)
├─ Bookmark/Save toggle (NEW)   ← Moved from grid
├─ Share button (existing)
├─ ··· More menu (NEW)
│  └─ Export GPX                 ← Moved from grid

Bottom Sheet Content:
├─ Route name + contributor
├─ Stats grid (same)
├─ Description                   ← Now has room to breathe
├─ Reviews                       ← More visible, scrolls naturally
└─ Comments
```

### Key Decisions

**Save → bookmark icon** in floating header (heart or bookmark, filled when saved). Already have share there — add save next to it.

**GPX Export → overflow menu** (three-dot `···` button in floating header). This is a power-user action, doesn't need a prominent button.

**Offline → removed entirely**. It's a waitlist feature behind `PremiumWaitlistModal`. No reason to show a button for something that doesn't work. Remove it now, add it back when offline is real.

**Share stays** in the floating header (already there).

**Result**: The entire 2x2 action grid disappears. Description, reviews, and comments get the space. Bottom sheet content feels like reading about a destination, not filling out a form.

---

## Part 3: Trip Planner — Lead With the Map

### Current State
- Bottom sheet starts at **12%** (collapsed) — users see almost nothing
- Search bar hidden until sheet is pulled up
- Form fields (title, dates, visibility, difficulty) shown inline, prominent
- Route draws on map but no animation feedback

### Proposed Changes

**1. Bottom sheet starts at 45%** (not 12%)
- Search bar is immediately visible and inviting
- Shows "Where do you want to go?" placeholder
- Day list visible below search

**2. Collapse metadata into expandable section**
- Title, dates, difficulty, visibility, max riders → "Trip Details" accordion at bottom
- Defaults: untitled, today's date, moderate difficulty, private
- Users fill this in last, not first — lead with the map experience

**3. Animate route building**
- When a stop is added, animate the polyline drawing from previous stop to new stop
- Distance counter ticks up (animated number transition)
- Haptic on waypoint placement
- This makes building a trip feel like *creating something*, not filling out a form

**4. Search bar prominence**
- Larger, with a compass/search icon
- "Search for a destination..." placeholder
- Results grouped: Recent | Suggested | Search Results

### What Stays
- Day-based organization (good pattern, keep it)
- Drag-to-reorder stops
- Map style toggle
- Geocoding search (enhanced, not replaced)

---

## Open Questions

1. **Road of the Week selection**: Automatic (highest-rated pick) or manual (admin field)? Start automatic.
2. **Filter chips data source**: Do routes have tags today, or do we need to add a `tags` column? Need to check schema.
3. **Country detection on mobile**: Use `expo-localization` locale or IP-based? Locale is simpler and works offline.
4. **Typeahead search scope**: Port the web's GraphQL-based search, or keep Mapbox geocoding + add route name search? The web's approach is better.
5. **Polyline animation library**: `react-native-reanimated` can animate SVG paths, but Mapbox polylines are different. Need to investigate `@rnmapbox/maps` animation support for route lines.

## Phasing

### Phase 1: Discover Tab Structure (this PR)
- Search bar (Mapbox geocoding first, upgrade to typeahead later)
- Filter chips (UI only, wired to surface type initially)
- Road of the Week hero card
- Editor's Picks horizontal section
- Country chips
- Restructure FlatList into SectionList

### Phase 2: Route Detail Cleanup
- Move save to floating header
- Move GPX to overflow menu
- Remove offline button
- Remove 2x2 grid

### Phase 3: Trip Planner Polish
- Bottom sheet snap point 12% → 45%
- Collapse metadata into accordion
- Polyline draw animation
- Distance counter animation

### Phase 4: Full Search & Collections
- Port web typeahead search (routes + places)
- Add route tags for filter chips
- Country → region browsing (like web's explore/[country])
- "Near You" with locale detection

## Next Steps
→ `/ce:plan` Phase 1 first — Discover tab structure with hero, collections, search, chips
