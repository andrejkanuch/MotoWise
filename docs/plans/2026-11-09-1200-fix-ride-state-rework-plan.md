# Ride state rework: one source of truth for recording, pause and end

Status: plan, not started. Written 2026-11-09 from a read-only audit of `origin/main` at `7496dad4`. Every file:line below is from that commit; re-check it before editing.

## Why

The owner reported two problems. The phone and CarPlay disagree about a ride, for example after ending one from CarPlay. And App Store crash reports have come in since 3.26.0. The cause is one native crash plus a ride state that is kept in three places that never sync:
- the in-memory zustand store, `stores/ride.store.ts`, which is lost when the process dies and is never hydrated
- MMKV, `utils/ride-storage.ts`
- the server, `rides.status`

## The crash (Phase 0)

Sentry **MOTO-VAULT-REACT-NATIVE-43**, `-[CPTemplateApplicationScene windows]: unrecognized selector`. It is fatal and live on 3.26.0 (106), iOS 27.2.

How it happens:
- nativewind `5.0.0-preview.4` `useColorScheme()` returns a new `setColorScheme` on every render (`node_modules/nativewind/dist/module/stylesheet.js:6-15`). So the effect at `src/app/_layout.tsx:518-521` runs on every `RootLayout` render.
- `RootLayout` re-renders on every navigation, because `useRideIdleResponses()` (`_layout.tsx:556`) calls `useSegments()` (`hooks/use-ride-idle-responses.ts:29`).
- When the rider presses Stop on CarPlay, `router.replace(summary)` runs (`carplay-coordinator.ts:647`). That re-render calls `Appearance.setColorScheme`.
- `Appearance.setColorScheme` reaches `RCTAppearance.mm:112-123`, which casts every connected scene to `UIWindowScene`. The CarPlay scene is not one, so the app crashes.
- It happens even for riders on the "System" theme: 'system' maps to 'unspecified'.

## Audit findings (verified in code, not reproduced on device)

1. The crash above. It kills recording and ride-end while CarPlay is connected.
2. **`hydrate()` (`ride.store.ts:~113`) has no caller.**
   - After the process dies, the tab button, home and CarPlay all show idle, and CarPlay offers Start.
   - Starting a ride then orphans the old one; the server closes it as `stale_on_start` (`rides.service.ts:~331-410`).
3. **A ride ended without its summary looks unfinished.**
   - `endRideSession` keeps the rideId for the summary (`ride-controller.ts:~375-380`). If the summary never opens, Start Ride offers Resume on a ride the server already completed.
   - The next EndRide then hits "already completed → success" (`rides.service.ts:~506-515`) and silently drops the new segment.
4. **Saving an old summary kills a newer active ride.** `clearRideData(rideId)` (`ride-storage.ts:~311`) wipes the global keys whether or not that rideId is the current one.
5. **Auto-pause `subState` is written to disk only** (`ride-location.ts:~351`). CarPlay and the banner show RECORDING during an auto-pause, and AUTO-PAUSED for a manual pause (`carplay-templates.ts:~213,246`; `use-carplay.ts:~96`).
6. **`elapsedTime` is written only by the HUD timer** (`ride-hud.tsx:~197`), so the banner and tab button are stale on CarPlay rides.
7. **Resuming after a kill resets distance and maxSpeed** (`ride.store.ts` startRide `~:69-77`). A leftover `pausedAt` also freezes the clock.
8. **A manual pause does not cancel the "Still riding?" reminders**, and the server idle sweep treats a pause as idle.
9. **The summary's "Moving time" shows `durationS`**, not the server's `movingTimeS`.
10. **Minor:**
    - The CarPlay Automatic and Phone-first start modes are selectable but not built.
    - CarPlay Stop has no too-short guard.
    - `active-ride-banner.tsx` still has mock defaults and a TODO.

## Extra findings from the plan pass

- **A manual pause is lost after a kill.** `processLocation` drops samples only when the *store* says `paused` (`utils/ride-location.ts:375-376`). A headless relaunch therefore records GPS during the pause.
- **`startRideSession` does not reset the stored status** (`ride-controller.ts:145-154`). A stale `paused` can carry into the next ride.
- **`clearRideData` also wipes the HUD layout preference.** `HUD_LAYOUT` is in `RIDE_KEYS` (`ride-storage.ts:30`).
- **`setCurrentId('')` stores an empty string instead of removing the key** (`ride-controller.ts:166`, `start-ride.tsx:124`). The `activeRideId == null` check at `_layout.tsx:686` misses it.
- **The server already supports `paused`.** The check constraint allows it (`supabase/migrations/00047_create_rides_table.sql:11`). `endRide`, `closeStaleRides` and the idle sweep already treat it as active (`rides.service.ts:336,454`; `ride-idle.service.ts:27`). No migration is needed for pause.
- **OTA reach.** `runtimeVersion.policy` is `appVersion` (`app.config.ts:56`), and main is at `3.27.0`. An OTA from main does not reach 3.26.0 build 106.
- **Route files must not grow** (`check:mobile-structure`). That covers `ride-summary.tsx` (932 lines), `start-ride.tsx`, `ride-hud.tsx`, `(tabs)/_layout.tsx` and `(home)/index.tsx`. New logic goes into `src/features/ride/`.

## Target model

**The persisted record is the truth; the zustand store is a projection of it.**
- Ride-level values keep their own MMKV keys, so no data migration is needed.
- Three new keys:
  - `ride.phase`: `recording|paused|ending|ended`. It replaces `ride.status`, which is still written so a rolled-back bundle keeps working.
  - `ride.ended_summary`: JSON `RideEndSummary` plus `endedAt`, `source`, `recovered` and `autoEnded`.
  - `ride.live_stats`: a stats checkpoint written at the existing 30 s buffer flush (`ride-location.ts:475-478`).
- One accessor, `readRideRecord()`, normalizes the record:
  - A legacy ride (current id set, no phase) maps to `status ?? 'recording'`.
  - `recording` with `pausedAt > 0` is treated as paused.

| From | Event (only in `ride-controller`) | To | Side effects |
|---|---|---|---|
| none | `startRideSession` | recording | Mint id, reset phase/clock/flags, GPS, reminders, StartRide op. Refuse if recording, paused or ending; if ended, finalize the old ride first (Q2) |
| recording | `pauseRideSession` (HUD/CarPlay) | paused | Stamp `pausedAt`, cancel reminders, PauseRide op (Phase 4) |
| paused | `resumeRideSession` | recording | Bank the pause, re-arm reminders from now, ResumeRide op |
| recording | GPS engine reports `subState` | recording (moving/stopped) | Persist and project; forgot-to-stop flag |
| recording/paused | stop (HUD, CarPlay, notification, recovery, auto-end) | ending → ended | Write `ending` first; aggregate; enqueue EndRide; write the summary, then `ended`; stop GPS and reminders |
| ending (found after a kill) | hydrate | ended | Re-run the end; a repeated EndRide is a server-side no-op (`rides.service.ts:508-514`) |
| ended | `finalizeEndedRide(rideId, saved\|discarded)` | none | Clear **only** that rideId |

Writers persist first, then call `useRideStore.getState().project(record)`. `hydrate()` becomes `project(readRideRecord())`. It runs at bundle entry and on AppState `active`, and it seeds stats only on an idle→active change, so live in-process stats are never reset.

## Phase 0: crash fix

- **New `src/lib/apply-color-scheme.ts`:**
  - Calls `Appearance.setColorScheme` directly.
  - Remembers the last value applied in the module, starting at `'unspecified'`, and skips repeats. "System" riders never call native.
  - While `isHeadUnitConnected()` is true, it does not call native. It saves the value and applies it once from `addDisconnectListener`.
- **`src/app/_layout.tsx:517-521`:** the effect depends on `storedColorScheme` only and calls the helper. Drop the nativewind setter, keep `resolvedScheme`, add no lines.
- **`src/components/profile/use-app-preferences.ts:78,141`:** use the helper.
- **Native patch (needs a store build):** `pnpm patchedDependencies` for `react-native@0.86.2`, so `RCTAppearance.mm` skips scenes that are not `UIWindowScene`. RN is built from source (`app.config.ts:277`), so the patch takes effect.
- **Tests:**
  - New `src/lib/__tests__/apply-color-scheme.test.ts`: skip, defer, apply-on-disconnect, no repeats.
  - Update `use-app-preferences.test.tsx:18,61,67`.
  - Manual CarPlay simulator check: end the ride from CarPlay with the phone UI open, in Light, Dark and System.
- **Shipping:** the JS part can go by OTA, but only to 3.27.0 binaries (see Q1). The patch goes in the next store build.

## Phase 1: one persisted source, hydrated everywhere (issues 2, 4, 7)

- **`utils/ride-storage.ts`:**
  - Add the phase and live-stats keys, plus `readRideRecord` and normalization.
  - `clearRideData(rideId)` always clears that ride's chunks and buffer, but clears the global keys and the in-memory buffer only when `getCurrentId() === rideId`.
  - Keep `HUD_LAYOUT`.
  - Add `clearCurrentRide()`, which removes the key.
- **`stores/ride.store.ts`:** `project(record)` replaces start/pause/resume/end (`:69-96`). Pause-clock writes move to the controller.
- **New `src/features/ride/ride-entry.ts`:**
  - Runs hydrate and adds the AppState listener.
  - Imports `ride-controller` so the GPS task is defined at bundle evaluation.
  - It is imported in `apps/mobile/index.ts` after `init-sentry-entry` and before `carplay-entry`. Update the order pinned in `carplay-entry.test.ts`.
- **`ride-controller.ts`:**
  - Persist the phase on start.
  - Base the idempotence check on the persisted phase (`:259`).
  - Add `resumeRecoveredRide()`: keeps a paused ride paused and seeds stats from `live_stats`, falling back to an `aggregateWaypoints()` extracted from `:276-306`. It replaces `start-ride.tsx:89-103`.
- **`ride-location.ts:375`:** read the phase from the record.
- **New `features/ride/use-unfinished-ride.ts`:** Start Ride's unfinished-ride logic moves here, so the route shrinks.
- **Tests:**
  - `readRideRecord` (legacy, inconsistent and missing records).
  - `clearRideData` with a non-current id.
  - `hydrate` keeps in-process stats.
  - `resumeRecoveredRide` keeps distance, maxSpeed and the pause.
  - `start` refuses while a ride is active.
  - Maestro `ride-recover-after-kill.yaml`.
- **Shipping:** OTA. Rollback is safe because the legacy keys are still written.

## Phase 2: two-step ending and review (issues 3, 9)

- **Ending:**
  - The end writes the phase and summary.
  - Add `finalizeEndedRide`.
  - `buildRideSummaryHref` passes only `rideId`; the summary loads from `ride.ended_summary` and still accepts old params.
- **New `features/ride/use-ride-summary-actions.ts`:** Save and Discard move here from `ride-summary.tsx:276-376`; both call `finalizeEndedRide`.
- **Moving time:** the summary shows `movingTimeS` (`ride-summary.tsx:397`).
- **Notifications (`ride-notification-response.ts:65`):** route by phase. Ended goes to the summary, active to the HUD, none to Start Ride.
- **Phone screens:**
  - RideFAB (`(tabs)/_layout.tsx:85`) shows "Review" when the phase is ended.
  - Home gets a "Ride ended — review" card, as a new `components/home/` component.
- **Auto-end:** `autoEndRide` (`ride-location.ts:521-606`) becomes an engine end into `ended` (Q3). It goes through a sink that `ride-controller` registers, so `utils` does not import `features`.
- **New copy:** through `t()`, in all 13 locales.
- **Tests:**
  - The end persists the summary.
  - A kill during `ending` re-runs the end.
  - Finalize clears only that ride.
  - Notification routing.
  - Maestro: `ride-review-after-kill.yaml`, and extend `log-ride.yaml`.
  - CarPlay simulator: Stop with the phone locked, then unlock. The phone should show Review, with no crash and no Resume.
- **Shipping:** OTA.

## Phase 3: pause, sub-state and clock through the engine (issues 5–8)

- **`pauseRideSession` / `resumeRideSession`:** cancel and re-arm reminders (`utils/ride-reminders.ts:125,155`). Callers: `ride-hud.tsx:211-231` and `carplay-coordinator.ts:563-567`.
- **Auto-pause effects (`ride-location.ts:351,354`):** `setSubState` and `setForgotToStopPending` persist **and** project.
- **CarPlay templates:**
  - New panel states `paused` (PAUSED, with Resume and Stop) and `saved` (RIDE SAVED, with "Review on phone").
  - `autoPaused` shows Pause and Stop.
  - `deriveState` maps `ended` to `saved`.
- **Phone banner:** a new `paused` banner state.
- **Elapsed time:** remove `elapsedTime` from the store. A new `features/ride/use-ride-elapsed.ts` ticks from `elapsedRideSeconds()`; RideFAB and the banner use it.
- **Tests:**
  - Templates for every state.
  - Coordinator pause and resume go through the controller.
  - Sub-state is projected.
  - The elapsed hook freezes while paused.
  - Maestro `ride-pause-resume.yaml`.
  - CarPlay simulator, GPX stop longer than 60 s: auto-pause shows AUTO-PAUSED, manual pause shows PAUSED, and the banner time advances while the HUD is closed.
- **Shipping:** OTA.

Follow-ups found while reviewing Phase 1 (PR #369), to fold into Phase 3:
- **GPS permission lost mid-ride.** No screen reads `gpsPermissionLost`; only the "GPS tracking stopped" notification tells the rider. Add a HUD banner (Open Settings / End).
- **CarPlay shows an interrupted ride** (`recordingInterrupted`) as recording, with Pause / Stop, and cannot restart GPS. Offer "Resume recording" (`resumeRecoveredRide`) or End.
- **GPS stopping while the process survives** never sets `recordingInterrupted`, because only hydrate-from-idle sets it. Set it from a foreground check guarded by a resume generation counter.
- **A start that auto-saves an unreviewed ended ride** fires no `ride_completed` and doesn't refresh the odometer caches. Add a `RIDE_SAVE_TRIGGER` for it.

## Phase 4: the server learns about pause

- **API:**
  - `pauseRide` / `resumeRide` mutations, guarded `status in ('recording','paused')`.
  - The idle sweep (`ride-idle.service.ts:179-191`) skips the 2 h nudge for `paused` rides and keeps the 24 h auto-end measured from the last fix.
  - Paused-ride push copy.
  - Run `pnpm generate`.
- **Mobile:** new `.graphql` files, plus the operations in `utils/ride-sync-queue.ts:21-32`.
- **Migration:** none. An optional `paused_at` column is analytics only; it would be a migration file that the owner applies.
- **Sequencing:** deploy the API **before** the OTA. Otherwise the new operations park in the dead-letter queue and raise "Ride sync failed".

## Phase 5: cleanup (issue 10)

- Disable the CarPlay "Automatic" and "Phone-first" start modes as "Coming soon", and bump the persist version in `carplay.store.ts:47-58`.
- Add a too-short guard to the CarPlay Stop confirm.
- `active-ride-banner.tsx`: remove the mock defaults and the TODO, make the props required, and route its copy through `t()`.

## Display matrix (after Phase 3)

| Surface | none | recording (moving) | recording (auto-paused) | paused | ending / ended |
|---|---|---|---|---|---|
| Tab ride button | Start → Start Ride | Pulse + elapsed → HUD | Pulse + elapsed → HUD | Frozen elapsed → HUD | "Review" → summary |
| Home action/card | Start Ride | → HUD | → HUD | → HUD | "Ride ended — review" card |
| Start Ride screen | Pick bike + Start | Resume (no Start) | Resume | Resume (stays paused) | Review (no Resume) |
| HUD | n/a | Live, Pause/End | Live + stopped hint | Paused, Resume/End | Redirect to summary |
| Phone CarPlay banner | Hidden / "start from head unit" | RECORDING + live time | AUTO-PAUSED | PAUSED | "Ride saved — review" |
| CarPlay panel | READY + Start | RECORDING, Pause/Stop | AUTO-PAUSED (or STILL RIDING?), Pause/Stop | PAUSED, Resume/Stop | RIDE SAVED, review on phone, no Start (Q2) |
| Reminders | none | Armed, pushed by movement | Fire at 10/30 min | Cancelled (Q4) | Cancelled |
| Server status | n/a | recording | recording | paused (Phase 4) | completed |

## Open questions for the owner

1. Is 3.27.0 in the stores? This decides how Phase 0 reaches riders: either an OTA from a branch cut at 3.26.0, checked against the native-mismatch rule in `docs/runbooks/mobile-ota.md`, or a fast 3.27.0 store build that also carries the native patch.
2. While a ride waits for review, should CarPlay offer "New Ride" that auto-saves the pending ride (recommended), or block until it is reviewed on the phone?
3. Should the 30-minute auto-end go through `ended` and review, or keep saving directly as it does today? This also decides where `ride_completed` fires.
4. Should a long manual pause get its own reminder (for example "Ride paused 2 h")? And what pause threshold should the server sweep use?
5. Should the optional `paused_at` migration be added?

## Not verified

- The Sentry event itself was not re-pulled during the plan pass.
- Whether a headless iOS relaunch evaluates the whole bundle entry.
- Whether MMKV listeners fire synchronously. The plan uses explicit `project()` calls instead.
- Whether there are native changes between #311 (the 3.26.0 version bump) and main.

## Decisions (2026-11-09, researched; owner asked not to wait)

The owner asked for each open question to be researched and decided rather than held. These are the decisions:

1. **Release state, and how Phase 0 ships.**
   - App Store Connect: iOS **3.26.0 is the newest version, READY_FOR_SALE**. No 3.27.0 version exists.
   - So Phase 0 ships two ways:
     - An OTA hotfix built from the 3.26.0 release commit with only the JS guard cherry-picked. It follows `docs/runbooks/mobile-ota.md` and the "OTA hotfix on older runtime" pattern. Publishing it needs the owner's go-ahead.
     - The JS guard plus the native RN patch on `main`, shipped with the 3.27.0 store build.
   - Root cause is confirmed from the Sentry stack: the crashing frame is `-[RCTAppearance setColorScheme:] (RCTAppearance.mm:117)`, reached through `ObjCTurboModule::performVoidMethodInvocation`. That is React Native's own module, not a third-party SDK. Intercom reports the same exception from its own SDK on iOS 27 CarPlay, which shows the pattern: code that assumes every scene is a phone `UIWindowScene`.
2. **A pending review never blocks CarPlay.** "New Ride" auto-saves the pending ride.
   - Why: CarPlay driving-task apps must complete flows without the iPhone and keep tasks to a few seconds (Apple CarPlay App Programming Guide; WWDC22 "Get more mileage out of your app with CarPlay").
   - Auto-saving never loses data. Discard stays a deliberate phone-side action, and discards are unrecoverable in Strava too.
3. **The 30-minute auto-end keeps saving directly.** The rider has walked away, so a pending review would only block the next ride.
   - The "Ride saved" notification deep-links to the ride, which can be edited or deleted there.
   - `ride_completed` keeps firing at auto-end.
4. **Reminders while paused.**
   - A manual pause cancels the 10 and 30 minute "Still riding?" reminders.
   - It schedules one "Ride paused for 2 h — end it?" reminder.
   - Server: the idle sweep skips the 2 h nudge for `paused` rides and auto-ends a paused ride 24 h after its last fix, the same as today.
   - Riders pause deliberately at lunch or fuel stops (Rever auto-pauses after about 1 minute stationary; Strava advises a manual pause indoors), so a 10 minute nudge after a manual pause is noise.
5. **No `paused_at` migration.** Pause analytics can come from the PostHog pause/resume events.

Sources:
- [Strava: Recording an activity](https://support.strava.com/hc/en-us/articles/216917397-Recording-an-Activity)
- [Apple CarPlay App Programming Guide](https://Developer.apple.com/carplay/documentation/CarPlay-App-Programming-Guide.pdf)
- [WWDC22 session 10016](https://developer.apple.com/videos/play/wwdc2022/10016/)
- [Intercom: crash on CarPlay in iOS 27](https://community.intercom.com/mobile-sdks-24/crash-on-carplay-in-ios-27-14779)
- [Apple forums: CPTemplateApplicationScene unrecognized selector](https://developer.apple.com/forums/thread/701953)
- [Rever auto-pause review](https://adventuremotorcycle.com/gear/gear-rever-app-trail-phone-gps)
