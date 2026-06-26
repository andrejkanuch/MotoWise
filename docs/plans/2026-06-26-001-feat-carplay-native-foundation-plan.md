---
title: "feat: CarPlay native foundation (tile in the simulator)"
date: 2026-06-26
type: feat
origin: docs/brainstorms/2026-06-22-carplay-ride-companion-requirements.md
parent_plan: docs/plans/2026-06-25-001-feat-carplay-ride-companion-plan.md
---

# feat: CarPlay Native Foundation — light up the MotoVault tile

## Summary

Build the native iOS foundation that makes a MotoVault tile appear in CarPlay and render the live-ride panel: the granted Driving Task entitlement + scene manifest via a config plugin, a custom Expo Swift module bridging the CarPlay scene to JS, and a coordinator that renders/updates a `CPInformationTemplate` from the existing ride store and routes start/stop through the ride engine. Scope is the parent plan's native units **U0, U1, U2, U4** plus wiring the existing `useCarPlayConnection()` seam to real events. Validation requires an on-machine `expo prebuild` + dev-client build + the CarPlay Simulator — neither CI nor the agent environment can build the iOS native target.

---

## Problem Frame

The phone-companion screens already ship and are wired to real state, but the CarPlay surface itself doesn't exist in the binary — the CarPlay Simulator shows an empty home with no MotoVault tile. The blocker is entirely native: there is no CarPlay scene, no entitlement in the build, and no JS↔native bridge. The Apple Driving Task entitlement is **granted** (Case-ID 20710293), so the path is unblocked; this plan stands up the minimal native surface to get the tile rendering live ride data. See `parent_plan:` for the full feature; this is its Phase A native slice.

The load-bearing risk (verified in research): Expo SDK 56 ships RN 0.85, which removed the legacy bridge interop layer, so `@g4rb4g3/react-native-carplay` (a legacy `NativeModules` module, peer range ≤0.79) is very likely non-functional. U0 falsifies that cheaply before committing to the custom module.

---

## Key Technical Decisions

- **KTD1 — Custom Expo Modules API (Swift) module, pending U0 falsification.** RN 0.85 removes the interop layer the only maintained CarPlay library depends on. A Swift Expo module is New-Architecture-clean by design and matches SDK 56's Swift AppDelegate. U0 spikes the library on 0.85 first (cheap disconfirmation); if it unexpectedly works, revisit. Use react-native-carplay's open-source Swift template mappers as reference only.

- **KTD2 — Config plugin owns all native wiring; never hand-edit prebuilt `ios/`.** A plugin in `apps/mobile/plugins/` adds the entitlement (`ios.entitlements` in `app.config.ts`), injects `UIApplicationSceneManifest` (`CPTemplateApplicationSceneSessionRoleApplication` + the existing window scene), ships the Swift `CarPlaySceneDelegate`, and patches the AppDelegate for the New-Arch host. Precedent: `apps/mobile/plugins/fbsdk-core-only.js` (`withDangerousMod` iOS patching) and the `expo-widgets` target (custom Swift + app group) in `app.config.ts`. Idempotent, re-applied each prebuild.

- **KTD3 — Swift + New-Arch AppDelegate wiring, written fresh.** The public `expo-config-carplay-plugin` reference patches an Obj-C AppDelegate + `RCTBridge`; SDK 56 is Swift + `RCTHost`. The scene-split (phone window scene vs CarPlay template scene) is authored for the Swift New-Arch host. SDK 56's prebuild UIScene template is in flux (Expo #46663/#46664) — verify against the installed template at prebuild time.

- **KTD4 — The CarPlay process holds zero ride truth.** It renders a snapshot pushed from JS and emits action intents; the JS coordinator subscribes to the ride store, builds `CPInformationTemplate` items, and routes start/stop through the existing engine. In-place `updateInformationItems` (never re-push). State-transition updates are immediate; numeric metrics coalesce to ~10s (Apple refresh limit, parent KTD3). Connect = projection (mirror a running ride), not start.

- **KTD5 — Validation is on-machine only.** The agent/CI environment cannot run `expo prebuild`, the CocoaPods install, the Xcode build, or the CarPlay Simulator. Every build/validation step is explicitly flagged as a local task for the developer's Mac (Xcode 26.6, CarPlay Simulator present at the Additional Tools path).

---

## High-Level Technical Design

```mermaid
flowchart TB
  subgraph Native["iOS native (config-plugin generated)"]
    SM[Info.plist UIApplicationSceneManifest]
    SD[CarPlaySceneDelegate.swift]
    MOD[MotoVaultCarPlay Expo module .swift]
  end
  subgraph JS["JS runtime"]
    SEAM[useCarPlayConnection seam]
    COORD[carplay-coordinator]
    STORE[(useRideStore + ride-controller)]
  end
  SM --> SD -->|didConnect/didDisconnect interfaceController| MOD
  MOD -->|onConnect / onActionPress events| SEAM --> COORD
  COORD -->|setRootTemplate / updateInformationItems| MOD --> SD
  COORD -->|subscribe| STORE
  COORD -->|start/stop intents| STORE
```

---

## Requirements Trace

- Parent U0 (library falsification + custom-module spike) → U0
- Parent U1 (entitlement + scene manifest + scene delegate) → U1
- Parent U2 (custom Expo module: connect/disconnect, setRootTemplate, CPInformationTemplate render/update, action-press) → U2
- Parent U4 (coordinator: project live ride, route controls) → U4N
- Origin R1/R2/R3/R6/R10/R11 (panel content, template-only, toggle controls, glance hierarchy, coexist, own tile) → U2, U4N
- Seam wiring (`useCarPlayConnection`) → U4N

---

## Implementation Units

### U0. Spike: falsify the library, prove the custom-module round-trip

- **Goal:** De-risk KTD1 before native investment.
- **Requirements:** KTD1
- **Dependencies:** none
- **Files:** throwaway branch / scratch under `apps/mobile/modules/carplay/` (no production wiring)
- **Approach:** (a) Add `@g4rb4g3/react-native-carplay` to a scratch dev build on RN 0.85 and confirm it fails to register / crashes (cheap falsification). (b) Stand up a minimal `MotoVaultCarPlay` Expo module exposing one `Function setRootTemplate` + one `onConnect` event, and prove a `CPInformationTemplate` renders + an action fires `onActionPress` in the CarPlay Simulator. Gate U2's full surface on (b) succeeding.
- **Test scenarios:** Test expectation: none — spike; record binary yes/no for both legs.
- **Verification (on-machine):** Documented result of (a); a minimal template visibly rendered in the CarPlay Simulator via (b) before U2 proceeds.

### U1. Config plugin: entitlement + scene manifest + scene delegate

- **Goal:** A dev/EAS build that boots a CarPlay scene with the Driving Task entitlement.
- **Requirements:** R10, R11; parent U1; KTD2, KTD3
- **Dependencies:** none (U0 informs but doesn't block)
- **Files:** `apps/mobile/plugins/with-carplay.js` (create); `apps/mobile/app.config.ts` (modify — register plugin, add `com.apple.developer.carplay-driving-task` to `ios.entitlements`, ensure `UIBackgroundModes` includes `audio` for the later cue; the `location` background mode is owned by parent U3 and out of this plan's scope); `apps/mobile/modules/carplay/ios/CarPlaySceneDelegate.swift` (create)
- **Approach:** `withEntitlementsPlist` adds the entitlement. `withInfoPlist` injects `UIApplicationSceneManifest` with `UIApplicationSupportsMultipleScenes: true`, the existing `UIWindowSceneSessionRoleApplication`, and a `CPTemplateApplicationSceneSessionRoleApplication` pointing at `CarPlaySceneDelegate`. `withDangerousMod('ios')` + `withXcodeProject` copy the Swift scene delegate into the target and patch the Swift AppDelegate so the phone window scene and CarPlay scene coexist under the New-Arch host. The scene delegate forwards `templateApplicationScene(_:didConnect:)` / `didDisconnect:` (the `CPInterfaceController`) into the Expo module singleton.
- **Patterns to follow:** `apps/mobile/plugins/fbsdk-core-only.js`; the `expo-widgets` target in `app.config.ts`.
- **Execution note:** Verify against the installed SDK 56 prebuild template (Expo #46663/#46664) before finalizing the AppDelegate patch.
- **Test scenarios:** Test expectation: none — native build config; covered by Verification.
- **Verification (on-machine):** `expo prebuild` applies cleanly and is idempotent on re-run; the dev build installs; connecting the CarPlay Simulator reaches `didConnect` (logged) and shows the MotoVault tile.

### U2. Custom Expo CarPlay module (Swift)

- **Goal:** New-Arch-clean JS↔native bridge for the templates + lifecycle + actions.
- **Requirements:** R1, R2, R3; parent U2; KTD1, KTD4
- **Dependencies:** U0 (leg b), U1
- **Files:** `apps/mobile/modules/carplay/ios/MotoVaultCarPlayModule.swift` (create); `apps/mobile/modules/carplay/ios/CPInformationTemplate+Map.swift` (create — model→native mapper); `apps/mobile/modules/carplay/expo-module.config.json` (create); `apps/mobile/modules/carplay/src/index.ts` + `types.ts` (create — typed JS API + events)
- **Approach:** Expo Modules API `Module { Events("onConnect","onDisconnect","onActionPress"); Function setRootTemplate; Function updateInformationItems; Function updateInformationActions; Function checkForConnection }`. JS passes plain template models (title, `{title,detail}[]` rows, `{id,title}[]` actions); the Swift mapper builds `CPInformationTemplate` and reassigns `.items`/`.actions` in place for updates (no re-push). The module holds the `CPInterfaceController` handed over by the scene delegate (U1); `checkForConnection` re-fires `onConnect` for a late JS subscriber.
- **Patterns to follow:** Expo Modules API module structure; react-native-carplay Swift mappers (reference only).
- **Test scenarios:**
  - JS `index.ts` type surface compiles and exposes the four functions + three events (typecheck).
  - (on-machine) `setRootTemplate` renders a `CPInformationTemplate`; pressing an action fires `onActionPress` with the action id; `updateInformationItems` changes row detail without a push/animation; `checkForConnection` re-emits `onConnect`.
- **Verification:** `index.ts` typechecks and is importable; (on-machine) the simulator round-trip above succeeds.

### U4N. Coordinator + connection seam wired to the real module

- **Goal:** On connect, render the live-ride panel from the ride store and route start/stop through the engine; light up the existing `useCarPlayConnection()` seam.
- **Requirements:** R1, R2, R3, R6, R10, R11; parent U4
- **Dependencies:** U2
- **Files:** `apps/mobile/src/features/carplay/carplay-coordinator.ts` (create); `apps/mobile/src/features/carplay/carplay-templates.ts` (create — pure `buildPanelItems(snapshot)`); `apps/mobile/src/features/carplay/use-carplay.ts` (modify — `useCarPlayConnection` subscribes to the module's connect/disconnect events instead of returning a constant); `apps/mobile/src/app/_layout.tsx` (modify — start the coordinator once on app init); `apps/mobile/src/features/carplay/__tests__/carplay-templates.test.ts` + `carplay-coordinator.test.ts` (create)
- **Approach:** On `onConnect`, read current ride state (projection, not start) and `setRootTemplate`. Subscribe to `useRideStore` + a timer; coalesce numeric metrics to ~10s, push state-indicator transitions immediately (parent KTD3); build rows via pure `buildPanelItems` (title = state + distance; rows = moving time, climb; placeholders/dashes pre-lock); call `updateInformationItems` only on diff. Action ids route Start/Stop through the existing `ride-controller`. `useCarPlayConnection` becomes a real hook over the module's events (graceful: returns disconnected if the native module is absent, e.g., on Android or a pre-CarPlay build — `requireOptionalNativeModule`).
- **Patterns to follow:** ref-not-deps discipline for fast values (`docs/solutions/.../ride-hud-reanimated-charts-mileage-patterns.md`); always render a valid template incl. empty state (`docs/solutions/.../ios-widget-data-sync-failures.md`); `ride-formatters` + `useMeasurementSystem`.
- **Test scenarios:**
  - `buildPanelItems` returns dashes (never `0.0`) before first GPS lock; title fuses state + distance; RECORDING vs ACQUIRING differ by symbol + text, not color only.
  - Coordinator throttles numeric updates to ≥10s but pushes a state transition immediately; skips the bridge call when items are unchanged.
  - On connect with a ride already recording, the panel mirrors it (no new ride started).
  - `useCarPlayConnection` reports connected on `onConnect` and disconnected on `onDisconnect`; returns disconnected when the native module is absent (no throw).
  - Start action with `expectedStatus = idle` starts a ride via the controller; Stop routes to the guarded path.
- **Verification:** Tests green; (on-machine) a recording ride shows live distance/time/climb on the CarPlay Simulator updating ~every 10s, and Start/Stop drive the real engine.

---

## Risks & Dependencies

- **RN 0.85 native integration unproven (high).** The custom module + Swift scene wiring is net-new and the SDK 56 prebuild UIScene template is in flux. Mitigation: U0 spike gates the investment; the JS seam degrades gracefully when the module is absent.
- **Validation is on-machine only (KTD5).** `expo prebuild`, `pod install`, the Xcode build, and the CarPlay Simulator cannot run in CI or the agent env. The PR ships reviewed code; the developer runs the local build to confirm the tile. **CI will pass on JS/lint/typecheck only — a green CI here does NOT prove the native surface works.**
- **Background recording is out of scope here** (parent U3): the panel can render and control, but a real always-on ride needs the background location session from parent U3. This plan delivers the tile + live projection of a foreground/active ride.
- **App-ID capability (dependency).** The granted entitlement must be enabled on the provisioning profile (manual Apple-portal step) before a signed build.
- **No OTA.** New native code ships only via a fresh native build (`runtimeVersion: appVersion`).

---

## Open Questions

### Resolve before/within implementation
- GPS-lock signal still absent in the store (parent open question) — `buildPanelItems` ACQUIRING/RECORDING split depends on it; derive from waypoint-buffer accuracy or add a `gpsLocked` flag.
- Exact `CPInformationTemplate` row budget on the target head unit (query at runtime) — caps how many rows survive.

### Deferred to parent plan
- Background location session (parent U3), full state machine + stop guard (parent U6), start modes + race reducer (parent U7), bike-status tab (parent U8).

---

## Sources & Research

- Parent plan + design + requirements: `docs/plans/2026-06-25-001-feat-carplay-ride-companion-plan.md`, `docs/design/2026-06-25-carplay-ride-companion-ux-design.md`, `docs/brainstorms/2026-06-22-carplay-ride-companion-requirements.md`.
- Native precedent: `apps/mobile/plugins/fbsdk-core-only.js`, `expo-widgets` target in `apps/mobile/app.config.ts`.
- JS seam + screens already built: `apps/mobile/src/features/carplay/use-carplay.ts`, `apps/mobile/src/components/carplay/*`, `apps/mobile/src/app/(modals)/carplay/*`.
- External: `@g4rb4g3/react-native-carplay` (legacy bridge, RN ≤0.79 — not viable on 0.85); RN 0.85 interop removal; Expo SDK 56 prebuild UIScene issues #46663/#46664; Apple CarPlay Developer Guide (Driving Task templates, ~10s refresh); Expo Modules API + config-plugin docs; `KMalkowski/expo-config-carplay-plugin` (Obj-C reference — rewrite for Swift).
