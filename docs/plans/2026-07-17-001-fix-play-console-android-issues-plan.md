---
title: "fix: Resolve 4 Play Console Android advisories (release 77 / 3.15.0)"
type: fix
date: 2026-07-17
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
---

# fix: Resolve 4 Play Console Android advisories (release 77 / 3.15.0)

**Target repo:** MotoWise monorepo — all work in `apps/mobile`.

---

## Summary

Google Play Console flagged four Android advisories against **release 77 (3.15.0)**. Investigation shows the codebase has already moved on `3.17.0` and partially addressed two of them, so this plan is scoped to the *real remaining gap* per issue, not the raw report text:

1. **Deprecated edge-to-edge APIs** — originates in **RN 0.85 core + Expo**, not app code. The app never calls the deprecated status/nav-bar color setters directly. Actionable work is hygiene + adopting declarative system-bar config; full resolution is gated on an upstream RN/Expo bump. **Low actionability.**
2. **Orientation restriction** — `orientation: 'portrait'` in `app.config.ts` emits `android:screenOrientation`. Android 16 ignores it on large screens; the warning clears only by removing the restriction. **One decision with a real phone-UX trade-off.**
3. **Bitmap image optimization** — home/garage/bike screens **already use `expo-image`**. The genuine memory risk is the **diagnostic flow**, which renders full-resolution picked/camera photos through raw React Native `<Image>` (Fresco, no downsampling). Migrate those to `expo-image`. **Real, safe win.**
4. **R8 optimization** — R8 compatibility mode (`enableMinifyInReleaseBuilds` + `enableShrinkResourcesInReleaseBuilds`) already shipped in release 77. Play wants **R8 full mode** + **optimized resource shrinking** + **AGP 9.0+**. Add the two gradle flags via a config plugin; AGP 9 is owned by the Expo SDK and is **deferred**. **Config + smoke-test.**

Because native config is managed by Expo (`app.config.ts` / config plugins), the `android/` directory is gitignored and regenerated each prebuild — all changes land in `app.config.ts` and `plugins/*.js`, never in raw Gradle/manifest files.

---

## Problem Frame

**Who is affected:** Android users (especially on large-screen/foldable devices from Android 16), and the app's Play Console technical-quality score / store standing.

**Current state (verified against `apps/mobile` @ 3.17.0):**
- `app.config.ts` sets `orientation: 'portrait'` (top-level) and no `androidStatusBar`/nav-bar color config.
- `expo-build-properties.android` sets `enableMinifyInReleaseBuilds: true` + `enableShrinkResourcesInReleaseBuilds: true`, `compileSdkVersion: 36`, `targetSdkVersion: 36`.
- `plugins/with-gradle-memory.js` already demonstrates the `withGradleProperties` config-plugin pattern for writing `android/gradle.properties`.
- 26 files import `expo-image`; `(home)/index.tsx`, `(garage)/index.tsx`, `(garage)/bike/[id].tsx` already use it (they use `contentFit`/`recyclingKey`/`transition`).
- Raw RN `<Image>` still renders full-res photos in `src/components/diagnostic-flow/step-photo-details.tsx` and `step-review-submit.tsx` (`resizeMode`, `source={{ uri: photoUri }}`). Share cards use small local assets via RN `<Image>` and are intentionally out of scope (view-shot capture reliability).
- `_layout.tsx` calls `SystemUI.setBackgroundColorAsync(...)` (root view bg — **not** the deprecated status-bar setter).

**Non-blocking nature:** All four are advisories (technical-quality / user-experience), not policy blockers. None gate a release. This plan improves store standing and future-proofs for Android 16, and must not regress the phone-first dark UI.

---

## Requirements

- **R1** — Remove the Android orientation restriction (or make an explicit, documented decision to keep it) so the Android 16 large-screen advisory is addressed, without regressing phone UX.
- **R2** — Diagnostic-flow full-resolution photo previews render through an image-loading library that downsamples/caches (`expo-image`), reducing decode memory.
- **R3** — Release builds enable R8 full mode and optimized resource shrinking via managed Expo config, surviving prebuild regeneration.
- **R4** — The edge-to-edge advisory is addressed to the extent app code controls it (system-bar hygiene + declarative config); the upstream-gated remainder is documented, not faked.
- **R5** — No regression: a release build still boots and the reflection-heavy native libs (Mapbox, RevenueCat/`react-native-purchases`, Google Sign-In, `react-native-fbsdk-next`, Sentry) work under full-mode R8.

---

## Key Technical Decisions

### KTD1 — Orientation: switch to `orientation: 'default'` (recommended) vs keep portrait
`app.config.ts` top-level `orientation` only supports `'default' | 'portrait' | 'landscape'` — there is **no** form-factor-conditional option. Two viable paths:

- **(Chosen) `orientation: 'default'`** — removes `android:screenOrientation` from the manifest entirely. Clears the Play advisory, aligns with Google's Android 16 direction, and is a one-line, reversible change. Cost: **phones can now rotate**, so core screens must be verified in landscape/split-screen (mitigated by existing `react-native-safe-area-context` + ScrollView-based layouts).
- **(Rejected) Keep `'portrait'`** — best phone UX; Android 16 auto-ignores the restriction on large screens anyway, so the app still *runs* there. But the Play advisory **persists** and large-screen layouts remain unverified. Recorded in Open Questions as the fallback if landscape verification surfaces unacceptable breakage.

### KTD2 — R8 full mode + optimized resource shrinking via a new config plugin
`expo-build-properties` (SDK 56) exposes `enableMinifyInReleaseBuilds` / `enableShrinkResourcesInReleaseBuilds` / `extraProguardRules` but **no** field for `android.enableR8.fullMode` or the optimized resource shrinker. These are `gradle.properties` flags. Mirror `plugins/with-gradle-memory.js` (`withGradleProperties`) — the `android/` dir is gitignored and regenerated on prebuild, so a plugin is the only durable home. Flags:
- `android.enableR8.fullMode=true`
- `android.enableNewResourceShrinker.preciseShrinking=true`

Full mode is more aggressive (strips reflection-accessed classes), hence R5's smoke-test gate and any needed `extraProguardRules` keep rules.

### KTD3 — AGP 9.0+ is deferred (Expo-owned)
Expo SDK 56 pins the Android Gradle Plugin to an 8.x line; AGP is not independently overridable via `expo-build-properties` without breaking the managed build. Upgrading to AGP 9 ships with a future Expo SDK. **Deferred** — documented in Scope Boundaries, not attempted here.

### KTD4 — Edge-to-edge is upstream-gated; app scope is hygiene only
The deprecated `setStatusBarColor`/`setNavigationBarColor` calls come from RN 0.85's `WindowUtilKt.enableEdgeToEdge` + `StatusBarModule` and Expo internals — not app code. The app sets no status/nav-bar background color. App-controllable scope: confirm no `<StatusBar backgroundColor>` / `StatusBar.setBackgroundColor` / `androidStatusBar.backgroundColor` is introduced, prefer declarative `expo-status-bar` (already a dep) / `expo-navigation-bar`, and document that the residual warning clears on the next RN/Expo bump. No code churn chasing framework-internal calls.

---

## Implementation Units

### U1. Remove Android orientation restriction
**Goal:** Clear the large-screen orientation advisory (R1) by removing the manifest restriction.
**Requirements:** R1
**Dependencies:** none
**Files:** `apps/mobile/app.config.ts`
**Approach:** Change top-level `orientation: 'portrait'` → `orientation: 'default'`. Confirm no other config re-imposes a lock. This removes `android:screenOrientation` from the merged manifest.
**Execution note:** Config change; proof is a runtime pass in U5, not a unit test.
**Test scenarios:** `Test expectation: none — config-only change; behavior verified in U5 (landscape/split-screen runtime pass).`
**Verification:** After prebuild, the generated `AndroidManifest.xml` has no `android:screenOrientation` on `.MainActivity`.

### U2. Migrate diagnostic-flow photo previews to expo-image
**Goal:** Render full-resolution picked/camera photos through `expo-image` so they are downsampled/cached (R2).
**Requirements:** R2
**Dependencies:** none
**Files:**
- `apps/mobile/src/components/diagnostic-flow/step-photo-details.tsx`
- `apps/mobile/src/components/diagnostic-flow/step-review-submit.tsx`
- `apps/mobile/src/components/diagnostic-flow/__tests__/` (add or extend a render test if a diagnostic-flow test dir exists; otherwise a lightweight component render test)
**Approach:** Replace the raw RN `<Image>` (the `source={{ uri: photoUri }}` / `store.photoUri` / `selectedBike.primaryPhotoUrl` previews) with `Image` from `expo-image`. Convert `resizeMode="cover"` → `contentFit="cover"`. Keep styles/dimensions identical. Remove the now-unused `Image` from the `react-native` import (keep other RN imports). Leave `share/cards/*` raw `<Image>` untouched (small local assets + view-shot capture reliability).
**Patterns to follow:** `(garage)/bike/[id].tsx` and `(home)/index.tsx` — existing `expo-image` usage with `contentFit` / `transition` / `recyclingKey`.
**Test scenarios:**
- Happy path: given a `photoUri`, the preview renders an `expo-image` `Image` with `contentFit="cover"` and the same style dimensions.
- Edge case: no photo selected → placeholder branch renders (no `Image`), unchanged from current behavior.
- Regression: `step-review-submit` bike thumbnail still renders when `selectedBike.primaryPhotoUrl` is present and falls back to the icon when absent.
**Verification:** Diagnostic flow shows the captured photo preview identically; no `resizeMode`/raw-`<Image>` remains in these two files; typecheck + Jest pass.

### U3. Add R8 full-mode + optimized resource shrinking config plugin
**Goal:** Enable R8 full mode and the optimized resource shrinker in release builds via managed config (R3).
**Requirements:** R3
**Dependencies:** none
**Files:**
- `apps/mobile/plugins/with-r8-optimization.js` (new)
- `apps/mobile/app.config.ts` (register the plugin, after `expo-build-properties`)
**Approach:** Create a `withGradleProperties` plugin mirroring `plugins/with-gradle-memory.js` that upserts `android.enableR8.fullMode=true` and `android.enableNewResourceShrinker.preciseShrinking=true`. Register it in the `plugins` array after `expo-build-properties` (and near `with-gradle-memory`) so it survives prebuild. Add a header comment documenting the full-mode reflection-stripping risk and pointing at the U4 smoke-test.
**Patterns to follow:** `plugins/with-gradle-memory.js` (upsert-by-key over `config.modResults`).
**Test scenarios:** `Test expectation: none — build-config plugin; correctness proven by U4 prebuild + release smoke test.`
**Verification:** After `expo prebuild --platform android --clean`, `android/gradle.properties` contains both flags.

### U4. Release-build smoke test under full-mode R8
**Goal:** Prove full-mode R8 does not strip reflection-accessed classes from critical native libs (R5).
**Requirements:** R5
**Dependencies:** U3
**Files:** `apps/mobile/app.config.ts` (only if `extraProguardRules` keep rules prove necessary)
**Approach:** Produce a release (minified) Android build and exercise the reflection-heavy surfaces: Mapbox map render, RevenueCat paywall (`react-native-purchases` / `-ui`), Google Sign-In, `react-native-fbsdk-next` app-events init (when `EXPO_PUBLIC_META_APP_ID` set), and Sentry event capture. If any breaks under full mode, add targeted `-keep` rules through `expo-build-properties.android.extraProguardRules` rather than disabling full mode.
**Execution note:** Smoke/runtime verification on a release build — not unit coverage. This is the gate for shipping U3.
**Test scenarios:** `Test expectation: none — runtime smoke test; documented as a manual verification checklist in the PR.`
**Verification:** Release build boots; each listed surface functions; any required keep rules are captured in `extraProguardRules` with a comment.

### U5. Large-screen & landscape verification pass
**Goal:** Confirm removing the orientation lock (U1) does not break core screens on rotation / large screens (R1, R5).
**Requirements:** R1, R5
**Dependencies:** U1
**Files:** none (verification; fixes, if any, land in the affected screen files and are noted in the PR)
**Approach:** On a large-screen emulator (e.g. Pixel Tablet / foldable) and a phone in landscape, walk the primary flows: onboarding, home, garage list + bike detail, diagnose flow, profile. Watch for clipped content, broken absolute-positioned hero images, and safe-area gaps. Rely on existing `react-native-safe-area-context` usage; fix only genuine breakage. If breakage is severe/unbounded, fall back to KTD1's rejected option (keep portrait) and record it.
**Execution note:** Runtime verification pass; scope any fixes tightly to what rotation actually breaks.
**Test scenarios:** `Test expectation: none — manual multi-form-factor runtime pass; findings recorded in the PR.`
**Verification:** Core flows are usable in landscape and on a large-screen device with no clipped/unusable content.

### U6. Edge-to-edge / system-bar hygiene
**Goal:** Address the app-controllable portion of the edge-to-edge advisory and document the upstream remainder (R4).
**Requirements:** R4
**Dependencies:** none
**Files:** `apps/mobile/app.config.ts` (only if a stray status/nav-bar color config is found), plan/PR notes
**Approach:** Confirm no `androidStatusBar.backgroundColor`, `<StatusBar backgroundColor=...>`, or `StatusBar.setBackgroundColor(...)` exists (grep verified none today). Keep system-bar styling declarative via `expo-status-bar` (already a dep); if any Android nav-bar styling is desired, use `expo-navigation-bar` rather than deprecated color setters. Add a short note (PR body + a comment near the splash/system-ui config in `_layout.tsx` if apt) that the residual `WindowUtilKt.enableEdgeToEdge` / `StatusBarModule` deprecation is RN-core-internal and clears on the next Expo/RN SDK bump.
**Test scenarios:** `Test expectation: none — hygiene audit; no behavioral change unless a stray setter is found.`
**Verification:** Repo grep shows no app-level deprecated status/nav-bar color setter; the upstream-gated nature is documented.

---

## Scope Boundaries

**In scope:** Orientation config (U1), diagnostic-flow image migration (U2), R8 full-mode/resource-shrinker plugin (U3), release smoke test (U4), large-screen verification (U5), edge-to-edge hygiene (U6).

**Deferred to Follow-Up Work:**
- **AGP 9.0+ upgrade** — Expo-SDK-owned (KTD3); ships with a future Expo SDK upgrade.
- **Full adaptive/tablet-optimized layouts** — U5 ensures *usable*, not *optimized*, large-screen UX. Dedicated tablet/foldable layout work is a separate effort.
- **Migrating `share/cards/*` raw `<Image>` to expo-image** — small local assets; view-shot capture reliability makes RN `<Image>` the safer choice there.

**Outside scope:** Chasing framework-internal deprecated status/nav-bar calls in RN/Expo (KTD4) — not app-fixable.

---

## Open Questions

- **OQ1 (orientation fallback):** If U5 finds landscape/large-screen breakage too costly to fix in this pass, revert U1 to `orientation: 'portrait'` and accept the (non-blocking) Play advisory until dedicated adaptive-layout work is scheduled. Decision made at U5 time based on observed breakage.
- **OQ2 (R8 full-mode default):** AGP 8.x may already default `enableR8.fullMode=true`; setting it explicitly (U3) is defensive and harmless. If the release build size/behavior is unchanged, that confirms it was already on — still worth the explicit flag for the Play signal.

---

## Risks & Dependencies

- **Full-mode R8 strips reflection classes (medium):** Mitigated by U4 smoke test + targeted `extraProguardRules` keep rules. Do not disable full mode as the fix — add keep rules.
- **Phone rotation UX regression (medium):** U1 lets phones rotate; U5 verification + OQ1 fallback bound the risk.
- **Prebuild regeneration wipes native edits (low):** Avoided by using config plugins (U3) — the established pattern in this repo.
- **Requires a new store build to take effect (process):** These are native/config changes — they reach users only via an EAS store build (not OTA), consistent with prior RC/native changes. Bundle version bump handled at release time.

---

## Definition of Done

- `app.config.ts` uses `orientation: 'default'` (or OQ1 fallback is documented).
- Diagnostic-flow photo previews use `expo-image`; no raw RN `<Image>` full-res previews remain in the two diagnostic files.
- `plugins/with-r8-optimization.js` exists, is registered, and writes both gradle flags (verified in generated `gradle.properties`).
- A release build boots and all reflection-heavy surfaces (Mapbox, RevenueCat, Google Sign-In, fbsdk, Sentry) pass the U4 smoke test; any keep rules are captured.
- Core flows verified usable in landscape + on a large-screen device (U5).
- Edge-to-edge hygiene confirmed and the upstream-gated remainder documented (U6).
- `pnpm precheck` (lint + typecheck + test) is green.

---

## Sources & Research

- Play Console advisories (release 77 / 3.15.0): edge-to-edge deprecated APIs, orientation/resizability restriction, bitmap image optimization, R8 optimization.
- `expo-build-properties` API (Context7 / docs.expo.dev v56/v57): confirms `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`, `extraProguardRules`; **no** direct R8 full-mode / resource-shrinker field → config-plugin approach (KTD2).
- `androidStatusBar` deprecated in favor of `expo-status-bar`; edge-to-edge default on SDK 35+ makes nav-bar color props deprecated (Context7) → KTD4.
- Repo verification: `git log` shows R8 compat mode landed in PR #145 (release 77); grep shows diagnostic-flow raw `<Image>` full-res previews and home/garage/bike already on `expo-image`; `plugins/with-gradle-memory.js` is the `withGradleProperties` template for U3.
