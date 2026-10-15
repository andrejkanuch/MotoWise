---
title: Rider Insights Redesign - Plan
type: feat
date: 2026-10-10
topic: rider-insights-redesign
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Rider Insights Redesign - Plan

## Goal Capsule

- **Objective:** A rider who records rides has a reason to open the app after every ride and sees, on one screen, where, when and how they ride, with a Pro layer that explains it. After this ships, the screen is reached from Home, My Rides and every ride summary, returns a new number after each saved ride, and is the surface the ride paywall sells.
- **Means:** Rebuild the "Roads I've ridden" screen from scratch through the Impeccable design loop with a UI/UX agent team, keep everything visible today free, add four Pro insight groups computed on the backend, and add three entry points.
- **Product authority:** Owner (Andrej). This plan covers area 2 of the ride Pro work; paywall plumbing and live sharing are separate plans, not active scope here.
- **Open blockers:** None before planning.

---

## Product Contract

### Summary

Replace the buried heatmap screen with a Rider Insights screen: the free map, three totals and year recap stay, Territory, Rhythm, Best rides and Bikes become Pro groups rendered as overlays and cards behind blurred glass showing the rider's real numbers, and the screen gains a Home card, a My Rides header and a one-line hook on every ride summary. Insights are computed server-side; the screen and its entry points are designed in the Impeccable loop before build.

### Problem Frame

The heatmap screen is reachable from one row inside the profile account section and nowhere else; the My Rides screen does not link to it and the Home screen has no card. In the last 90 days 98 users opened the rides tab, 34 reached the heatmap, and those 34 made 57 views in total, so almost nobody returns. The map opens zoomed out to the globe, the countries counter reads 0 for nearly everyone because the region field is filled on 1% of rides, and the recap share text still says "via MotoWise". Riders with 10 or more rides are the heaviest users and the group this screen exists for, yet only 1 of 13 has ever paid, and the screen gives them three numbers and no reason to come back. The Play listing promised "advanced rider analytics" until #271 removed the claim; the copy can return once this screen ships on both platforms.

### Key Decisions

- **Everything visible today stays free.** The map, the three totals, the year recap and the share cards are frozen free. Governs R1, R2, R3.
- **Pro overlays draw on the free map** (session-settled: user-directed — chosen over a second map inside the Pro section and over making Territory free: the free map never changes, Pro layers render on top, nothing a rider sees today disappears). Governs R5.
- **Share cards stay free** (session-settled: user-approved — chosen over Pro with a watermarked preview: recaps are acquisition, not revenue, per the research on Relive and Strava). Governs R3.
- **Locked cards show blurred real numbers** (session-settled: user-approved — chosen over title-only cards: the rider's own number is the hook). Governs R9.
- **Below five rides the card explains instead of hiding** (session-settled: user-directed — chosen over hiding the card entirely: the card reads "Not enough rides yet, keep riding" until the fifth qualifying ride). Governs R10.
- **All four insight groups ship in the first release, computed on the backend** (session-settled: user-directed — chosen over a phone-computed v1 with two groups: the owner wants the full set and a server source of truth). Governs R5 to R8, R14.
- **Screen plus its entry points; the tab bar is untouched** (session-settled: user-directed — chosen over screen-only and over reshaping navigation). Governs R11 to R13.
- **Designed through the Impeccable design loop with a UI/UX agent team before build.** The dialogue established that discovery and return value are both broken, so layout is not patched in place.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers the Rider Insights screen, its insights and its entry points. The breakdown below is the current understanding, not a committed roadmap.

- Ride-moment paywall plumbing (`docs/plans/2026-10-10-1621-feat-ride-moment-paywall-plumbing-plan.md`)
  - Depends on this plan for the Pro surfaces its live phase sells.
  - Shares the ride-summary card: the one-line hook here is the same card as the milestone teaser there.
  - Owns the placements and offering, including `rider_insights`; this plan uses that placement.
- Live sharing demand test (`docs/plans/2026-10-10-1621-feat-live-sharing-fake-door-plan.md`)
  - Can proceed independently of this plan.
- Later insight work (season-over-season, cost of riding, heatmap filters, web)
  - Still to decide after this ships; needs a second season of data or odometer readings.

### Actors

- A1. Rider who records rides (free or Pro).
- A2. Pro rider.
- A3. Backend computing insights from the rider's rides.

### Requirements

**Free layer**

- R1. The map opens fitted to the rider's own ride bounds, draws roads ridden more often brighter and thicker, and keeps as content exactly what is free today: the three totals (rides, lifetime distance, countries), the year recap, the personal-record badges and toast, and the period totals and vs-last-period trend on My Rides.
- R2. Countries are computed from route geometry, not from the ride region field.
- R3. The season recap image share card is free for every rider and carries no watermark; share cards built from Pro-group data (territory map, rhythm grid) are deferred.
- R4. The recap share text names MotoVault.

**Pro insight groups**

- R5. Territory: explored area in km², share of this season's distance on roads never ridden before, furthest point from home, and the most-ridden road, with the explored cells and the most-ridden road drawn as overlays on the free map when a Pro rider taps the item.
- R6. Rhythm: a weekday by hour grid in the rider's local time, season-so-far month-by-month distance bars, and the typical ride as median distance and duration with its trend.
- R7. Best rides: the top rides per season and per bike, each opening its route on the map, and the climb comparison ("about half an Everest"); the existing personal records and period totals stay free under R1.
- R8. Bikes: distance, rides and hours per bike, and distance ridden since the last logged service for each bike.
- R9. For a non-Pro rider every Pro group renders as a blurred-glass card over the rider's real numbers; tapping opens a native intro sheet in the Race Plate style with the rider's headline, and "See plans" requests the paywall with the `rider_insights` placement.
- R10. Below five qualifying rides every Pro card reads "Not enough rides yet, keep riding" with no numbers and no paywall; from the fifth ride the blurred numbers appear.

**Entry points**

- R11. A Home card shows the rider's latest insight headline and opens the screen.
- R12. The top of My Rides carries the screen's headline and entry.
- R13. Every ride summary shows one line with a number from that ride, computed from the ride already completed at Stop: for Pro riders the new-roads distance ("+12 km of new roads"), for non-Pro riders a free-layer number (lifetime distance or ride count after this ride). When the preferred item is zero or its backend value is not yet available, the line falls back in this order, skipping any candidate that is zero or unavailable and never re-selecting the preferred item: new-roads distance, the ride's rank by distance this season, lifetime distance after this ride computed on the device. This is the same card the paywall plumbing plan uses (its R6).

**Computation and data**

- R14. Insights are computed on the backend from the rider's completed rides and returned per group with a locked flag for non-Pro riders; a locked group carries one rounded headline value, the number its blurred card shows, and no other fields.
- R15. Qualifying rides, as defined in the paywall plumbing plan (its R1), drive patterns, best rides and the five-ride threshold; the three free totals count every completed ride, including system-ended and short ones.
- R16. The free request never carries a locked group's detail values, map overlays or per-ride lists.

**Measurement**

- R17. Showing and tapping a Pro card emits events naming the card; paywall events carry the `rider_insights` placement.
- R18. Opening the screen is tracked from each entry point separately.

**States**

- R19. Each Pro group has its own not-enough-data state in the style of R10 when its inputs are missing (no route for Territory, no climb for Best rides, no bike for Bikes, no prior month for the Rhythm comparison), naming what is missing and never showing a number.
- R20. The screen, the Home card, the My Rides header and the summary line each have loading, offline, failure and zero-ride states; the design loop specifies them, and a failed or pending request never shows a placeholder number.

### Key Flows

- F1. Free rider after a ride
  - **Trigger:** A1 saves a qualifying ride.
  - **Steps:** Summary shows the one-line hook; tap opens Rider Insights (when a paywall plumbing trigger is due and the rider is eligible, the same card is in its teaser state and the tap opens the paywall instead, per that plan's R6); map fits to bounds; Territory card shows blurred real numbers; tap opens the intro sheet; "See plans" opens the paywall.
  - **Covers:** R1, R9, R13, R14, R16, R17.
- F2. Pro rider
  - **Trigger:** A2 opens the screen from the Home card.
  - **Steps:** All four groups render clear; tapping "most-ridden road" highlights it on the map; tapping a best ride opens its route.
  - **Covers:** R5, R7, R11.
- F3. New rider
  - **Trigger:** A1 with two rides opens the screen.
  - **Steps:** Map and totals show; each Pro card reads "Not enough rides yet, keep riding".
  - **Covers:** R10.

### Acceptance Examples

- AE1. **Covers R5, R9.** Given a non-Pro rider with 20 qualifying rides, when they open Territory, then the card shows blurred real values and no overlay draws on the map.
- AE2. **Covers R10.** Given a rider with 4 qualifying rides and 3 test taps, when they open the screen, then every Pro card shows the keep-riding text and no paywall can be opened from it.
- AE3. **Covers R14, R16.** Given a non-Pro rider, when the client requests insights, then the response marks all four groups locked and carries one rounded headline value per group and nothing else.
- AE4. **Covers R8.** Given a Pro rider with two bikes and one logged service on the first, when they open Bikes, then distance since last service shows for the first bike and "no service logged" for the second.
- AE5. **Covers R13.** Given a Pro rider, when the summary opens after they stop a ride, then it shows the new-roads number and tapping it opens Rider Insights, not a paywall.

### Success Criteria

- Share of riders with a saved ride in the last 30 days who open Rider Insights within 7 days of a ride, against a baseline computed with the same definition over the trailing 90 days before launch (the only figure to hand today, 34 of 98 rides-tab viewers reaching the old screen, uses a different denominator).
- Return rate: median views per viewer per 30 days, against a baseline computed with the same definition before launch (today's 1.7 views per viewer is over 90 days).
- Purchases attributed to the `rider_insights` placement, judged by counts per the paywall plumbing plan.
- Guardrails: no drop in rides per rider per week; no new 1 to 2 star reviews mentioning a paywall.

### Scope Boundaries

- Deferred: territory map and rhythm grid share cards (they would hand Pro-group data to free riders; revisit once the screen shows a return signal), season-over-season comparison (needs a second season), cost of riding and cost per distance (needs odometer readings), heatmap filters by year or bike, a web version, commute detection, repeated-route comparison, a shareable season report image beyond the free cards.
- Outside this product's identity: badges, streaks, goals, leaderboards, comparison with other riders, achievement language.

### Dependencies / Assumptions

- Needs a store build after 3.25.0 (new screens and placement); the API ships first.
- Route polylines are filled on 82% of rides, elevation gain on 79%, bike on 93%; weather and lean angle are 0% and are not used.
- Existing ride rollups are not the source: they bucket by UTC, are not decremented on soft delete and have no hour of day.
- The Impeccable design loop runs before build and may change layout but not the free/Pro line in this plan.

### Outstanding Questions

**Deferred to Planning**

- Time-zone source for Rhythm; none is stored today.
- Grid cell size for explored area and the definition of home (most common start cell is the candidate).
- Whether the lean-angle tile on ride detail is removed in this work or separately.

### Sources / Research

- GitHub issues #305, #267 and the 2026-10-07 research comments on #270 and #267.
- `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx` (globe zoom level 1.2, "via MotoWise"); `components/profile/account-section.tsx` is the only entry point; `config/routes.ts` HEATMAP constant is unused.
- `apps/mobile/src/components/share/` card variants and `react-native-view-shot`.
- PostHog 90-day pull 2026-10-10: 98 rides-tab viewers, 34 heatmap viewers, 57 views.
- Prod aggregate 2026-10-09: 1,226 completed rides, 144 riders, field fill rates.
