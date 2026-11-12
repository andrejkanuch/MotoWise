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
#365, plan §3 T02, §0 (`{EXCL}`), §1.2 (S1–S6), §3A.0 rule 6 (D2b), §5, §5A, §10. Every production change of #365 is blocked until this task has recorded the baselines it touches (§3A.0 rule 4).

## Why
- `experiments.md` does not exist [SOURCE: board/review-verdicts.md P06.1]; most §5 SQL is *(draft)*.
- PostHog has no Supabase source, so DB metrics need a weekly scripted check [SOURCE: review W2, W3].
- New E2E flows would otherwise count against "= 0" targets; today 0 e2e persons exist in PostHog [SOURCE: plan Q-P10].
- OB1-E's 22/73 headline counts auth-first riders; S6 redefined to 44/472 [SOURCE: R1 Q1; R6-q8].
- **The validation of 2026-11-12 (`validation/V1-metrics.md`) already ran 47 specs on production**: about 30 reproduce; it found the `{REL}` platform column broken (`$os` never set, `platform` null on first opens), three R6 SCOREBOARD-CTE metrics counting event rows (FS-PO6/12/13), wrong denominators in FS-PO3 and FS-R2-5, a missing `oem` split in S4(a), `{RN}` dropping the server event `signup_completed`, and 13 (not 12) excluded persons. This task starts from V1's corrected SQL instead of re-deriving the drafts.

## What to change
1. `docs/research/activation-365/experiments.md`: canonical definitions (S1–S6; S3 = F14 engaged return), reading rule, strata, Exp 1 ledger (D13 items; the start/stop window served by the API field from T30, with the embedded hard ceilings 2027-01-06 latest start and `EXP1_STOP_AT` 2027-03-31; power for the 2026-12-15 and 2027-01-06 start scenarios from plan §10), both-arm change log (date, platform, task, release), per-release read log.
2. `queries/fs/<spec-id>.sql`, one per §5/§5A metric, each run once read-only with result + date in a header comment. **Take the corrected SQL verbatim from `validation/V1-metrics.md` §3** (§3.1 `{REL}` platform; §3.2 FS-OB1b `$screen` back-walk; §3.3 FS-OB1c ordered; §3.4 FS-OB5 + FS-OB7; §3.5 FS-OB2b and the per-completer FS-PO6/PO11/PO12/PO13/PO14 (+ FS-PO2d) query; §3.6 FS-PO8 with the Garage control; §3.7 FS-PO3 surface filter); record V1's numbers as the baseline unless the re-run differs (then explain). Apply `{RN}` never to server events. S1 is anchored on the first `onboarding_completed` (7 d).
3. `queries/db/<spec>.sql` for D2b (C): `s4a-day0-schedule.sql` (**with a `source = 'oem'` column**, V1 §3.8), `s4b-r2m1.sql`, `fs-r2-4-imperial.sql` (imperial denominator from `measurement_system`/`service_plan_imported.unit`, not `motorcycles.mileage_unit`, which defaults to `'mi'`), `fs-po4b-first-ride.sql` (null distance counted as sub-floor), `fs-ob1e-two-bikes.sql`, plus `fs-r2-5-short-make.sql` (V1 §3.8), each excluding `users.is_synthetic` and `email LIKE 'e2e-%'` (qualify `u.deleted_at`/`u.email` inside joins) (never print emails; aggregate only), plus `queries/db/README.md` with the Monday run recipe. **Every file starts with `BEGIN READ ONLY;` and ends with `COMMIT;`**, so a mistaken write in the check fails instead of changing production data (doc review 2026-11-12, item 14).
5. Tiles vs files: FS-OB7, FS-PO9, FS-PO11 and FS-PO15/16 keep their SQL in `queries/fs/` (run on demand) but get **no dashboard tile** in T03b. T37, T41 and T41b are no longer tasks; their triggers are ledger lines in plan §10 "Ledger notes" — copy them into the `experiments.md` ledger.
4. E2E exclusion: `{E2E_PERSONS}` list (re-run Q-P10 shape) in `queries/q00-excluded-persons.md`; the base `{EXCL}` list is **13 persons** (V1 §0, V2-s1), plus the internal tester who runs internal builds 92–99 and is not flagged `internal` (V3 item 7; flagging them `internal` in PostHog is a write for the D2 list), plus the person, if any, behind the V4 emulator run (`$device_model = 'sdk_gphone64_arm64'`, app 3.28.0, 2026-11-12 14:18–14:30 UTC; anonymous, no sign-in); runners `apps/mobile/scripts/run-onboarding-e2e.sh` (+ siblings) set `is_synthetic = true` on the user they create (same admin call that creates it), and document `SUPABASE_URL` local override for seeding flows.

## How
- PostHog `execute-sql` (read-only) and Supabase Management API SELECT (task brief recipe). Record every query + result.
- Runner change is a small shell edit; test by running `pnpm --filter @motovault/mobile test:e2e:onboarding` against the **local** stack set up by T00 (`~/.motovault-local/mvscratch` via a pinned `npx supabase … --workdir`; `pnpm db:start`/`db:reset` cannot replay the repo migrations from empty, V3), export `SUPABASE_URL`/keys.

## Acceptance criteria
- [ ] Every spec in plan §6.1 has a `.sql` with a dated baseline or "not measurable until <task>".
- [ ] S1–S6 re-run on trailing 8 weeks by `$app_version` and platform; differences vs cited baselines explained.
- [ ] Five `queries/db/*.sql` run once with dated result rows in `experiments.md`; each begins `BEGIN READ ONLY;` and ends `COMMIT;`.
- [ ] Ledger holds the plan §10 ledger notes (post-slot candidate queue, P05.3 card-only note, PO15/PO16 "verify if seen again", `model_fetch_ms` p90 > 3 s trigger, push-grant caveat, `maintain_bike` read rule, the follow-up after T40 on the default week-1 message, the referral-quality growth hypothesis) and the Exp 1 pre-registration from plan §5 FS-EXP1 (stratified MH test, `returning_account` excluded, `track_rides` subgroup, absolute-lift power table).
- [ ] FS-PO11's two 3.26.0 What's New completers (10-23, 11-05) checked with replays: automatic or rider-opened.
- [ ] Ledger lists D13 items, D16, the both-arm log header.
- [ ] Runner marks created users synthetic; one local run log attached.

## Verification
- `ls docs/research/activation-365/queries/fs | wc -l` ≥ number of specs; each file has `-- run <date>: <result>`.
- Production read-only: S1 by version (plan Q-P5 shape) reproduces 3.26.0 8/84 within binomial noise.

## Friction spec
All specs (this task gives each its baseline). Automated check: none (docs); a reviewer re-runs 3 random `.sql` files and gets the recorded numbers ±1 day of data.

## Production metric
Owns the baselines: S1 completion-anchored 37/275 (13.5%), 3.26.0 8/84; strata `track_rides` 47/197 vs other 14/170 (first-seen cohort 61/367 kept as reference) [SOURCE: V1-q7, V1-q8; V2-q5; Q-P5]; S2 367/793; S3 engaged 37/367 (+ the 24–48 h form for per-release reads, V2 §5.3) [SOURCE: board/06 F14]; S4(a) 25/111 any source + `oem` column, S4(b) 10/151 [SOURCE: board/99 App. A; R2-M1]; S5 3.26.0 8/121 [SOURCE: Q-P8]; S6 44/472 [SOURCE: R6-q8]. Dashboard: feeds T03b. No release annotation (docs).

## Release
Docs commit; no app or DB change; no PostHog write.

## Dependencies
- Blocked by: —
- Blocks: T03a, T03b, T05e, T07a, T30, every production deploy (§3A.0 rule 4).

## Out of scope
Creating PostHog insights (T03b); new Replay Vision scans.

## Constraints
Read-only queries; no emails, names or person ids in files except the existing `{EXCL}` id list; SELECT only on Supabase.
