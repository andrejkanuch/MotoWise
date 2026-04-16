---
title: "feat: Nav-app handoff (&quot;Ride this&quot; sheet) on routes and trips"
type: feat
status: active
date: 2026-04-16
---

# Nav-app handoff ("Ride this" sheet) on routes and trips

## Overview

Riders don't ride *in* MotoWise — they ride *with* Apple Maps / Google Maps / Waze / Calimoto / Rever / TomTom running on a phone mount or GPS. Right now our planner is a dead-end: you can build a beautiful trip, save routes, compute fuel stops — and then there's no verb. There's a half-built "Open in Maps" button on `trip-detail` that only wires the first + last waypoint and ignores everything in between. On `route-detail` the only handoff is a GPX download.

This plan ships the missing verb as a **single sticky primary CTA — "Ride this" — on both `route-detail` and `trip-detail`**, backed by one reusable `<RideThisSheet />` component that knows how to hand the whole route (including mid-waypoints, chunked when Google caps at 10) to four destinations: Apple Maps, Google Maps, Waze (per-stop handoff loop), and GPX for every offline GPS app the rider already uses.

Pulls in source ideas from Postnikova §Open in Google Maps (p.67-68) and the TraveLog case study on "turning planning into action."

## Problem Frame

Today's nav handoff is three disconnected code paths:

```
route-detail.tsx
  └── handleExportGPX()           → Linking.openURL(`${API}/routes/${id}/export.gpx`)
                                    opens a browser tab, no auth headers, no Share sheet.
                                    Exists in useGpxExport hook too but unused here.

trip-detail.tsx
  ├── handleOpenInMaps()          → ONLY first + last waypoint
  │                                 iOS → maps://?saddr=&daddr=
  │                                 Android → https://www.google.com/maps/dir/?api=1&origin=&destination=
  │                                 All mid-stops silently dropped.
  └── handleExportGPX()            → builds GPX in-app, writes to Paths.cache, Sharing.shareAsync.

route-map-view.tsx
  └── openInMaps()                → single-destination Apple/Google pattern (used elsewhere).
```

Symptoms:

- Multi-stop trips **lose all their planning** the moment the rider taps "Open in Maps". The whole reason they used us evaporates at the handoff.
- No Waze support despite Waze being the dominant free navigation app in many motorcycle markets.
- Route detail's GPX path bypasses the share sheet (`Linking.openURL` on the API endpoint opens a browser, strips auth, user has to re-sign-in just to download a file).
- No chunking strategy for Google Maps' hard **10-waypoint URL limit**. A 14-stop Portugal loop simply fails.
- Handoff is buried: on `route-detail` it's one of three 44×44 floating glyphs up top; on `trip-detail` there's an icon inside the sheet. Neither reads as "this is the action."
- Zero analytics granularity. We know `TRIP_OPENED_IN_MAPS` fired, but not *which* provider, not whether chunking was used, not whether it was from a trip or a route.

## Requirements Trace

- R1. One component — `<RideThisSheet />` — used by both `route-detail.tsx` and `trip-detail.tsx`.
- R2. "Ride this" is the **single visual primary action** on both screens, sticky at the bottom edge, not buried in a BottomSheet tile row or in the top-right corner.
- R3. The sheet offers four handoffs with clear, rider-facing labels (not raw brand names — "Apple Maps", "Google Maps", "Waze", "GPX for offline apps") and a one-line subtitle explaining what each does.
- R4. Apple Maps deep link carries **all** intermediate waypoints (`saddr` / `daddr` / `x-source` / via Apple-Maps-supported multi-daddr pipe syntax where available; fall back to first + last with clear "only start and end will transfer" subtitle when on iOS < 16).
- R5. Google Maps deep link carries **all** waypoints, **chunked at 10** when the trip exceeds Google's limit. When chunked, the sheet explicitly shows "Your 14-stop trip is too long for one Google Maps link. We'll open segment 1 of 2 now and hand off segment 2 when you tap Next."
- R6. Waze has no multi-waypoint URL scheme. We handle this honestly: when the trip has 2+ waypoints we open the *first destination* and show a "Segment 1 of 4 — tap Next for the next leg" banner; each tap opens the next Waze link. No pretending Waze supports multi-stop.
- R7. GPX export is one button that works for both routes and trips. For routes it goes through `useGpxExport` (the existing authed hook); for trips it continues to use the in-app GPX builder already in `trip-detail.tsx`. We surface both via the same sheet row.
- R8. All four handoffs emit **one analytics event** — `NAV_HANDOFF` — with `{ surface: 'route' | 'trip', provider: 'apple' | 'google' | 'waze' | 'gpx', waypoint_count, chunked: boolean, entity_id }`. The existing `TRIP_OPENED_IN_MAPS` and `ROUTE_GPX_EXPORTED` events are kept as aliases so downstream PostHog funnels don't break.
- R9. Per-provider availability detection: on Android, Apple Maps row is hidden; on iOS without Waze installed the Waze row falls back to opening the App Store with a short explanation ("Waze isn't installed — open the App Store?"). We use `Linking.canOpenURL('waze://')` before offering Waze as enabled.
- R10. URL builders are pure functions in a new `src/utils/nav-handoff.ts` — unit tested, no RN imports, so they run in Jest.
- R11. No new GraphQL, no schema changes, no API routes (routes GPX endpoint already exists, trip GPX is local-generated).
- R12. Destructive / external-leaving actions get a haptic (`impactAsync(Medium)`) on iOS and a PostHog event fires *before* `Linking.openURL` so we don't lose the event to app-switch.

## Non-goals (explicit)

- No in-app turn-by-turn. We're a planner, not a navigator.
- No Calimoto / Rever / TomTom deep links (they have no public URL schemes for shared routes). They consume our existing GPX, that's the contract.
- No changing existing GPX server output. The API route `/routes/:id/export.gpx` stays as-is.
- No `trip_waypoints.period_of_day` — that's P1.3 (separate `/slfg` run).
- No general "duplicate CTA audit" — that's P1.2 (separate `/slfg` run).

## Proposed Solution

### Architecture

```
apps/mobile/src/utils/nav-handoff.ts              [new, pure fns, unit-tested]
  - buildAppleMapsUrl(waypoints)          → string | null
  - buildGoogleMapsUrls(waypoints)        → { urls: string[], chunked: boolean }   // chunks at 10
  - buildWazeUrls(waypoints)              → string[]                               // 1-per-stop sequence
  - chunkWaypointsForGoogle(wps)          → Waypoint[][]                           // exported for tests

apps/mobile/src/components/ride-this-sheet.tsx    [new]
  - Modal bottom sheet, 4 rows (Apple / Google / Waze / GPX)
  - Each row: icon, label, one-line subtitle, right chevron, disabled state
  - "Next segment" sub-flow for Google chunking and Waze per-stop
  - Accepts: { visible, onClose, surface: 'route' | 'trip', entityId, entityName, waypoints, onGpxExport }

apps/mobile/src/hooks/use-ride-this.ts             [new]
  - Centralizes: canOpenWaze state, appleMapsAvailable, segment-state machine for chunked handoffs,
    analytics emission, haptics.
  - Returns: { open, close, visible, nextSegment, currentSegment, totalSegments, providers }

apps/mobile/src/app/(modals)/route-detail.tsx      [modified]
  - Remove GPX floating button & in-sheet GPX tile
  - Add sticky bottom "Ride this" CTA bar above safe area
  - Mount <RideThisSheet /> with single-segment route waypoints derived from
    polyline endpoints (route-detail only exposes start/end, so Waze/Apple are degenerate 2-point)
  - Keep Save / MapStyle / Share floating glyphs (those are not primary actions)

apps/mobile/src/app/(modals)/trip-detail.tsx       [modified]
  - Delete handleOpenInMaps (lossy first+last impl)
  - Delete in-sheet "Open in Maps" + "Export GPX" tiles (replaced by sheet)
  - Add sticky bottom "Ride this" CTA (visible even when user scrolls waypoints)
  - Mount <RideThisSheet /> with full waypoint array ordered by dayIndex then position

apps/mobile/src/lib/analytics.ts                   [modified]
  - Add NAV_HANDOFF event key
  - Keep TRIP_OPENED_IN_MAPS (aliased from the handler for continuity)
```

### URL scheme contract

```ts
// Apple Maps — iOS ≥ 16 supports multi-destination via pipe syntax on daddr
// https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
// Fallback when unsupported: first → last, with an in-sheet disclaimer.
maps://?saddr={lat0},{lng0}&daddr={lat1},{lng1}+to:{lat2},{lng2}+to:{lat3},{lng3}&dirflg=d

// Google Maps — universal /maps/dir/?api=1 supports up to 9 waypoints + 1 destination.
// We treat it as 10 total, chunking (0..9), (9..18), ...
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
https://www.google.com/maps/dir/?api=1
  &origin={lat0},{lng0}
  &destination={latN},{lngN}
  &waypoints={lat1},{lng1}|{lat2},{lng2}|...
  &travelmode=driving

// Waze — single destination only.
// https://developers.google.com/waze/deeplinks
waze://?ll={lat},{lng}&navigate=yes
```

### Chunking algorithm (Google Maps)

```
Given waypoints w0..wN where N+1 > 10:
  chunks[i] = w[10*i .. min(10*(i+1), N+1)] ensuring the LAST point of chunk i
             equals the FIRST point of chunk i+1 (overlap = handoff).
             This avoids "teleport" gaps between chunks.
```

When overlap is applied: 14 stops → chunks of 10 + 5 with the 10th stop duplicated as the start of chunk 2. Sheet UI says "Segment 1 of 2 → Segment 2 of 2" and reuses the same modal.

### Sticky primary CTA — visual spec

```
┌──────────────────────────────────────────────────┐
│  Trip content / BottomSheet scroll               │
│                                                  │
├──────────────────────────────────────────────────┤
│  [   ▶  Ride this   ]   44px tall, full-width    │  ← accent500 bg, palette.white text, bold 17px
│                                                  │    shadow.medium, insets.bottom + 12
│  Waypoints: 7 · Distance: 312 km                 │  ← body-muted 12px
└──────────────────────────────────────────────────┘
```

- Color: `palette.accent500` bg, `palette.white` fg — the unambiguous primary.
- Lives in an absolutely-positioned View with `bottom: insets.bottom + 12`, above the BottomSheet contents.
- Does not double as the bookmark / share / map-style buttons — those stay as secondary floating glyphs at top.

### Sheet layout

```
┌ Ride this ────────────────────────────────────── X ┐
│                                                    │
│  🍎  Apple Maps                                 ›  │
│      Full multi-stop handoff (iOS 16+)             │
│  ──────────────────────────────────────────────    │
│  🌍  Google Maps                                ›  │
│      14 stops → 2 segments (we'll hand off)        │ ← only when chunked
│  ──────────────────────────────────────────────    │
│  🧭  Waze                                       ›  │
│      One stop at a time · 7 segments               │ ← when multi-waypoint
│  ──────────────────────────────────────────────    │
│  📄  GPX for offline apps                       ›  │
│      Calimoto · Rever · TomTom · Scenic            │
│                                                    │
└────────────────────────────────────────────────────┘
```

Row = `Pressable`, 56px tall, `palette.surfaceElevated` bg, icon in `palette.neutral400` when disabled.

### State machine for chunked / multi-leg handoff

```
idle
  └── user taps primary CTA → sheetVisible
          └── user taps Google (chunked) or Waze (any)
                ├── emit NAV_HANDOFF with chunked=true, segment=1
                ├── Linking.openURL(segment[0])
                ├── sheet keeps open, row replaced with
                │       "Segment 1 of N opened · Tap Next for segment 2"
                └── user returns to app → taps Next
                         └── Linking.openURL(segment[i++]); emit with segment=i+1
                         └── when i === N-1 → row back to default, haptic success
```

We do not persist this state across app backgrounding beyond one session (zustand ephemeral or React `useState` in the hook). If the app is killed between segments, the rider re-taps "Ride this" and picks up from segment 1 — safer than assuming we know where they are.

### Copy (rider-facing)

- Primary CTA: **Ride this**. Not "Start", not "Open in Maps", not "Navigate".
- Sheet title: **Ride this**. Not "Open in...".
- Subtitle under primary CTA on trip-detail: `${waypointCount} stops · ${totalDistance}` (skip distance on route-detail since it already shows in the sheet).
- Chunked Google subtitle is computed at render: `${waypointCount} stops → ${segmentCount} segments (we'll hand off)`.
- GPX subtitle: **Calimoto · Rever · TomTom · Scenic** — signals compatibility without promising integrations we don't have.
- iOS Apple-Maps-only-start-and-end fallback subtitle: **Only start and end will transfer. Use GPX for mid-stops.**

## Files we will change

- `apps/mobile/src/utils/nav-handoff.ts` — **NEW**, pure URL builders + chunker, fully unit-tested.
- `apps/mobile/src/utils/__tests__/nav-handoff.test.ts` — **NEW**.
- `apps/mobile/src/components/ride-this-sheet.tsx` — **NEW**, the modal bottom sheet.
- `apps/mobile/src/hooks/use-ride-this.ts` — **NEW**, centralizes sheet + segment state + analytics.
- `apps/mobile/src/lib/analytics.ts` — add `NAV_HANDOFF` event.
- `apps/mobile/src/app/(modals)/route-detail.tsx` — wire sticky CTA + sheet, drop in-sheet GPX tile.
- `apps/mobile/src/app/(modals)/trip-detail.tsx` — wire sticky CTA + sheet, delete `handleOpenInMaps`.

No API, no GraphQL, no DB.

## Technical considerations

### `canOpenURL` + `LSApplicationQueriesSchemes`

iOS requires URL schemes we plan to probe to be in `Info.plist > LSApplicationQueriesSchemes`. Check existing `app.json` / `app.config.ts`. If `waze` and `maps` aren't registered, add them. Google Maps web URLs do not need this (they're `https`). Without this, `canOpenURL` silently returns false and Waze row stays disabled forever.

### Analytics event continuity

Keep `TRIP_OPENED_IN_MAPS` and `ROUTE_GPX_EXPORTED` events emitted alongside `NAV_HANDOFF`. PostHog dashboards presumably filter on those. Two events for the same action is cheap; breaking a dashboard isn't.

### Apple Maps iOS 16 gating

The `+to:` syntax on Apple Maps is iOS 16+. We target iOS 17 per `apps/mobile/app.json` anyway, but platform version can be read off `DeviceInfo` / `Platform.Version` — if ever <16, fall back to first+last with the disclaimer subtitle.

### GPX path dedup

`route-detail.tsx` today does `Linking.openURL` on the API endpoint. This is wrong and we're fixing it regardless — it strips auth, opens a browser, the rider has to sign in again just to get a file. The correct path is `useGpxExport` which authenticates, caches to `Paths.cache`, and opens the native Share sheet. The sheet always uses `useGpxExport` on routes and the inline GPX builder on trips.

### Bottom sheet z-index / gesture conflict

`route-detail` and `trip-detail` already use `@gorhom/bottom-sheet`. Adding a Modal on top is fine (RN Modal is a separate window), but the **sticky primary CTA** lives in the same `<View>` tree as the BottomSheet. Place it at `position: 'absolute'` with `zIndex: 10` *outside* the BottomSheet. Test that BottomSheet drag-handles still work — they should, because the CTA is above them not on top of them.

### Accessibility

- `accessibilityRole="button"` on primary CTA.
- `accessibilityLabel` includes destination: "Ride this — opens handoff options for 7 stops".
- Each sheet row has `accessibilityHint` describing what happens ("Opens Apple Maps with your 7-stop route").
- Minimum 44pt hit target on CTA and rows (spec: 56 and 56 — pass).

### No colors outside the palette

All styling uses `palette.accent500`, `palette.surfaceElevated`, `palette.neutral*`, `palette.danger500`. Zero hex, zero rgba. Matches repo rule.

## Acceptance Criteria

- [ ] New utility `src/utils/nav-handoff.ts` exports `buildAppleMapsUrl`, `buildGoogleMapsUrls`, `buildWazeUrls`, `chunkWaypointsForGoogle` — all pure, zero RN imports.
- [ ] Unit tests cover: 1/2/3/10/11/20 waypoint shapes, empty arrays, iOS <16 detection path, Google chunk-overlap invariant (last of chunk N == first of chunk N+1), URL escape of special characters in waypoint names.
- [ ] New `<RideThisSheet />` renders four rows with correct enabled/disabled state based on platform + `canOpenURL` probes.
- [ ] `route-detail.tsx` shows a sticky `Ride this` CTA at the bottom; the previous in-sheet GPX tile and top-right GPX path are removed.
- [ ] `trip-detail.tsx` shows a sticky `Ride this` CTA at the bottom; the previous in-sheet Navigation + GPX tiles are removed; `handleOpenInMaps` is deleted.
- [ ] 14-waypoint trip opens segment 1 of 2 in Google Maps, comes back to app, user taps Next, opens segment 2. The shared waypoint appears at end of seg1 and start of seg2.
- [ ] Waze path on a 4-stop trip opens first stop, shows "Segment 1 of 4 · Next", ticks through to 4 and closes the sheet.
- [ ] Opening GPX from route-detail goes through the authed `useGpxExport` hook (verified by throwing on unauthed in a test).
- [ ] Opening GPX from trip-detail keeps using the inline GPX builder path (no regression on what already works).
- [ ] `NAV_HANDOFF` event fires with the right `{ surface, provider, waypoint_count, chunked, entity_id }` for every handoff.
- [ ] `TRIP_OPENED_IN_MAPS` and `ROUTE_GPX_EXPORTED` continue to fire (dashboard continuity).
- [ ] iOS `LSApplicationQueriesSchemes` includes `waze` and `maps` (verified in `app.config.ts` / `app.json`).
- [ ] `pnpm --filter @motovault/mobile typecheck` passes.
- [ ] `pnpm lint` passes on changed files.
- [ ] `pnpm test` passes including new unit tests.
- [ ] Every color comes from `@motovault/design-system` palette — grep confirms no new hex / rgba literals.

## Out of scope (followups)

- **P1.2** — Destructive-action audit, FAB de-dup on discover, map-marker action sheet, helper-text → inline-hint conversion, coachmark strategy. Separate `/slfg`.
- **P1.3** — `period_of_day` on `trip_waypoints` + nested bottom-sheet groups on `create-trip`. Requires Supabase migration + codegen. Separate `/slfg`.
- **P2.3** — In-sheet "Ask the trip" AI assistant can later live right above the Ride this CTA; this plan leaves vertical room for it but doesn't ship it.

## Risks

- **Apple Maps multi-stop `+to:` fragility** — Apple's spec page is infamous for being ambiguous. Ship with a feature flag we can flip to first+last-only if TestFlight rider reports crashes / wrong routes. Measured by a `NAV_HANDOFF` failure signal + optional user-facing "This didn't look right?" hook (not in scope, just noted).
- **Google Maps URL length** — With 10 waypoints the URL is ~600–800 chars. Well under the 8K budget on iOS/Android WebIntent. Still, we log URL length on emit so we can catch an edge.
- **Waze scheme not registered** — If `LSApplicationQueriesSchemes` is missed, Waze row disables forever on iOS and users see nothing. Catch in the sheet: when disabled for `canOpenURL=false` *and* the user has a likely-installed Waze (heuristic: scheme probe failed), show "Tap to install Waze" that opens the App Store link. One tap to recover.
- **Analytics double-count** — We emit both `NAV_HANDOFF` and the legacy event. Ensure dashboard owners know this before enabling a funnel on both.

## Pipeline

- `/ce:plan` — this doc.
- `/ce:work` — implement per acceptance criteria.
- `/ce:review` — correctness, maintainability, security reviewers plus agent-native-reviewer (the CTA must be tool-callable in the future).
- Fix findings.
- Commit with message: `feat(mobile): add Ride this handoff sheet to routes and trips`.
