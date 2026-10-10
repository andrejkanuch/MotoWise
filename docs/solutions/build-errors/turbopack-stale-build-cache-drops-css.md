---
title: "A restored Turbopack build cache shipped auth and garage routes without their CSS tokens"
category: build-errors
date: 2026-10-06
tags: [nextjs, turbopack, build-cache, vercel, css, globals-css, mv-tokens, check-route-css]
module: web build (apps/web/next.config.ts, apps/web/scripts/check-route-css.mjs)
symptom: "/login, /signup, /garage and /welcome shipped to production without the --mv-* tokens; local and next dev builds were correct"
root_cause: "Next 16.3 turns the Turbopack file-system build cache on by default and Vercel restores .next/cache from the previous deployment, so the production build reused a stale compile of globals.css"
---

# A restored Turbopack build cache shipped routes without their CSS tokens

This document holds the narrative that used to live in the root `CLAUDE.md`
("Repo maintenance"). The text of the section below is moved from there unchanged. The
one-line rule stays in `apps/web/CLAUDE.md`; this is the why.

## The rule

Leave `turbopackFileSystemCacheForBuild: false` in `apps/web/next.config.ts`.
`apps/web/scripts/check-route-css.mjs` runs after `next build` and fails the build if
the bug recurs.

## Web / Turbopack build cache is OFF (`turbopackFileSystemCacheForBuild: false`)

Next 16.3 turns it on by default and Vercel restores `.next/cache` from the previous deployment. The #285 production build reused a stale compile of `globals.css` (its new `@import` of `mv-tokens.css` never reached the output; the global CSS chunk had the *same content hash* as #281's), so /login, /signup, /garage and /welcome shipped without the `--mv-*` tokens. Local and `next dev` builds were correct, so no pre-merge check saw it. `apps/web/scripts/check-route-css.mjs` runs after `next build` and fails the deployment if those routes' CSS (per `page_client-reference-manifest.js` `entryCSSFiles`) does not define `--mv-page`. Do not re-enable the cache without a reason stronger than ~10s of compile time.

## Where it is enforced

- `apps/web/next.config.ts` — the flag, with a comment recording the incident.
- `apps/web/package.json` — the `build` script is `next build && node scripts/check-route-css.mjs`.
- Fixed in #287.
