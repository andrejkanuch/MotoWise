---
title: "[#365 T29] Discover first open: no unprompted location dialog; skeleton, 10 s timeout and Retry"
labels: [enhancement, area:mobile, activation-365]
order: 42
task_id: T29
depends_on: [T00, T05d, T06]
phase: P1
size: M
release_path: "Release A 3.29.0 (raised by the validation); if it misses the Release A cut, it is the first P2 task merged for Release B (launch-day both-arm change, ledger, mechanical metrics only)"
---

## Context
#365, plan §3 T29, §3A.0 rule 7, specs FS-PO7, FS-PO8, D12 (both arms, before the slot — Release A is earlier and keeps it out of the Exp 1 launch day). **Priority raised on 2026-11-12** by the production validation (`validation/V1-metrics.md` FS-PO8, plan §11): from an Android polish item to a likely first-session friction for nearly every Android rider who opens Discover.

## Why
- Discover asks for location on mount (`app/(tabs)/(discover)/index.tsx:503`, `hooks/use-user-country.ts:30-45`); PO8's "Descargar mapas" is not an app string [SOURCE: R4 §3.3, Q-R4-11]; 2 replays of slow/stuck Discover [SOURCE: R6 F-PO7].
- **Validation (V1-q36, 60 d):** on a rider's first Discover visit, `Application Backgrounded` follows within 2 s for **42 of 43 Android riders** (median 0 s), against **1 of 59** on the first Garage view and 3/58 on Profile, and **0 of 28** on iOS. That is the signature of an OS dialog on Discover open (likely the location permission, ≈ 70%; the dialog type is confirmed on a device by T06 item 8).

## What to change
`useUserCountry` disabled until a "Use my location" tap in "Near you" (`components/discover/near-you-section.tsx`) with a reason line; skeleton cards while loading; error + Retry after 10 s; `screen_load_timed {screen:'discover'}`. If T06 item 8 shows a different prompt (e.g. Play services), fix its source the same way: nothing modal on Discover open without a rider action. testIDs `near-you-use-location`, `trip-card-<n>`, `discover-skeleton`, `discover-retry`.

## How
Jest `hooks/__tests__/use-user-country.test.ts` (no permission request on mount). Maestro `discover-first-open-android.yaml` (+ Spanish locale run).

## Acceptance criteria
- [ ] T06 item 8 result (dialog type on a device) referenced in the PR.
- [ ] Red run on main (OS dialog / app backgrounded on first open), green after; light/dark; all app locale files (`pnpm check:i18n`).
- [ ] Ledger: both-arm row with its go-live date (Release A; or Release B launch-day row if it slips).

## Verification
Maestro logs (local, Android emu with the T00 Android E2E build; iOS sim for the permission assertion).

## Friction spec
FS-PO7/PO8. Repro: Android emulator, cold start, new account, Discover within 10 s (Spanish locale run too). Expected: no dialog without a rider action; cards ≤ 3 s or skeleton; error + Retry at 10 s. Automated check: maestro (local) `tapOn: {id: tab-discover}` → wait 3 s → `assertNotVisible: "Allow.*location|While using the app|Only this time|Descargar.*"` → `assertVisible: {id: near-you-use-location}` → `extendedWaitUntil: {visible: {id: "trip-card-0"}, timeout: 8000}`; latency is guard only. FS-PO8 is red first on Android.

## Production metric
FS-PO7: `quantile(0.9)(toFloat(properties.ms_to_content))` and non-content share on `screen_load_timed {screen:'discover'}` by `{REL}`; baseline not measurable before T05d; target p90 < 3,000 ms, non-content < 1%. FS-PO8: first Discover visits with `Application Backgrounded` ≤ 2 s after `discover_tab_viewed` — SQL `validation/V1-metrics.md` §3.6 (with the Garage control). **Baseline Android 42/43, iOS 0/28, Garage control 1/59** [SOURCE: V1-q36]; target Android ≤ 5% (Garage-control level). Tiles "FS-PO7", "FS-PO8". Annotate the release that ships it.

## Release
Release A (`FS-PO7: 2`, `FS-PO8: 2`); if it slips, Release B (`3`).

## Dependencies
- Blocked by: T00 (test environment), T05d, T06 (item 8).
- Blocks: T18 (soft: Release A target; T18 does not wait for it).

## Out of scope
Trip planner changes.

## Constraints
D12; light/dark; never India targeting in regional content.
