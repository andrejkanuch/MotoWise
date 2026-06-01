# GEO / AI-Search Analysis — motovault.app

_Generated: 2026-06-01 · Standard: AI Search / GEO (Feb 2026) · Crawler tested: GPTBot (raw HTML, no JS)_

## GEO Readiness Score: **76 / 100** — strong

MotoVault is already in the top tier of GEO-ready sites. The technical foundation is excellent; the gap is **content-level citability** (marketing-fragment headings + no self-contained answer blocks) and **thin author authority signals**.

| Criterion | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Citability | 25% | 17/25 | Short punchy copy + FAQ schema, but no 134–167w self-contained answer blocks; headings are stylized fragments |
| Structural readability | 20% | 15/20 | Clean H1→H2→H3, FAQ, lists. But split marketing headings ("From photo to fix in" / "Skip the") fragment the semantic signal |
| Multi-modal | 15% | 11/15 | Images + og-image + maps/GPX. No evidence of embedded video/charts on feature pages |
| Authority & brand | 20% | 14/20 | Author Person schema + dates present, but author has no `sameAs`/`jobTitle`; brand-mention footprint untested |
| Technical accessibility | 20% | 19/20 | SSR confirmed, AI crawlers allowed, llms.txt + llms-full.txt, comprehensive JSON-LD |

---

## Platform Breakdown (estimated)

| Platform | Score | Why |
|----------|-------|-----|
| **Google AI Overviews** | High | Strong traditional SEO signals, FAQPage/Article/Breadcrumb schema, SSR, hreflang. Best-positioned surface. |
| **ChatGPT** | Medium-High | GPTBot + OAI-SearchBot allowed; entity schema solid. Weak point = no Wikipedia presence, thin author `sameAs`. |
| **Perplexity** | Medium | PerplexityBot allowed, SSR good. Perplexity leans 46% on Reddit — community footprint untested/likely thin. |
| **Bing Copilot** | Medium-High | IndexNow route exists (`/api/indexnow`). Good. |

---

## 1. AI Crawler Access — ✅ Excellent

Source: `src/app/robots.ts` (deployed & verified live).

Allowed: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Amazonbot`, `Google-Extended`, `Applebot-Extended`, `Meta-ExternalAgent`. Blocked: `CCBot` (training-only — correct).

No action needed. Optionally add explicit `Bytespider`/`cohere-ai` directives, but the `*: Allow /` default already covers them.

## 2. llms.txt — ✅ Best-in-class

Both `/llms.txt` (HTTP 200, structured with sections + descriptions) and `/llms-full.txt` (11.7 KB) present. Includes `Last-Updated: 2026-04-14`, feature links with descriptions, comparison pages, tools, and a pointer to the full reference. This is exactly the recommended structure.

⚠️ **Keep `Last-Updated` fresh** — it's dated 2026-04-14 (7 weeks stale). Wire it to build time or update on content changes.

## 3. Server-Side Rendering — ✅ Confirmed

`GPTBot`-spoofed fetch of `/features/ai-diagnostics` returns 379 KB of fully-rendered HTML with headings, paragraph copy, and 2 JSON-LD blocks present. AI crawlers (which don't run JS) see real content. No client-only gaps detected on tested pages.

## 4. Structured Data — ✅ Comprehensive

`src/lib/seo/schema.ts` builds: `Organization`, `WebSite`, `SoftwareApplication` (+ `Offer` free tier + `AggregateRating`), `FAQPage`, `BreadcrumbList`, `Article` (+ `Person` author), `WebPage`, `TouristAttraction` (+ `GeoCoordinates`/`AggregateRating` for routes). Homepage carries 10+ types. Blog articles carry `Article` + `Person` author + `datePublished` + `dateModified`. Strong.

---

## Top 5 Highest-Impact Changes

### 1. Add self-contained "answer blocks" to feature & comparison pages (highest impact on citability)
AI engines extract 134–167 word passages that answer a question without surrounding context. Current feature copy is great marketing but fragmented (one-sentence punches). Add one extractable block per page opening:

> **What is MotoVault's AI diagnostics?** MotoVault's AI diagnostics lets riders point a phone camera at any motorcycle part, warning light, or symptom and get a Claude-vision identification of the likely problem plus suggested fixes in seconds — no OBD-II hardware, scanner, or wiring required. It covers eight failure categories… Each diagnosis is saved to the bike's maintenance timeline…

Self-contained, names the entity, leads with the definition, packs specific facts. This is the single biggest lever.

### 2. Convert stylized marketing headings → question/answer-pattern H2s
Tested H2/H3s read as fragments: _"From photo to fix in" / "Eight categories." / "Skip the" / "Your bike's"_. AI pairs a heading with the passage beneath it; fragments break that pairing. Keep the visual treatment but make the **semantic heading** a real question or claim — e.g. `How does photo-based motorcycle diagnostics work?`, `Which problems can MotoVault diagnose?`. (Can be done via visually-styled spans inside a complete heading, or `aria-label`/structured heading text.)

### 3. Strengthen author authority (`sameAs` + `jobTitle`)
Per the Ahrefs 75k-brand study, brand/entity mentions correlate ~3× more with AI citation than backlinks. Current author = `Person{name, url:/about}` only. Add `jobTitle`, `sameAs` (LinkedIn, X, GitHub, any press), and ideally an `Organization` `founder` link. Build out the `/about` page as a real entity hub.

### 4. Refresh dates programmatically
`sitemap.xml` homepage `lastmod` = 2026-04-11 and `llms.txt` `Last-Updated` = 2026-04-14 (both ~7 weeks stale as of today). Freshness is a ranking + citation signal. Derive these from build time or last content edit rather than hardcoding.

### 5. Build community/entity footprint (off-site, compounding)
The weakest GEO surface is Perplexity (46% Reddit) and ChatGPT (48% Wikipedia). On-site is near-maxed; the next gains are off-site: authentic Reddit presence (r/motorcycles, r/Suup), YouTube mentions (strongest single correlate at ~0.737), and eventually a Wikipedia/Wikidata entity. This is the long-term moat.

---

## Schema Recommendations (incremental)

- Add `HowTo` schema to maintenance/diagnostics guide articles (step-by-step → AI loves these).
- Add `VideoObject` if/when feature pages embed demo video (multi-modal = +156% selection rate).
- Consider `Review`/`Rating` individual reviews feeding the existing `AggregateRating` for credibility.

## What NOT to change
- Crawler config, llms.txt structure, SSR, and core schema graph are all correct — leave them.
- Don't over-FAQ commercial pages with schema spam; current FAQPage usage is appropriately scoped.
