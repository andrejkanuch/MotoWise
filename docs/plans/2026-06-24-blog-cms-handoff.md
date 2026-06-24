# Blog CMS — Session Handoff

**Plan:** `docs/plans/2026-06-24-001-feat-blog-cms-postgres-plan.md`
**Branch / worktree:** `feat/blog-cms-postgres` at `.worktrees/feat/blog-cms-postgres` (off `main`)
**Date:** 2026-06-24

---

## State: ALL 10 UNITS COMPLETE — ready for PR review

The migration is **applied to production** (`tpsoneenbrmdwvzcbifw`, version `00157`; 11 blog tables live with RLS). The MDX→DB **import has been run against prod** (35 posts / 51 translations / 34 guide + 1 maintenance / 11 categories / 146 keywords) and the public blog **builds statically from the DB**.

### Done (committed)
- **U1** — `supabase/migrations/00157_blog_cms.sql`, applied to prod.
- **U2** — enums + Zod (`constants/enums.ts`, `validators/blog-post.ts`, `validators/blog-content-types.ts`, `utils/blog-text.ts`); `database.types.ts` regenerated.
- **U3** — `apps/web/scripts/migrate-blog-to-db.ts` (+ test). **RUN against prod** (idempotent upserts; safe to re-run).
- **U4** — `apps/api/src/modules/blog/` read layer + registered in `app.module.ts`.
- **U5** — admin mutations + versioning + revalidation + `blog-write.ts` (+ spec).
- **U6** — web GraphQL ops + `fragments/blog-post-fields.graphql`, regenerated `@motovault/graphql`. Commit `178c7042`.
- **U7** — public read rewrite: `lib/supabase-blog.ts` (cookie-less anon reader, `unstable_cache` tagged `blog`), `lib/blog.ts` now async + DB-backed, all call sites awaited (list, `[slug]`, sitemap, feed). Commit `254fc349`.
- **U8** — reader search + filters: `search_blog_posts` RPC via `/api/blog/search`, `lib/blog-filters.ts` (unit-tested), `components/marketing/blog-search.tsx`. Commit `254fc349`.
- **U9** — admin blog UI (`app/admin/blog/{page,new,[id]}`, `components/admin/{blog-editor,markdown-editor,blog-status}.tsx`, nav link). CodeMirror 6 source editor (KTD12). Commit `2c867e73`.
- **U10** — `apps/web/scripts/generate-maintenance-article.ts` repointed to CMS tables.

**Backend additions during U6/U9** (extend U4/U5): `adminBlogPostVersions(id)` + `BlogPostVersion` (version drawer); `adminBlogCategories`/`adminBlogKeywords` + `createBlogCategory`/`createBlogKeyword` (taxonomy pickers).

**U9 v1 simplifications vs plan:** (1) `type` + `slug` are **create-only** (`UpdateBlogPostInput` carries neither → no orphaned per-type rows, no type-switch confirm). (2) No live MDX preview pane (would duplicate U7's server render + risk divergence; the source editor is lossless). (3) Per-row scheduling lives in the editor, not the list.

**U8 scope note:** type + category filters run client-side over the in-memory list; free-text `q` uses the FTS RPC. Keyword filtering is supported via `?keyword=` but there's no 146-item keyword picker UI (categories are the browse facet). New search UI strings are English literals (no next-intl keys added).

**Verified:** prod `pnpm --filter web build` statically generates `● /[locale]/blog` + `● /blog/[slug]` from the live DB (R8 ✓); `pnpm --filter {api,web} typecheck`, Biome, and 24 blog unit tests pass.

**Still needs a human pass (not blockers):**
- Admin `create→edit→publish→schedule→revert` end-to-end against a running web+api as an admin user (logic verified, not click-tested).
- New service methods are thin Supabase wrappers, not mock-tested (matches the module's existing untested service methods); `slugify` mirrors the tested import-script impl.

Commits: `93f70952` (migration) → `254fc349` (U7+U8). `git log --oneline 9a6a368a..HEAD`.

---

## Post-merge follow-up: delete the file pipeline

`apps/web/content/blog/**` is **still in the repo** — `blog.ts` no longer reads it (it's inert), but per the plan deletion is gated behind **live-site verification after deploy** + a render-parity pass over all EN posts + translations. Do this as a **separate commit** once the deployed site is confirmed serving from the DB (one-commit rollback via git history). U10 (generator no longer writes files) has already shipped, so nothing recreates the dir.

---

## (Shipped) U7 — Web read rewrite
- Add `apps/web/src/lib/supabase-blog.ts`: cookie-less anon reader — `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })` (no cookie adapter → stays static-generatable; KTD4/R8).
- Rewrite `apps/web/src/lib/blog.ts`: replace `readArticlesFromDisk` with Supabase queries (filter `status='published'` + locale, en-fallback). Keep the `Article` interface shape. **Functions become async** — update every sync call site: `blog/page.tsx`, `blog/[slug]/page.tsx` (incl. `generateMetadata` + `generateStaticParams`), `apps/web/src/app/sitemap.ts`, `apps/web/src/app/blog/feed.xml/route.ts`.
- Render body from `body_raw` via `compileMDX` with **`blockJS: true`** wrapped in `unstable_cache(tag:'blog')`. No `rendered_html` column (KTD11). Never pass HTML to `dangerouslySetInnerHTML`.
- Update `apps/web/src/lib/__tests__/blog-faq.test.ts`.
- **File deletion of `apps/web/content/blog/**` is GATED**: only after (a) the import has run + verified, (b) an all-34-posts render-parity check, (c) U10 has shipped. Keep in git history. Likely a *separate* follow-up commit, not part of U7.

### U8 — Public reader search + filters UI
- `apps/web/src/lib/blog.ts`: `searchBlogPosts(query, locale, filters)` calling the `search_blog_posts` RPC; `listByCategory`/`listByKeyword` via joins.
- `apps/web/src/app/[locale]/(marketing)/blog/page.tsx`: URL-param search on submit (`?q/type/category/keyword`), filter pills, loading skeleton / no-results / error states. New `blog-search.tsx` (palette tokens, no hardcoded colors).

### U9 — Admin blog UI
- `apps/web/src/app/admin/blog/{page,new,[id]}/page.tsx` (`'use client'` + TanStack Query + `gqlFetcher`, mirror `apps/web/src/app/admin/maintenance-review/page.tsx`).
- `apps/web/src/components/admin/{blog-editor,markdown-editor}.tsx` — **CodeMirror 6 source editor + preview** (KTD12; not WYSIWYG — MDX/JSX + `{/* SPEC_TABLES */}` markers must round-trip losslessly).
- Editor: locale tabs (en/es/de/fr/it), type-switch clears `typeData` behind a confirm + locks type after publish, loading/error/empty states, `datetime-local` schedule converting local→UTC, version-history drawer (revert).
- List: status badges (draft=gray, scheduled=amber, published=green), per-row publish/schedule/delete, query-key invalidation.
- Add a "Blog" link to `apps/web/src/app/admin/admin-nav.tsx`. Auth is automatic via `apps/web/src/proxy.ts` `adminAuth` (no per-page guard).

---

## Caveats / setup for the next session

1. **Worktree env (required for API schema-gen + codegen):** the worktree is NOT supabase-linked and its `.env` is web-only. Already copied `apps/api/.env` from the main checkout — keep it. `pnpm install` has been run in the worktree.
2. **Schema regen** (`pnpm --filter api generate:schema`) needs `apps/api/.env` present (it boots the Nest app). The standalone script strips the `# GENERATED` header — re-prepend it after regen so the schema diff stays clean.
3. **`pnpm generate:types` uses `--linked`** (worktree not linked). Regenerate types via `npx supabase gen types typescript --project-id tpsoneenbrmdwvzcbifw --schema public,graphql_public > packages/types/src/database.types.ts`, then `pnpm --filter @motovault/types build`.
4. **Import not run (prod data write):** `apps/web/scripts/migrate-blog-to-db.ts` writes ~50 **published** posts to prod. Get explicit user OK first. Needs `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` in the shell. U7 needs this data to render anything.
5. **Migration numbering:** prod is at `00157`. The worktree (off main) is missing `00150`–`00156` locally (they're on `feat/bike-document-vault`) — fine for everything except a fresh `supabase db push` from the worktree (would hit the history gap). Don't push migrations from the worktree; use the main checkout if another migration is needed.
6. **Pre-commit hook** runs GraphQL codegen when `*.graphql`/`schema.graphql` is staged and aborts if `packages/graphql/src/generated` would change — just `git add` the regenerated files and re-commit.
7. **Supabase MCP** is authenticated this session (`apply_migration`/`list_migrations`/`list_tables` available) — handy for verifying prod state.

## Verify commands
- API: `pnpm --filter api typecheck` ; `pnpm --filter api exec vitest run src/modules/blog/`
- Web scripts: `pnpm --filter web exec vitest run scripts/__tests__/`
- Types: `pnpm --filter @motovault/types build`
- Lint: `pnpm exec biome check <paths>`
