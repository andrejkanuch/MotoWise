# Competitor intelligence — MotoVault (iOS)

_Live data pulled **2026-08-24** from the iTunes Search API (22 queries across US/GB/DE/FR/IT/MX/BR)
and the iTunes Lookup API (32 apps × 7 storefronts = 224 per-territory rating reads). Raw JSON in
`01-research/raw-data/2026-08-24/`; the per-territory matrix is
`competitor_ratings_by_country.json`. Supersedes the 2026-07-22 version._

**What this source can and cannot see:** ratings, rating counts, names, descriptions,
genres, price and last-update dates are live and exact. Subtitles and keyword fields are
**not exposed** by any public Apple API — competitor keyword strategy below is inferred
from names, from descriptions, and from which queries return which app.

---

## 1. The ratings question, answered directly

The July audit asserted: *"No motorcycle-maintenance app has meaningful social proof. The
whole cluster is 0–6 ratings."* Checked against live per-territory data:

**Confirmed for the motorcycle-specific cluster. Refuted for European vehicle-management
apps, decisively.**

### Motorcycle-specific ownership apps — ratings summed across our 7 storefronts

| App | US | GB | DE | FR | IT | MX | BR | Σ | Last shipped |
|---|---|---|---|---|---|---|---|---|---|
| MotoMainte | 7@5.0 | 1@5.0 | – | – | 2@5.0 | – | 1@5.0 | **11** | 2026-07-19 |
| Bikeminder | 3@5.0 | 6@5.0 | – | – | – | – | – | **9** | 2026-05-23 |
| Bikefleet | – | – | – | 7@4.9 | – | – | – | **7** | 2026-04-01 |
| **MotoVault** | **1@2.0** | – | 1@4.0 | – | – | – | – | **2** | 2026-07-29 |
| Dirt Bike Dialed | 5@5.0 | – | – | – | – | – | – | 5 | 2026-08-07 |
| Braap | 4@4.8 | – | – | – | – | – | 1@1.0 | 5 | **2016-11-16** |
| Motorbike Service | 2@1.0 | 2@1.0 | – | 1@2.0 | – | – | – | 5 | **2015-12-05** |
| MotorManage | 2@5.0 | – | – | – | – | 1@5.0 | – | 3 | 2026-06-15 |
| Doctoride | – | – | – | 3@5.0 | – | – | – | 3 | 2025-01-08 |
| MotorcycleMate | 2@5.0 | – | – | – | – | – | – | 2 | 2026-08-01 |
| Moto Shed ($0.99) | 1@5.0 | 1@5.0 | – | – | – | – | – | 2 | 2026-08-23 |
| MotoWrench | 1@5.0 | – | – | – | – | – | 1@5.0 | 2 | 2026-03-24 |
| Pitbox Moto | 1@5.0 | – | – | – | – | – | – | 1 | 2026-08-20 |
| Riderr | 1@5.0 | – | – | – | – | – | – | 1 | 2026-04-24 |
| Cylabike | – | – | – | 1@5.0 | – | – | – | 1 | 2026-07-09 |
| MotoLogger | 0 | 0 | 0 | 0 | 0 | – | – | **0** | 2026-08-21 |
| Revvo | 0 | 0 | 0 | 0 | 0 | – | – | **0** | 2026-08-21 |
| Garagely (DE) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 2026-08-20 |
| Motoyra | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 2026-08-18 |
| RideKeep | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 2026-07-13 |
| MotoMaintainAI | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 2026-07-09 |
| Moto-Maintenance Log ($0.99) | 0 | – | – | – | – | – | – | **0** | 2026-05-27 |

So: **the ceiling of the direct motorcycle cluster is 11 ratings across seven of the
world's biggest storefronts, and 8 of the 22 apps have literally zero.** The July "wide-open
social-proof moat" thesis holds, and it holds harder than it did a month ago.

### But the category is not empty in Europe — this refutes the "whole cluster" framing

| App | Positioning | Ratings (where) | Last shipped |
|---|---|---|---|
| **My Garage — Gestione Veicoli** | IT vehicle manager, cars + bikes | **1,428 @ 4.4 in IT** (Σ1,564) | **2020-01-26 — abandoned 6.5 years** |
| mo.ride | Moto app, DE/UK, utilities genre | 199 DE / 145 US / Σ453 | 2025-01-15 |
| IlPieno ($1.99) | IT car maintenance | 148 @ 3.8 IT (Σ190) | **2017-10-07 — abandoned 9 years** |
| **EMX: Entretien Moto & Quad** | FR moto+quad maintenance | **88 @ 4.7 in FR** | **2026-08-24 — shipping today** |
| MotorLog: Gestione Veicoli | IT vehicle manager | 60 @ 4.6 IT | 2026-06-23 |
| RideKeeper | BR moto maintenance | 21 @ 4.7 BR | 2026-06-28 |
| LookOver: Maintenance Tracker | US generic maintenance | 17 @ 4.9 US | 2026-08-14 |
| Mon Carnet d'Entretien | FR service book | 17 @ 4.9 FR | 2026-08-22 |
| MotoMind: Dirt Bike Service | US dirt bike | 15 @ 4.6 US | 2026-05-21 |

**Practical consequence: the "we can be the highest-rated app in this category" claim is
true in en-US and en-GB, and false in Italy and France.** Italy has a 1,428-rating
incumbent; France has an actively-maintained 88-rating specialist. Those two markets need
a different argument than "nobody here has reviews."

### And our own position is narrower than the global number suggests

The brief's authoritative figure is **7 ratings, average 4.43, across 6 countries** (SK 2@5,
BE 1@5, MK 1@5, CL 1@5, DE 1@4, US 1@2). Cross-checked against the per-storefront lookup:
**inside the seven storefronts we actually maintain localized listings for, we have exactly
two ratings — US 1@2.0 and DE 1@4.0.** Every positive rating we own is in a storefront with
no localized listing (SK, BE, MK, CL).

That is the real shape of the trust problem, and it is worse than "4.43 average" reads:

- In the US — 40% of impressions — we display **2.0★** while MotoMainte displays 5.0 from 7,
  MotorcycleMate 5.0 from 2, Moto Shed 5.0, Riderr 5.0, Pitbox 5.0. **We show the worst
  visible rating in the entire US motorcycle-maintenance result set.** An app with zero
  ratings shows no stars at all, which is strictly better than showing 2.0.
- In GB, FR, IT, MX and BR we show nothing, against Bikeminder's 6@5.0 (GB), Bikefleet's
  7@4.9 and EMX's 88@4.7 (FR), My Garage's 1,428 (IT), RideKeeper's 21 (BR).

---

## 2. The structural change since July: a clone farm arrived, and it is winning on names

The July file listed 7 direct competitors. The same queries today return **22**, and the
15 new entrants share an unmistakable pattern — **one product, shipped under a
locale-exact-match name in each market**:

| Clone family | Localized names found | Ratings |
|---|---|---|
| **FixioMoto** | Motorcycle Repair–FixioMoto (US), Motorbike Repair–FixioMoto (GB), Motorrad Wartung–FixioMoto (DE), Entretien moto–FixioMoto (FR), Reparación de moto–FixioMoto (MX) | 0 everywhere |
| **Iron** | Motorcycle Maintenance–Iron (US), Motorrad Wartung–Iron (DE), Manutenção Moto–Iron (BR), Manutenzione Moto–Iron (IT) | 0 everywhere |
| **Garagely** | Garagely: Motorrad-Wartung (DE), Garagely: Manutenção Carro (BR), Garagely: Mantenimiento moto (MX) | 0 everywhere |
| **Cylabike** | Cylabike: Moto Maintenance (US), Cylabike: entretien moto (FR), Cylabike: mantenimiento moto (MX) | 0 / 1 (FR) |
| **MotorApp** | Vehicle Maintenance: MotorApp (US), Mantenimiento: MotorApp (MX), Manutenção carro: MotorApp (BR) | 0 everywhere |
| **Revvo** | Revvo: Motorcycle Maintenance (US), Revvo: Motorrad Wartung (DE) | 0 everywhere |

**They have no users, no reviews and no retention — and they outrank MotoVault in every
localized maintenance query.** Their entire advantage is that the query string is their app
name. The cross-reference is in `keyword-list.md` Finding 1: our head term is in the
keyword field, theirs is in the name, and the name is worth roughly 3× the field.

This is simultaneously the threat and the answer. It is a purely metadata-driven advantage,
which means it is beatable with a metadata change — and once we hold the ranking, we hold it
with a real product, real retention and (eventually) real reviews, which they cannot
answer.

**Update cadence is now weekly across this cluster** — MotoLogger 08-21, Revvo 08-21,
Moto Shed 08-23, Garagely 08-20, Pitbox 08-20, Motoyra 08-18, EMX 08-24. Nobody in this
category is standing still, and a quarterly competitor review is too slow. Monthly.

---

## 3. Where the category has NO credible player — queries worth owning

Ranked by (weak incumbents × relevance to what MotoVault actually does):

| Query | Best incumbent | Verdict |
|---|---|---|
| **`moto maintenance`** (US) | Top 4 are Cylabike 0, RideKeep 0, Revvo 0, Moto-Maintenance Log 0. Best in set: MotoMainte 7. | **Completely uncontested.** `moto` is 5 characters and is indexed nowhere in our listing. |
| **`motorcycle logbook`** (US) | Motoyra 0, Simple Moto Logbook 1 (last shipped 2023). The rest of the result set is *trucking ELD apps* (TruckX, Motive Driver) — Apple has no good answer for this query. | **Wide open, and Apple knows it's a bad result set.** `log` is 4 characters and is indexed nowhere. |
| **`motorrad wartung`** (DE) | All three top results have **0 ratings**. | Open. Our `Wartung` is in the wrong field. |
| **`manutencao moto`** (BR) | RideKeeper 21, then all zeros. BR is our **#2 territory at ~10× its baseline rate**. | Open, and the highest-growth market we have. |
| **`manutenzione moto`** (IT) | MotoMainte 2, My Garage 1,428 **but last shipped 2020-01-26**, MotorLog 60. | Contested on paper, open in practice — the incumbent has been abandoned for 6.5 years and rates 4.4. |
| **`dirt bike maintenance`** (US) | LookOver 17, MotoMind 15, Braap 4 (**last shipped 2016**), Dirt Bike Dialed 5, DirtTime 2. | Genuinely weak, genuinely adjacent. Best served by a **Custom Product Page**, not by diluting primary metadata. |
| `harley maintenance` (US) | Nothing credible — Bikeminder at #5 with 3 US ratings; the rest are dealer apps and AutoZone. | Open, but third-party trademarks in the keyword field are an App Review 5.2.1 risk. Not recommended. See `keyword-list.md`. |

**Queries to concede permanently** (verified live, all owned by apps 1,000–2,300,000
ratings deep): everything nav/GPS/route (`motorcycle app`, `motorcycle tracker`,
`motorcycle mileage`, `motorcycle carplay` — REVER 16,125, Scenic 7,387, Detecht 3,795,
calimoto 17,522 in DE); everything receipt/expense-generic (`receipt scanner expense` —
SimplyWise 36,989, Smart Receipts 12,773); everything car-first (`car maintenance`,
`service reminder`, `oil change reminder` — CARFAX 126,369, Everlance 51,598); and
`scooter maintenance`, which returns scooter-*sharing* apps (Lime 2.28M) and is a dead
query for us.

---

## 4. The adjacent giants, refreshed — and what changed

| App | Ratings (US unless noted) | Last shipped | Read |
|---|---|---|---|
| CARFAX Car Care | 126,369 @ 4.84 | 2026-07-29 | Owns US car maintenance outright. Not a competitor for motorcycles; do not contest its terms. |
| Fuelly: MPG & Service Tracker | 29,401 @ 4.74 | **2024-06-03 — 2+ years stale** | Still ranks on `service reminder`. The category's `Tracker` naming convention comes from here. **Vulnerable**, but on fuel-economy terms we do not want. |
| REVER | 16,125 @ 4.67 | 2026-07-02 | Owns `motorcycle` in search. Does zero upkeep/cost tracking. |
| calimoto (DE) | 17,522 @ 4.64 | 2026-08-17 | Owns `motorrad app` in Germany. Navigation only. |
| Vehicle Maintenance Tracker | 2,889 @ 4.33 | 2026-06-27 | Car-first, fleet fields, lowest rating of the car cohort. |
| My Car — Vehicle Manager | 1,148 @ 4.70 | 2026-08-14 | Fuel + expense + service, all vehicle types. |
| Drivvo | 954 @ 4.68 | 2026-08-19 | Supports motorcycles as a checkbox. Gig-driver angle. |
| Simply Auto | 859 @ 4.10 | **2022-03-24 — stale** | Lowest-rated of the car cohort. |
| **My Garage (IT)** | **1,428 @ 4.40 (IT)** | **2020-01-26 — abandoned** | The one large incumbent standing between us and Italy, and it has not shipped in 6.5 years. |
| Liberty Rider (FR) | 8,144 @ 4.77 | 2026-08-13 | Owns `entretien moto` position 1 in France with a **GPS/SOS** app — Apple is returning a nav app for a maintenance query because no maintenance app is strong enough. That is a ranking vacuum. |

**Unchanged core read, now with live numbers behind it:** no app in any of these three
clusters does expense + maintenance + rides + trips for motorcycles. The nav giants own the
audience and solve the ride. The car giants own the terms and treat motorcycles as a
checkbox. The motorcycle-specific cluster does the right job and has, at best, 11 ratings.

---

## 5. Gaps MotoVault can own — revised priorities

1. **The head-term ranking gap is the whole game and it is a metadata fix.** Zero-rating
   clones beat us in five localized storefronts on name-match alone. Fixing the field
   placement (`keyword-list.md`) neutralises 15 competitors at once, in one release.

2. **Social-proof land-grab, with two carve-outs.** True and now better-quantified in
   en-US/en-GB, where the ceiling is 11 ratings. **Not true in Italy** (My Garage, 1,428)
   **or France** (EMX, 88 and shipping today). And our *own* position inside our seven
   listing storefronts is 2 ratings, one of which is the US 2★ that cannot be replied to.
   The rating soft-ask shipping with 3.19.1 is the unblock.

3. **Two abandoned incumbents are sitting on rankings.** My Garage (IT, 1,428 ratings, last
   shipped 2020-01-26) and IlPieno (IT, 148, last shipped 2017-10-07). Italy is a fully
   localized market for us where the incumbent has been dormant for over six years. Recency
   and rating *velocity* are both ranking inputs; a maintained app with growing reviews
   displaces a dormant one over time. Italy deserves more attention than its current
   impression share suggests.

4. **Real product versus clone farm — say it in the listing.** Fifteen zero-rating clones
   arrived in the last month. Only MotoVault has 12,000+ models backed by NHTSA, OEM service
   intervals, GPX export, CarPlay, and receipt scanning. Bikeminder's per-brand routines
   were its only edge and it has 9 ratings. **"Knows your bike's actual service schedule"
   is a claim no clone can make** and it is the differentiator to lead the description with.

5. **CarPlay is a conversion and editorial asset, not a keyword.** `motorcycle carplay`
   returns navigation apps 1–18 and MotoVault at 19; nobody shopping for a maintenance app
   types it. But **no app in the motorcycle-ownership cluster has CarPlay at all**, and the
   Driving Task entitlement (case 20710293) is rare enough to be an editorial hook. Move
   CarPlay out of the keyword field and into the featuring nomination, the promo text and
   screenshot 3.

6. **Free-forever logging, against a paid cohort.** Moto Shed $0.99, Moto-Maintenance Log
   $0.99, DirtTime $1.99, IlPieno $1.99, Bike Repair $3.99, Car Manager €8.99. Unlimited
   free expense and maintenance logging is a genuine acquisition wedge and is stated
   correctly in the 3.19.1 description. Keep it there.

---

## 6. Practices worth copying, and one to stop

Adopt:
- **Locale-exact-match naming.** The clone farm's only tactic, and it works. The legitimate
  version of it is putting the real category head term in the name/subtitle per locale.
- **`Tracker` as the category noun.** Fuelly, Simply Auto, Vehicle Maintenance Tracker,
  Braap, MotorManage, LookOver, Everlance, Driversnote, TripLog all use it. We use it
  nowhere.
- **Local service-book idioms**, which the clones miss because they machine-translate:
  `Scheckheft` (DE, resale value), `carnet d'entretien` (FR), `libretto di manutenzione`
  (IT), `revisão` (BR). All are in our descriptions already and indexed in none of our
  keyword fields.
- Outcome-first opening lines (CARFAX, Fuelly). Already done.

Stop:
- **Do not contest nav/GPS terms.** `Trip` and `Ride` occupy 11 of 29 subtitle characters
  in a query space owned by apps with 973–16,125 ratings, for the two lowest-demand features
  in the product.
- **Do not lead any locale on AI.** MotoLogger stakes the AI claim and has 0 ratings.
  MotoMaintainAI has 0. Our own `fi` subtitle currently reads `Service, Trips & AI Mechanic`
  — in English, in a Finnish listing, leading on the least-used feature. Fix it.
- **Quarterly competitor reviews are too slow** for a cluster shipping weekly. Monthly.
