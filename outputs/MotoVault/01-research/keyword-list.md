# Keyword research — MotoVault (iOS)

_App id 6760291360. All data in this file pulled first-party on **2026-08-24** from the
iTunes Search API, the iTunes Lookup API and the App Store Connect API (`asc`). Raw JSON
in `01-research/raw-data/2026-08-24/`. Supersedes the 2026-07-22 version of this file._

## The question this file answers

3.18.0 rebuilt the keyword fields on 2026-07-29 and impressions went ×2.45 (56.5 → 138.4
per day) with both conversion ratios flat. **Where is the next multiple?**

Answer, in one line: **not in the keyword field — in the subtitle.** The 100-char field is
already close to fully utilised and, on the evidence below, it is the weakest of the three
indexed surfaces. The single highest-value category term in every one of the seven locales
is currently sitting in that weak field, and we do not rank for it anywhere.

---

## Method, and its one important limit

Two data sources, and they answer different questions:

- **App Store Connect (`asc`)** — authoritative for what our own metadata *is*. Name,
  subtitle and keyword field per locale, per version. No caveats.
- **iTunes Search API** — the only free source of live competitor ranking. **It is not the
  same relevance engine as App Store search.** Absolute ranks here are not App Store
  ranks.

The limit matters, so the analysis below leans on *relative* comparisons **inside a single
query set**, and on one internal control: MotoVault's own terms are spread across all three
indexed fields, so we can see how the same engine treats a name term versus a subtitle term
versus a keyword-field term for the *same app*. That comparison is not affected by the two
engines differing, and it replicates across 7 locales.

What is **not** available at any price here: real Apple search volumes. There is no Apple
Search Ads campaign running, so no popularity scores. Every "demand" judgement below is
ordinal, inferred from result-set depth and from who ranks. **No search-volume number is
quoted in this file, because none exists.** Prior versions of this file printed figures
like "45K/month" — those were invented and should not be reused.

---

## Finding 1 — the field-weight ladder, measured on our own listing

MotoVault's terms are distributed as: `Motorcycle`, `Garage` in the **name**; `Expense`,
`Service`, `Trip`, `Ride` in the **subtitle**; `maintenance`, `cost`, `repair`, `mileage`,
`carplay` and 9 others in the **keyword field**. Live US results, 2026-08-24:

| Query | Where our matching term lives | Our rank |
|---|---|---|
| `motorcycle garage` | **name** | **1 of 16** |
| `motorcycle expense` | **subtitle** (`Expense`) | **3 of 18** |
| `motorbike service` (GB) | **subtitle** (`Service`) | **4 of 14** |
| `motorcycle cost` | keyword field (`cost`) | 14 of 14 |
| `motorcycle carplay` | keyword field (`carplay`) | 19 of 19 |
| `motorcycle maintenance` | keyword field (`maintenance`) | **absent from 20** |
| `motorcycle repair` | keyword field (`repair`) | **absent from 15** |
| `motorcycle mileage` | keyword field (`mileage`) | **absent from 15** |
| `motorcycle logbook` | nowhere | absent |
| `motorcycle tracker` | nowhere | absent |

Name term → top 1. Subtitle term → top 4. Keyword-field term → bottom of the set or
absent. It is a clean monotonic ladder with no exceptions in the set.

**It replicates in every localized storefront.** In each case the head term is in our
keyword field, and apps with the same term in their *name* — several with literally zero
ratings — outrank us:

| Storefront | Query | Our term is in… | Our rank | Who takes the top slots |
|---|---|---|---|---|
| DE | `motorrad wartung` | field (`Wartung`) | **absent** | Motorrad Wartung–FixioMoto (0 ratings), Revvo: Motorrad Wartung (0), Garagely: Motorrad-Wartung (0) |
| FR | `entretien moto` | field (`entretien`) | **absent** | Mon Carnet d'Entretien (17), EMX: Entretien Moto (88), Entretien moto–FixioMoto (0) |
| IT | `manutenzione moto` | field (`manutenzione`) | **absent** | MotoMainte (2), My Garage (1,428), MotorLog (60) |
| BR | `manutencao moto` | field (`manutenção`) | **absent** | RideKeeper (21), GaragemX (0), Manutenção Moto–Iron (0) |
| MX | `mantenimiento moto` | field (`mantenimiento`) | 14 of 14 | Mantenimiento: MotorApp (0), MotoMainte (0), FixioMoto (0) |

Seven locales, one pattern: **the head term of this category is in the wrong field.**

A second-order read of the same data: the 3.18.0 subtitle change is widely credited for
the ×2.45, but the live subtitle is `Expense, Service, Trip & Ride` and the pre-3.18.0
subtitle was `Service, Expense, Trip & Ride`. **Only the word order changed — the indexed
token set is identical.** Promotional text is not indexed by Apple at all. So the entire
×2.45 is attributable to the keyword field alone. That is good news for the ladder thesis:
the *weakest* surface produced a 2.45× on its own, and the two stronger surfaces have not
been touched since launch.

---

## Finding 2 — what the 3.19.1 en-US set gets right and wrong

3.19.1 (`WAITING_FOR_REVIEW` as of today, so still changeable) ships:

```
receipt,maintenance,fuel,reminder,cost,mileage,repair,budget,oil,tire,chain,carplay,rider,bike
```
94 / 100 chars, 14 tokens.

**Redundant or unearned — 30 chars recoverable:**

| Token | Chars | Verdict |
|---|---|---|
| `maintenance` | 12 | **Not redundant — misplaced.** Highest-value term in the category, sitting in the lowest-weight field, and we rank nowhere for it. Promote to subtitle (Finding 1). |
| `budget` | 7 | **Cut.** Duplicates `cost` in intent. Flagged for removal in the July research and never removed. |
| `carplay` | 8 | **Cut.** Empirically buys rank 19 of 19 in `motorcycle carplay`, a query owned outright by navigation apps (Scenic 7,387 ratings, REVER 16,125, Sygic 56,741). CarPlay is a real differentiator but it is a *conversion* asset for the promo text and screenshots, not a search term. There is also no App Store "CarPlay apps" browse collection to be eligible for — that was checked, it does not exist. |
| `rider` | 6 | **Cut, low confidence.** `Ride` is already indexed via the subtitle and rider-intent queries (`motorcycle tracker`, `motorcycle mileage`) are owned by GPS apps with 1,000–16,000 ratings. Cheap, but it buys nothing measurable. |

**Correctly kept:** `fuel`, `reminder`, `cost`, `mileage`, `repair`, `oil`, `tire`,
`chain`, `bike`, `receipt`. Note `receipt` was part of the winning 3.18.0 field, so keep
it — cutting it removes a variable from a configuration that demonstrably worked, and
`receipt` costs only 8 chars.

**High-demand terms indexed NOWHERE in en-US today** — this is the real gap list:

| Missing term | Chars | Why it matters |
|---|---|---|
| **`tracker`** | 8 | The single most common noun in this category's names and subtitles (Fuelly: MPG & Service **Tracker**, Simply Auto: Mileage **Tracker**, Vehicle Maintenance **Tracker**, Braap: Dirt Bike Maintenance **Tracker**, MotorManage Motorcycle **Tracker**, LookOver: Maintenance **Tracker**). It was the #1 gap in the July research and **it still is not indexed** — not in the name, not in the subtitle, not in the 3.19.1 field. Its value is in compounds (`expense tracker`, `maintenance tracker`, `mileage tracker`), not in the standalone `motorcycle tracker` query, which is a GPS query we cannot win. |
| **`service`** | 8 | Currently only in the subtitle. If the subtitle is rebuilt (recommended), `service` must move to the field or we lose the GB #4 rank for `motorbike service`. |
| **`log`** | 4 | Indexed nowhere. Feeds `service log`, `fuel log`, `ride log`, `maintenance log`. Cheapest useful token available at 4 chars. |
| **`moto`** | 5 | Indexed nowhere. `moto maintenance` is a live query family whose entire top 4 is zero-rating apps (Cylabike 0, RideKeep 0, Revvo 0, Moto-Maintenance Log 0). Genuinely uncontested. |
| **`odometer`** | 9 | Indexed nowhere. Low competition, exact feature match. Flagged in July, never shipped. |

**Considered and rejected:** OEM brand tokens (`harley`, `yamaha`, `bmw`, `ktm`). The
opportunity is real — `harley maintenance` returns no credible player (best result is
Bikeminder at 3 US ratings) and MotoVault genuinely has 12,000+ models with OEM intervals.
But third-party trademarks in the keyword field are a live App Review 5.2.1 rejection risk,
and 3.19.1 is in review right now. Not worth the exposure. Revisit as a post-approval test
if ever.

---

## Finding 3 — the subtitle is spending premium real estate on the two lowest-demand features

Live en-US subtitle: `Expense, Service, Trip & Ride` (29/30).

PostHog-validated feature demand is **expenses > maintenance > rides > trips > AI**. The
subtitle — the second-highest-weighted indexed field, and the one that empirically gets us
to rank 3–4 — spends 11 of its 29 characters on `Trip` and `Ride`, ranked #4 and #3 in
demand, in queries dominated by REVER (16,125 ratings), Scenic (7,387) and Detecht (3,795).
Those slots cannot be won and are not what our users came for.

Meanwhile `Maintenance` (demand #2) and `Tracker` (the category's own suffix) are in the
field and nowhere respectively.

**This is the highest-leverage single edit available and it is one string.**

Two translation defects found in the same pass, worth fixing in the same edit:

- **es-MX subtitle** is `Gasto, Servicio, Viaje & Ride` — the English word **"Ride"** is
  live in the Spanish listing.
- **pt-BR subtitle** is `Custo, Serviço, Viagem & Ride` — same untranslated **"Ride"**.

---

## Recommended metadata — copy-paste, all limits verified

Verified programmatically: every name ≤30, every subtitle ≤30, every keyword field ≤100,
**zero tokens duplicated between name, subtitle and field** (Apple indexes all three
together; a repeat is wasted bytes), no internal duplicates, singular forms only, no
spaces after commas.

### en-US
```
Name     (28/30)  MotoVault: Motorcycle Garage          [UNCHANGED]
Subtitle (29/30)  Expense & Maintenance Tracker         [CHANGE — the priority edit]
Keywords (87/100) service,log,fuel,reminder,cost,mileage,repair,oil,tire,chain,bike,moto,odometer,receipt
```
Field diff vs 3.19.1 — removed `maintenance` (promoted to subtitle), `budget`, `carplay`,
`rider`; added `service` (demoted from subtitle), `log`, `moto`, `odometer`. 13 chars free
as a reserve slot for a single-variable swap test.

### en-GB
```
Name     (27/30)  MotoVault: Motorbike Garage           [UNCHANGED]
Subtitle (29/30)  Expense & Maintenance Tracker         [CHANGE]
Keywords (89/100) service,log,fuel,petrol,reminder,cost,mileage,repair,oil,tyre,chain,bike,moto,mot,receipt
```
`mot` added — the UK roadworthiness test is a first-class ownership concern and is already
in the en-GB description. `fuel` added alongside `petrol` (both are used in the UK; only
`petrol` was indexed). 11 chars free.

### de-DE
```
Name     (26/30)  MotoVault: Motorrad-Garage            [UNCHANGED]
Subtitle (26/30)  Wartung, Kosten & Tankbuch            [CHANGE — was "Kosten, Wartung, Fahrt & Tour"]
Keywords (85/100) Werkstatt,Kilometer,Reparatur,Öl,Reifen,Kette,Biker,Sprit,Inspektion,Beleg,Scheckheft
```
`Wartung` and `Tankbuch` promoted out of the field into the subtitle; `Fahrt`/`Tour`
dropped (nav-app territory: calimoto 17,522 ratings, Kurviger 9,013). `Inspektion` and
**`Scheckheft`** added — "Scheckheftgepflegt" is *the* German resale-value term for a
complete service book and no competitor in the DE result set targets it. 15 chars free.

### fr-FR
```
Name     (22/30)  MotoVault: Garage Moto                [UNCHANGED]
Subtitle (25/30)  Entretien, Coûts & Carnet             [CHANGE — was "Frais, Entretien & Trajets"]
Keywords (87/100) révision,carburant,motard,atelier,réparation,huile,pneu,chaîne,vidange,reçu,kilométrage
```
`Entretien` promoted to subtitle — it is the exact term the two credible FR players put in
their *names* (Mon Carnet d'Entretien, EMX: Entretien Moto & Quad). `Carnet` added: "carnet
d'entretien" is the French service-book idiom. 13 chars free. Note the name has 8 chars
spare, the most of any locale — see the escalation option below.

### it
```
Name     (26/30)  MotoVault: Garage per moto            [UNCHANGED]
Subtitle (29/30)  Manutenzione, Spese e Consumi         [CHANGE — was "Spese, tagliandi e viaggi"]
Keywords (86/100) tagliando,carburante,costo,riparazione,olio,gomma,catena,officina,libretto,ricevuta,km
```
`Manutenzione` promoted. `libretto` added (libretto di manutenzione — the Italian service
book). Italy is the one market with a large incumbent, so see the competitor file: My
Garage has 1,428 IT ratings **and has not shipped since 2020-01-26**. 14 chars free.

### es-MX
```
Name     (26/30)  MotoVault: Garaje de Motos            [UNCHANGED]
Subtitle (29/30)  Mantenimiento, Gastos, Taller         [CHANGE — was "Gasto, Servicio, Viaje & Ride"]
Keywords (84/100) servicio,gasolina,refaccion,llanta,costo,reparacion,aceite,cadena,recibo,kilometraje
```
`Mantenimiento` and `taller` promoted; the untranslated English **"Ride"** removed. 16
chars free — the most headroom of any locale.

### pt-BR
```
Name     (27/30)  MotoVault: Garagem de Motos           [UNCHANGED]
Subtitle (28/30)  Manutenção, Gastos e Consumo          [CHANGE — was "Custo, Serviço, Viagem & Ride"]
Keywords (85/100) revisão,combustível,oficina,custo,reparo,óleo,pneu,corrente,peça,recibo,quilometragem
```
`Manutenção` promoted, untranslated **"Ride"** removed, `revisão` added (the Brazilian word
for a scheduled service — currently indexed nowhere despite appearing throughout the pt-BR
description). **BR is now our #2 territory at ~9.8 impressions/day, roughly 10× its
baseline rate**, so this is the highest-value locale edit after en-US. 15 chars free.

---

## Escalation option: put the head term in the *name*

The ladder in Finding 1 says the name is worth roughly 3× the subtitle. The apps beating us
in all five localized storefronts do it with a name match. The names have room:
fr-FR has 8 spare characters, en-US 2, de-DE 4.

Candidates, if the subtitle test lands and you want the rest of the effect:

| Locale | Current name | Candidate | Trade |
|---|---|---|---|
| fr-FR | `MotoVault: Garage Moto` (22) | `MotoVault: Entretien Moto` (25) | gives up `garage` |
| de-DE | `MotoVault: Motorrad-Garage` (26) | `MotoVault: Motorrad Wartung` (27) | gives up `garage` |
| en-US | `MotoVault: Motorcycle Garage` (28) | `MotoVault: Motorcycle Log` (25) | gives up `garage`, gains `log` in the strongest slot |

**Do not do this yet, and do not do it in the same release as the subtitle change.** Two
reasons. (1) `motorcycle garage` is the one query where we hold rank 1, and we cannot
measure what that position is worth without Apple Search Ads popularity data we do not
have. (2) Changing name and subtitle together makes the result uninterpretable. Sequence:
subtitle in 3.20.0, measure 3 weeks, then decide on the name.

---

## Which terms we rank for today vs which are aspirational

**Ranking now (verified live, 2026-08-24):** `motorcycle garage` (US #1), `motorcycle
expense` (US #3), `motorbike service` (GB #4), `motorcycle cost` (US #14),
`motorcycle carplay` (US #19), `mantenimiento moto` (MX #14).

That is the whole list. Six queries, three of them at the bottom of the result set.

**Aspirational — the terms the recommendations above are buying:** `motorcycle
maintenance`, `motorbike maintenance`, `moto maintenance`, `motorcycle maintenance
tracker`, `motorcycle expense tracker`, `motorcycle service log`, `motorcycle logbook`,
`motorcycle odometer`, `motorrad wartung`, `entretien moto`, `manutenzione moto`,
`manutenção moto`, `revisão moto`, `scheckheft motorrad`.

**Deliberately conceded** — do not spend a character on these: `motorcycle tracker`,
`motorcycle app`, `motorcycle mileage`, `motorcycle gps`, anything `trip`/`route`/`nav`
(REVER/Scenic/Detecht/calimoto, 973–16,125 ratings); `receipt scanner`, `expense tracker`
standalone (Finance apps at 3,851–36,989 ratings); `car maintenance`, `mileage tracker`
(CARFAX 126,369, Everlance 51,598, Driversnote 38,425); `scooter maintenance` (returns
scooter-*sharing* apps — Lime 2.28M ratings — and is worthless); `oil change reminder`,
`service reminder` (car-first apps, and the query intent is a car).

**One genuinely open adjacent niche found:** dirt bike / off-road. `dirt bike maintenance`
returns LookOver (17), MotoMind (15), Braap (4), Dirt Bike Dialed (5), DirtTime (2) — the
strongest player in the query has 17 ratings, and `Braap` last shipped in **2016**. Not
recommended for the primary metadata (it would dilute the road-bike signal), but it is the
best candidate for a **Custom Product Page** with its own keyword-free targeted screenshots
if that channel is ever used.

---

## Locale hygiene — 8 unmanaged localizations found on the live listing

The brief describes "7 fully-localized listings". True at the *version* level: 7 locales
have a description and keyword field. But the **app-info** level carries **15** localized
name/subtitle pairs. The extra eight have a localized subtitle that Apple indexes, and no
keyword field of their own:

| Locale | Live subtitle | Problem |
|---|---|---|
| `fi` | `Service, Trips & AI Mechanic` | **English text in a Finnish listing, and it leads on AI** — the least-used feature, which positioning explicitly says must not be the hero. This is the worst string in the account. |
| `es-ES` | `Rutas, Mantenimiento y Gastos` | Routes-first ordering, contradicts demand order. Spain is a target market with no version localization. |
| `pl` | `Trasy, Serwis i Wydatki` | Routes-first. |
| `ja` | `ライド・メンテナンス・経費管理` | Routes-first; Japan is not a target market. |
| `tr`, `th`, `id`, `hi` | — | Non-target markets. `hi` has had zero users ever. These four correlate with the 330 junk-geography impressions in the tail (IN 93, TR 80, TH 45, PH 69). |

Fix `fi` and `es-ES` (target markets, indexed, wrong). Decide deliberately on `hi`/`th`/
`id`/`tr` — they cost nothing but they dilute the imp→PV ratio with traffic that will never
convert.

---

## The browse channel: what actually drives it, and whether to change category

Browse converts impressions to page views at ~42% against search's ~4.8%, on 4% of
impressions. In absolute terms it is already **2.12 of our 10.3 daily page views (21%)**
from 4% of reach. Tripling it would add roughly 4 page views/day — about a third of total
PV. Not the "next multiple", but not noise either.

**On changing the primary category: no.** Browse impressions come from Top Charts, category
pages and the Today tab. Category charts are driven by download velocity, and we are at
**1.24 first-time installs/day**. That is not near the Top 200 of Utilities, Lifestyle,
Travel, Productivity or any other category Apple offers — and there is no automotive or
motorcycle category to move into (the full category list was pulled: 57 entries, no
vehicle category exists). A category change would forfeit five months of accumulated
category-relevance signal for a chart position we cannot reach either way. Revisit only if
daily installs reach two digits.

**Three browse levers ARE available and all three are unused. This is the genuinely
untapped finding:**

1. **Featuring nominations: `asc nominations list` returns 0 in DRAFT, 0 SUBMITTED,
   0 ARCHIVED — the editorial channel has never been used once.** Apple's nomination form
   in App Store Connect is the sanctioned route to Today-tab and collection placement.
   MotoVault has an unusually strong hook: a **CarPlay Driving Task entitlement** granted
   under case 20710293. That entitlement is rare, Apple's editorial team actively
   showcases new CarPlay integrations, and 3.19.1 is the release that ships it. Apple asks
   for **3 weeks minimum lead time**, and 3.19.1 is in review now — this is the narrow
   window and it is closing.
2. **In-app events: one exists and it is stuck in DRAFT** (`asc app-events list` → id
   6772116373, "Initial in app event", `eventState: DRAFT`, never published). In-app
   events surface on the Today tab, on category pages and inside search results, and
   unlike charts they do not require download velocity. A published event costs one
   metadata submission.
3. **Apple app tags: `asc app-tags list` returns an empty set** — zero Apple-generated
   discoverability tags are attached to the app. These are Apple-assigned rather than
   developer-set, so this is a diagnostic rather than a lever, but it says Apple's
   classifier currently has nothing glanceable to show next to us in results. A metadata
   surface that states the category term plainly is the only input we control.

---

## Sequencing

| # | Move | Release | Effort | Expected |
|---|---|---|---|---|
| 1 | Rewrite all 7 subtitles: head term in, `Trip`/`Ride` out, untranslated "Ride" fixed | 3.20.0 | 7 strings | The multiple. Moves the category head term from the weakest indexed field to the second-strongest in every locale. |
| 2 | Rewrite all 7 keyword fields per the copy-paste block | same as #1 | 7 strings | Recovers ~30 chars/locale of redundancy; adds `tracker` coverage via subtitle plus `log`/`moto`/`odometer`. |
| 3 | Submit a featuring nomination for the CarPlay release | before 3.19.1 clears review | 1 form | Only browse lever that does not require chart rank. |
| 4 | Publish the DRAFT in-app event | 3.19.1 or 3.20.0 | 1 metadata edit | Browse + search surface, no velocity requirement. |
| 5 | Fix `fi` and `es-ES` subtitles; decide on `hi`/`th`/`id`/`tr` | 3.20.0 | 2 strings + a decision | Hygiene; removes the AI-first English string. |
| 6 | Consider the name change (fr-FR / de-DE first) | 3.21.0 at the earliest | 1 string | Only after #1 is measured. Never in the same release as #1. |

**How to know if #1 worked.** It is a single-variable change with a binary read: re-run
`motorcycle maintenance`, `motorrad wartung`, `entretien moto`, `manutenzione moto`,
`manutencao moto` on the iTunes Search API three weeks after release. Today we are absent
from all five. If the subtitle carries the weight the ladder predicts, we appear in the
top 5 of most of them. Impressions are the business metric; rank appearance is the fast
leading indicator, available in a single command.
