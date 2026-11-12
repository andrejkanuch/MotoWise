---
title: "[#365 T04b] Onboarding navigation events: onboarding_back, onboarding_welcome_mounted, onboarding_resumed+, gate_routed, auth_session_lost"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 6
task_id: T04b
depends_on: [T01]
phase: P0
size: M
release_path: "Release A store build 3.29.0 (D17)"
---

## Context
#365, plan §3 T04 (split b), specs FS-OB1b/c/d/e/f, FS-PO13. Data gates T14b, T15b, T38.

## Why
Four onboarding "reset" mechanisms (RC-B…RC-F) cannot be separated in events [SOURCE: R1 §2.2 Q4, Q9]. Android 28/201, iOS 14/72 starters made ≥ 3 back steps ≤ 5 s apart (60 d) [SOURCE: V1-q15; R1 Q8]; 12 saw Welcome again with progress, 6 on 3.26.0 [SOURCE: V1-q37]; 10/292 completers relapsed [SOURCE: V1-q18]. The RC-D trigger is now known (Back out of the onboarding root + warm launch, V4 b3); `onboarding_welcome_mounted.reason` should tell `'remount'` in a fresh activity apart from `'back'`.

## What to change
| Event | Properties | Where |
|---|---|---|
| `onboarding_resumed` (extend) | `resumed_from_screen`, `away_s`, `cold_start`, `pending_code_step`, `had_session` | `app/(onboarding)/index.tsx:82-96`; persist `lastViewedScreen`/`lastViewedAt` on every step view in `stores/onboarding.store.ts` (fields only, no migration needed if optional — else part of T13a's v10) |
| `onboarding_back` | `from, to, trigger: hardware\|gesture\|button, ms_on_screen` | `hooks/use-onboarding-flow.ts` |
| `onboarding_welcome_mounted` | `reason: initial\|back\|remount, had_progress` | `app/(onboarding)/index.tsx:47-57` |
| `gate_routed` | `group, onboarding_completed_source: local\|me_cache\|me_network\|none, me_age_s` (once per cold start) | `app/_layout.tsx:453-467` |
| `auth_session_lost` | `during_onboarding, last_step` | `app/_layout.tsx:579-711`, before `resetForSignOut()` (`:698`) |

## How
Jest per event (one fire per action, typed props) under `apps/mobile/src/__tests__/` and `app/(onboarding)/__tests__/`. If `lastViewedScreen` needs a persisted field, add it as optional with a default so v9 state loads unchanged (T13a owns the v10 migration).

## Acceptance criteria
- [ ] Jest passes; `pnpm verify:mobile` green; schema doc updated.
- [ ] `gate_routed` fires once per cold start (test).
- [ ] After 3.29.0 go-live all five events appear within 7 days (`auth_session_lost` may be rare).

## Verification
`SELECT event, uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event IN ('onboarding_back','onboarding_welcome_mounted','gate_routed','auth_session_lost','onboarding_resumed') AND {EXCL} GROUP BY event`.

## Friction spec
FS-OB1b/d/e/f measurement. Repro (Android emulator, T00 Android E2E build): to account step, press Back ×3 quickly. Expected: three `onboarding_back {trigger:'hardware', ms_on_screen < 5000}`. Automated check: jest (CI); Maestro not used (events are not asserted in flows).

## Production metric
- FS-OB1b (plan §5, revised): starters with ≥ 3 `onboarding_back` where `ms_on_screen ≤ 5000` and `trigger IN ('hardware','gesture')`; baseline (`$screen` method, `validation/V1-metrics.md` §3.2) Android 28/201, iOS 14/72 [SOURCE: V1-q15].
- `gate_routed` by `onboarding_completed_source`: decision input for T14b (relapses with `me_cache`).
- Tiles in T03b; read 4 weeks after 3.29.0 go-live per platform. Annotate per T03a.

## Release
JS only → Release A 3.29.0 (owner rule D17; no OTA).

## Dependencies
- Blocked by: T01.
- Blocks: T11, T13a, T14, T15, T19a, T19b, T18, T14b, T15b, T38.

## Out of scope
Behaviour changes (T11–T20).

## Constraints
No UI change; no PII; do not change persisted-store shape incompatibly (old v9 state must load).
