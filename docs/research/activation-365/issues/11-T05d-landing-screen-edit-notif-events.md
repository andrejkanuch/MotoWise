---
title: "[#365 T05d] post_onboarding_landed, screen_load_timed (discover), garage_bike_edited, F14 route constant, task-completion source, tab/checklist testIDs"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 11
task_id: T05d
depends_on: [T01]
phase: P0
size: M
release_path: "Release A store build 3.29.0 (D17)"
---

## Context
#365, plan §3 T05 (split d), §3A.4, board instrumentation #1, #5, #7, #8 [SOURCE: board/99-synthesis.md:222-231]. Specs FS-OB6, FS-PO6, FS-PO7, FS-PO17, FS-R2-3, S3.

## Why
No first-landing event [SOURCE: evidence pack §9]; bike edits untracked [SOURCE: R2 C14]; S3 engaged return depends on a route list that silently breaks on renames [SOURCE: board/06-experimentation-analyst.md:87]; `maintenance_task_completed` has no `source` [SOURCE: board/05-rider-voice.md:162].

## What to change
- `post_onboarding_landed {screen, onboarding_variant, ms_since_cta, overlay}` on first focus of a `(tabs)` route after completion (`hooks/use-screen-tracking.ts` + once-flag).
- `screen_load_timed {screen: 'discover', ms_to_content, outcome}` — Discover only (FS-PO7 needs it; `diagnosis_result` and `home` dropped in doc review 2026-11-12).
- `garage_bike_edited {changed_fields, from_capture_level, source, schedule_refreshed_count}` (`app/(tabs)/(garage)/edit-bike.tsx:195-305`); `oem_schedule_imported.context = 'bike_hub'` (`components/bike-hub/shell/use-bike-actions.ts:52-97`).
- `source` on `maintenance_task_completed`.
- `config/engaged-routes.ts`: the F14 non-engaged route list as a constant + jest test that every entry still resolves to a registered route.
- Event-name constant `landing_sheet_shown {sheet, ms_since_landed, queue_position}` (fired by T16b).
- testIDs: `tab-home`, `tab-garage`, `tab-diagnose`, `tab-discover`, `tab-profile`, `checklist-row-<id>` (`components/home/onboarding-checklist.tsx:153-182`), `garage-add-bike-header`, `segment-service`, `service-task-card-<n>`, `rides-empty-cta`, `diagnose-new`.

## How
Jest for each event; `inspect_screen` on both platforms for each id (paste output).

## Acceptance criteria
- [ ] Jest passes incl. the engaged-routes test; `pnpm verify:mobile` green.
- [ ] Every listed testID visible on iOS + Android.
- [ ] Events listed in `read-data-schema` within 7 days of 3.29.0 go-live.

## Verification
`SELECT event, uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event IN ('post_onboarding_landed','screen_load_timed','garage_bike_edited') AND {EXCL} GROUP BY event`.

## Friction spec
S3 guard: repro — rename a route in the engaged list; expected — the jest test fails. Automated check: jest (CI) `config/__tests__/engaged-routes.test.ts`.

## Production metric
S3 engaged return (board/06 Appendix B with the constant) by `{REL}`; baseline completers 37/367 (10.1%) [SOURCE: board/06 F14]; harm check only. FS-OB6(b): p90 `post_onboarding_landed.ms_since_cta`, target < 3,000 ms after T16a. Tiles in T03b. Annotate per T03a.

## Release
JS only. Events and testIDs ship in Release A 3.29.0 only (owner rule D17; TR0 removed by D17); data starts at 3.29.0 go-live per platform, first sessions included.

## Dependencies
- Blocked by: T01.
- Blocks: T10, T16a, T16b, T22, T28, T29, T30, T18.

## Out of scope
Behaviour changes on these screens; `notification_permission_status` and `screen_load_timed` for screens other than Discover (dropped, doc review 2026-11-12).

## Constraints
No PII; light/dark n/a (no UI).
