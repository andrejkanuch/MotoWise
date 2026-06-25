---
date: 2026-06-22
topic: carplay-ride-companion
---

# CarPlay Ride Companion — Requirements

## Summary

A CarPlay companion for MotoVault that rides *alongside* the rider's existing navigation app rather than replacing it. The hero is the live ride being recorded — a compact, toggle-operable panel showing distance, moving time, climb, and a recording/auto-pause indicator, plus start/pause/stop controls — backed by a secondary at-a-glance bike-status view. iOS/CarPlay only for the first version, built to test on a Honda Africa Twin (CRF1100L) head unit.

---

## Problem Frame

MotoVault already records rich rides on the phone (`apps/mobile/src/app/(modals)/ride-hud.tsx`): speed, distance, duration, elevation, lean angle, GPS track, with background location and crash-recovery persistence. But during a ride the phone is in a pocket or tank bag. On a bike like the Africa Twin — which ships genuine Apple CarPlay on its 6.5" TFT — the rider's attention is on the bike's screen, controlled by the left-bar toggle (touch locks out above a few km/h). Today the rider either trusts that recording is happening blind, or pulls the phone out to check, or simply uses the bike's built-in nav and logs nothing.

The opportunity is a glanceable, head-unit-native surface that confirms the ride is being recorded and shows the few ride facts the bike's own cluster doesn't (cumulative climb, MotoVault-synced distance/time, recording state) — without forcing the rider to give up the navigation directions they actually want on screen.

This is an owner-driven experiment first: the author rides an Africa Twin and wants to build and test this on their own bike before considering a public release.

---

## Key Decisions

- **Companion, not map owner.** CarPlay allows only one app to own the map/navigation surface at a time. MotoVault deliberately does *not* claim it, so the rider keeps Google Maps / Waze / Honda nav showing directions. Consequence: there is no MotoVault route line on the head unit; the recorded track is reviewed on the phone after the ride.

- **CarPlay "Driving Task" category, not Navigation.** The no-map companion fits Apple's *Driving Task* template category (`CPInformationTemplate`, `CPListTemplate`, `CPGridTemplate`, `CPPointOfInterestTemplate`). This sidesteps Apple's gated Navigation entitlement and matches the panel-not-canvas shape. (Implementation specifics — entitlement request, template wiring — are for planning.)

- **Hero = ride recording confidence, not raw metrics.** The panel's primary job is to make the rider trust the ride is being logged correctly, glanceably, in well under a second. Metrics are chosen to complement the bike cluster (which already shows speed, gear, revs, fuel, trip A/B), not duplicate it.

- **Recording is reused, not rebuilt.** The existing background location pipeline (`expo-task-manager` background task, MMKV waypoint persistence, offline sync queue, `StartRide` / `EndRide` mutations) is the recording engine. The CarPlay surface is a control + display head on top of it.

- **Smooth-by-default start = silent background start.** Because a Driving Task app cannot seize the screen while a nav app is foreground, "smooth" resolves to: recording begins on its own with the panel reflecting it — not a full-screen prompt. Manual-start and phone-first are user-selectable fallbacks.

- **iOS/CarPlay only for v1.** Android Auto has no third-party category that fits a no-map ride companion, so it is excluded as a publishable target (see Scope Boundaries).

---

## Actors

- A1. **Rider (owner-tester)** — operates the panel via the head unit toggle/rotary while riding; configures start behavior in the phone app. The Africa Twin owner is the first instance.
- A2. **Phone app (MotoVault mobile)** — owns the recording engine, ride state, bike data, and settings; source of truth the CarPlay surface mirrors.
- A3. **CarPlay head unit (Africa Twin TFT)** — renders the templated panel and routes toggle input; hosts the foreground nav app simultaneously.

---

## Requirements

### Live ride panel (hero)

- R1. While a ride is recording, the CarPlay surface presents a glanceable panel showing: distance, moving time, cumulative elevation gain (climb), and a recording/auto-pause/GPS-lock state indicator.
- R2. The panel shows no custom gauges, dials, sparklines, or map line — only template-supported text/value rows operable and readable under CarPlay distraction constraints.
- R3. The panel exposes ride controls — start, pause/resume, stop — operable entirely via the head unit toggle/rotary (no touch dependency).
- R4. The recording/auto-pause indicator distinguishes at least three states: recording, auto-paused (idle), and GPS not locked / acquiring.
- R5. Panel values reflect the live ride within a few seconds of the underlying GPS updates, sourced from the same live ride state the phone uses.

### Coexistence with navigation

- R6. MotoVault does not register as a CarPlay navigation app and does not claim the map surface; the rider's chosen nav app remains the foreground map while MotoVault records and displays.
- R7. The MotoVault panel is reachable as its own CarPlay app tile; switching to it does not stop the foreground nav app's guidance.

### Ride start behavior (configurable)

- R8. The default start behavior begins recording automatically (silently, in the background) when the rider is on a connected ride context, with the panel reflecting the active recording.
- R9. The rider can change start behavior in the phone app to at least: automatic (default), manual (rider starts from the head unit or phone), and phone-first (head unit only mirrors/controls a ride already started on the phone).
- R10. Regardless of how a ride starts, the head unit panel can control the in-progress ride (pause/resume/stop), and ride state stays consistent between phone and head unit.

### Secondary bike-status surface

- R11. A secondary CarPlay view presents brief bike status for the active bike: next service due, current mileage, open recall count, and last/next fuel.
- R12. The bike-status view is intended for pre-ride and at-stop glancing; it is not required to update live during motion.

### Settings & defaults

- R13. CarPlay-related settings (start behavior, and which bike is active) live in the existing phone app settings/garage, not on the head unit.

---

## Key Flows

- F1. Recording with nav running (the common case)
  - **Trigger:** Rider sets off; phone is connected to the Africa Twin with a nav app in the foreground.
  - **Actors:** A1, A2, A3
  - **Steps:** Recording starts per the configured behavior (default: silent background start) → rider keeps nav directions on screen → rider toggles to the MotoVault tile to glance at distance / time / climb / recording state → toggles back to nav.
  - **Outcome:** Ride is logged and confirmed without the rider touching the phone or losing directions.
  - **Covered by:** R1, R3, R6, R7, R8

- F2. Auto-pause at a stop
  - **Trigger:** Rider stops (fuel, photo, coffee); speed stays near zero past the idle threshold.
  - **Actors:** A1, A2, A3
  - **Steps:** Existing auto-pause logic triggers → panel state indicator switches to auto-paused → rider may glance at bike status (next service, fuel) → motion resumes and recording auto-resumes.
  - **Outcome:** Idle time isn't counted as moving time; rider sees the paused state and trusts it.
  - **Covered by:** R1, R4, R11, R12

- F3. Manual / phone-first start
  - **Trigger:** Rider has changed start behavior away from automatic.
  - **Actors:** A1, A2, A3
  - **Steps:** Manual — rider opens the MotoVault tile and selects Start via the toggle. Phone-first — rider starts on the phone before riding; the head unit panel mirrors and can control it.
  - **Outcome:** Recording matches the rider's chosen control model; head unit can always pause/stop.
  - **Covered by:** R3, R9, R10

---

## Acceptance Examples

- AE1. **Covers R6, R7.** Given Google Maps is giving turn-by-turn directions on the Africa Twin, when the rider switches to the MotoVault tile and back, then Google Maps guidance is uninterrupted and MotoVault keeps recording throughout.
- AE2. **Covers R8.** Given start behavior is set to automatic, when the rider sets off, then recording begins without any full-screen prompt and the panel shows the recording state.
- AE3. **Covers R4.** Given the rider is stopped at a light long enough to trigger auto-pause, when they glance at the panel, then the state indicator reads auto-paused (not recording).
- AE4. **Covers R3.** Given the bike is moving and touch is locked out, when the rider operates the panel with the toggle only, then start/pause/stop are all reachable.
- AE5. **Covers R9, R10.** Given start behavior is phone-first and a ride was started on the phone, when the rider connects to the head unit, then the panel mirrors the active ride and can pause/stop it.

---

## Scope Boundaries

### Deferred for later

- A MotoVault-owned map with the recorded route line on the head unit (would require claiming the navigation surface and Apple's gated Navigation entitlement).
- Turn-by-turn navigation over MotoVault saved/planned routes.
- App Store publication of the CarPlay surface (v1 is a personal development build for the author's Africa Twin).
- Android Auto as a *test-only* sideload build, if pursued at all.

### Outside this product's identity (for this feature)

- Replacing the rider's preferred navigation app — MotoVault rides alongside, it does not compete for the map.
- Porting the full phone HUD (lean-angle dial, scrolling sparklines, dense multi-metric layout) to the head unit — distraction guidelines and template limits rule it out, and the bike cluster already covers speed/gear/revs/fuel.
- Android Auto as a publishable target — Google admits only navigation, parking, charging, media, and messaging categories; a no-map ride companion doesn't fit.

---

## Dependencies / Assumptions

- Assumes the existing background recording pipeline (`expo-task-manager` background location task, MMKV waypoint persistence, `StartRide` / `EndRide` mutations, offline sync queue) is reused as the recording engine rather than reimplemented.
- Assumes MotoVault's managed Expo setup (with `expo-dev-client` and config plugins) can host the native CarPlay integration via a custom dev/build client; no CarPlay code or config exists today.
- Assumes the Africa Twin CRF1100L head unit behaves as a standard CarPlay host with toggle/rotary (non-touch) input while moving.
- Assumes Apple's Driving Task entitlement is obtainable for development; required before any App Store release (a later-stage concern, not v1).
- Assumes live ride state can be bridged from the recording engine to the CarPlay templates with refresh latency acceptable for glanceable display.

---

## Outstanding Questions

### Resolve before planning

- What exactly defines "on a connected ride context" for automatic start (phone connected to the head unit? motion detected? both)? This governs R8's trigger and the risk of logging non-rides.
- For automatic start, is any minimum-distance / minimum-duration guard wanted before a ride is kept, to avoid junk rides from short connected hops?

### Deferred to planning

- Exact CarPlay template choice per surface (information vs list vs grid) and how toggle focus order is arranged.
- How the live ride state is bridged to the CarPlay process and its refresh cadence.
- Whether the bike-status view is a separate tile/template or a tab within the same app surface.
- Units handling (metric/imperial) consistency with existing app preferences.

---

## Sources / Research

- Existing ride recording + HUD: `apps/mobile/src/app/(modals)/ride-hud.tsx`, `apps/mobile/src/stores/ride.store.ts`, `apps/mobile/src/utils/ride-location.ts`, `apps/mobile/src/utils/ride-storage.ts`, `apps/mobile/src/utils/ride-sync-queue.ts`.
- Ride mutations/queries: `apps/mobile/src/graphql/mutations/start-ride.graphql`, `apps/mobile/src/graphql/mutations/end-ride.graphql`, `apps/mobile/src/graphql/queries/get-ride.graphql`.
- Bike data for the status surface: `apps/mobile/src/graphql/queries/my-motorcycles.graphql`, `apps/mobile/src/components/home/use-home-data.ts`, `apps/mobile/src/lib/health-score.ts`; fuel/expense via `expenses-by-motorcycle.graphql`, `fuel-logs.graphql`.
- Expo/native config (no CarPlay today): `apps/mobile/app.config.ts` (managed Expo, `expo-dev-client`, location/notifications/widgets plugins).
- Platform constraints: CarPlay template categories (Driving Task vs Navigation) and single-active-navigation-app rule; Android Auto third-party category limits; Honda Africa Twin CRF1100L CarPlay support with toggle control and touch lockout above low speed.
</content>
</invoke>
