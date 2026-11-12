---
title: "[#365 T03b] PostHog dashboard \"#365 Activation & frictions\", 2 alerts, weekly install-cohort table"
labels: [instrumentation, area:analytics, activation-365]
order: 4
task_id: T03b
depends_on: [T01, T02, T03a]
phase: P0
size: M
release_path: "PostHog writes by the implementing agent from the named per-release list (D2)"
---

## Context
#365, plan §3 T03 (split), §1.2, §5, §5A.2, §5A.4, board instrumentation #10 [SOURCE: board/99-synthesis.md:229-232].

## Why
No #365 dashboard exists (only 738337 "Onboarding A/B 2026", 636265 "Onboarding Funnel") [SOURCE: plan Q-P3]. The owner wants to watch each fix release's effect by version.

## What to change
1. Dashboard **"#365 Activation & frictions"** (project 155556). **First tile: "Day-1 drop-off funnel"**: first seen → `onboarding_started` → `onboarding_completed` → core action in week 1 → engaged day-2 return (F14), by `{REL}`. Before saving it, run it on the evidence-pack window (first seen 2026-08-14 → 2026-11-04) and check it against `00-evidence-pack.md` §2: 793 first seen, 685 started (86%), 367 completed (46%), 61 core action in week 1 (7.7%); engaged day-2 return 39/793 (board/06 F14; raw day-2 return 72). Differences beyond the `{EXCL}` change are explained in the tile description. Then S1–S6 tiles, then one SQL insight per spec in plan §6.1 that has a PostHog metric (§5A.4 says which are DB-only). **No tile** for FS-OB7, FS-PO9, FS-PO11, FS-PO15 and FS-PO16: their SQL stays in `queries/fs/` and is run at the 2/4/8-week reads only. Name `<spec id> — <short name>`; description: definition, baseline + source + date, target, "mechanical" or "harm check". SQL from T02's `queries/fs/*.sql` verbatim, broken down by `ver`, `lvl`, `rt`, `plat` (`{REL}`), with `{EXCL}` incl. `e2e_run`.
2. Two alerts on SQL insights (supported per PostHog docs; free tier max 5 alerts) [SOURCE: plan Q-P11]: FS-PO5 `hud_without_any_start > 0` weekly (this alert is the PO5 regression guard; there is no Maestro flow for it); FS-M binary rule, checked 3 days after each binary go-live: opens with the new `$app_version` must carry the expected `activation_fix_level` (100%); any mismatch alerts.
2b. Each tile description states the reading rule (plan §0): a harm check whose post-release window falls in November–March is judged against a concurrent comparison (Android staged-rollout cohort before the Exp 1 slot, the Exp 1 control arm after it starts); a drop against the trailing 8 weeks alone is recorded "no verdict (season)" and never triggers a revert.
3. Weekly install-cohort table (board #10): `n, ob_done, activation_24h, core_w1, day2_return, day2_engaged_return, D7` by week × platform × `onboarding_variant` (q02 base CTE + board/06 Appendix B).
4. Push tile: `push_token_registered` by `platform` per week (`lib/push-token.ts:132`).
5. The first annotation: `#365 baseline` dated the day T02 recorded baselines.

## How
PostHog MCP: `dashboard-create`, `insight-create` (HogQL), `alert` create, `annotation` create. Write the full named list of writes for this release in the issue first and share it with the owner for information (no approval step, D2); then the implementing agent makes exactly those writes and records each created id (dashboard, insight, alert, annotation) in plan §6. Tiles for events that do not exist yet show "no data" until 3.29.0 go-live (Release A, D17).

## Acceptance criteria
- [ ] Named write list posted in the issue (shared with the owner for information); every created id recorded in plan §6.
- [ ] "Day-1 drop-off funnel" is the first tile and matches the evidence-pack numbers above (or the difference is explained in its description).
- [ ] Dashboard URL in `experiments.md`; every PostHog-measurable spec in §6.1 has a tile except FS-OB7, FS-PO9, FS-PO11, FS-PO15/16 (SQL files only); funnel, then S1–S6, on top.
- [ ] 2 alerts active; weekly cohort table saved; baseline annotation exists.

## Verification
- `SELECT column_name FROM system.information_schema.columns WHERE table_name='system.dashboards'` then `SELECT id, name FROM system.dashboards WHERE NOT deleted AND name = '#365 Activation & frictions'` → 1 row.
- `SELECT count() FROM system.insights WHERE NOT deleted AND name LIKE 'FS-%'` ≥ number of PostHog-measurable specs.

## Friction spec
FS-M (visibility). Repro: open PostHog after a release — no place shows friction metrics by version. Expected: one dashboard, all specs by `lvl`. Automated check: the two verification SQL counts above (run by the agent, output in the PR).

## Production metric
This task creates the metric surfaces. Target: tiles = PostHog-measurable specs; alerts fire only on real regressions. Annotate each release on this dashboard per T03a.

## Release
PostHog only; the implementing agent makes the writes from the named list (D2), ids recorded in plan §6.

## Dependencies
- Blocked by: T01, T02, T03a.
- Blocks: "done" of every bug/enhancement task (its tile must exist).

## Out of scope
DB-only metrics as tiles (weekly DB check, T02); Replay Vision scans.

## Constraints
No PostHog write outside the named per-release list; no person ids/emails in insight names or descriptions.
