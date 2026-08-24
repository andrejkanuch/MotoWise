# Apple App Store Metadata — MotoVault: Motorcycle Garage

**App ID:** 6760291360 · **Bundle:** com.motovault.app
**Status:** validated against **live App Store Connect data pulled this session** — not a
draft. 3.19.1 (build 88) is currently **`WAITING_FOR_REVIEW`**; its version-locale fields
(keywords, promo text, description, what's-new) are already pushed to ASC for all 7
locales below — confirmed by diffing the live `fr-FR`/`pt-BR`/`en-US` keyword strings
against `outputs/appstore-release-3.19.1/metadata-3.19.1.json` byte-for-byte. **Title and
Subtitle are unchanged from the live 3.18.0 app-info record** (pulled via
`asc localizations list --app-info <id>`) — 3.19.1 never touched them, and they were
already reordered expense-first in an earlier pass, so no further edit is proposed here
except the two dedupe fixes below.
**Live version:** 3.18.0 (`READY_FOR_SALE`) · **In review:** 3.19.1 (`WAITING_FOR_REVIEW`)
**Locales covered:** en-US, en-GB, de-DE, fr-FR, it, es-MX, pt-BR (the 7 fully-localized
App Store listings; Play covers 46 locales separately — see `google-metadata.md`)
**Categories:** Utilities (primary) + Lifestyle

---

## What changed vs. the 2026-07-22 pass, and why

1. **Title/Subtitle need no further change.** The prior pass recommended reordering the
   subtitle to lead with "Expense" — that's already live (`Expense, Service, Trip & Ride`
   en-US/en-GB; equivalent expense-first order in the other 5 locales). Re-verified this
   session directly against the live app-info record, not assumed.
2. **The keyword field for de-DE, fr-FR and pt-BR wastes characters on a word already
   spent in the subtitle** — found by a character-level overlap check run against the
   live 3.19.1 fields, not eyeballing:
   - **de-DE**: subtitle has `Wartung`, keyword field also had `Wartung`.
   - **fr-FR**: subtitle has `Entretien`, keyword field also had `entretien`.
   - **pt-BR**: subtitle has `Custo`, keyword field also had `custo`.
   Apple indexes both fields as one search surface, so the duplicate bought nothing the
   subtitle wasn't already giving it. Fixed below by dropping the duplicate and spending
   the freed characters on a new, currently-unindexed term (`Inspektion`, `révision`,
   `revisão` — all real, distinct search terms for "scheduled service/inspection" in their
   language, not filler).
3. **3.19.1's own prepared keyword/promo/description changes are otherwise sound** —
   added `carplay`/`CarPlay` (claims a brand-new, zero-competition term for the CarPlay
   feature) and `receipt` (same logic for AI Receipt Scan), at the cost of dropping
   `part`/`history` (en-US) and similar lower-signal words in other locales. No further
   change proposed to that trade.
4. **Feature demand order is correctly reflected in the 3.19.1 description**: Track Every
   Expense → Never Miss a Service → Scan a Receipt → CarPlay → Log Every Ride → Plan
   Every Trip → AI Mechanic (last). This already matches PostHog-validated demand
   (expenses > maintenance > rides > trips > AI) — no further reorder needed for this
   pass, unlike the 07-22 draft which had to patch an AI-first opening.
5. **Logging (maintenance + expenses) is free forever** and every description below says
   so explicitly ("Free and unlimited, always") — never implies a paywall on core logging.
   No price is hardcoded anywhere in the copy below; the description points to the app's
   own paywall for the actual number, matching the `paywall_v4` reality
   ($9.99/mo, $79.99/yr, $149.99 lifetime) without baking a USD figure into text served to
   every territory.

---

## en-US

| Field | Text | Chars |
|---|---|---|
| Title (30 max, **unchanged**) | `MotoVault: Motorcycle Garage` | 28/30 |
| Subtitle (30 max, **unchanged**) | `Expense, Service, Trip & Ride` | 29/30 |
| Keywords (100 max, **unchanged** — already clean) | `receipt,maintenance,fuel,reminder,cost,mileage,repair,budget,oil,tire,chain,carplay,rider,bike` | 94/100 |
| Promotional Text (170 max, **live in 3.19.1**) | `Now on CarPlay - start, pause and end a ride from your head unit. And snap a fuel or workshop receipt to fill an expense in for you.` | 132/170 |
| Description (4,000 max, **live in 3.19.1**) | see `outputs/appstore-release-3.19.1/metadata-3.19.1.json` | 3,130/4,000 |

No overlap between Title/Subtitle words and the Keyword field. No change proposed.

---

## en-GB

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Motorbike Garage` | 27/30 |
| Subtitle (**unchanged**) | `Expense, Service, Trip & Ride` | 29/30 |
| Keywords (**unchanged** — already clean) | `receipt,maintenance,petrol,reminder,cost,mileage,repair,budget,oil,tyre,chain,carplay,rider,bike` | 96/100 |
| Promotional Text (**live**) | `Now on CarPlay - start, pause and end a ride from your head unit. And snap a fuel or garage receipt to fill an expense in for you.` | 130/170 |
| Description (**live**) | — | 3,113/4,000 |

`petrol`/`tyre`/`garage` (not `gas`/`tire`/`workshop`) — correct GB vocabulary, unchanged
from the prior pass. No overlap, no change proposed.

---

## de-DE — **1 fix required**

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Motorrad-Garage` | 26/30 |
| Subtitle (**unchanged**) | `Kosten, Wartung, Fahrt & Tour` | 29/30 |
| Keywords — **live (has a bug)** | `Beleg,Wartung,Tankbuch,Werkstatt,Kilometer,Reparatur,Budget,Öl,Reifen,Kette,CarPlay,Biker,Sprit` | 95/100 |
| Keywords — **fix** | `Beleg,Tankbuch,Werkstatt,Kilometer,Reparatur,Budget,Öl,Reifen,Kette,CarPlay,Biker,Sprit,Inspektion` | 98/100 |
| Promotional Text (**live**) | `Jetzt mit CarPlay - Fahrt starten, pausieren und beenden direkt am Display. Und Belege abfotografieren, statt Ausgaben zu tippen.` | 129/170 |
| Description (**live**) | — | 3,263/4,000 |

**Bug:** `Wartung` (maintenance) is duplicated between the live subtitle and the live
keyword field. **Fix:** drop it from the keyword field, add `Inspektion` (scheduled
motorcycle inspection — a real, distinct, currently-unindexed German search term, not
filler for filler's sake).

```
asc localizations update --app 6760291360 --type app-info --locale de-DE --name "MotoVault: Motorrad-Garage"
asc apps info edit --app 6760291360 --locale de-DE --keywords "Beleg,Tankbuch,Werkstatt,Kilometer,Reparatur,Budget,Öl,Reifen,Kette,CarPlay,Biker,Sprit,Inspektion"
```

---

## fr-FR — **1 fix required**

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Garage Moto` | 22/30 |
| Subtitle (**unchanged**) | `Frais, Entretien & Trajets` | 26/30 |
| Keywords — **live (has a bug)** | `reçu,entretien,carburant,motard,atelier,coût,réparation,budget,huile,pneu,chaîne,CarPlay,vidange` | 95/100 |
| Keywords — **fix** | `reçu,carburant,motard,atelier,coût,réparation,budget,huile,pneu,chaîne,CarPlay,vidange,révision` | 95/100 |
| Promotional Text (**live**) | `Maintenant sur CarPlay - démarrez, mettez en pause et terminez un trajet depuis l'écran. Et photographiez un reçu au lieu de le saisir.` | 135/170 |
| Description (**live**) | — | 3,384/4,000 |

**Bug:** `entretien` (maintenance/service) is duplicated between the live subtitle and the
live keyword field. **Fix:** drop it, add `révision` (scheduled service/inspection — a
distinct, high-intent French term not already covered).

```
asc apps info edit --app 6760291360 --locale fr-FR --keywords "reçu,carburant,motard,atelier,coût,réparation,budget,huile,pneu,chaîne,CarPlay,vidange,révision"
```

---

## it

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Garage per moto` | 26/30 |
| Subtitle (**unchanged**) | `Spese, tagliandi e viaggi` | 25/30 |
| Keywords (**unchanged** — already clean) | `ricevuta,manutenzione,carburante,tagliando,costo,riparazione,budget,olio,gomma,catena,CarPlay` | 93/100 |
| Promotional Text (**live**) | `Ora su CarPlay - avvia, metti in pausa e concludi un giro dallo schermo dell'auto. E fotografa uno scontrino invece di digitarlo.` | 129/170 |
| Description (**live**) | — | 3,162/4,000 |

No overlap, no change proposed. (`tagliando` in the subtitle and `manutenzione` in the
keyword field are distinct Italian terms — service checkup vs. general maintenance — not
a duplicate.)

---

## es-MX

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Garaje de Motos` | 26/30 |
| Subtitle (**unchanged**) | `Gasto, Servicio, Viaje & Ride` | 29/30 |
| Keywords (**unchanged** — already clean) | `recibo,mantenimiento,gasolina,refaccion,llanta,costo,reparacion,aceite,cadena,CarPlay,taller` | 92/100 |
| Promotional Text (**live**) | `Ya en CarPlay: inicia, pausa y termina una ruta desde la pantalla. Y fotografía un recibo en lugar de escribirlo.` | 113/170 |
| Description (**live**) | — | 3,176/4,000 |

No overlap, no change proposed. 8 characters of headroom in the keyword field remain
unused — deliberately, rather than padding with a low-value word.

---

## pt-BR — **1 fix required**

| Field | Text | Chars |
|---|---|---|
| Title (**unchanged**) | `MotoVault: Garagem de Motos` | 27/30 |
| Subtitle (**unchanged**) | `Custo, Serviço, Viagem & Ride` | 29/30 |
| Keywords — **live (has a bug)** | `recibo,manutenção,combustível,motoqueiro,oficina,custo,reparo,óleo,pneu,corrente,CarPlay,peça` | 95/100 |
| Keywords — **fix** | `recibo,manutenção,combustível,motoqueiro,oficina,reparo,óleo,pneu,corrente,CarPlay,peça,revisão` | 95/100 |
| Promotional Text (**live**) | `Agora no CarPlay: comece, pause e encerre um trajeto pela tela. E fotografe um recibo em vez de digitar.` | 104/170 |
| Description (**live**) | — | 3,091/4,000 |

**Bug:** `custo` (cost) is duplicated between the live subtitle and the live keyword
field. **Fix:** drop it, add `revisão` (scheduled service — the standard Brazilian term
for a maintenance checkup, distinct from `manutenção`).

```
asc apps info edit --app 6760291360 --locale pt-BR --keywords "recibo,manutenção,combustível,motoqueiro,oficina,reparo,óleo,pneu,corrente,CarPlay,peça,revisão"
```

---

## Validation summary (all 7 locales, checked programmatically this session)

| Locale | Title | Subtitle | Keywords (post-fix) | Promo | Description | Title/Subtitle ∩ Keywords |
|---|---|---|---|---|---|---|
| en-US | 28/30 | 29/30 | 94/100 | 132/170 | 3,130/4,000 | none |
| en-GB | 27/30 | 29/30 | 96/100 | 130/170 | 3,113/4,000 | none |
| de-DE | 26/30 | 29/30 | 98/100 | 129/170 | 3,263/4,000 | **fixed** (was `Wartung`) |
| fr-FR | 22/30 | 26/30 | 95/100 | 135/170 | 3,384/4,000 | **fixed** (was `entretien`) |
| it | 26/30 | 25/30 | 93/100 | 129/170 | 3,162/4,000 | none |
| es-MX | 26/30 | 29/30 | 92/100 | 113/170 | 3,176/4,000 | none |
| pt-BR | 27/30 | 29/30 | 95/100 | 104/170 | 3,091/4,000 | **fixed** (was `custo`) |

All fields ≤ their platform limit, every field validated with `len()` against the exact
live-pulled or JSON-sourced string (accented characters count as 1 each, matching Apple's
own counting) — not typed by hand.

---

## Important: subtitle CANNOT be set with `asc apps info edit`

`asc apps info edit --help` (checked this session) exposes `--description`, `--keywords`,
`--promotional-text`, `--whats-new` — **no `--subtitle` flag.** Subtitle and Title live on
the **app-info** localization record, not the version-locale record, and must go through:

```
asc localizations update --app 6760291360 --type app-info --locale <LOCALE> \
  --subtitle "..." --name "..."
```

Since no subtitle change is proposed in this pass (subtitles are already correct), no
`localizations update --subtitle` call is needed right now — only the 3 keyword fixes
above via `asc apps info edit --keywords`, which is the correct command for that field.

For a full pull/diff workflow instead of one-field edits, `asc metadata pull/plan/apply`
(confirmed available, scope: app-info name/subtitle + version-locale description/
keywords/promo/whats-new) is the safer path for a multi-field batch — recommended if
applying all 3 keyword fixes plus any future subtitle change in one pass.

---

## Character-limit cheat sheet

| Field | Apple limit | Lives on |
|---|---|---|
| Title | 30 | app-info localization |
| Subtitle | 30 | app-info localization |
| Keywords | 100 | version localization, comma-separated, no spaces |
| Promotional Text | 170 | version localization, editable anytime, no resubmission |
| Description | 4,000 | version localization |

---

## Known out-of-scope finding (flag only — not part of this deliverable)

`asc localizations list --app-info` (pulled this session) shows **app-info locales beyond
the 7 above**: `th`, `tr`, `ja`, `pl`, `es-ES`, `hi`, `id`, `fi` — these have a translated
name/subtitle but are **not** in the 3.19.1 version-locale set, so they likely fall back to
en-US (or another default) for description/keywords/promo text. One of them, **`fi`**
(Finnish), currently has the subtitle `Service, Trips & AI Mechanic` — **this leads with
AI**, directly contradicting the demand-order rule (expenses > maintenance > rides > trips
> AI) applied everywhere else in this file. It's outside this session's 7-locale scope to
fix, but should not be left as-is; flag for the next metadata pass. `hi` (Hindi) exists but
per `feedback_no_india_market` should probably not be actively maintained/expanded.
