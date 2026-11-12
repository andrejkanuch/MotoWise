---
title: "[#365 T29] Discover first open: no unprompted location dialog; skeleton, 10 s timeout and Retry"
labels: [enhancement, area:mobile, activation-365]
order: 42
task_id: T29
depends_on: [T05d, T06]
phase: P2
size: M
release_path: "Release B 3.30.0 — launch-day both-arm change (ledger), mechanical metrics only"
---

## Context
#365, plan §3 T29, §3A.0 rule 7, specs FS-PO7, FS-PO8, D12.

## Why
Discover asks for location on mount (`app/(tabs)/(discover)/index.tsx:503`, `hooks/use-user-country.ts:30-45`); PO8's "Descargar mapas" is not an app string and the session backgrounded 0.37 s after `discover_tab_viewed` (likely OS/Play-services dialog, 35%) [SOURCE: R4 §3.3, Q-R4-11]; 2 replays of slow/stuck Discover [SOURCE: R6 F-PO7].

## What to change
`useUserCountry` disabled until a "Use my location" tap in "Near you" (`components/discover/near-you-section.tsx`) with a reason line; skeleton cards while loading; error + Retry after 10 s; `screen_load_timed {screen:'discover'}`. testIDs `near-you-use-location`, `trip-card-<n>`, `discover-skeleton`, `discover-retry`.

## How
Jest `hooks/__tests__/use-user-country.test.ts` (no permission request on mount). Maestro `discover-first-open-android.yaml` (+ Spanish locale run).

## Acceptance criteria
- [ ] Red run on main (OS location dialog on first open), green after; light/dark; 7 locales.
- [ ] T06 item 8 result referenced; ledger launch-day both-arm row.

## Verification
Maestro logs (local, Android emu; iOS sim for the permission assertion).

## Friction spec
FS-PO7/PO8. Repro: Android emulator, cold start, new account, Discover within 10 s (Spanish locale run too). Expected: no dialog without a rider action; cards ≤ 3 s or skeleton; error + Retry at 10 s. Automated check: maestro (local) `tapOn: {id: tab-discover}` → wait 3 s → `assertNotVisible: "Allow.*location|While using the app|Only this time|Descargar.*"` → `assertVisible: {id: near-you-use-location}` → `extendedWaitUntil: {visible: {id: "trip-card-0"}, timeout: 8000}`; latency is guard only.

## Production metric
FS-PO7: `quantile(0.9)(toFloat(properties.ms_to_content))` and non-content share on `screen_load_timed {screen:'discover'}` by `{REL}`; baseline not measurable before T05d; target p90 < 3,000 ms, non-content < 1%. FS-PO8: first Discover visits with `Application Backgrounded` ≤ 2 s after `discover_tab_viewed` (verbatim `R4…:478-488`); baseline from T02; target ~0. Tiles "FS-PO7", "FS-PO8". Annotate Release B.

## Release
Release B; `FS-PO7: 3`, `FS-PO8: 3`.

## Dependencies
- Blocked by: T05d, T06 (item 8).
- Blocks: T35.

## Out of scope
Trip planner changes.

## Constraints
D12; light/dark; never India targeting in regional content.
