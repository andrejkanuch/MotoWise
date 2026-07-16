# MotoVault — ASO Review & Baseline Checkpoint

**Date:** 2026-07-15
**App:** MotoVault (App Store ID `6760291360`) — iOS, Free
**Category:** Utilities (primary) + Lifestyle (secondary)
**Data source:** App Store Connect via `asc` CLI (live), iTunes lookup API, PostHog product data
**Live store version at checkpoint:** 3.13.0 (`READY_FOR_SALE`); 3.15.0 was `WAITING_FOR_REVIEW`

> This is our **first real-data ASO baseline**. Part 1 is a frozen snapshot to compare against on the next review. Part 2 is the ranked change proposal. Every metric lists the exact command to re-pull it so the next checkpoint is apples-to-apples.

---

## Change log — what's been applied

**2026-07-15:**
- ✅ **P0-2 Promotional text** — published to all 7 localized listings on the **live 3.13.0** (visible now, no review) AND carried onto **3.16.0** (so it persists after the next release).
- ✅ **P0-3 Description (en-US)** — opening hook rewritten on **3.16.0** to lead with cost + service ("Know exactly what your motorcycle costs you—and never miss a service again"), demoting the old "not just another GPS" / AI-Mechanic intro. Body unchanged (already expense-first). Ships with 3.16.0 review.
- ✅ **P1-1 Keywords (en-US)** — rebalanced on **3.16.0** to the data-backed field: `log,cost,reminder,gas,record,bike,repair,chain,tire,part,mileage,mpg,fuel,oil,history,budget,vehicle` (exactly 100 chars). Ships with 3.16.0 review.
- ✅ **P0-3 + P1-1 propagated to ALL 7 locales** — expense/cost-first opening rewrite + rebalanced localized keyword fields now applied to en-GB, de-DE, fr-FR, it, es-MX, pt-BR on 3.16.0 (localized: e.g. DE `ausgaben,logbuch,erinnerung,inspektion,reparatur…`, GB adds `MOT`/`tyre`). (Control-group rollout abandoned in favour of full repositioning.)
- ✅ **P0-1 Ratings prompt** — the in-app review system was already wired (`expo-store-review` + `lib/store-review.ts`, fires after 2 value-moments, once/version, triggers on expense-logged & maintenance-completed). Found + fixed the one gap: `record-maintenance.tsx` (logging a completed service record) now fires `maybeRequestReview(MAINTENANCE_COMPLETED)`. Ships with the next mobile build/OTA.

> Note: 3.16.0 was `DEVELOPER_REJECTED` (editable) at time of applying. These metadata changes take effect when 3.16.0 is resubmitted and approved.

---

## TL;DR

- **The store funnel isn't the problem we can see yet — the trust signals are.** Ratings are effectively **zero** (1 rating, 2★, US only). That alone suppresses both conversion and search ranking regardless of how good the copy is.
- **We're leaving free levers on the table.** Promotional text (170 chars, editable anytime with *no review*) is **empty in every locale**.
- **Positioning slightly misfires vs. reality.** The description leads with "not just another GPS" and prominently features the **AI Mechanic** — but AI diagnostics is our *least-used* feature, while **expense tracking is #1** (PostHog-validated).
- **Funnel KPIs (impressions → page views → conversion → downloads) are not yet retrievable** — no analytics report had ever been requested. I've now started that pipeline; numbers land in ~24–48h and become part of the *next* checkpoint.

---

## PART 1 — BASELINE CHECKPOINT (freeze this)

### 1.1 Performance KPIs

| Metric | Baseline (2026-07-15) | How to re-pull |
|---|---|---|
| Avg rating / count — US | **2.0★ / 1 rating** | `curl -s "https://itunes.apple.com/lookup?id=6760291360&country=us"` |
| Avg rating / count — GB, DE, FR, IT, ES, BR, MX | **0 / 0 (each)** | same, `&country=gb\|de\|fr\|it\|es\|br\|mx` |
| App Store impressions (28d) | *pending pipeline* | `asc analytics view --request-id f25db9b3-06e1-4442-a33b-98cf84224602 --date <D> --include-segments --paginate` |
| Product page views (28d) | *pending pipeline* | ↑ report "App Store Discovery and Engagement Standard" (r14) |
| Conversion rate (impression→download) | *pending pipeline* | ↑ derived from r14 |
| Downloads (28d) | *pending pipeline* | report "App Downloads Standard" (r3), or `asc analytics sales --vendor <N>` |

> **Analytics pipeline status:** As of this checkpoint, App Store Connect had **no completed analytics report request**, so historical funnel data was not available via API. I created two requests on 2026-07-15:
> - `ONGOING` — id `f25db9b3-06e1-4442-a33b-98cf84224602` (already existed; now confirmed active)
> - `ONE_TIME_SNAPSHOT` — id `58166e75-1947-4568-96f1-dc38f2447496` (backfills up to ~1 year of history)
>
> Apple takes ~24–48h to generate the first instances. **Action for next session:** re-run the r14/r3 pulls above; those numbers become the *real* funnel baseline. (Set `ASC_TIMEOUT=120s`.)

### 1.2 Store listing metadata (frozen snapshot)

**Name / Subtitle by locale** (15 app-info locales):

| Locale | Name | Subtitle |
|---|---|---|
| en-US | MotoVault: Motorcycle Garage | Service, Expense, Trip & Ride |
| en-GB | MotoVault: Motorbike Garage | Service, Expense, Trip & Ride |
| de-DE | MotoVault: Motorrad Garage | Wartung, Kosten, Fahrt & Tour |
| fr-FR | MotoVault: Garage Moto | Frais, Entretien & Trajets |
| it | MotoVault: Garage per moto | Spese, tagliandi e viaggi |
| es-MX | MotoVault: Garaje Moto | Servicio, Gasto, Viaje & Ride |
| es-ES | MotoVault | Rutas, Mantenimiento y Gastos |
| pt-BR | MotoVault: Garagem da Moto | Serviço, Custo, Viagem & Ride |
| fi | MotoVault: Motorcycle Garage | Service, Trips & AI Mechanic |
| ja | MotoVault | ライド・メンテナンス・経費管理 |
| pl | MotoVault | Trasy, Serwis i Wydatki |
| tr | MotoVault | Sürüş, Bakım ve Harcamalar |
| id | MotoVault | Rute, Perawatan & Pengeluaran |
| th | MotoVault | เส้นทาง บำรุงรักษา ค่าใช้จ่าย |
| hi | MotoVault | राइड, मेंटेनेंस और खर्चे |

**Keywords by locale** (only 7 locales have a localized store version at 3.13.0 — the other 8 fall back to en-US):

| Locale | Keyword field (chars) |
|---|---|
| en-US (97) | `moto,tracker,odometer,route,planner,gpx,fuel,oil,mileage,mpg,touring,biker,maintenance,diagnostic` |
| en-GB (100) | `moto,tracker,odometer,route,planner,gpx,petrol,oil,tyre,mileage,touring,biker,maintenance,diagnostic` |
| de-DE (97) | `moto,tracker,kilometer,route,gpx,benzin,oel,tankbuch,kurvig,diagnose,biker,enduro,abenteuer,reise` |
| fr-FR (97) | `tracker,gpx,essence,vidange,motard,carnet,diagnostic,roadbook,enduro,pneu,balade,voyage,kilometre` |
| it (98) | `moto,bici,pilota,manutenzione,avviso,olio,gomme,benzina,km,mpg,viaggio,tracker,costo,motard,ai,gps` |
| es-MX (97) | `tracker,odometro,ruta,gpx,gasolina,aceite,motero,enduro,aventura,turismo,diagnostico,taller,casco` |
| pt-BR (100) | `tracker,odometro,rota,gpx,gasolina,oleo,motoqueiro,diagnostico,enduro,aventura,turismo,pneu,roadbook` |

**Description (en-US) opening:** *"The motorcycle owner's app—not just another GPS. MotoVault is built for riders who care about their bike as much as the ride. Track every service, log every mile, plan every trip, and ask our AI Mechanic anything…"* (2,819 chars)

**Promotional text:** **EMPTY in all locales.**

**Screenshots (en-US):** iPhone 6.7″ + iPad Pro 12.9″ sets present (plus iMessage variants).

**Product usage truth (PostHog, for reference):** expenses **#1**, then maintenance/service, rides, trips; AI diagnostics **least used**.

---

## PART 2 — PROPOSED CHANGES (ranked)

Ordered by impact ÷ effort. P0 = do now, high leverage, low risk.

> **Status:** items marked ✅ in the *Change log* above (P0-1 ratings prompt, P0-3
> description re-lead, P1-1 keyword rebalance incl. all 7 locales) have since been
> applied — they're retained below for rationale. P0-2 (promotional text) and the
> P2 items remain open.

### 🔴 P0-1 — Fix the ratings problem (biggest single lever)
**Problem:** ~0 ratings. Apple weights rating **count + recency** heavily in search ranking, and a near-empty rating block (or a lone 2★) crushes conversion on the product page. This caps the ROI of every other change below.
**Proposal:**
- Add an in-app `SKStoreReviewController` prompt triggered **after a validated positive moment** — e.g. after the user logs their 3rd expense or completes a service record (expenses/maintenance are the sticky features). Never on launch, never mid-task.
- Gate it with the standard "only if session count ≥ N and no prompt in last 120 days" logic (Apple caps at 3 prompts/year anyway).
- Do **not** gate the prompt on sentiment (no "enjoying MotoVault?" → happy-to-store / unhappy-to-support fork). Sentiment-filtered review solicitation violates App Store Review Guideline 1.1.7 and Google Play policy and risks removal. Present `SKStoreReviewController` unconditionally at the positive moment, and offer an always-available in-app feedback/support entry point separately (not branched off the review ask).
**Measure:** rating count + average per storefront at next checkpoint (target: US 4.5★+ with 20+ ratings within 60 days).

### 🔴 P0-2 — Write promotional text in all 7 localized listings (free, no review)
**Problem:** 170 chars × 7 locales of prime, instantly-updatable real estate sitting empty.
**Proposal (en-US draft):** lead with the #1 job-to-be-done, expenses:
> *"See exactly what your bike costs you. Log fuel, service & repairs, get maintenance reminders, plan rides — the complete motorcycle garage in your pocket."*
- Localize for de/fr/it/es-MX/pt-BR/en-GB. Rotate seasonally (riding-season push in spring, "new year, log your costs" in Jan).
**Measure:** conversion rate delta after publish (promo text changes are immediate — clean A/B signal).

### 🔴 P0-3 — Re-lead the description with expenses + maintenance, demote AI
**Problem:** First screen of the description (the only part most users read) leads with "not just another GPS" and features the **AI Mechanic** — our least-used feature. Expenses (our #1) appears mid-sentence.
**Proposal:** Rewrite the first ~3 lines to lead with cost tracking + service reminders (the features that retain and convert), move AI Mechanic to a supporting bullet. Keep it benefit-first ("Know every euro your bike costs," "Never miss a service"). Reuse the validated ASO benefit lines already in our screenshot set (TRACK EVERY EXPENSE / NEVER MISS A SERVICE).
**Measure:** conversion rate + scroll-through (page views → downloads).

### 🟠 P1-1 — Rebalance the keyword field (now backed by competitor data — see Appendix)
**Current en-US (97):** `moto,tracker,odometer,route,planner,gpx,fuel,oil,mileage,mpg,touring,biker,maintenance,diagnostic`
**What the competitor scan proved:**
- "Expense / Service / Trip / Ride / Motorcycle / Garage" are **already indexed** via name + subtitle — correctly *not* duplicated. Good.
- **Biggest validated gap = the expense economy.** The noun "expense" is only in the subtitle; we have **zero** support for `cost`, `gas`, `budget`, `spending`. Competitors Ride Log, MotorcycleMate, FuelMe, Motorcycle.App all lead on cost/money. `cost` appeared 22× across competitor listings.
- **Second gap = the logbook cluster** (`log` 67×, `record` 22×, `history` 18× across competitors) — entirely absent from our field.
- We waste slots on `diagnostic` (least-used feature) and on nav terms (`route,planner,gpx,touring`) where REVER (15.7k ratings) and Scenic (7.3k) are unbeatable — do not fight there.

**Recommended en-US field (100 chars):**
`log,cost,reminder,gas,record,bike,repair,chain,tire,part,mileage,mpg,fuel,oil,history,budget,vehicle`
Reallocates entirely to un-indexed expense + logbook + maintenance-job vocabulary. (Alt: keep `maintenance`/`tracker`, trim `vehicle`/`budget` — test both.)
**Per-market tweaks:** GB → swap `tire`→`tyre`, add `MOT`. DE → localized job terms (`Wartung,Kette,Reifen,Kosten,Bremse`).
**Rollout:** ship on **en-US first, hold other locales as control**, so the r14 search-impression delta is attributable.
**Measure:** keyword rankings + search-source impressions in r14.

### 🟠 P1-2 — Subtitle A/B test: lead with the top feature
**Current:** "Service, Expense, Trip & Ride." **Hypothesis:** leading with the #1 feature ("Expenses, Service & Ride Log") lifts both relevance for cost queries and tap-through. Run as a **product page A/B test** in App Store Connect (we have the version experiments API: `asc versions experiments-v2`).

### 🟡 P2-1 — Complete localization for the 8 fallback locales OR trim them
**Problem:** 15 locales show a localized name/subtitle, but only 7 have localized keywords/description at 3.13.0 — the other 8 (incl. es-ES, ja, pl) fall back to en-US body copy, wasting their name/subtitle relevance. Note: **hi/id/th are outside our target markets (Europe + Americas)** and per strategy should likely be removed, not completed.
**Proposal:** For in-market fallbacks (es-ES, pl), add full localized keywords+description. For out-of-market (hi, id, th, tr?), remove the localization to avoid diluting/confusing store presence.

### 🟡 P2-2 — Category sanity check
**Current:** Utilities + Lifestyle. Utilities is enormous and generic. Worth checking (in the competitor research) whether comparable moto apps rank/convert better under **Travel** or **Sports** as primary. Low urgency, test only if competitors cluster elsewhere.

### 🟡 P2-3 — Screenshot caption audit
We have iPhone 6.7″ + iPad sets live. Verify the *live* captions match our validated flagship order (TRACK EVERY EXPENSE first). If the store is still showing an older ordering, re-upload with expense-first. (Screenshots are the single biggest visual conversion lever after ratings.)

---

## How we'll know if we're doing better (next checkpoint)

Re-run this doc's §1.1 commands and compare:
1. **Ratings**: count ↑ and average ↑ per storefront (primary success metric for P0-1).
2. **Conversion rate** (r14, once populated): ↑ after P0-2/P0-3/P1 ship.
3. **Search-source impressions** (r14): ↑ for cost/maintenance queries after P1-1.
4. **Downloads** (r3): net ↑.

Suggested cadence: re-checkpoint in **4 weeks** (2026-08-12), after the analytics pipeline has ≥2 weeks of populated data.

---

## Appendix — Competitor keyword intelligence
*Fetched live from iTunes Search API 2026-07-15 (US/GB/DE), ~45 apps parsed, ~17 direct owner-app competitors analyzed.*

**The market splits in two.** MotoVault sits in the **owner/maintenance/logbook** cluster — NOT the GPS/navigation cluster. The nav apps (REVER 15.7k ratings, Scenic 7.3k, Detecht 3.7k, Cardo 2.4k, MyRide 1.5k) own the head term "motorcycle" by sheer rating volume, so chasing route/GPS keywords is a losing fight. Our real cohort:

| Competitor | Category | ~Ratings (US) | Leads with |
|---|---|---|---|
| Ride Log: Motorcycle Tracker | Lifestyle | new | Rides + fuel + expenses; **"save money on expenses"** |
| MotorManage | Utilities | ~1 | "Never miss maintenance"; free, offline |
| RIDEOLOGY (Kawasaki OEM) | Sports | 94 | Odometer, fuel economy, service reminders |
| Bikeminder | Lifestyle | 3 | Pre-built per-brand maintenance routines |
| MotorcycleMate | Utilities | 2 | "Track **costs** and MPG" |
| Motorcycle.App | Lifestyle | 2 | "Saves time, **money** and headaches" |
| Moto Shed | Lifestyle | 1 | Maintenance + service + fuel log |
| Iron / Strox / MotoLogger | Utilities/Lifestyle | new | Maintenance by mileage; reminders; insurance/MOT |
| FuelMe | Productivity | new | "**Fuel costs, consumption, all expenses**" |

**Competitor term frequency (owner cohort):** `maintenance 78 · log 67 · service 56 · track 53 · ride 51 · fuel 30 · mileage 23 · cost 22 · record 22 · history 18 · reminder 15 · tire 12 · expense 11 · oil-change 11 · chain 11 · gas 9 · garage 9 · part 8 · logbook 7`

**Positioning takeaways:**
1. **The white space is "expense + maintenance owner tool" and it's open** — only 3 competitors lead on cost/money, none combines a polished expense ledger + service reminders + ride log the way our PostHog feature order does.
2. **Utilities primary is correct/on-cohort** (our functional twins MotorManage/Iron/MotoMainte are all Utilities). Don't chase Navigation.
3. **GB/DE surface the identical cohort** — one keyword strategy travels, with `tire→tyre`+`MOT` (GB) and localized job terms (DE).
4. **Consider a subtitle test foregrounding expense even harder** (e.g. "Expense, Service & Fuel Log") — our #1 paid feature currently sits 2nd. (Feeds P1-2.)
