# P1.2 — Usability Audit (discover + detail sheets)

**Branch:** `feat/impeccable-discover-redesign`
**Date:** 2026-04-16
**Source:** Postnikova §User Testing (p.76-78)

## Scope

Small, independent polish patches, each shippable on its own.

1. **Destructive color enforcement** — verified; `StopListItem`, `handleLeave`, `deleteBike` already use `palette.danger500` / `style: 'destructive'`. No changes required.
2. **Duplicate CTAs audit** — single FAB "Plan Trip" on discover. No duplicate. No change.
3. **Map-marker action sheet** — tapping a route pin on the discover map immediately pushes `route-detail`, which kills serendipity (can't copy coords, can't see which route it is). Add an iOS-style action sheet: *View details · Copy coordinates · Cancel*.
4. **Inline hint primitive** — introduce `<InlineHint>` with `ⓘ` icon + one-line text, replacing ad-hoc warning boxes where the content is advisory (not blocking). Keep existing warning boxes for blocking/alert copy.
5. **Sticky primary on long scrolls** — already solved by P1.1 `RideThisStickyCta`.
6. **Onboarding length** — no change; current onboarding is 4 screens.

## Implementation

### Marker action sheet
`ActionSheetIOS` on iOS, `Alert.alert` on Android. Copy written as `"<lat>, <lng>"` to clipboard via `expo-clipboard`.

### `<InlineHint>`
```
<InlineHint>Fill up before the mountain pass — next station is 140 km.</InlineHint>
```
Renders as a thin row: `ⓘ  text…` with muted color, inherits theme. No background pill (distill, don't add noise). Exported from `components/shared`.

## Acceptance

- Tap non-cluster route pin → action sheet appears → "View details" opens existing route-detail; "Copy coordinates" toasts & pastes correctly.
- `InlineHint` component renders dark/light with palette tokens only.
- Lint, typecheck, tests pass.

## Non-goals

- Replacing every warning box repo-wide. InlineHint is available; we leave the migration to future PRs when touching those screens.
- Coachmarks / first-use tooltips (out of scope here).
