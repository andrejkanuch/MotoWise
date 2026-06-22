# Blog SEO & Content Strategy — Motorcycle Niche

**Date:** 2026-06-19
**Status:** Decision-ready
**Companion doc:** [`2026-06-18-blog-cms-requirements.md`](./2026-06-18-blog-cms-requirements.md) (the blog CMS build this strategy informs)
**Scope:** SEO + content + conversion strategy for the DB-backed blog CMS in `apps/web`, and the schema/admin additions required to support it.

---

## 1. Executive Summary

**Is the CMS proposal SEO-ready? Mostly — the foundation is right, but it ships with seven SEO-load-bearing gaps that must be grafted into the schema *now*, because each one would otherwise require a second migration on pages that already rank.**

What the proposal gets right (do not relitigate): the **SEO Parity Contract** (per-post byte-equivalence on canonical, hreflang, FAQPage JSON-LD, RSS, sitemap, heading-ID/TOC) is the correct release blocker for migrating revenue-relevant ranking pages; **plain markdown over WYSIWYG** preserves heading structure, `rehypeSlug` IDs, FAQ extraction, and the existing rehype pipeline; keeping **`blog_posts` separate from the mobile `articles` table** protects the `(slug, locale)` canonical/hreflang semantics; and the **de-risk spike** correctly proved migration is a data-source swap behind the stable `Article` interface (`compileMDX({ source })` at `blog/[slug]/page.tsx:129`), not a renderer rewrite.

The strategic situation, from real GSC data (2026-03-20 → 2026-06-15, source: GSC API URL-prefix property `https://motovault.app/`): **the blog drives 74.1% of site impressions but only 36.3% of clicks**, traffic is accelerating violently (**+1,649% impressions, +466% clicks** period-over-period), and the winning cluster is **brand maintenance schedules** (Yamaha/Honda/BMW/Kawasaki/Ducati/Harley) stuck at **positions 7–10 with sub-1% CTR**. We are building topical authority faster than we convert it. The CMS removes the *velocity* constraint; this strategy addresses the *conversion* constraint (impressions→clicks, and clicks→app installs).

### The 3–5 highest-leverage moves

1. **Add a slug-history + DB redirect table (`blog_redirects`) before any slug field becomes editable.** This is the single biggest risk to the accelerating asset: renaming the #1 page (`/blog/yamaha-mt-r-series-maintenance-schedule` — 30 clicks, 3,936 impr, pos 7.6) with no redirect 404s it instantly. The whole "publish without deploy" pitch breaks on redirects, which currently live in deploy-coupled `next.config.ts`. **Critical.**
2. **Decouple SERP copy from on-page copy** — add `seo_title`, `seo_description`, `og_title` (fallback to `title`/`excerpt`). Today one `title` feeds `<h1>`, `<title>`, and `og:title`; `excerpt` feeds both meta + OG description. This is the **cheapest lever against the sub-1% CTR problem** and must be in the schema now so the (out-of-scope) copy work needs no second migration.
3. **Build a brand-maintenance hub + curated internal linking** (`related_slugs` + an `ItemList` hub using the existing `buildItemList`). Tight hub-and-spoke between sibling brand guides is the classic way to push pos 7–10 → pos 1–5 *and* route on-page readers to the highest-converting posts.
4. **Store `author_id` (FK to the authors registry), not free-text author.** E-E-A-T `Article`+`Person` JSON-LD is built by joining `author` → `src/lib/authors.ts` (`getAuthor(article.author) ?? getDefaultAuthor()` at `page.tsx:141`). Current frontmatter is inconsistent (display name `Andrej Kanuch` vs registry id `founder`), silently falling back to default and stripping credibility on exactly the pages that need E-E-A-T to climb.
5. **Make every converting-cluster post inherit conversion widgets by default** — define a small set of frontmatter-driven blog blocks (ScheduleTracker, CostCalculator, ChecklistTracker, RouteSaver, SymptomNarrower) so the CMS's velocity gain becomes a conversion gain, not just more thin pages.

---

## 2. What Preoccupies Riders Most

Validated concern themes, ranked by evidence strength (GSC ranking signal + PostHog in-app engagement). PostHog-validated feature priority: **expenses > maintenance > rides > trips > AI diagnostics**.

| # | Rider concern theme | Evidence | Strength |
|---|---|---|---|
| 1 | **"When is my bike's next service actually due?"** (brand-specific service intervals, valve specs, oil/chain) | Maintenance-schedule cluster is the proven winner: top page `/blog/yamaha-mt-r-series-maintenance-schedule` = 30 clicks, 3,936 impr, pos 7.6; whole cluster (Yamaha/Honda/BMW/Kawasaki/Ducati/Harley) at pos 7–10. Maintenance = PostHog #2 engaged feature. | **Highest** (ranking + engagement) |
| 2 | **"What will this bike really cost me per year?"** (true cost of ownership, maintenance cost, DIY-vs-shop) | Expense tracking is MotoVault's strongest PostHog hook (expenses > maintenance). Cost-category content maps directly to the #1 engaged feature. | High (engagement-led) |
| 3 | **"How do I do this maintenance task myself?"** (spring prep, winterize, DIY oil change, chain adjustment, brake pads) | Feeds maintenance tracking + service log (PostHog #2). Step/checklist content is natively interactive. | High |
| 4 | **"Something's wrong right now — what is it?"** (won't start, leaking oil, overheating, stalling, check-engine) | Real concern, but AI diagnostics is PostHog's **weakest** engagement driver and explicitly **not** a hero feature. Treat as a backstop, never the headline. | Medium (demand real, monetization weak) |
| 5 | **"Where should I ride / how do I plan this trip?"** (best routes EU/USA, trip planning, offline maps) | Maps to route discovery + trip planning (PostHog #4). Lower commercial intent per visit but strong for ride-day urgency. | Medium |
| 6 | **"Which app/tools does a responsible owner need?"** (best maintenance/expense apps, beginner guides) | Awareness/branded-comparison intent; lowest-friction install ask. Lead with validated hooks (expenses, maintenance). | Medium (top-of-funnel) |

---

## 3. Where Blogs Bring Value (and Where Not to Bother)

Prioritized by `(ranking proof × conversion fit)`. Build/expand the top rows aggressively; the bottom rows are fillers or traps.

| Topic cluster | Search intent | Why it wins (evidence) | App tie-in (PostHog rank) |
|---|---|---|---|
| **Brand maintenance schedules** (Yamaha MT/R, Honda CBR/CB, BMW GS/R, Kawasaki Ninja/Z, Ducati Monster/Panigale, Harley) | Consideration | The proven pos 7–10 cluster; already accelerating. Highest-leverage place to add more of what ranks. | Maintenance reminders (#2) |
| **Annual cost / true cost of ownership** (cost-by-bike-type, DIY-vs-shop, maintenance cost/year) | Consideration | Maps to the **strongest** PostHog hook (expenses). Under-built vs. demand. | Expense tracking (#1) |
| **Seasonal & DIY checklists** (spring prep, winterize, oil change, chain adjustment, brake pads) | Consideration | Natively interactive (step lists), feeds service-log + reminders. | Maintenance tracking + service log (#2) |
| **Maintenance-schedule HUB / cluster index** (schedules-by-brand, complete maintenance guide) | Awareness | Topical-authority capstone; lifts the whole pos 7–10 cluster's CTR via interlinking. Uses existing `buildItemList` `ItemList` schema. | Cross-feature soft entry |
| **Top-of-funnel comparison** (best maintenance/expense apps, best app for beginners) | Awareness | Branded-comparison queries; lowest-friction install ask. | Expenses + maintenance first |
| **Troubleshooting / symptom diagnosis** (won't start, overheating, stalling) | Consideration | Real "right now" intent, but AI is weakest PostHog hook — keep CTA as a below-the-fold backstop. | AI diagnostics (#5, secondary) |
| **Route / touring guides** (best routes EU/USA, trip planning, offline maps) | Consideration | Ride-day urgency; lower per-visit commercial intent. | Route discovery + trip planning (#4) |
| **Don't bother:** generic news/listicles with no service-interval/cost/checklist data, no brand specificity, no app tie-in | — | No ranking proof, no conversion asset to embed, and thin AI versions risk site-level quality dilution on a domain where blog = 74% of impressions. | None |

---

## 4. Fixing the Sub-1% CTR Problem

The diagnosed problem is **CTR at pos 7–10, not ranking**. We are earning impressions faster than clicks. Concrete tactics for the already-ranking maintenance cluster, cheapest-first:

**A. Decouple SERP snippet copy from on-page copy (schema prerequisite — Section 6 #2).**
Today `title` is reused for `<h1>`/`<title>`/`og:title` and `excerpt` for meta + OG description (`page.tsx`). Add nullable `seo_title` (≤60 chars), `seo_description` (≤155 chars), `og_title`, falling back to current values. This *enables* the copy work without a second migration. Then rewrite snippets to:
- **Front-load the year + bike** for recency + match: "Yamaha MT-09 Service Schedule (2026): Oil, Valve & Chain Intervals".
- **Put the answer in the description** (the interval numbers), not a generic blurb — pos 7–10 listings win clicks by promising the exact spec the searcher wants.

**B. Win SERP real estate with structured data already in the pipeline.**
- **FAQPage JSON-LD** is already built (`buildFAQPage`, `schema.ts:182`) and retained for AI citation — ensure every brand post carries a `faq[]` so it's eligible for FAQ rich results.
- **`ItemList` on the hub** (`buildItemList`, `schema.ts:227`) for the brand-schedule index.
- Consider a **per-post `schema_type` toggle** so genuinely step-based maintenance posts can emit `HowTo`.

**C. Fix freshness signals (date shows in the SERP and aids both ranking + CTR).**
Auto-maintain `updated_at` via DB trigger feeding sitemap `lastmod` (`sitemap.ts:151`) and `Article` `dateModified` (`page.tsx:175`); add an optional editorial `reviewed_on` for visible "Last reviewed: …" text. Under AI/direct-insert authoring, a hand-entered `dateModified` will go stale and bleed a stale date into the SERP. "Updated for 2026" is a real CTR lever for recency-sensitive maintenance content.

**D. Fix E-E-A-T author signals (credibility → ranking → CTR).**
Store `author_id` (Section 6 #4) so `Person` JSON-LD (bio, `jobTitle`, `knowsAbout`, `sameAs`) actually populates instead of falling back to default.

**E. Internal linking lifts the cluster's CTR collectively.**
A well-linked hub + bike-specific children both raise cluster authority and route already-on-page readers onward (Section 6 #5).

**F. Fix social/AI-surface CTR with a correct OG image.**
`heroImage` renders 21:9 but is declared 1200×630 to Google/OG (`schema.ts:310`), producing cropped social cards. Add an optional `og_image` (Section 6 #7).

---

## 5. Content → App → Conversion Map

Conversion principle: **convert from the content's own data, not a banner.** Every winning post already contains structured assets (interval tables, cost tables, checklists, FAQ, step lists). Turn those exact assets into interactive widgets so the CTA *is* the tool the reader wanted — value first, then "save/track/get reminders." Seed widgets + deep links from frontmatter (make/model) so the ask is bike-specific. Sequence CTAs to the validated hook order (expenses > maintenance > rides > trips > AI). Persist intent across the web→app boundary with prefilled deep links + localStorage for anon state.

| Content theme | Rider JTBD | App feature (PostHog rank) | In-blog CTA mechanism | Funnel stage |
|---|---|---|---|---|
| Brand maintenance schedules | "When is each service actually due for MY bike at MY mileage?" | Maintenance reminders (#2) | **ScheduleTracker** widget built from the post's interval table: pick model + enter mileage → computes next due date/mileage per line item inline → "Get reminders — open in MotoVault" deep-links to `add-bike` prefilled with make/model/year + schedule. | Consideration |
| Annual cost / true cost of ownership | "What will it really cost me per year, and can I keep my real spend under it?" | Expense tracking (#1) | **CostCalculator** reusing the article's cost tables: select bike type + DIY/shop mix + annual miles → personalized yearly figure → "Save this as your budget, track real spend" deep-links to a prefilled expense budget seeded with categories. | Consideration |
| Seasonal / DIY checklists | "Tick items off in the garage, don't lose my place, log it to my bike." | Maintenance tracking + service log (#2) | **ChecklistTracker**: each step is checkable in-page (localStorage for anon); persistent "Save progress + log to your bike — 12 items, 4 done" bar → install/open; completed dates become service-history entries. | Consideration |
| Troubleshooting / symptom diagnosis | "Confirm which cause applies to my bike; DIY-fix vs shop." | AI diagnostics (#5, **secondary**) | **SymptomNarrower** from the article's own cause list: 2–3 yes/no checks highlight the likely cause section. Soft, below the self-serve fixes: "Still unsure? Ask MotoVault AI with your model + symptoms pre-filled." Never the headline. | Consideration |
| Route / touring guides | "Save this route, plan a real trip, get offline turn-by-turn." | Route discovery + trip planning (#4) | **RouteSaver** chip per named route → deep-links into the trip planner pre-seeded with start/end; paired with "Download for offline — every turn pre-rendered before you leave." | Consideration |
| Top-of-funnel comparison | "Confident recommendation, not a sales pitch." | Whole product, led by expenses + maintenance | Honest criteria-based comparison table with MotoVault as one scored row; "See why riders pick MotoVault for cost + service tracking" expander → install. De-emphasize AI. Lowest-friction ask. | Awareness |
| Hub / cluster index | "Browse to find my brand's schedule and orient myself." | Cross-feature | Topical-authority capstone with internal links to every brand post (lifts cluster CTR); single soft "Add your bike to get its schedule automatically" entry — let the child posts carry strong conversion. Optimize for onward clicks, not first-touch install. | Awareness |

---

## 6. Required CMS/SEO Features the Brainstorm Is Missing

Prioritized critical → low. Each is graftable directly into the `blog_posts` schema (`In Scope §1`, line 35) or admin UI of the companion doc. Tied to evidence.

> **Naming convention (audit 2026-06-22):** this doc writes schema fields in `snake_case` (`seo_title`, `seo_description`, `og_title`) — the DB column form. The companion CMS doc writes the same fields in `camelCase` (`seoTitle`, `metaDescription`, `ogTitle`) — the TypeScript/GraphQL form. Both are correct per the project's DB-snake / API-camel convention; they refer to the same columns. Map at the service layer as usual.

### 🔴 CRITICAL

**1. Slug-history + DB-backed redirect table (`blog_redirects`), auto-written on any admin slug edit.**
*Add:* a `blog_redirects` table (`from_slug`, `from_locale`, `to_slug`, `http_status` default 308) read by middleware / catch-all. Slug edits go through a guarded action that records old→new history, not a raw column update. Migrate the existing `next.config.ts` blog redirects (incl. the 2026-05-27 cluster consolidations) into this table so "no deploy" actually holds for the redirect surface.
*Why:* Redirects today live in deploy-coupled `next.config.ts`, but the proposal makes `slug` an editable primary field with no-deploy publishing. Renaming the #1 ranking page (30 clicks / 3,936 impr / pos 7.6) 404s it instantly with zero redirect — destroying the exact accelerating asset the Parity Contract protects. In-body internal links to renamed slugs rot silently too.

### 🟠 HIGH

**2. Separate `seo_title` (≤60), `seo_description` (≤155), `og_title` — fallback to `title`/`excerpt`.**
*Add:* three nullable columns; `generateMetadata` prefers them, falls back to current values (preserves parity).
*Why:* The diagnosed problem is sub-1% CTR at pos 7–10, not ranking. Today `title`/`excerpt` are reused for H1, `<title>`, meta, and OG (`page.tsx`). Decoupling SERP copy from the H1 is the cheapest CTR lever and must exist now so the out-of-scope copy work needs no second migration.

**3. `author_id` FK to the authors registry (not free-text `author`), normalized during migration.**
*Add:* replace free-text `author` with a stable `author_id` referencing `src/lib/authors.ts`; normalize inconsistent frontmatter (display-name `Andrej Kanuch` vs id `founder`) during import; **fail the parity check** if any post resolves to `getDefaultAuthor()` when it previously had a real author.
*Why:* `Article`+`Person` E-E-A-T JSON-LD (bio, `jobTitle`, `knowsAbout`, `sameAs`) is built by joining `author` → registry (`getAuthor(article.author) ?? getDefaultAuthor()`, `page.tsx:141`). The current mismatch silently strips credibility on the pages that most need E-E-A-T to climb from pos 7–10. Keep the registry as the single source of bio/credentials.

**4. `robots_noindex` boolean (default false) + `canonical_url` override; gate sitemap/RSS on `published && !noindex`.**
*Add:* `robots_noindex` and optional `canonical_url`; `generateMetadata` emits `robots: { index:false }`; sitemap/RSS exclude noindexed or draft rows.
*Why:* AI-paste and direct-DB-insert are first-class authoring paths with **no editorial review** (line 48). Without per-post index control, thin/duplicate AI posts auto-index, auto-sitemap, and auto-RSS the instant they're written — risking site-level quality dilution on a domain where the blog is 74% of impressions. Also lets you deliberately keep thin tag/category archives out of the index.

**5. Curated `related_slugs` field + internal-link integrity checker over body markdown.**
*Add:* a `related_slugs` array overriding the 3-item category heuristic (`getRelatedArticles`, `page.tsx:140`); a build-time/admin checker flagging body links to non-existent `(slug, locale)` rows. Strongly consider a **maintenance-schedule hub page** using the existing `buildItemList` `ItemList` schema (`schema.ts:227`) linking all brand guides.
*Why:* Internal linking is the strongest lever to push the pos 7–10 brand cluster upward; the current logic is a thin category heuristic, and in-body links rot on slug rename. Hub-and-spoke directly targets the GSC-identified winning cluster and routes readers to the highest-converting posts.

### 🟡 MEDIUM

**6. Auto-maintained `updated_at` trigger feeding sitemap `lastmod` + `Article` `dateModified`, plus optional editorial `reviewed_on`.**
*Why:* `dateModified` is hand-entered today and will go stale under AI/direct-insert authoring, bleeding stale dates into the SERP and weakening recency-sensitive maintenance content. A DB trigger keeps freshness honest without author discipline; `reviewed_on` surfaces visible "Last reviewed" text.

**7. Optional `og_image` (1200×630) distinct from the 21:9 `heroImage`.**
*Why:* `heroImage` renders 21:9 but is declared 1200×630 to Google/OG (`schema.ts:310`), producing cropped social cards. A dedicated correctly-sized OG image (trivial via the in-scope Storage uploader) improves social/Discover/AI-surface CTR.

**8. AI-search (GEO) primitives beyond FAQPage: optional `tl_dr` / `key_takeaways` + per-post `schema_type` toggle for `HowTo`.**
*Why:* FAQPage is already "retained for LLM/AI citation" (`schema.ts:16`). With sub-1% blue-link CTR at pos 7–10, AI Overviews / ChatGPT / Perplexity citations are arguably a *more reachable* channel for maintenance content. AI engines cite concise, structured answer blocks; markdown tables (already rendered, `page.tsx:101`) extract well. Add a citable summary block and let genuine step-based posts emit `HowTo`.

**9. Serialized-output parity test harness (sharpens the existing Parity Contract).**
*Why:* The Parity Contract names the right surfaces but under-specifies failure granularity for a `(slug, locale)` DB model. Make the check assert on the **serialized** output of `getArticleHreflangMap`, the full `Article`/`FAQPage`/`BreadcrumbList` JSON-LD, the rendered `feed.xml`, and each sitemap entry — snapshot before, diff after. **Pin the DB query sort to the current date-desc order** (`lib/blog.ts:72`) so listing/related order and structured data stay byte-equivalent; watch `wordCount` string-vs-number coercion (`lib/blog.ts:55`).

### ⚪ LOW

**10. Explicit live-state semantics: a row is live only when `status='published' AND date <= now()`.**
*Why:* A naive `published` boolean + on-demand revalidate flips a post live the instant the row is written (combined with no review/noindex, this is how thin content reaches the index). Future-dating creates ambiguity. Defining this now costs nothing, prevents future-dated leaks, and makes the deferred scheduling seam a no-op to add later.

**11. Reusable, frontmatter-driven conversion blocks (admin/renderer, not schema).**
*Add:* a small set — `ScheduleTracker`, `CostCalculator`, `ChecklistTracker`, `RouteSaver`, `SymptomNarrower` — that read post metadata/tables so every future AI-generated post in the converting clusters gets conversion for free.
*Why:* The CMS's value (velocity) is realized as conversion only if new posts inherit these widget slots by default; otherwise we just generate more pos 7–10 impressions that don't convert. (Note: widgets in markdown body reintroduce a controlled component surface — scope to a fixed allowlist of shortcodes, not arbitrary JSX, to preserve the markdown-only sanitization posture.)

---

## 7. Recommended Next Actions (ordered)

1. **Graft the CRITICAL + HIGH schema fields into the companion brainstorm** (`blog_redirects`, `seo_title`/`seo_description`/`og_title`, `author_id`, `robots_noindex`/`canonical_url`, `related_slugs`) **before the migration is planned.** These are one-migration-or-two decisions on ranking pages — get them in v1.
2. **Build the slug-guard + `blog_redirects` middleware first**, and migrate the existing `next.config.ts` blog redirects into the table, so no-deploy publishing is safe before any slug becomes editable.
3. **Normalize author frontmatter to `author_id` during the migration script** and wire the "no silent `getDefaultAuthor()`" assertion into the parity check.
4. **Ship the serialized-output parity harness** (#9) as the migration's "done" gate; pin DB sort to date-desc.
5. **Stand up the brand-maintenance hub** (`ItemList`) + curated `related_slugs` across the existing Yamaha/Honda/BMW/Kawasaki/Ducati/Harley posts — the fastest pos 7–10 → pos 1–5 push, independent of new content.
6. **Run the CTR copy pass** on the top ~10 maintenance pages: front-load year+bike in `seo_title`, put interval numbers in `seo_description`, confirm `faq[]` present, set `reviewed_on`. (Out of scope for the *build*, but unblocked by #1's schema.)
7. **Define the conversion blocks** (`ScheduleTracker`, `CostCalculator`, `ChecklistTracker`, `RouteSaver`, `SymptomNarrower`) as a fixed shortcode allowlist; default them into the converting-cluster post templates so AI-generated posts inherit conversion.
8. **Then scale content** in the validated clusters (brand schedules, annual cost, DIY checklists) — produce more of what ranks, now that velocity is unblocked and each new post inherits SEO + conversion by default.
