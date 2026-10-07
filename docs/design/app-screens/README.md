# App screens — screenshot library

Screenshots of every mobile screen, grouped by section, as input for redesign work. Each section folder has a `screenshots/` subfolder; audits sit next to it.

## Structure

| Folder | Covers (routes under `apps/mobile/src/app`) | Status |
|---|---|---|
| `01-onboarding/` | `(onboarding)/*` | empty |
| `02-auth/` | `(auth)/*` | empty |
| `03-home/` | `(tabs)/(home)` | 3 captures (top + scroll) |
| `04-discover/` | `(tabs)/(discover)`, `route/*`, `routes/*` | empty |
| `05-garage/01-garage-list/` | `(garage)/index` | 2 captures |
| `05-garage/02-bike-detail/` | `(garage)/bike/[id]`, `(modals)/recalls` | 10 captures + 2 audits |
| `05-garage/03-maintenance-tasks/` | `bike-tasks`, `add-/edit-maintenance-task`, `complete-task` | 10 captures + code audit |
| `05-garage/04-expenses-analytics/` | `expense-dashboard`, `add-expense`, `expense-detail` | 9 captures |
| `05-garage/05-documents/` | `add-document`, `document/[id]`, `manage-document-categories` | empty |
| `05-garage/06-health-report/` | `health-report` | 1 capture |
| `05-garage/07-add-edit-bike/` | `add-bike`, `edit-bike` | 4 captures (edit only) |
| `06-ride/` | `(modals)/start-ride`, `ride-hud`, `ride-summary`, `ride-detail`, `ride-flyover` | empty |
| `07-trips/` | `create-trip`, `trip-detail`, `trip/*`, group rides | empty |
| `08-diagnose/` | `(tabs)/(diagnose)/*` | empty |
| `09-learn/` | `(tabs)/(learn)/*` | empty |
| `10-profile/` | `(tabs)/(profile)/*` | empty |
| `11-carplay/` | `(modals)/carplay/*` | empty |

## Naming

`NN-<screen-or-state>[-NN].png`. The first number orders screens within a section; a trailing number is the scroll position (01 = top).

## Bike detail run (2026-10-02)

- `05-garage/02-bike-detail/visual-audit.md` — what the screens show, 34 findings with screenshot references, open design questions.
- `05-garage/02-bike-detail/code-audit-information-architecture.md` — section inventory, navigation map, analytics entry points.
- `05-garage/03-maintenance-tasks/code-audit-maintenance-tasks.md` — task model, sorting, units, verdict on rider feedback.

## How the captures were made

- Account: `test@test.com` (Honda Africa Twin 2022, metric, EUR), dark appearance, status bar overridden to 9:41.
- Simulator: `worktree-fix-ios27-scene-lifecycle` (iOS 26.3) with the 3.19.1 dev client, JS from Metro on `main`, API pointed at production (`EXPO_PUBLIC_API_URL=https://motowise.onrender.com/graphql npx expo start --dev-client`).
- Driven with the Maestro MCP (`takeScreenshot` to an absolute path). `axe` 1.7.1 does not work with the current Xcode.
- The 3.20.0 simulator build in `apps/mobile/ios/build` cannot be used: it was built without code signing, has no embedded entitlements, and so cannot store the session in the keychain (sign-in drops back to onboarding).
- The dev-menu "Tools button" is switched off on that simulator so the floating gear does not appear in captures.

Not yet captured for the garage: light theme, imperial units, empty states (no tasks, no expenses), a bike with documents, the Upcoming/Overdue/Completed filters, Log past work, OEM import, add bike.
