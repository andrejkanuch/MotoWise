# GEO Analysis — https://motovault.app
_Date: 2026-06-01 (re-audit) · Scope: site (2 pages sampled: `/`, `/blog/best-motorcycle-maintenance-apps-2026`) · Rendering measured: raw HTTP (un-rendered, GPTBot-equivalent)_

## GEO Readiness Score: 77/100 — strong

MotoVault sits in the top tier of GEO-ready sites. The **technical foundation is excellent** (SSR, schema, crawler access, llms.txt). The remaining gap is **off-page authority** (no Wikipedia/Reddit/YouTube entity) and a few **content-level citability** fixes (HTML tables, answer-first blog openings, attributed stats). Essentially unchanged from the prior 76 — re-scored with confirmed JSON-LD evidence.

| Criterion | Weight | Score | Evidence |
|-----------|--------|-------|----------|
| Citability | 25% | 86 | Answer-first definition on homepage ("MotoVault is a free motorcycle management app that combines…"); 13-question FAQ; unique data points (cost-per-mile, in-house diagnostics testing). Blog sections open with positioning, not direct answers; the "~85% accuracy" stat is unattributed. |
| Structural | 20% | 75 | Clean H1→H2→H3; short paragraphs; homepage FAQ in clean Q&A. **No HTML comparison tables** — the blog's "Head-to-Head" is prose, not `<table>`. Section headings are brand-y ("Four tools. One app.") rather than question-based. |
| Multi-Modal | 15% | 50 | App screenshots + `ImageObject` schema present; free interactive tools (cost calculator, TCLOCS checklist). No embedded video, no on-page charts/infographics. |
| Authority/Entity | 20% | 64 | Blog ships `Article` + `Person` author (Andrej Kanuch, visible "Founder & Rider" byline) + `datePublished`/`dateModified`. But author has **no `jobTitle`/`sameAs`**, `dateModified == datePublished` (not tracking real edits), and there is **no Wikipedia/Wikidata entity, no Reddit/YouTube footprint**. |
| Technical | 20% | 100 | Fully SSR; retrieval AI crawlers allowed; valid JSON-LD (Organization, Article, ImageObject, BreadcrumbList, FAQ); canonical present; `llms.txt` + `llms-full.txt` present and current. |

`GEO = 0.25·86 + 0.20·75 + 0.15·50 + 0.20·64 + 0.20·100 = 77`

## Platform Breakdown

| Platform | Score | Top gap |
|----------|-------|---------|
| Google AIO / AI Mode | 78 | Add HTML comparison tables + question-based headings; SSR + schema + FAQ already strong. |
| ChatGPT | 60 | ChatGPT cites Wikipedia ~48% of the time — MotoVault has **no Wikipedia/Wikidata entity**. |
| Perplexity | 54 | Perplexity cites Reddit ~47% — MotoVault has **zero Reddit footprint**. |

## AI Crawler Access

| Crawler | Allowed? | Directive |
|---------|----------|-----------|
| GPTBot | ✅ | `Allow: /` |
| OAI-SearchBot | ✅ | `Allow: /` |
| ChatGPT-User | ✅ | `Allow: /` |
| ClaudeBot | ✅ | `Allow: /` |
| PerplexityBot | ✅ | `Allow: /` |
| Google-Extended | ✅ | `Allow: /` (Gemini/AIO training — intentionally enabled ✔) |
| Applebot-Extended | ✅ | `Allow: /` |
| Meta-ExternalAgent | ✅ | `Allow: /` |
| Amazonbot | ✅ | `Allow: /` |
| CCBot | ❌ | `Disallow: /` (training-only — acceptable licensing choice) |

Default rules disallow `/api/*`, `/_next/*`, `/admin/*`, auth pages. Sitemap declared at `/sitemap.xml`. **Verdict: well-configured.** `Claude-User`/`Perplexity-User` (on-demand fetchers) inherit the permissive default — correct for citation.

## llms.txt / RSL

**Present** ✅ — `/llms.txt` (200) and `/llms-full.txt` (200), both `Last-Updated: 2026-04-14`, well-structured (description, core features, competitive comparison, links). Informational only (no engine confirms using it; Google says it doesn't) — but correct and current. **No RSL file detected** (informational; adoption is early).

## Brand Mentions (Tier 1 — WebSearch, no paid tools)

| Platform | Present? | Evidence/URL |
|----------|----------|--------------|
| Wikipedia / Wikidata | ❌ | No entity found |
| Reddit | ❌ | No discussion in `reddit.com` search |
| YouTube | ❌ | No channel/mentions surfaced |
| LinkedIn | ✅ | https://www.linkedin.com/company/motovault |
| Apple App Store | ✅ | https://apps.apple.com/us/app/motovault-motorcycle-garage/id6760291360 |
| Google Play | ✅ | https://play.google.com/store/apps/details?id=com.motovault.app |
| 3rd-party listicles | ⚠️ partial | motorcycledictionary.com, vikingbags.com cover the category |

**Off-page presence is the single biggest weakness.** The three highest-correlated AI-citation signals (YouTube mentions ~0.74, branded web mentions ~0.66, Reddit/Wikipedia) are largely absent.

## Prompt-Level Visibility

Live engine: `WebSearch` only (not ChatGPT/Perplexity/AIO APIs) — directional, not ground-truth AI-answer measurement.

| Query | Brand surfaced? | Notes |
|-------|-----------------|-------|
| "MotoVault motorcycle app" (branded) | ✅ Owns result + synthesis | Own pages rank #1; stores + LinkedIn present |
| "best motorcycle maintenance tracking app 2026" | ✅ Cited first in synthesis | But competitor **MotorManage's own page outranks** MotoVault's blog organically |
| "MotoVault … reddit review" | ⚠️ Brand pages only | No actual Reddit discussion exists |

- **Branded Mention Rate:** ~100%.
- **Non-branded Mention Rate:** present but contested — MotorManage holds the #1 organic slot on the generic maintenance query.
- **Share-of-Voice vs top 3** (MotorManage, Moto Shed, Drivvo/Fuelly): competitive on all-in-one framing; behind on focused-maintenance intent.
- ChatGPT/Perplexity ground-truth = **Not measured (no live engine)**. Run a 15–25 prompt battery for the 30-day baseline.

## SSR Check

**Fully SSR** ✅ — raw HTTP fetch (no JS) of `/` and the blog post returned complete content (H1, headings, author byline, body text, JSON-LD all present in un-rendered HTML). Ideal for GPTBot/ClaudeBot/PerplexityBot, which do not render JS.

## Top 5 Highest-Impact Changes

1. **Create a Wikipedia/Wikidata entity** for MotoVault (+ `sameAs` from Organization schema). _High effort / High impact_ — directly addresses the ChatGPT gap (its #1 source). Requires notability/press first.
2. **Build a Reddit + YouTube footprint** (r/motorcycles app threads; diagnostics demo videos). _Medium effort / High impact_ — Perplexity's top source + the strongest single mention correlate.
3. **Convert prose comparisons to real HTML `<table>`s** on `/compare` and `/blog/best-motorcycle-maintenance-apps-2026`. _Low effort / High impact_ — tables are preferentially extracted as AI answer chunks.
4. **Wire `dateModified` to real edits** (currently equals `datePublished`) and surface "Last updated …" in the byline. _Low effort / Medium impact_ — freshness is an Authority indicator.
5. **Attribute every statistic** (e.g. "AI correctly identified issues ~85% of the time" → cite methodology/sample size). _Low effort / Medium impact_ — unattributed numbers reduce citability.

## Schema & Content Reformatting

- **Enrich `Person` schema** on author bylines: add `jobTitle: "Founder"`, `knowsAbout: [...]`, and **only verified** `sameAs` (LinkedIn). Never fabricate Wikipedia/Twitter URLs.
- **Blog answer-first rewrite (before → after):**
  - Before: MotoVault "Overview" opens with positioning language.
  - After: _"MotoVault is a free all-in-one motorcycle app that tracks maintenance, expenses, and rides while adding AI photo diagnostics — the only app in this comparison covering all five categories. Best for riders who want one tool instead of three."_ (answer-first, names entity, self-contained ~35 words).
- **Add `FAQPage` schema to the blog post** (homepage already has a strong 13-Q FAQ — ensure it's marked up as `FAQPage`).
- **Fix homepage H1 rendering:** raw HTML emits `The rider'scompanion.` — missing space between two `<span>`s. Add a trailing space / `&nbsp;` so the H1 reads cleanly for crawlers and screen readers. _(Also flagged by the drift baseline.)_

## Not assessed

- **JS-rendered DOM diff** — no headless fetch; SSR verdict from raw HTML only (content fully present, so the diff is moot).
- **CWV / performance** — out of GEO scope; run `/seo technical https://motovault.app`.
- **Ground-truth ChatGPT/Perplexity/AIO answers** — no live AI-engine API; WebSearch used as proxy.
- **Per-image alt-text audit** — run `/seo images` for a full pass.
