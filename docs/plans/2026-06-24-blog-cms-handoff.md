# Blog CMS — Session Handoff

**Plan:** `docs/plans/2026-06-24-001-feat-blog-cms-postgres-plan.md`
**Branch / worktree:** `feat/blog-cms-postgres` at `.worktrees/feat/blog-cms-postgres` (off `main`)
**Date:** 2026-06-24

---

## State: backend + admin path complete; public read rewrite remaining

8 of 10 units done and committed. The migration is **applied to production** (`tpsoneenbrmdwvzcbifw`, version `00157`, in the migration history; 11 blog tables live with RLS enabled).

### Done (committed)
- **U1** — `supabase/migrations/00157_blog_cms.sql`, applied to prod.
- **U2** — enums + Zod (`packages/types/src/constants/enums.ts`, `validators/blog-post.ts`, `validators/blog-content-types.ts`, `utils/blog-text.ts`); `database.types.ts` regenerated from live schema.
- **U3** — `apps/web/scripts/migrate-blog-to-db.ts` (+ test). **NOT yet run** (see Caveats).
- **U4** — `apps/api/src/modules/blog/` read layer (models, connection, service, resolver) + registered in `app.module.ts`.
- **U5** — same module: admin mutations + versioning + revalidation + `blog-write.ts` (+ spec).
- **U6** — web GraphQL ops (`apps/web/src/graphql/{queries,mutations}/*-blog-*.graphql` + `fragments/blog-post-fields.graphql`), regenerated `@motovault/graphql`. Commit `178c7042`.
- **U9** — admin blog UI (`apps/web/src/app/admin/blog/{page,new,[id]}`, `components/admin/{blog-editor,markdown-editor,blog-status}.tsx`, nav link). CodeMirror 6 source editor (KTD12). Commit `2c867e73`.
- **U10** — `apps/web/scripts/generate-maintenance-article.ts` repointed to CMS tables.

**Backend additions during U6/U9** (extend U4/U5 — the editor needed them): `adminBlogPostVersions(id)` query + `BlogPostVersion` model (version drawer); `adminBlogCategories`/`adminBlogKeywords` queries + `createBlogCategory`/`createBlogKeyword` mutations (taxonomy pickers). Schema regenerated.

**U9 v1 simplifications vs plan:** (1) post `type` + `slug` are **create-only** (immutable in edit) — `UpdateBlogPostInput` carries neither, so there are no orphaned per-type rows and no type-switch-clears-`typeData` confirm is needed. (2) No live MDX **preview pane** — true MDX+JSX render would duplicate U7's server pipeline and risk divergence; the source editor is lossless and authors verify on the published/draft page. (3) Per-row scheduling lives in the editor (datetime-local), not the list.

**Not yet verified end-to-end:** the admin create→edit→publish→revert walkthrough needs a running web+api against prod (auth as an admin). Typecheck (api+web), Biome, and the blog unit spec all pass. The new service methods are thin Supabase wrappers and are not mock-tested (matches the module's existing untested service methods); `slugify` mirrors the import script's tested impl.

Commits: `93f70952` (migration) → `2c867e73` (U9). `git log --oneline 9a6a368a..HEAD`.

---

## Remaining units (public-facing web — both blocked on the prod import)

> **Blocker:** U7/U8 render the public blog from Postgres, so they need the MDX→DB import (U3) **run against prod first** (Caveat 4 — needs explicit user OK + `SUPABASE_SERVICE_ROLE_KEY` in shell). Until then there is no published data to read.

### U7 — Web read rewrite (highest user value)
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
