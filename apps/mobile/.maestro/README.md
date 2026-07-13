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
`takeScreenshot:` land in `~/.maestro/tests/<run>/`.
