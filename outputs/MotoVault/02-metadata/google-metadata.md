# Google Play Store Metadata — MotoVault (com.motovault.app)

**Status:** rewritten from the **live listing**, pulled this session via
`gplay edits create` + `gplay listings get/list` (edit `17982315747694595646`) — not
the stale 2026-04-11 draft this file used to contain. **Production is 3.19.0**
(version code 81), one release behind the iOS 3.19.1 build currently `WAITING_FOR_REVIEW`.
**46 locales are live** (expanded 2026-08-10, per `project_play_listing_46_locales`).
This pass fixes the 7 locales that mirror Apple's fully-localized set
(en-US, en-GB, de-DE, fr-FR, it-IT, es-ES/es-419, pt-BR) and documents a bug found in
**every one of the 8 locales checked**, which almost certainly affects most of the other 38.

---

## Two verified accuracy bugs, live right now, in every locale checked

Pulled the live full description text for en-US, en-GB, de-DE, fr-FR, it-IT, es-ES,
es-419 and pt-BR and grepped for the specific claims. **7 of 8** (all except fr-FR, which
has a different problem — see below) currently say:

1. **`"Unlimited bikes ... free forever"`** (appears twice per locale: once as a bullet
   under "Built for real riders," once again under "MotoVault Pro"). **`FREE_TIER_LIMITS.MAX_BIKES`
   is 1.** This is the exact class of bug the iOS 3.19.1 description rewrite was built to
   eliminate (its own prepared-metadata notes call out this precise claim as an App Review
   2.3.1/3.1.2 rejection risk) — Play just never received the same fix.
2. **`"5 AI diagnostic scans per month"`** (en-US, en-GB) / **`"5 diagnosi AI al mese"`**
   (it-IT) / **`"5 diagnósticos IA al mes"`** (es-ES) / **`"5 diagnósticos con IA por mes"`**
   (es-419) / **`"5 diagnósticos IA por mês"`** (pt-BR) / **`"5 KI-Diagnosen pro Monat"`**
   (de-DE). **The real free limit is 1** AI diagnostic scan per month, per the audit brief
   and matching what iOS 3.19.1 already says correctly.

Neither is an ASO copy-quality issue — both are **factually false claims about a paid
product's free tier**, live on a listing with **zero reviews and no buffer** if a rider
who hits the real 1-bike or 1-scan limit reports the mismatch.

**fr-FR is a separate, bigger problem, not just the same bug:** its live full description
uses a **structurally different template** from every other locale — it describes a
"BASE DE CONNAISSANCES" (knowledge base, "50+ expert articles" with quizzes) that doesn't
appear in any other locale's copy or in the current app feature set, claims **3** free AI
diagnostics/month (still wrong vs. the real limit of 1, but a *different* wrong number
than the other locales), never mentions expense tracking as a named feature, and has no
receipt-scan or CarPlay mention at all. This reads like a stale draft from an earlier
product scope that was never reconciled with the other locales. **Recommend a full
fr-FR rewrite as its own follow-up** — patching individual sentences won't fix a
structurally different narrative. Not attempted in this pass; flagging so it isn't
mistaken for "already handled" because the other 6 got fixed.

---

## A real, live differentiator missing from every locale: Receipt Scan

Confirmed via `git log`: Receipt Scan (`cd3bccd0`, "AI expense & maintenance capture")
merged **before** the 3.19.0 version bump (`7e94ad37`) that's currently live on Play, and
the feature code (`apps/mobile/src/features/receipt-scan/`) has no `Platform.OS` gate —
it's a normal cross-platform React Native feature. **Android users on the current live
build already have Receipt Scan, and no locale's Play listing mentions it.** This is not
a speculative "if Android gets this feature" note — it is confirmed live and unadvertised.

---

## No hardcoded prices found (the es-ES MXN trap from the 46-locale expansion is fixed)

Checked all 8 pulled locales for currency figures: none hardcode a price. Every locale's
Pro section says the equivalent of "the price is shown in the app before you confirm."
No change needed here — flagging only to confirm the earlier-documented es-ES MXN bug
(`project_play_listing_46_locales`) has not regressed.

---

## Field limits (Google Play, confirmed via `gplay listings --help` this session)

| Field | Limit | Counted in |
|---|---|---|
| Title | 30 (most locales) | Characters, not bytes |
| Short description | 80 | Characters |
| Full description | 4,000 | Characters |

---

## en-US — corrected

### Title (30 max, unchanged — no issue found)
```
MotoVault: Motorcycle Garage
```
28/30

### Short description (80 max) — reorder to lead with expense, add the missing differentiator

| | Text | Chars |
|---|---|---|
| Live | `Motorcycle maintenance tracker — service reminders, expenses & ride logging.` | 76/80 |
| **Fix** | `Motorcycle expense tracker — service reminders, receipt scan & ride log.` | **72/80** |

Same reasoning as the Apple subtitle fix already live in 3.18.0: expense is
PostHog-validated demand #1, maintenance #2 — lead with it. Also claims "receipt scan," a
real, live, currently-unadvertised feature.

### Full description (4,000 max) — 3 targeted fixes, not a rewrite

1. Opening hook now names expense tracking explicitly (it didn't before).
2. `SCAN A RECEIPT INSTEAD OF TYPING` added as its own bullet, positioned after Service
   (demand #2) and before Ride (demand #3) — mirrors the iOS 3.19.1 bullet order exactly.
3. Both false free-tier claims replaced with the real numbers.

```
MotoVault is the complete garage for riders who care about the machine as much as the ride. Track every expense, log every service, record every mile and plan every trip — all in one app built for motorcycles, not cars.

--------------------------
WHY MOTORCYCLE RIDERS LOVE MOTOVAULT
--------------------------

* TRACK EVERY EXPENSE — Every fill-up, every part, every shop visit. See exactly what your motorcycle costs you per mile, per month, per year. Free and unlimited, always.

* NEVER MISS A SERVICE — Oil changes, chain adjustments, tire swaps, valve checks. Log every service and keep a complete maintenance history that boosts your bike's resale value. Free and unlimited, always.

* SCAN A RECEIPT INSTEAD OF TYPING — Point your camera at a fuel, parts or shop receipt. MotoVault reads the amount, the date and the work done, and fills the form in for you.

* LOG EVERY RIDE — Auto-track every ride. Distance, time, route, fuel used. Build a beautiful logbook of every mile you've ever ridden.

* TRIP PLANNER — Plan your weekend ride or that big bucket-list tour. Save routes, set waypoints, and share them with your group.

* AI MECHANIC — Hear a weird noise? Smell something off? Snap a photo and our AI diagnostic walks you through the most likely causes and fixes.

--------------------------
BUILT FOR REAL RIDERS
--------------------------

- One bike free forever — Pro unlocks unlimited bikes
- 12,000+ motorcycle models supported (NHTSA-backed catalog)
- Beautiful, dark-mode-first design
- Private and secure—your data is yours
- Optimized for solo riders AND group rides
- Designed in detail for US and European riders

--------------------------
WHO IT'S FOR
--------------------------

- Daily commuters who want to keep their bike in top shape
- Weekend warriors planning the next epic ride
- Adventure riders tracking long-distance tours
- Garage tinkerers who do their own maintenance
- Anyone tired of car-first apps that treat motorcycles as an afterthought

--------------------------
MOTOVAULT PRO
--------------------------

Free forever includes one bike, unlimited expense tracking, unlimited maintenance history, unlimited ride recording, 3 receipt scans, 1 AI diagnostic scan and 1 GPX export every month. MotoVault Pro unlocks unlimited bikes, unlimited receipt scans, unlimited AI diagnostics, unlimited GPX exports and advanced rider analytics, on a monthly or annual plan. The price is shown in the app before you confirm.

Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your Google Play account settings.

Privacy Policy: https://motovault.app/privacy
Terms of Service: https://motovault.app/terms

--------------------------

Questions? Feedback? We read every email: support@motovault.app

Two wheels. One app. Ride better.
```
**2,845 / 4,000 characters.**

---

## en-GB, de-DE, it-IT, es-ES, es-419, pt-BR — same 2 sentence-level fixes, structure otherwise untouched

These 6 locales share en-US's structure closely enough that the fix is a **find-and-replace
of 2 sentences per locale**, not a rewrite — lower translation risk than regenerating full
copy. The two replacements, per locale (translate the *replacement numbers/claims* into
the locale's existing voice; do not touch anything else in the description):

| Locale | Replace (bullet, "Built for real riders") | Replace (MOTOVAULT PRO paragraph) |
|---|---|---|
| en-GB | `Unlimited bikes — track every bike you own, free forever` → `One bike free forever — Pro unlocks unlimited bikes` | `Free forever includes unlimited bikes, full maintenance tracking, expense logging, ride recording and 5 AI diagnostic scans per month.` → `Free forever includes one bike, unlimited maintenance tracking, unlimited expense logging, unlimited ride recording, 3 receipt scans and 1 AI diagnostic scan per month.` |
| de-DE | *(no separate bullet; only the Pro paragraph has the claim)* | `Kostenlos für immer: unbegrenzte Motorräder, vollständige Wartungsverfolgung, Kostenprotokoll, Tour-Aufzeichnung mit GPS, Tourenplaner (bis zu 3 gespeicherte Routen) und 5 KI-Diagnosen pro Monat.` → `Kostenlos für immer: ein Motorrad, vollständige Wartungsverfolgung, Kostenprotokoll, Tour-Aufzeichnung mit GPS, Tourenplaner (bis zu 3 gespeicherte Routen), 3 Beleg-Scans und 1 KI-Diagnose pro Monat.` |
| it-IT | *(bullet not present in this locale's copy)* | `Gratis per sempre: moto illimitate, ... e 5 diagnosi AI al mese.` → `Gratis per sempre: una moto, ... 3 scansioni di ricevute e 1 diagnosi AI al mese.` |
| es-ES | *(bullet not present)* | `Gratis para siempre: motos ilimitadas, ... y 5 diagnósticos IA al mes.` → `Gratis para siempre: una moto, ... 3 escaneos de recibos y 1 diagnóstico IA al mes.` |
| es-419 | `Motos ilimitadas: registra todas las que tengas, gratis siempre` → `Una moto gratis siempre — Pro desbloquea motos ilimitadas` | `Gratis para siempre incluye motos ilimitadas, ... y 5 diagnósticos con IA por mes.` → `Gratis para siempre incluye una moto, ... 3 escaneos de recibos y 1 diagnóstico con IA por mes.` |
| pt-BR | *(bullet not present)* | `Grátis para sempre: motos ilimitadas, ... e 5 diagnósticos IA por mês.` → `Grátis para sempre: uma moto, ... 3 leituras de recibo e 1 diagnóstico IA por mês.` |

Every "Pro unlocks ..." sentence immediately following each paragraph above should also
gain `unlimited bikes` and `unlimited receipt scans` at the front of its list, mirroring
the en-US fix, e.g. de-DE: `Pro schaltet frei: unbegrenzte Motorräder, unbegrenzte
Beleg-Scans, unbegrenzte KI-Diagnosen, ...`.

**None of these 6 currently mention Receipt Scan at all** (confirmed — grepped for
`recib`/`ricevut`/`Beleg`/`scontrino` equivalents in each pulled description; zero hits
outside the sentence being fixed above). Adding the "3 receipt scans" free-tier mention is
also the first time these locales advertise the feature — a real, live, unadvertised
differentiator, not new copy invented for this pass.

### Short descriptions — reorder to expense-first (matches the Apple subtitle fix already shipped)

| Locale | Live | Fix |
|---|---|---|
| en-GB | `Motorbike maintenance tracker — service reminders, costs & ride logging.` (74) | `Motorbike expense tracker — service reminders, receipt scan & ride log.` (73) |
| de-DE | `Motorrad-Wartung, Kosten, Fahrten, Touren. Erinnerungen, GPS, KI-Mechaniker.` (77) | `Kosten, Wartung, Fahrten & Touren fürs Motorrad. Beleg-Scan, GPS, KI.` (70) |
| it-IT | `Moto: tagliando, spese, uscite, viaggi. Promemoria, GPS, meccanico AI.` (71) | `Moto: spese, tagliandi, uscite, viaggi. Scansione ricevute, GPS, AI.` (69) |
| es-ES | `Moto: servicio, gasto, rodadas, viajes. Recordatorios, GPS, mecánico IA.` (73) | `Moto: gasto, servicio, rodadas, viajes. Escaneo de recibos, GPS, IA.` (69) |
| es-419 | `Control de mantenimiento de tu moto: recordatorios, gastos y viajes.` (69) | `Control de gastos y servicio de tu moto: recibos, GPS y viajes.` (65) |
| pt-BR | `Moto: serviço, custo, rodadas, viagens. Lembretes, GPS, mecânico IA, GPX.` (75) | `Moto: custo, serviço, rodadas, viagens. Leitura de recibo, GPS, IA.` (68) |

All within the 80-character limit with headroom to spare — verified by direct `len()`
count on the exact strings above, not eyeballed.

---

## What's New (500 char max) — leave as-is this pass

Not touched in this pass; the current live what's-new text is release-specific and should
be refreshed alongside the next Android version bump (3.19.1-equivalent), reusing the same
CarPlay-is-iOS-only-aware, receipt-scan-forward language already drafted for iOS in
`outputs/appstore-release-3.19.1/metadata-3.19.1.json` (minus the CarPlay section, which
doesn't apply to Android).

---

## How to push these (via `gplay`, confirmed commands this session)

```bash
EDIT=$(gplay edits create --package com.motovault.app | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")

gplay listings patch --package com.motovault.app --edit $EDIT --locale en-US \
  --short-description "Motorcycle expense tracker — service reminders, receipt scan & ride log." \
  --full-description "$(cat en-US-full-description.txt)"

# repeat --locale for en-GB, de-DE, fr-FR, it-IT, es-ES, es-419, pt-BR ...

gplay edits commit --package com.motovault.app --edit $EDIT
```

(`gplay listings patch` vs `update` — `patch` only touches the fields passed; `update`
requires the full object. Use `patch` here to avoid accidentally clobbering fields not
being changed in this pass, e.g. the video URL. Flags confirmed via `gplay listings patch
--help` this session: `--package --edit --locale --title --short-description
--full-description --video`.) Metadata-only text changes like these typically don't need
Play's review queue — pass `--changes-not-sent-for-review` on `gplay edits commit` to push
live faster; drop the flag if you'd rather have Google review the copy first. **No write
was performed this session** — `listings get/list` and `edits create` were run read-only;
`patch`/`commit` were verified against `--help` output but not executed against the live
listing.

---

## Out of scope this pass, flagged for follow-up

1. **fr-FR full rewrite** — structurally different template, wrong AI-scan number (3, not
   1), no receipt scan, no CarPlay-aware framing. Needs a fresh translation from the
   corrected en-US copy, not a sentence patch.
2. **The other 38 of 46 locales** were not pulled this session (rate/scope reasons) — the
   2 accuracy bugs found in 7 of 8 checked locales are highly likely to be present in most
   of the remaining locales too, since Play listings are typically translated from one
   template. Recommend a scripted `gplay listings get --locale <X>` sweep across all 46
   before the next Play release, grepping for the same "5 " / "unlimited" / "ilimitad"
   patterns used to find these.
3. **What's New** refresh, tied to the next Android version bump.
