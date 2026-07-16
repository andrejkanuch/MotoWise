# MotoVault — Conversion Implementation Handoff

**For:** the next Claude session (fresh context) executing the SEO→paying-user conversion work.
**Created:** 2026-07-15. **Author:** prior session (5-agent investigation + live data pull).
**Status:** planning complete, nothing implemented yet. This doc is the single entry point.

---

## 0. Read first (5 min)

1. `docs/SEO-Review-2026-07-15.md` — the diagnosis + live GSC/PostHog/RevenueCat/App-Store data.
2. `docs/SEO-Conversion-Plan-2026-07-15.md` — the phased strategy this doc implements.
3. Memory: `project_seo_conversion_plan`, `project_web_app_attribution_bridge`, `project_seo_google_api`, `project_social_attribution`, `project_growth_diagnosis_0629`, `project_posthog_feature_priority`, `feedback_ai_diag_not_hero`, `feedback_no_india_market`, `feedback_programmatic_code`, `feedback_no_magic_strings`, `feedback_formsheet_modals`.

**⚠️ Line numbers in this doc are point-in-time (2026-07-15).** Always `grep`/Read to confirm current locations before editing — do not trust cited lines blindly.

---

## 1. The problem in one paragraph

SEO traffic is booming (56k impressions/28d, +520%, still climbing) but converts ~0 paying users. Root cause is **conversion mechanics, not traffic**: ~700 organic web visitors/28d → 1 blog CTA click (0.14%) → ~0 installs → part of only 6 subs / €25 MRR. Confirmed at the App Store source: **Web Referrer = 11 product-page views/28d**. Onboarding is already value-first and mobile attribution infra exists — the gaps are (a) the blog CTA is broken/underbuilt, (b) web intent dies at the store boundary, (c) the #1 paid feature (expenses) isn't gated, (d) off-target India geo pollutes the profile, (e) paid (Meta) installs are unattributed and unconverted. Benchmarks say a fixed content→app funnel converts 2–4% → **15–25× headroom on existing traffic.**

**Goal of this work:** raise `store_cta_click`/28d from ~8 → 40+, make the web→install→paid funnel measurable end-to-end, and lift install→paid for all sources (organic + paid).

---

## 2. Hard constraints (non-negotiable — enforced by hooks/CI)

- **i18n:** every user-facing string via `t()` — web `next-intl` (`getTranslations` server / `useTranslations` client, `apps/web/messages/{locale}.json`); mobile `react-i18next` (`apps/mobile/src/i18n/locales/*.json`, `en` source). 13 mobile locales, 8 web. New keys must exist in every locale or `check-i18n` blocks the push.
- **Colors:** only `palette` tokens from `@motovault/design-system` (copper signature = `palette.signature500`). No hex/rgba/Tailwind `amber-*`.
- **No magic strings:** typed `as const` maps/constants; dispatch tables over if/else ladders (`feedback_programmatic_code`, `feedback_no_magic_strings`).
- **Mobile:** reanimated v4, expo-haptics, `borderCurve:'continuous'`, `presentation:'fullScreenModal'` not formSheet for dark modals. `typedRoutes` — no `as any` on router; type dynamic hrefs as `Href`.
- **GraphQL:** after any `.graphql`/resolver change run `pnpm generate`; never edit `packages/graphql/src/generated` or `packages/types/src/database.types.ts`.
- **Markets:** Europe + Americas only. No India.
- **Positioning:** expenses = #1 paid feature, maintenance #2. **AI diagnostics is OUT of hero positioning** — frame diagnostic content as "service history / health log", never lead with AI.
- **SEO safety:** no full-screen/exit-intent interstitials on search-landing pages (Google intrusive-interstitial penalty). Dismissible bars / small inline units only.
- **Verify before commit:** `pnpm precheck` (lint+typecheck+test). Branch off `main`; don't push to `main`.

---

## 3. Data access & how to measure (baseline + verification)

All four sources are wired and were used on 2026-07-15. Re-pull to establish before/after.

**Google Search Console** (plugin venv): 
`cd ~/.claude/plugins/cache/agricidaniel-seo/claude-seo/2.0.0 && .venv/bin/python scripts/gsc_query.py query -p "https://motovault.app/" --days 28 --dimensions page --json`
- Re-auth if `OAuth token refresh failed`: `.venv/bin/python scripts/google_auth.py --auth --creds ~/.config/claude-seo/oauth-client.json` (browser, ~5 min; run in background). `--check` lies — test with a real query. CTR field is already a percentage.

**PostHog** (MCP `mcp__posthog__exec`): project 155556. Web funnel = `query-web-stats` (breakdown `InitialChannelType`/`InitialPage`, conversionGoal `store_cta_click`). Schema-first always (`read-data-schema`). Consent gate means web events undercount ~2–3×.

**RevenueCat** (MCP): project `proj46e69448`. `get-overview-metrics`, `get-chart-data`.

**App Store Connect** (`asc` CLI, v2.8.2, `/opt/homebrew/bin/asc`): app `6760291360`.
- API-key profile "MotoVault" works for the Reports API. An `ONGOING` analytics request (`f25db9b3-06e1-4442-a33b-98cf84224602`) was created 2026-07-15 — by now its instances should exist: `ASC_TIMEOUT=90s asc analytics requests --app 6760291360 --pretty`, then `view`/`download` for the **App Store Discovery & Engagement** report (has the Source Type / Web Referrer dimension). 
- `asc web analytics {overview,sources,cohorts,metrics}` needs an interactive web session: `asc web auth login --apple-id "kanuchandrej@gmail.com"` (password + 2FA; USER must run it). Team `127745909`. Session caches after login.

**Meta Ads:** NOT connected in-session. Campaign "MotoVault iOS — US Launch — June 2026" (`6995481325544`) ran May18–Jun4 and caused the prior-month iOS download bump. To pull spend/CPI, ask the user to connect a Meta Ads MCP or provide Ads Manager numbers.

**Baseline to beat (28d to 2026-07-12):** 414 GSC clicks / 56k impr; 8 unique `app_store_click` + 1 `open_in_app_clicked`; iOS 36 downloads / Web Referrer 11 PPV; RC 6 subs / €25 MRR / 182 new customers.

---

## 4. Cross-cutting: unified event taxonomy (build in Phase 0, everything reuses it)

Collapse download-intent to ONE event. Retire `open_in_app_clicked`; alias `app_store_click` → `store_cta_click` in PostHog (keep history).

```
store_cta_click {
  platform:  'ios' | 'android' | 'unknown'
  page_type: 'home' | 'blog' | 'guide' | 'route' | 'compare' | 'feature' | 'tool'
  placement: 'hero' | 'mid_article' | 'end_article' | 'sticky_bar' | 'inline' | 'footer'
  slug?:     string   // article/route slug
  utm_source? utm_medium? utm_campaign? utm_content?
}
```
Mobile funnel props (Phase 2/3): `install_attribution_captured` += `intent_make/intent_model/intent_source`; new `pending_intent_resolved {source, make, model, method}`; `bike_added {prefilled_from_intent}`; `oem_schedule_imported {context, task_count}`; super-property `intent_cohort`.

**North-Star:** web-attributed installs/week. **Weekly proxy:** `store_cta_click` by `page_type`/`slug` (target 8→40+/28d). **Funnel:** `store_cta_click`→install→`bike_added(prefilled)`→`oem_schedule_imported`→`paywall_viewed`→`purchase_completed(trial)`→renewal.

---

## 5. Phased tasks

Critical path: **P0 → P1 → P2(Android) → P3**. P4 runs in parallel anytime. Each task lists files (verify lines), the change, acceptance criteria (AC), and verification (V).

### PHASE 0 — CTA plumbing + measurement foundation (do FIRST) · web · S–M

**P0.1 — Consolidate download CTAs onto one component + `store_cta_click`.**
- Files: `apps/web/src/components/download-app-button.tsx` (currently fires `open_in_app_clicked`, `amber-*` at ~line 8, same-tab, hardcoded copy); `apps/web/src/app/route/[country]/[region]/[slug]/open-in-app-cta.tsx` (fires `open_in_app_clicked`, already uses `palette.signature500`); `apps/web/src/components/marketing/store-buttons.tsx` (the GOOD one: `storeAnchorProps` ~26-42 → UTM + Play referrer + new tab + `app_store_click`); `apps/web/src/lib/analytics.ts` (`WebEvent` map ~30/43, `trackAppStoreClick` ~160-165); `apps/web/src/lib/campaign.ts` (`getCampaignParams`, `buildPlayReferrer`); `apps/web/src/lib/store-links.ts`.
- Change: extract the shared anchor logic from `store-buttons.tsx` so blog/route CTAs delegate to it; emit `store_cta_click` with `page_type`/`placement`/`slug`. Add PostHog alias `app_store_click`→`store_cta_click`.
- AC: all download CTAs open in a **new tab** (`target=_blank rel=noopener`), stamp UTM + Play referrer, fire one `store_cta_click` with correct props. `open_in_app_clicked` no longer emitted.
- V: click each CTA type in dev → confirm single event with props in PostHog; confirm new tab.

**P0.2 — Fix the two blog-CTA defects.** amber → `palette.signature500`; hardcoded English → `t()` (new `Blog` CTA keys in all 8 web locales). AC: no literal strings, no non-palette colors; `check-i18n` passes.

**P0.3 — Reliable same-tab capture.** For any CTA that must stay same-tab, `posthog.capture('store_cta_click', props, { send_instantly: true })` (verified posthog-js path). Do NOT use preventDefault+setTimeout. AC: event survives navigation (test on a same-tab CTA).

**P0.4 — Consent-independent counter.** New `apps/web/src/app/api/metrics/cta/route.ts`; on `store_cta_click` also `navigator.sendBeacon('/api/metrics/cta', {page_type,platform,slug})` → increment an anonymous aggregate (no cookies/IP/id). Keep `opt_out_capturing_by_default:true` (`instrumentation-client.ts` ~line 50). AC: counter increments even when cookie consent is denied; still no `ph_` cookie pre-consent.

### PHASE 1 — Convert existing traffic (the driver) · web · M

Blog body = MDX-as-string from Supabase (`blog_posts`/`blog_post_translations`, `body_raw`), compiled at request time in `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` via `compileMDX` + an `mdxComponents` map (~81-118, 141-150; rendered ~264; single bottom CTA ~328). `lib/blog.ts` exposes article `type` (`guide|maintenance|trip|gear`), `category`, `title`, `slug`, `keywords` (~11-41), `getRelatedArticles` (~137-148).

**P1.1 [CRITICAL] — Intent-matched mid-article CTA.** New `apps/web/src/components/marketing/contextual-app-cta.tsx` (`{model, angle, source}`), reusing the P0 shared anchor + `palette.signature500` + `next/image` screenshot + `useTranslations`. Angle via **dispatch table** keyed on `article.type` (+ slug/keyword predicate for cost angle); extract model from title/slug:
  - `maintenance` → "Stop looking this up — MotoVault tracks your {model} service intervals automatically and reminds you before each one."
  - cost (slug/keyword `*cost*`) → **expense tracker** (#1 paid): "Log every {model} expense and see your true cost per year."
  - `guide`/diagnostic → "Keep a service history for your {model} so the next warning light makes sense." (NOT AI-led.)
  - Injection: in `page.tsx`, split `mdxSource` on `\n## ` boundaries, `compileMDX` head+tail, render `{head}<ContextualAppCta/>{tail}`; fallback to single render if < N headings. Also register `<AppCta>` in the `mdxComponents` map for future authored articles.
- AC: renders as real SSR DOM (not JS-only), after ~2nd H2, on maintenance/diagnostic cluster; excluded from JSON-LD; copy localized; screenshot loads.
- V: `store_cta_click` with `page_type=blog`, `placement=mid_article`, `slug` present, appears from `/blog/*-maintenance-schedule` pages within days of ISR rebuild.
- Zero-deploy head start: add authored CTA links directly in `body_raw` for the top 5 slugs (yamaha-mt-r-series, honda-cbr-cb, bmw-gs-r, harley-davidson, kawasaki-ninja-z, + motorcycle-check-engine-light-guide) while the component ships.

**P1.2 [HIGH] — Sticky bottom app bar** (Android + desktop only; skip iOS — native Smart App Banner already ships via `apple-itunes-app` meta in web `layout.tsx`). New `components/marketing/sticky-app-bar.tsx`, thin/dismissible (`sessionStorage`), palette + `t()`, shared anchor. AC: non-obscuring, dismissible, only renders when `detectPlatform()!=='ios'`. (SEO safe-harbor.)

**P1.3 [HIGH] — Redesign end-of-article CTA** on the shared plumbing: copper, `t()`, screenshot + App Store rating (`lib/seo/app-store-rating.ts`), intent-matched copy. Retire `download-app-button.tsx` amber path.

**Do NOT** add a modal/interstitial.

### PHASE 2 — Carry intent across the store boundary · mobile + web · S–M (Android) / M (iOS)

Reuses existing pipeline: `onboarding.store.bikeData` → `bike-setup` → `reveal` → OEM maintenance preview → `personalizing.tsx` (~221) → `CompleteOnboarding(acceptedOemScheduleIds)`. Net-new = a resolver + a confirmation step.

**P2.1 [HIGH · Android, deterministic, free] — Play Install Referrer.** Web: extend `buildPlayReferrer` to the unified CTA so every page tags `make`/`model`/`utm_source=blog_maintenance`. Mobile: add `react-native-play-install-referrer`; new `apps/mobile/src/lib/pending-intent.ts` reads referrer on first launch, parses make/model, seeds `onboarding.store.bikeData`. Feed into existing `lib/meta-attribution.ts` (`$set_once install_source`, RC `$mediaSource`) — don't build a parallel system.
- AC: an Android install from a tagged link arrives with `bikeData` pre-seeded; `pending_intent_resolved {method:'play_referrer'}` fires.

**P2.2 [HIGH] — One-tap confirmation handoff.** When intent resolves, `bike-setup` skips the make grid → "Is this your ride? {make} {model}" (year the only input) → straight into `reveal` + OEM preview. Fire `oem_schedule_imported {context:'onboarding'}` (currently only fired from `bike/[id].tsx` ~406).

**P2.3 [HIGH] — Kill empty-garage cliff for intent cohort.** Default the OEM maintenance swipe deck to *accepted* for intent users (they came for exactly this) → guarantees non-empty `acceptedOemScheduleIds`. Add a "no-bike" value screen so bike-skippers (`getNextRoute` + `BIKE_DEPENDENT_SCREENS` ~252-284 in `config/onboarding.ts`) aren't dumped into an empty garage/paywall.

**P2.4 [iOS] — Deferred match + ASA + self-report.** Clipboard-token handoff (`mv:<model>:<source>`, ~2-min TTL, read+clear on first launch). Ship ASA AdServices token (`enableAdServicesAttributionTokenCollection`). Add "Website / Google" option to the HDYHAU screen (`/heard-about`, `referral_source_selected`). Configure **SKAdNetwork/AdAttributionKit conversion values** so Meta/paid iOS installs report (this is why the May Meta campaign was unattributed).
- Decision needed (see §6): native-only vs add Branch free tier for iOS deferred deep linking.

### PHASE 3 — Monetize the intent · mobile (+ RC dashboard) · S–M

**P3.1 [HIGH] — Gate expenses (currently UNGATED).** Expenses is the #1 paid feature but absent from `apps/mobile/src/lib/limits.ts` `FREE_TIER_LIMITS` (~4-9) and `hooks/use-pro-gate.ts`. Add a `MAX_EXPENSES` free limit + post-value soft paywall via `requireAccess` ("See your {model}'s yearly running cost — unlock full history"). Let users log 1–2 expenses free first.

**P3.2 [HIGH] — Intent-aware paywall placement.** Maintenance cohort → placement leading with "Never miss your {model}'s next service — automatic reminders" (`maintenance_reminders` already `PRO_FEATURE` in `limits.ts` ~29). Add `onboarding_maintenance` RC placement; pass resolved intent through the existing `paywall.tsx` personalization path (~59-70). Keep paywall AFTER first value (already correct — do not move earlier).

**P3.3 [MEDIUM] — Longer trial for maintenance cohort** (14–30d, RC-dashboard A/B; needs user — see §6). Maintenance value is time-delayed; a 7-day trial can expire before a reminder fires.

### PHASE 4 — Content & SEO hygiene (parallel) · web/content · S–M each

**P4.1 [HIGH] — India geo noindex.** `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` has no `robots` noindex and no market filter; `sitemap-trips.ts`/`sitemap.ts` enumerate all trips. Add `EU_AMERICAS_COUNTRIES` (`as const`) allow-list gating `generateMetadata` `robots:{index:false,follow:true}` + sitemap inclusion; mirror `lib/seo/place-indexing.ts` (`isIndexable`, `PLACE_INDEX_MIN_ROUTES=8`). Non-destructive. `geo-names.ts` has `IN:'India'` (~44).

**P4.2 [HIGH] — Fix money pages.** `/compare` (pos 24; `compare/page.tsx` has a 10-app matrix + `motovault-vs-*` siblings + 4 JSON-LD) and best-apps listicles (80–93% bounce): add verdict + store buttons above the fold, comparison **tables** in the listicles, inbound internal links from powerhouse articles, de-emphasize the AI-diagnostics column.

**P4.3 [HIGH] — Internal linking hub-and-spoke.** Data-driven `category → {tool, feature, moneyPage}` (`as const`) "related" module rendered between article end and CTA; feed `/compare` links from every powerhouse article; features pages (`features/expense-tracking` [namespace `FeaturesExpenses`], `features/maintenance`) link down to top articles.

**P4.4 [MEDIUM] — Expenses content cluster.** Build via `skills/generate-blog-article`: `/blog/motorcycle-expense-tracker-app`, `/blog/how-much-does-it-cost-to-own-a-motorcycle`, `/blog/motorcycle-fuel-log-app`; rework `motorcycle-maintenance-cost-per-year` (pos 8.5, 88% bounce) with expense CTA; strengthen `features/expense-tracking` H1/title.

**P4.5 [MEDIUM] — Tool CTAs.** `tools/cost-calculator` + `tools/tclocs-checklist` currently dead-end at `/`. Swap for `store_cta_click` CTAs (cost-calculator → expense tracker = tightest intent match on the site). Promote tools from the blogs.

---

## 6. Decisions that need the USER (ask before implementing the affected task)

1. **iOS deferred deep-link stack (P2.4):** native-only (clipboard + ASA + SKAdNetwork — free, code 80% there) vs add **Branch free tier** (≤10K MAU) + Universal Links (better iOS accuracy, adds a dependency). Recommendation: start native, add Branch only if clipboard match proves lossy. NOT Firebase Dynamic Links (EOL Aug 2025).
2. **Trial length A/B (P3.3):** 7d vs 14d vs 30d for the maintenance cohort. RC-dashboard change.
3. **Meta UA:** do not scale until P2+P3 land. When ready, connect a Meta Ads MCP so the next test is measurable.
4. **Expenses free limit (P3.1):** what `MAX_EXPENSES` count before the soft paywall (e.g. 2)?

---

## 7. Already-right — DO NOT rebuild

- Onboarding is value-first with paywall-after-value (`config/onboarding.ts`, `paywall.tsx` continues free ~80-82). Keep the paywall position.
- Mobile attribution infra exists (`meta-attribution.ts`, `install_attribution_captured`, RC `$mediaSource`, HDYHAU). Extend, don't replace. NOTE: `fbclid` capture only began 2026-06-30 and currently returns `organic_unknown` for all installs — verify it actually captures a click-ID before trusting it.
- iOS Smart App Banner already live (web `layout.tsx`). Homepage store CTA already correct (`store-buttons.tsx`). App Store rating fetch exists (`lib/seo/app-store-rating.ts`).
- Onboarding maintenance swipe already imports real OEM schedules (`OemSchedulesPreviewDocument` in `maintenance.tsx` ~66; `acceptedOemScheduleIds` ~185).

## 8. Suggested execution order & PRs

1. **PR-1 (P0):** plumbing + `store_cta_click` + cookieless counter. Small, unblocks measurement. Ship, verify events, then proceed.
2. **PR-2 (P1):** contextual mid-article CTA + sticky bar + end CTA. The driver. (Body-authored links can go live immediately in parallel.)
3. **PR-3 (P2 Android):** Play referrer → pre-seed → confirmation → auto-accept OEM.
4. **PR-4 (P3):** gate expenses + intent paywall.
5. **PR-5 (P2 iOS):** clipboard/ASA/SKAdNetwork/HDYHAU.
6. **P4 PRs:** India noindex, money pages, internal links, expense cluster, tool CTAs — parallelizable.

After each PR: `pnpm precheck`, then re-pull the relevant metric (§3) to confirm movement. Report `store_cta_click` by `page_type` weekly (target 8→40+/28d). Use the `verify` skill to drive the actual flow, not just tests.

## 9. Definition of done (program)

- `store_cta_click` by `page_type`/`slug` live and > 40/28d.
- Web→install visible: Android installs carry `intent_source`; PostHog funnel `store_cta_click`→install→bike_added(prefilled)→trial→paid renders per cohort.
- Expenses gated; intent-aware maintenance paywall live.
- India off-market trips noindexed; money pages reworked; expense cluster published.
- A subsequent small Meta test is fully attributable (CPI→trial→paid).
