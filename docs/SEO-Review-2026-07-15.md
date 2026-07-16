# MotoVault SEO Review — 2026-07-15

**Question asked:** How is SEO doing, and is it producing *paying* users? Compare against prior checkpoints.
**Sources:** Google Search Console (live, OAuth), PostHog (web + product events), RevenueCat (MotoVault `proj46e69448`), live crawl of motovault.app.
**Prior checkpoints:** 2026-06-09, 2026-06-14, 2026-06-28 (see `memory/project_seo_google_api.md`, `reference_seo_google_skill_setup.md`).

---

## TL;DR

SEO is **winning the traffic war and losing the revenue war.**

- Traffic is up **~6×** since mid-June and still accelerating; average position finally broke the June ceiling (pos ~9 → **7.2**). The content-cluster + restructure work from late May/early June has compounded exactly as hoped.
- But the traffic is **informational** ("what's the MT-07 oil change interval", "check engine light") and **partly off-target** (India travel-distance queries). It gets answered on-page and leaves. It does not become app installs or subscriptions.
- **Organic Search: 695 web visitors in 28d → 8 unique app-store clicks (1.15%) → ~0 paying users.** RevenueCat's paying base (6 active subs, €25 MRR, 182 new customers/28d) is driven by App Store / direct, **not** the website.

**The SEO machine works. It's pointed at the wrong intent, and the web→app→paid bridge is broken.**

---

## 1. Traffic: strong and accelerating (the win)

### GSC 28-day totals (date-dim = full, not privacy subset)

| Checkpoint | Window (28d) | Clicks | Impressions | Avg pos |
|---|---|---:|---:|---:|
| Baseline | to 2026-05-29 | 15* | 505* | ~5 (branded) |
| 2026-06-09 | 05-12→06-06 | 86 | 7,283 | 8.6 |
| 2026-06-14 | 05-17→06-11 | 115 | 9,037 | ~9.1 |
| **2026-07-15** | **06-17→07-12** | **414** | **56,109** | **7.2** |

\* query-dim (privacy subset), not comparable to totals — shown for continuity only.

**Impressions +520% and clicks +260% vs the June 14 checkpoint.** 90-day totals: 636 clicks / 76,109 impressions — meaning the last 28 days are the overwhelming majority of the entire quarter's volume.

### Momentum is still climbing (not plateaued)

Rolling 7-day windows:

| Week of | Clicks/day | Impr/day | Wtd avg pos |
|---|---:|---:|---:|
| Jun 15 | 10.1 | 1,404 | 9.5 |
| Jun 22 | 12.3 | 1,800 | 8.4 |
| Jun 29 | 20.1 | 2,511 | 7.4 |
| Jul 06 | 20.6 | 2,653 | 7.2 |

First-45d vs last-45d: **2.1 → 12.4 clicks/day, 184 → 1,546 impr/day, pos 12.6 → 8.1.** The June concern that "position plateaued at ~9" has **resolved** — the cluster matured and pushed into positions 5–8.

### On-page/technical SEO is healthy (not the bottleneck)

Homepage carries: keyword-rich `<title>` + meta description ("Free motorcycle app… 12,000+ models… iOS & Android"), canonical, `index, follow`, full **hreflang** (en/de/es/fr/it/ja/pl/pt-BR + x-default), complete OpenGraph, and rich JSON-LD (**SoftwareApplication, Organization, WebSite, FAQPage, AggregateRating, Offer, ContactPoint, Person**). robots.txt allows the major AI crawlers (ClaudeBot, GPTBot, PerplexityBot, OAI-SearchBot) and points to sitemap.xml (~400+ URLs across 8 locales). **Technical foundation is solid — do not spend effort here.**

---

## 2. What's actually ranking (the problem)

Top organic pages (28d, GSC clicks):

| Page | Clicks | Impr | CTR | Pos | Intent |
|---|---:|---:|---:|---:|---|
| `/blog/yamaha-mt-r-series-maintenance-schedule` | 130 | 12,598 | 1.0% | 5.9 | **Informational** |
| `/blog/motorcycle-check-engine-light-guide` | 39 | 8,355 | 0.5% | 6.8 | **Informational** |
| `/features/ai-diagnostics` | 34 | 429 | 7.9% | 6.9 | Commercial ✓ |
| `/` (homepage) | 31 | 920 | 3.4% | 7.2 | Branded |
| `/blog/honda-cbr-cb-maintenance-schedule` | 27 | 3,706 | 0.7% | 6.0 | Informational |
| `/blog/bmw-gs-r-maintenance-schedule` | 20 | 3,781 | 0.5% | 7.6 | Informational |
| `/blog/harley-davidson-maintenance-schedule-costs` | 18 | 5,932 | 0.3% | 8.7 | Informational |
| `/blog/best-motorcycle-trip-planner-apps` | 4 | 1,246 | 0.3% | 14.7 | **Commercial ✓ but stuck** |
| `/compare` | 3 | 262 | 1.1% | 24.1 | **Commercial ✓ but stuck** |

**~85% of clicks come from informational maintenance/diagnostic blog content.** These pages answer the question in full on the page — the reader gets their MT-07 oil interval for free and leaves. There is no reason to install an app.

The **commercial-intent** pages that *should* convert buyers (`best-*-apps`, `/compare`) rank poorly (pos 14–24) and get little traffic. `/features/ai-diagnostics` is the one bright spot (7.9% CTR) — but AI diagnostics is explicitly **out of positioning scope** (see `memory/feedback_ai_diag_not_hero`), and expenses/maintenance are the validated money features.

### Off-target geography polluting impressions

Top query-dim rows include: `saputara to statue of unity distance`, `statue of unity to saputara distance`, `anantnag to kishtwar distance`, `siliguri to tiger hill distance`. These are **Indian travel-distance queries** hitting `/trips/*` pages. Target markets are **Europe & Americas only** (`memory/feedback_no_india_market`). This traffic has zero commercial value and inflates impressions while depressing overall CTR (0.74%).

---

## 3. The revenue bridge is broken (the crux)

### Funnel, last 28 days

```
56,109 impressions
   → 414 clicks (GSC) / ~695 organic web visitors (PostHog)
      → 8 unique app_store_click  (1.15% of organic visitors)
         → ~2–4 installs (a store-badge click is not an install)
            → ~0–1 paying users
```

PostHog channel breakdown (28d, conversion goal = `app_store_click`):

| Channel | Visitors | Unique store clicks | CvR |
|---|---:|---:|---:|
| Organic Search | 695 | 8 | 1.15% |
| Direct | 238 | 8 | 3.36% |
| Organic Social | 14 | 4 | 28.6% |
| Referral | 56 | 2 | 3.57% |
| Unknown | 208 | 0 | 0% |

### The disconnect over time

Web sessions grew ~14× during the SEO ramp; app-intent clicks barely moved:

| Month | Pageview sessions | app_store_click | open_in_app_clicked |
|---|---:|---:|---:|
| Apr | 48 | 0 | 0 |
| May | 307 | 1 | 0 |
| Jun | 661 | 13 | 1 |
| Jul (to 15th) | 694 | 14 | 0 |

`open_in_app_clicked` is effectively **dead** (1 event all quarter). Total store clicks across the entire ramp ≈ 27.

### The blog CTA is instrumented but structurally failing (verified in code)

The two web download events map onto page types — and the blog, where ~85% of organic traffic lands, converts ~0:

| Event | Call site | Where traffic is | Clicks (28d) |
|---|---|---|---:|
| `app_store_click` | `components/marketing/store-buttons.tsx` (homepage/marketing) | low organic | **20** (nearly all from `/`) |
| `open_in_app_clicked` | `components/download-app-button.tsx` (blog + guides), `route/.../open-in-app-cta.tsx` | ~85% of organic | **1** (from `/blog/best-motorcycle-maintenance-apps-2026`) |

**Introduction dates (git):** `open_in_app_clicked` + route CTA ≈ 2026-05-26; `DownloadAppButton` on blog/guides = 2026-06-22 (PR #90). Live on the highest-traffic pages for ~3.5 weeks — so "dead" is a real signal, not a new-instrumentation artifact.

The blog CTA is a single generic "Download Free" `<a>` at the **bottom** of the article (`source="blog_cta"`, `blog/[slug]/page.tsx:328`). Readers get their answer and bounce (60–93%) before reaching it → **1 click in 28 days**.

**Two measurement caveats (both undercount; neither closes the gap):**
1. **Consent gate** — PostHog runs `opt_out_capturing_by_default: true` (`instrumentation-client.ts:50`); no events fire until the cookie banner is accepted. Suppresses all web events — but the homepage `app_store_click` sits behind the *same* gate and still logs 20, so the blog's 1 is a genuine conversion failure, not just consent.
2. **Navigation race** — both CTAs are `<a href>` + `onClick` capture; a same-tab store navigation can drop the beacon before flush. Worth hardening (preventDefault + small delay, or `sendBeacon`), but the homepage proves the pattern mostly works.

**Implication:** instrumentation is trustworthy and confirms the CRITICAL recommendation below — the maintenance-schedule powerhouses need contextual, mid-article CTAs, not one generic button at the end. `open_in_app_clicked` broken down by `InitialPage` is the exact metric to watch afterward.

### App Store Connect confirmation (iOS, via `asc web analytics`, 2026-07-15)

Direct App Store data settles the web→install question that PostHog could only infer — and reframes the download trend.

**Acquisition › Sources — Product Page Views by source (unique devices):**

| Source | Prior 28d (05-20→06-16) | Current 28d (06-17→07-12) |
|---|---:|---:|
| App Referrer | **310** | 8 |
| App Store Search | 92 | 52 |
| App Store Browse | 40 | 14 |
| **Web Referrer** | **14** | **11** |
| Total (approx) | ~456 | ~85 |

**Two findings:**
1. **The website has never been a meaningful iOS install driver — confirmed at the source.** Web Referrer = 14 then, 11 now: flat and tiny in *both* periods (~11 product-page views/28d → ~0–1 installs at a 3.5% conversion rate). This is the definitive confirmation of the entire conversion thesis — even measured directly at the App Store, web contributes almost nothing.
2. **The apparent "-73% download collapse" is a Meta ad campaign ending — CONFIRMED, not an SEO/ASO failure.** App Referrer (users arriving at the store page from a link inside another app) went **310 → 8**, accounting for nearly the entire drop. The Meta Ads activity log confirms the source: campaign **"MotoVault iOS — US Launch — June 2026"** (ID `6995481325544`; iOS·US·Broad Motorcycle Riders; App-Installs objective; €13/day) delivered **May 18 → Jun 4**, mapping almost exactly onto the App Referrer burst (May 20 → Jun 2). App Store Search also softened (92 → 52).
   - **Same disease, paid edition:** the campaign bought installs but total paying base is still 6 subs / €25 MRR — paid traffic hit the same activation/paywall wall as organic.
   - **The campaign was unmeasurable:** the app's Meta attribution (`meta-attribution.ts`, captures `fbclid`) only began firing **2026-06-30**, 26 days *after* the campaign ended. Every install reads `organic_unknown`; on iOS, Meta reporting also needs SKAdNetwork/AdAttributionKit conversion values. **Do not scale Meta spend until Phase-2 attribution + Phase-3 monetization are fixed — they are prerequisites to paid UA.** Campaign performance (spend/CPI/installs) not assessable here — no Meta connector in session.

**Overview funnel (iOS, current 28d vs previous):**

| Metric | Current | Previous | Δ |
|---|---:|---:|---:|
| Impressions | 1,432 | 2,744 | −47.8% |
| Product Page Views | 116 | 489 | −76.3% |
| First-Time Downloads | 36 | 132 | −72.7% |
| Conversion Rate | 3.53% | 6.61% | −46.6% |
| Redownloads | 2 | 11 | — |
| Updates | 406 | 286 | +42.0% |
| Paid Plans | 5 | 3 | +66.7% |
| Day1 / Day7 / Day35 download→paid | 2.63% / 3.03% / 0% | — | — |

**Implications:**
- **App Store Search is the dominant organic install channel for iOS (61% of product-page views now) — ASO is a bigger install lever than web right now**, and it's soft. Worth pairing the web-conversion work with ASO attention (existing aso skills/screenshots).
- **That 310-view App Referrer burst is a repeatable acquisition signal** — something (a social post / shared-link spike) drove 310 store visits in the prior month. Understanding and repeating it ties directly to the social-attribution question (`memory/project_social_attribution`).
- **Crash flag:** version 3.10.1 (iOS) shows **290 crashes** in the window — high relative to ~36 downloads; likely suppressing conversion/retention. Flag for triage (Sentry).
- **Caveat — iOS only.** This is App Store Connect (Apple). Android/Play is separate and larger by volume (RC counts 182 new customers/28d vs iOS's 36 first-time downloads), so Play Console + the Play Install Referrer path (Phase 2) matter at least as much.

### RevenueCat reality (MotoVault, 28d)

- Active subscriptions: **6** · Active trials: **4** · MRR: **€25** · Revenue: **€45**
- New customers: **182** · Active users: **221**

The 182 new customers are overwhelmingly **App Store / Play Store organic + direct**, not the website. **The website's measurable contribution to paying users is ≈ zero.**

### Bounce rates on the pages that should convert

`/blog/best-motorcycle-apps-2026` 80% · `/blog/best-motorcycle-maintenance-apps-2026` 93% · `/blog/motorcycle-maintenance-cost-per-year` 88%. The commercial-intent readers arrive and leave — the pages don't sell the app.

---

## 4. Root causes

1. **Intent mismatch.** Ranking (and winning) informational queries fully answered on-page → satisfied reader, no app needed.
2. **No app CTA where the traffic is.** The maintenance-schedule powerhouses (Yamaha page: 96 visitors/mo at 35% bounce = ~60 engaged readers) have no compelling, contextual "track this automatically" conversion moment.
3. **Off-target geo** (India trip/distance pages) inflates impressions with non-market, non-commercial traffic.
4. **Money-feature content gap.** Expenses is the #1 paid feature (`memory/project_posthog_feature_priority`) but there is **no ranking `/features/expenses` and no "motorcycle expense tracker app" content.** The one high-CTR feature page (AI diagnostics) is off-strategy.
5. **Broken web→app measurement.** No smart app banner, deferred deep link, or UTM'd store links → you cannot attribute or optimize install → the most important funnel step is invisible.

---

## 5. Recommendations (prioritized)

### CRITICAL — convert the traffic you already have
- **Add a strong, contextual app CTA to the maintenance-schedule blog powerhouses.** These already pull thousands of impressions and hundreds of engaged readers/month. On the Yamaha/Honda/BMW/Harley/Kawasaki pages, insert a mid-article + end-of-article block: *"Stop looking this up — MotoVault tracks your [MT-07] service intervals automatically and reminds you before each one"* with a screenshot and store buttons. **Highest leverage change in this document: the audience exists, the conversion moment doesn't.**
  - *Falsifiable:* `app_store_click` from `/blog/*-maintenance-schedule` initial pages should rise from ~0 to a measurable rate within 2–3 weeks of indexing.

### HIGH — win the commercial-intent queries
- **Rebuild the money pages.** `best-motorcycle-apps`, `best-motorcycle-maintenance-apps`, `/compare` rank pos 14–24 with 80–93% bounce. Rework them for buyer intent (comparison tables, "why MotoVault", above-the-fold download) and internally link to them from the high-traffic informational blogs. This is where searchers *want a tool*.
- **Suppress off-target geo.** `noindex` the pure India distance-query trip pages (or de-prioritize non-EU/Americas trip generation). Redirect trip-SEO effort to target-market routes.

### MEDIUM — build toward the paid features
- **Create expense-tracker content + `/features/expenses`.** `motorcycle-maintenance-cost-per-year` already ranks (pos 8.5) at 88% bounce — convert it into a cost-calculator/expense-tracker landing angle with a download CTA. Target "motorcycle expense tracker app", "motorcycle running costs app".
- **Fix web→app attribution.** Add a smart app banner + deferred deep linking (or a Branch-style link) and UTM-tag every store link so installs are attributable. Without this, you're optimizing blind (ties to `memory/project_social_attribution`).

### LOW — CTR polish
- Rewrite titles/descriptions on the pos 6–9 informational pages to lift the 0.74% CTR; add FAQ/HowTo-style snippets where they earn rich results (note: FAQPage rich results are restricted, but the on-page Q&A still aids AI-answer citation).

---

## 6. Leading indicators to watch (no re-audit needed)

- **`app_store_click` broken down by `InitialPage`** in PostHog — the single number that tells you whether the CTA work is landing. Target: from ~8/28d to 40+/28d.
- GSC position for the money queries (`best motorcycle maintenance app`, `motorcycle expense tracker`) — target page 1.
- RevenueCat `new_customers` segmented by install source once attribution is live.
- Overall organic CTR (0.74% → target >1.2%) as off-target geo is pruned and titles improve.

---

*Bottom line vs the June checkpoints: the traffic thesis is validated and compounding faster than expected. The next phase is not "more content" — it's **converting the audience you've already built into installs and subscriptions**, and instrumenting the bridge so you can see it happen.*
