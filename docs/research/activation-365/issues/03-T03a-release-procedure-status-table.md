---
title: "[#365 T03a] Release-marking runbook: store builds only (D17), hotfix-OTA exception, annotations per platform, friction status table"
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
- Owner rule D17 (2026-11-12): every new functionality (features, UI, the experiment, events/instrumentation, testIDs) ships only in a new store build; OTA only for urgent crash or data-loss hotfixes.
- Without a fixed procedure, fix releases ship without annotation or baseline (review item 5), and levels mean different things on different branches (review item 3).

## What to change
1. `docs/runbooks/mobile-release.md` (after the OTA/E2E section ≈ line 56) and `docs/runbooks/mobile-ota.md` ("Before you publish"): a "#365 release marking" section:
   - level bump (`ACTIVATION_FIX_LEVEL`) only in the cut commit; update plan §6.1 (the only spec-to-level record; no map in code) in the same commit;
   - release paths (D17): #365 client work ships only in store builds (3.29.0 Release A, 3.30.0 Release B, then the next store build); API deploys and owner-applied migrations as before. A crash/data-loss hotfix OTA (the only OTA allowed) follows `docs/runbooks/mobile-ota.md`: target runtime + reach, for an older runtime a branch cut from the git commit of that runtime's latest production update group (`eas update:list --branch production` shows `gitCommitHash`), not the store build commit, published with the `Mobile OTA Update` workflow (git branch picker, `mobile-ota.md:24-31`), native-diff check (`:157-188`), owner go-ahead. **Exception (validation V3 §1):** a runtime with no production update group — today **3.27.0** — has no update commit to branch from, so its first hotfix branches from the **store-build commit `2ce57d1d`** (iOS b108 / Android vc95); record the latest group per runtime in the runbook (2026-11-12: 3.28.0 `fece7a3c`/`5a497a1c`, 3.26.0 `bd05b306`/`0b099fd3`, none on 3.27.0);
   - on go-live **per platform** (× runtime for a hotfix OTA): PostHog annotation `#365 fixes: <platform> <version|runtime+hotfix OTA id|api> lvl <N> — <spec ids>` dated the go-live day; row in plan §6; status `shipped` in §6.1;
   - 2/4/8-week reads: dashboard by `lvl` vs previous `lvl`, same calendar weeks, per platform, then vs trailing 8 weeks (P06.3 rule); record in `experiments.md` and §6.1; platform per person (plan §0 `{REL}`), S3 in its 24–48 h form; a thin Android cohort on the new level at the 2-week read (< 30 riders; Android upgrades slowly, V3 §4) is recorded "no verdict";
   - Monday weekly DB check run (T02 `queries/db`), annotation when a threshold is crossed;
   - PostHog writes listed per release for **one** batched owner approval (D2).
2. Plan §6.1 status table is the tracker (already drafted) — add a "how to update" note.

## How
Docs only. Cite the runbook lines you extend. Include a filled example row (Release A 3.29.0 on Android, lvl 2) as a template.

## Acceptance criteria
- [ ] Both runbooks have the section; `pnpm check:agent-docs` passes (only existing paths/scripts cited).
- [ ] The section names the annotation format, the store-build-only rule with the crash/data-loss hotfix-OTA steps (D17) and the 2/4/8-week read.
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
- Blocks: T03b, T05e, T07a, T18 and every later deploy.

## Out of scope
Creating the dashboard (T03b); publishing any OTA.

## Constraints
OTA only with `--environment production` or the workflow, never a local env file, only with owner go-ahead (CLAUDE.md hard rule).
