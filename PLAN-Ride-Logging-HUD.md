# Ride Logging & Live Ride HUD — Implementation Plan

> **Single source of truth.** Consolidates PRD v2.1 (includes Mapbox/R19/center FAB changes), Architecture v2.2, and PRD Audit findings.
> Phase 4 (v1.1) is out of scope for this plan — separate future work.

---

## Why

MotoVault is opened only when something breaks. Ride logging makes it an "open every ride" app.
The moat: **ride → mileage → maintenance → expenses → AI diagnostics**. No competitor closes this loop.

**Target:** DAU/MAU from ~10% → 25%+. 40% ride adoption in 30 days. 85% mileage acceptance rate.

---

## Scope

### In Scope (v1)
- One-tap ride start via center FAB in tab bar
- Background GPS recording (screen locked, app backgrounded)
- Live Ride HUD (speed 96pt, altitude, live map, stats)
- Auto-pause (speed < 0.5 m/s + position delta < 5m for 60s)
- "Forgot to stop" detection (10 min notify, 30 min auto-end)
- Offline-first recording (client UUID, MMKV sync queue)
- Ride Summary with Mapbox gradient polyline
- Post-ride mileage prompt → maintenance alert
- Ride history (cursor-paginated, Profile tab)
- Free: unlimited recording, last 10 rides. Pro: full history + GPX export
- First-ride onboarding (permissions pre-prompt, "While Using" degraded mode)

### Not in Scope (v1.1+)
- Lean angle tracking
- Turn-by-turn navigation
- Group rides / social feed / route sharing UI
- Crash detection / emergency SMS
- Weather snapshots (schema ready, not populated)
- Post-ride fuel prompt
- Server-side route thumbnails
- AI ride insights

---

## Pre-Implementation Setup (Done)

- [x] 6 packages installed: expo-location, expo-task-manager, expo-sensors, expo-keep-awake, react-native-mmkv, @rnmapbox/maps
- [x] Expo config plugins added (expo-location with background mode, @rnmapbox/maps with SDK v11.13.4)
- [x] iOS/Android permissions configured (background location, foreground service)
- [x] Zod validators created: `packages/types/src/validators/ride.ts`
- [ ] Mapbox access token (get from mapbox.com, add to `.env`)

---

## Phase 1: Core Recording (Weeks 1–5)

### Week 1: Android GPS Spike (GO/NO-GO Gate)

**Goal:** Prove background GPS works before committing to full build.

| Task | Details |
|------|---------|
| EAS dev build | `eas build --profile development --platform android` + iOS |
| Background GPS test | 30 min screen-locked ride on Pixel 4+ and Samsung Galaxy S21+ |
| MMKV persistence test | Force-kill app during ride → reopen → verify waypoints survived |
| Sync queue test | Start ride offline → end ride → restore connectivity → verify sync |
| Battery drain measurement | Target: 12–15%/hr total. Screen is dominant consumer (8–10%/hr) |
| GPS accuracy baseline | Measure: what % of waypoints have accuracy > 100m? |

**Decision framework:**

| Outcome | Condition | Action | Timeline Impact |
|---------|-----------|--------|-----------------|
| **GO** | All tests pass on both devices | Proceed as planned | None |
| **CONDITIONAL GO** | Background GPS fails on some Android (OEM battery restrictions) | Switch to react-native-background-geolocation ($299/yr). Rewrite GPS listener only — sync queue, MMKV, HUD unchanged | +1–2 weeks |
| **NO-GO** | Background GPS unreliable on both platforms, or drain > 20%/hr | Defer ride tracking. Ship manual mileage logging instead | Feature deferred. Manual mileage in 2 weeks |

### Weeks 2–3: Database & API

**Supabase Migrations:**

```
supabase/migrations/00047_create_rides_table.sql
```

| Table | Key Design Decisions |
|-------|---------------------|
| `rides` | UUID PK (client-supplied), no DEFAULT on started_at (H14), INT pause durations (H18), composite index on (user_id, motorcycle_id, started_at DESC), partial unique index for one-active-ride-per-user, RLS via is_admin() |
| `ride_waypoints` | Composite PK (ride_id, recorded_at) — no UUID column (H16), RLS via EXISTS subquery to rides |

```
supabase/migrations/00048_purge_soft_deleted_rides.sql
```

- `purge_soft_deleted_rides()` function: delete waypoints + null route_polyline after 30 days
- `pg_cron` schedule: `SELECT cron.schedule('purge-rides', '0 3 * * *', ...)`

**Post-migration:**
1. `npx supabase db push`
2. `pnpm generate:types` → updates database.types.ts
3. Verify Zod schemas in `packages/types/src/validators/ride.ts` match

**NestJS Rides Module** (`apps/api/src/modules/rides/`):

| File | Contents |
|------|----------|
| `rides.module.ts` | Imports, providers: [RidesResolver, RidesService], exports: [RidesService] |
| `rides.resolver.ts` | @UseGuards(GqlAuthGuard). Mutations: startRide, endRide, uploadWaypoints (@Throttle 10/min), updateRide, deleteRide. Queries: myRides (cursor-paginated), ride (by ID) |
| `rides.service.ts` | @Inject(SUPABASE_USER) for all user-scoped queries. Waypoint quota check (10k/ride) in service layer. Cursor validation with Date.parse() |
| `models/ride.model.ts` | @ObjectType() with @Field() decorators. Maps snake_case DB → camelCase |
| `models/ride-connection.model.ts` | Edge/PageInfo pattern (matches article-connection.model.ts) |
| `dto/start-ride.input.ts` | @InputType() + ZodValidationPipe(StartRideInputSchema) |
| `dto/end-ride.input.ts` | @InputType() + ZodValidationPipe(EndRideInputSchema) |
| `dto/upload-waypoints.input.ts` | @InputType() + ZodValidationPipe(UploadWaypointsInputSchema) |

**After API work:**
- Add RidesModule to `app.module.ts` imports
- Run `pnpm generate` to regenerate GraphQL client types
- Create mobile GraphQL operations in `apps/mobile/src/graphql/`

### Weeks 3–4: Mobile State Machine

**Zustand Store** (`apps/mobile/src/stores/ride.store.ts`):
- Scalars only: status, currentSpeed, elapsedTime, distance, recordingSubState
- No waypoints in Zustand — those go to MMKV

**MMKV Storage** (via `rideStorage` instance):
- Keys: `ride.current_id`, `ride.started_at`, `ride.total_paused_ms`, `ride.total_auto_paused_ms`, `ride.recording_sub_state`, `ride.permission_level`
- Waypoint buffer: chunked storage (`ride:{id}:wp:{chunkIndex}`, 50 points per chunk)
- Sync queue: ordered operations (startRide → uploadWaypoints* → endRide)

**Offline Sync Queue:**
- Client generates rideId via `expo-crypto` UUID
- All mutations queued in MMKV when offline
- On reconnect: drain queue in order with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max 5 retries per operation → dead-letter queue + user notification
- Connectivity detected via `expo-network`

### Weeks 4–5: Background GPS + HUD + Auto-Pause

**First Ride Onboarding (R0):**
1. FAB tap → check permissions
2. Not granted → custom pre-prompt screen (NOT system dialog)
3. Request foreground → request background
4. "While Using" only → foreground-only degraded mode + HUD banner
5. Re-prompt after 3 foreground-only rides (iOS) / direct request (Android)
6. "Not now" cooldown: 7 days

**Background GPS Configuration:**
- `Location.Accuracy.High` + `distanceInterval: 10m` + `timeInterval: 5000ms`
- Foreground service notification: "Recording ride..."
- Battery Saver toggle: drops to `Accuracy.Balanced` + 25m + 10000ms
- Background task writes to MMKV (not Zustand) — Android Hermes isolation (H10)

**Live Ride HUD Screen** (full-screen modal, tab bar hidden):

| Zone | Content |
|------|---------|
| Top 35% | Live Mapbox map, gradient polyline, pulsing blue dot, GPS quality indicator (green/yellow/red) |
| Center hero (60%) | Speed 96pt monospace white-on-black, unit label below |
| Stats row | Distance + Duration visible. Swipe for Avg Speed + Elevation Gain |
| Top bar | Recording status (pulsing green/amber/yellow), bike name, elapsed time HH:MM:SS |
| Bottom controls | Pause/Resume (left, circular), END RIDE (right, red pill, 2s long-press with progress ring) |
| All controls | 64pt minimum touch targets, expo-haptics feedback |

**Screen behavior:** Dark theme (#0a0a0a), expo-keep-awake active, system auto-brightness respected, Night Mode toggle (red-tinted #CC0000)

**Auto-Pause Logic (H17 + Audit Fix A2):**
- Trigger: speed < 0.5 m/s AND position delta < 5m for 60 continuous seconds
- GPS continues recording during auto-pause
- HUD shows "STOPPED" indicator
- `auto_paused_duration_s` tracked separately from manual pause

**Forgot to Stop (Audit Fix A3):**
- 10 min continuous auto-pause → push notification: "Still riding?"
- 30 min continuous auto-pause → auto-end ride, trim idle tail to auto-pause start time
- Show "Ride auto-ended" notification with undo option

**Crash Recovery:**
- MMKV persists all ride state (rideId, startedAt, waypoints, pause durations)
- On app reopen with active ride in MMKV: "Unfinished ride detected. Resume or End?"

---

## Phase 2: Mileage Sync & Summary (Weeks 6–8)

### Week 6: Ride Summary Screen (R19)

**Full-screen Mapbox map** (presentation: 'formSheet'):
- Default style: Dark. Toggle: Dark → Outdoors → Satellite
- Speed-gradient polyline with cumulative-distance color stops:
  - Blue (#3366e6) < 30 km/h — slow
  - Green (#2d9e78) 30–80 km/h — cruising
  - Orange (#D4622E) > 80 km/h — fast
- `lineMetrics={true}` on ShapeSource (required for line-progress)
- Start marker (green dot), End marker (orange dot)
- FlyTo camera animation fitting route bounds (1500ms)
- Stats overlay card (BlurView): distance, moving time, avg speed, max speed, elevation gain
- Share button: `MapView.takeSnap()` → share sheet
- Route thumbnail: 400×300 snapshot stored locally for history cards

### Weeks 6–7: Mileage Prompt (R14) & Maintenance Alerts (R15)

**Post-ride flow:**
1. Ride Summary screen appears
2. Bottom card: "Update odometer? Current: X mi → New: X + ride mi"
3. Three options: Accept / Edit (manual adjustment) / Skip
4. Accept → `updateMotorcycle` mutation → `mileage_applied = true` on ride
5. After mileage update: check maintenance tasks where `target_mileage <= new_mileage`
6. Show alert card: "Oil Change is now due" → tap navigates to task detail

**Edge cases:**
- Null mileage → "Set starting odometer" prompt
- GPS accuracy warning if >50% waypoints with accuracy > 100m → editable suggested mileage
- Quick Ride (no bike) → skip mileage prompt entirely

### Weeks 7–8: Ride History (R16) + Bike Detail Stats (R18)

**Ride History — R16** (Profile tab → "My Rides"):
- Cursor-paginated on `started_at` DESC
- Each card: date, distance, duration, route thumbnail, bike name
- Filterable by motorcycle
- Free: last 10 rides + "Upgrade for full history" CTA
- Pro: full history + GPX export
- Tap card → opens Ride Summary screen (R19, loaded from DB)

**Bike Detail Stats Card** (R18):
- On Garage bike detail page
- "Riding" summary: total rides, total distance, total time, last ride date

---

## Phase 3: History & Polish (Weeks 9–10)

### Week 9: Polish & Edge Cases

| Task | Details |
|------|---------|
| Free/Pro tier logic | RevenueCat gating: ride history limit, GPX export, waypoint playback |
| Ride naming (R17) | Optional name field on summary. Default: date + distance ("Mar 22 — 47 mi") |
| GPS speed disclaimer | One-time tooltip: "Speed shown is GPS-based and may differ from your speedometer" |
| Phone vibration warning | One-time dismissable: "Mounting your phone on handlebars may damage camera OIS. Consider a vibration-dampening mount." |
| Battery guidance | For rides > 3 hours: "We recommend a USB charger or enabling Battery Saver mode" |
| Signal loss handling | Interpolate track linearly between last-known and next-known good GPS points. Show interpolated segments as dashed on map |
| Altitude filtering | Dead-band filter: ignore altitude changes < 5m between consecutive waypoints. Prefer barometric altitude when available |

### Week 10: Testing & Performance

| Task | Target |
|------|--------|
| HUD frame rate | 60fps with map rendering + GPS updates |
| Battery drain validation | Real device testing, 2+ hour rides |
| Auto-pause validation | Parking lot test, traffic light test, fuel stop test |
| Offline sync | Airplane mode full ride → reconnect → verify complete sync |
| Crash recovery | Force-kill during recording, pause, auto-pause → verify recovery |
| Cursor pagination | 100+ rides → verify no performance degradation |
| Night mode | Verify red-tint on all HUD elements, no white flash |

---

## Analytics Events to Instrument

| Event | Properties | Purpose |
|-------|-----------|---------|
| `ride_started` | rideId, motorcycleId, permissionLevel | Adoption rate |
| `ride_ended` | rideId, distanceM, durationS, waypointCount, gpsQuality | Engagement depth |
| `ride_auto_ended` | rideId, autoPauseDurationMin | Forgot-to-stop frequency |
| `mileage_accepted` | rideId, deltaM, previousMileage | Mileage acceptance rate |
| `mileage_skipped` | rideId | Acceptance rate denominator |
| `mileage_edited` | rideId, gpsDelta, userDelta | GPS trust signal |
| `hud_visible_duration_pct` | rideId, percentage | HUD engagement rate |
| `battery_saver_toggled` | rideId, enabled | Battery concern signal |
| `night_mode_toggled` | rideId, enabled | Night riding frequency |
| `permission_pre_prompt_shown` | — | Onboarding funnel |
| `permission_granted` | level: 'full' \| 'foreground_only' \| 'denied' | Permission conversion |
| `ride_history_viewed` | count, tier | History engagement |
| `upgrade_prompt_shown` | source: 'ride_history' \| 'gpx_export' | Conversion funnel |

---

## Database Schema Summary

### rides (15 columns + timestamps)

```sql
id UUID PK (client-supplied)
user_id UUID FK → users(id) ON DELETE CASCADE
motorcycle_id UUID FK → motorcycles(id) ON DELETE SET NULL (nullable)
status TEXT NOT NULL DEFAULT 'recording'
name TEXT (nullable, max 200)
started_at TIMESTAMPTZ NOT NULL (no DEFAULT — client-supplied)
ended_at TIMESTAMPTZ
paused_duration_s INT DEFAULT 0
auto_paused_duration_s INT DEFAULT 0
distance_m INT
max_speed_mps REAL
avg_speed_mps REAL
max_lean_angle REAL (v1.1, nullable)
elevation_gain REAL
elevation_loss REAL
route_polyline TEXT
gps_quality REAL
mileage_applied BOOLEAN DEFAULT FALSE
is_public BOOLEAN DEFAULT FALSE
region TEXT
weather_snapshot JSONB
route_thumbnail_uri TEXT
metadata JSONB DEFAULT '{}'
created_at, updated_at, deleted_at
```

**Indexes:** composite (user_id, motorcycle_id, started_at DESC), partial status, one-active-ride-per-user unique
**RLS:** Owner read/write, admin via is_admin()

### ride_waypoints (composite PK — no UUID)

```sql
ride_id UUID FK → rides(id) ON DELETE CASCADE
recorded_at TIMESTAMPTZ
-- PK: (ride_id, recorded_at)
latitude DOUBLE PRECISION
longitude DOUBLE PRECISION
altitude REAL
speed_mps REAL
heading REAL
lean_angle REAL (v1.1)
accuracy REAL
```

**RLS:** EXISTS subquery to rides for ownership
**Quota:** 10,000 waypoints per ride (server-enforced)

---

## File Creation Checklist

### Supabase
- [ ] `supabase/migrations/00047_create_rides_table.sql`
- [ ] `supabase/migrations/00048_purge_soft_deleted_rides.sql`

### API (apps/api/src/modules/rides/)
- [ ] `rides.module.ts`
- [ ] `rides.resolver.ts`
- [ ] `rides.service.ts`
- [ ] `models/ride.model.ts`
- [ ] `models/ride-connection.model.ts`
- [ ] `dto/start-ride.input.ts`
- [ ] `dto/end-ride.input.ts`
- [ ] `dto/upload-waypoints.input.ts`
- [ ] `dto/update-ride.input.ts`

### Mobile (apps/mobile/src/)
- [ ] `stores/ride.store.ts` (Zustand — scalars only)
- [ ] `utils/ride-storage.ts` (MMKV instance + helpers)
- [ ] `utils/ride-sync-queue.ts` (offline sync logic)
- [ ] `utils/ride-location.ts` (GPS listener, auto-pause, forgot-to-stop)
- [ ] `utils/ride-permissions.ts` (onboarding + permission flow)
- [ ] `app/(modals)/start-ride.tsx` (bike picker → start)
- [ ] `app/(modals)/ride-hud.tsx` (full-screen HUD)
- [ ] `app/(modals)/ride-summary.tsx` (Mapbox map + stats)
- [ ] `app/(tabs)/(profile)/rides.tsx` (ride history list)
- [ ] `components/ride/hud-map.tsx`
- [ ] `components/ride/hud-speed.tsx`
- [ ] `components/ride/hud-controls.tsx`
- [ ] `components/ride/ride-card.tsx`
- [ ] `components/ride/mileage-prompt.tsx`
- [ ] `graphql/mutations/start-ride.graphql`
- [ ] `graphql/mutations/end-ride.graphql`
- [ ] `graphql/mutations/upload-waypoints.graphql`
- [ ] `graphql/mutations/update-ride.graphql`
- [ ] `graphql/mutations/delete-ride.graphql`
- [ ] `graphql/queries/my-rides.graphql`
- [ ] `graphql/queries/get-ride.graphql`

### Types (already done)
- [x] `packages/types/src/validators/ride.ts`

---

## Success Metrics

| Metric | Target | When |
|--------|--------|------|
| Ride Adoption Rate | 40% of active users log ≥1 ride in 30 days | Week 4 post-launch |
| Weekly Active Ride Loggers | 35% of WAU log ≥1 ride/week | 90 days |
| Mileage Update Acceptance | 85% of completed rides | 30 days |
| HUD Engagement Rate | 60% of rides with HUD visible >50% of duration | 30 days |
| DAU/MAU Ratio | 25%+ (from ~10%) | 90 days |
| Free→Pro Conversion Lift | +12% incremental | 60 days |
| 7-Day Retention | +10pp for riders vs non-riders | 90 days |

---

## Cost Projections

| Service | Free Tier | Concern Threshold | Action |
|---------|-----------|-------------------|--------|
| Mapbox | 25k MAU | 15k MAU | Evaluate: is HUD map necessary? Speed-only HUD as fallback |
| Supabase | Included | 30GB/week waypoint data at 10k users | GDPR 30-day purge keeps steady-state manageable. Free-tier waypoints local-only if needed |
| react-native-background-geolocation | N/A | Only if CONDITIONAL GO | $299/yr license |

---

## Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| PRD v2.1 | `PRD-Ride-Logging-HUD-v2.docx` | Product requirements, user stories, success metrics. v2.1 adds Mapbox map provider, R19 Ride Summary Screen, center FAB in tab bar, ride history in Profile tab |
| Architecture v2.2 | `Architecture-Ride-Logging-HUD.html` | SQL schema, code samples, system design, audit fixes |
| Design Reference | `Ride-HUD-Design.html` | Visual north star for HUD and Summary screens |
| Zod Validators | `packages/types/src/validators/ride.ts` | Input/response schemas |
| PRD Audit | This conversation (March 22, 2026) | 4-agent audit findings + validation fixes |
