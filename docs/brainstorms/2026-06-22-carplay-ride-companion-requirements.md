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

- **CarPlay "Driving Task" category, not Navigation.** The no-map companion fits Apple's *Driving Task* template category (`CPInformationTemplate`, `CPListTemplate`, `CPGridTemplate`). The panel itself is `CPInformationTemplate`; any menu uses list/grid. (`CPPointOfInterestTemplate` is not assumed available to Driving Task and is not relied on.) This aims to sidestep Apple's gated Navigation entitlement and matches the panel-not-canvas shape — but the Driving Task entitlement is itself Apple-granted and is a v1 prerequisite, not a later-stage concern (see Dependencies / Assumptions and Outstanding Questions).

- **Hero = ride recording confidence, not raw metrics.** The panel's primary job is to make the rider trust the ride is being logged correctly, glanceably, in well under a second. Metrics are chosen to complement the bike cluster (which already shows speed, gear, revs, fuel, trip A/B), not duplicate it.

- **Recording is reused, not rebuilt.** The existing background location pipeline (`expo-task-manager` background task, MMKV waypoint persistence, offline sync queue, `StartRide` / `EndRide` mutations) is the recording engine. The CarPlay surface is a control + display head on top of it.

- **Smooth-by-default start = no-prompt background start.** Because a Driving Task app cannot seize the screen while a nav app is foreground, "smooth" resolves to: recording begins on its own with the panel reflecting it — not a full-screen prompt. "Silent" means no screen takeover, *not* no feedback: a non-visual confirmation cue fires per R9. Manual-start and phone-first are user-selectable fallbacks.

- **iOS/CarPlay only for v1.** Android Auto has no third-party category that fits a no-map ride companion, so it is excluded as a publishable target (see Scope Boundaries).

---

## Actors

- A1. **Rider (owner-tester)** — operates the panel via the head unit toggle/rotary while riding; configures start behavior in the phone app. The Africa Twin owner is the first instance.
- A2. **Phone app (MotoVault mobile)** — owns the recording engine, ride state, bike data, and settings, and is the single source of truth / write authority for ride state. The CarPlay surface displays this state and issues control commands (pause/resume/stop) to the engine, which applies them and syncs the result back.
- A3. **CarPlay head unit (Africa Twin TFT)** — renders the templated panel and routes toggle input; hosts the foreground nav app simultaneously.

---

## Requirements

### Live ride panel (hero)

- R1. While a ride is recording, the CarPlay surface presents a glanceable panel showing: distance, moving time, cumulative elevation gain (climb), and a recording/auto-pause/GPS-lock state indicator.
- R2. The panel shows no custom gauges, dials, sparklines, or map line — only template-supported text/value rows operable and readable under CarPlay distraction constraints.
- R3. The panel exposes ride controls — start, pause/resume, stop — operable entirely via the head unit toggle/rotary (no touch dependency).
- R4. The recording/auto-pause indicator distinguishes at least three states: recording, auto-paused (idle), and GPS not locked / acquiring.
- R5. Panel values reflect the live ride within a few seconds of the underlying GPS updates, sourced from the same live ride state the phone uses.
- R6. The panel defines an explicit glance hierarchy: the recording-state indicator plus one primary metric are the most prominent elements, with all values legible in a sub-second glance within the chosen template's row limits. (Which metric is primary is resolved at planning — candidate: recording-state + distance.) The full element set (R1's four values + R4 state + R15 mode indicator + R3 controls) must be reconciled against the chosen template's fixed row budget — likely by promoting state + primary metric to a title/subtitle area and relegating or dropping secondary metrics, rather than rendering uniform rows that defeat the hierarchy.
- R7. Before the first GPS lock, metric fields show explicit placeholders (e.g., dashes), never zeros or stale values that could read as a real ride.
- R8. The panel defines a no-active-ride / idle state — what it shows when no ride is recording — including a clear start affordance when start mode is manual.

### Recording-confidence feedback

- R9. On automatic start and on each state transition (recording ↔ auto-paused, and GPS lock acquired), the system emits a non-visual confirmation so the rider gains recording confidence without leaving their foreground nav app. This is what makes no-prompt auto-start consistent with the recording-confidence hero. The confirmation channel must be one the rider can actually perceive while the nav app owns the foreground and audio route: the default modality is resolved before planning, and its reachability is validated on the bike (audio tone coexisting with ducked nav voice over a helmet intercom, vs. a phone haptic that may be unfelt in a tank bag) — not merely confirmed as "emitted" in code.

### Coexistence with navigation

- R10. MotoVault does not register as a CarPlay navigation app and does not claim the map surface; the rider's chosen nav app remains the foreground map while MotoVault records and displays.
- R11. The MotoVault panel is reachable as its own CarPlay app tile; switching to it does not stop the foreground nav app's guidance.

### Ride start behavior (configurable)

- R12. The default start behavior begins recording automatically (silently, in the background) when the rider is on a connected ride context, with the panel reflecting the active recording. (Pairs with R9 for the confirmation signal.)
- R13. Automatic start is gated by a defined trigger condition AND a minimum-distance/duration keep-guard, so short connected hops (moving the bike, a brief errand) are not logged as junk rides. The exact trigger and guard values are resolved before planning (see Outstanding Questions).
- R14. The rider can change start behavior in the phone app to at least: automatic (default), manual (rider starts from the head unit or phone), and phone-first (head unit controls a ride already started on the phone).
- R15. The active start mode is indicated on the CarPlay surface so the rider knows whether to expect auto-start or to initiate manually — preventing duplicate manual starts or missed sessions.
- R16. Regardless of how a ride starts — including phone-first — the head unit panel can control the in-progress ride (pause/resume/stop), not merely display it. The phone recording engine (A2) is the single write authority: head-unit actions are commands applied by the engine and synced back, so state stays consistent. Concurrent/racing events (e.g., a head-unit stop arriving as auto-pause fires) resolve through the engine; the exact arbitration rule is settled at planning.
- R17. Stop and any other destructive control on the head unit is guarded against accidental toggle input (confirmation, hold-to-confirm, or equivalent), mirroring the phone HUD's min-ride guard, so a bumped toggle cannot silently discard a ride.
- R18. Pause/resume is reachable from the recording-active panel within a bounded number of toggle steps (target: ≤2 focus moves from any panel state). Whether controls are persistent rows or a contextual actions submenu is settled at planning, but the step bound is a requirement so manual pause stays usable while moving.

### Secondary bike-status surface

- R19. A secondary CarPlay view presents brief bike status for the active bike: next service due, current mileage, open recall count, and last/next fuel.
- R20. The bike-status view is for pre-ride and at-stop glancing: it loads/refreshes on entry rather than updating continuously during motion, and its motion behavior is explicit (e.g., shown with a "stop to refresh" note rather than silently stale, or gated above a speed threshold).

### Settings & defaults

- R21. CarPlay-related settings (start behavior, and which bike is active) live in the existing phone app settings/garage, not on the head unit.

---

## Key Flows

- F1. Recording with nav running (the common case)
  - **Trigger:** Rider sets off; phone is connected to the Africa Twin with a nav app in the foreground.
  - **Actors:** A1, A2, A3
  - **Steps:** Recording starts per the configured behavior (default: silent background start with an R9 confirmation cue) → rider keeps nav directions on screen → rider toggles to the MotoVault tile to glance at distance / time / climb / recording state → toggles back to nav.
  - **Outcome:** Ride is logged and confirmed without the rider touching the phone or losing directions.
  - **Covered by:** R1, R3, R9, R10, R11, R12

- F2. Auto-pause at a stop
  - **Trigger:** Rider stops (fuel, photo, coffee); speed stays near zero past the idle threshold.
  - **Actors:** A1, A2, A3
  - **Steps:** Existing auto-pause logic triggers → panel state indicator switches to auto-paused (with an R9 transition cue) → rider may glance at bike status (next service, fuel) → motion resumes and recording auto-resumes.
  - **Outcome:** Idle time isn't counted as moving time; rider sees the paused state and trusts it.
  - **Covered by:** R1, R2, R4, R5, R9, R19, R20

- F3. Manual / phone-first start
  - **Trigger:** Rider has changed start behavior away from automatic.
  - **Actors:** A1, A2, A3
  - **Steps:** Manual — rider opens the MotoVault tile, sees the manual-start affordance (R8/R15) and selects Start via the toggle, then sees the recording-state indicator confirm. Phone-first — rider starts on the phone before riding; the head unit panel reflects the active ride and can control it.
  - **Outcome:** Recording matches the rider's chosen control model; head unit can always pause/stop.
  - **Covered by:** R3, R4, R8, R14, R15, R16

---

## Acceptance Examples

- AE1. **Covers R10, R11.** Given Google Maps is giving turn-by-turn directions on the Africa Twin, when the rider switches to the MotoVault tile and back, then Google Maps guidance is uninterrupted and MotoVault keeps recording throughout.
- AE2. **Covers R9, R12.** Given start behavior is set to automatic, when the rider sets off, then recording begins without any full-screen prompt and a non-visual cue (tone/haptic) confirms recording has started even while the nav app is foreground.
- AE3. **Covers R4.** Given the rider is stopped at a light long enough to trigger auto-pause, when they glance at the panel, then the state indicator reads auto-paused (not recording).
- AE4. **Covers R3, R17.** Given the bike is moving and touch is locked out, when the rider operates the panel with the toggle only, then start/pause/stop are all reachable, and stop requires a confirm/hold so a single accidental press cannot end the ride.
- AE5. **Covers R14, R16.** Given start behavior is phone-first and a ride was started on the phone, when the rider opens the MotoVault tile on the head unit, then the panel reflects the active ride state and its pause/stop controls act on that ride.
- AE6. **Covers R7, R8.** Given no ride is active in manual-start mode, when the rider opens the MotoVault tile, then the panel shows its idle state with placeholder values and a clear start affordance, not zeros that read as a real ride.
- AE7. **Covers R12, R13.** Given automatic start and a sub-threshold connected hop (e.g., moving the bike a few metres in the garage), when the hop ends, then the keep-guard discards the session rather than logging it as a ride in the history.

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
- Assumes the Africa Twin CRF1100L head unit behaves as a standard CarPlay host with toggle/rotary (non-touch) input while moving. Single test device — findings may not generalize to other CarPlay head units.
- **Apple CarPlay Driving Task entitlement — GRANTED 2026-06-25 (Case-ID 20710293).** The entitlement is assigned to the developer account (Team ID Y4MW4DD2RQ) and can be configured for the app. This clears the prior v1-prerequisite risk: the build can run on the real Africa Twin head unit and is TestFlight / App Store eligible, not simulator-only. Remaining mechanical step: add `com.apple.developer.carplay-driving-task` to the build's entitlements (via `apps/mobile/app.config.ts` `ios.entitlements` in the managed Expo setup) and regenerate a provisioning profile that includes it.
- Assumes live ride state can be bridged from the recording engine to the CarPlay templates with refresh latency acceptable for glanceable display. The CarPlay template push/throttle cadence under distraction rules is unverified for the few-second target.

---

## Outstanding Questions

### Resolve before planning

- ~~**Entitlement go/no-go (gates everything).**~~ RESOLVED 2026-06-25: Apple granted the CarPlay Driving Task entitlement (Case-ID 20710293). On-bike build and store distribution are unblocked.
- **Is CarPlay the right surface at all?** Would a cheaper recording-confidence surface — an iOS Live Activity / Dynamic Island, a lock-screen widget, or a haptic/audio start cue — deliver the same "trust it's recording" value on *any* bike without the entitlement and native integration? Name why CarPlay wins, or prototype the cheap surface first. (Rides is PostHog priority #3; CarPlay-equipped-bike owners are a niche within that.)
- **Scope for the experiment vs. production.** The stated v1 is a personal spike, but R14 (three start modes), R16 (bidirectional control/consistency), and R19–R20 (the bike-status surface) are production-shaped. Decide whether to validate the core bet with a thin slice first (≈R1+R3+R12 plus R9 confirmation) and defer the rest, or carry full scope knowing the cost. (Note: full scope reflects the brainstorm's explicit "smooth + adjustable + bike-status" choices.)
- Define R13's exact trigger for "connected ride context" (phone↔head-unit connection, motion detected, or both) and the minimum-distance/duration keep-guard values — these gate whether the R12 hero default is even testable (see AE7), not just a planning detail.
- **Validate R9's confirmation channel on the bike.** Choose the default modality (audio tone vs. phone haptic) and confirm the rider can actually perceive it while the nav app owns the foreground and audio route — otherwise R9 does not deliver the recording confidence it exists for.

### Deferred to planning

- Exact CarPlay template choice per surface (information vs list vs grid), how toggle focus order is arranged, and how R6's element set fits the template's row budget (title/subtitle vs rows; R18's ≤2-step pause/resume layout — persistent rows vs actions submenu).
- How the live ride state is bridged to the CarPlay process and its refresh cadence, and the exact arbitration rule for racing control vs. auto-pause events (R16).
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
