---
name: phase-checkpoint
description: Run the full quality gate for a completed feature phase and produce a verification report before advancing or opening a PR. Use after /phase-start finishes a phase.
argument-hint: '<phase-number> <feature-name>'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# Phase Checkpoint (MotoVault)

Prove Phase `$1` of `features/$2` is actually done before advancing. Reads commands from
`.claude/verification-config.json` — never hardcode them here.

## Steps

1. **Confirm all Phase $1 tasks are checked** in `features/$2/EXECUTION_PLAN.md`. If any are open, STOP
   and say which — the phase isn't complete.

2. **Run the quality gate** (`quality_gate.command` from verification-config = `pnpm precheck`):
   `check:api-bans → check:router → check:arch → lint → typecheck → test`.
   Capture pass/fail per stage. If it fails, report the failing stage + output and STOP — do not advance.

3. **Run the phase's user-facing criteria** (from the "Phase $1 Checkpoint" section of the plan):
   - `BROWSER` → Playwright (`apps/web/e2e/`) / Chrome DevTools MCP against `:3000`
   - `DEVICE` → XcodeBuildMCP + axe on the simulator (needs Metro + API running)
   - `E2E` → `pnpm --filter @motovault/web exec playwright test` (web) / `pnpm --filter @motovault/mobile test:e2e` (Maestro)
   - Try to automate before declaring anything `MANUAL`.

4. **Knip (advisory):** if the phase added/removed modules, run `pnpm knip` and note any new unused
   files/exports/deps introduced by this phase (don't block on the pre-existing backlog).

5. **Regeneration sanity:** if the phase touched `.graphql`/resolvers/models/migrations, confirm
   `pnpm generate` produces no uncommitted diff (generated files are protected — they must be in sync).

## Report

Write `features/$2/verification/phase-$1.md`:

```markdown
# Phase $1 Checkpoint — <status: PASS | FAIL>

## Quality gate (pnpm precheck)
- api-bans: PASS/FAIL
- router:   PASS/FAIL
- arch:     PASS/FAIL
- lint:     PASS/FAIL
- typecheck: PASS/FAIL
- test:     PASS/FAIL (N passed)

## User-facing criteria
- <criterion> — PASS/FAIL (how verified)

## Advisory
- knip: <new issues this phase introduced, or "none">
- generate: <clean / drifted>

## Verdict
<Ready to advance to Phase N+1 / open a PR> OR <blockers to fix>
```

## Outcome

- **All green, no blocking `MANUAL`:** report ready. Offer the next phase (`/phase-start <N+1> $2`) or,
  if this was the last phase, offer to commit + open a PR (`/ce-commit-push-pr` or the repo's PR flow).
- **Any failure:** STOP. Report the specific failing gate/criterion with output. Do not advance, do not push.
