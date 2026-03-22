---
title: "feat: Ride Logging & Live Ride HUD"
type: feat
status: active
date: 2026-03-22
---

# feat: Ride Logging & Live Ride HUD

## Overview

Transform MotoVault from "open when something breaks" into "open every time you ride" — with background GPS ride recording, a real-time HUD, and automatic mileage sync to maintenance schedules. The moat: **ride → mileage → maintenance → expenses → AI diagnostics**. No competitor closes this loop.

## Problem Statement / Motivation

- DAU/MAU is ~10% (utility-only app). Ride logging creates a daily engagement touchpoint.
- REVER, Calimoto, and Scenic own the "daily ride" moment. Every ride logged there is one NOT logged in MotoVault.
- `motorcycle.current_mileage` is only updated manually. Ride logging auto-increments it, making OEM maintenance schedules significantly more accurate.
- **Target:** DAU/MAU from ~10% → 25%+. 40% ride adoption in 30 days. 85% mileage acceptance rate.

## Proposed Solution

Three-phase implementation over 10 weeks (Phase 4/v1.1 is out of scope):

1. **Phase 1 (Weeks 1–5):** Core recording — GPS spike, database, API, mobile state machine, background GPS, HUD, auto-pause
2. **Phase 2 (Weeks 6–8):** Mileage sync — Ride Summary with Mapbox, mileage prompt, maintenance alerts, ride history
3. **Phase 3 (Weeks 9–10):** Polish — Free/Pro tier, ride naming, edge cases, testing

## Technical Approach

### Architecture

Three-layer split matching existing monorepo patterns:
- **Mobile** (Expo 54 / RN 0.81): GPS via expo-location + expo-task-manager, maps via @rnmapbox/maps, state via Zustand (scalars) + MMKV (waypoints/routes)
- **API** (NestJS 11 / Apollo GraphQL): New rides module, cursor pagination, waypoint quotas, @Throttle rate limiting
- **Persistence** (Supabase PostgreSQL): rides + ride_waypoints tables, composite PK, full RLS, GDPR purge

Key technical decisions:
- **MMKV** for ride state persistence (not Zustand/AsyncStorage) — Android Hermes isolation
- **Client-generated UUID** for rideId — enables offline-first recording
- **Composite PK** (ride_id, recorded_at) on waypoints — eliminates UUID overhead on high-frequency inserts
- **Position delta + speed** for auto-pause — not speed alone (GPS reports 0 at walking pace)
- **Cumulative-distance color stops** for gradient polyline — not index-based (GPS clusters in slow sections)

### Implementation Phases

#### Phase 1: Core Recording (Weeks 1–5)

**Week 1: Android GPS Spike (GO/NO-GO Gate)**

Critical risk mitigation before committing to full build:
- EAS dev build on Pixel 4+ and Samsung Galaxy S21+
- 30 min screen-locked background GPS test
- MMKV persistence during force-kill
- Battery drain measurement (target: 12–15%/hr)
- Three defined outcomes: GO / CONDITIONAL GO (switch to RNBGL, +1–2 weeks) / NO-GO (defer to manual mileage)

**Weeks 2–3: Database & API**

Create files:
- `supabase/migrations/00047_create_rides_table.sql` — rides table, ride_waypoints table, indexes, RLS, triggers
- `supabase/migrations/00048_purge_soft_deleted_rides.sql` — GDPR purge function + pg_cron schedule
- `apps/api/src/modules/rides/rides.module.ts` — module registration
- `apps/api/src/modules/rides/rides.resolver.ts` — @UseGuards(GqlAuthGuard), 5 mutations + 2 queries
- `apps/api/src/modules/rides/rides.service.ts` — @Inject(SUPABASE_USER), cursor pagination, waypoint quota
- `apps/api/src/modules/rides/models/ride.model.ts` — @ObjectType() with camelCase fields
- `apps/api/src/modules/rides/models/ride-connection.model.ts` — Edge/PageInfo pattern
- `apps/api/src/modules/rides/dto/start-ride.input.ts` — ZodValidationPipe(StartRideInputSchema)
- `apps/api/src/modules/rides/dto/end-ride.input.ts` — ZodValidationPipe(EndRideInputSchema)
- `apps/api/src/modules/rides/dto/upload-waypoints.input.ts` — ZodValidationPipe(UploadWaypointsInputSchema)
- `apps/api/src/modules/rides/dto/update-ride.input.ts` — ZodValidationPipe(UpdateRideInputSchema)

Follows existing pattern from `diagnostics.module.ts:1`, `diagnostics.resolver.ts:1`, `diagnostics.service.ts:1`.

**Weeks 3–4: Mobile State Machine**

Create files:
- `apps/mobile/src/stores/ride.store.ts` — Zustand, scalars only (status, currentSpeed, elapsedTime, distance, recordingSubState). Pattern: `apps/mobile/src/stores/auth.store.ts:1`
- `apps/mobile/src/utils/ride-storage.ts` — MMKV instance (`rideStorage`), chunked waypoint buffer, key helpers. Keys: `ride.current_id`, `ride.started_at`, `ride.total_paused_ms`, `ride.total_auto_paused_ms`, `ride.recording_sub_state`, `ride.permission_level`
- `apps/mobile/src/utils/ride-sync-queue.ts` — offline queue: startRide → uploadWaypoints* → endRide. Exponential backoff (1s→16s), max 5 retries, dead-letter + user notification
- `apps/mobile/src/utils/ride-location.ts` — GPS listener, auto-pause (speed < 0.5 m/s AND position delta < 5m for 60s), forgot-to-stop (10 min notify, 30 min auto-end), haversine distance calc
- `apps/mobile/src/utils/ride-permissions.ts` — onboarding pre-prompt, permission flow, "While Using" degraded mode, re-prompt strategy (3 rides iOS, direct Android), 7-day cooldown

**Weeks 4–5: HUD + Screens**

Create files:
- `apps/mobile/src/app/(modals)/start-ride.tsx` — bike picker (defaults to primary), "Quick Ride" without bike, permission check on FAB tap
- `apps/mobile/src/app/(modals)/ride-hud.tsx` — full-screen HUD. Zones: Map (top 35%), Speed 96pt hero (center 60%), Stats row (swipeable), Top bar (status + timer), Bottom controls (Pause + END RIDE 2s long-press). Dark theme #0a0a0a, expo-keep-awake, Night Mode toggle
- `apps/mobile/src/components/ride/hud-map.tsx` — @rnmapbox/maps live map, gradient polyline, pulsing blue dot, GPS quality indicator
- `apps/mobile/src/components/ride/hud-speed.tsx` — 96pt monospace speed, unit label, sunlight-readable white-on-black
- `apps/mobile/src/components/ride/hud-controls.tsx` — Pause/Resume circle, END RIDE pill with 2s long-press progress ring, 64pt targets, expo-haptics
- GraphQL operations:
  - `apps/mobile/src/graphql/mutations/start-ride.graphql`
  - `apps/mobile/src/graphql/mutations/end-ride.graphql`
  - `apps/mobile/src/graphql/mutations/upload-waypoints.graphql`
  - `apps/mobile/src/graphql/mutations/update-ride.graphql`
  - `apps/mobile/src/graphql/mutations/delete-ride.graphql`
  - `apps/mobile/src/graphql/queries/my-rides.graphql`
  - `apps/mobile/src/graphql/queries/get-ride.graphql`

#### Phase 2: Mileage Sync & Summary (Weeks 6–8)

Create files:
- `apps/mobile/src/app/(modals)/ride-summary.tsx` — Mapbox map (Dark/Outdoors/Satellite toggle), speed-gradient polyline with cumulative-distance color stops (blue < 30 km/h, green 30–80, orange > 80), start/end markers, FlyTo animation, BlurView stats overlay, share snapshot via MapView.takeSnap()
- `apps/mobile/src/components/ride/mileage-prompt.tsx` — "Update odometer? Current: X → New: X + ride". Accept / Edit / Skip. GPS accuracy warning if >50% poor points
- `apps/mobile/src/app/(tabs)/(profile)/rides.tsx` — ride history list, cursor-paginated, filterable by bike. Free: last 10 + upgrade CTA. Pro: full history + GPX export
- `apps/mobile/src/components/ride/ride-card.tsx` — date, distance, duration, route thumbnail, bike name

Mileage sync logic:
- Accept → `updateMotorcycle` mutation → `mileage_applied = true`
- After update: check maintenance tasks where `target_mileage <= new_mileage` → alert card
- Quick Ride (no bike) → skip mileage prompt

Bike detail stats card (R18):
- Total rides, total distance, total time, last ride date on Garage bike detail page

#### Phase 3: Polish & Testing (Weeks 9–10)

- Free/Pro tier logic via RevenueCat
- Ride naming (R17) — optional name field, default: "Mar 22 — 47 mi"
- GPS speed disclaimer, phone vibration warning, battery guidance (one-time dismissable)
- Signal loss interpolation (linear between known good points, dashed on map)
- Altitude dead-band filtering (ignore < 5m changes, prefer barometric)
- Performance: 60fps HUD, battery validation, auto-pause real-world testing
- E2E: offline sync, crash recovery, cursor pagination at 100+ rides, night mode

## System-Wide Impact

### Interaction Graph

- FAB tap → `checkAndRequestPermissions()` → bike picker modal → `startRide` mutation → GPS listener starts → MMKV writes → Zustand UI updates
- GPS callback → `rideLocationListener()` → auto-pause check (position delta + speed) → waypoint buffered in MMKV → flush to API every 50 points
- END RIDE long-press → `endRide` mutation → ride summary screen → mileage prompt → `updateMotorcycle` mutation → maintenance task threshold check → alert

### Error & Failure Propagation

- GPS failure: graceful degradation to last known position, GPS quality indicator turns red
- Network failure: all mutations queued in MMKV sync queue, drained on reconnect with exponential backoff
- App kill: MMKV persists full ride state, recovery modal on reopen
- Waypoint quota exceeded: `BadRequestException` from API, client stops uploading for that ride

### State Lifecycle Risks

- **Orphaned rides:** Partial unique index prevents multiple active rides. If `startRide` succeeds but `endRide` never fires → crash recovery handles on next open
- **Sync queue stuck:** Max 5 retries with backoff → dead-letter queue + user notification. Never silently drops rides
- **MMKV/Zustand divergence:** Background task writes only to MMKV (H10). Foreground reads MMKV + updates Zustand for UI. Clear separation prevents desync

### API Surface Parity

- New GraphQL mutations: `startRide`, `endRide`, `uploadWaypoints`, `updateRide`, `deleteRide`
- New GraphQL queries: `myRides` (cursor-paginated), `ride` (by ID)
- Existing mutations affected: `updateMotorcycle` (mileage update from ride), maintenance task queries (threshold check post-mileage)
- Tab bar: IslandTabBar modified to add center FAB (non-tab element)

### Integration Test Scenarios

1. Full ride lifecycle: start → record 10 waypoints → pause → resume → end → verify summary stats match
2. Offline ride: airplane mode → start → record → end → restore network → verify server sync order (startRide → uploadWaypoints → endRide)
3. Crash recovery: start ride → force-kill app → reopen → verify "Unfinished ride" modal → resume → end
4. Mileage sync: complete ride → accept mileage → verify motorcycle.current_mileage updated → verify maintenance task triggered if threshold met
5. Concurrent ride guard: start ride → attempt second startRide → verify partial unique index rejects

## Acceptance Criteria

### Functional Requirements

- [ ] One-tap ride start from center FAB (< 3s to recording)
- [ ] Background GPS survives 30+ min screen-locked on Android + iOS
- [ ] HUD shows speed 96pt, live map, altitude, distance, duration
- [ ] Auto-pause triggers at speed < 0.5 m/s + position delta < 5m for 60s
- [ ] "Forgot to stop" notification at 10 min, auto-end at 30 min
- [ ] Offline rides record fully and sync on reconnect
- [ ] Ride Summary with Mapbox gradient polyline, stats overlay, share
- [ ] Post-ride mileage prompt updates motorcycle odometer
- [ ] Maintenance alert fires when mileage threshold exceeded
- [ ] Ride history cursor-paginated in Profile tab
- [ ] Free: last 10 rides. Pro: full history + GPX export
- [ ] Permission onboarding with "While Using" degraded mode
- [ ] END RIDE requires 2s long-press (glove-safe)
- [ ] Night mode with red-tinted HUD
- [ ] Crash recovery restores unfinished rides

### Non-Functional Requirements

- [ ] HUD renders at 60fps with map + GPS updates
- [ ] Battery drain ≤ 15%/hr (GPS + screen)
- [ ] Waypoint quota: 10k per ride, enforced server-side
- [ ] Rate limit: 10 upload calls/min via @Throttle
- [ ] GDPR: 30-day hard-delete purge of waypoints after soft-delete
- [ ] One active ride per user (partial unique index)

### Quality Gates

- [ ] All Zod validators pass for ride input/response types
- [ ] RLS policies prevent cross-user ride access
- [ ] Auto-pause validated in real-world scenarios (parking lot, traffic, fuel stop)
- [ ] Offline → online sync completes within 60s of reconnect
- [ ] 100+ rides render in history without pagination degradation

## Success Metrics

| Metric | Target | When |
|--------|--------|------|
| Ride Adoption Rate | 40% of active users log ≥1 ride in 30 days | Week 4 post-launch |
| Weekly Active Ride Loggers | 35% of WAU log ≥1 ride/week | 90 days |
| Mileage Update Acceptance | 85% of completed rides | 30 days |
| HUD Engagement Rate | 60% of rides with HUD visible >50% of duration | 30 days |
| DAU/MAU Ratio | 25%+ (from ~10%) | 90 days |
| Free→Pro Conversion Lift | +12% incremental | 60 days |

## Dependencies & Prerequisites

### Already Done
- [x] 6 packages installed: expo-location, expo-task-manager, expo-sensors, expo-keep-awake, react-native-mmkv, @rnmapbox/maps
- [x] Expo config plugins (expo-location background mode, @rnmapbox/maps SDK v11.13.4)
- [x] iOS/Android permissions (background location, foreground service)
- [x] Zod validators (`packages/types/src/validators/ride.ts`)

### Blocking
- [ ] Mapbox access token (get from mapbox.com, add to `.env`)
- [ ] Week 1 GPS spike passes GO/NO-GO gate
- [ ] EAS dev build (background location requires native modules, not Expo Go)

### Risk: CONDITIONAL GO
If expo-location fails background GPS on Android, switch to react-native-background-geolocation ($299/yr). Only GPS listener layer changes — sync queue, MMKV, HUD unchanged. +1–2 weeks.

## Sources & References

### Internal References

- Architecture doc: `Architecture-Ride-Logging-HUD.html` (v2.2, all 18 + 5 audit fixes)
- PRD: `PRD-Ride-Logging-HUD-v2.docx` (v2.1, includes Mapbox/R19/center FAB)
- Design reference: `Ride-HUD-Design.html`
- Implementation plan: `PLAN-Ride-Logging-HUD.md`
- Zod validators: `packages/types/src/validators/ride.ts`
- Existing module pattern: `apps/api/src/modules/diagnostics/`
- Existing store pattern: `apps/mobile/src/stores/auth.store.ts`
- Existing GraphQL pattern: `apps/mobile/src/graphql/queries/`
- Tab bar: `apps/mobile/src/app/(tabs)/_layout.tsx`

### External References

- expo-location docs: https://docs.expo.dev/versions/latest/sdk/location/
- expo-task-manager docs: https://docs.expo.dev/versions/latest/sdk/task-manager/
- @rnmapbox/maps docs: https://github.com/rnmapbox/maps
- react-native-mmkv docs: https://github.com/mrousavy/react-native-mmkv
- Mapbox line-gradient: https://docs.mapbox.com/style-spec/reference/layers/#line-gradient

### Related Work

- PRD Audit (March 22, 2026): 4-agent review (Engineer, Architect, PM, Moto Expert) + 4-agent validation
- 23 findings addressed across architecture doc and plan
