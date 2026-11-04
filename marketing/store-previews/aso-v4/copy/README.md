# ASO v4 store copy

Draft store metadata and screenshot captions for MotoVault (iOS 6760291360, Android com.motovault.app), written 2026-11-03.
None of this has been pushed to App Store Connect or Google Play.

There are two kinds of file:

- `apple-<locale>.json`, `play-<locale>.json`, `play-custom-<CC>.json`: the full store metadata, with character counts and the reasoning behind each choice.
- `<store-locale>.json` (18 files): screenshot copy in the pipeline format (`pipeline/SCHEMA.md` section 3), read by `compose/compose.py`. These files hold `slots.<slot>.{headline, sub}`, plus `order`, `feature_graphic`, `header` and `search`. The captions match the store metadata files.
  - **Which file each listing reads:** `es-MX.json` is the App Store es-MX listing. `es-MX-play.json` is the Play Mexico custom listing: same captions, its own order. `es-CO.json`, `es-AR.json` and `en-PH.json` cover the Play custom listings for Colombia, Argentina and the Philippines. On the App Store, Colombia and Argentina use `es-MX.json` and the Philippines uses `en-GB.json`. `it.json` (App Store) and `it-IT.json` (Play) are identical.

Captions cover 10 slots: `ride_tracking`, `ride_stats`, `expenses`, `receipt_scan`, `maintenance_reminders`, `service_history`, `garage`, `trip_planning`, `season_summary`, `costs_overview`.
- **Headline:** two lines of at most 18 characters, because the composer sets them in Barlow Condensed upper case. Line 2 renders in copper.
- **Subline:** at most 70 characters, with no placeholders, because the composer does not fill them.
- **Store order** comes from the market data (`markets/README.md`, `_global.json`). `order` is the App Store order (10 slots) and `order_play` is the Play order (first 8). The store metadata files carry the same list as `screenshot_order`.
  - **Global, every locale except Mexico:** ride_tracking, maintenance_reminders, expenses, receipt_scan, trip_planning, garage, ride_stats, service_history, costs_overview, season_summary. Play stops after service_history.
  - **Play Mexico listing only (`es-MX-play.json`):** ride_tracking, expenses, receipt_scan, maintenance_reminders, trip_planning, garage, then the same tail.
  - The App Store `es-MX.json` uses the global order, because Apple also serves it in Colombia and Argentina. Colombia has the strongest ride share, and the Mexico signal rests on only 60 users (team-lead decision, 2026-11-03). The Play Colombia and Argentina listings use the global order as well.
  - AI diagnosis is not a slot. It ranks 4th in usage but stays out by the positioning rule.

**Checks run:** every field is within its limit. Apple keywords have no spaces, no duplicates and no words from the name or subtitle. No "Android" or "Google" in Apple copy, and no "App Store" or "CarPlay" in Play copy. Every Play listing, the 4 custom listings included, was overlaid on a copy of `store/play/metadata` and passed `store/play/check-metadata.py`: 0 problems, canonical free-tier sentence present verbatim, subscription disclosure present, no hardcoded prices.

## Matrix

### App Store

| File | Name | Subtitle | Keywords (bytes) | Promo | Description | Header asset | Search asset |
|---|---|---|---|---|---|---|---|
| `apple-de-DE.json` | MotoVault: Motorrad Wartung (27) | Tracker, Touren & Kosten (24) | 99/100 | 131/170 | 3498/4000 | Dein Motorrad im Griff. | Touren, Kosten und Wartung. |
| `apple-en-AU.json` | MotoVault: Motorcycle Logbook (29) | Rides, Expenses & Maintenance (29) | 98/100 | 122/170 | 3306/4000 | Your motorcycle, fully tracked. | Track every ride. Keep every road. |
| `apple-en-CA.json` | MotoVault: Motorcycle Tracker (29) | Rides, Expenses & Maintenance (29) | 99/100 | 128/170 | 3289/4000 | Your motorcycle, fully tracked. | Track every ride. Keep every road. |
| `apple-en-GB.json` | MotoVault: Motorbike Tracker (28) | Ride Log, Costs & Servicing (27) | 98/100 | 126/170 | 3285/4000 | Your motorcycle, fully tracked. | Track every ride. Keep every road. |
| `apple-en-US.json` | MotoVault: Motorcycle Tracker (29) | Rides, Expenses & Maintenance (29) | 100/100 | 128/170 | 3277/4000 | Your motorcycle, fully tracked. | Track every ride. Keep every road. |
| `apple-es-ES.json` | MotoVault: Mantenimiento Moto (29) | Rutas, gastos y revisiones (26) | 97/100 | 135/170 | 3418/4000 | Tu moto, bajo control. | Rutas, gastos y revisiones. |
| `apple-es-MX.json` | MotoVault: Mantenimiento Moto (29) | Rodadas GPS, gastos y servicio (30) | 98/100 | 137/170 | 3499/4000 | Tu moto, bajo control. | Rodadas, gastos y servicio. |
| `apple-fr-FR.json` | MotoVault: Entretien Moto (25) | Balades GPS, frais et carnet (28) | 100/100 | 138/170 | 3598/4000 | Votre moto, sous contrôle. | Balades, frais et entretien. |
| `apple-it.json` | MotoVault: Manutenzione Moto (28) | Giri GPS, spese e tagliandi (27) | 99/100 | 136/170 | 3398/4000 | La tua moto, sotto controllo. | Giri, spese e tagliandi. |
| `apple-pt-BR.json` | MotoVault: Manutenção de Moto (29) | Rotas GPS, gastos e revisão (27) | 100/100 | 118/170 | 3319/4000 | Sua moto, sob controle. | Rolês, gastos e revisões. |

### Google Play

| File | Listing | Title | Short description (chars) | Full | Feature graphic |
|---|---|---|---|---|---|
| `play-custom-AR.json` | custom: AR (es-419) | MotoVault: Service de tu Moto (29) | Service de tu moto, gastos y salidas con GPS. Recordatorios de VTV. (67) | 3508/4000 | Tu moto, al día. |
| `play-custom-CO.json` | custom: CO (es-419) | MotoVault: Mantenimiento Moto (29) | Mantenimiento de tu moto, gastos y rodadas GPS. Avisos de SOAT y tecno. (71) | 3580/4000 | Tu moto, al día. |
| `play-custom-MX.json` | custom: MX (es-419) | MotoVault: Mantenimiento Moto (29) | Servicio de tu moto, gastos y rodadas GPS. Recordatorios de verificación. (73) | 3617/4000 | Tu moto, bajo control |
| `play-custom-PH.json` | custom: PH (en-US) | MotoVault: Motor PMS Tracker (28) | Ride tracker, gas and parts expenses, and change oil and PMS reminders. (71) | 3603/4000 | Rides. Costs. Service. Tracked. |
| `play-de-DE.json` | default | MotoVault: Motorrad Wartung (27) | Motorrad-Wartung, Kosten und Touren per GPS: Tankbuch und Scheckheft in einem. (78) | 3527/4000 | Dein Motorrad im Griff |
| `play-en-AU.json` | default | MotoVault: Motorcycle Logbook (29) | Motorcycle logbook: ride tracker, expenses and service reminders. (65) | 3348/4000 | Rides. Costs. Service. Tracked. |
| `play-en-CA.json` | default | MotoVault: Motorcycle Tracker (29) | Motorcycle ride tracker, expense log and service reminders in one app. (70) | 3332/4000 | Rides. Costs. Service. Tracked. |
| `play-en-GB.json` | default | MotoVault: Motorbike Tracker (28) | Motorbike ride tracker, running costs and service reminders in one app. (71) | 3343/4000 | Rides. Costs. Service. Tracked. |
| `play-en-US.json` | default | MotoVault: Motorcycle Tracker (29) | Motorcycle ride tracker, expense log and service reminders in one app. (70) | 3324/4000 | Rides. Costs. Service. Tracked. |
| `play-es-419.json` | default | MotoVault: Mantenimiento Moto (29) | Mantenimiento de moto, gastos y registro de rodadas GPS en una sola app. (72) | 3610/4000 | Tu moto, bajo control. |
| `play-es-ES.json` | default | MotoVault: Mantenimiento Moto (29) | Mantenimiento de moto, gastos, rutas GPS y avisos de revisión e ITV. (68) | 3484/4000 | Rutas, gastos y revisiones. Controlados. |
| `play-es-US.json` | default | MotoVault: Mantenimiento Moto (29) | Mantenimiento de moto, gastos y rodadas GPS. Millas o kilómetros, tú eliges. (76) | 3600/4000 | Tu moto, bajo control. |
| `play-fil.json` | default | MotoVault: Motor PMS Tracker (28) | Ride tracker, gastos sa gas at piyesa, at paalala sa PMS at change oil. (71) | 3606/4000 | Motor mo, kontrolado. |
| `play-fr-FR.json` | default | MotoVault: Entretien Moto (25) | Entretien moto, suivi des frais et balades GPS dans une seule app. (66) | 3700/4000 | Votre moto, sous contrôle |
| `play-it-IT.json` | default | MotoVault: Manutenzione Moto (28) | Manutenzione moto, spese e giri GPS in un’unica app. Promemoria tagliandi. (74) | 3490/4000 | La tua moto, sotto controllo. |
| `play-pt-BR.json` | default | MotoVault: Manutenção de Moto (29) | Manutenção da moto, controle de gastos e rolês com GPS num app só. (66) | 3403/4000 | Sua moto, sob controle |

## What the research showed

Sources: iTunes Search API rank checks (limit 200) per storefront, Apple search-hint suggestions per storefront, and Apple's App Store localizations table. Raw rank checks, 2026-11-03:

| Storefront | Query | MotoVault rank | Who wins, and how |
|---|---|---|---|
| US | motorcycle garage | 1 | almost no search volume (it is not in the hints) |
| US | motorcycle expense | 1 | low volume |
| US | motorcycle maintenance | 4 | Riderr, Bikeminder, MotoMainte |
| US | motorcycle tracker | 176 | CurveRank "Motorcycle Tracker", REVER, Detecht |
| US | motorcycle log | 129 | four apps with "Motorcycle Log" in the title and 0 to 2 ratings |
| US | motorcycle gps / ride tracker | not in top 200 | REVER, Detecht, Scenic, calimoto |
| MX | mantenimiento moto | 22 | "Mantenimiento moto: MotorApp" (0 ratings), MotoMainte |
| ES | mantenimiento moto | 29 | MotoMainte, MotorApp, FixioMoto |
| BR | manutenção moto | 56 | RideKeeper, "Garagely: Manutenção de moto" |
| FR | entretien moto | 64 | "EMX : Entretien Moto", Liberty Rider, Bikefleet |
| IT | manutenzione moto | 130 | MotoMainte, "Manutenzione moto: MotorApp", "Manutenzione Moto - Iron" |
| DE | motorrad wartung | 31 | four apps with "Motorrad Wartung" in the title, all with 0 ratings |

Takeaway: in this niche the apps with the exact phrase in the title outrank everyone else, even with zero ratings. Today's names target "garage", which no one searches for. The single biggest change is putting the phrase people search for into the name.

Apple search hints that confirm demand: `motorcycle route planner`, `motorcycle ride tracker`, `motorcycle riding app`, `motorcycle tracker`, `motorcycle trip planner`, `motorcycle lean angle`, `motorcycle gps`, `motorcycle maintenance`, `apps for motorcycle maintenance logs` (US); `motorbike route planner`, `motorbike maintenance` (GB); `moto mantenimiento`, `historial moto mantenimiento`, `moto gps tracker` (MX/CO); `moto manutenção`, `controle de manutenção` (BR); `entretien moto : carnet`, `balade moto`, `moto trip` (FR); `manutenzione moto`, `moto manutenzione, spese, note`, `giri in moto`, `percorsi moto` (IT); `motorrad wartung`, `motorrad tracker`, `motorrad touren`, `motorrad routen`, `motorrad schräglage`, `tankbuch`, `fahrtenbuch` (DE).

## Keyword strategy (Apple)

Apple indexes name + subtitle + keyword field together within one localization. Some storefronts also index a second localization (Apple's table):

| Storefront | Localizations indexed | How the copy splits them |
|---|---|---|
| US | en-US + es-MX (also pt-BR, fr-FR and others) | en-US is all English. es-MX, pt-BR and fr-FR hold only their own language, so the US storefront gets Spanish, Portuguese and French long-tail with no duplicates. Only shared word: `gps`, which sits in the es-MX/pt-BR/fr-FR subtitles for readability. |
| Mexico, Colombia, Argentina | es-MX + en-GB | es-MX mixes MX (gasolina, llanta), CO (repuesto, motero) and AR (nafta, motoquero) vocabulary because one Spanish localization serves all three. en-GB carries the English terms. |
| UK | en-GB only | Name says "Motorbike". Keywords add `motorcycle` + `maintenance` so both "motorbike maintenance" and "motorcycle maintenance" match, plus `mot`. |
| Philippines | en-GB only | No Filipino localization exists on the App Store, so en-GB carries `motor` and `pms`. |
| Australia | en-AU + en-GB | en-AU avoids en-GB words. Name is "Motorcycle Logbook" (the AU word for service records), keywords add `rego`. The one overlap, `motorcycle`/`maintenance`, is deliberate because it is the core intent. |
| Canada | en-CA + fr-CA | en-CA mirrors en-US with km and gas. fr-CA is not written yet. |
| Spain, Brazil, France, Italy, Germany | own language + en-GB | Local keywords only. English comes from en-GB. |

Rules applied to every keyword field: no spaces after commas, singular forms, no word already in the name or subtitle, accents dropped where Apple matches without them (saves bytes), no competitor brand names, and 97 to 100 of the 100 bytes used.

Changing the name needs a new app version, because the name is app-info data. Ship the name and subtitle changes in the same release as the keyword changes, so the effect can be read from a single date.

## Keyword strategy (Google Play)

On Play, the title, short description and full description are all indexed. Each title holds the exact local search phrase. The short description repeats it alongside "ride tracker / gastos / service reminders". The full description repeats the core terms 2 to 4 times each, in natural sentences, with no keyword blocks.
Custom store listings are country-targeted. MX, CO and AR are written on the es-419 language slot, PH on en-US. They let one language speak each country's vocabulary: verificación/tenencia (MX), tanqueada/SOAT/tecnomecánica (CO), voseo plus nafta/cubiertas/VTV/"service" (AR), and motor/PMS/change oil/casa/LTO (PH).

## Positioning rules followed

- Lead with rides, expenses and maintenance. AI diagnosis appears only in the legally required free-tier sentence on Play and as "more AI help" in the Apple Pro paragraph. It is never in a name, subtitle, keyword, caption or headline.
- Logging is always described as free and unlimited. It is never described as paid.
- No prices anywhere. Copy says the price is shown in the app.
- Contact address is support@motovault.app, the canonical one. The live App Store descriptions still say hello@.
- Apple copy names no other platform. CarPlay appears only in Apple copy.

## A/B alternatives (name / subtitle)

App Store product page optimization cannot test the name or subtitle. Test these as successive releases and read the change against a trailing window, not a multi-month average. On Play, test titles with store listing experiments.

| Locale | Option A (shipped in the JSON) | Option B | Option C |
|---|---|---|---|
| en-US | MotoVault: Motorcycle Tracker / Rides, Expenses & Maintenance | MotoVault: Motorcycle Log / Ride Tracker, Costs & Service | MotoVault: Motorcycle GPS Log / Maintenance & Expense Tracker |
| en-GB | MotoVault: Motorbike Tracker / Ride Log, Costs & Servicing | MotoVault: Motorcycle Tracker / Motorbike Costs & Servicing | MotoVault: Motorbike Logbook / Rides, MOT & Service Reminders |
| en-AU | MotoVault: Motorcycle Logbook / Rides, Expenses & Maintenance | MotoVault: Motorbike Tracker / Service Logbook & Rego Alerts | MotoVault: Motorcycle Tracker / Rides, Costs & Servicing |
| es-MX | MotoVault: Mantenimiento Moto / Rodadas GPS, gastos y servicio | MotoVault: Control de tu Moto / Mantenimiento, gastos y rutas | MotoVault: Bitácora de Moto / Servicio, gastos y rodadas GPS |
| es-ES | MotoVault: Mantenimiento Moto / Rutas, gastos y revisiones | MotoVault: Rutas y Gastos Moto / Mantenimiento, ITV y revisión | MotoVault: Diario de tu Moto / Mantenimiento, rutas y gastos |
| pt-BR | MotoVault: Manutenção de Moto / Rotas GPS, gastos e revisão | MotoVault: Controle da Moto / Manutenção, gastos e rolês | MotoVault: Garagem da Moto / Manutenção, custos e rotas GPS |
| fr-FR | MotoVault: Entretien Moto / Balades GPS, frais et carnet | MotoVault: Carnet Moto / Entretien, frais et balades | MotoVault: Suivi Moto / Entretien, dépenses et trajets |
| it | MotoVault: Manutenzione Moto / Giri GPS, spese e tagliandi | MotoVault: Diario Moto / Manutenzione, spese e percorsi | MotoVault: Gestione Moto / Tagliandi, spese e giri GPS |
| de-DE | MotoVault: Motorrad Wartung / Tracker, Touren & Kosten | MotoVault: Motorrad Tracker / Wartung, Touren & Tankbuch | MotoVault: Motorrad Logbuch / Wartung, Kosten & Touren |

All alternatives fit the 30-character name and subtitle limits.

## Open questions for the owner

1. **Renaming the live app.** Every name drops "Garage", and today MotoVault ranks #1 for "motorcycle garage" in the US. That phrase has no measurable volume and `garage` stays in the en-US keywords. Still, a rename is a deliberate call.
2. **Are maintenance reminders free?** `PRO_FEATURES.MAINTENANCE_REMINDERS` exists in `packages/types/src/constants/limits.ts`, but no code reads it. The live App Store copy already says reminders are free, and the Apple copy here says the same. The Play free-tier sentence does not mention reminders. If reminders will be gated, the Apple "Free and Pro" paragraph needs editing.
3. **MOT, rego, SOAT/tecnomecánica, VTV, ITV, LTO, verificación.** The copy presents these as date reminders. That holds if a rider can create a custom date-based task. If the app has no such task, soften these lines to "date reminders" with no named document.
4. **Lean angle.** The copy says "max lean". The app estimates it from the phone's sensors and says so in a tooltip. None of the copy claims precision.
5. **New iOS localizations.** en-CA, en-AU and a full es-ES (description, keywords, promo) do not exist today. es-ES currently falls back to en-US. Adding them is low effort and high value for Spain.
6. **fr-CA** is not written. Canada indexes it next to en-CA.
7. **Play custom listings** need the screenshot set rendered per country, especially the AR voseo captions and the PH "motor/PMS" captions. Today Play es-419/es-US show English screenshots.
8. **What's new** text is generic ("smoother ride tracking, faster receipt scanning"). Replace it with the real changes once the release is known.

## Rebuilding

The copy is generated from `_build/` (en.py, es.py, eu.py hold the text). Run `python3 _build/build.py` to regenerate the JSON and check limits. Then run `python3 _build/gate.py _build/stage/<default|MX|CO|AR|PH>` to put the Play output through `store/play/check-metadata.py`.
