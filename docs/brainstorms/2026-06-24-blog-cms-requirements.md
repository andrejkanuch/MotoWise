# Blog CMS — Extensible, Postgres-backed Content Platform

**Date:** 2026-06-24
**Status:** Requirements (ready for planning)
**Scope tier:** Deep — feature (architectural)
**Origin:** Follow-on from the decision to move the web blog off file-based MDX into Postgres (see commit context on `feat/bike-document-vault`).

---

## Problem

The web blog is 50 MDX files on disk (`apps/web/content/blog/**`, 34 EN + de/es/fr/it), read synchronously by `apps/web/src/lib/blog.ts`. Every post is the same undifferentiated shape, authored only by committing files, with no search and no way to model genuinely different kinds of content. The Africa Twin maintenance generator already strains this model — it writes MDX files and triggers ISR revalidation as a workaround for not having a content store.

We want a **proper, extensible CMS** that can carry distinct content types (maintenance guides, trip stories, gear reviews, and more over time), with keywords, categories, and reader-facing search — built so adding the next content type is cheap and safe.

## Outcome

A Postgres-backed CMS that is the **sole source of truth** for the public web blog. It supports multiple developer-defined content types sharing a common base, first-class taxonomy (categories + keywords), full-text reader search, and two authoring paths (admin rich editor + AI generation) behind a draft→review→publish workflow. The existing 50 MDX files are imported; the file-based pipeline is retired.

## Users / Actors

- **Reader (public, anon)** — browses and searches the blog on the web; filters by content type, category, keyword. Primary value: find relevant motorcycle content fast (SEO + engagement).
- **Editor / admin (internal)** — authors and edits posts in `/admin` with a rich editor, sets taxonomy + SEO fields, reviews AI drafts, schedules/publishes.
- **AI generation pipeline (system)** — produces draft posts programmatically (e.g. maintenance schedules from verified data), landing as drafts for human review before publish.

## Goals

- Model multiple content **types** with type-specific fields, sharing common fields, without per-type query/maintenance pain.
- Make **adding a new content type** a small, well-trodden code change (new table + registration), not a re-architecture.
- First-class **categories** (hierarchical, browsable) and **keywords** (flat tags).
- **Public full-text search** across posts with filtering by type/category/keyword.
- Two authoring paths — **admin rich editor** and **AI-generated drafts** — both feeding a **draft / published / scheduled** workflow with revision history.
- Preserve current SEO behavior: canonical/hreflang, structured data (Article, FAQPage, Breadcrumb), sitemap, RSS feed, the `specData` disclaimer.
- Postgres = sole source of truth; import the 50 existing MDX files; delete the file pipeline.

## Non-goals (this iteration)

- **No runtime/dynamic content-type builder** (Strapi/Sanity-style schema-on-read). Types are defined in code. Explicitly out to avoid the EAV/over-abstraction trap.
- **No block-based JSON body editor** (Lexical/Tiptap/Portable Text) now. Body stays MDX; a `body_json` column is reserved for a future migration.
- **No unification with the mobile `articles` table** (in-app Learn tab, quizzes, learning-progress). It stays separate. CMS is web-only this round.
- **No external search engine** (Algolia/Typesense/Meilisearch) now. Postgres FTS only, with a documented upgrade path.
- **No comments, no reactions, no per-reader personalization.**

## Recommended architecture (mechanism level)

> This brainstorm is architectural by request, so the data model is in scope. Exact column types, migration ordering, and resolver shapes are for `ce-plan`.

### Content model — Class-Table Inheritance (CTI) + JSONB overflow

- **`blog_posts`** (base): everything shared — `id`, `type` discriminator, `slug`, `status`, `published_at`/`scheduled_at`, `author`, SEO fields, timestamps, and a generated `search_vector`. (Named `blog_posts`, not `articles`, to avoid colliding with the existing mobile `articles` table.)
- **Per-type tables** (`blog_post_maintenance`, `blog_post_trip`, `blog_post_gear`, …): `post_id` FK (PK) + only that type's typed fields + a `meta jsonb` overflow valve. New type-specific fields start in `meta`, graduate to typed columns once stable.
- **`type`** constrained via a `content_types` lookup (or CHECK) so illegal types are a DB error.
- **Rationale:** types have genuinely different fields (a gear review has `rating`/`brand`/`price`; a maintenance guide has `difficulty`/`tool_list`/`applicable_models`). CTI keeps those enforced and NULL-free; the JSONB valve gives zero-migration field additions. This is the Payload CMS pattern adapted to a code-first NestJS/Postgres stack.

### Body storage

- **`blog_post_bodies`** (or columns on the translation table): `format` discriminator (`mdx` today), `raw` (MDX source — source of truth), `rendered_html` (cached server render, invalidated on update), `body_json` (reserved, null today).
- Edited via a **markdown-aware rich editor** in admin; AI emits MDX directly; existing files import verbatim.
- MDX/JSX tags stripped before feeding the search index.

### Taxonomy

- **`categories`** — hierarchical (self-referential `parent_id`, cap 2–3 levels), browsable, curated.
- **`keywords`** — flat tags, many per post, editorial + search boost.
- **M2M joins** (`blog_post_categories` with `is_primary`, `blog_post_keywords`). Kept as separate concepts because browse-hierarchy vs related/tag query patterns diverge.

### Search

- Postgres FTS: `search_vector` generated column weighting title (A) > excerpt (B) > keywords/body (C); GIN index; query with `websearch_to_tsquery`.
- `pg_trgm` GIN index on title for typo tolerance.
- Recency boost on ranking; `status='published'` filter.
- **Upgrade path:** Meilisearch (self-hosted ~$20/mo, synced via NestJS publish/update event listener) only at ~500+ posts or on faceting/typo complaints. Postgres stays source of truth.

### Workflow, versioning, scheduling

- `status` ∈ `draft | published | scheduled`; `published_at` / `scheduled_at`.
- Scheduled publish flips via a NestJS (`@nestjs/schedule`) cron checking `scheduled_at <= now()`.
- **`blog_post_versions`** — full JSONB snapshot per revision (base + type + body), admin-only via RLS.
- AI-generated posts enter as `draft` and reuse the existing admin-review gate pattern (cf. `oem-schedules` maintenance review).

### Localization

- **`blog_post_translations`** keyed `(post_id, locale)` holding translatable fields (title, excerpt, SEO, body); non-translatable fields (slug, dates, type-specific data) stay on base. hreflang derived from the set of existing locales. Preserves today's en-fallback.

### Consumption / API

- Web reads via a Supabase anon client against public-read RLS (`status='published'`), keeping blog pages statically generatable. `apps/web/src/lib/blog.ts` is rewritten to query Postgres (functions become async; all call sites already async).
- A NestJS GraphQL read layer (`BlogPostBase` interface + per-type object types) is designed so mobile *could* consume later; admin CRUD goes through the API for consistency with the existing admin section.

## Approaches considered

1. **CTI + JSONB overflow (recommended).** Base table + per-type tables + JSONB valve. Best balance of type safety, query ergonomics, and cheap extensibility for a code-first solo-dev stack.
2. **Single-Table Inheritance (one table + `type` + nullable/JSONB fields).** Simpler for 2–3 near-identical types; degrades to a NULL-heavy table with no DB-level enforcement once types diverge — which they do here. Rejected.
3. **Dynamic schema-on-read (Strapi/Sanity/Directus-style).** Maximum flexibility, runtime type definition; large complexity surface, weaker type safety, EAV risk. Mismatched to "developer adds types in code." Rejected for this round (and as a non-goal).

## Success criteria

- All 50 existing MDX posts are imported and render identically (SEO tags, structured data, FAQ, disclaimer, hero images intact); the `content/blog/` directory is removed.
- Adding a brand-new content type is demonstrably a single migration + code registration with no changes to base queries or search.
- A reader can search the blog (title/body/keywords) and filter by type/category/keyword, with typo tolerance on titles.
- An editor can create, edit, schedule, and publish a post (and revert to a prior revision) entirely in `/admin`.
- An AI-generated post (the Africa Twin maintenance path) lands as a draft, is reviewable/approvable in admin, and publishes to Postgres (no MDX file written).
- Sitemap, RSS feed, canonical/hreflang continue to work from the DB.

## Dependencies / Assumptions

- Supabase env vars available at web build time (already true for other server reads).
- Hero images stay as static assets in `apps/web/public/images/blog/`; only body text moves to Postgres.
- A markdown-aware rich editor library will be selected in planning (assumption: one exists that fits; e.g. Milkdown/Tiptap-markdown). *Unverified — to confirm in planning.*
- Existing on-demand revalidation endpoint (`apps/web/src/app/api/revalidate/route.ts`) is reused for publish-time cache invalidation.
- The mobile `articles` table and its GraphQL surface are untouched.

## Resolved decisions (2026-06-24)

- **Body format:** MDX-as-source + cached `rendered_html` + reserved `body_json` (future block editor). Render with `compileMDX` and **`blockJS: true`** to disable JS evaluation on DB-stored content (content is trusted — admin-authored or AI-generated-then-reviewed — and `blockJS` closes the `eval` risk MDX otherwise carries). Verified against `next-mdx-remote` + `@mdx-js/mdx` docs (Context7, 2026-06-24): loading MDX from a database is the library's documented, intended pattern; rendering step is unchanged from today's file-based `compileMDX`.
- **Admin CRUD transport:** GraphQL via NestJS — consistent with the existing `/admin` (maintenance-review).
- **v1 content types:** `guide` (migrates the 50 existing posts), `maintenance` (Africa Twin AI path), **plus `trip` and `gear`** — the latter two shipped now as a live demonstration that adding a type is cheap.
- **Locale rollout:** import only existing locales (en + de/es/fr/it); do not stub all 8.
- **Versioning:** snapshot on publish (not every save).

## Outstanding questions (for planning)

- **Editor library** choice for markdown WYSIWYG in admin (candidates: Milkdown, Tiptap-markdown) — to select in planning.
- **Versioning retention limit** (how many snapshots to keep per post).

## Reference — research basis

Architecture validated by a deep research pass (2026-06-24): CTI+JSONB matches Payload CMS; Postgres FTS benchmarked competitive at this scale (Supabase); WordPress `wp_postmeta` EAV as the cautionary tale; per-entity translation tables for i18n; full-snapshot JSONB versioning (Strapi/Payload). Key sources: Payload Postgres + Versions docs, Supabase "Postgres FTS vs the rest", table-inheritance pattern comparisons, Sanity Portable Text guide.
