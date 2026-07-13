---
name: feature-plan
description: Break a feature into phased, verifiable tasks with acceptance criteria and verification metadata. Use at the start of a non-trivial feature, before implementation. Produces features/<name>/EXECUTION_PLAN.md.
argument-hint: '<feature-name>'
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Feature Plan (MotoVault)

Turn a feature idea into an `EXECUTION_PLAN.md` that `/phase-start` can execute and
`/phase-checkpoint` can verify. Adapted for MotoVault's stack (Turborepo, NestJS+GraphQL,
Supabase+RLS, Expo mobile, Next.js web).

## Output

`features/$1/EXECUTION_PLAN.md` — phases, each a small set of tasks. Every task carries
**testable acceptance criteria** tagged with a verification type (below).

## Before planning — explore the codebase

Do NOT plan in a vacuum. First:
1. Search for similar existing functionality (don't duplicate) — `Grep`/`Glob` across `apps/` + `packages/`.
2. Identify the layers this feature touches, in MotoVault's dependency order (this is also the task order):
   1. Supabase migration (`supabase/migrations/`) + RLS policies — every new table needs RLS
   2. `pnpm generate:types` → Zod schemas in `packages/types`
   3. NestJS model/resolver/service in `apps/api` (map snake_case → camelCase at the service layer)
   4. `.graphql` operations + `pnpm generate`
   5. Mobile hooks/screens (`apps/mobile`) and/or web (`apps/web`), using `@motovault/graphql` types
3. Note the conventions to follow (from CLAUDE.md + the relevant app's CLAUDE.md).

Record the integration points found, so tasks reference real files, not guesses.

## Verification types (tag every acceptance criterion)

| Tag | Meaning | How it's verified |
|-----|---------|-------------------|
| `TEST` | Automated test proves it | `pnpm --filter <pkg> test` (Vitest/jest — see `/write-tests`) |
| `TYPE` | Type-level guarantee | `pnpm typecheck` |
| `GATE` | Full quality gate | `pnpm precheck` (api-bans, router, arch, lint, typecheck, test) |
| `BROWSER` | Web UI behavior | Playwright (`apps/web/e2e/`) or Chrome DevTools MCP against `:3000` |
| `DEVICE` | Mobile UI behavior | XcodeBuildMCP + axe on the simulator (ad-hoc), or a Maestro flow (`E2E`) |
| `E2E` | Committed end-to-end regression | Playwright (web) / Maestro (mobile) |
| `MANUAL` | Human judgment (copy, brand, feel) | Reviewer confirms |

Commands come from `.claude/verification-config.json` — keep criteria expressed in terms of it.

## Plan shape

```markdown
# Feature: <name>

## Context
- Problem / goal (1–3 sentences)
- Integration points found: <files, existing patterns to reuse>
- Out of scope: <deferred items>

## Phase 1: <slice>
Each phase is independently shippable and ends green on `pnpm precheck`.

- [ ] Task 1.1: <what>
  - Files: <paths>
  - Acceptance:
    - `TEST` <observable behavior a test asserts>
    - `TYPE` <type guarantee>
  - Requirement: REQ-XXX (optional)

## Phase 1 Checkpoint
- `GATE` pnpm precheck passes
- `E2E`/`DEVICE`/`BROWSER` <user-facing criteria, if any>
- `MANUAL` <anything needing human eyes>
```

## Rules
- **Small phases.** Each phase ends with a green `pnpm precheck` and is reviewable in one sitting.
- **Migrations are their own early task** — SQL + RLS + `pnpm generate` before any API code depends on the shape.
- **Every user-facing task gets a `DEVICE`/`BROWSER` or `E2E` criterion**, not just `TEST`.
- **Prefer editing existing patterns** over new abstractions (matches the codebase's simplicity bias).
- Defer anything out of scope to an explicit "Out of scope" list — don't silently drop it.

Next: `/phase-start 1 $1`.
