# E2E tests

Authored, committed regression coverage for user-facing flows. Web = Playwright, mobile = Maestro.
(Ad-hoc, per-change device checks stay on XcodeBuildMCP + axe — see memory `project_xcode_ui_automation`.
Maestro is the *authored regression suite*, the mobile counterpart of the web Playwright suite.)

## Web — Playwright (`apps/web/e2e/`)

Config: `apps/web/playwright.config.ts` — `baseURL` `http://localhost:3000`, `webServer` auto-starts
`pnpm --filter @motovault/web dev` (reused locally, fresh in CI), Chromium, retries 2 in CI.

```bash
pnpm --filter @motovault/web exec playwright test          # run
pnpm --filter @motovault/web exec playwright test --ui      # interactive
pnpm --filter @motovault/web exec playwright test e2e/foo.spec.ts --repeat-each=10  # flake hunt
```

Conventions:
- Prefer accessible locators — `getByRole`, `getByLabel`, `getByText` — over `data-testid`.
- Name tests `should {behavior} when {condition}`.
- Each test independent; never depend on another test's end state.
- No `waitForTimeout(...)` — wait for a condition (`waitForResponse`, locator auto-wait, `toBeVisible`).
- Mock external services with `page.route('**/api/external/**', route => route.fulfill({...}))`.

```ts
import { expect, test } from '@playwright/test';

test.describe('Route discovery', () => {
  test('should show route cards when a region is selected', async ({ page }) => {
    await page.goto('/explore');
    await page.getByRole('button', { name: 'Alps' }).click();
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
```

## Mobile — Maestro (`apps/mobile/.maestro/`)

Setup is a one-time install (see `apps/mobile/.maestro/README.md`): the Maestro CLI + a JDK,
and a booted iOS simulator / Android emulator running the app.

```bash
# Terminal 1 — start Metro + the app on a device
pnpm --filter @motovault/mobile ios      # or android

# Terminal 2 — run the flows against the booted device
pnpm --filter @motovault/mobile test:e2e
```

Authoring — get **real** selectors from the running app before writing a flow (never invent
them from a screenshot). Use the Maestro MCP: `list_devices` → `inspect_screen` (read the view
hierarchy) → `run` (try inline). Copy visible text verbatim.

Flow conventions:
- Cold-start for idempotency: `stopApp` then `launchApp` (or `openLink` deep link) so a flow passes
  from any prior state.
- Assert on visible text / accessibility labels; text match is whole-string, case-insensitive regex —
  anchor with `.*` when native controls add wording.
- Unlabeled icon buttons: add a real `accessibilityLabel` (an a11y win, not a test-only hack) and
  target it, or tap by `point:`.
- One flow per journey; name the file after it (`log-a-ride.yaml`, `add-bike.yaml`).
- Dark-themed modals use `fullScreenModal` (see memory `feedback_formsheet_modals`).

```yaml
appId: ${APP_ID}
---
- stopApp
- launchApp
- assertVisible: "Garage.*"
- tapOn: "Add bike.*"
- assertVisible: "Make"
```

When to write one: new user-facing mobile screen or navigation flow, or a task with an `(E2E)`
acceptance criterion targeting `apps/mobile`. Test the critical path first, then edge cases.
