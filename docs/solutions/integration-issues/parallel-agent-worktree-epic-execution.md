---
title: "Executing a 13-ticket epic in parallel using agent worktrees"
category: integration-issues
date: 2026-03-12
tags: [agent-teams, worktrees, parallel-execution, merge-conflicts, rebrand, ci-cd]
tickets: [MOT-131, MOT-118, MOT-119, MOT-120, MOT-121, MOT-122, MOT-123, MOT-124, MOT-125, MOT-126, MOT-127, MOT-128, MOT-129, MOT-130]
---

## Problem

Need to implement 13 sub-tickets of a pre-launch readiness epic (MOT-131) efficiently. Sequential execution would take weeks. The tickets span mobile, API, web, types, and database layers with varying levels of interdependency.

## Root Cause

Not a bug — this was an execution strategy challenge. The key insight: most tickets touch independent files/modules and can be parallelized, but merging and CI/CD compatibility require careful orchestration.

## Solution

### 1. Group tickets by file overlap into 6 agents

Each agent got 1-3 tickets with minimal file conflicts:

| Agent | Tickets | Layer |
|-------|---------|-------|
| subscriptions | MOT-118 | mobile (hooks, stores, screens) |
| compliance | MOT-120, MOT-121 | API (users module) + mobile (privacy.tsx) |
| learn-tab | MOT-119, MOT-123 | mobile (learn tab screens) |
| security-cost | MOT-125, MOT-126, MOT-128 | API (diagnostics, articles, budget) |
| observability | MOT-124, MOT-129, MOT-127 | API + mobile (analytics, disclaimers) |
| web-brand | MOT-122, MOT-130 | web + full codebase rebrand |

### 2. Launch agents in isolated worktrees

```
Agent(isolation="worktree", mode="bypassPermissions", run_in_background=true)
```

Each agent ran `/slfg` (plan -> deepen -> swarm work -> review -> tests) for each ticket. All 6 ran simultaneously.

### 3. Merge order matters

Merge least-conflicting first, rebrand (167 files) last:
1. learn-tab (clean merge)
2. subscriptions (1 conflict in learn/index.tsx — combined pro gate + real mutation)
3. compliance (clean merge)
4. security-cost (1 conflict in limits.ts — kept both constant blocks)
5. observability (2 conflicts in _layout.tsx and article/[slug].tsx — combined features)
6. web-brand/rebrand (14 conflicts — all `@motolearn` -> `@motovault` import renames)

### 4. Post-merge fixes required

- **Worktree cleanup**: `.claude/worktrees/` dirs confused Biome linter. Fix: `rm -rf .claude/worktrees/agent-*` + `git worktree prune`
- **Package resolution**: After `@motolearn` -> `@motovault` rename, `pnpm install` needed to re-link workspace packages
- **Turbo cache**: Stale cache caused false typecheck failures. Fix: `rm -rf node_modules/.cache/turbo .turbo`
- **Missing i18n keys**: New features added translation keys not in the type-safe i18n definition
- **Leaked files**: Unrelated feature files (expenses) leaked into worktrees and needed removal
- **Migration renumbering**: Worktree agents created migrations with numbers already used remotely. Fix: renumber to next available (00032, 00033)

## Prevention

- **Always merge rebrand/rename PRs last** — they touch every file and cause the most conflicts
- **Run `pnpm install` after any package rename** before attempting typecheck
- **Add `.claude/worktrees/` to `.gitignore`** to prevent worktree dirs from being staged
- **Check `supabase migration list` before creating new migrations** to avoid number conflicts
- **Run the full pre-push pipeline locally** (`pnpm lint && pnpm typecheck && pnpm test`) before pushing, especially after merging multiple worktrees
