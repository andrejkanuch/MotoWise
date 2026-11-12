---
title: "[#365 T03b] PostHog dashboard \"#365 Activation & frictions\", 2 alerts, weekly install-cohort table"
labels: [instrumentation, area:analytics, activation-365]
order: 4
task_id: T03b
depends_on: [T01, T02, T03a]
phase: P0
size: M
release_path: "PostHog writes, one owner-approved batch (D2)"
---

## Context
#365, plan §3 T03 (split), §1.2, §5, §5A.2, §5A.4, board instrumentation #10 [SOURCE: board/99-synthesis.md:229-232].

## Why
No #365 dashboard exists (only 738337 "Onboarding A/B 2026", 636265 "Onboarding Funnel") [SOURCE: plan Q-P3]. The owner wants to watch each fix release's effect by version.

## What to change
1. Dashboard **"#365 Activation & frictions"** (project 155556). S1–S6 tiles first, then one SQL insight per spec in plan §6.1 that has a PostHog metric (§5A.4 says which are DB-only). Name `<spec id> — <short name>`; description: definition, baseline + source + date, target, "mechanical" or "harm check". SQL from T02's `queries/fs/*.sql` verbatim, broken down by `ver`, `lvl`, `rt`, `plat` (`{REL}`), with `{EXCL}` incl. `e2e_run`.
2. Two alerts on SQL insights (supported per PostHog docs; free tier max 5 alerts) [SOURCE: plan Q-P11]: FS-PO5 `hud_without_any_start > 0` weekly; FS-M binary rule (opens on the newest `$app_version` with an unexpected level > 0).
3. Weekly install-cohort table (board #10): `n, ob_done, activation_24h, core_w1, day2_return, day2_engaged_return, D7` by week × platform × `onboarding_variant` (q02 base CTE + board/06 Appendix B).
4. Push tile: `push_token_registered` by `platform` per week (`lib/push-token.ts:132`).
5. The first annotation: `#365 baseline` dated the day T02 recorded baselines.

## How
PostHog MCP: `dashboard-create`, `insight-create` (HogQL), `alert` create, `annotation` create. Prepare the full named list of writes in the PR/issue first; the owner approves the list once; then execute. Tiles for events that do not exist yet show "no data" until TR0.

## Acceptance criteria
- [ ] Owner approval of the named write list recorded in the issue.
- [ ] Dashboard URL in `experiments.md`; every PostHog-measurable spec in §6.1 has a tile; S1–S6 on top.
- [ ] 2 alerts active; weekly cohort table saved; baseline annotation exists.

## Verification
- `SELECT column_name FROM system.information_schema.columns WHERE table_name='system.dashboards'` then `SELECT id, name FROM system.dashboards WHERE NOT deleted AND name = '#365 Activation & frictions'` → 1 row.
- `SELECT count() FROM system.insights WHERE NOT deleted AND name LIKE 'FS-%'` ≥ number of PostHog-measurable specs.

## Friction spec
FS-M (visibility). Repro: open PostHog after a release — no place shows friction metrics by version. Expected: one dashboard, all specs by `lvl`. Automated check: the two verification SQL counts above (run by the agent, output in the PR).

## Production metric
This task creates the metric surfaces. Target: tiles = PostHog-measurable specs; alerts fire only on real regressions. Annotate each release on this dashboard per T03a.

## Release
PostHog only; owner-approved batch.

## Dependencies
- Blocked by: T01, T02, T03a.
- Blocks: "done" of every bug/enhancement task (its tile must exist).

## Out of scope
DB-only metrics as tiles (weekly DB check, T02); Replay Vision scans.

## Constraints
No writes without the owner's approval of the named list; no person ids/emails in insight names or descriptions.
