# Google API SEO Report — motovault.app
_Date: 2026-06-01 · Source: Google Search Console + CrUX (live, OAuth Tier 1) · Property: `https://motovault.app/` (URL-prefix)_
_Data freshness: GSC has a 2–3 day lag; CrUX field window 2026-05-03 → 2026-05-30._

## TL;DR

The site is **technically healthy and fully indexed**, but **pre-authority**: of 15 clicks in 28 days, 13 are the branded term "motovault." 50 pages and 131 queries earn impressions, but the money pages rank too deep (pos 27–51) to get clicks. Two real, fixable issues: **(1) First Contentful Paint is "poor" (3.1s)** for real Chrome users, and **(2) a cluster of pages sit at pos 4–20** — one optimization push from their first clicks.

---

## 1. Search Performance (GSC, last 28 days)

| Metric | Value |
|---|---|
| Clicks | 15 |
| Impressions | 505 |
| CTR | 2.97% |
| Avg position (site) | — (homepage 14.4) |
| Query terms with impressions | 131 |
| Pages with impressions | 50 |
| Converting queries | **1** — "motovault" (branded), pos 5.0, 11 clicks |

**Read:** classic new-site profile. Google knows the site exists (505 impressions across 50 pages), but only people already searching the brand name click through. Non-branded ranking hasn't matured.

### Top pages by impressions
| Clicks | Impr | Avg pos | Page |
|---:|---:|---:|---|
| 13 | 131 | 14.4 | `/` |
| 0 | 81 | 51.4 | `/features/trip-planning` |
| 0 | 42 | 46.6 | `/compare` |
| 0 | 29 | 27.5 | `/blog/best-motorcycle-maintenance-apps-2026` |
| 0 | 27 | 51.0 | `/bikes/yamaha/yzf-r1/2023/overview` |
| 0 | 27 | 27.1 | `/features/ai-diagnostics` |
| 0 | 21 | 67.7 | `/blog/best-motorcycle-routes-usa` |
| 0 | 15 | 28.2 | `/blog/harley-davidson-maintenance-schedule-costs` |
| 0 | 14 | **13.0** | `/fr/blog/best-motorcycle-maintenance-apps-2026` |
| 1 | 9 | 12.1 | `/tools/cost-calculator` |
| 0 | 9 | **9.1** | `/blog/honda-cbr-cb-maintenance-schedule` |
| 0 | 9 | 41.9 | `/de/blog/motorcycle-maintenance-for-beginners` |

**Two signals worth acting on:**
- **High-value pages rank deep:** trip-planning (51), compare hub (47), R1 bike page (51) get impressions but are buried. These need authority + on-page work to climb.
- **Localized content punches above its weight:** the **French** maintenance blog ranks pos 13 — your i18n investment is already earning impressions in non-English SERPs.

### Near-ranking quick wins (pos 4–20, impressions, 0 clicks)
| Query | Pos | Impr | Maps to existing page |
|---|---:|---:|---|
| `honda cbr500r maintenance schedule…` | 9.1 | 9 | `/blog/honda-cbr-cb-maintenance-schedule` |
| `rever vs` | 9.0 | 4 | `/compare/motovault-vs-rever` |
| `motorcycle fault diagnosis ai` | 9.0 | 3 | `/features/ai-diagnostics` |
| `kurviger pricing` | 10.6 | 5 | `/compare/motovault-vs-kurviger` |
| `ai motorcycle problem detector` | 11.0 | 3 | `/features/ai-diagnostics` |
| `logiciel d'entretien motos` (FR) | 13.0 | 14 | `/fr/blog/best-motorcycle-maintenance-apps-2026` |
| `motorcycle ownership cost calculator` | 14.4 | 10 | `/tools/cost-calculator` |
| `best motorcycle apps 2025 2026` | 15.8 | 4 | `/compare` |
| `motorcycle maintenance automation app` | 17.3 | 3 | maintenance content |
| `software de mantenimiento de moto` (ES) | 18.7 | 7 | ES maintenance content |

These are the fastest path to first non-branded clicks: 11 queries already on pages 1–2.

---

## 2. Indexation (URL Inspection — live verdicts)

**Healthy across all page types.** 7 representative URLs inspected, all **PASS / "Submitted and indexed"** with correct self-canonicals:

| URL | Verdict | Coverage | Canonical |
|---|---|---|---|
| `/` | PASS | Submitted and indexed | self ✓ |
| `/compare` | PASS | Submitted and indexed | self ✓ |
| `/explore` | PASS | Submitted and indexed | self ✓ |
| `/features/ai-diagnostics` | PASS | Submitted and indexed | self ✓ |
| `/blog/best-motorcycle-maintenance-apps-2026` | PASS | Submitted and indexed | self ✓ |
| `/compare/motovault-vs-kurviger` | PASS | Submitted and indexed | self ✓ |
| `/bikes/yamaha/yzf-r1/2023/overview` | PASS | Submitted and indexed | self ✓ |

**Sitemap:** `/sitemap.xml` submitted 2026-04-30, 0 errors/0 warnings, 138 web + 37 image URLs. The "indexed: 0" counter in the sitemap report is **GSC's deprecated/unreliable metric** — debunked here: every inspected URL (including a programmatic bike page) is genuinely indexed. No indexation problem.

> Recommended follow-up: run `inspect-batch` on a wider sample of the 138 `/bikes/*` programmatic URLs to confirm the whole template set is indexed (not just the one R1 page).

---

## 3. Core Web Vitals (CrUX field data — real Chrome users)

⚠️ **Sparse data due to low traffic** — only FCP has enough samples to report. LCP, INP, CLS, and TTFB lack sufficient Chrome traffic at this property, so Google returns no p75 for them (not an error — just not enough visitors yet). No 25-week trend is computable.

| Metric | p75 | Rating | Distribution (good / NI / poor) |
|---|---|---|---|
| **FCP** | **3,109 ms** | 🔴 **Poor** (>3,000ms) | 57.0% / 15.4% / 27.5% |
| LCP | — | no data | insufficient traffic |
| INP | — | no data | insufficient traffic |
| CLS | — | no data | insufficient traffic |
| TTFB | — | no data | insufficient traffic |

**Read:** more than 1 in 4 real visits see a first paint slower than 3s. FCP is the only CWV with signal, and it's in the poor band — a genuine performance issue that hurts both UX and ranking potential, and compounds the "pages rank deep" problem.

> The PSI **Lighthouse lab** run failed (a parser bug in the skill's `pagespeed_check.py`: `KeyError: 'audit_details'`), so lab-side LCP/TBT/CLS aren't in this report. Re-run later or use `/seo performance` / `/seo technical` for lab CWV until that's patched.

---

## 4. GA4 Organic Traffic

**Not connected.** OAuth already covers GA4 read access — it just needs the numeric property ID added to `~/.config/claude-seo/google-api.json` (`"ga4_property_id": "properties/123456789"`). Once added, we can pull organic sessions, top landing pages, and AI-referred traffic (chatgpt.com / perplexity.ai referrers).

---

## Top 5 Highest-Impact Actions

1. **Fix First Contentful Paint (3.1s → <1.8s).** The only CWV with data is poor. Likely culprits on the hero: the 5-image background slideshow + font loading. Run `/seo performance` or `/seo technical` for the lab breakdown, then defer/preload critical assets. _Low–med effort / High impact (UX + ranking)._
2. **Push the 11 near-ranking queries (pos 4–20) to top 3.** Start with pages you already have: `/compare/motovault-vs-kurviger` ("kurviger pricing" pos 10.6), `/compare/motovault-vs-rever` ("rever vs" pos 9), `/tools/cost-calculator` (pos 14, already got 1 click), `/blog/honda-cbr-cb-maintenance-schedule` (pos 9). On-page optimization + internal links from the homepage/hub. _Low effort / High impact._
3. **Lean into localized SEO.** FR maintenance blog ranks pos 13, ES maintenance pos 18 — your i18n content is the best-ranking non-branded segment. Deepen FR/ES maintenance + comparison content. _Med effort / Med-High impact._
4. **Build authority for the deep-ranking money pages** (trip-planning pos 51, compare hub pos 47, bike pages pos 51). These rank deep because the site lacks off-page authority — ties directly to the GEO audit's #1 gap (no Wikipedia/Reddit/YouTube). _High effort / High impact, slow._
5. **Connect GA4** (property ID) and **batch-inspect the `/bikes/*` set** to confirm the programmatic template is fully indexed. _Low effort / measurement._

## Cross-references
- GEO/AI-search audit: `apps/web/GEO-ANALYSIS.md` (77/100; same root cause — strong tech, weak off-page authority).
- Setup + query commands: memory `project_seo_google_api`.

## Not assessed
- **Lighthouse lab CWV** — skill script bug (`audit_details`); use `/seo performance`.
- **LCP / INP / CLS field data** — insufficient Chrome traffic to populate.
- **GA4 traffic** — property ID not configured.
- **Full `/bikes/*` indexation** — only 1 of 138 programmatic URLs spot-checked.
