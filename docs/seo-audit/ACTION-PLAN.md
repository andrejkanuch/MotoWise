# MotoVault — SEO Action Plan (prioritized)

Derived from `docs/seo-audit/FULL-AUDIT-REPORT.md` (2026-04-14).

---

## Critical

| # | Action | Owner hint |
|---|--------|------------|
| C1 | **Deploy** `seo/explore-route-metadata` (or equivalent): fix `/explore` **absolute title**, **OG/Twitter images**, route **canonical + OG** (Mapbox static when token present), **JSON-LD** cleanup (remove fake SearchAction), root **`/explore/[country]/[region]`** 404 fix | Release |
| C2 | After deploy, **Google Search Console** — inspect `/explore`, one country, one region, one route: indexability, hreflang, canonical | SEO |

---

## High (≤ 1 week)

| # | Action | Owner hint |
|---|--------|------------|
| H1 | **Lighthouse / PageSpeed Insights** (mobile + desktop) on `/`, `/explore`, `/explore/us`, `/explore/us/ca`, `/route/...` — target **INP** + **LCP** regressions | Web perf |
| H2 | **Rendered DOM** validation for route pages (not curl-only): confirm `<title>`, `canonical`, `og:*`, JSON-LD | Web |
| H3 | **Ship** `public/.well-known/security.txt` to production | Web |
| H4 | **Sync** `llms.txt` / `llms-full.txt` on CDN (verify **Last-Updated** + **route discovery** live) | Release |
| H5 | **Schema:** ensure route detail emits stable **TouristAttraction** or **Place** + **BreadcrumbList** without validation errors in Rich Results Test | Web |

---

## Medium (≤ 1 month)

| # | Action | Owner hint |
|---|--------|------------|
| M1 | **Sitemap hygiene:** as route count grows, monitor size, **lastmod** accuracy, and crawl budget; avoid listing URLs that 404 | Web |
| M2 | **Hreflang:** keep `getHreflangMap` + sitemap **reciprocal** when adding locales or new marketing paths | Web |
| M3 | **Programmatic bikes:** keep **quality gate** + sitemap sync; spot-check thin failures | Content |
| M4 | **Content:** add **“last reviewed”** or seasonal notes on high-competition **route** pages where closures matter | Content |
| M5 | **`BASE_URL` vs `metadataBase`:** document env override behavior so staging never leaks to production metadata | DevOps |

---

## Low (backlog)

| # | Action | Owner hint |
|---|--------|------------|
| L1 | Add **`scripts/fetch_page.py`** (or use `curl` + parser) for repeatable audits per **seo-audit** skill | DX |
| L2 | Optional **Playwright** screenshots (desktop + mobile) for homepage + explore in CI or manual | Design |
| L3 | **DataForSEO** / GSC API: track branded + head-term positions after route discovery launch | Growth |

---

## Done / in progress (track separately)

- [x] Smart App Banner **app-id** aligned to **6760291360** (in branch)
- [x] **noindex, follow** for empty country/region listings (in branch)
- [x] **llms-full** comparison table vs sat-nav vs trip planner vs web catalog (in branch)
