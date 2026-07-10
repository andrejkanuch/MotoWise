---
name: phase-start
description: Execute all tasks in a feature phase autonomously — explore, write tests, implement, verify. Use after /feature-plan produces an EXECUTION_PLAN.md. Stops and escalates when stuck.
argument-hint: '<phase-number> <feature-name>'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch
---

# Phase Start (MotoVault)

Execute every task in Phase `$1` of `features/$2/EXECUTION_PLAN.md`.

## Guardrails (check first)

1. **Not on `main`.** `git branch --show-current` must not be `main`/`master`. If it is, STOP —
   tell the user to `git checkout -b feat/<name>` first. (Pre-push runs `pnpm precheck`; keep main green.)
2. `features/$2/EXECUTION_PLAN.md` exists. If not, STOP — run `/feature-plan $2` first.
3. Read `PROJECT_ROOT/CLAUDE.md`, the relevant app's `CLAUDE.md`, and `.claude/verification-config.json`.

## Per-task loop (test → implement → verify)

For each task in the phase, in plan order:

1. **Explore before writing.** Search for the pattern this task should follow; list the reusable
   utilities/components. Never duplicate what exists.
2. **External integrations:** if the task calls an external service (Supabase, RevenueCat, Anthropic,
   NHTSA, Mapbox), fetch current docs first — prefer the Context7 MCP; fall back to WebFetch. Don't
   code integrations from memory.
3. **Write tests first**, one per `TEST` acceptance criterion, following `/write-tests`
   (Vitest for api/web, jest-expo for mobile; clean Supabase mocks, never brittle chains).
4. **Implement the minimum** to satisfy the criteria, following discovered patterns and MotoVault rules:
   - Never edit generated files (`packages/graphql/src/generated`, `database.types.ts`,
     `apps/api/schema.graphql`) — they're protected; regenerate with `pnpm generate`.
   - Map snake_case → camelCase at the NestJS service layer; never expose snake_case to clients.
   - `SUPABASE_USER` for user-scoped CRUD; never service-role for user-scoped writes.
   - New tables require RLS. Colors from `@motovault/design-system` palette; no `any` for GraphQL data.
5. **Regenerate if needed:** touched a `.graphql` file, resolver, model, or migration → `pnpm generate`.
6. **Verify the task** against its acceptance criteria:
   - `TEST` → `pnpm --filter <pkg> test`
   - `TYPE` → `pnpm typecheck`
   - `BROWSER`/`DEVICE`/`E2E` → the tool from `verification-config.json` (Playwright / Chrome DevTools /
     XcodeBuildMCP+axe / Maestro)
7. Tick the task's checkbox in EXECUTION_PLAN.md (`- [ ]` → `- [x]`).
8. **Do NOT commit between tasks.** Leave the cumulative diff in the working tree for one phase commit.

## Git

- WIP-commit any pre-existing dirty files once at the start, so the phase's diff is only this phase's work.
- No per-task commits. No pushing. After the phase, present `git diff --stat` and let the user review in
  the Source Control panel, then create one commit: `phase($1): <phase description>` (task→REQ mapping in the body).

## Stuck detection — STOP and escalate

Track failures per task. Escalate to the user (don't grind) when ANY holds:

| Trigger | Threshold |
|---------|-----------|
| Consecutive task failures | 3 |
| Same error string recurs | 2× |
| Same criterion re-verified and still failing | 5× |
| A test passes then fails (flaky) | on first observation |

When stuck, report: the failing pattern, attempt count, last 3 errors, 2 hypotheses, and options
(skip / adjust criteria / different approach / hand back). Never reduce test coverage to force a pass.

## Completion

Report: what each task built (task id → one line), files changed, task→REQ mapping, any issues,
and that the working tree is **uncommitted, ready for review**. Then, if the phase is green
(`pnpm precheck` passes) with no blocking `MANUAL` items, offer `/phase-checkpoint $1 $2`.
