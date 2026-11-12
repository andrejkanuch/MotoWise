---
title: "[#365 T21] LimitSheet and a session frequency cap for feature-gate paywalls"
labels: [enhancement, area:mobile, activation-365]
order: 33
task_id: T21
depends_on: [T00, T05a]
phase: P2
size: M
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T21, specs FS-PO3, S5, FS-PO2c (part), D5.

## Why
`requirePro`/`requireAccess` present on every call (`hooks/use-pro-gate.ts:64-105`); `presentPaywall` only joins in-flight requests (`lib/subscription.ts:770-792`). 3.26.0: **14 automatic-gate sessions, 9 with a same-feature repeat (64%), 8 within 60 s** (explicit upgrade surfaces excluded; the earlier 9/22 counted upgrade taps) [SOURCE: V1-q33]; first-hour ≥ 2 post-onboarding 8/121 [SOURCE: R3 RC-3, Q7, Q10; Q-P8]. 2 of 3 gate purchases came on a repeat view, so no hard cap [SOURCE: R3 Q12].

## What to change
`lib/paywall-frequency.ts` (in memory; resets on cold start or > 30 min background): 1 automatic present per feature per session, 2 per session, 10-min cooldown after `paywall_result: error`. Capped calls open `components/paywall/limit-sheet.tsx` with "See Pro plans" (`trigger:'rider_tap'`, never capped); fire `paywall_suppressed`, `limit_sheet_viewed`; `gate_policy:'capped_v1'`. testIDs `limit-sheet`, `limit-sheet-see-pro`, `limit-sheet-close`. Onboarding surfaces exempt via `isOnboardingPaywallSurface`.

**LimitSheet copy, keyed off `feature`** (feature ids from `PRO_FEATURES`, `packages/types/src/constants/limits.ts:29-39`). One i18n key set per row (`limitSheet.<feature>.title|body|cta`), all app locale files enforced by `pnpm check:i18n`; no price, no "free trial" wording; the CTA always opens the paywall with `trigger:'rider_tap'`:

| `feature` | Title | Body | CTA |
|---|---|---|---|
| `full_ai_diagnostics` | This month's free diagnosis is used | It's back on {date}. (Unknown date: "It resets next month.") Same keys as T08's limit panel. | See Pro plans |
| `unlimited_bikes` | Your plan has one bike | Free includes 1 bike. T22 decides the buttons (update or edit the bike first). | See Pro plans |
| `gpx_export` | GPX export is part of Pro | Your ride and its stats stay free. Export the track as GPX with Pro. | See Pro plans |
| `offline_trips` | Offline trips are part of Pro | Your planned trips stay available online. Save them for offline use with Pro. | See Pro plans |
| `trip_assistant` | The trip assistant is part of Pro | Planning trips yourself stays free. The assistant plans with you in Pro. | See Pro plans |
| any other `feature` (fallback) | This is part of Pro | You can keep using everything in your free plan. | See Pro plans |

The fallback row renders for any `ProFeature` without its own row, so a new gated feature never shows a blank sheet. Dates use `date-fns` with the app locale.

## How
Consulted by `hooks/use-pro-gate.ts:64-105`, `app/(tabs)/(garage)/index.tsx:128-130`, `hooks/use-profile-data.ts:118-128`. Jest `lib/__tests__/paywall-frequency.test.ts` (5 rules incl. session reset) and `components/paywall/__tests__/limit-sheet.test.tsx` (each of the five features renders its own title/body/CTA; an unknown feature renders the fallback). Maestro `gate-frequency-cap.yaml` with the seeded used diagnosis.
- **Local stack for the seeded flow:** run it on a **Release build** whose `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_API_URL` point at local Supabase (`:54321`) and the local NestJS API (`:4000/graphql`), per `features/bike-detail-shell-overview/local-stack.md` (iOS sim `127.0.0.1`; Android emulator `10.0.2.2` for both). **Correction (validation V3):** `pnpm db:reset` cannot replay the repo migrations from empty (00093 ordering; 00097, 00098, 00102 fail), so use the patched local stack `~/.motovault-local/mvscratch` brought to the latest migration by **T00** (pinned `npx supabase@<version> … --workdir ~/.motovault-local/mvscratch`); the runner's `SUPABASE_URL` override (`apps/mobile/scripts/run-onboarding-e2e.sh:11-12`) points at the same local Supabase as the build.

## Acceptance criteria
- [ ] Red run of `gate-frequency-cap.yaml` on main (second paywall), green after; light then dark screenshots.
- [ ] `onboarding.yaml` and `onboarding-paywall-verify.yaml` pass unchanged (both arms).
- [ ] Copy table implemented for all five features + fallback in all app locale files (`pnpm check:i18n`); D5 recorded; `pnpm check:mobile-colors`.

## Verification
`pnpm --filter @motovault/mobile test -- paywall-frequency`; Maestro logs.

## Friction spec
FS-PO3. Repro: free user, seeded diagnosis: Diagnose → Start → dismiss → Start; Garage "Add a Bike" → dismiss → Home "+" → Profile "Add bike". Expected: ≤ 1 automatic present per feature, ≤ 2 per session; later taps open `LimitSheet`. Automated check: maestro (local, both) Garage Add → optional dismiss → Add again → `assertVisible: {id: limit-sheet}` → Diagnose Start → dismiss → Start → `assertVisible: {id: limit-sheet}` → `assertVisible: {id: limit-sheet-see-pro}`. Red first. RevenueCat absent: assert app UI only.

## Production metric
FS-PO3 (verbatim `R3…:473-485`) + `paywall_suppressed` by `{REL}`. Baseline 9/14 automatic-gate sessions on 3.26.0 (surface filter `validation/V1-metrics.md` §3.7) [SOURCE: V1-q33]; target 0. S5 3.26.0 8/121 → ≤ 2%. Guardrail: gate purchases + `rider_tap` views ≠ 0 over 8 weeks (baseline 3 gate purchases/60 d) [SOURCE: R3 Q11–Q12]. Tiles "FS-PO3", "S5". Annotate Release B.

## Release
Release B (lvl 3); the release cut records the level of FS-PO3 in plan §6.1 (no code map).

## Dependencies
- Blocked by: T00 (test environment), T05a.
- Blocks: T22, T24, T35.

## Out of scope
Onboarding paywall, RC experiment, `feature_gate` placement config.

## Constraints
A rider-tapped path to the paywall always exists; light/dark; D5.
