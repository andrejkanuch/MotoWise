# MotoVault — SEO→Paying-User Conversion Plan (2026-07-15)

Companion to `docs/SEO-Review-2026-07-15.md`. Synthesizes five specialist investigations (in-content CRO, attribution/measurement, content→commercial bridge, install→paid continuity, external research) into one prioritized, dependency-sequenced plan.

## The one-line diagnosis (all five agents converged)

**This is a conversion-mechanics failure, not a traffic failure.** ~700 organic visitors/28d → 1 blog CTA click = **0.14%**. The traffic engine works and compounds ~6×; the money is lost at four seams: (1) the blog CTA is broken/underbuilt, (2) web intent dies at the App Store boundary, (3) the #1 paid feature (expenses) isn't gated, (4) off-target geo pollutes the profile. Benchmarks say a fixed content→app funnel converts **2–4%** — a 15–25× headroom on the same traffic.

## What's already right (don't rebuild)

- **Onboarding is value-first**: bike-setup → reveal → real OEM maintenance preview → *then* paywall (`apps/mobile/src/config/onboarding.ts`). Paywall-after-value is best practice and shipped.
- **Mobile attribution exists**: `meta-attribution.ts`, `install_attribution_captured`, RC `$mediaSource`. The gap is the *web→install* seam, explicitly deferred in the June attribution plan.
- **iOS Smart App Banner already live** (`apple-itunes-app` meta, web `layout.tsx`).
- **Homepage store CTA is correctly plumbed** (`store-buttons.tsx` → `storeAnchorProps`: new tab, UTM stamp, Play referrer, reliable beacon) — it converts ~20/28d. The blog CTA does none of this and converts ~1.

## North Star & the number to watch weekly

- **North Star:** web-attributed installs / week (installs whose `install_source` resolves to a web UTM / Play referrer).
- **Leading proxy until attribution lands:** `store_cta_click` rate by `page_type`/`slug`. **Target: 8 → 40+/28d.**
- **Full funnel:** `store_cta_click` → install → `bike_added(prefilled_from_intent)` → `oem_schedule_imported` → `paywall_viewed` → `purchase_completed(trial)` → renewal.

---

## Phase 0 — Foundation: fix + unify the CTA plumbing (do FIRST; everything depends on it)

Everything else is unmeasurable or leaky until this ships. **Effort: S–M · Owner: web**

- **Unify all download CTAs onto one component + one event.** Retire `open_in_app_clicked`; collapse to `store_cta_click { platform, page_type, placement, slug, utm_* }`; alias `app_store_click` → `store_cta_click` in PostHog (keep history). Make `download-app-button.tsx` and `route/.../open-in-app-cta.tsx` delegate to the homepage's `storeAnchorProps()`.
  - This single change simultaneously: ends the event split, opens in **new tab** (kills the nav-race that partly explains "1 click/28d"), stamps **UTM + Play referrer** on the 85% of traffic that currently drops them, and produces the exact **by-slug conversion metric** the review asked for.
- **Fix the two CTA defects found in code:** off-brand `amber-*` → `palette.signature500` (copper); hardcoded English → `t()` / `next-intl` (13 locales).
- **For any CTA that must stay same-tab:** capture with `{ send_instantly: true }` (verified posthog-js path; do *not* use `preventDefault`+setTimeout).
- **Consent-independent measurement:** keep `opt_out_capturing_by_default:true`, but add a cookieless aggregate counter — on `store_cta_click`, `navigator.sendBeacon('/api/metrics/cta', {page_type,platform,slug})` to a Next route handler that increments an anonymous count. Gives a consent-proof denominator so "conversion bad" vs "measurement dark" are separable (EU accept-rate plausibly undercounts events ~2–3×, and hits blog harder than homepage).

**Files:** `components/download-app-button.tsx`, `route/[country]/[region]/[slug]/open-in-app-cta.tsx`, `components/marketing/store-buttons.tsx` (extract shared), `lib/analytics.ts`, new `app/api/metrics/cta/route.ts`.

---

## Phase 1 — Convert the traffic you already have (the driver)

The audience exists and compounds; the only missing thing is a relevant conversion moment where readers actually are. **Effort: M · Owner: web**

- **[CRITICAL] Intent-matched mid-article CTA block** with a product screenshot, injected after the ~2nd `<h2>` across the maintenance/diagnostic cluster. Copy angle by `article.type` via a dispatch table (no if/else, no magic strings):
  - `maintenance` schedules → *"Stop looking this up — MotoVault tracks your {model} service intervals automatically and reminds you before each one."*
  - cost articles (slug/keyword match) → **expense tracker** (#1 paid): *"Log every {model} expense and see your true cost per year."*
  - diagnostic / check-engine → *"Keep a service history for your {model} so the next warning light makes sense."* (frame as garage/health log, **not** AI diagnostics — out of positioning scope).
  - **Mechanic:** blog body is MDX-as-string compiled at request time with a components map. Split `mdxSource` on `\n## ` boundaries and render `{head}<ContextualAppCta/>{tail}` → lands on **every already-published powerhouse article at once**, no re-authoring. Register `<AppCta>` in the components map so future generated articles get it too.
  - **Zero-deploy head start (today):** add authored contextual CTA links directly in Supabase `body_raw` for the top 5 slugs while the component ships.
- **[HIGH] Sticky dismissible bottom app bar** (Android + desktop only; iOS already has the native Smart Banner). Thin, non-obscuring, `sessionStorage` dismissal → inside Google's intrusive-interstitial safe harbor.
- **[HIGH] Redesign the end-of-article CTA** on the same plumbing: copper, `t()`, `StoreButtons`, screenshot + App Store rating (`lib/seo/app-store-rating.ts`) for social proof, intent-matched copy.
- **Do NOT** add a full-screen/exit-intent modal — Google penalizes interstitials on the search-landing page (the very asset), and it's off-brand. The sticky bar captures the same "always-available" value safely.

**Expected:** blog-sourced store clicks from ~0 to the dominant share of the funnel; `store_cta_click` toward 40+/28d within 2–3 weeks of ISR rebuild + re-index. (Benchmarks: mid-article contextual boxes 2–4%; end CTAs +67% clicks — do both.)

**Files:** new `components/marketing/contextual-app-cta.tsx`, `sticky-app-bar.tsx`; `blog/[slug]/page.tsx` (MDX split + inject); reuse `store-buttons.tsx`, `campaign.ts`; new `Blog` i18n CTA keys.

---

## Phase 2 — Carry intent across the store boundary (the web→app bridge)

Make an install land in the value the reader came for. Reuses the existing `onboarding.store.bikeData` → reveal → OEM-preview → `CompleteOnboarding(acceptedOemScheduleIds)` pipeline, so net-new code is a resolver + a confirmation screen. **Effort: S–M (Android) / M (iOS) · Owner: mobile + web**

- **[HIGH · Android first, deterministic, free] Play Install Referrer.** Web already writes a deterministic `referrer` via `buildPlayReferrer` — but only on the homepage, and **mobile never reads it**. Extend the tag to the unified CTA with `make`/`model`/`utm_source=blog_maintenance`; add `react-native-play-install-referrer`; parse in a new `lib/pending-intent.ts` on first launch → seed `onboarding.store.bikeData`. Closes a loop that's half-built.
- **[HIGH] The handoff UX:** when intent resolves, `bike-setup` skips the make grid and opens a one-tap **"Is this your ride? Yamaha MT-07"** confirmation → straight into personalized reveal + OEM maintenance preview. First value (their bike + its real service schedule) in ~10 seconds.
- **[HIGH] Kill the empty-garage cliff for this cohort:** default the OEM maintenance swipe deck to *accepted* for intent users (they came for exactly this) → guarantees a populated garage on completion. Add a "no-bike" value screen so skippers aren't dumped into nothing.
- **[iOS] Deferred match:** ship the pragmatic clipboard-token handoff (`mv:<model>:<source>`, ~2-min TTL, read + clear on first launch). Also ship ASA AdServices token (specced in June plan U5) and add a **"Website / Google"** option to the HDYHAU onboarding screen for self-reported web origin at peak recall.
  - *Decision:* start native (free, code 80% there, deterministic on Android). Only adopt **Branch free tier (≤10K MAU) + Apple Universal Links** if iOS web→install volume proves the clipboard match too lossy. (Do **not** use Firebase Dynamic Links — EOL Aug 2025.)
- **Measurement hooks:** extend `install_attribution_captured` with `intent_make/intent_model/intent_source`; new `pending_intent_resolved {method}`; `bike_added {prefilled_from_intent}`; fire `oem_schedule_imported {context:onboarding}`; register an `intent_cohort` super-property.

**Files:** `apps/mobile/src/lib/meta-attribution.ts`, new `lib/pending-intent.ts`, onboarding `bike-setup`/`maintenance` screens; web store-link tagging in `campaign.ts`/`store-buttons.tsx`.

---

## Phase 3 — Monetize the intent

**Effort: S–M · Owner: mobile (+ RC dashboard)**

- **[HIGH] Intent-aware paywall placement + copy.** Maintenance cohort should hit *"Never miss your {model}'s next service — automatic reminders"* (`maintenance_reminders` is already `PRO`). Add an `onboarding_maintenance` RC placement; pass resolved intent through the existing personalization path.
- **[HIGH] Gate expenses — the #1 paid feature is currently ungated** (absent from `FREE_TIER_LIMITS` / `useProGate`). Best practice = post-value: let the user log 1–2 expenses free, then a soft `MAX_EXPENSES` paywall (*"See your {model}'s yearly running cost — unlock full history"*). Converts the exact intent behind the ranking cost article.
- **[MEDIUM] Longer trial for the maintenance cohort (14–30d, RC-dashboard A/B).** Maintenance value is *time-delayed* — a 7-day trial can expire before a reminder ever fires. Benchmarks: 17–32d trials convert ~70% better; value-event paywalls get 2.1× more trial starts.

---

## Phase 4 — Content & SEO hygiene (parallelizable)

**Effort: S–M each · Owner: web / content**

- **[HIGH] Off-target geo cleanup.** India trip detail pages (`trips/[country]/[region]/[slug]/page.tsx`) have no `robots` noindex and no market filter in the sitemap. Add an `EU_AMERICAS_COUNTRIES` (`as const`) allow-list gating `generateMetadata` `robots:{index:false,follow:true}` + sitemap inclusion (mirror the existing `place-indexing.ts` pattern). Non-destructive; prunes zero-value impressions dragging CTR to 0.74%.
- **[HIGH] Fix the money pages.** `/compare` (pos 24) and the best-apps listicles (80–93% bounce) need: a decisive verdict + store buttons above the fold, comparison **tables** (Google rewards these for "best X app"), inbound internal links from the high-traffic informational articles, and de-emphasis of the AI-diagnostics column.
- **[HIGH] Internal linking hub-and-spoke.** Route informational readers to feature + money pages; feed `/compare` internal PageRank from every powerhouse article; build a data-driven `category → {tool, feature, moneyPage}` "related" module rendered between article end and CTA.
- **[MEDIUM] Build the expenses cluster** (there's zero ranking expense content): `/blog/motorcycle-expense-tracker-app`, `/blog/how-much-does-it-cost-to-own-a-motorcycle`, strengthen `features/expense-tracking` on-page SEO — via the `skills/generate-blog-article` pipeline, each with intent-matched CTAs baked in.
- **[MEDIUM] Tools as conversion bridges.** `cost-calculator` and `tclocs-checklist` currently dead-end at `/`. Swap for store CTAs: cost-calculator → *"Want these numbers tracked automatically?"* (tightest intent match on the site; interactive-tool completers convert ~2.4× static). Promote the tools from the blogs.

---

## Sequenced summary

| Phase | Move | Effort | Impact | Owner |
|---|---|---|---|---|
| **0** | Unify CTA plumbing + `store_cta_click` + cookieless counter | S–M | Enables everything; fixes nav-race + attribution | web |
| **1** | Mid-article intent CTA + sticky bar + end-CTA redesign | M | **Highest** — converts existing traffic | web |
| **2** | Play Referrer → pre-seeded one-tap onboarding + iOS clipboard/ASA/HDYHAU | S–M / M | Installs land in value; web→install visible | mobile+web |
| **3** | Intent paywall + gate expenses + longer trial | S–M | Turns installs into subscriptions | mobile |
| **4** | India noindex + money pages + internal links + expense cluster + tool CTAs | S–M ea. | Cleaner profile, more commercial traffic | web/content |

**Critical path to first paying-user lift:** Phase 0 → Phase 1 → Phase 2-Android → Phase 3 (gate expenses + intent paywall). Phase 4 runs in parallel.

## Honest caveats
- Benchmark multipliers (Branch smart-banner 2016 ecommerce study; RevenueCat/Adapty not moto-segmented) are **directional** — validate against MotoVault's own PostHog funnel once Phase 0 makes it trustworthy.
- iOS organic-web→install is self-report/probabilistic without a paid MMP; Android + ASA are deterministic. That's the realistic ceiling and still a large step up from ~0.
