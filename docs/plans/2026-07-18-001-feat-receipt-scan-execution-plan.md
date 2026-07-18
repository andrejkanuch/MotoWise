---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
origin: docs/prd-receipt-scan.md
title: "feat: Receipt Scan — AI expense & maintenance capture"
type: feat
date: 2026-07-18
deepened: 2026-07-18
reviewed: 2026-07-18 (3-agent implementation review — backend grounding, mobile grounding, executability; all findings folded in)
---

# Receipt Scan — Execution Plan

**Origin / source of truth:** `docs/prd-receipt-scan.md` (v0.5, team-validated). This plan enriches that PRD into dependency-ordered implementation units (U-IDs). Product Contract unchanged — this is the HOW for the PRD's WHAT.

**Grounding note:** codebase claims were verified twice — a 6-agent PRD review and a 3-agent implementation review (both 2026-07-18) against real source at this commit. File paths are repo-relative and confirmed present unless marked *(new)*.

**How to execute:** one unit per session, **one PR per unit, merged to main incrementally** (units are ordered so main stays shippable; the feature is unreachable by users until U8's entry points land). Start each session with:
> Read `docs/prd-receipt-scan.md` and this plan, then implement U-N to its test scenarios and Verification. Do not start other units. Plan mode first.

**Release rule:** no production OTA containing U8 (entry points) may ship before U11 sign-off **and** final Q11 consent copy — a placeholder legal disclosure must never reach EU users.

**Standing rules (CLAUDE.md — hold every session):** migration for every DB change; `pnpm generate` after any resolver/`.graphql` change; export Zod schema + inferred type together; no `enum` keyword (`as const`); palette tokens only; RLS on every new table; user-client for user-scoped writes (service-role only for the metering RPC); snake_case → camelCase at the service layer.

---

## Summary

Turn a receipt photo into a structured expense or completed-maintenance record in <20s: capture → server-side GPT-4.1 vision extraction (`zodResponseFormat`) → human-confirmed review card → transactional server-side save, with an optional odometer update. Free tier = 3 scans/month, gated client-side via the existing RevenueCat `useProGate` pattern (live day one) with a dormant server-side layer behind the company-wide `ENTITLEMENTS_ENFORCED` flip. Ships alongside `fuel_logs` deprecation (zero real-user data) and an expenses-first, onboarding-integrated framing to attack the empty-garage activation cliff.

Fourteen units (U7 split into U7a–d after implementation review), dependency-ordered, gated by an extraction spike (U1). Honest estimate ~6–7 solo engineer-weeks (security/GDPR work included). The `§11` mileage-aware-status epic is **separate** and gates *reporting* of Goal 3 only.

---

## Problem Frame

Manual receipt entry means most receipts never get logged → thin expense history, stale odometer (wrong maintenance reminders), and a steep first-run cliff. No moto app closes the loop from a dealer invoice to a completed maintenance record. Solving it deepens the validated expenses wedge and gives new users a fast path to a populated app.

**Scope boundary:** v1 is mobile-only, one receipt per scan, server-side extraction, always-new completed maintenance task (no pending-task reconciliation). Manual entry is always free and always available — the scan is a metered convenience, never a gate on logging itself.

---

## Requirements Trace

Requirements carry the PRD's IDs (R1–R10) plus goals (G1–G7). Each maps to units below.

| ID | Requirement | Units |
|---|---|---|
| R1 | Receipt extraction service (storage-first, GPT-4.1, versioned Zod, category enum, magic-byte validation, throttle, AI-budget) | U1, U2, U4 |
| R2 | Scan quota: `receipt_scans` table + RLS + `reserve_receipt_scan` RPC + reaper + `receiptScanQuota` + union-result errors | U2, U4, U5 |
| R3 | Scan flow + review card (bike-pick, consent, upload phase, offline-persist, analyzing, review-later, resume) | U6, U7c |
| R4 | Routing to existing mutations + create-as-completed-with-cost gap | U3, U7b, U7d |
| R5 | Photo attachment + signed-URL resolution + C1 path-ownership | **U2 (bucket discriminator), U7a** |
| R6 | Odometer side effect (unit conversion mandatory) | U7b, U7c |
| R7 | Failure / degradation / resume UX | U6, U7d |
| R8 | Telemetry (incl. shadow-mode + support tripwire) | U10 |
| R9 | Deprecate `fuel_logs` (corrected consumer scope, FK-drop-first) | U9 |
| R10 | GDPR deletion coverage for `receipts` bucket | U2 |
| G1–G2 | <20s time-to-log; +30% expense records/user | U6, U7c/d |
| G3 | Odometer freshness — **reporting gated on §11 epic** | U7b, U10 |
| G4 | ≥3% exhauster→paid (clock starts at launch via client gate) | U5, U8 |
| G5 | ≥90% ≤2 corrections (amount always-verify) | U1, U7c |
| G6/G7 | Habit (2nd scan) / activation (onboarding scan) | U8 |

**Critical items (never-cut — the team-review critical set):** C1 server-derived storage path + scanId-UUID validation + cross-user test (U4/U7a); C2/R10 same-PR bucket deletion sweep (U2); C3 reservation RPC + sweep-before-count reaper + `receipt_scans` RLS (U2); C4 server-decided consumption + union-result typed errors (U4); failed-scan-is-free; resume-unreviewed-scan (U6); **transactional save/undo pair (U7b)**.

---

## Key Technical Decisions

**KTD-1 — Storage-first, never base64-through-GraphQL.** The Nest/Express default body-parser (~100 KB) 413s large base64 before GraphQL runs (verified; latent diagnostics bug, separate ticket). Client uploads to the private `receipts` bucket; the mutation passes only `scanId`; the server derives the path.

**KTD-2 — Server derives the storage path from the authenticated uid; client paths are never accepted (C1).** `expense_photos`/`maintenance_task_photos` RLS checks row ownership, not `storage_path` prefix, and signed URLs are minted via the admin client which *bypasses* storage RLS. So path = `{auth.uid()}/{scanId}.webp`, always server-side. **`scanId` MUST be validated as a strict UUID** (reject otherwise with `IMAGE_INVALID`) before it is concatenated into a path. Belt-and-suspenders: a storage-policy path constraint restricting object names under `{uid}/` to `{uuid}.webp`, and signed-URL resolvers still assert `foldername(path)[1] = auth.uid()`. Signed URLs use a **short TTL (60–300s, generated on demand per view)**.

**KTD-3 — Two-layer enforcement, client-live-at-launch.** Layer 1 (launch): `useProGate` + `requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', count)` + RevenueCat, identical to `MAX_BIKES`; `isPro` comes from the RevenueCat SDK client-side (`subscription.ts` → Zustand `subscription.store`), so it does **not** depend on `ENTITLEMENTS_ENFORCED`. **Critical: the `count` feeding `requireAccess` must be a tier-INDEPENDENT monthly used-count** (non-failed `receipt_scans` rows this month), NOT the tier-derived `remaining`/`isExhausted` shape of `getGPXQuotaStatus` — with `ENTITLEMENTS_ENFORCED=false` the guard forces every user to `pro`, so a tier-derived quota reports `remaining=-1` (unlimited) and the client paywall would never fire at launch (verified: `entitlements.service.ts:37-74`, `limits.ts:15`). Layer 2 (dormant): server `SCAN_QUOTA_EXCEEDED` keys off resolved tier, activates only at the company-wide flip; until then the server logs `paywall_would_have_shown`. Accepted interim exposure: a modified client can over-scan (~$0.007/scan). **Attribution nuance (verified):** `presentPaywall({feature})` feeds *analytics only*; the RevenueCat offering is selected by `placement`/`offeringIdentifier`, and `useProGate` always passes `placement:'feature_gate'` — a scan-specific RC paywall design needs a new placement or explicit `offeringIdentifier` (U11 checklist).

**KTD-4 — Consumption is server-decided from the extraction outcome, never a client signal.** The reservation RPC inserts `pending`; the service marks `success` iff the model returns valid structured data, `failed` on extraction failure. Client-initiated cancel exists (PRD §6 blesses "cancellations are free") but only as a **compare-and-swap `pending → cancelled` that LOSES to the finalizer's `pending → success`** — if extraction finished first, the credit is consumed and the scan becomes a parked unreviewed scan. A modified client cannot flip a completed extraction.

**KTD-5 — Reaper runs sweep-before-count *inside* the RPC (no cron), and the RPC never raises on quota.** Two corrections from review: (a) a user with 3 abandoned `pending` rows would be locked out if the RPC counted first — so it marks this user's >15-min pendings `failed` **before** the count; (b) unlike its 00145 template (which `RAISE EXCEPTION`s on limit — verified `:83-85`), `reserve_receipt_scan` **always inserts the `pending` row and returns `{reservation_id, over_quota boolean}`** — the *service* decides reject-vs-proceed based on `ENTITLEMENTS_ENFORCED`. This is what makes shadow mode coherent: over-quota scans still get a row (payload persistence, resume, count fidelity, bypass telemetry). The extraction finalizer is **idempotent — finalize only from `pending`** (a slow success must not resurrect a reaped/cancelled row or re-grant credit).

**KTD-6 — Union-result errors, not the exception filter.** `gql-exception.filter.ts` only emits 8 fixed HTTP-mapped codes. Mirror the GPX `Success | Error{code}` DTO pattern (`apps/api/src/modules/trips/dto/gpx-export.dto.ts`, service at `apps/api/src/modules/trips/services/trip-gpx-export.service.ts`).

**KTD-7 — Odometer stored raw in the owner's unit; normalize the extracted value by its *printed* unit, not an assumed km.** Verified current reality (canonical-km reverted; highest migration is `00165_revenuecat_lifetime_entitlement`). A US/UK receipt prints miles — extraction captures **`odometerValue` + `odometerUnit`**; the service converts *from the printed unit* into the owner's stored unit. Bound the write (needs-check on implausible deltas; never auto-apply a decrease). Odometer writes go through the existing `UpdateMotorcycle` mutation (`currentMileage` — verified in `bike/[id].tsx:197-203`).

**KTD-8 — Receipt-specific compression profile.** Gallery `compressImage` (1200px/0.7 WebP) is too lossy for invoice text; add `compressReceiptImage` (≥1920px, mild). **`readImageBytes` hardcodes `compressImage` internally (verified `image-upload.ts:44-47`) — parameterize it to accept a compressor.** Server validates JPEG/PNG/**WebP** magic bytes (WebP/RIFF net-new; diagnostics rejects everything but JPEG/PNG).

**KTD-9 — VIN transient, odometer persisted.** `vinOrPlate` stripped before the extraction payload persists to `receipt_scans`. `odometerValue/Unit` persisted (needed for resume) — own-vehicle datum; document rationale.

**KTD-10 — Onboarding first scan quota-exempt at the RPC layer, capped at one per user.** `receipt_scans.is_onboarding`; RPC excludes such rows from the monthly count and skips the limit check **only when the user has zero prior `is_onboarding` rows** (flag is client-supplied; the cap closes the farming hole).

**KTD-11 — Transactional save/undo lives server-side (new, from implementation review).** The save writes 3–4 records (task, linked expense, odometer, photo link); client-orchestrated it would leave partial state on a mid-save app-kill — the exact hole the plan worried about only for undo. So: **`saveReceiptScan(scanId, payload)`** performs all writes in one transaction and records what it wrote on the `receipt_scans` row; **`undoReceiptScanSave(scanId)`** reverses them (odometer revert is a *guarded* compensating write — only if `current_mileage` still equals the scan-applied value; receipts-bucket photo object deleted, not just unlinked). Both union-result, both idempotent. Owned by U7b.

**KTD-12 — Kill switch (new, from implementation review).** `RECEIPT_SCAN_ENABLED` env check in the API (graceful "temporarily unavailable" union error). Cheap insurance given a DB-writing vision model, third-party dependency, and pre-flip unbounded-ish spend.

---

## High-Level Technical Design

Capture-to-save flow and the enforcement split:

```mermaid
sequenceDiagram
    participant M as Mobile (scan-receipt.tsx)
    participant Q as receiptScanQuota (query)
    participant PG as useProGate (RevenueCat/Zustand)
    participant S as Storage (private receipts bucket)
    participant API as receipt-scan module
    participant RPC as reserve_receipt_scan (SECURITY DEFINER)
    participant AI as GPT-4.1 (zodResponseFormat)
    participant DB as receipt_scans / expenses / maintenance_tasks

    M->>Q: fetch used-count (tier-independent)
    M->>PG: requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', count)
    alt over quota & not pro
        PG-->>M: RevenueCat paywall (before camera) — STOP
    else allowed
        M->>M: bike pick, first-scan AI consent
        M->>S: upload {uid}/{scanId}.webp (explicit upload phase, retry, offline-persist)
        M->>API: scanReceipt(scanId)   %% no client path
        API->>RPC: reserve (sweep-before-count; always inserts pending; returns over_quota)
        RPC-->>API: {reservation_id, over_quota}
        alt over_quota AND ENTITLEMENTS_ENFORCED
            API-->>M: Error{SCAN_QUOTA_EXCEEDED} (row marked failed, no credit)
        else proceed (shadow: log paywall_would_have_shown if over_quota)
            API->>S: fetch via admin client (path derived from auth.uid)
            API->>AI: extract (magic-byte validated)
            AI-->>API: structured result | EXTRACTION_FAILED
            API->>DB: persist payload (VIN stripped) → mark success/failed (finalize only from pending)
            API-->>M: Success{result} | Error{code}   %% union result
            M->>M: review card (always-verify amount, needs-check, odometer row)
            M->>API: saveReceiptScan(scanId, payload)  %% one transaction (KTD-11)
        end
    end
```

---

## Output Structure (new surfaces)

```
apps/api/src/modules/receipt-scan/          (new — mirrors diagnostics/; register in app.module.ts)
  receipt-scan.module.ts
  receipt-scan.resolver.ts                  (scanReceipt, cancelReceiptScan, saveReceiptScan,
                                             undoReceiptScanSave, receiptScanQuota, unreviewedReceiptScans)
  receipt-scan.service.ts
  receipt-scan-ai.service.ts
  dto/ (inputs, union results, quota)
  prompts/receipt-extraction.prompt.ts
apps/mobile/src/app/(modals)/scan-receipt.tsx   (new — needs explicit Stack.Screen w/ contentStyle)
apps/mobile/src/features/receipt-scan/          (new — review card, upload phase, hooks)
packages/types/src/validators/receipt-scan.ts   (new — versioned extraction schema)
scripts/receipt-scan-spike/                      (new, throwaway — U1)
supabase/migrations/00166+…                      (new — table, RPC, bucket, R10, CHECKs)
```

---

## Implementation Units

### U1. Extraction spike (GATE — throwaway) — est. 1–2 days

**Goal:** prove ≥80% usable extraction on printed invoices through the *real* compression path before any product code.
**Requirements:** G5, R1 (schema shakeout), Q4 (model choice).
**Dependencies:** none.
**Files:** `scripts/receipt-scan-spike/` *(new, git-ignored samples)*, `RESULTS.md`.
**Approach:** standalone script replicating `compressReceiptImage` (≥1920px mild) → GPT-4.1 **and** GPT-4.1-mini via `zodResponseFormat` with the draft R1 schema. Corpus (≥15, real-world degradation): printed dealer invoice, thermal fuel receipts, faded/glare/crumpled, both decimal formats, ≥1 non-EUR, ≥1 miles-printed odometer (KTD-7 case). Log per-receipt field hit/miss, tokens, cost.
**Execution note:** throwaway; do not ship. Human task (Andrej): photograph receipts into `samples/`.
**Verification:** RESULTS.md exists; **gate decision recorded in the PRD** — proceed / rescope (rescope options: printed-only ship / prompt-tighten + re-spike / model switch or defer). Do not enter U2 on a failed gate without one recorded.

### U2. Migrations & storage foundation — est. 3–4 days

**Goal:** all DB/storage primitives for metering, audit, private storage, and GDPR deletion.
**Requirements:** R1, R2, R5 (bucket discriminator), R10, KTD-1/2/5/9/10, Q5.
**Dependencies:** U1 (schema shape confirmed).
**Files:** `supabase/migrations/00166_*…` *(new; verify next free number — highest is 00165)*, then `pnpm generate:types`.
**Approach:**
1. `receipt_scans`: `id`, `user_id` FK `ON DELETE CASCADE`, `status` CHECK **(`pending|success|failed|cancelled`)**, `extraction_payload jsonb` (VIN stripped in service), `storage_path`, `is_onboarding boolean NOT NULL DEFAULT false`, **`saved_at timestamptz` + `saved_record_refs jsonb`** (what saveReceiptScan wrote — distinguishes success-unreviewed from success-saved; powers resume + home card + undo), `created_at`, `consumed_month`. **RLS on:** own-user SELECT; INSERT/UPDATE service-role only.
2. `reserve_receipt_scan(p_user_id, p_is_onboarding)` SECURITY DEFINER: advisory lock → **sweep this user's >15-min pendings to `failed` (KTD-5)** → count non-failed, non-cancelled rows this UTC calendar month where `is_onboarding=false` → **always insert `pending`, return `{reservation_id, over_quota}`** (deviation from the 00145 template, which RAISEs — see KTD-5; the service maps `over_quota` per flag). Onboarding exemption per KTD-10 cap. EXECUTE to `service_role` only. Service writes `storage_path` onto the row after reservation.
3. Private `receipts` bucket + storage RLS (own `{uid}/` prefix; object-name constraint `{uuid}.webp`). **Orphan reconciliation:** clone the `00152` pattern for `receipts` to sweep pre-reservation orphans (upload happens before the RPC; a rejected/abandoned scan leaves an object with no row). *Execution home:* same mechanism as 00152 runs today (pg_cron/scheduled function — follow the existing wiring, don't invent new infra).
4. **Same PR:** `CREATE OR REPLACE hard_delete_expired_accounts()` (00151 pattern) adding `receipts` to the swept bucket list (R10). *Adjacent pre-existing gap (verified, not this epic):* `maintenance-photos` is also absent from the sweep — file a separate ticket.
5. **`bucket` discriminator column** on `expense_photos` and `maintenance_task_photos` (both store only `storage_path`, no bucket marker — verified), so U7a's resolver can distinguish receipts paths from legacy public ones.
6. Extend CHECKs: `maintenance_tasks.source` (00022:38) + `'receipt_scan'`; `content_generation_log_content_type_check` — **last defined in 00149 §6 with 9 values** (00121 and 00145 both redefined it earlier; DROP/ADD preserving all 9 + `'receipt_scan'`).
**Patterns:** `00145_reserve_ai_generation.sql` (structure only — see the KTD-5 contract deviation); `00150–00153` vault storage/deletion.
**Test harness (named, per review):** DB-level scenarios (RLS, RPC race, reaper, onboarding cap, month boundary) live as **API integration specs in U4's suite** against a branch DB — U2's own verification is migrations apply cleanly + `database.types.ts` regenerated. Storage-policy and R10 scenarios: seeded script against a Supabase branch, committed under the spike scripts dir.
**Test scenarios (executed in U4 unless noted):**
- RLS: user A cannot SELECT user B's rows.
- RPC race: two concurrent reservations, 1 credit → exactly one `over_quota=false`.
- Reaper lockout: 3 pendings >15 min → next reservation sweeps then succeeds.
- Onboarding exemption + cap (2nd onboarding reservation meters normally).
- Month boundary: UTC rollover resets count.
- Storage RLS: cross-uid upload denied; non-`{uuid}.webp` object name denied *(seeded script)*.
- Pre-reservation orphan swept *(seeded script)*.
- R10: hard-delete leaves zero `receipts/{uid}/` objects + zero rows *(seeded script)*.
**Verification:** migrations apply on branch DB; types regenerated and committed.

### U3. Maintenance create-as-completed with costs (R4 gap) — est. 1–2 days

**Goal:** close the verified gap so a maintenance task created *already completed* carries cost and fires the auto-expense.
**Requirements:** R4. *(Q12 resolved 2026-07-18: maintenance stays in v1 — this unit is in scope.)*
**Dependencies:** none (independent backend).
**Files:** `apps/api/src/modules/maintenance-tasks/dto/create-maintenance-task.input.ts`, `maintenance-tasks.service.ts`, `packages/types` (task Zod), spec; `pnpm generate`.
**Approach:** add `cost/partsCost/laborCost/currency` to the input (DB columns exist since 00028; DTO lacks them — verified). In `create()`: persist cost columns **and** `source`; when `status: completed` AND total cost > 0 → call `expensesService.createFromTask`. **The unique-violation swallow lives inside `createFromTask` itself (verified `expenses.service.ts:229-234`); replicate `complete()`'s additional non-blocking try/catch (`maintenance-tasks.service.ts:258-269`).** `createFromTask` signature unchanged (single total, hardcoded `category:'maintenance'`).
**Execution note:** write the failing created-completed-with-cost spec first.
**Test scenarios:** happy (task + exactly one linked expense); cost=0 → no expense; pending+cost → no expense, cost stored; idempotent double-call → one expense; regression: existing paths unchanged, `source` defaults `'user'`.
**Verification:** spec green; zero diff in existing behavior.

### U4. Extraction service (API) — est. 4–5 days

**Goal:** `scanReceipt` + `cancelReceiptScan` + `receiptScanQuota` + `unreviewedReceiptScans`, typed union results, budget/throttle/audit wiring.
**Requirements:** R1, R2 (server), KTD-1/2/4/5/6/9/12, Q6.
**Dependencies:** U2, U1.
**Files:** `apps/api/src/modules/receipt-scan/**` *(new)*, `packages/types/src/validators/receipt-scan.ts` *(new)*, `apps/api/src/config/constants.ts` (throttle preset), **`apps/api/src/app.module.ts` (module registration — verified all modules register explicitly)**, **`apps/api/src/common/guards/resolver-public-mutation-audit.spec.ts` (add `ReceiptScanResolver` to the manual `ALL_RESOLVERS` list — it does NOT auto-discover new resolvers)**, **`apps/api/src/common/guards/ai-throttle-inventory.spec.ts` (add `scanReceipt` to `AI_METHODS` — the repo's money-guard convention)**, integration spec; `pnpm generate`.
**Approach:** `scanReceipt(scanId)`: kill-switch check (`RECEIPT_SCAN_ENABLED`, KTD-12) → strict-UUID validation (`IMAGE_INVALID`) → derive path `{auth.uid()}/{scanId}.webp` → reserve via RPC (`{reservation_id, over_quota}`) → if `over_quota` && `ENTITLEMENTS_ENFORCED` && tier free → mark row `failed`, return `SCAN_QUOTA_EXCEEDED`; else (shadow) log `paywall_would_have_shown` and proceed → fetch via admin client → magic bytes (JPEG/PNG/WebP) → GPT-4.1 `zodResponseFormat` → persist payload (VIN stripped; `odometerValue`+`odometerUnit` per KTD-7) → finalize `pending → success|failed` (idempotent). `cancelReceiptScan(scanId)`: CAS `pending → cancelled` per KTD-4; if already `success`, return "completed — credit consumed" (scan becomes unreviewed). `receiptScanQuota`: **tier-INDEPENDENT raw used-count** (KTD-3). `unreviewedReceiptScans`: rows `status=success AND saved_at IS NULL` (resume + home card). **Progressive reveal is cosmetic** — single request/response; the analyzing screen animates stages over one result (declared here so U6 doesn't invent transport). Union results (`EXTRACTION_FAILED`, `IMAGE_INVALID`, `SCAN_QUOTA_EXCEEDED`, `SCAN_DISABLED`, `ALREADY_COMPLETED`). Throttle `RECEIPT_SCAN` (5/min) via `@Throttle({default: THROTTLE_PRESETS.RECEIPT_SCAN})` + guard. **Committed hard ceiling** (~1,000/mo per subscriber, graceful fair-use error) — the only real ceiling pre-flip. `content_generation_log` writes for budget accounting.
**Patterns:** `diagnostics/diagnostic-ai.service.ts`; `trips/dto/gpx-export.dto.ts` + `trips/services/trip-gpx-export.service.ts`; `entitlements.service.ts`.
**Test scenarios:** the U2-deferred DB set, plus: happy dealer-invoice fixture (<10s mock); unreadable → `EXTRACTION_FAILED`, row `failed`, no credit; out-of-enum category → `other`+needs-check (no 500); malformed model JSON → `EXTRACTION_FAILED`; C1 cross-user path denied; C1 traversal (`/`, `..` in scanId) → `IMAGE_INVALID` pre-derivation; non-image bytes → `IMAGE_INVALID`, no model call, no credit; **quota tier-independence** (3/3 used reported regardless of flag); shadow mode proceeds + logs + row exists; enforce mode rejects; cancel-vs-finalize race both arms (cancel wins → `cancelled`, no credit; finalize wins → `ALREADY_COMPLETED`, credit consumed, unreviewed scan exists); slow-success cannot resurrect a reaped row; kill switch returns `SCAN_DISABLED`.
**Verification:** suite green; both audit specs updated; `pnpm generate` committed.

### U5. Client gating & quota (mobile lib layer) — est. 2 days

**Goal:** launch-live client paywall + quota plumbing + receipt upload helper.
**Requirements:** R2 (client), G4, KTD-3/8.
**Dependencies:** U4, U2.
**Files:** `packages/types/src/constants/limits.ts` (`FREE_TIER_LIMITS` + `PRO_FEATURES` — both live in this one file, verified), `apps/mobile/src/hooks/use-pro-gate.ts` (featureMap), `apps/mobile/src/lib/image-upload.ts`, `apps/mobile/src/lib/query-keys.ts`, `apps/mobile/src/features/receipt-scan/use-receipt-scan-quota.ts` *(new)*, tests.
**Approach:** add `MAX_RECEIPT_SCANS_PER_MONTH: 3` + `UNLIMITED_SCANS: 'unlimited_scans'` + featureMap entry (unmapped keys silently fall back to `'unlimited_bikes'` — verified). **Do NOT touch `packages/types/src/validators/paywall.ts` — verified dead code (nothing imports `PAYWALL_COPY`); attribution flows through `presentPaywall({feature})` analytics; the RC offering is placement-selected (KTD-3 nuance, U11 item).** Count from `receiptScanQuota` used-count; client computes remaining via `FREE_TIER_LIMITS` + RevenueCat `isPro`. `scanId` = client-generated UUID. Add `compressReceiptImage` (≥1920px) + `uploadReceiptPhoto(uri, userId, scanId)` → `receipts/{uid}/{scanId}.webp`; **parameterize `readImageBytes` to accept the compressor (it hardcodes `compressImage` — verified `:44-47`)**.
**Test scenarios:** `checkFeatureAccess` boundary trio; `requireAccess` over-limit fires paywall with `unlimited_scans` (not the fallback); quota hook maps used→remaining; **launch-gate proof:** flag-off + free + 3 used → gate blocks; compression ≥1920px; upload path exact.
**Verification:** unit tests green; paywall opens with scan feature context in a dev build.

### U6. Scan flow screen (mobile) — est. 4–5 days (pre-authorized split seam: "review-later + resume" if it runs long)

**Goal:** capture → upload → analyzing, with failure/offline/resume paths that make the pump hero story real.
**Requirements:** R3, R7, G1, G2, KTD-3/4.
**Dependencies:** U5, U4.
**Files:** `apps/mobile/src/app/(modals)/scan-receipt.tsx` *(new)* + **explicit `Stack.Screen` entry in `(modals)/_layout.tsx` with the garage-layout contentStyle pattern (`backgroundColor: isDark ? palette.neutral900 : palette.neutral50` + `sheetGrabberVisible`/`sheetAllowedDetents`) — the modals layout has NO contentStyle default (verified), unlike the garage stack where add-expense lives**; `apps/mobile/src/features/receipt-scan/**`; `apps/mobile/src/lib/notifications.ts` (**new `NOTIFICATION_KIND`, tap-handler wiring in `app/_layout.tsx:734`, Android channel** — the `snoozeTaskNotification` next-day-9AM primitive is the pattern, verified); i18n keys.
**Approach:** flow per plan sequence. Consent decline → manual entry with bike context (never dead-end). **Offline photo persistence: copy the captured photo from the OS-purgeable camera cache into a durable document directory (expo-file-system) before persisting the pending record; use the MMKV-backed `utils/ride-sync-queue.ts` pattern (retry/backoff, survives app kill — verified strongest precedent).** Analyzing screen: staged labels + progressive reveal as **cosmetic animation over the single mutation response (per U4)**; "Skip — enter manually" from ~3s calls `cancelReceiptScan` — **both race arms handled:** cancel wins → no credit, no resumable scan, manual form (no parsed fields — none exist client-side pre-response); finalize wins → brief "already processed" note, credit consumed, scan appears as unreviewed. **Post-upload quota rejection (stale cache / second device, post-flip): server `SCAN_QUOTA_EXCEEDED` after upload → paywall + "No credit used" + photo retained for manual entry (new scenario from review).** "Review later" parks post-extraction: next-day notification + home priority card count (guaranteed recovery surface when notifications denied). Camera/upload pattern reference: `components/expense-photo-gallery.tsx` (add-expense itself doesn't call `takePhoto` — verified). Glove ergonomics + haptics per PRD. Paywall before camera, co-equal manual escape.
**Execution note:** reservation happens at `scanReceipt` call; consumption at extraction success — assert "no credit until extraction succeeds."
**Test scenarios:** happy handoff; upload failure → retry + "No credit used"; upload timeout; offline capture → durable photo, uploads on reconnect; kill mid-analysis → resumable, no extra credit; permission denied → library + settings link; consent decline; skip both race arms; post-upload quota rejection; review-later + notification + card count (and denied-notifications fallback); paywall-before-camera.
**Verification:** failure/resume scenarios reproducible in dev; no credit consumed on any non-success path.

### U7a. API: photo resolution & linking — est. 2–3 days

**Goal:** mixed public/private photo resolution + C1-safe linking + per-record object deletion.
**Requirements:** R5, KTD-2.
**Dependencies:** U2 (bucket + discriminator). Parallel with U5/U6.
**Files:** `apps/api/src/modules/expenses/expenses.service.ts` (URL builder `:471` **and** the `.from('maintenance-photos')` sign/delete call at `:400`), `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` (`mapPhotoRow` builder `:565` **and** `.from()` at `:514`), photo-link DTOs; `pnpm generate`.
**Approach:** replace hardcoded `/object/public/maintenance-photos/${path}` builders with an async per-photo resolver dispatched on the U2 `bucket` column: legacy → public URL unchanged; `receipts` → short-TTL signed URL via admin client **after asserting `foldername(path)[1] = auth.uid()`**. All `.from()` call sites dispatch on bucket too (sign/delete — review caught these beyond the two builders). Photo-link mutations accept receipts-bucket paths. Deleting a record with a receipts photo **deletes the storage object**, not just the link.
**Test scenarios:** C1: signed-URL request for foreign-uid path refused; galleries return both legacy-public and private-signed URLs; record delete removes the object; legacy behavior byte-identical.
**Verification:** integration green; no change to existing public photos.

### U7b. API: transactional save + undo (KTD-11) — est. 3 days

**Goal:** the compound write/undo pair, server-side.
**Requirements:** R4, R6, KTD-7/11. *(Q12 resolved: maintenance routing in scope for v1.)*
**Dependencies:** U3, U4, U7a.
**Files:** receipt-scan module (new mutations + DTOs), `pnpm generate`.
**Approach:** `saveReceiptScan(scanId, payload)`: one transaction — expense (`logExpense` path) or completed task w/ costs (U3 path) + photo link (U7a) + optional odometer write (convert from printed `odometerUnit` to owner's unit per KTD-7, via the motorcycles table; bound the delta; never a decrease) — then set `saved_at` + `saved_record_refs`. `undoReceiptScanSave(scanId)`: reverse from `saved_record_refs`; odometer revert guarded (only if unchanged since); receipts photo object deleted; idempotent + resumable (mid-undo kill leaves consistent state). Both union-result.
**Test scenarios:** save writes all records atomically (kill-injection leaves nothing partial); undo reverses all; guarded odometer revert skips when concurrently changed; double-undo idempotent; imperial odometer (miles-printed unchanged; km-printed converted — the KTD-7 pair); `current_mileage` null → first-set accepted.
**Verification:** suite green; `saved_record_refs` round-trips.

### U7c. Mobile: review card UI — est. 3–4 days

**Goal:** the confirmation card — no persistence.
**Requirements:** R3, R6 (display), G5, KTD-7 (display).
**Dependencies:** U4 (result shape), U6 (handoff).
**Files:** `apps/mobile/src/features/receipt-scan/review-card.tsx` *(new)*, i18n keys.
**Approach:** type chips (Maintenance/Expense) with live re-map + round-trip state retention; amount always-verify beside tappable full-screen zoomable receipt; **`maxFontSizeMultiplier` is a first use in this codebase (verified zero occurrences) — no precedent to copy, implement fresh**; needs-check = amber + icon + text; no autofocus; bike name prominent; **zero-bike path: prompt to create/select a bike before Save (onboarding users can finish onboarding bike-less — verified `bike-setup.tsx` true-skip)**; odometer promoted row (converted display, hidden when ≤ current unless current is null → "first set"); currency needs-check per Q6.
**Test scenarios:** chip round-trip restores parts/labor; zoomable thumbnail; max Dynamic Type doesn't truncate amount; needs-check renders non-color indicator; zero-bike prompt; odometer row visibility matrix (>, ≤, null).
**Verification:** UI scenarios in dev build; VoiceOver labels present.

### U7d. Mobile: save/undo wiring + duplicate warn + salvage — est. 2 days

**Goal:** wire the card to U7b; the last-mile UX.
**Requirements:** R4, R7, G1/G2.
**Dependencies:** U7a–c.
**Files:** save/undo hooks (inline `useMutation` + `gqlFetcher` + `queryKeys` invalidation — the repo convention; there is no mutation-hooks folder, verified), snackbar + durable undo entry, i18n.
**Approach:** Save → `saveReceiptScan`; post-save "Saved to [bike] — Change/Undo" snackbar with defined timeout **plus durable undo entry on the created record** (outlives the toast); free-user "N left this month" on the success state; duplicate soft-warn (amount+date+vendor query) pre-save, never blocking; partial-salvage → manual form pre-filled + photo attached, no credit.
**Test scenarios:** save-nothing-before-Save; compound undo end-to-end from both snackbar and durable entry; duplicate warn shows and Save proceeds; salvage path.
**Verification:** end-to-end scan→save→undo in dev build.

### U8. Entry points, onboarding & empty states — est. 2–3 days

**Goal:** discovery + activation re-aim (G7), onboarding scan quota-exempt.
**Requirements:** G4, G6, G7, KTD-10.
**Dependencies:** U6, U7d, U5.
**Files:** home + bike-hub actions; onboarding step; empty states (`components/home/onboarding-checklist.tsx`, `priority-action-card.tsx`, `setup-cta-banner.tsx`, `empty-state.tsx` — all verified present); **`stores/checklist.store.ts` persist-migration (the established mechanism for adding a checklist item — verified)**; coach-mark.
**Approach:** "3 free" badge reads `receiptScanQuota` (launch-correct, no flag dependency; **at 0 remaining → upsell cue routing to paywall, not a dead "0 free"** — deliberate supersession of the PRD's "post-flip" badge note). Onboarding step passes `is_onboarding: true` (KTD-10); onboarding scans use the U7c zero-bike path.
**Test scenarios:** onboarding with/without scan; exemption doesn't decrement (ties to U4 test); badge accuracy incl. 0-state; empty-state CTAs carry bike context.
**Verification:** single scan reaches a populated dashboard from onboarding; badge accurate.

### U9. fuel_logs deprecation (R9) — est. 2–3 days

**Goal:** remove `fuel_logs` end-to-end, safely.
**Requirements:** R9.
**Dependencies:** U2 (any time after). **Blocked on Q10.** *(Also creates a migration — re-verify the next free number at start; U2/U9 are parallel, numbers can race.)*
**Files:** migration *(new)*; `apps/api/src/modules/fuel-logs/**`, `fuel-stops/fuel-stops.service.ts` (`getBikeFuelData` `:134-162`), `users/data-export.service.ts` (`:123` `byUserId('fuel_logs')`), `resolver-public-mutation-audit.spec.ts` (remove `FuelLogsResolver`), `app.module.ts:111` (`FuelLogsModule`); **`packages/types/src/validators/fuel-log.ts` + barrel export**; mobile: `add-fuel-log.tsx` (unreachable but **expo-router still auto-registers the file as a route until deleted** — delete it), **3 graphql files** (`fuel-logs.graphql`, `create-fuel-log.graphql`, `delete-fuel-log.graphql`), `queryKeys.fuelLogs` (`query-keys.ts:55`), analytics, i18n ×13, stale CarPlay comment (`carplay-bike-status.ts:2`); `pnpm generate`.
**Approach:** **FK-drop-first order** (drop `expenses.fuel_log_id` FK/column, then trigger `trg_fuel_log_auto_expense`, then table, then the standalone `create_expense_for_fuel_log()` function — `DROP TABLE ... CASCADE` removes the trigger but not the function). *Rationale corrected per review:* pure `DROP TABLE ... CASCADE` drops the FK constraint (rows survive); the cascade only nukes linked expenses if rows are DELETEd/TRUNCATEd first — FK-drop-first stays as the safe-order rule regardless. Fuel-stops: per Q10 (remove badges or re-source); **the real regression assertion is server-side — `getBikeFuelData` falls back to `DEFAULT_KM_PER_LITER` (the mobile `use-primary-bike-fuel-data.ts` reads `MyMotorcyclesDocument` only and already returns constants — verified)**.
**Test scenarios:** migration order preserves linked `fuel` expenses; precheck green, zero references; GDPR export runs; `getBikeFuelData` fallback; demo seeds sensibly.
**Verification:** precheck green; GDPR export runs; Q10 decision applied.

### U10. Telemetry, i18n sweep, polish — est. 2 days

**Goal:** full event set, locale coverage, contrast polish.
**Requirements:** R8, G3 (reporting note), G4.
**Dependencies:** U4–U9.
**Files:** analytics event defs, `apps/mobile/src/i18n/locales/*` (×13), contrast pass.
**Approach:** events per R8 incl. `paywall_would_have_shown`; support-tripwire dashboard note; **G3 dashboard annotation** (not reported until §11 ships). i18n: **the ratchet is `scripts/check-i18n.sh` running `eslint-plugin-i18next/no-literal-string` (jsx-text-only) full-file on changed files — a dedicated script, NOT the repo linter (repo is Biome; verified); it runs in `precheck:push` + CI but NOT plain `pnpm precheck`; clear any pre-existing literal in touched files; placeholders/accessibilityLabel/Alert strings are not auto-flagged — check manually.** New en.json keys mirrored to all locales (`check-i18n-new-keys.ts` enforces).
**Test scenarios:** events fire with props in dev; i18n script clean; contrast visual pass.
**Verification:** events visible; `precheck:push` clean; noon-sim legibility.

### U11. Hardening & release checklist — est. 2–3 days

**Goal:** consolidated test pass + launch gate.
**Requirements:** all (regression), G4 launch dependency, KTD-12.
**Dependencies:** U2–U10.
**Files:** cross-cutting; `apps/api/.env.example` (add `ENTITLEMENTS_ENFORCED`, `RECEIPT_SCAN_ENABLED`).
**Approach:** full never-cut pass: C1 cross-user + traversal, quota race, reaper lockout, RLS, R10 deletion, transactional save/undo, imperial odometer, shadow-mode, cancel races, kill switch. Launch checklist: R10 sweep live; env vars documented (prod `render.yaml` lacks `ENTITLEMENTS_ENFORCED` → defaults false; confirm no dashboard override); consent copy final (Q11); **RevenueCat `unlimited_scans` entitlement + a scan paywall via new placement or explicit `offeringIdentifier` (feature param is analytics-only — verified)**; premium-tier pricing set; **confirm the `process_revenuecat_event` RPC (00165 version) writes `subscription_tier` — the TS handler delegates to it (verified); the old webhook-401 is fixed (`@Public()` + HMAC fail-closed), verify `REVENUECAT_WEBHOOK_SECRET` set in prod**. EAS: no new native deps expected → OTA-able; **release rule from the header holds — no production OTA containing U8 pre-sign-off**.
**Verification:** `pnpm precheck` green; checklist signed off; paywall live in TestFlight.

---

## Sequencing

```
U1 (gate) → U2 → U4 → U5 → U6 ──────────→ U7c → U7d → U8 → U10 → U11
       └→ U3 (parallel after U1) ────────→ U7b ──┘
       └→ U7a (parallel after U2) ──────→ U7b/U7d
       └→ U9 (parallel after U2; needs Q10; re-verify migration number)
```

U7a is pure API and runs parallel with U5/U6. U7b needs U3+U4+U7a. U3 is independent backend and can land any time after U1 (Q12 resolved: maintenance in v1).

---

## Scope Boundaries

**Non-goals (v1, from PRD §3):** line-item table; pending-task reconciliation; fuel consumption stats; in-form scan entry; document-vault routing; batch scan; web support; on-device OCR; device-level abuse prevention; server-side *hard* enforcement at launch.

**Deferred (P1/P2):** VIN→bike auto-match; record re-assignment; image-hash duplicate detection; pending-task reconciliation (v1.1 headline); in-form prefill; full offline queue; line-item schema; email ingestion; fuel-exemption quota tuning (pre-registered fallback).

**Separate epic:** §11 mileage-aware maintenance status (~1–2 wks). **Goal 3 reporting is gated on it.**

---

## Open Questions

> Q-numbering references the origin PRD. Q4/Q5/Q6 cited in units are PRD-resolved constraints.

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q10 | Fuel-stops km/L: remove badges or re-source from ride distance? (Server fallback to `DEFAULT_KM_PER_LITER` is the verified regression point.) | Andrej + Eng | U9 |
| Q11 | AI-consent disclosure copy + privacy-policy update. **Release rule: no production OTA with U8 before final copy.** | Andrej / Legal | U11 + release |
| ~~Q12~~ | **RESOLVED 2026-07-18 (Andrej): maintenance stays in v1 — Path B.** The full dealer-invoice→maintenance loop ships in the first release: U3, U7b, U7c's maintenance half, and KTD-7 are all in scope. No units cut; no PRD amendment (R4/R6 remain P0 in v1). Timeline stays ~6–7 solo eng-weeks. *(Expenses-only-v1 was the review's recommendation; deliberately not taken — the dealer-invoice differentiator ships now.)* | — | — |
| — | Premium-tier pricing + RevenueCat scan paywall (placement/offering — see U11). | Andrej / Business | U11 |
| — | Confirm `REVENUECAT_WEBHOOK_SECRET` in prod + `process_revenuecat_event` (00165) writes tier. | Andrej | global flip (not U-blocking) |

---

## System-Wide Impact & Risks

- **Data-integrity blast radius:** bad auto-writes land in financial/maintenance history. Mitigation: always-verify amount (U7c), `source='receipt_scan'` tagging, transactional save/undo (U7b), post-save amount-edit telemetry.
- **Prompt-injection via adversarial receipt images** into a DB-writing pipeline. Mitigation: server-side sanity bounds independent of the model (implausible odometer deltas → needs-check; amount ceiling; never auto-decrease); the review card is the human circuit-breaker; kill switch (KTD-12).
- **Fair-use abuse (Pro):** U4's committed hard ceiling (~1,000/mo, graceful) is the only real ceiling pre-flip, atop the PRD's alert-only 300/mo.
- **Shared AI infra:** `model-insights` Gemini deprecation (2026-10-16) touches `ai-budget`/throttle — don't refactor concurrently; regression-check `receipt_scan` metering after.
- **Timeline:** ~6–7 solo engineer-weeks U1–U11 (per-unit estimates inline; U7 split exposes the real distribution). Compression to ~4.5 wks: defer U9 → plain staged loader → single entry point → cut odometer **and stop reporting G3**. Never-cut list per Requirements Trace.

---

## Sources & Research

- Origin: `docs/prd-receipt-scan.md` v0.5.
- First grounding: 6-agent PRD review (2026-07-18). Second grounding: 3-agent implementation review (2026-07-18) — key verifications: `00145` RAISEs on limit (`:83-85`, hence the KTD-5 contract deviation); next migration 00166; `content_generation_log` CHECK last defined **00149 §6** (9 values; 00121 *and* 00145 redefined it earlier); GPX union at `trips/dto/gpx-export.dto.ts` + `trips/services/trip-gpx-export.service.ts`; `getGPXQuotaStatus` tier-derived `-1` sentinel (`entitlements.service.ts:37-74`) — KTD-3 trap confirmed; RevenueCat webhook fixed (`@Public()` + HMAC fail-closed) with tier written by the `process_revenuecat_event` RPC (00165), not the TS handler; photo builders at `expenses.service.ts:471`/`maintenance-tasks.service.ts:565` **plus** `.from()` sign/delete sites `:400`/`:514`; `paywall.ts` dead code; `(modals)/_layout.tsx` lacks contentStyle; `snoozeTaskNotification` next-day primitive + `NOTIFICATION_KIND`/channel gaps; `ride-sync-queue.ts` MMKV durable-queue precedent; camera-cache purge risk → durable dir copy; `maxFontSizeMultiplier` zero occurrences; `bike-setup.tsx` true-skip (zero-bike real); i18n ratchet = `scripts/check-i18n.sh` (eslint-plugin-i18next, jsx-text-only, precheck:push + CI only); `use-primary-bike-fuel-data.ts` reads motorcycles only (real R9 regression is server-side); audit specs are manual lists (`ALL_RESOLVERS`, `AI_METHODS`) — new resolver must be added by hand; `hard_delete_expired_accounts` also misses `maintenance-photos` (separate ticket).
