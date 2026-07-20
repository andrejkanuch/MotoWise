# Receipt Scan — Structure Redesign Plan

**Date:** 2026-07-20
**Author:** Andrej + Claude
**Status:** Proposal (pre-implementation)
**Trigger:** Real Honda Africa Twin service invoice scanned in prod collapsed into one opaque record; maintenance work invisible on the bike; unclear Maintenance-vs-Expense distinction; review screen overflowing.

---

## 1. Ground truth (what actually happens today)

Verified against prod (`tpsoneenbrmdwvzcbifw`), user `kanuchandrej@gmail.com` / `65b941f3-…`, bike Africa Twin `29a0e837-…`.

The scanned invoice ("FACTURA DE REPARACIÓN – REVISION MANTENIMIENTO", 8 line items, €241.46, 37,505 km, issued 16/07/2026) produced:

| Record | Stored value | Verdict |
|---|---|---|
| 1× `maintenance_tasks` | title "Revisión mantenimiento…", `cost 41.91`, `parts_cost 110.45`, `labor_cost 89.10`, `source receipt_scan`, `status completed` | ⚠️ single opaque blob |
| 1× auto-`expenses` | `241.46 EUR` | ✅ money total correct |
| `parts_needed` on task | **null** | ❌ 6 extracted line items discarded on save |
| `completed_mileage` on task | **null** | ❌ odometer 37,505 was applied to the *bike* but not stamped on the task |
| `completed_at` | **2022**-07-16 | ❌ year mis-read (should be 2026); model returned it with confidence 1.0 |
| auto-expense `date` | **2026-07-20** (today) | ❌ should be the service date |
| auto-expense `category` | `maintenance` | ⚠️ not a member of the expense-category set shown in the picker |
| misc `cost` bucket | 41.91 | ⚠️ this is the VAT, not a "misc" cost |

### Root causes in code
- `receipt-scan.service.ts › writeMaintenanceRecord` never passes `partsNeeded` or `completedMileage` to `maintenanceTasksService.create` (both params already exist and are supported).
- `expenses.service.ts › createFromTask` hardcodes `date: today` and `category: 'maintenance'`, ignoring the task's `completed_at`.
- The extraction prompt/schema is **single-record**: line items are flattened into a lossy `partsNeeded: string[]` and then dropped anyway.
- The **bike-detail maintenance list was 500ing** on `source = 'receipt_scan'` (GraphQL enum drift) — fixed & pushed on `main` 2026-07-20 (commit `08d117b9`, `Fixes MOTO-VAULT-REACT-NATIVE-1J`). Once the API redeploys, completed scan tasks appear in service history. **This alone resolves most of "I don't see the maintenance."**

---

## 2. Core design decision — record the past service, do NOT auto-match the schedule

**Question raised:** should a scanned invoice auto-complete the bike's existing pending OEM tasks (Oil & Filter Change, Brake Fluid, …)?

**Decision: No.** Create a **new completed maintenance record** representing the work done in the past. Rationale:

1. The bike's pending tasks are **generic English seed items** (created in bulk, USD, no real interval anchoring). Invoice lines are Spanish free-text. Cross-language fuzzy matching is unreliable and would silently mis-map.
2. Those pending tasks are **future-due occurrences**. A *past* service completing a future occurrence corrupts next-due math and hides a still-needed service.
3. `createNextRecurrence` only advances tasks flagged `is_recurring` with a known interval — data a receipt does not carry. Guessing an interval from one invoice is wrong.

Any "advance my next oil reminder" behavior must be **user-confirmed**, not inferred (see §6, v2).

This matches the intent: *"create a completely new maintenance task, which we did in the past."*

---

## 3. Target data model

**One invoice → one completed maintenance task (the service visit) + one expense (the money) + structured line items.**

### Option A — line items as `parts_needed: string[]` (zero migration, ship first)
- Persist the extracted operations into the existing `parts_needed` array.
- `completed_mileage` = converted odometer; `completed_at` = invoice date.
- Pros: no schema change, immediate structural win, line items visible in task detail.
- Cons: no per-line cost/qty/type; not individually editable.

### Option B — new child table `maintenance_task_line_items` (well-structured)
```
maintenance_task_line_items(
  id, task_id FK, user_id,
  service_type text,        -- canonical: oil_change | oil_filter | brake_fluid | dct_oil | coolant | ...
  label text,               -- printed line text
  part_ref text null,       -- e.g. 15410MFJD02
  quantity numeric null,
  unit_price numeric null,
  line_total numeric null,
  created_at
)
```
- Pros: true structure — per-line type/qty/cost, editable, queryable ("when did I last change brake fluid?"), foundation for v2 reminder-seeding.
- Cons: migration + resolver + loader + review UI for line editing.

**Recommendation:** ship **A** in Phase 2 (fast correctness win), land **B** in Phase 4 as the real structure. Both keep money as a single expense.

### Money & category fixes (both options)
- Auto-expense `date` = task `completed_at` (add `date` param to `createFromTask`).
- Auto-expense `category`: map to a valid picker category (`service`) or introduce a `maintenance`→`service` alias; stop writing an out-of-set value.
- Stop stuffing VAT into the misc `cost` bucket — either keep tax as its own field/line, or fold into parts so `cost` means "other/misc" honestly. (Total must still equal the invoice.)

---

## 4. Extraction changes (AI)

- Add a `lineItems[]` array to `ReceiptExtractionSchema`: `{ label, serviceType?, partRef?, quantity?, unitPrice?, lineTotal? }`.
- Prompt: instruct itemization capture + classification into the canonical `service_type` enum; keep grand-total/parts/labor as today.
- **Date hardening:** the 2022 mis-read passed at confidence 1.0, so confidence gating is insufficient. Add:
  - Always mark `date` needs-check (amber) for `maintenance` invoices.
  - A sanity flag when the extracted year differs from the current year by more than N and no explicit historical intent — surface, don't silently accept.
- Keep VIN/plate strip (KTD-9) and EU number/date rules already in the prompt.

---

## 5. UX changes

### 5a. Maintenance vs Expense — explain in-context (chosen)
- Default a detected service invoice to **Maintenance**.
- One-line explainers under the toggle:
  - **Maintenance:** "Adds to this bike's service history **and** your expenses."
  - **Expense:** "Logs a cost only."
- After save, confirmation names both effects ("Logged to service history + expenses").

### 5b. Overflow fix
- `receipt-scan-flow.tsx` root uses fixed `paddingTop: 12` with no safe-area inset → title collides with the status bar on the full-screen modal.
- Use `useSafeAreaInsets().top` (+ small margin) for the flow container top padding; verify the review card header and the ITEM field are fully visible above the Save button on a notched device.

### 5c. Service-history presentation
- With the enum fix deployed, ensure the completed scan task renders in bike detail with: title, date, mileage, cost, and its line items (parts_needed or line-item rows).

---

## 6. Phasing

- **Phase 0 (done):** enum fix pushed (`08d117b9`). Deploy API to Render → maintenance tasks become visible. *Verify the two existing prod scans render before building more.*
- **Phase 1 — data correctness (no schema):** pass `completedMileage` + `partsNeeded` from `writeMaintenanceRecord`; fix `createFromTask` date/category; fix the VAT/cost bucket. Backfill/repair the one existing mis-saved task + expense (optional).
- **Phase 2 — overflow + toggle UX + date hardening.**
- **Phase 3 — extraction `lineItems[]`** (schema + prompt + persist into `parts_needed` for now).
- **Phase 4 — `maintenance_task_line_items` child table** + review-screen line editing + service-history line display.
- **v2 (later, user-driven):** after saving a service, optionally offer "remind me for the next one" per recognized service type — creates a recurring pending task seeded from this completion (interval chosen by the rider). No fuzzy auto-matching.

---

## 7. Risks & notes
- Odometer already applied 84 → 37,505 km on this bike; any backfill must not double-apply.
- Auto-expense has a unique constraint on `maintenance_task_id` (idempotent) — safe to re-run.
- The wrong 2022 date is on a live record; decide whether to correct in place during Phase 1 backfill.
- Keep money single-sourced: never split one invoice into multiple expenses.

---

## 8. Open questions for confirmation
1. Line-item structure: Option A first then B, or jump straight to B?
2. Backfill the one existing mis-dated/blob record, or leave it and only fix forward?
3. VAT handling: separate tax field/line vs fold into parts — which do you prefer for the money model?
