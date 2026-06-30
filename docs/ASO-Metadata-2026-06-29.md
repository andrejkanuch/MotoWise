# ASO Metadata — ready to paste (MOT-274)

Copy-paste-ready App Store Connect metadata. Lead with the **PostHog-validated priority (expenses > maintenance > rides); AI is NOT the hero**. App Store text-only edit — no binary build. Character limits enforced (App name ≤30, Subtitle ≤30, Keywords ≤100, Promotional text ≤170).

> **Before submitting:** validate keyword volume/competition for EU+Americas with the `aso-research` agent (this doc uses high-intent guesses, not measured volume). Subtitle/keyword fields are the highest-leverage and re-editable any time.

## English (primary)

- **App name** (≤30): `MotoVault: Motorcycle Care` (26)
- **Subtitle** (≤30): `Service, Expenses & Mileage` (27)
- **Keywords** (≤100, no spaces): `motorcycle,maintenance,service,expense,fuel,mileage,garage,reminder,logbook,mpg,oil,bike,moto,cost`
- **Promotional text** (≤170): `Never miss a service and track every expense. Log maintenance, fuel, and rides for every bike in your garage — and know exactly what your motorcycle costs to own.`
- **Description** (first 3 lines carry the most weight):
  ```
  MotoVault is the garage in your pocket. Track every expense, never miss a service, and see what your motorcycle really costs to own.

  • TRACK EVERY EXPENSE — fuel, service, parts, insurance, in one place
  • NEVER MISS A SERVICE — smart maintenance reminders per bike
  • LOG EVERY RIDE — distance, routes, and ride stats
  • DISCOVER ROUTES & GROUP RIDES — find roads worth riding
  • AI assistance when you need a hand diagnosing an issue
  ```
  (AI listed last, intentionally — it is not the lead feature.)

## Localized fields (Subtitle + Keywords + first description line)

Titles are already localized; these complete the set for EU search.

### Deutsch (de)
- **Subtitle** (≤30): `Service, Kosten & Kilometer` (27)
- **Keywords**: `motorrad,wartung,service,kosten,ausgaben,sprit,kilometerstand,garage,erinnerung,fahrtenbuch,ol`
- **Desc line 1**: `MotoVault ist deine Garage für die Hosentasche: erfasse jede Ausgabe, verpasse keine Inspektion und sieh, was dein Motorrad wirklich kostet.`

### Français (fr)
- **Subtitle** (≤30): `Entretien, dépenses & kms` (25)
- **Keywords**: `moto,entretien,révision,dépenses,carburant,kilométrage,garage,rappel,carnet,coût,essence`
- **Desc line 1**: `MotoVault, le garage dans votre poche : suivez chaque dépense, ne manquez aucune révision et sachez ce que votre moto coûte vraiment.`

### Italiano (it)
- **Subtitle** (≤30): `Tagliandi, spese e km` (21)
- **Keywords**: `moto,manutenzione,tagliando,spese,carburante,chilometraggio,garage,promemoria,libretto,costi`
- **Desc line 1**: `MotoVault è il garage in tasca: registra ogni spesa, non saltare un tagliando e scopri quanto ti costa davvero la moto.`

### Español (es)
- **Subtitle** (≤30): `Servicio, gastos y kms` (22)
- **Keywords**: `moto,mantenimiento,servicio,gastos,combustible,kilometraje,garaje,recordatorio,registro,coste`
- **Desc line 1**: `MotoVault es el garaje en tu bolsillo: registra cada gasto, no te saltes ninguna revisión y descubre cuánto te cuesta de verdad tu moto.`

## Notes
- The current subtitle reportedly wastes the best-indexed field on a feature list — replace it with the service/expense-forward subtitle above.
- App name moves from "Bike" → "Motorcycle"/"Moto" for higher-intent search (verify volume).
- Screenshot order should match the priority (expenses → service → rides → discover); AI screen last.
- Measurement caveat: App Store Connect App Analytics access is a data gap — pair any lift read with the HDYHAU referral data (MOT-272) + the Supabase install trend.
