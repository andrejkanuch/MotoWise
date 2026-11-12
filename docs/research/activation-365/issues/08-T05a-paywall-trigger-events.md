---
title: "[#365 T05a] Paywall events: trigger auto|rider_tap, gate_policy, session index; paywall_suppressed + limit_sheet_viewed constants"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 8
task_id: T05a
depends_on: [T01]
phase: P0
size: S
release_path: "TR0 per-runtime OTA + Release A"
---

## Context
#365, plan §3 T05 (split a), specs FS-PO3, S5, FS-PO2c. Needed before T21's cap can be read.

## Why
Paywall events cannot tell automatic from rider-tapped presents [SOURCE: R3 F-R3-6]. On 3.26.0, 9/22 gate-paywall sessions had ≥ 2 views [SOURCE: R3 Q10]; first-hour ≥ 2 post-onboarding requests 8/121 [SOURCE: Q-P8].

## What to change
On `paywall_present_requested`, `paywall_viewed`, `paywall_result` (`lib/subscription.ts:133-149`): `trigger: 'auto'|'rider_tap'`, `gate_policy: 'none'` (T21 sets `'capped_v1'`), `session_paywall_index`, `minutes_since_onboarding_completed`. Add event names `paywall_suppressed {feature, surface, reason}` and `limit_sheet_viewed {feature, surface}` to `AnalyticsEvent` + `packages/analytics/src/events.ts` (fired by T21).

## How
`presentPaywall` gains an optional `trigger` (default `'auto'`); explicit Upgrade surfaces (`profile_subscriptions_row`, `profile_pro_banner`) pass `'rider_tap'`. A per-session counter in memory (reset on cold start or > 30 min background). Jest: extend `apps/mobile/src/lib/__tests__/subscription.test.ts`.

## Acceptance criteria
- [ ] 100% of paywall events carry `trigger` and `gate_policy` (test).
- [ ] Onboarding paywall events unchanged except the added props.
- [ ] `pnpm verify:mobile` green.

## Verification
`SELECT toString(properties.trigger) t, count() FROM events WHERE event IN ('paywall_present_requested','paywall_viewed') AND timestamp > now() - INTERVAL 7 DAY AND toString(properties.ota_update_id) = '<TR0 id>' AND {EXCL} GROUP BY t` → no null `t`.

## Friction spec
FS-PO3 (measurement). Repro: free user, Garage "Add a Bike" twice. Expected: two `paywall_present_requested {trigger:'auto', session_paywall_index:1,2}`. Automated check: jest (CI).

## Production metric
FS-PO3: sessions with ≥ 2 `paywall_viewed {trigger:'auto'}` same feature (verbatim `R3…:473-485`) by `{REL}`. Baseline 3.26.0 9/22 sessions [SOURCE: R3 Q10]. Target after T21: 0. Tile "FS-PO3 — repeated automatic paywalls". Annotate per T03a.

## Release
JS only → TR0 + Release A.

## Dependencies
- Blocked by: T01.
- Blocks: T21, TR0.

## Out of scope
Any cap (T21); onboarding paywall behaviour.

## Constraints
`onboarding_paywall_2026q4` and RC `expd7c1d56904` untouched; properties only.
