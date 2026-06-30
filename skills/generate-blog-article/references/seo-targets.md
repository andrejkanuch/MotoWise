# SEO Targets — real Search Console demand

Source: Google Search Console for `https://motovault.app/`, 90-day window (pulled June 2026). These are queries the site **already gets impressions for but under-serves** (ranking position 7–11, low/zero clicks). Capturing them needs a focused, well-optimized article. Pick the highest item not already well-covered by an existing post (check Step 1 of the skill).

> When this list is picked over, use `WebSearch` to find the next adjacent rider query with clear intent (maintenance, troubleshooting, cost, comparison, model-specific). Always prefer queries that map to a MotoVault paid feature (maintenance tracking, expense logging, diagnostics) so the conversion CTA lands.

## SPEC targets (mode = maintenance, DRAFT) — per-model "service intervals"
Highest-demand cluster. Each is a dedicated model maintenance-schedule article. Research the official owner's manual; stage as draft for verification.

| Priority | Article angle | Real queries seen | Notes |
|---|---|---|---|
| 1 | **Yamaha MT-09 service intervals & maintenance schedule** | `mt09 service intervals`, `yamaha mt09 service intervals`, `mt09 oil change interval`, `mt09 maintenance schedule` | Strongest single-model demand. A dedicated MT-09 page can out-rank the combined MT/R page for these. |
| 2 | **Yamaha MT-07 service intervals & oil change schedule** | `mt07 service intervals`, `mt 07 service intervals`, `mt07 oil change interval` | Already impressing at pos ~6–8, near-zero clicks. |
| 3 | **Yamaha R7 service intervals** | `yamaha r7 service intervals` | Pos ~7.8, zero clicks. |
| 4 | **Harley-Davidson scheduled maintenance & service costs** | `harley-davidson scheduled maintenance service` | Commercial + maintenance intent. |

## GUIDE targets (mode = guide, AUTO-PUBLISH) — informational / comparison / cost
No safety-critical numbers presented as authoritative.

| Priority | Article angle | Real queries seen | Map to feature |
|---|---|---|---|
| 1 | **How to start motorcycle maintenance (beginner's first-year guide)** | `how to start motorcycle maintenance`, `how to motorcycle maintenance for beginners` | 487 impressions, pos ~10–13, **zero clicks** — biggest untapped guide. Maintenance tracking. |
| 2 | **Best motorcycle apps (maintenance, expenses, navigation) 2026** | `motorcycle apps`, `motorcycle app`, `motorcycle software`, `motorcycle maintenance app`, `best motorcycle navigation apps 2026` | Direct commercial intent → strongest conversion. Comparison. |
| 3 | **Best motorcycle trip planner / route planner apps** | `motorcycle trip planner`, `motorcycle route planner`, `motorcycle route planner app` | Touring feature. (Note: filter out India city-pair "distance" queries — off-target market.) |
| 4 | **Best motorcycle maintenance books & resources 2026** | `motorcycle maintenance books 2026` | Top-of-funnel; link to app. |

## Writing rules (apply to every article)
- **Search intent first.** Write the article the searcher actually wanted. Answer the core question in the first 100 words.
- **Title ≤ 60 chars**, target keyword near the front, specific + clickable. Avoid clickbait.
- **Meta description 150–160 chars**: keyword + concrete benefit + soft CTA.
- **Structure:** short intro → `##` sections that mirror sub-questions → `###` where needed. Headings feed the on-page table of contents.
- **Length:** 1,200–2,000 words. Dense and useful; no filler.
- **Tables** (GFM) for any intervals/specs/comparisons. Show **metric AND imperial**.
- **Internal links:** 2–4 links to related existing `/blog/<slug>` posts (find them in Step 1).
- **FAQ:** 3–5 genuine Q&As → `faq` jsonb. Mirrors "People also ask".
- **`## Sources` section** at the end with real links (see `sourcing.md`).
- **Tone:** rugged, premium, confident, expert rider voice. Plain, precise, no fluff, no gamification, no emoji.
- **Conversion:** the page template auto-renders the download CTA + disclaimer. Optionally weave one natural in-body mention of how the app solves the article's problem (e.g. "MotoVault reminds you before each service is due"). Keep it to one, make it useful, never spammy.
