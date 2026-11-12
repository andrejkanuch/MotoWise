---
title: "[#365 T24] Exhausted diagnose CTA reads \"Free diagnosis used · back on {date}\" and opens the LimitSheet; \"1 bike on Free\" hint"
labels: [enhancement, area:mobile, activation-365]
order: 36
task_id: T24
depends_on: [T21, T08]
phase: P2
size: S
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T24, spec FS-PO2c, D6. AI gets quieter, not promoted.

## Why
With the quota used the CTA looks unchanged; the limit is a caption (`components/diagnosis/quota-note.tsx:13-30`, `app/(tabs)/(diagnose)/index.tsx:141-163`); 3 riders got 6 upfront paywalls, re-tapping 1.4–7 s after dismissing [SOURCE: R3 Q1, Q7].

## What to change
When `quota.isExhausted` is known: list CTA and `[id].tsx:116` "Start new" read "Free diagnosis used · back on {date}" muted and open `LimitSheet` (T21), never the form or paywall directly; unknown keeps today's CTA. Garage add button hint "1 bike on Free". testIDs `diagnose-cta-exhausted`, `diagnose-step-bike` (first form step).

## How
Jest `components/diagnosis/__tests__/diagnose-cta.test.tsx` (available / exhausted / unknown). Maestro `diagnose-quota-used.yaml` with the seeded used diagnosis (`E2E_SEED_DIAGNOSIS_USED=1`).
- **Local stack for the seeded flow:** run it on a **Release build** whose `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_API_URL` point at local Supabase (`:54321`) and the local NestJS API (`:4000/graphql`), per `features/bike-detail-shell-overview/local-stack.md` (iOS sim `127.0.0.1`; Android emulator `10.0.2.2` for both). `pnpm db:reset` seeds the schema first, and the runner's `SUPABASE_URL` override (`apps/mobile/scripts/run-onboarding-e2e.sh:11-12`) points at the same local Supabase as the build.

## Acceptance criteria
- [ ] Red run on main (form opens / paywall), green after; light/dark contrast screenshots; 7 locales.

## Verification
`E2E_SEED_DIAGNOSIS_USED=1 pnpm --filter @motovault/mobile test:e2e:diagnose-quota-used` (Release build on the local stack, after `pnpm db:reset`).

## Friction spec
FS-PO2c. Repro: free user, seeded used diagnosis, online → Diagnose tab. Expected: muted CTA → LimitSheet, never the form. Automated check: maestro (local, both) `assertVisible: ".*Free diagnosis used.*"` → `tapOn: {id: diagnose-cta-exhausted}` → `assertVisible: {id: limit-sheet}` → `assertNotVisible: {id: diagnose-step-bike}`. Red first.

## Production metric
Verbatim `R3…:510-517` by `{REL}` + `limit_sheet_viewed {feature:'full_ai_diagnostics'}`. Baseline 6 upfront paywalls / 3 riders (60 d) [SOURCE: R3 Q1, Q7]. Target 0 automatic upfront paywalls. Tile "FS-PO2c — exhausted CTA". Annotate Release B.

## Release
Release B (lvl 3); the release cut records the level of FS-PO2c in plan §6.1 (no code map).

## Dependencies
- Blocked by: T21, T08.
- Blocks: T35.

## Out of scope
The free limit.

## Constraints
AI not promoted; D6; light/dark.
