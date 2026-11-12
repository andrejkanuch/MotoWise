---
title: "[#365 T03a] Release-marking runbook: per-runtime OTA, annotations per platform, friction status table"
labels: [instrumentation, area:analytics, area:mobile, activation-365]
order: 3
task_id: T03a
depends_on: [T02]
phase: P0
size: S
release_path: "docs commit (docs/runbooks/mobile-release.md, docs/runbooks/mobile-ota.md, plan §6/§6.1)"
---

## Context
#365, plan §3 T03 (split), §3A.0 rules 1–5, §6 and §6.1. The owner wants to see "the version that fixes these frictions" in PostHog and follow its statistics.

## Why
- An OTA from `main` reaches only main's runtime (`runtimeVersion.policy: 'appVersion'`, `apps/mobile/app.config.ts:37, :59-61`; `docs/runbooks/mobile-ota.md:3, 173-176`); Android production is 3.26.0 [SOURCE: Q-P1].
- Without a fixed procedure, fix releases ship without annotation or baseline (review item 5), and levels mean different things on different branches (review item 3).

## What to change
1. `docs/runbooks/mobile-release.md` (after the OTA/E2E section ≈ line 56) and `docs/runbooks/mobile-ota.md` ("Before you publish"): a "#365 release marking" section:
   - level bump (`ACTIVATION_FIX_LEVEL`) only in the cut commit; update plan §6.1 (the only spec-to-level record; no map in code) in the same commit;
   - per-runtime OTA: target runtimes + reach, branch `release/<runtime>-365` cut from the git commit of that runtime's latest production update group (`eas update:list --branch production` shows `gitCommitHash`), not the store build commit, + cherry-picks (see TR0), published with the `Mobile OTA Update` workflow (git branch picker, `mobile-ota.md:24-31`), native-diff check (`:157-188`), owner go-ahead;
   - on go-live **per platform × runtime**: PostHog annotation `#365 fixes: <platform> <version|runtime+OTA id|api> lvl <N> — <spec ids>` dated the go-live day; row in plan §6; status `shipped` in §6.1;
   - 2/4/8-week reads: dashboard by `lvl` vs previous `lvl`, same calendar weeks, per platform, then vs trailing 8 weeks (P06.3 rule); record in `experiments.md` and §6.1;
   - Monday weekly DB check run (T02 `queries/db`), annotation when a threshold is crossed;
   - PostHog writes listed per release for **one** batched owner approval (D2).
2. Plan §6.1 status table is the tracker (already drafted) — add a "how to update" note.

## How
Docs only. Cite the runbook lines you extend. Include a filled example row (TR0 on 3.26.0 Android) as a template.

## Acceptance criteria
- [ ] Both runbooks have the section; `pnpm check:agent-docs` passes (only existing paths/scripts cited).
- [ ] The section names the annotation format, the per-runtime OTA steps and the 2/4/8-week read.
- [ ] An example row in plan §6 and §6.1.

## Verification
`pnpm check:agent-docs`; a second agent can follow the section to annotate a dry-run release without asking questions (review in PR).

## Friction spec
FS-M (procedure part). Repro: a fix ships with no annotation and no recorded baseline → cannot be read. Expected: every go-live has an annotation + §6 row + §6.1 status. Automated check: `pnpm check:agent-docs` (CI) for path validity; the annotation itself is checked in T03b (`annotations` list shows the entry).

## Production metric
PostHog annotations list per release: count of `#365 fixes:` annotations = count of §6 rows (target equal). Dashboard: annotations show on every T03b tile. Annotate the release in PostHog when it ships — this task defines how.

## Release
Docs commit. No app change.

## Dependencies
- Blocked by: T02.
- Blocks: T03b, T05e, TR0, T07a and every later deploy.

## Out of scope
Creating the dashboard (T03b); publishing any OTA.

## Constraints
OTA only with `--environment production` or the workflow, never a local env file, only with owner go-ahead (CLAUDE.md hard rule).
