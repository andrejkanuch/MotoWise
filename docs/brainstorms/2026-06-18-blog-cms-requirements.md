# Blog CMS — Requirements

**Date:** 2026-06-18 (SEO additions grafted 2026-06-19)
**Status:** Ready for planning
**Scope:** Standard (DB migration + new admin surface in `apps/web`)
**Companion:** SEO & content strategy — `docs/brainstorms/2026-06-19-blog-seo-content-strategy.md` (rider-intent research, CTR fix, content→app conversion map). The SEO-growth schema fields below are sourced from its review.

## Problem & Motivation

The web blog is the single largest driver of non-branded organic visibility for MotoVault, but it is authored entirely by hand-editing MDX files and committing to git. That workflow is slow for paste-heavy and AI-generated content, isn't queryable, and ties every publish to a deploy. We want a database-backed blog with an admin authoring surface so posts can be created by pasting markdown in a UI **or** by inserting rows directly, with internationalization built in.

The work is **directionally validated by Search Console data** (see Appendix): the blog produces **74% of all site impressions** and traffic is accelerating sharply (**+1,649% impressions, +466% clicks** period-over-period), with the motorcycle maintenance-schedule cluster ranking at positions 7–10. The constraint is production velocity and SEO conversion — not whether blogging is worth it. This feature removes the velocity constraint.

## Goals & Success Criteria

- A new blog post can be published two ways: (1) pasting markdown + uploading a hero image in the admin UI, and (2) inserting a row directly into the database. **Both produce a live, correctly-rendered post with zero additional steps.**
- All 50 existing MDX posts are migrated into the database with **no loss of organic rankings** — every canonical URL, hreflang map, FAQ JSON-LD block, RSS entry, and sitemap URL is byte-equivalent or better after migration.
- The file-based MDX pipeline is fully retired; the database is the single source of truth for blog content.
- Time-to-publish for a new post drops from "edit file → commit → push → deploy" to "save in admin → live" (ISR/revalidate, no deploy).

## Actors

- **Author/admin (you + AI today):** creates, edits, and publishes posts via the admin UI or direct DB insert. Gated by `role='admin'` in `public.users`.
- **Future contributors (deferred):** the schema and admin shell should not *prevent* adding non-technical writers later, but no role/approval workflow is built in v1.
- **Readers:** unchanged — public marketing blog at `/[locale]/(marketing)/blog/...`.

## Direction (chosen)

**Approach A — Dedicated `blog_posts` table, markdown body, admin CRUD.** A blog-specific table kept separate from the mobile `articles` table (which serves in-app learning/diagnostics content with different semantics). Body stored as **markdown** so AI output, the existing renderer, and SEO control all keep working. Migration is a one-time import of the 50 MDX files into rows.

Rejected: **B (unify with mobile `articles`)** — would pollute the in-app learning/diagnostics experience with marketing listicles; different content semantics; riskier double migration. **C (rich-HTML WYSIWYG)** — fights the markdown renderer and SEO control, adds a sanitization burden, premature for a solo + AI workflow.

## In Scope (v1)

1. **`blog_posts` data model.** Two layers — the parity fields (preserve what exists) and the SEO-growth fields (added per the 2026-06-19 strategy review, below; built now so they need no second migration on already-ranking pages).
   - **Parity fields (carry every current frontmatter field):** `slug`, `title`, `excerpt`, markdown `body`, `keywords[]`, `date` (published), `dateModified`, `readingTime`/`wordCount`, `heroImage`, `heroAlt`, `category`, `faq[]` (question/answer pairs), `locale`, and a draft/published state.
   - **SEO-growth fields (new).** *(Audit 2026-06-22 — prioritize, don't add all equally. The "avoid a second migration on ranking pages" argument is real but only justifies fields with a near-term consumer. **Build now:** `seoTitle`, `metaDescription`, `ogTitle`, `ogImage` (+`heroImageWidth/Height`), `authorId`, `robotsNoindex`, `canonicalUrl`, `relatedSlugs`, the `updatedAt` trigger, and `blog_redirects`. **Keep nullable, zero content required:** `tlDr`/`keyTakeaways`. **Defer (no consumer/rendering logic yet for a solo author):** `clusterSlug`, `isPillar`, `showLastUpdated`+`changeSummary`, the `schema_type` toggle — a hardcoded hub page + `relatedSlugs` and an `updatedAt` trigger cover the same ground without the columns. The conversion-widget components are renderer work, not schema, and stay out of v1.)*
     - `seoTitle` + `metaDescription` (both nullable, fall back to `title`/`excerpt`) — lets SERP copy be tuned **without** changing the on-page H1. This is the #1 CTR lever and must exist from day one.
     - `ogTitle` (nullable, falls back to `seoTitle`/`title`) + `ogImage` (nullable, falls back to `heroImage`) with `heroImageWidth`/`heroImageHeight` for a valid `ImageObject` and stable CWV.
     - `authorId` — **FK to an authors registry, never free-text.** A typo or AI-inserted string silently drops all E-E-A-T `Person` schema. Migration must normalize the existing `Andrej Kanuch`-vs-`founder` inconsistency to real author rows.
     - Hub-and-spoke fields: `clusterSlug`, `isPillar` (bool), `relatedPosts[]` (curated slugs). Today's `getRelatedArticles()` links by category string only and cannot express pillar→spoke→sibling — this is hard to retrofit, so add it now.
     - `robotsNoindex` (bool) + `canonicalUrl` override (nullable) — gate sitemap/RSS inclusion on `published && !robotsNoindex` so thin/AI posts don't auto-index on a domain where the blog is 74% of impressions. **Validate `canonicalUrl` (audit 2026-06-22): null or within the `https://motovault.app/` origin only — at the admin UI AND as a DB `CHECK` — so a bad insert can't point a ranking page's canonical at an external domain and bleed link equity.**
     - Freshness: `showLastUpdated` (bool) + `changeSummary` (prompted on every edit to a published post) so visible "Last updated" and `dateModified` stay honest.
   - **Per-locale rows** keyed by `(slug, locale)`, preserving the current English-fallback behavior.
   - Self-contained: rendering reads straight from rows. No required derived field may depend on the admin UI to populate (reading time may be auto-computed via trigger/default, but a raw insert without it must still render).
2. **One-time migration script:** read all 50 MDX files (`apps/web/content/blog/{locale}/`) via `gray-matter` → insert rows. Includes a **parity check** that diffs generated canonical/hreflang/JSON-LD/RSS/sitemap output before vs. after, plus an **assertion that post-migration URLs are a superset of pre-migration URLs** (no ranking URL silently disappears).
3. **Rendering switched to the database:** list page, detail page, RSS feed, and sitemap read from `blog_posts` instead of the filesystem; markdown compiled by the existing renderer (`next-mdx-remote/rsc` + current rehype plugins). Existing SEO logic (canonical, hreflang map, FAQPage schema, English fallback) preserved.
4. **Admin CRUD** in the existing `/admin/articles` stub: list, create, edit, **paste markdown**, preview, save draft, publish, delete — gated by `role='admin'`.
5. **Supabase Storage image uploader** in the admin UI: upload hero (and inline) images to a Storage bucket instead of committing to `/public/images/`; returns a URL usable in markdown.
6. **Video as embed links** in markdown (YouTube/Vimeo URLs).
7. **Internationalization:** create/edit per-locale versions of a post; English fallback when a locale row is absent; hreflang tags emitted only for locales that exist (current behavior).
8. **`blog_redirects` table + slug-history:** an editable slug is the single biggest 404 risk — it would break the #1 ranking page instantly. On any slug change, auto-write an old→new redirect row; serve 301/308 via middleware. Migrate existing blog redirects from `next.config.ts` into the table so there's one source of truth. **Open-redirect guard (audit 2026-06-22): the redirect target must be a relative internal path — middleware enforces `startsWith('/')` and rejects `://` / leading `//` — so a DB insert (or compromised admin) can't turn the blog's redirect surface into an open redirect.**
9. **Hub-and-spoke rendering:** the detail page renders curated `relatedPosts[]` (falling back to category-based when empty), and brand/cluster **hub pages** list their spokes with `ItemList`/`BreadcrumbList` markup — the strongest lever for lifting the pos 7–10 maintenance cluster collectively.

## Out of Scope (v1)

- **Mobile unification / in-app surfacing.** Kept as a deliberate deferred seam (below), not built.
- **Editorial workflow:** approvals, multi-author roles/permissions beyond `admin`, scheduled publishing, content calendar.
- **WYSIWYG / rich-HTML editing.**
- **CTR/SEO copywriting** on underperforming pages (the sub-1% CTR problem). This build ships the *enabling fields* (`seoTitle`, `metaDescription`, hub linking); the actual title/meta rewrites and the hub-page content are a separate content task (see companion strategy doc, "CTR fix").
- **AI generation pipeline itself.** v1 accepts AI-produced markdown; it does not build the generator.

## Deferred Seam: mobile surfacing

Design the schema so a future "also show this post in the app" is a *small additive step* (e.g., a nullable opt-in flag + a read path), without merging into the `articles` table. Do not build it now. This keeps Approach B reachable without paying its cost or risk today.

> **Note on the Africa Twin pilot (audit 2026-06-22):** the maintenance data-sourcing pilot ships a generated maintenance article as a committed `.mdx` on the current file-based pipeline (it predates this CMS). That file is **disposable scaffolding** — it becomes one of the files this migration ingests, and the pilot's `dataset_models` frontmatter key is the file-based stand-in for the future `blog_posts` FK. The migration's URL-superset parity check must include it; no rendered URL or canonical should change when it moves into a row.

## SEO Parity Contract (hard requirement)

Because the migrated pages already rank and are accelerating, migration is only "done" when, for every existing post:
- Canonical URL is unchanged (or, if intentionally changed, a redirect row exists).
- Hreflang alternates match the pre-migration set exactly (only locales that have a real translation).
- FAQPage JSON-LD renders identically where `faq` exists.
- The post appears in `/blog/feed.xml` and the sitemap with unchanged URLs.
- Slug-based heading IDs / TOC extraction still work.
- Every pre-migration URL still resolves (200 or 301), verified by the URL-superset assertion in the migration script.

A regression in any of these on a ranking page blocks release.

> **Note on FAQ markup (2026-06-19 review):** Google **deprecated FAQ rich results on 2026-05-07** (HowTo back in 2023). Keep emitting `FAQPage` JSON-LD as **AI-citation insurance** (AI Overviews / Perplexity still parse it), but do **not** count it as a SERP-CTR lever. The CTR levers are `seoTitle`/`metaDescription` and `BreadcrumbList`, not FAQ snippets.

## Dependencies & Assumptions

- Supabase project with new tables (migration via `supabase/migrations/`): `blog_posts`, `blog_redirects` (old→new slug history), and an `authors` registry referenced by `blog_posts.authorId`. RLS: public read of published rows; writes restricted to `role='admin'`. Follows the project's per-table client rules.
- A Supabase Storage bucket for blog media with appropriate public-read / admin-write policies.
- The existing markdown/MDX renderer can compile markdown sourced from a DB string (assumed — MDX content is already compiled from a string via `next-mdx-remote/rsc`; verify during planning).
- ISR/`revalidate` is acceptable as the publish mechanism (no per-post deploy).
- Authoring is you + AI at launch; growth to a team is possible but unscheduled.

## De-risk spike findings (2026-06-18)

Resolved before planning:

- **Body format = plain markdown.** Audit of all 50 MDX files found zero JSX components, zero `import`/`export`, zero `{expression}` MDX braces, and no inline HTML — they are plain GitHub-flavored markdown. The DB `body` column stores plain markdown; no MDX-component support is needed in v1.
- **DB-sourcing is a drop-in.** The detail page already compiles from a string, not a file: `compileMDX({ source: article.content })` at `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx:129`. Migration = replace `readArticlesFromDisk` (`apps/web/src/lib/blog.ts`) with a Supabase query returning the same `Article` shape; every SEO helper, the RSS feed, and the sitemap keep working unchanged.
- **Only non-trivial render edit:** `getCanonicalArticleUrl` and `getArticleHreflangMap` call `readArticlesFromDisk(locale)` to test translation existence — these become "row exists for `(slug, locale)`" queries.

This lowers the migration risk materially: it is a field-for-field copy plus a data-source swap behind a stable interface, not a re-implementation.

## Open Questions (for planning)

- **Inline images:** uploader returns URLs pasted into markdown (simplest) vs. a richer insert affordance. Default to URL-return for v1.
- **Draft visibility:** are drafts previewable at a stable URL, or admin-only render? Default: admin-only preview.
- **Revalidation strategy:** on-demand revalidate on publish vs. time-based ISR. Default: on-demand if straightforward.
- **Bulk/direct-insert ergonomics:** do AI-generated posts arrive as SQL inserts, a seed file, or a small import endpoint? Affects how "direct DB insert" is exercised in practice.

---

## Appendix — Search Console findings (2026-03-20 → 2026-06-15)

Grounding for the "is the blog worth investing in" question. Source: GSC API (URL-prefix property `https://motovault.app/`).

| Signal | Value |
|---|---|
| Blog share of site impressions | **74.1%** (15,238 / 20,575) |
| Blog share of site clicks | 36.3% (85 / 234) |
| Blog clicks, 88 days | 85 (small absolute volume) |
| Trend (period 1 → period 3) | **+1,649% impressions/day, +466% clicks/day** |
| Top page | `/blog/yamaha-mt-r-series-maintenance-schedule` — 30 clicks, 3,936 impr, pos 7.6 |
| Winning cluster | Maintenance schedules: Yamaha, Honda, BMW, Kawasaki, Ducati, Harley |
| Structural weakness | Most high-impression pages sit at **pos 7–10 with sub-1% CTR** |

**Verdict:** the blog is a *marginal but rapidly accelerating* channel and the largest source of non-branded visibility. The lever is producing more of what ranks and fixing CTR — which is exactly what removing the authoring bottleneck enables. CTR fixes themselves are a separate content task (out of scope here).

**Current architecture (pre-migration):** file-based MDX in `apps/web/content/blog/{locale}/` (34 EN + 16 localized), loaded by `apps/web/src/lib/blog.ts`, rendered at `apps/web/src/app/[locale]/(marketing)/blog/`. The Supabase `articles` table is separate (mobile learning content). `apps/web/src/app/admin/articles/page.tsx` is a non-functional stub to be filled.
