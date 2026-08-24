# Africa Twin (CRF1100L) OEM schedule — feasibility & extracted data

**Date:** 2026-08-24
**Source document:** `HondaAfricaTwinManual-EN.pdf` — Honda owner's manual, ref **32MLG6000**, dated 30 April 2021.
Maintenance Schedule = printed pages **252–256** (PDF pages 257–261).
**Question:** can the manual's periodic-maintenance table be loaded into the DB so an Africa Twin owner
sees model-correct reminders instead of the generic Honda fallback?

**Answer: yes, and no schema work is required.** The table, the variant mechanism, the provenance
columns, the verification gate, the resolver waterfall and the mobile UI already exist. What is
missing is *the data* — there is not a single Africa Twin row in `oem_maintenance_schedules` today.
This is a seed-data task, not a feature build.

---

## 1. What already exists (verified in code)

| Capability | Where | Status |
|---|---|---|
| Reference table with model + year + variant granularity | `oem_maintenance_schedules` (00022, extended 00149) | ✅ |
| `variant` column (`'DCT'` / `'MT'` / NULL) | 00149 | ✅ |
| Provenance: `source_id`, `source_page`, `source_context` | 00149 | ✅ |
| Provenance parent table `maintenance_data_sources` (`source_type='owner_manual'`, `reference`, `market_applicability`) | 00149 | ✅ |
| `is_verified` gate — one chokepoint on every read path | `OemSchedulesService.verifiedSchedules()` | ✅ |
| `is_safety_critical`, server-set from an allowlist, never from a model | `SAFETY_CRITICAL_ALLOWLIST` (`packages/types`) | ✅ |
| Resolver waterfall: model+variant → model baseline → make-generic → GENERIC | `OemSchedulesService.findByMotorcycle()` | ✅ |
| Variant rows **merge over** the baseline by `task_name` (baseline tasks without a variant entry are kept) | `mergeRowsByTaskName()` | ✅ |
| `service_type` canonical taxonomy | 00171 | ✅ |
| `motorcycle_specs` for point values (torque, capacity, pressure, plug gap, valve clearance) | 00149 | ✅ |
| Variant capture UI — onboarding | `(onboarding)/bike-setup.tsx` → `VariantSelector` | ✅ |
| Variant capture UI — existing bike | `(tabs)/(garage)/edit-bike.tsx` | ✅ |
| Import-to-my-garage button for an existing bike | `importOemSchedule` mutation, wired at `(tabs)/(garage)/bike/[id].tsx:361` | ✅ |
| Admin draft review + approve | `listMaintenanceDrafts` / `approveMaintenanceDraft` | ✅ |

**Conclusion:** the 2026-06-19 data-sourcing pilot (migration 00149) built exactly this pipeline and
named the Africa Twin DCT as its pilot bike — then stopped before loading data. Migration 00149
contains **zero INSERT statements**.

### What the owner sees today

With no Africa Twin rows, `findByMotorcycle('Honda', 'Africa Twin', 2022, …, 'DCT')` falls through
tiers 1–3 to the **make-generic HONDA baseline** seeded by hand in migration 00022. Those numbers
were guesses, and several are materially wrong for this bike:

| Task | Currently shown (HONDA generic) | Manual (ED type) | Delta |
|---|---|---|---|
| Engine oil | 6,000 km / 180 d | **12,000 km / annual** | **2× too frequent** |
| Air filter | 12,000 km / 365 d | **24,000 km** | 2× too frequent |
| Spark plugs | replace 16,000 km | **inspect 24,000 km, replace 48,000 km** | 3× too frequent |
| Brake fluid | 24,000 km / 730 d | **inspect 12,000 km, replace every 2 years** | mileage trigger is wrong |
| Coolant | 24,000 km / 730 d | **inspect 12,000 km, replace every 3 years** | mileage trigger is wrong |
| Valve clearance | 24,000 km | 24,000 km | ✅ correct |
| Chain clean & lube | 1,000 km / 30 d | 1,000 km | ✅ correct |
| Clutch oil filter (DCT) | **absent** | **24,000 km** | missing entirely |
| Brake lock operation (DCT) | **absent** | **12,000 km** | missing entirely |

So the owner is currently being told to change oil twice as often as Honda specifies, and is never
told about the two DCT-specific items.

---

## 2. The extraction problem, and how it was solved

`pdftotext` recovers the **row labels and the column headers but not the interval marks**. The
I / L / R / C marks are symbol-font glyphs in a borderless grid; the text layer emits nothing for
them, so a naive text extraction yields a table of task names with every interval blank — which
would look like a successful parse. The marks were recovered by rendering pages 258–259 at 200 dpi
(`pdftoppm`) and reading the grid visually, then anchoring each glyph to a header column by x-position.

**This matters for the automated sourcing pipeline:** an LLM handed `pdftotext` output for this
manual would confidently return task names with fabricated or null intervals. Honda owner's manuals
must go through a page-image path, not a text path.

### Two market schedules in one book

The manual carries **two different tables**:

- **ED / II ED / III ED type** — European direct sales, France, South Africa, Turkey.
  Columns: 1, 12, 24, 36, 48 (×1,000 km).
- **GS / III GS type** — GCC countries, Lebanon, Jordan.
  Columns: 1, 6, 12, 18, 24, 30, 36 (×1,000 km) — roughly twice as frequent.

MotoVault targets Europe + the Americas, so **ED is the correct table** and is what is transcribed
below. Record it on the source row as `market_applicability = 'EU'`. (A US-market Africa Twin ships
a different manual with mile-based intervals; do not assume ED covers it.)

**This is not merely a preference — the schema permits only one market's schedule per bike.** See §9.

### Variant mapping — confirmed by the manual's own footnotes

- `*6 : CRF1100D/D2/D4 only` → **DCT**. Gains **Clutch Oil Filter** and **Brake Lock Operation**.
- `*7 : CRF1100A/A2/A4 only` → **MT**. Gains **Clutch System**.

This is precisely what the `variant` column and `mergeRowsByTaskName()` were built for: the ~27
shared tasks go in as `variant = NULL`, and only these three rows carry a variant.

---

## 3. ⚠️ The blocking integration detail: the `model` string

`findByMotorcycle` matches with `.eq('model', model)` — an **exact string match** against whatever
is stored on `motorcycles.model`. Model names come from NHTSA vPIC, and vPIC does **not** use
"CRF1100L". Queried live:

```
GET /GetModelsForMakeYear/make/honda/modelyear/2022/vehicletype/motorcycle
→ "Africa Twin", "Africa Twin Adventure Sports"
```

So the seed rows **must** use `model = 'Africa Twin'` and `model = 'Africa Twin Adventure Sports'`
(and `make = 'HONDA'`, ALL-CAPS per the 00126 convention and `make.toUpperCase()` in the service).
Seeding `'CRF1100L'` would produce rows that are never once matched, and the failure is silent — the
waterfall just falls through to the generic HONDA tier and everything looks like it works.

The periodic schedule is **identical** for both model strings (one ED table covers
A/A2/A4/D/D2/D4), so the row set is duplicated across the two names. The base-vs-Adventure-Sports
split only affects fuel capacity, which is not a maintenance interval.

---

## 4. Extracted schedule — ED type (transcribed from pages 253–254)

Legend: **I** inspect · **L** lubricate · **R** replace · **C** clean.
"Annual" = the manual's Annual Check column → `interval_days = 365`.

### 4a. Shared rows — `variant = NULL` (27 rows)

| # | Task name | interval_km | interval_days | Source of value | Page |
|---|---|---|---|---|---|
| 1 | Fuel Line | 12,000 | 365 | I @ 12/24/36/48 + Annual | 253 |
| 2 | Throttle Operation | 12,000 | 365 | I @ 12/24/36/48 + Annual | 253 |
| 3 | Air Cleaner | 24,000 | — | R @ 24/48 | 253 |
| 4 | Crankcase Breather | 12,000 | — | C @ 12/24/36/48 | 253 |
| 5 | Spark Plug Inspection | 24,000 | — | I @ 24 | 253 |
| 6 | Spark Plug Replacement | 48,000 | — | R @ 48 | 253 |
| 7 | Valve Clearance | 24,000 | — | I @ 24/48 | 253 |
| 8 | Engine Oil | 12,000 | 365 | R @ 1/12/24/36/48 + Annual | 253 |
| 9 | Engine Oil Filter | 24,000 | — | R @ 1/24/48 | 253 |
| 10 | Engine Idle Speed | 12,000 | 365 | I @ 12/24/36/48 + Annual | 253 |
| 11 | Cooling System | 12,000 | 365 | I @ 12/24/36/48 + Annual | 253 |
| 12 | Radiator Coolant Inspection | 12,000 | 365 | I @ 12/24/36/48 + Annual | 253 |
| 13 | Radiator Coolant Replacement | — | 1,095 | Regular Replace: **3 Years** | 253 |
| 14 | Secondary Air Supply System | 24,000 | — | I @ 24/48 | 253 |
| 15 | Evaporative Emission Control System | 24,000 | — | I @ 24/48 | 253 |
| 16 | Exhaust Gas Control Actuator Cable | 24,000 | — | I @ 24/48 | 254 |
| 17 | Drive Chain | 1,000 | — | "Every 1,000 km (600 mi): I L" | 254 |
| 18 | Drive Chain Slider | 12,000 | — | I @ 12/24/36/48 | 254 |
| 19 | Brake Fluid Inspection | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 20 | Brake Fluid Replacement | — | 730 | Regular Replace: **2 Years** | 254 |
| 21 | Brake Pads Wear | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 22 | Brake System | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 23 | Brakelight Switch | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 24 | Headlight Aim | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 25 | Side Stand | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 26 | Suspension | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 27 | Nuts, Bolts, Fasteners | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |
| 28 | Wheels/Tyres | 6,000 | 365 | "Every 6,000 km (4,000 mi): I" + Annual | 254 |
| 29 | Steering Head Bearings | 12,000 | 365 | I @ 12/24/36/48 + Annual | 254 |

(29 rows once the two inspect/replace splits are counted separately — see §5a.)

### 4b. DCT-only — `variant = 'DCT'` (2 rows)

| Task name | interval_km | interval_days | Source | Page |
|---|---|---|---|---|
| Clutch Oil Filter | 24,000 | — | R @ 1/24/48, footnote *6 = CRF1100D/D2/D4 | 253 |
| Brake Lock Operation | 12,000 | — | I @ 12/24/36/48, footnote *6 | 254 |

### 4c. MT-only — `variant = 'MT'` (1 row)

| Task name | interval_km | interval_days | Source | Page |
|---|---|---|---|---|
| Clutch System | 12,000 | 365 | I @ 12/24/36/48 + Annual, footnote *7 = CRF1100A/A2/A4 | 254 |

### 4d. Pre-ride-only items — deliberately **not** seeded

`Fuel Level`, `Lights/Horn`, `Engine Stop Switch` carry a pre-ride mark and no interval. They cannot
be expressed as `interval_km`/`interval_days` and would become permanently-overdue noise. They belong
in a pre-ride checklist feature, not in `oem_maintenance_schedules`.

### 4e. Footnotes that cannot be represented today

- `*2` air cleaner, `*3` crankcase breather, `*4` chain / fasteners / wheels / tyres — "service more
  frequently when riding off-road / in wet or dusty conditions / at full throttle". The schema has no
  duty-cycle modifier. Reasonable to fold into `description` text for now.
- The **1,000 km break-in service** (engine oil, oil filter, clutch oil filter all marked R at the
  1,000 km column) is a one-off, not a recurrence. `is_recurring` is hardcoded `true` in
  `autoPopulateForBike`, so this cannot be expressed as a distinct first-service row. Folding it into
  the `description` is the cheap option; a `first_service_km` column would be the correct one.

---

## 5. Modelling decisions this forces

### 5a. Split inspect-vs-replace into separate rows
The natural key is `(make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), COALESCE(year_to,0), task_name)`
— one interval per row. Three items have a different inspect and replace cadence and **must** become
two rows each, or the longer interval is lost:

- Spark Plug — inspect 24,000 km / replace 48,000 km
- Radiator Coolant — inspect every 12,000 km / replace every 3 years
- Brake Fluid — inspect every 12,000 km / replace every 2 years

Note the `service_type` backfill in 00171 keys off `lower(task_name)` against fixed arrays, so new
names like `'Spark Plug Inspection'` / `'Brake Fluid Replacement'` need `service_type` set explicitly
in the INSERT (`spark_plug`, `brake_fluid`, `coolant`) — the classifier won't reach them retroactively.

### 5b. Year range — a real decision, needs your call
The manual edition is dated April 2021 and covers CRF1100A/A2/A4/D/D2/D4. The CRF1100L generation ran
2020–2023 before the 2024 refresh.

- **Narrow (`year_from = 2022, year_to = 2023`)** — only what this document verifies. A 2020 bike then
  falls back to the wrong generic Honda numbers.
- **Generation-wide (`year_from = 2020, year_to = 2023`)** — matches how the bike was actually
  homologated and covers every CRF1100 owner. I believe the schedule was unchanged across the run, but
  **this document does not prove it** — it would need the 2020 edition to confirm.

Recommendation: go generation-wide (2020–2023), because the fallback it displaces is *known wrong* by
2× on oil, and re-verify against the 2020 edition when convenient. But it is a coverage-vs-provenance
trade and it's your call.

### 5c. Safety-critical flags
`SAFETY_CRITICAL_ALLOWLIST` is `['valve clearance', 'brake fluid', 'clutch fluid', 'engine oil', 'tire pressure']`
and matches on substring. Against the names above it flags: Valve Clearance, Brake Fluid Inspection,
Brake Fluid Replacement, Engine Oil. It does **not** flag Brake Pads Wear, Brake System, Wheels/Tyres,
or Steering Head Bearings — all arguably safety-critical. Note "tire pressure" (US spelling) will never
match the manual's "Wheels/Tyres". Worth widening the allowlist, separately from this seed.

### 5d. Verification
New rows default to `is_verified = false` and are invisible to users. These values were transcribed
by hand from the primary document, so they can be inserted with `is_verified = true` directly in the
migration (the same posture 00149 took when it backfilled existing rows) — or inserted as drafts and
pushed through the admin approve screen if you'd rather see them in that UI first.

---

## 6. Bonus: `motorcycle_specs` values available from the same manual (page 366)

These are point values, not intervals, so they belong in `motorcycle_specs`:

| spec_type | spec_name | Value | Variant |
|---|---|---|---|
| `pressure` | Tyre air pressure, front | 225 kPa (33 psi) | all |
| `pressure` | Tyre air pressure, rear — rider only | 250 kPa (36 psi) | all |
| `pressure` | Tyre air pressure, rear — rider + passenger | 280 kPa (41 psi) | all |
| `capacity` | Engine oil, after draining | 4.0 L | **DCT** |
| `capacity` | Engine oil, after draining + oil filter change | 4.2 L | **DCT** |
| `capacity` | Engine oil, after draining + engine & clutch oil filter change | 4.2 L | **DCT** |
| `capacity` | Engine oil, after disassembly | 5.2 L | **DCT** |
| `capacity` | Engine oil, after draining | 3.9 L | MT |
| `capacity` | Engine oil, after draining + oil filter change | 4.0 L | MT |
| `capacity` | Engine oil, after disassembly | 4.8 L | MT |
| `plug_gap` | Spark plug gap | 0.8–0.9 mm | all |

Also on that page but with no `spec_type` slot: spark plug part number (SILMAR8A9S, NGK), idle speed
(1,250 ± 100 rpm), minimum tread depth (front 1.5 mm / 3.0 mm M+S, rear 2.0 mm / 3.0 mm M+S).

**Valve clearance figures are not in the owner's manual** — the schedule marks that item
"Technical / Intermediate" and defers to the shop manual. `HondaAfricaTwinServiceManual-EN.pdf` (also
in the same iCloud folder) is where that value lives, if you want the `valve_clearance` spec filled.

---

## 7. Recommended path

1. **One migration** (next free prefix — re-verify against production first, per the migration-divergence
   note): insert one `maintenance_data_sources` row for ref `32MLG6000` / `market_applicability = 'EU'`,
   then the schedule rows for `('HONDA','Africa Twin')` and `('HONDA','Africa Twin Adventure Sports')`
   × {NULL, DCT, MT}, each carrying `source_id`, `source_page`, `source_context`, `service_type`,
   `is_safety_critical`, `is_verified = true`.
2. **Set `variant = 'DCT'`** on your own bike via Edit Bike, then hit the import-OEM-schedule action on
   the bike screen. Existing generic tasks are *not* replaced — dedup in `autoPopulateForBike` is by
   `oem_schedule_id`, so the old generic rows stay and you'd see both. Deciding what happens to
   already-imported generic tasks is an open question (see §8).
3. **Add `VariantSelector` to `add-bike.tsx`** — it exists in onboarding and Edit Bike but not in the
   add-bike screen, so a new bike added post-onboarding silently gets `variant = NULL` and misses the
   DCT rows until the owner happens to edit it.
4. Optionally load the §6 specs.

## 8. Open questions for you

1. **Year range** — generation-wide 2020–2023, or strictly 2022–2023? (§5b)
2. **Already-imported generic tasks** — when a bike that already imported the wrong generic Honda tasks
   re-imports, nothing dedupes them away. Migrate/retire them, or leave both sets and let the owner
   delete? This affects you directly, since your garage presumably already has the 6,000 km oil task.
3. **Insert as verified, or route through the admin draft screen?** (§5d)
4. **Scope** — just the Africa Twin as the pilot, or do you want this treated as the template for a
   batch of manuals? The page-image extraction constraint in §2 is the main cost driver for scaling.

---

## 9. Verification pass (2026-08-24, high-resolution page renders)

The four schedule pages were re-read from clean high-resolution renders supplied by the owner.

**ED type (pages 253–254): all 32 rows confirmed. Zero corrections to §4.** Including the rows most
at risk of a misread: Engine Oil (R @ 1/12/24/36/48 + Annual), Engine Oil Filter and Clutch Oil
Filter (R @ 1/24/48), Spark Plug (I @ 24, R @ 48), and Brake Lock Operation (I @ 12/24/36/48 with
**no** Annual mark).

**Independent validation of the extraction method.** The GS table renders the Spark Plug row *as
text* — "Every 24,000 km: I / Every 48,000 km: R" — which matches the ED reading derived purely from
glyph x-positions. GS Valve Clearance likewise carries a single mark at 24 against columns running to
36, confirming that footnote *1 ("repeat at the frequency interval established here") is the correct
rule for interpreting a lone mark as a recurring interval. The x-position anchoring method is sound.

### ⚠️ ED-vs-GS is forced by the schema, not a market preference

§2 framed the ED/GS choice as "MotoVault targets Europe, so use ED". With GS now legible, the
constraint is harder than that. The unique natural key is
`(make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), COALESCE(year_to,0), task_name)`.
ED and GS rows share **every** one of those fields and differ only in the interval value, so e.g.
`('HONDA','Africa Twin',NULL,2020,2023,'Air Cleaner')` at 24,000 km (ED) and at 18,000 km (GS)
**collide on the unique index**. The table can hold exactly one market's schedule per bike.

Consequence beyond this bike: a US mile-based Africa Twin schedule hits the same wall. Supporting
multiple markets for one model requires a `market` column added to the natural key — not just more
rows.

### GS deltas (recorded, not for seeding)

Confidently read, GS differs from ED on four items only — Air Cleaner 18,000 km (ED 24,000),
Crankcase Breather 6,000 km (ED 12,000), Brake Fluid inspection 6,000 km (ED 12,000), Brake Pads Wear
6,000 km (ED 12,000). The extra 6/18/30 columns in the GS grid exist essentially to carry those.
Several lower GS rows (Brake System, Brakelight Switch) have irregularly spaced marks that were **not**
read unambiguously at this resolution and are deliberately not recorded.

## Provenance notes

- Every interval in §4 was read off the rendered page grid, not inferred. Values I could not read
  unambiguously are not in this document.
- Marks were anchored to header columns by x-position; the ED-type header is at
  1→x795, 12→x845, 24→x894, 36→x943, 48→x992, Annual→x1047 on page 253 (200 dpi render).
- GS-type (GCC) table on pages 255–256 was deliberately **not** transcribed.
- The claim that the CRF1100 schedule is unchanged 2020–2023 is **not** sourced — it is the one
  unverified assumption behind the §5b recommendation.
</content>
</invoke>
