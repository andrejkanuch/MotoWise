---
title: "[#365 T14b] (Conditional) Cached me cannot say \"not completed\"; second complete_onboarding is a no-op"
labels: [bug, area:mobile, area:db, activation-365]
order: 49
task_id: T14b
depends_on: [T18]
phase: P4
size: S
release_path: "next store build; migration only if needed (owner applies)"
---

## Context
#365, plan §3 T14 (data-gated part, review item 14), spec FS-OB1e.

## Why
Relapse cause confidence 45% [SOURCE: R1 RC-E]; `gate_routed.onboarding_completed_source` (T04b, live from 3.29.0 go-live per platform, D17) shows whether relapses come from `me_cache`.

## What to change
**Gate:** run only if 4 weeks of `gate_routed`, counted from 3.29.0 go-live per platform, show ≥ 1 relapse routed by `me_cache` on lvl ≥ 2; else close with the numbers. If run: a cached `me` older than the session's sign-in cannot say "not completed" (network `me` decides); per T06 item 5, a second `complete_onboarding` is a no-op server-side (migration owner-applied only if not already idempotent).

## How
`app/_layout.tsx` gate `:417-419, 453-467`, `lib/query-persist.ts:67-74`. Jest `navigation-gate.test.tsx` extra cases; SQL check in `supabase/` if a migration is needed.

## Acceptance criteria
- [ ] Gate decision recorded in `experiments.md` with the query result.
- [ ] If built: jest cases pass; relapse metric 0 on the new level.

## Verification
`SELECT toString(properties.onboarding_completed_source) src, uniq(person_id) FROM events WHERE event='gate_routed' AND toString(properties.group)='(onboarding)' AND timestamp > now() - INTERVAL 28 DAY AND {EXCL} GROUP BY src`.

## Friction spec
FS-OB1e (cached path). Repro: dev build with a seeded persisted `me {onboardingCompleted:false}` older than sign-in. Expected: tabs. Automated check: jest (CI).

## Production metric
FS-OB1e by `{REL}`; baseline 10/291 [SOURCE: R1 Q7]; target 0. Annotate when shipped.

## Release
Next store build (D17).

## Dependencies
- Blocked by: T18 (gate window starts at 3.29.0 go-live).
- Blocks: —

## Out of scope
Local flag (T14, done).

## Constraints
Migrations only by the owner; D1.
