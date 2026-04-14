# MotoVault — Full SEO Audit Report

**Domain:** https://motovault.app  
**Audit date:** 2026-04-14  
**Method:** Live HTTP sampling (homepage, robots, sitemap, key templates), response headers, HTML shell/metadata extraction. **Not** a 500-URL browser crawl (no `scripts/fetch_page.py` in repo; sitemap enumerates **132** `<loc>` entries). Core Web Vitals **not** lab-measured in this pass (use PageSpeed Insights / CrUX for INP/LCP/CLS).

---

## Executive Summary

| Metric | Value |
|--------|--------|
| **SEO Health Score (weighted)** | **~78 / 100** |
| **Business type** | **SaaS / mobile product** + **content marketing** (blog, compare, tools) + **programmatic** (bike pages, route discovery) |
| **Sitemap URL count** | 132 |
| **Robots** | Healthy; AI/search bots explicitly allowed; **CCBot** disallowed |

### Top 5 issues (severity)

1. **Production `/explore` metadata** — Title shows duplicated brand suffix (`… \| MotoVault \| MotoVault`); **`og:image` absent** on sampled HTML (hurts social + some rich previews). *Mitigation in flight:* branch `seo/explore-route-metadata` (absolute titles + OG images).
2. **Route detail HTML sampling** — Naive grep hits mobile nav `<title>Menu</title>` in **streaming shell** before metadata chunk; crawlers still receive full metadata in stream. Validate with **URL Inspection** / rendered DOM, not curl-only.
3. **`/.well-known/security.txt`** — **404** on production (file exists locally under `public/.well-known/` but was not in last shipped commit list). Low SEO impact; good hygiene for security researchers.
4. **`llms.txt` on production** — Sample still showed **Last-Updated: 2026-04-11** and no **route discovery** block at audit time; repo/branch has newer copy — **deploy drift**.
5. **Programmatic scale** — Routes + bikes will grow; rely on existing **quality gates** (bikes), **`noindex`** on empty country/region (post-branch), and monitor **index bloat** + internal linking depth.

### Top 5 quick wins

1. **Merge & deploy** SEO branch: explore title, OG/Twitter images, route canonical + OG map, `llms` updates, Smart App Banner app id.
2. **Ship `security.txt`** in the same or next deploy.
3. Run **Lighthouse / PSI** on `/`, `/explore`, `/explore/{cc}`, `/explore/{cc}/{region}`, one `/route/...` — track **INP** (not FID).
4. **Search Console:** submit sitemap, monitor “Duplicate title”, “Soft 404”, and hreflang errors for explore locales.
5. Add **`TouristAttraction` / `Place`** JSON-LD on route detail if not already in rendered output (aligns with existing e2e expectations).

---

## Scoring (seo-audit weights)

| Category | Weight | Score | Notes |
|----------|--------|-------|--------|
| Technical SEO | 25% | **86** | HSTS preload, CSP, XFO, nosniff, `robots.txt`, sitemap + hreflang, trailing-slash policy |
| Content quality | 25% | **79** | Strong blog/compare/tools; route/bike templates depend on data + editorial |
| On-page SEO | 20% | **74** | Homepage good; production explore/route samples weak on OG until deploy |
| Schema | 10% | **76** | Marketing `@graph`, region CollectionPage pattern; route entity coverage TBD |
| Performance (CWV) | 10% | **65** | *Placeholder* — measure in production with real auth/off state |
| Images | 5% | **78** | Next/Image, long-cache headers on `/images` & `/screenshots`; decorative hero alts |
| AI search readiness | 5% | **88** | `llms.txt`, `llms-full.txt`, permissive AI bot rules, CCBot blocked |

**Weighted total ≈ 78**

---

## Technical SEO

**Crawlability & indexability**

- `robots.txt`: allows `/`; blocks `/api/*`, `/_next/*`, `/admin/*`; **sitemap** declared.
- Explicit **allows** for GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.; **CCBot** `Disallow: /` (training vs search surfaces).
- **Sitemap:** single `sitemap.xml`, **xhtml:link** hreflang clusters on static URLs; blog alternates only where translated slugs exist (good reciprocity pattern).
- **Edge cache:** homepage response showed `cache-control: private, no-cache` (likely session/cookie path); marketing pages use **shared cache** when anonymous per `proxy.ts` (verified in prior codebase review).

**Security & headers (homepage sample)**

- `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- `content-security-policy` (nonce-based scripts, Mapbox/GA/GTM allowlists)
- `x-frame-options: DENY`, `permissions-policy` locks camera/mic/geo
- `referrer-policy: strict-origin-when-cross-origin`
- Share/token routes: `X-Robots-Tag: noindex, nofollow` (teaser HTML for preview bots)

**Core Web Vitals**

- **Not measured** in this audit. Validate **LCP** (hero images), **INP** (client islands, Mapbox), **CLS** (fonts, ads) on key templates.

---

## Content quality (E-E-A-T)

- **Strengths:** About, press, feature depth, **comparison moat**, free tools, blog depth, `llms-full` product narrative.
- **Risks:** **Thin** country/region pages when `routeCount === 0` — addressed in branch via **`noindex, follow`** + copy.
- **Routes:** Editorial + reviews support **experience** signals; keep **seasonal/closures** fresh for competitive queries.

---

## On-page SEO

- **Homepage:** Distinct title + description + canonical `https://motovault.app`; hreflang link headers present.
- **Explore (production sample):** Duplicate title token; missing `og:image` in sampled HTML.
- **Internal linking:** Explore hubs, region chips, route cards — sound; avoid orphan **locale** vs **unprefixed** explore drift (branch adds root region page).

---

## Schema & structured data

- Marketing pages: **WebSite**, **WebPage**, **BreadcrumbList**, **CollectionPage** patterns (locale region page).
- **Route:** Confirm **TouristAttraction** (or **Trip** / **Place**) in **rendered** JSON-LD; avoid deprecated **HowTo** for Google.

---

## Performance

- **Third-party:** GA/GTM, Mapbox, PostHog proxy — audit **INP** impact on `/explore` and route map.
- **Images:** `/_next/image` optimization; static asset cache headers configured in `next.config.ts`.

---

## Images

- Hero/decorative images use **`alt=""`** + `aria-hidden` where appropriate.
- **OG:** Ensure production emits **`og:image`** for explore + routes after deploy (Mapbox static requires server token).

---

## AI search readiness (GEO)

- **llms.txt** / **llms-full.txt** present; update **Last-Updated** and **route discovery** sections on deploy.
- **Robots** policy is a strength for AI citation surfaces that respect robots.
- **Citability:** Clear H1 + lead paragraphs on money pages; route pages benefit from **visible** rating + editorial text (already directionally good).

---

## Crawl scope note

Per **seo-audit** skill, max **500** pages; **sitemap lists 132** URLs — full enumeration feasible in a follow-up with a small crawler script. This report is **representative**, not exhaustive URL-by-URL.

---

## Sources

- Live: `https://motovault.app/` (headers + HTML), `robots.txt`, `sitemap.xml`, `/explore`, `/route/us/ca/pacific-coast-highway`, `/.well-known/security.txt`, `/llms.txt`
- Repo context: `apps/web/src/proxy.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`, `docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md`
