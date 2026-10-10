---
title: "Vercel builds for production only: git.deploymentEnabled plus ignoreCommand, both required"
category: integration-issues
date: 2026-08-24
tags: [vercel, deployments, preview, cost, minimatch, ignore-command, turbo-ignore, vercel-json]
module: web deployment (apps/web/vercel.json)
symptom: "Preview builds were about 75% of all builds and Build CPU Minutes was 45% of the Vercel bill"
root_cause: "Vercel has no project-level production-only switch; a bare {\"main\": true} block in git.deploymentEnabled is dead config because unspecified branches default to true"
---

# Vercel builds for production only: `git.deploymentEnabled` plus `ignoreCommand`

This document holds the narrative that used to live in the root `CLAUDE.md`
("Repo maintenance"). The text of each section is moved from there unchanged. The
one-line rules stay in `apps/web/CLAUDE.md`; this is the why.

## The rules

- `apps/web/vercel.json` is authoritative. Change build rules there, in review, never in
  the Vercel dashboard.
- Both layers stay: `git.deploymentEnabled` with the catch-all `false` patterns and
  `main: true`, and the `ignoreCommand`.

## Web / Vercel build config

`apps/web/vercel.json` is authoritative. Its `ignoreCommand` **overrides** the dashboard's "Ignored Build Step" — a custom command set there is silently dead config. Change the rule in `vercel.json`, in review — not in the dashboard. `vercel.json` rejects unknown keys, so it cannot carry comments.

## Web / production-only deployments (cost control, 2026-08-11 → 2026-08-24)

Two layers, both required.

1. `git.deploymentEnabled` stops the **deployment from being created at all** — no container, no clone, no build minutes, no PR comment. Keys are **minimatch** patterns and "if a branch matches multiple rules and at least one is `true`, a deployment occurs", so `{"**": false, "*": false, "main": true}` *does* express "main only". The earlier note that it cannot was wrong: it was inferred from a bare `{"main": true}` block, which is dead config because unspecified branches default to `true` — the fix is the catch-all `false`, not abandoning the key. Both `**` and `*` are listed because plain `*` does not cross `/`, and branch names here are `feat/…`, `chore/…`, `dependabot/…`. Fail-safe by construction: if a pattern ever stops matching, the branch falls back to `true` (a preview), and `main` can never be blocked because its explicit `true` wins.
2. `ignoreCommand` stays as the second layer — it still exits 0 for any non-production deployment that reaches a build container anyway (deploy hooks, `vercel deploy`, a branch whose commit predates this config), then falls through to `turbo-ignore` so pushes to `main` that do not touch the web app skip too.

Why: preview builds were ~75% of all builds and Build CPU Minutes was 45% of the Vercel bill (~$30/mo of a ~$68/mo run-rate). Vercel has **no** project-level "production only" switch — `gitProviderOptions.createDeployments` is `enabled`/`disabled` for the whole project and would kill production with it. Caveat: `git.deploymentEnabled` is read from the vercel.json **on the pushed commit**, so a long-lived branch cut before 2026-08-24 still creates previews until it is rebased on `main`. Trade-off: the 404 contract check runs on the **production** `deployment_status` after merge instead of on a preview before it, so a soft-404 regression is caught minutes later rather than in review — `apps/web/src/app/__tests__/not-found-contract.test.ts` is still the pre-merge guard.

## Related

- `docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md` — the
  404 contract whose check moved from preview to production because of this change.
