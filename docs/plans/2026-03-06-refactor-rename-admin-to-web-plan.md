---
title: "refactor: Rename apps/admin to apps/web with admin sub-pages"
type: refactor
status: completed
date: 2026-03-06
---

# refactor: Rename apps/admin to apps/web with admin sub-pages

## Overview

Rename the `apps/admin` Next.js app to `apps/web`, making it the primary web application with admin functionality living under a `/admin` sub-path. The package name changes from `@motovault/admin` to `@motovault/web`.

## Problem Statement / Motivation

The current `apps/admin` is a dedicated admin-only app. The user wants it to be a regular web app that can serve public-facing pages in the future, with admin dashboard pages nested under an `/admin` route. This better reflects the app's role as the web presence of MotoVault.

## Proposed Solution

1. Rename the directory `apps/admin/` → `apps/web/`
2. Update the package name to `@motovault/web`
3. Restructure routes: move `/dashboard/*` to `/admin/*`
4. Update all references across the monorepo

## Acceptance Criteria

- [x] Directory renamed from `apps/admin` to `apps/web`
- [x] Package name updated to `@motovault/web` in `apps/web/package.json`
- [x] Routes restructured: `/dashboard/*` → `/admin/*`
- [x] Root page (`/`) serves a public landing page (placeholder)
- [x] `/login` remains as login page
- [x] `/admin` protected by middleware (admin role check)
- [x] `/admin/articles`, `/admin/diagnostics`, `/admin/users`, `/admin/flags` all work
- [x] Codegen path updated in `packages/graphql/codegen.ts`
- [x] All CLAUDE.md files updated (root, web app, graphql package)
- [x] UI text updated: "MotoVault Admin" → "MotoVault" (public) / "MotoVault Admin" kept in admin section only
- [x] All 4 CI jobs pass: lint, typecheck, test, audit
- [x] `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` all pass

## Technical Approach

### Phase 1: Directory & Package Rename

- [x] `git mv apps/admin apps/web`
- [x] Update `apps/web/package.json`: name `@motovault/admin` → `@motovault/web`
- [x] Update `packages/graphql/codegen.ts`: path `apps/admin` → `apps/web`
- [x] Run `pnpm install` to regenerate lockfile

### Phase 2: Route Restructure

- [x] Rename `apps/web/src/app/dashboard/` → `apps/web/src/app/admin/`
- [x] Update sidebar links in admin layout from `/dashboard/*` to `/admin/*`
- [x] Update middleware matcher from `/dashboard/:path*` to `/admin/:path*`
- [x] Update root `page.tsx` redirect from `/dashboard` → public landing page
- [x] Create a simple public landing page at `/` (placeholder)

### Phase 3: Update References

- [x] Update root `CLAUDE.md`: `apps/admin` → `apps/web`, update description
- [x] Update `apps/web/CLAUDE.md`: title, commands (`--filter web`), description
- [x] Update `packages/graphql/CLAUDE.md`: admin → web references
- [x] Update UI text in layout.tsx, login page, admin dashboard

### Phase 4: Verify CI

- [x] Run `pnpm lint` — passes
- [x] Run `pnpm typecheck` — passes
- [x] Run `pnpm test` — passes
- [x] Run `pnpm build` — passes (or at least no new failures)

## Files to Modify

### Directory rename
- `apps/admin/` → `apps/web/` (git mv)

### Package identity
- `apps/web/package.json` — name field
- `packages/graphql/codegen.ts` — glob path

### Route restructure
- `apps/web/src/app/dashboard/` → `apps/web/src/app/admin/` (git mv)
- `apps/web/src/middleware.ts` — matcher pattern
- `apps/web/src/app/page.tsx` — redirect → landing page

### Documentation
- `CLAUDE.md` (root)
- `apps/web/CLAUDE.md`
- `packages/graphql/CLAUDE.md`

### UI text
- `apps/web/src/app/layout.tsx` — metadata title/description
- `apps/web/src/app/login/page.tsx` — heading
- `apps/web/src/app/admin/layout.tsx` — sidebar heading
- `apps/web/src/app/admin/page.tsx` — page heading

## What NOT to change

- All "admin" references in `apps/api/` that refer to the admin **role** (SUPABASE_ADMIN, admin enum)
- All "admin" references in `packages/types/` (role constants)
- All "admin" references in `supabase/migrations/` (RLS policies, is_admin())
- The middleware logic itself (still checks admin role)

## Sources

- Repo research: directory structure, all file references cataloged
- Past learning: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
