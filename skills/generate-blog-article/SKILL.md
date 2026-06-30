---
name: generate-blog-article
description: Autonomously researches real, cited source data and publishes one high-quality SEO blog article to the MotoVault blog CMS (Supabase). Alternates between auto-published informational GUIDES targeting real Search Console demand, and maintenance-SPEC drafts (researched from official manuals, staged for human verification). Every article records its sources and carries a verify-against-official-docs disclaimer plus an app-download conversion CTA. Trigger when asked to write a blog post, run the daily blog job, expand the blog, or publish an article.
---

# Generate Blog Article — MotoVault Blog CMS

## Context
MotoVault is a motorcycle maintenance/diagnostics/touring app. The blog is an SEO acquisition channel whose job is to rank for rider search demand and convert readers into app users.

- **Supabase Project ID:** `tpsoneenbrmdwvzcbifw`
- **MCP tool:** `mcp__36e8f95a-13f0-4b10-89a1-4a49a287e9be__execute_sql` (the same Supabase connector the route job uses)
- **Author string:** `MotoVault Editorial`
- **Reference files:** `references/db-schema.md` · `references/seo-targets.md` · `references/sourcing.md`

**Goal:** Publish exactly **one excellent article per run** — not many mediocre ones. Depth, accuracy, real cited sources, and SEO quality matter far more than volume. Put in high effort.

**Two article modes (see Step 2):**
- **GUIDE** — informational/how-to/comparison/cost content. No safety-critical numbers presented as authoritative. **Auto-published.**
- **SPEC (maintenance)** — per-model service intervals / torque / capacities researched from official manuals. **Created as a DRAFT** and left for a human to verify before publishing (safety-critical numerics must never auto-publish — this is a deliberate project rule).

---

## Step 1 — Survey existing coverage (avoid duplicates)

Run first:

```sql
SELECT p.type, p.slug, p.status, t.title
FROM blog_posts p
JOIN blog_post_translations t ON t.post_id = p.id AND t.locale = 'en'
ORDER BY p.created_at DESC;
```

Never reuse a slug or write a near-duplicate title/topic of an existing post. Pick a genuinely new angle or model.

---

## Step 2 — Choose the mode and the target

Decide GUIDE vs SPEC by the day of year (alternate):

```sql
SELECT (extract(doy from now())::int % 2) AS parity;  -- 0 = GUIDE, 1 = SPEC
```

- **parity 0 → GUIDE.** Open `references/seo-targets.md` and pick the highest-priority target query NOT already covered by an existing post (from Step 1). These targets are real Google Search Console demand for motovault.app — pages we already impress on but under-serve.
- **parity 1 → SPEC.** Pick the next motorcycle model worth a maintenance-schedule article (high search demand: see the "service intervals" cluster in `references/seo-targets.md`). Confirm the model isn't already covered.

If the chosen mode has no good remaining target, fall back to the other mode rather than producing a weak article.

---

## Step 3 — Research real data and capture sources (mandatory, high effort)

**You may not invent facts.** Every non-obvious claim, and every number, must come from a real source you actually read.

1. Use `WebSearch` + `WebFetch` to gather authoritative material:
   - **GUIDE:** manufacturer documentation, official safety bodies (NHTSA, FIM), reputable OEM/dealer guidance, and well-established moto publications. Prefer primary sources.
   - **SPEC:** the model's **official owner's manual** (free OEM PDF) and/or manufacturer service-interval pages. Extract facts only (intervals, torque, capacities, valve clearances) — never copy prose, procedures, diagrams, or verbatim tables.
2. **Record where every value came from.** Keep a running list of `{title, url, what it sourced}`. This list becomes:
   - a **"Sources" section at the end of the article body** (real links), AND
   - for SPEC mode, rows in `maintenance_data_sources` + provenance columns on the spec rows (see `references/db-schema.md`).
3. Verify each number against **at least two independent sources** where possible. If sources disagree on a safety-critical number, present a range and flag it — do not guess.
4. Convert metric → imperial where useful, and show both (e.g. `6,000 km / 3,728 mi`, `25 Nm / 18.4 lb-ft`).

Read `references/sourcing.md` for the full sourcing, citation, and provenance rules before writing.

---

## Step 4 — Write the article (SEO + conversion quality bar)

Follow every rule in `references/seo-targets.md` ("Writing rules"). In short:

- **Title (`title` / `seo_title`):** ≤ 60 chars, target keyword near the front, specific and clickable. Match how people actually search (e.g. "MT-09 Service Intervals & Oil Change Schedule").
- **Meta (`seo_description`):** 150–160 chars, includes the keyword and a benefit + soft CTA.
- **Body (`body_raw`, MDX):** 1,200–2,000 words. Target keyword in the first 100 words. Logical `##`/`###` headings (these feed the table of contents). Use GFM tables for any spec/interval data. 2–4 internal links to related existing posts (`/blog/<slug>`). Scannable, genuinely useful, no fluff.
- **MDX safety:** use `{/* comments */}` (JSX), never `<!-- html -->`. Plain GFM only.
- **FAQ:** 3–5 real question/answer pairs (`faq` jsonb). These render as an FAQ section and power FAQ schema — strong for SEO. Base them on the actual search intent.
- **Sources section:** end the body with a `## Sources` heading listing the real references with links.
- **Disclaimer + conversion CTA:** the public page template renders the verify-against-official-docs disclaimer **and** the "keep your bike healthy / never miss a service" download CTA on every article automatically — you do NOT hand-write those. For SPEC articles you MUST set `spec_data = true` so the stronger maintenance disclaimer shows. You may add one tasteful in-body line near the top tying the topic to the app (e.g. "Track this schedule automatically in MotoVault") but keep it natural, not spammy.

---

## Step 5 — Insert into the CMS

Use the exact SQL patterns in `references/db-schema.md`. The shape:

1. Upsert `blog_posts` (set `type`, `slug`, `status`, `spec_data`, `is_safety_critical`, `author`, `published_at`).
   - **GUIDE:** `status='published'`, `published_at=now()`.
   - **SPEC:** `status='draft'`, `published_at=NULL`, `spec_data=true`, `is_safety_critical=true`.
2. Upsert per-type row: `blog_post_guide` (difficulty) or `blog_post_maintenance` (make/model/variant/dataset_models).
3. Upsert `blog_post_translations` (locale `'en'`): `title`, `excerpt`, `seo_title`, `seo_description`, `body_raw`, `body_text` (plain-text strip of the MDX), `keyword_text`, `faq`, `reading_time`, `word_count`.
4. Attach taxonomy: map to an existing `categories` slug (one primary) and 3–6 `keywords` (create missing keywords). See db-schema.md for the join inserts.
5. **SPEC only:** insert a `maintenance_data_sources` row per manual, and stage the extracted values with `is_verified=false` + `source_id` so a human can verify and publish later.

`search_vector` is trigger-maintained — do not set it.

---

## Step 6 — Revalidate & verify

1. Trigger ISR revalidation (best-effort; skip silently if env vars are absent):
   `POST {WEB_URL}/api/revalidate` with header `x-revalidate-secret: {REVALIDATE_SECRET}` and body `{"paths":["/blog/<slug>"]}`.
2. Verify the write:

```sql
SELECT p.type, p.slug, p.status, p.spec_data, p.is_safety_critical,
       t.title, t.word_count, t.reading_time,
       jsonb_array_length(t.faq) AS faq_count,
       (SELECT count(*) FROM blog_post_keywords k WHERE k.post_id = p.id) AS keywords,
       (SELECT count(*) FROM blog_post_categories c WHERE c.post_id = p.id) AS categories
FROM blog_posts p
JOIN blog_post_translations t ON t.post_id = p.id AND t.locale='en'
WHERE p.slug = '<slug>';
```

Every row must show: a non-empty title, `word_count` in range, `faq_count` ≥ 3, `keywords` ≥ 3, `categories` ≥ 1, and the correct `status` for the mode. If anything is missing, fix it before finishing.

3. Report: the mode, slug, title, status, target keyword, word count, and the list of sources used.

---

## Quality rules (hard)
- **One great article per run.** Never sacrifice accuracy or depth for speed.
- **No invented facts or numbers.** Cite real sources you actually read; record them in the body and (for specs) in `maintenance_data_sources`.
- **Never auto-publish safety-critical maintenance numbers.** SPEC articles are always drafts (`status='draft'`) for human verification.
- **No duplicate slugs/topics.** Check Step 1.
- **SEO discipline:** real keyword target, tight title/meta, headings, FAQ, internal links, both metric & imperial units.
- **Conversion + disclaimer** are rendered by the template on every page; set `spec_data=true` for spec posts so the stronger disclaimer appears.
- **English only** for now (`locale='en'`). Do not fabricate other-language translations.
