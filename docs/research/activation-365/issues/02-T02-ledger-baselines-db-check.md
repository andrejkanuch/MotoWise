---
title: "[#365 T02] experiments.md ledger, baseline re-run, per-spec SQL files, weekly DB check and E2E exclusion"
labels: [research, area:analytics, area:db, activation-365]
order: 2
task_id: T02
depends_on: []
phase: P0
size: M
release_path: "docs commit only (docs/research/activation-365/)"
---

## Context
#365, plan §3 T02, §0 (`{EXCL}`), §1.2 (S1–S6), §3A.0 rule 6 (D2b), §5, §5A. Every production change of #365 is blocked until this task has recorded the baselines it touches (§3A.0 rule 4).

## Why
- `experiments.md` does not exist [SOURCE: board/review-verdicts.md P06.1]; most §5 SQL is *(draft)*.
- PostHog has no Supabase source, so DB metrics need a weekly scripted check [SOURCE: review W2, W3].
- New E2E flows would otherwise count against "= 0" targets; today 0 e2e persons exist in PostHog [SOURCE: plan Q-P10].
- OB1-E's 22/73 headline counts auth-first riders; S6 redefined to 44/472 [SOURCE: R1 Q1; R6-q8].

## What to change
1. `docs/research/activation-365/experiments.md`: canonical definitions (S1–S6; S3 = F14 engaged return), reading rule, strata, Exp 1 ledger (D13 items, `EXP1_START_AT`/stop date, "local-draw riders can only be stopped by an OTA"), both-arm change log (date, platform, task, release), per-release read log.
2. `queries/fs/<spec-id>.sql`, one per §5/§5A metric, each run once read-only with result + date in a header comment; fix failing drafts.
3. `queries/db/<spec>.sql` for D2b (C): `s4a-day0-schedule.sql`, `s4b-r2m1.sql`, `fs-r2-4-imperial.sql`, `fs-po4b-first-ride.sql`, `fs-ob1e-two-bikes.sql`, each excluding `users.is_synthetic` and `email LIKE 'e2e-%'` (never print emails; aggregate only), plus `queries/db/README.md` with the Monday run recipe.
4. E2E exclusion: `{E2E_PERSONS}` list (re-run Q-P10 shape) in `queries/q00-excluded-persons.md`; runners `apps/mobile/scripts/run-onboarding-e2e.sh` (+ siblings) set `is_synthetic = true` on the user they create (same admin call that creates it), and document `SUPABASE_URL` local override for seeding flows.

## How
- PostHog `execute-sql` (read-only) and Supabase Management API SELECT (task brief recipe). Record every query + result.
- Runner change is a small shell edit; test by running `pnpm --filter @motovault/mobile test:e2e:onboarding` against **local** Supabase (`pnpm db:start`, export `SUPABASE_URL`/keys).

## Acceptance criteria
- [ ] Every spec in plan §6.1 has a `.sql` with a dated baseline or "not measurable until <task>".
- [ ] S1–S6 re-run on trailing 8 weeks by `$app_version` and platform; differences vs cited baselines explained.
- [ ] Five `queries/db/*.sql` run once with dated result rows in `experiments.md`.
- [ ] Ledger lists D13 items, D16, the both-arm log header.
- [ ] Runner marks created users synthetic; one local run log attached.

## Verification
- `ls docs/research/activation-365/queries/fs | wc -l` ≥ number of specs; each file has `-- run <date>: <result>`.
- Production read-only: S1 by version (plan Q-P5 shape) reproduces 3.26.0 8/84 within binomial noise.

## Friction spec
All specs (this task gives each its baseline). Automated check: none (docs); a reviewer re-runs 3 random `.sql` files and gets the recorded numbers ±1 day of data.

## Production metric
Owns the baselines: S1 61/367 (16.6%), 3.26.0 8/84 [SOURCE: evidence pack §2; Q-P5]; S2 367/793; S3 engaged 37/367 [SOURCE: board/06 F14]; S4(a) 25/111, S4(b) 10/151 [SOURCE: board/99 App. A; R2-M1]; S5 3.26.0 8/121 [SOURCE: Q-P8]; S6 44/472 [SOURCE: R6-q8]. Dashboard: feeds T03b. No release annotation (docs).

## Release
Docs commit; no app or DB change; no PostHog write.

## Dependencies
- Blocked by: —
- Blocks: T03a, T03b, T05e, T07a, T30, T41b, every production deploy (§3A.0 rule 4).

## Out of scope
Creating PostHog insights (T03b); new Replay Vision scans.

## Constraints
Read-only queries; no emails, names or person ids in files except the existing `{EXCL}` id list; SELECT only on Supabase.
