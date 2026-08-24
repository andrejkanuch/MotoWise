# Action Checklist — MotoVault Apple App Store Metadata (iOS only)

**App ID:** 6760291360 · **CLI:** `asc` (App Store Connect CLI, keychain-authed — see memory `reference_asc_credentials.md`)
**Scope:** iOS only. No Google Play work in this pass.
**Reads from:** `apple-metadata.md` + `visual-assets-spec.md` in this same directory.

---

## Timing note (important — check this first)

App version **3.18.0 is currently "In Review"** (adds AI Receipt Scan). Title, Subtitle, and Keywords can only be edited on an app version that is **editable** (i.e., not yet "Ready for Sale"/live). If 3.18.0 has not yet been approved:

- [ ] Edit Title/Subtitle/Keywords directly on the 3.18.0 version now, before it goes live — avoids waiting for a 3.18.1 version to make these changes.

If 3.18.0 has already gone live by the time you execute this:

- [ ] You'll need an editable new version (e.g., 3.18.1) to change Title/Subtitle/Keywords. Promotional Text, by contrast, can be edited on the **live** version at any time with no new build or review — do that first regardless of version state.

---

## Step 1 — Promotional Text (do this first, ships immediately, zero risk)

For each locale, set Promotional Text to **Option A** from `apple-metadata.md` (leads with the expense benefit; Option B is the AI-Receipt-Scan-forward alternate for a later refresh/A-B read):

```
asc apps info edit --app 6760291360 --locale en-US --promotional-text "NEW: Snap a receipt, auto-log the expense or service. Track fuel cost, mileage, and every ride--built for riders who want to know what their bike really costs."

asc apps info edit --app 6760291360 --locale en-GB --promotional-text "NEW: Snap a receipt, auto-log the expense or service. Track petrol cost, mileage, and every ride--built for riders who want to know what their bike really costs."

asc apps info edit --app 6760291360 --locale de-DE --promotional-text "NEU: Beleg fotografieren, Kosten oder Service werden automatisch erfasst. Sprit, Kilometer und jede Fahrt im Blick--endlich weißt du, was dein Motorrad wirklich kostet."

asc apps info edit --app 6760291360 --locale it --promotional-text "NUOVO: Fotografa lo scontrino, spesa o tagliando si registrano da soli. Carburante, chilometri e ogni giro--per chi vuole sapere quanto costa davvero la sua moto."

asc apps info edit --app 6760291360 --locale es-MX --promotional-text "NUEVO: Escanea el recibo y el gasto o servicio se registra solo. Gasolina, kilometraje y cada rodada--para el que quiere saber cuanto le cuesta su moto de verdad."

asc apps info edit --app 6760291360 --locale fr-FR --promotional-text "NOUVEAU: Photographiez le reçu, la dépense ou l'entretien se remplit seul. Carburant, kilométrage, chaque trajet--pour savoir ce que coûte vraiment votre moto."

asc apps info edit --app 6760291360 --locale pt-BR --promotional-text "NOVO: Fotografe o recibo e o gasto ou serviço se preenche sozinho. Combustível, quilometragem e cada passeio--para quem quer saber quanto a moto custa de verdade."
```

- [ ] en-US promotional text set
- [ ] en-GB promotional text set
- [ ] de-DE promotional text set (accented)
- [ ] it promotional text set
- [ ] es-MX promotional text set
- [ ] fr-FR promotional text set (accented)
- [ ] pt-BR promotional text set (accented)

---

## Step 2 — Keywords field (highest-impact fix: adds "maintenance"/local equivalent, currently missing everywhere)

```
asc apps info edit --app 6760291360 --locale en-US --keywords "receipt,maintenance,fuel,reminder,cost,mileage,repair,budget,oil,tire,chain,part,history,rider,bike"

asc apps info edit --app 6760291360 --locale en-GB --keywords "receipt,maintenance,petrol,reminder,cost,mileage,repair,budget,oil,tyre,chain,part,rider,bike"

asc apps info edit --app 6760291360 --locale de-DE --keywords "Beleg,Wartung,Tankbuch,Werkstatt,Kilometer,Reparatur,Budget,Öl,Reifen,Kette,Teil,Biker,Sprit,Verlauf"

asc apps info edit --app 6760291360 --locale it --keywords "ricevuta,manutenzione,carburante,tagliando,costo,riparazione,budget,olio,gomma,catena,ricambio,biker"

asc apps info edit --app 6760291360 --locale es-MX --keywords "recibo,mantenimiento,gasolina,refaccion,llanta,costo,reparacion,budget,aceite,cadena,historial,biker"

asc apps info edit --app 6760291360 --locale fr-FR --keywords "reçu,entretien,carburant,motard,atelier,coût,réparation,budget,huile,pneu,chaîne,pièce,historique"

asc apps info edit --app 6760291360 --locale pt-BR --keywords "recibo,manutenção,combustível,motoqueiro,oficina,custo,reparo,orçamento,óleo,pneu,corrente,peça"
```

- [ ] en-US keywords set — verify ASC shows 99/100, no red warning
- [ ] en-GB keywords set — 93/100
- [ ] de-DE keywords set — 100/100
- [ ] it keywords set — 100/100
- [ ] es-MX keywords set — 100/100
- [ ] fr-FR keywords set — 97/100 (accented form)
- [ ] pt-BR keywords set — 95/100 (accented form)

---

## Step 3 — Subtitle (reorder to lead with expense — zero char-count risk, same words)

```
asc apps info edit --app 6760291360 --locale en-US --subtitle "Expense, Service, Trip & Ride"
asc apps info edit --app 6760291360 --locale en-GB --subtitle "Expense, Service, Trip & Ride"
asc apps info edit --app 6760291360 --locale de-DE --subtitle "Kosten, Service & Fahrtenbuch"
asc apps info edit --app 6760291360 --locale it --subtitle "Spese, Servizio e Diario Moto"
asc apps info edit --app 6760291360 --locale es-MX --subtitle "Gasto, Servicio, Ruta y Rodada"
asc apps info edit --app 6760291360 --locale fr-FR --subtitle "Frais, Service & Carnet Moto"
asc apps info edit --app 6760291360 --locale pt-BR --subtitle "Gasto, Serviço e Diário Moto"
```

- [ ] All 7 subtitles updated
- [ ] Title left unchanged in all 7 locales this pass (see rationale in `apple-metadata.md` — Title is deliberately not touched to avoid re-indexing risk given how scarce impressions already are)

---

## Step 4 — Screenshots (the single highest-impact item in this entire pass)

- [ ] Confirm the approved v2 caption copy (`TRACK EVERY EXPENSE`, `NEVER MISS A SERVICE`, `LOG EVERY RIDE`, `DISCOVER ROUTES & GROUP RIDES`) is actually **rendered onto** the screenshot image files — not just approved as text in a doc. If the live screenshots have no visible caption text, this is the root problem to fix before anything else in this checklist moves the needle on conversion.
- [ ] Design/render the new slide 3 asset: "SNAP A RECEIPT, DONE" (AI Receipt Scan, v3.18.0)
- [ ] Re-render/retake slide 5: "DISCOVER ROUTES & GROUP RIDES" (Discover tab) — flagged pending since the prior pass, still outstanding
- [ ] Reorder uploaded set to: Expense → Service → Receipt Scan → Ride → Discover → (optional) AI diagnostic
- [ ] Upload at minimum the 6.9" (1320×2868) set for en-US; confirm auto-scale to 6.5"/6.1"
- [ ] Repeat caption translation + upload for all 6 other locales (see translation table in `visual-assets-spec.md`)
- [ ] If iPad is supported, upload 13" (2064×2752) set separately

---

## Step 5 — Verification before submission

- [ ] Every field shows no red/over-limit warning in App Store Connect for all 7 locales
- [ ] Re-run the character validation used to build this doc if any string is edited by hand in ASC (do not eyeball-edit accented characters — copy/paste exactly from `apple-metadata.md`)
- [ ] Description "AI MECHANIC first" bullet order patched per the "Description headline patch" section of `apple-metadata.md` for en-US at minimum
- [ ] `asc builds list --app 6760291360 --paginate` to confirm which version state you're editing against

---

## Open items outside metadata scope (flag, don't block on)

1. **Ratings/trust problem (2.0★ from 1 US rating, 0 elsewhere).** This is a code/UX fix (native `SKStoreReviewController` prompt at a high-satisfaction moment — e.g., after the 3rd logged expense or completed service), not an ASO metadata field. It's the single biggest non-metadata lever per `DATA-FOUNDATION.md` and should be scheduled as a follow-up engineering task, separate from this checklist.
2. **es-MX / Spain territory mismatch — needs verification.** `DATA-FOUNDATION.md` shows 68 impressions from the "ES" (Spain) territory, but the app's only Spanish localization is `es-MX`. Verify in App Store Connect whether Spain's storefront actually falls back to serving `es-MX` metadata (same base language `es`) or falls back to the app's primary/default locale (likely `en-US`) instead. If Spain is silently getting English metadata, either accept it (small volume, 68 impressions) or add a dedicated `es-ES` localization.
3. **Browse/featured discovery is ~5% of impressions.** Nothing in this metadata pass materially affects editorial/featured placement — that's a separate Apple relationship/quality-bar lever, not a copy fix.
