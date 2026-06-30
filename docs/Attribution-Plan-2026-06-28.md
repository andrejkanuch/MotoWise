# MotoVault Attribution Plan — Where do installs & paid users come from?

_2026-06-28. Produced by an orchestrated agent team (2 codebase auditors + 3 web researchers → synthesis → adversarial stress-test), then corrected against the stress-test findings._

## TL;DR

You are a solo dev at ~$29 MRR / 6 active subs doing 3×/day **organic** social (TikTok/Instagram). The blind spot is **install source**, not analytics quality. The hard structural truth: the **App Store strips UTMs**, and the dominant path (TikTok/IG → App Store search → install) is intrinsically only ~40–60% attributable *even with paid tooling*. So the winning strategy is **scrappy-native, self-report-led** — not an MMP.

**Ship this v0 first (cheap, high-signal, days not weeks):**
1. **"How did you hear about us?" (HDYHAU)** question at onboarding → the single best organic-social signal at this volume.
2. **Turn on the RevenueCat → PostHog integration** (the `$posthogUserId` stitch already exists in `subscription.ts` — it's a dashboard toggle).
3. **Add `$idfv` + AdServices token collection** (~2 lines in `subscription.ts`) so subs stop showing as "No Attribution".

Everything else (web↔mobile stitch, Branch deferred deep links, promo codes, MMP) is **premature at 6 subs** — wire only when volume/budget justifies it.

---

## What's ALREADY built (corrected — the draft oversold the gaps)

The stress-test verified these against the code; do **not** rebuild them:

- `meta-attribution.ts` **already emits** a PostHog `$set` with `utm_content/utm_source/utm_campaign/first_seen_at` — but only **when `utm_content` is present**, and uses `$set` (not `$set_once`).
- `analytics.ts → identifyUser()` **already merges stored UTM** onto the PostHog person at sign-in. UTM→PostHog is **not** net-new work.
- RevenueCat ↔ PostHog stitch **already exists** via the `$posthogUserId` customer attribute (set both anonymously and on login).

## The REAL gaps

- `captureAppLifecycleEvents` is **not enabled** → `Application Installed` never fires today. (And even once on, it carries **no source** — it's a count/timing join key, not a channel signal.)
- Attribution only fires on `utm_content`-bearing deep links → **fbclid-only / source-only / organic App Store installs record nothing**.
- `$set` (last-write) instead of `$set_once` → first-touch source can be overwritten.
- No onboarding "how did you hear" question → organic social recall is lost at the one moment it exists.
- RevenueCat: no AdServices token, no `$idfv`, no `$mediaSource`, RC→PostHog integration **toggle is off** → 100% "No Attribution".
- Web store links (`apps/web/src/lib/store-links.ts`) untagged, **and** store URLs are hardcoded in **6+ other web files** (must consolidate before tagging or Android Play-referrer undercounts).
- `no-referrer` policy + `target=_blank` on store buttons → web never sees social referrers.

---

## Measurement model — how you'll actually answer the two questions

No single deterministic chain is possible (App Store kills it). You triangulate, strongest-signal first:

**Where did this INSTALL come from?**
1. **Self-report (primary):** HDYHAU answer → PostHog person prop `heard_from` + RC attribute `$attribution_channel`. The only signal for App-Store-search installs.
2. **Channel-aggregate (deterministic, no user-level):** one **App Store Custom Product Page** per channel (`?ct=` token) → App Store Connect reports downloads/subs per page (suppressed under ~5/token). **Google Play Install Referrer** preserves `utm_source` through install on Android (iOS does not).
3. **Event-level:** `Application Installed` for install count/denominator; `install_source` populated only when a deep link carried it.

**Where did this PAID user come from?**
- RC is revenue source-of-truth, stitched to PostHog via `$posthogUserId`. After the integration toggle, `rc_initial_purchase` / `rc_trial_converted` events arrive in PostHog carrying `$mediaSource` + `$attribution_channel`.
- PostHog **funnel**: `Application Installed → RC purchase`, broken down by `heard_from` (self-report) or `$initial_utm_source` (deep-link users) → conversion **rate** per channel.
- **Reconcile weekly:** HDYHAU distribution vs CPP/Play counts. Where they agree, trust the ranking; discount HDYHAU's bias toward recognizable brands (it under-credits "App Store search").

---

## Tracks (tier-ordered; impact levels corrected by stress-test)

### Tier 1 — scrappy-native (do these)

**T1. HDYHAU onboarding question** · effort low · **impact high**
- Add one screen to `src/config/onboarding.ts` (all 3 variants). **Verify exact step order per variant first** — in lean/invested the paywall may precede account creation; consider placing HDYHAU **after** first session/paywall to avoid conversion drag.
- Options (`as const`, via `t()` for all 13 locales): TikTok, Instagram, YouTube, Friend/word-of-mouth, **App Store search**, Google search, ChatGPT/AI, **Don't remember**, Other. (Include "App Store search" + "Don't remember" to reduce forced-attribution bias.)
- Fire `referral_source_selected`; `identify(userId, { $set_once: { heard_from } })`; set RC `$attribution_channel` **before the first purchase event fires**.

**T2. Fix install instrumentation** · effort low · **impact high**
- Enable `captureAppLifecycleEvents` in `analytics.ts`.
- In `captureMetaAttribution()`: emit on **all** first launches (not just `utm_content`), switch to **`$set_once`**, default `install_source='organic_unknown'`, stamp `install_platform`/`install_version`.
- Attach stored fbclid/UTM to `onboarding_started`. (Note: this event = install **count**, source is null for organic browse — fill via T1.)
- Guard against double-count: `Application Installed` re-fires on reset unless `InstalledAppBuild` is preserved; unsupported with `persistence:'memory'`.

**T3. App Store Custom Product Pages + Google Play Install Referrer** · effort medium · **impact high**
- Create CPPs (TikTok / Instagram / web), each with its own `?ct=` token; point each bio link at its CPP.
- Tag Android Play links with `utm_source/medium`; read via Play Install Referrer on first Android launch → `install_source` (deterministic on Android).
- **Consolidate the 6+ hardcoded store-URL literals** into `store-links.ts` **before** tagging.
- Caveat: in-app browsers (TikTok/IG webview) mangle universal-link/CPP redirects — test the bio-link path.

**T4. Finish RevenueCat wiring** · effort low · **impact high**
- After `Purchases.configure()` (`subscription.ts:157`): `enableAdServicesAttributionTokenCollection()` (iOS-only; reclassifies **ASA-tapped** installs → otherwise just shows "Organic", cosmetic for social) + `collectDeviceIdentifiers()` (`$idfv`, the durable win).
- Map resolved `utm_source` → `$mediaSource`/`$campaign`. Real constraint is **ordering** (set before first purchase event), not "immutability."
- **Toggle on RC → PostHog** (EU key). **Skip** the Meta Ads `$fbAnonId` integration (organic-only = pure ATT friction).
- Also: diagnose **why Apple Search Ads isn't populating** — enabling the AdServices token is the likely fix; confirm ASA is set up in App Store Connect.

### Tier 2 — mid (wire only past an activation gate, e.g. >30 installs/day for 2 weeks)

**T5. Web→mobile identity & UTM persistence** · **impact low** (downgraded)
- Capture `utm_*`+referrer into `$set_once` in `apps/web/src/instrumentation-client.ts`; persist through signup + checkout-success.
- Configure the **missing app-link verification** (`ANDROID_CERT_SHA256` assetlinks.json; `.well-known/apple-app-site-association` route).
- Reality: only helps users authenticated on **both** web and mobile — near-zero today. Cold App Store installs **cannot** carry a web distinct_id.

**T6. Branch deferred deep linking** · **impact low** (downgraded)
- Probabilistic match is **<30% on modern iOS** (Private Relay/ATT) and fingerprinting-for-attribution carries **App Store Review policy risk**. Only adopt if you run paid UA needing deep links into content — not as an organic tool.

**T7. Per-channel promo codes** · **impact low** (downgraded)
- Codes **leak** (screenshots/coupon sites) so redemptions mis-attribute; redeemers are biased/low-LTV. **Not** ground truth. Skip at 6 subs.

### Tier 3 — full-MMP (deferred until paid spend exists)
- Tenjin (free ≤2k paid conv/mo) for paid UA cost/LTV via RC device IDs.
- **TikTok** has no RC-native path; needs Singular (free tier) or Adjust (~$2,500+/yr), and even then it's TikTok's self-reported Advanced SAN.
- Avoid AppsFlyer/Branch enterprise — overbuilt.

---

## Open risks / honest ceilings
- **~70–80%** of organic-social installs likely never tap the bio link → HDYHAU is the only signal for them. No tooling closes this.
- CPP `?ct=` data **suppressed under ~5 installs/token** → early data patchy at <10/day.
- HDYHAU **recall bias** over-credits known brands, under-credits App Store search.
- iOS UTMs dead on install; iOS 26 Link Tracking Protection strips gclid/fbclid.
- **Do NOT add an ATT prompt** (organic app = pure downside); confirm no dependency silently triggers one. SKAdNetwork/AdAttributionKit intentionally out of scope (useless without ad networks).
- PostHog person-merges are irreversible; reinstalls inflate anonymous IDs; EU person-on-events = props reflect value at ingestion time (affects breakdown funnels).

## VERIFY before building
- The audit found `motovault-meta-ads-starter-guide.md` referencing a **$14/day Meta campaign**. If that's actually live, RC being 100% "No Attribution" is itself a misconfiguration finding — confirm in Meta Ads Manager + RC before building tracks around paid Meta.

## Recommended sequence
1. **This week:** T1 (HDYHAU) + T4 toggle/`$idfv` + T2 enable lifecycle + build the PostHog Acquisition dashboard & install→paid funnel skeleton.
2. **Next:** T3 CPPs + Android referrer (after consolidating store URLs).
3. **Gate everything else** behind real install volume.
