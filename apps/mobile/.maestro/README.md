# Mobile E2E — Maestro

Authored, committed regression coverage for the Expo app — the mobile counterpart of the web
Playwright suite (`apps/web/e2e/`). Ad-hoc per-change device checks stay on XcodeBuildMCP + axe;
these flows are the durable regression net.

## Build target: use an E2E build (NOT the Expo dev client)

Run these flows against a **bundled build** with JS embedded — not the Metro-backed Expo dev client.
There is no EAS `preview` build; use one of these (set up 2026-11-12, #365 T00):

**Build locally by default** (owner rule 2026-11-12): add `--local` to any `eas build` command below
(run from `apps/mobile`; same profile and EAS-managed signing, output via `--output <file>`). Use the EAS cloud only
when a local build is not possible. The first local Android build fills ~5–8 GB of Gradle cache.

| Build | Command | Backend | Use for |
|---|---|---|---|
| iOS simulator | `eas build -p ios --profile e2e-simulator` (download the `.tar.gz`, `xcrun simctl install booted <app>`) | production (vendor SDKs off) | every iOS flow except the paywall gate (`OB_VARIANT=invested`) |
| iOS simulator, paywall gate | `eas build -p ios --profile e2e-simulator-paywall` | production, **vendor SDKs on** | `onboarding-paywall-verify.yaml` only (the #326 promotion gate, #365 T18) |
| Android APK, production backend | `eas build -p android --profile e2e-android` | production | read-only flows, flows that clean up their own account |
| Android APK, local stack | `eas build -p android --profile e2e-android-local` | local Supabase `http://10.0.2.2:54321` + local API `http://10.0.2.2:4000/graphql` (cleartext allowed only in this build via `E2E_LOCAL_STACK=1`) | seeded flows (diagnosis used, limits) — see `features/bike-detail-shell-overview/local-stack.md` |
| Android, real store binary | `bundletool build-apks --mode=universal` on the production AAB, sign with a local debug key, `adb install` | production | read-only red runs only: never sign up, sign in or create rows |

> **Warning:** any run of `e2e-simulator-paywall` writes to production analytics (PostHog events, the
> `onboarding_paywall_2026q4` experiment exposure, RevenueCat, Meta) and needs the owner's go-ahead.

Every E2E profile except `e2e-simulator-paywall` sets `EXPO_PUBLIC_E2E_NO_VENDOR_SDKS=1` (`src/lib/e2e-build.ts`: RevenueCat not configured, PostHog without a key, Meta events dropped; EAS rejects empty keys in `eas.json`), so they send no test traffic to those dashboards. `e2e-simulator-paywall` keeps them on because the paywall gate needs the real RevenueCat paywall and PostHog flag. `src/lib/__tests__/sentry-environment.test.ts` fails for any new `e2e-*` profile without the switch, unless it is added to that test's allow-list on purpose. All E2E profiles set `EXPO_PUBLIC_E2E_RUN=1`: every PostHog event from such a build carries the super property `e2e_run: true` (`src/lib/analytics-release-marker.ts`), which every #365 metric excludes. Any new E2E profile must set it too. They also set
`EAS_NO_FROZEN_LOCKFILE=1` (the EAS upload has no `apps/api/package.json`, so a frozen install fails).

Both iOS profiles still point at the **production backend** (no local URLs in `eas.json`). For device
checks, bundle the JS against local backend URLs instead (the T04b recipe in the PR #469 device-check
comment: swap the embedded bundle via `npx expo export:embed` with the local Supabase/API URLs and
`EXPO_PUBLIC_E2E_NO_VENDOR_SDKS=1`), unless a flow specifically needs production.

Devices on the dev machine (2026-11-12): iOS simulator **"MV iPhone"** (iPhone 16, iOS 27.2,
`xcrun simctl list devices available`); Android emulators from `emulator -list-avds`
(API 35 `google_apis`, no Play Store).

Why not the dev client:

- The flows use Maestro `clearState` for a deterministic fresh start. On a dev client that also
  wipes the saved Metro server URL, and there's no reliable non-interactive way to re-point it.
- The dev client's Hermes may lag the JS: a fresh dev bundle can crash at startup on
  `Intl.DisplayNames` (used at module load in `country-name.ts`). A release/E2E Hermes has
  Intl support, so bundled builds don't hit this.

Build once with one of the commands above, install it on the booted simulator or emulator, then run
the flows below.

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
  Right after creating the user the runner sets `public.users.is_synthetic = true` on it
  (`scripts/e2e-mark-synthetic.sh`; the email-code runner does the same for the account the app
  creates) and appends its id to a local ledger outside the repo (`E2E_USER_LOG`, default
  `$HOME/.motovault-local/e2e-users.log`). Teardown deletes the `public.users` row, so the #365 metrics exclude deleted
  test accounts through that ledger and kept ones through `is_synthetic`
  (`docs/research/activation-365/queries/q00-excluded-persons.md`).
  **Seeded flows** run against the local stack only: export `SUPABASE_URL=http://127.0.0.1:54321` and the
  stack's anon/service-role keys, and install a build that talks to the same stack (`e2e-android-local`,
  which reaches it at `10.0.2.2`; see `features/bike-detail-shell-overview/local-stack.md`).
  Its steps up to the account screen live in `flows/_shared/onboarding-to-account.yaml` (outside
  the `flows/*.yaml` glob, so it never runs on its own).
- **`flows/onboarding-email-code-signup.yaml` + `flows/onboarding-email-code-verify.yaml`** —
  email-code confirmation (signup through the UI, then the code). Two flows because Maestro fixes
  flow variables at launch and the code only exists after the signup. Run both via:
  ```bash
  DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:email-code
  ```
  `scripts/run-onboarding-email-code-e2e.sh` runs part 1 (the app signs up a new account and shows
  the code step), gets a valid code from the admin `generate_link {type: signup}` API, runs part 2
  (types it, finishes onboarding to Home), and deletes the account on exit. Supabase sends a real
  confirmation email for the UI signup, so the default address is Resend's
  `delivered+<label>@resend.dev` test inbox (reports delivered, never bounces). The server side of
  the same contract runs in CI on every relevant PR: `scripts/e2e-email-confirmation.sh`
  (`.github/workflows/email-confirmation-e2e.yml`).
- **`flows/onboarding-signin-unfinished-account.yaml` + `flows/onboarding-signin-onboarded-account.yaml`** —
  returning-rider sign-in from Welcome (issue 365 T11, FS-OB1a). A confirmed account that has not
  finished onboarding must leave "Welcome back." for Experience with the "Account ready" notice
  (`onboarding-account-ready`, up for 4 s); an onboarded account must land on Home. Steps up to
  Sign In live in `flows/_shared/welcome-to-sign-in.yaml`. Local stack only (the runner creates the
  users and refuses any other `SUPABASE_URL`); simulator AutoFill Passwords off. Run via:
  ```bash
  SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> \
    DEVICE=<udid> pnpm --filter @motovault/mobile test:e2e:onboarding-signin
  ```
- **`flows/onboarding-oauth-cancel.yaml`** (tag `android-oauth`) — Google cancel on the onboarding
  account step (issue 365 T12, FS-OB2c): Back on the account picker returns to the account step with no
  "Something went wrong" alert and the button enabled; a double tap opens one picker. Android emulator
  with Google Play services and a signed-in Google account; it never picks an account, so it writes
  nothing. The general `test:e2e` run skips the tag. Run it with:
  ```bash
  maestro --device <emulator serial> test apps/mobile/.maestro/flows/onboarding-oauth-cancel.yaml
  ```
- **`flows/onboarding-paywall-verify.yaml`** — onboarding paywall gate (#326), required before a
  build is promoted to production (`docs/runbooks/mobile-release.md`). Part 1 is the email-code
  signup flow; part 2 confirms the account and fails unless the RevenueCat paywall is shown where
  the assigned arm puts it: after account for `commit_first`, on "Open my garage" for
  `garage_first`. Every other onboarding flow closes the paywall with `optional: true`, so they
  pass without one. A release build cannot be forced onto an arm, so the runner repeats the flow
  pinned to each arm until both have a passing run (`MAX_TRIES` per arm, default 6); pass
  `EXPECTED_ARM` to run one arm only. Install an `e2e-simulator-paywall` build (it writes to
  production analytics: owner's go-ahead first). Run it via:
  ```bash
  DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:onboarding-paywall
  ```
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
  portion still assumes an E2E build (`clearState`).
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
- **`flows/onboarding-complete-relaunch.yaml`** — onboarding completion survives a cold start (issue 365
  T14, FS-OB1e). Composes `onboarding.yaml`, then `stopApp` → airplane mode on → `launchApp` (no
  `clearState`) → the tab bar (`tab-home`; a cold start can land on any tab), never "Let's get
  started". Airplane mode is turned off again in `onFlowComplete`. Tagged `android`
  (`setAirplaneMode` is Android-only); the stale-`me` race itself is covered by
  `src/__tests__/navigation-gate.test.tsx`. **Validated on an Android emulator 2026-11-13: fails on
  main (Welcome screen), passes with the fix.** `test:e2e:onboarding-complete-relaunch`.
- **`flows/add-bike.yaml`** — add a motorcycle from the garage. Composes `onboarding.yaml` with
  `NO_BIKE: "true"` (bike setup → "Not sure of the details?" → "I'll add my bike later" → no-bike
  value screen), so the free test user reaches an empty garage and "Add your first bike" opens the
  sheet — with the default onboarding Honda a free user hits the MAX_BIKES paywall instead (correct
  app behaviour). `test:e2e:add-bike`. Every other flow keeps the default (a Honda Africa Twin).
- **`flows/delete-expense.yaml`** — delete an expense. The gesture-only delete (the original client
  complaint) was **fixed**: tapping an expense row now reveals a visible "Delete" button
  (`swipeable-expense.tsx`); the reveal was validated on-device 2026-07-15. Flow drives the button
  path (tap row → Delete → confirm). `test:e2e:delete-expense`.
- **`flows/log-ride.yaml`** — start a ride, record, hold-to-end, save. **Validated end-to-end
  on-device 2026-07-15.** Uses `setLocation` for a GPS fix; ends via a long-press ("Hold to end
  ride") + the minimum-ride guard sheet. Since #365 T05c it uses ids only (`tab-ride-fab`,
  `start-ride-screen`, `start-ride-button`, `ride-hud-root`, `ride-guard-sheet`,
  `ride-guard-variant-default`, `ride-guard-keep`, `ride-guard-end-anyway`;
  `src/features/ride/ride-test-ids.ts`). `test:e2e:log-ride`.
- **`flows/bike-hub-overview.yaml`** — the redesigned bike screen (bike-detail redesign R1): four
  segments, Overview "Log" pill → Log sheet → Note sheet → save, the Notes screen with delete + Undo,
  and the Odometer sheet from the header chip. Needs a backend with migrations 00180–00182 (see
  `features/bike-detail-shell-overview/local-stack.md`). **Authored from source 2026-10-02, pending
  on-device validation.** `test:e2e:bike-hub`.
  The same redesign moved the entry points the older bike flows use — there is no quick-action grid
  and no More (⋯) menu any more. `add-expense`, `complete-maintenance-task`, `edit-maintenance-task`,
  `log-past-work` and `units-display-toggle` now wait for the **"Overview"** segment, switch with
  `id: segment-<overview|service|costs|bike>` and open forms through the action pill
  (`id: action-pill-<segment>`; icon-only except on Overview) or the Log sheet
  (`id: log-option-<expense|task|past_work|note|document>`). `delete-expense`,
  `delete-expense-long-press`, `expense-detail` and `expense-service-record` reach expenses through
  `id: segment-costs` (the expense rows are no longer at the bottom of one long scroll, so the old
  "scroll Documents into view to lift the row clear of the tab bar" step is gone). Task-card
  Edit/Done/Delete render only once the card is expanded — tap the title first. The header odometer
  chip's iOS accessibility label is "Odometer <value> <unit>, tap to update", so assert it by
  `id: bike-header-odometer` with a pattern that accepts both forms. Their updated steps are **not
  yet re-validated on a device**.
- **`flows/whats-new.yaml`** — What's New from Profile (no boot): page 1 of 3, the Road Atlas
  button opens Rider insights with the "Back to What's New" bar, Back returns to the same page
  marked Tried, Next feature moves on, and the modal closes. Composes `onboarding.yaml`. The
  auto-show itself (boot, once per store update) needs a relaunch of an account owed the release;
  it was checked by hand on the simulator 2026-11-10. **Validated on-device 2026-11-10.**
- **`flows/units-display-toggle.yaml`** — odometer unit label (PR #165). Odometer values are stored
  RAW in the user's global unit (no km normalization), so toggling the global Units preference flips
  the bike-hub odometer **label** between **mi** and **km** on the same bike (guards the hardcoded-"km"
  regression class); the raw number itself is unchanged by the toggle. No numeric-input selector, so
  low fragility. **Authored from source 2026-07-16; navigation selectors validated on-device** (Profile
  Units picker, Garage tab, bike card). `test:e2e:units-display`.
- **`flows/onboarding-service-plan.yaml`** and **`flows/onboarding-make-only-service-plan.yaml`** —
  FS-PO1H, Experiment 2 (issue 365 T07a/T07b): the bike onboarding creates gets its OEM service plan.
  The first onboards a Yamaha MT-09 2019 (`BIKE_MAKE`/`BIKE_MODEL`/`BIKE_YEAR` branch of
  `_shared/onboarding-to-account.yaml`), the second a make-only Honda (`MAKE_ONLY: "true"`, the
  "Not sure of the details?" chip). Both assert Home no longer reads "No service due", then Garage →
  bike → `segment-service` → `service-task-card-0`; the make-only flow also finds "Honda schedule".
  Set `DISTANCE_UNIT=mi` (or `km`) for the unit check; an imperial device must read "mi". Needs the
  T07a import on the backend; red on a build without it. **Authored from source 2026-11-13, pending
  on-device validation.** `test:e2e:service-plan`, `test:e2e:service-plan-make-only`.
- **`flows/diagnose-limit-loop.yaml`** — the diagnose "Try Again" limit loop (issue 365 T08,
  FS-PO2a). Seeded and Android only (tag `android`, `setAirplaneMode`): the runner plants a used
  diagnosis (`E2E_SEED_DIAGNOSIS_USED=1`, local stack only), the flow reaches the form offline,
  submits online and asserts the limit panel (`diagnose-limit-panel`, `-see-pro`, `-done`) with
  no "Try Again". iOS is covered by the jest suite `new-limit.test.tsx`. **Validated on the
  Android emulator 2026-11-14** (red on main, green on the fix). `test:e2e:diagnose-limit-loop` on the
  `e2e-android-local` build.

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
via the Maestro **MCP** `run` tool they're written to the **cwd** (`apps/mobile/*.png`), which
`apps/mobile/.gitignore` ignores — they're debug output, never commit them.

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
- **What's New auto-shows only on a later cold start.** It shows once per store update, on a tab's
  root screen, and never in a session that went through onboarding or sign-in. So `onboarding.yaml`
  never meets it; a relaunch of a signed-in account that is owed the release does.
- **Tab-bar labels include the badge in their a11y text.** The Garage tab reads `"Garage, 1 due"`
  (was `"1, Garage"` before the a11y fix) when a badge is present. Always match tabs with a partial
  regex (`.*Garage.*`), never the bare word.
- **Editorial headers split a phrase across `Text` nodes.** "New task." / "Edit task." render as two
  elements, so a single-element regex like `.*New.*task.*` will NOT match. Assert on a single-element
  label or button instead (e.g. `Priority`, `Save task`).
- **Lists truncate; row actions need expanding.** The bike hub shows the top ~5 tasks + a
  **"See all"**; to act on a specific task reliably, open the All Tasks screen and `scrollUntilVisible`
  it. The hub and All Tasks share one row (`bike-hub/service/task-row.tsx`): its check circle
  (a11y "Mark <title> done") completes the task; Edit/Delete appear only after tapping the title.
- **Disambiguate repeated per-row controls.** Every task card has its own `Edit`/`Delete`; anchor the
  tap with `below:`/`rightOf:` (e.g. `tapOn: { text: "Edit", below: { text: "<task title>" } }`).
- **Confirm dialogs reuse the same word as the row button.** A destructive action opens an Alert whose
  `Delete` must be targeted distinctly from the card's `Delete` — use `rightOf: { text: "Cancel" }`.
- **`inputText` can concatenate across fields.** With the custom keyboard, a `tapOn` that doesn't
  actually move focus makes the next `inputText` append to the previous field (seen on sign-in:
  email+password merged). Verify focus / `eraseText` before typing into a second field.
- **Dev client vs E2E build.** `clearState`/`clearKeychain` flows (onboarding) need a
  standalone E2E build (table at the top). To validate *selectors* quickly you can drive the Metro dev client with an
  already-signed-in account (skip the clearState setup) — that's how the edit flow's selectors were
  confirmed.
- **Own your test data.** Create preconditions with distinctive titles (`E2E …`) and delete them at the
  end — flows run against a shared account, so leftover state makes reruns flaky.
- **Visible text ≠ a11y label — always `inspect_screen`.** Several controls render one string but expose
  another to Maestro: the ride "End Ride" button's a11y label is **"End unfinished ride"**; a tab label
  carries its badge (**"Garage, 1 due"**). Match the a11y label (partial regex), not the on-screen word.
- **Some controls are gestures, not taps.** Ending a ride is a **long-press** ("Hold to end ride" →
  `longPressOn`), and deleting an expense is swipe/long-press (see delete-expense's blocked note).
- **A `@gorhom/bottom-sheet` hides its content from the a11y tree by default.** The sheet is one
  `accessible` element ("Bottom Sheet"), so its buttons are invisible to Maestro and VoiceOver. Pass
  `accessible={false}` and give the buttons testIDs, as the ride guard sheet does
  (`src/features/ride/ride-guard-sheet.tsx`). Prefer a real selector over a `point:` tap whenever
  `inspect_screen` exposes one.
- **GPS-dependent flows need `setLocation`.** The ride pre-flight GPS check and recording need a fix;
  set one at the top of the flow (a stationary sim logs ~0 distance, which still saves).

## Verified on a local stack (2026-10-07)

All ten bike flows (`add-expense`, `complete-maintenance-task`, `bike-hub-overview`,
`units-display-toggle`, `delete-expense`, `delete-expense-long-press`, `expense-detail`,
`expense-service-record`, `edit-maintenance-task`, `log-past-work`) were run end to end on an
iOS 27 simulator against a Release build pointed at a local Supabase + API
(`features/bike-detail-shell-overview/local-stack.md`). Lessons that shaped the selectors:

- **Text matching ignores case.** `".*Garage.*"` matched Home's "Today in your garage." and
  `".*Profile.*"` matched "Complete your bike profile". Anchor tab taps: `"Garage(,.*)?"`.
- **iOS merges a pressable's child texts into one label** ("E2E Complete Me, HIGH",
  "No expenses yet, Track your fuel…"). Match active task rows with `"${TITLE}(,.*)?"` (keeps an
  edited title distinct) and `".*${TEXT}.*"` when the title is not first. A completed (history)
  task row (`HistoryTaskRow`, bike hub History and All Tasks → Completed) leads with the
  completion date — "Oct 9 2026. E2E Service Record Link. At 12,600 km. €88.00" — so always match
  it as `".*${TITLE}.*"`; a title-anchored pattern never matches it.
- **Onboarding must pick a model.** `complete_onboarding` creates the bike only when make, model
  and year are all set; a make-only "Add to my garage" leaves the garage empty. Tap the model
  chip directly — typing a query makes the search field's value match too.
- **Consent screen** ("Help shape MotoVault") follows Welcome where the country rule asks; the
  flow declines it.
- **Review soft-ask** ("Enjoying MotoVault?" → "Help us improve?") can follow any save and
  overlays the hub; dismiss "Not really" then "Not now" (both optional).
- **Alerts on iOS 27**: wait for the message before tapping, and beware an expanded task card's
  own "Delete" under the alert matching `rightOf: Cancel`.
- **Build**: a sim build needs ad-hoc signing (`CODE_SIGN_IDENTITY=-`, `CODE_SIGNING_ALLOWED=YES`)
  or SecureStore cannot persist the session ("Your session has expired" right after sign-in), and
  `SENTRY_DISABLE_AUTO_UPLOAD=true` or the bundle phase fails without a Sentry token.
