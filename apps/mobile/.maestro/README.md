# Mobile E2E — Maestro

Authored, committed regression coverage for the Expo app — the mobile counterpart of the web
Playwright suite (`apps/web/e2e/`). Ad-hoc per-change device checks stay on XcodeBuildMCP + axe;
these flows are the durable regression net.

## Build target: use a standalone / preview build (NOT the Expo dev client)

Run these flows against a **bundled build** — a release/preview simulator build or an EAS
`preview`/`development`-profile build with JS embedded — not the Metro-backed Expo dev client:

- The flows use Maestro `clearState` for a deterministic fresh start. On a dev client that also
  wipes the saved Metro server URL, and there's no reliable non-interactive way to re-point it.
- The dev client's Hermes may lag the JS: a fresh dev bundle can crash at startup on
  `Intl.DisplayNames` (used at module load in `country-name.ts`). A production/preview Hermes has
  Intl support, so bundled builds don't hit this.

Build a sim build once, e.g. `pnpm --filter @motovault/mobile ios --configuration Release`
(or an EAS `preview` build), install it on the booted simulator, then run the flows below.

## Flows

- **`flows/smoke.yaml`** — cold-start + render sanity check.
- **`flows/onboarding.yaml`** — full onboarding E2E (INVESTED variant, 16 screens). Requires the app
  built with `EXPO_PUBLIC_OB_VARIANT=invested` for a deterministic order, and a confirmed Supabase
  user (created/deleted by the runner). Run it via:
  ```bash
  pnpm --filter @motovault/mobile test:e2e:onboarding
  ```
  `scripts/run-onboarding-e2e.sh` creates a confirmed test user via the Supabase admin API before the
  flow and deletes it on teardown (pass or fail). It reads URL/anon from `apps/mobile/.env` and the
  service-role key from `apps/api/.env`; override with `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` to target local Supabase instead of prod. Because prod requires email
  confirmation, the flow signs IN the pre-created user rather than signing up through the UI.
- **`flows/edit-maintenance-task.yaml`** — edit/reschedule a maintenance task E2E. Composes
  `onboarding.yaml` as setup (signed-in user + a bike), then creates a task with a known title,
  opens it, edits the title + priority, and asserts the edit round-trips in place. Same build +
  user-provisioning prereqs as onboarding (its runner is a thin wrapper). Run it via:
  ```bash
  pnpm --filter @motovault/mobile test:e2e:edit-task
  ```
  Create/edit steps + selectors were validated live on a simulator via the Maestro MCP
  (2026-07-15); device-specific quirks (badge in the Garage tab label, custom keyboard,
  below-fold save buttons, post-save review prompt) are handled inline. The onboarding *setup*
  portion still assumes a preview build (`clearState`).
- **`flows/add-expense.yaml`** — log an expense on a bike. **Validated on-device 2026-07-15.**
  `test:e2e:add-expense`.
- **`flows/complete-maintenance-task.yaml`** — create a task then mark it Done (odometer + cost).
  **Validated on-device 2026-07-15.** `test:e2e:complete-task`.
- **`flows/log-past-work.yaml`** — the "log done work" journey (PR #164). Sets Imperial in Profile,
  asserts the maintenance odometer suffix reads **"mi"** (unit-preference carry-over), uses the
  **More (⋯) → "Log past work"** entry point to open the Add-task modal in log mode, asserts the
  log-mode shape (Odometer / Date completed / "Log it", Priority hidden), logs a completed record,
  confirms it lands under History, and cleans up. **Authored from source 2026-07-16, pending
  on-device validation.** `test:e2e:log-past-work`.
- **`flows/add-bike.yaml`** — add a second motorcycle. **Requires a PRO account** (free tier caps at
  1 bike and onboarding already adds a Honda → paywall). Authored from source; validate on a Pro
  account. `test:e2e:add-bike`.
- **`flows/delete-expense.yaml`** — delete an expense. The gesture-only delete (the original client
  complaint) was **fixed**: tapping an expense row now reveals a visible "Delete" button
  (`swipeable-expense.tsx`); the reveal was validated on-device 2026-07-15. Flow drives the button
  path (tap row → Delete → confirm). `test:e2e:delete-expense`.
- **`flows/log-ride.yaml`** — start a ride, record, hold-to-end, save. **Validated end-to-end
  on-device 2026-07-15.** Uses `setLocation` for a GPS fix; ends via a long-press ("Hold to end
  ride") + a point-tap on the "End Anyway" bottom-sheet confirm (buttons not in the a11y tree).
  `test:e2e:log-ride`.
- **`flows/units-display-toggle.yaml`** — odometer unit label (PR #165). Odometer values are stored
  RAW in the user's global unit (no km normalization), so toggling the global Units preference flips
  the bike-hub odometer **label** between **mi** and **km** on the same bike (guards the hardcoded-"km"
  regression class); the raw number itself is unchanged by the toggle. No numeric-input selector, so
  low fragility. **Authored from source 2026-07-16; navigation selectors validated on-device** (Profile
  Units picker, Garage tab, bike card). `test:e2e:units-display`.

  All authed journey flows share the parameterized onboarding runner via `E2E_FLOW` /
  `E2E_EMAIL_PREFIX` (set inline in the `test:e2e:*` package scripts) — no per-flow wrapper needed.

- **`flows/onboarding.yaml`** also carries the **P2 fail-open regression**: at bike-setup it asserts
  the "Is this your ride?" intent confirmation is NOT shown when no web intent is present (case 1).
  The web→app intent's only transport is the **Android Play install referrer** (iOS clipboard was
  dropped — it triggered a paste prompt at onboarding), which can't be seeded on a simulator without
  a real Play Store install; the positive case (confirmation shown) is verified manually on an
  Android device. The parse + make-resolution logic is unit-tested (`pending-intent.test.ts`).

## One-time setup

1. **Maestro CLI** (requires a JDK — the JDK 17 from the Android setup works):
   ```bash
   curl -fsSL https://get.maestro.mobile.dev | bash
   ```
   See https://docs.maestro.dev/getting-started/installing-maestro
2. A booted **iOS simulator** or **Android emulator** with the app installed.
3. (Optional, for authoring) the Maestro MCP server — already declared in the repo's `.mcp.json`.

## Run

```bash
# Terminal 1 — Metro + the dev-client app on a device (also needs the API running)
pnpm --filter @motovault/mobile ios      # or android

# Terminal 2 — run the flows against the booted device
pnpm --filter @motovault/mobile test:e2e
```

`scripts/run-maestro.sh` injects `APP_ID` (defaults to `com.motovault.app`). If your dev-client
build ships under a different bundle id, override it:

```bash
APP_ID=com.motovault.app.dev pnpm --filter @motovault/mobile test:e2e
```

## Authoring a flow

**Never invent selectors from a screenshot.** Get real ones from the running app via the Maestro MCP:
`list_devices` → `inspect_screen` (read the view hierarchy) → `run` (try the flow inline). Copy
visible text verbatim.

- One flow per user journey; name the file after it: `log-a-ride.yaml`, `add-bike.yaml`.
- Cold-start (`stopApp` + `launchApp`) so each flow is idempotent and independent.
- Assert on visible text / accessibility labels. Text match is whole-string, case-insensitive
  regex — anchor with `.*` when native controls add wording (`"Garage, tab, 1 of 5"`).
- Unlabeled icon buttons: add a real `accessibilityLabel` (an a11y win) and target it, or tap by `point:`.
- Deep-link a route directly with the app scheme when tapping there isn't what's under test:
  `- openLink: motovault://route/…`

See `.claude/skills/write-tests/E2E.md` for the full convention set. Screenshots from
`takeScreenshot:` land in `~/.maestro/tests/<run>/` under `maestro test`, but when driving
via the Maestro **MCP** `run` tool they're written to the **cwd** (`apps/mobile/*.png`) — clean
those up, they're not meant to be committed.

## App-specific gotchas (learned from live runs)

Hard-won specifics for THIS app — check these first when a flow "should work" but doesn't:

- **The custom keyboard ignores `hideKeyboard`.** `react-native-keyboard-controller` powers the
  inputs, so Maestro's `hideKeyboard` errors ("couldn't hide the keyboard"). Dismiss it by tapping
  a **non-interactive label** (a section header like `Priority`) — `keyboardShouldPersistTaps:
  "handled"` dismisses on taps that hit no responder.
- **Primary/submit buttons can sit below the keyboard.** The add/edit *maintenance task* screens now
  pin Cancel+Save above the keyboard (`KeyboardStickyView`), but other long forms still put the
  submit button at the bottom of the scroll where the keyboard covers it. `scrollUntilVisible` the
  button (or dismiss the keyboard) before tapping it — don't assume it's on screen.
- **Native interstitials fire mid-flow — guard them with `optional: true`.** After sign-in iOS shows
  **"Save Password?"** (dismiss `Not Now`). After value-moments (adding a task, completing one, etc.)
  a StoreKit **"Enjoying MotoVault?"** rating prompt can appear (dismiss `Not Now`) — it's gated to
  ≥2 value-moments + once per app version, so it shows up on seasoned accounts, not fresh ones.
- **Tab-bar labels include the badge in their a11y text.** The Garage tab reads `"Garage, 1 due"`
  (was `"1, Garage"` before the a11y fix) when a badge is present. Always match tabs with a partial
  regex (`.*Garage.*`), never the bare word.
- **Editorial headers split a phrase across `Text` nodes.** "New task." / "Edit task." render as two
  elements, so a single-element regex like `.*New.*task.*` will NOT match. Assert on a single-element
  label or button instead (e.g. `Priority`, `Save task`).
- **Lists truncate; card actions don't need expanding.** The bike hub shows the top ~5 tasks + a
  **"See all"**; to act on a specific task reliably, open the All Tasks screen and `scrollUntilVisible`
  it. The Done/Edit/Delete row is always rendered on each card — no tap-to-expand needed.
- **Disambiguate repeated per-row controls.** Every task card has its own `Edit`/`Delete`; anchor the
  tap with `below:`/`rightOf:` (e.g. `tapOn: { text: "Edit", below: { text: "<task title>" } }`).
- **Confirm dialogs reuse the same word as the row button.** A destructive action opens an Alert whose
  `Delete` must be targeted distinctly from the card's `Delete` — use `rightOf: { text: "Cancel" }`.
- **`inputText` can concatenate across fields.** With the custom keyboard, a `tapOn` that doesn't
  actually move focus makes the next `inputText` append to the previous field (seen on sign-in:
  email+password merged). Verify focus / `eraseText` before typing into a second field.
- **Dev client vs preview build.** `clearState`/`clearKeychain` flows (onboarding) need a
  standalone/preview build. To validate *selectors* quickly you can drive the Metro dev client with an
  already-signed-in account (skip the clearState setup) — that's how the edit flow's selectors were
  confirmed.
- **Own your test data.** Create preconditions with distinctive titles (`E2E …`) and delete them at the
  end — flows run against a shared account, so leftover state makes reruns flaky.
- **Visible text ≠ a11y label — always `inspect_screen`.** Several controls render one string but expose
  another to Maestro: the ride "End Ride" button's a11y label is **"End unfinished ride"**; a tab label
  carries its badge (**"Garage, 1 due"**). Match the a11y label (partial regex), not the on-screen word.
- **Some controls are gestures, not taps.** Ending a ride is a **long-press** ("Hold to end ride" →
  `longPressOn`), and deleting an expense is swipe/long-press (see delete-expense's blocked note).
- **Unlabeled + portal'd controls need point-taps.** The center ride **FAB** has no label (tap ~50%,92%),
  and the ride's **"End ride?"** confirm is a `@gorhom/bottom-sheet` whose buttons are absent from the
  a11y tree — tap "End Anyway" by point (~73%,80%). Point-taps are percentage-based (portable) but
  resolution-sensitive; prefer a real selector whenever `inspect_screen` exposes one.
- **GPS-dependent flows need `setLocation`.** The ride pre-flight GPS check and recording need a fix;
  set one at the top of the flow (a stationary sim logs ~0 distance, which still saves).
