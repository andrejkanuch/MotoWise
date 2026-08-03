# Native (build-only) Sentry issues — investigation

**Date:** 2026-07-30
**Branch:** `investigate/native-sentry-issues` (off `main` @ `4bbd7cfb`)
**Scope:** the Sentry issues that a JS-only OTA cannot fix — Android Compose crashes (`25`, `1V`) and the iOS app-hangs (`1W`, `2C`, `29`). The high-volume JS/backend issues (`1J`, `1M`, `27`, `W/2F/2G`) were already fixed in PRs #184/#185.

## TL;DR

None of these are bugs in **our** code. `25` and `1V` are crashes **inside the RevenueCat Paywall library** (`com.revenuecat.purchases.ui.revenuecatui`), driven by the RC **dashboard paywall config** + **RC SDK version**; the app-hangs are native/environmental. All of them last fired on the **old `3.13.0+71` build** (Compose crashes) or as one-off native stalls, and **none appear in the last 14 days**. They are effectively resolved on current builds — there is **no in-repo code change to make**. Actions are RC-dashboard hygiene + Sentry triage.

## Evidence

- Our app ships **no Kotlin/Compose UI**: the only `.kt` files are `MainActivity.kt` / `MainApplication.kt` (standard Expo scaffolding). Nothing in `apps/mobile/src` renders a paywall in native Compose — RC does.
- RC SDK is current: `react-native-purchases` / `react-native-purchases-ui` = **10.4.2**.
- Current **published** paywalls are **Paywall V3 / V4** (`pwc2b2f4ae…`, `pwa365e62b…`), published after the 2026-07-12 padding fix. The crashes below were on the *older* paywall config.

## Issue-by-issue

### MOTO-VAULT-REACT-NATIVE-25 — `IllegalArgumentException: Padding must be non-negative`
- **Where:** `PaywallActivity → StyleFactory.createStackComponentStyle → PaddingKt.toPaddingValues → PaddingValues.<init>` (RC library). `level: fatal`, uncaught → app crash.
- **Cause:** a **negative padding/margin** value in the RC Paywalls-v2 dashboard config; RC's Compose renderer rejects it at measure time. This is the documented RC-Paywalls-v2 negative-margin Android crash.
- **Status:** 64 events / 17 users, all on `com.motovault.app@3.13.0+71`. **Last seen 2026-07-11** — the day before the dashboard fix (V3/V4 republished with padding ≥ 0 on 2026-07-12). No events since. **Resolved by config.**
- **In-repo fix:** none possible (config lives in the RC dashboard).

### MOTO-VAULT-REACT-NATIVE-1V — `IllegalStateException: Vertically scrollable component was measured with an infinity maximum height`
- **Where:** `PaywallActivity → Scaffold → … → ScrollNode → checkScrollableContainerConstraints` (RC library). `level: fatal`, uncaught → app crash.
- **Cause:** the RC paywall's own layout put a fill-height / unbounded component inside a vertically-scrollable container (a `fill`-sized stack inside the paywall scroll). This is produced by the paywall **component config** + the RC SDK's Compose renderer, not our code.
- **Status:** 111 events / 9 users, all on `3.13.0+71`. First seen 2026-06-01, **last seen 2026-07-16**; none in the last 14 days. Stopped after the V3/V4 republish + RC SDK v10 line (shipped in 3.15.0+).
- **In-repo fix:** none possible. Residual action: in the RC dashboard, confirm the **published** V3/V4 paywalls have no `fill`-height component nested inside a scrolling stack (RC's editor can still express this).

### App-hangs — `1W`, `2C`, `29` (iOS)
- `1W` Fatal App Hang (main thread ≥ 2000 ms, `UIApplicationDelegate.main`) — 4 events / 2 users.
- `2C` App Hang 3.3–4.1 s (`LinearGradientLayer.display`) — 1 event / 1 user.
- `29` App Hang 3.8–4.6 s (`mapbox::maps::StyleManager::isStyleLoadingFinished`) — 1 event / 1 user.
- **Cause:** native main-thread stalls during first paint of a gradient layer / Mapbox style load, on cold start. Environmental (device/thermal/first-load), extremely low volume, no single reproducible in-repo trigger. `2C`/`29` are one-offs.
- **In-repo fix:** none warranted now. If `1W` grows, profile cold-start main-thread work (gradient + Mapbox style init) and defer/one-frame-delay heavy first-paint work — track separately if volume rises.

## Recommended actions (no code change)

1. **RC dashboard (owner):** on published Paywall **V3** and **V4**, verify (a) every padding/margin ≥ 0 (guards `25`), and (b) no `fill`-height component sits inside a scrolling stack (guards `1V`). Both are already believed clean since the crashes stopped — this is confirmation, not a fix.
2. **Sentry triage:** resolve `25` and `1V` as *resolved* (not ignored) so Sentry **auto-reopens** them if they ever recur on a new release — that's the regression tripwire. Leave the app-hangs open but low-priority; revisit only if `1W` climbs.
3. **Keep RC SDK current:** staying on the latest `react-native-purchases` v10 line (currently 10.4.2) carries the upstream Compose measurement fixes; pick up future patches in the normal build cadence.

## Why there's no PR-able code fix
The MotoVault app presents RevenueCat's paywall as a native `PaywallActivity`; a crash inside that Activity's Compose measure pass is an uncaught native exception that a JS error boundary cannot catch. The levers are the RC paywall **config** and the RC **SDK version** — both already addressed on current builds. This branch therefore carries the investigation record only; there is nothing in `apps/`/`packages/` to change.
