# UX Research Synthesis: Discovery Screen
**Method:** Heuristic evaluation + design audit
**Source:** HTML prototype (`discover-redesign/index.html`) + 5 screen recordings
**Date:** April 2026
**Researcher:** Andrej Kanuch

---

## Executive Summary

The Discovery screen is visually strong — the editorial typography, weather context, AI-generated route suggestions, and the Trip Basket interaction are genuinely differentiated. However, 8 UX breakdowns prevent the screen from delivering on its promise. The two most critical failures are: (1) the draft continuation flow, which takes 3 steps where 1 is needed and ends in an empty sheet with no CTA, blocking the highest-value user cohort from their primary job; and (2) the FROM/TO widget, which visually presents as a form but only one element (the orange arrow) is actually interactive, systematically teaching users that taps on this screen don't work. Fixing these two issues alone would unblock 40%+ of returning sessions.

---

## Key Themes

### Theme 1: Draft continuation is broken end-to-end
**Severity:** Critical
**Evidence:** Codebase TODO confirms: `// TODO: navigate to draft detail when backend supports it`. Live screen recording shows: tap draft card → white banner appears → tap banner → sheet opens with empty "RIDING WITH" section and no primary CTA.

**The broken flow:**
```
Tap draft card → white banner (step 1, unnecessary)
                 → tap banner (step 2, unnecessary)
                 → sheet opens with empty content and no "Open trip" CTA (step 3)
```

**Should be:**
```
Tap draft card → Trip Editor (1 step, direct push navigation)
```

**Implication:** Returning planners (~40% of active users) open Discovery specifically to resume an in-progress trip. This is their primary job to be done. The flow is broken at every step — the white banner is a selection UI from a multi-select pattern that doesn't belong here, the sheet has no route map, the "RIDING WITH" relation is either not queried or returning empty, and there is no "Open trip" button anywhere in the sheet. These users leave without completing the one thing they came to do.

---

### Theme 2: FROM/TO widget teaches users wrong affordances
**Severity:** Critical
**Evidence:** HTML source shows `<div>` with `<Text>` only — no `onPress` on FROM or TO fields. Loop icon ↺ is static text in a string, not a `<Pressable>`. Only the `<Pressable>` on the orange arrow calls `router.push`.

**What users see:** A form-like row with FROM label + value, a divider, TO label + value, and an arrow. Visual language is: two tappable inputs + submit button.

**What's actually interactive:** Only the orange arrow button.

**Implication:** Users will tap "My garage" expecting a departure picker. Nothing happens. They'll tap "Pick or loop ↺" expecting a destination search. Nothing happens. They'll tap the ↺ icon expecting a toggle. Nothing happens. Three consecutive failed interactions on the screen's most prominent element — this actively trains users that interactions on this page are unreliable.

---

### Theme 3: Trip mode selection has no downstream effect
**Severity:** High
**Evidence:** `setStartMode(m.id)` updates local state and visual style only. No filtering logic exists below the pills. `SmartTripCard` renders unconditionally. `handleGoPress` calls `router.push('/(modals)/create-trip')` with no mode param.

**What users expect:** Selecting "Day ride" will surface shorter routes, show "Home by 7pm" hints, and create a day-length trip when they tap go.

**What actually happens:** The pill fills orange. Everything else stays identical.

**Implication:** Every interaction on the page that does nothing makes the next interaction feel risky. After the FROM/TO failure and the mode pill failure, users have zero confidence that the "+" button or draft cards will work either. Broken interactions compound.

---

### Theme 4: "Add Roads" section is disconnected from the trip being built
**Severity:** High
**Evidence:** `AddableRouteRow` renders with `onToggle={() => toggleBasket(r.id)}` — the basket is local prototype state with no connection to any named trip. Section header copy is generic. No active trip indicator exists in the section.

**Three specific problems:**
1. The "+" button has no context — users don't know which trip roads will be added to
2. Body tap on a road card is undefined — no Road Detail screen exists yet
3. "Stitched well with Gavia" subtitle implies contextual stitching but Gavia isn't necessarily in the user's active trip

**Implication:** A rider sees Grimsel Pass, 19 km, rating 4.8, and taps "+". Did it get added? To what? Where did it go? Without the Trip Basket appearing (which requires a successful add first), there's no visible outcome. The section's core mechanic is invisible.

---

### Theme 5: Four competing CTAs with overlapping destinations
**Severity:** High
**Evidence:** All four routes lead to `/(modals)/create-trip` with different pre-fill states:
- Green FAB "Create trip" → blank create-trip
- Orange arrow (FROM/TO) → blank create-trip
- "Use as my trip" → create-trip with template pre-loaded
- New Draft card (dashed border) → blank create-trip

**Implication:** A spontaneous rider opening Discovery for the first time sees four different "create a trip" entry points with no hierarchy. They don't know if the FAB and arrow do the same thing (they do). They don't know if "Use as my trip" is better or worse than the FAB (it's better). The cognitive load of choosing an entry point is higher than the cognitive load of the task itself.

---

### Theme 6: Trip Basket is the strongest feature but hardest to discover
**Severity:** Medium
**Evidence:** `TripDetailSheet` component shows a complete day-by-day itinerary with time-gated stops, weather per day, "Riding with" friends, and Edit + "Confirm & start nav" CTAs — the most well-realised interaction in the file. But it's only accessible after: (a) successfully using "+" on a road card, (b) noticing the basket appears at the bottom, (c) tapping "Open".

**Implication:** The app's best interaction is behind its most broken one. Route collectors — the segment most likely to use this flow — can't get there without first navigating the context-free "+" experience.

---

### Theme 7: Search icon is visible but completely unimplemented
**Severity:** Medium
**Evidence:** Codebase: `onPress={() => { // TODO: open search }}`. Empty handler. No search screen, no state, no empty state design.

**Implication:** Visible unimplemented UI is a credibility failure. Users with a specific destination tap search, nothing happens, and they lose trust. The fix is either implement it (ride template search by region/difficulty/distance) or hide the icon until it's ready.

---

### Theme 8: Social section creates false expectation of interactivity
**Severity:** Medium (Separate initiative)
**Evidence:** Avatar `<div>` elements have no event handlers. "+" button has no `onClick`. Copy is excellent and the pace-matching insight is genuinely differentiated.

**Implication:** Friend availability and pace matching are exactly what a social rider needs to see before committing to a trip date. The copy is right. But avatars look tappable (they're styled as action chips), the "+" looks functional — neither works. This is a credibility risk especially for the Social Organizer segment who came specifically for this feature.

---

## Insights → Opportunities

| Section | Insight | Opportunity | Impact | Effort |
|---------|---------|-------------|--------|--------|
| Draft cards | Returning users can't resume a draft in 1 tap | Single tap → push navigate to Trip Editor (unblock backend dep) | High | Med |
| Hero card | FROM/TO looks like a form but behaves like a button | Model A: entire card = 1 pressable zone, remove divider, rename TO | High | Low |
| Hero card | FROM always shows "My garage" regardless of location | Pre-fill FROM with current location (expo-location + Mapbox geocode) | Med | Low |
| Mode pills | Mode selection teaches users that taps do nothing | Wire mode to filter SmartTripCard + pass ?mode param to create-trip | High | Low |
| Add Roads | Users don't know which trip "+" adds roads to | Show "Adding to: [Trip Name]" pill at section header | High | Low |
| Add Roads | Road card body tap is a dead zone | Build Road Detail screen (map, photos, elevation, reviews, add CTA) | Med | High |
| Search | Search icon raises expectations the app can't meet | Implement ride template search or hide icon until ready | Med | Med |
| FAB | 4 CTAs compete for the same action | FAB label updates to "Create [mode]" when mode pill selected | Med | Low |
| SmartTripCard | "Tweak" exit flow is undefined | Action sheet on back-without-saving: Save / Discard / Keep editing | Med | Low |
| Trip Basket | Best feature hidden behind broken entry point | Show basket empty state earlier — before any roads are added | Med | Low |

---

## User Segments Identified

| Segment | Characteristics | Primary need on Discovery | Current friction | Est. size |
|---------|----------------|--------------------------|-----------------|-----------|
| The Returning Planner | Has 1–3 drafts, opens to continue | Resume a draft in 1 tap | Draft tap is broken — 3 steps, empty sheet | ~40% |
| The Spontaneous Rider | No plan, wants to go now | Find a route and start in under 60s | 4 competing CTAs, no clear "start here" | ~30% |
| The Weekend Optimizer | Uses AI suggestions, detail-oriented | Pre-built route + ability to tweak | Mode doesn't filter, Tweak exit undefined | ~20% |
| The Route Collector | Browses roads, social rider, multi-session | Road detail + invite friends | Road detail missing, social is display-only | ~10% |

---

## Recommendations

### P0 — Fix before any other work

**1. Unblock draft card navigation**
Single tap on a draft card must push navigate directly to the Trip Editor. Remove the white banner and empty sheet entirely. This is the highest-value fix — returning planners are 40% of users and currently cannot do the one thing they came to do.
- Dependency: backend must support loading trip by ID inside `create-trip` modal
- Code change: `handleDraftPress` in `draft-trip-strip.tsx` currently has TODO — implement `router.push('/(modals)/create-trip?tripId=${draftId}')`

**2. Implement Model A on the hero card**
Make the entire `PlanRideCard` one pressable surface. Remove the 1px vertical divider. Rename "Pick or loop ↺" to "Pick destination". Move loop toggle inside `create-trip`. Pre-fill FROM with current location via `expo-location`. These are all changes to one component — low effort, eliminates the screen's most confusing dead zone.

### P1 — High impact, implement in next sprint

**3. Wire trip mode pills to downstream content**
Pass selected mode as `?mode=day|overnight|multi` param to `create-trip`. Filter `SmartTripCard` content by duration. Update FROM/TO subtext to hint at the mode ("Home by 7pm", "1 night away"). This makes the first meaningful interaction on the page actually do something.

**4. Add active trip context to Add Roads section**
Show "Adding to: [Trip Name]" pill at the section header when an active trip exists in local state. Define active trip as the most recently opened/edited draft in the current session (stored in Zustand/context). The "+" button already works in the prototype — it just needs visible context.

**5. Fix or hide the search icon**
An empty `onPress` on a visible UI element is a credibility failure. Implement ride template search (query by region, surface type, difficulty, distance range) or hide the icon until it's ready.

### P2 — Valuable, plan for next cycle

**6. Design and build the Road Detail screen**
Tapping a road card body currently does nothing. Road Detail is a new screen: full Mapbox map, photos carousel, elevation profile, distance/surface/difficulty stats, user reviews, seasonal access info, "Add to trip" CTA. This unlocks the Route Collector segment and makes the "Add Roads" section genuinely useful.

---

## What's Working Well

These sections are well-designed and should not be changed:

- **SmartTripCard content** — AI context (bike + forecast), insight bullets (weather, pass status, refuel planning), and stats row are excellent and genuinely differentiated
- **TripDetailSheet** — day-by-day timeline, weather per day, "Riding with" section, and Edit + nav CTAs are the most complete interaction in the design
- **Draft card visual design** — title, stops/km, progress bar, note text — the right information hierarchy
- **Social availability copy** — "Marek & Sara are free Saturday. Kai is riding the Dolomites." is exactly the right framing; pace matching hint is a strong differentiator

---

## Questions for Further Research

- Do returning planners primarily resume the most recent draft, or do they choose from a list? (Affects whether single-tap vs. list-first navigation is right)
- What is the average number of drafts per active user? (Affects how prominently to surface the "3 drafts" link vs. always showing all)
- At what scroll depth do users lose interest in Discovery? (Affects whether Invite Riders is seen at all)
- Do users understand that the Trip Basket represents a trip they're building, or do they think it's a saved collection? (Affects labelling and empty state design)
- What is the conversion rate from Discovery session to Trip Editor open? (Establishes baseline before the P0 fixes)

---

## Methodology Notes

This synthesis is based on heuristic evaluation of the HTML design prototype (`discover-redesign/index.html`) combined with review of 5 screen recordings of the current live implementation in `apps/mobile`. No external user participants were involved. Findings reflect expert judgment against established UX heuristics (Nielsen's 10, Fitts's Law, affordance theory) and direct code inspection of `plan-ride-card.tsx`, `draft-trip-strip.tsx`, and `create-trip.tsx`.

Segment size estimates are directional hypotheses, not measured data. Validate with analytics (session funnel, feature tap rates) before using for prioritisation decisions.
