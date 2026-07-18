# PRD: Receipt Scan — AI-powered expense & maintenance capture

| | |
|---|---|
| **Status** | Draft v0.5 — three audit agents (Appendix B) + 6-reviewer team review folded in (Appendix C) |
| **Author** | Andrej Kanuch |
| **Date** | 2026-07-18 |
| **Tracking** | TBD (suggested epic: MOT-XXX) |

---

## 1. Problem Statement

Riders accumulate paper receipts — fuel stops, dealer service invoices, parts purchases — and logging them into MotoVault today requires manual data entry. Most receipts never get logged, which degrades the expense dashboard, and new users face an empty-garage activation cliff with no fast path to a populated app. The receipt-photo feature (MOT-143) proves users attach receipts, but the photos are passive — the user still types everything.

**Hero narrative (v0.5 re-aim):** the primary story is **expenses** — immediate value with no dependency: snap a receipt, watch your cost history populate. Maintenance-loop closure (odometer → accurate reminders) is the strategic second act, contingent on the §11 companion epic. Activation is an explicit target: scanning is part of first-run ("add your bike, snap one receipt, watch your dashboard populate").

**Cost of not solving:** incomplete cost history, a steep first-run cliff, and a missed differentiator — no moto app turns a dealer invoice into a completed maintenance record.

## 2. Goals

1. **Reduce time-to-log a receipt from ~90s to <20s** (photo → confirm), via flow-duration telemetry.
2. **Increase expense records created per active user by 30%** within 60 days of launch.
3. **Keep odometer fresh:** ≥50% of scanned dealer receipts result in an accepted odometer update. ⚠️ **Reporting gated on §11:** this goal is *not reported* until the mileage-aware-status epic ships — without it, green telemetry here would decorate a reminder that never fires.
4. **Drive subscription conversion:** ≥3% of unique free users shown the quota paywall convert to paid within 30 days (stretch: 6%). **Clock starts at scan launch** — the paywall is live day one via the existing client-side gating pattern (`useProGate` + RevenueCat, same as `MAX_BIKES`); server-side hard enforcement follows at the `ENTITLEMENTS_ENFORCED` flip (§6).
5. **Extraction quality:** ≥90% of scans require ≤2 field corrections on the review card (edit telemetry).
6. **Habit formation:** ≥40% of first-scanners perform a 2nd scan within 30 days.
7. **Activation:** ≥30% of new users who complete onboarding perform their first scan within 7 days; D7 retention uplift for scan-in-onboarding cohort vs. holdout.

## 3. Non-Goals

1. **Line-item table / per-part records.** Single amount + parts/labor split + attached photo covers the value. (P2.)
2. **Reconciliation with pending maintenance tasks.** v1 always creates a *new* completed task; matching is v1.1, tuned on real scan telemetry.
2b. **Fuel consumption stats (L/100km).** Consequence of fuel_logs deprecation (R9): production data showed zero real users (5 rows, all the App Store review account) vs 81 fuel-category expenses. If consumption returns, it returns as a new feature.
3. **In-form scan entry points.** Cut per UX review; v1.1 re-adds as prefill-only mode (no type chips, no routing).
4. **Document vault routing** (insurance/registration papers). v2.
5. **Batch / multi-receipt scanning.** One receipt per scan in v1.
6. **Web app support.** Mobile-only in v1.
7. **On-device OCR / offline extraction.** Server-side only. (Offline photo *capture* with deferred upload IS in v1 — see R3; extraction still requires connectivity.)
8. **Device-level abuse prevention.** Account re-creation nets ~$0.02/month of free compute; `receipt_scans` audit table enables pattern detection later.
9. **Server-side hard enforcement at launch.** Decided (P1, 2026-07-18; refined after client-gating verification): the scan quota follows the app's existing **two-layer pattern**. Layer 1 (live at launch): client-side gate via `useProGate` + RevenueCat paywall, identical to `MAX_BIKES` / `MAX_AI_DIAGNOSTICS_PER_MONTH` — the paywall is user-visible from day one. Layer 2 (defense-in-depth, dormant): API-side rejection keys off resolved tier and activates at the company-wide `ENTITLEMENTS_ENFORCED` flip — its own program, NOT forced by this epic. Accepted exposure until the flip: a modified client can bypass the quota (same exposure as today's diagnostics limit; ~$0.007/scan; server-side shadow logging detects it).

## 4. User Stories

**New user (activation persona — v0.5)**
- As a new user with an empty garage, I want onboarding to invite me to snap one receipt (quota-exempt) so my dashboard isn't empty on day one.
- As a new user, I want empty states on the expense dashboard and bike hub to offer "Scan a receipt" so I discover the feature when it's most useful.

**Rider (primary persona)**
- As a rider at a fuel pump, I want to photograph the receipt and **defer the review** — even on weak signal, the photo is kept locally and uploads when connectivity returns — so I can pocket my phone and confirm at home.
- As a rider, I want to photograph a dealer service invoice so a completed maintenance record with parts/labor costs is created in my bike's history.
- As a rider, I want to review and correct what the AI extracted before anything is saved, with uncertain fields flagged by icon + text (not color alone), so I trust the records.
- As a rider, I want the amount treated as always-verify — shown against a tappable, zoomable receipt image — so a confidently-wrong total doesn't sail through.
- As a rider, I want my bike's odometer updated from the receipt.
- As a multi-bike owner, I want to pick the bike **before the camera opens**, and see the bike's name on the review card, so records never land on the wrong machine.
- As a rider, I want the receipt photo attached to the created record for warranty claims.
- As an EU rider, I want a one-time disclosure before my first scan that receipt images are processed by a third-party AI provider, so consent is informed.

**Free-tier user**
- As a free user, I want 3 free scans **per month** so the feature stays alive and I can build the habit before deciding to subscribe. *(Launch hypothesis — tuned via exhaustion telemetry; fuel receipts meter like everything else, revisit if exhauster cohort skews low-WTP fuel-heavy.)*
- As a free user who exhausted this month's scans, I want a clear paywall — shown *before* I put effort into framing a photo — with "Enter manually instead" as a **visually co-equal** action, and copy that never implies logging itself costs money ("unlock unlimited scans," never "keep logging").

**Edge / error stories**
- As a rider scanning an unreadable receipt, I want a clear failure message, salvaged fields pre-filled into manual entry, and **no scan credit consumed** ("No credit used" shown on the error state).
- As a rider whose *upload* stalls or fails (weak pump-side signal — the likeliest failure), I want an explicit uploading state with timeout, retry, and "No credit used" — not a spinner that hangs.
- As a rider whose app is killed mid-analysis, I want the scan to survive — "You have an unreviewed scan" on next launch, resumable at no extra cost.
- As a rider who parked a scan for later, I want a next-day nudge (local notification + home priority card with count) so parked scans don't become a silent graveyard.
- As a rider who denied camera permission, I fall back to the photo-library picker plus a settings deep-link.
- As a rider who accidentally scans the same receipt twice, I see a soft warning before save.

## 5. Proposed Solution

**Entry points (v1):** home screen action + bike hub page + **onboarding step & empty-state CTAs** (v0.5 re-aim; first onboarding scan is quota-exempt). Entry affordance carries a quiet "3 free" badge for free users (post-flag-flip). Multi-bike users pick the bike in a one-tap sheet before the camera opens.

**Flow:** [bike pick if multi-bike] → [one-time AI-processing consent on first scan] → camera/photo picker (library fallback) → **explicit upload phase** (progress, timeout, retry; photo persisted locally and re-uploaded on next open if connectivity drops) → analyzing screen → **review card** → Save. "Skip — enter manually" from ~3s; "Review later" parks the scan.

**Analyzing screen:** staged progress labels with progressive field reveal as *confirmed line items* — never editable UI that could vanish. On failure after partial extraction, salvaged fields carry into manual entry. Reveal animation per existing motion rules; VoiceOver announces each stage/field.

**Review card** (formSheet **with explicit `contentStyle` background** — per the app's known dark-modal rendering bug, decided explicitly):
- Type chips: `Maintenance` / `Expense` — AI pre-selects; switching re-maps live without a new AI call; extraction state retained on round-trip.
- Amount-dominant hierarchy; **amount is always-verify**: rendered alongside a tappable thumbnail that opens a full-screen, zoomable receipt view, regardless of confidence (Goal 5 measures edits, not unnoticed errors). Dynamic Type supported (`maxFontSizeMultiplier`; amount shrinks-to-fit, never truncates).
- Bike name displayed prominently on the card.
- Fields editable inline: amount, currency, date, vendor, item name, category; maintenance adds parts/labor.
- **Needs-check state = amber + icon + short text cue** ("check amount") — never color alone (WCAG 1.4.1).
- **Odometer promoted row:** "Odometer 36,800 → 37,505 km", default on, only when extracted > current (unit-converted, R6).
- Photo thumbnail with remove affordance (no checkbox).
- Currency: never silently coerced (Q6).
- Save → routes to existing mutations. Post-save: "Saved to [bike] — Change" undo; the undo performs a **compound rollback** (created records deleted, odometer reverted, photo link removed). Record re-assignment from detail screens is P1. Free users see "2 free scans left this month" here (post-flip).

**Routing rules:**

| Receipt signal | Route | Created record |
|---|---|---|
| Fuel purchase | Expense | `logExpense` category `fuel`; litres / €-per-litre appended to description when extracted |
| Service/repair invoice | Maintenance | Task created as completed w/ cost, partsCost, laborCost (+ auto maintenance expense) |
| Everything else | Expense | `logExpense` with AI-suggested category + itemName |

**Glove-mode ergonomics:** shutter, "Review later," Save = full-width bottom-zone targets ≥48pt; distinct haptics for captured / extraction-done / saved; decision-bearing text at top of contrast scale (noon-sunlight flow).

## 6. Freemium & Paywall

- **3 free scans per calendar month** (server-side reset). All scan types meter equally — **launch hypothesis**: if exhaustion telemetry shows the exhauster cohort dominated by high-frequency fuel receipts (adverse selection vs Goal 4), revisit fuel exemption or raise to 5/month. First onboarding scan is quota-exempt.
- **Consumption is server-decided from the extraction outcome** — never from any client-reported signal (a modified client must not be able to scan free forever). Credits consumed on successful extraction (review card reached or scan parked); failures, cancellations, upload timeouts: free — and the error UI says "No credit used."
- **Pending-reservation reaper (required):** pending reservations older than N minutes (suggest 15) are marked `failed` and release the credit — otherwise a timed-out or app-killed scan silently burns 1 of 3 monthly credits, contradicting "timeouts are free."
- **Paywall fires on tap of the scan entry point** — before camera. "Enter manually instead" is a **co-equal button**, deep-linking to add-expense with bike context. Copy sells "unlimited scans," never implies logging costs money.
- Paywall sells the **existing premium tier** with unlimited scans as headline feature — no standalone SKU.
- **Enforcement — two layers (P1 decision, refined 2026-07-18 after verifying how existing gates work):**
  - **Layer 1, client (live at launch):** add `MAX_RECEIPT_SCANS_PER_MONTH: 3` to `FREE_TIER_LIMITS` in `@motovault/types`; gate the scan entry with `requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', count)` → RevenueCat paywall, identical to `MAX_BIKES`. `isPro` comes from the RevenueCat SDK client-side — **no dependency on `ENTITLEMENTS_ENFORCED`**, paywall works day one. The count comes from the server's `receiptScanQuota` query (client-side monthly counting would drift), so the reservation RPC + reaper run from day one regardless.
  - **Layer 2, server (dormant until flag flip):** API-side `SCAN_QUOTA_EXCEEDED` rejection keys off resolved tier; activates with the company-wide `ENTITLEMENTS_ENFORCED` program (own staged launch, out of scope here). Until then the server logs `paywall_would_have_shown` when quota is exceeded anyway — now a **bypass-detection** signal rather than the only paywall. Accepted interim exposure: modified clients can over-scan (~$0.007/scan; same class as today's diagnostics limit).
  - Env reality (verified 2026-07-18): local dev `.env` has `true`; **prod `render.yaml` does not declare the flag → defaults `false`** (confirm no Render-dashboard override); add the flag to `.env.example`. Monetization plan item D-3 ("no ticket owns the flip") remains unowned.
- **Flip prerequisite (from Backend Audit 2026-06-09):** the RevenueCat → entitlement webhook sync was dead (401s). Must be verified fixed before any flip, or paying subscribers get gated as free by the *server* layer. (Client layer is unaffected — it reads RevenueCat directly.) Launch-checklist item.
- **Guardrails:** COGS ≤ $0.01/scan (GPT-4.1 verified $2/$8 per M → ~$0.007; 4.1-mini ~$0.0015 if Phase 0 shows parity). Fair-use soft cap 300 scans/mo per subscriber, alert-only, via `ai-budget`.
- **Support tripwire (§8):** track 1-star reviews / refund requests / support tickets mentioning scans or the paywall — the failure mode "logging always free" exists to prevent.

## 7. Requirements

### P0 — Must-Have

**R1. Receipt extraction service (API)**
New `receipt-scan` module following the diagnostics vision pattern (GPT-4.1 + `zodResponseFormat`), **storage-first** (Q1: default body-parser ~100 KB ceiling makes base64-through-GraphQL unviable; latent diagnostics bug filed separately). Client uploads compressed photo to the **private `receipts` bucket** (Q5) at `{uid}/{scanId}.webp`; mutation passes only the `scanId` — **the server derives the storage path from the authenticated uid; client-supplied paths are never accepted** (C1). Service fetches via admin client and calls the model.
- Zod schema (versioned): `{ type: 'maintenance'|'expense', confidence per field, amount, currency, date, vendor?, itemName?, category?, partsCost?, laborCost?, odometerKm?, fuelLitres?, vinOrPlate?, partsNeeded?: string[] }`
- **PII minimization at persist:** `vinOrPlate` is used transiently (P1 bike-match) and **stripped before the extraction payload is persisted** to `receipt_scans` (resolves the VIN contradiction). `odometerKm` IS persisted — required for resume — with the rationale documented (own-vehicle datum, not third-party PII).
- **Category auto-assignment:** `category` constrained to the exact 14-value `EXPENSE_CATEGORIES` enum (Zod-validated); out-of-enum → `other` + needs-check. Maintenance fills `title`, parts/labor split, `partsNeeded[]`.
- Receipt-specific compression profile (≥1920px, mild); server validates JPEG/PNG/WebP magic bytes (WebP/RIFF is net-new).
- AI budget integration: extend the `content_generation_log` `content_type` CHECK — **constraint lives in 00121/00149, not 00145** (corrected per team review). New `RECEIPT_SCAN` throttle preset (5/min).
- *Acceptance:* legible dealer invoice → typed result <10s p90; unreadable → typed `EXTRACTION_FAILED` result, no credit consumed; **user A cannot obtain a signed URL or extraction for a path under user B's prefix (test required)**.

**R2. Scan quota + paywall enforcement (API + mobile)**
- **`receipt_scans` table** (audit + status: pending/success/failed + resume payload) with **RLS enabled** (own-user SELECT; inserts via service role only; `user_id` FK `ON DELETE CASCADE`) and a `reserve_receipt_scan` SECURITY DEFINER RPC cloned from 00145 (advisory lock, count non-failed rows in current month, insert pending). Race-safe by construction.
- **Reaper:** pending rows older than 15 min → `failed` (pg_cron or lazy sweep on next reservation).
- Consumption server-decided (see §6).
- Quota errors returned via the **union-result pattern (`Success | Error { code }`) used by the GPX quota flow — NOT the exception filter** (corrected: `gql-exception.filter.ts` emits only 8 fixed HTTP-mapped codes).
- `receiptScanQuota` query mirrors `getGPXQuotaStatus`.
- *Acceptance:* exhausted free user → RevenueCat paywall before camera (client layer, from launch); post-flip, API additionally rejects a direct over-quota call; two concurrent scans with 1 credit → exactly one succeeds; abandoned pending scan → credit restored ≤15 min.

**R3. Scan flow + review card (mobile)**
Route `scan-receipt.tsx` in `(modals)` (formSheet + explicit `contentStyle` background): bike pre-pick, first-scan AI consent disclosure, capture with permission fallback, **explicit upload phase** (progress/timeout/retry; local photo persistence with deferred upload on reconnect — minimal-offline pulled into v1 so the pump hero story functions), analyzing state, review card per §5, "Review later" parking with **next-day local notification + home priority card (count)**.
- *Acceptance:* type switch re-maps without new AI call, round-trip restores fields; nothing persists before Save; killed app mid-analysis → resumable, no extra credit; airplane-mode capture → photo survives, uploads on reconnect, no credit consumed until extraction succeeds.

**R4. Routing to existing mutations (API + mobile)**
Save dispatches to `logExpense` or maintenance-task creation. Verified gap: create-as-completed carries no costs and never fires the auto-expense (`createFromTask` fires only from `complete()`) — extend `CreateMaintenanceTaskInput` + `create()` with `cost/partsCost/laborCost/currency`, invoking `createFromTask` when created completed with cost. Migration: extend `maintenance_tasks.source` CHECK with `'receipt_scan'`.
- *Acceptance:* maintenance save with cost → exactly one task AND one linked expense; fuel receipt → one `fuel` expense; duplicate soft-warn on amount+date(+vendor) match; post-save undo performs full compound rollback.

**R5. Photo attachment**
Scanned image linked via `expense_photos` / `maintenance_task_photos` (`storage_path` free-text) — no re-upload. **Authorization (C1):** `publicUrl`/signed-URL resolvers must verify `storage.foldername(path)[1] = auth.uid()` (or equivalent server-side ownership check) before minting signed URLs — the admin client bypasses storage RLS, so path validation is the only guard. **Mixed public/private resolution:** legacy paths in the public bucket resolve as today; `receipts/`-bucket paths resolve via signed URLs only. Spelled out to avoid the footgun.

**R6. Odometer side effect**
Promoted row per §5. **Unit conversion mandatory:** `current_mileage` stored in owner's measurement system — convert extracted km before comparison and write (verified: canonical-km work was reverted; raw storage is current reality).
- *Acceptance:* imperial user → comparison and write in miles; extracted < current → row hidden.

**R7. Failure, degradation & resume UX**
Typed failure → error + "No credit used" + manual entry with salvaged fields and photo attached. Upload failure → explicit state with retry. Permission denied → library fallback. Unreviewed scans resumable + nudged (R3).

**R8. Telemetry**
Events: scan_started, upload_failed/retried, extraction_succeeded/failed, field_edited, type_switched, save_completed (route), review_later_used, review_later_nudge_converted, scan_resumed, paywall_shown, **paywall_would_have_shown (shadow mode)**, paywall_converted, odometer_accepted, manual_fallback_used, onboarding_scan_completed + flow duration. Plus the §6 support tripwire.

**R9. Deprecate `fuel_logs` (in-scope; corrected scope per team review)**
Production: 5 rows, all the App Store review account.
- **Migration order (hard requirement):** drop `expenses.fuel_log_id` FK/column **first** (it's `ON DELETE CASCADE` — dropping the table first would cascade-delete the 5 linked expenses), then drop the trigger and table.
- **API:** remove `fuel-logs` module; **also** `fuel-stops/fuel-stops.service.ts:134-162` (computes km/L range badges from fuel_logs — will throw on missing table), **`users/data-export.service.ts`** (GDPR export queries fuel_logs — a compliance path), and `resolver-public-mutation-audit.spec.ts` expectations. `pnpm generate`.
- **Mobile:** remove `add-fuel-log.tsx` (verified: already an unreachable orphan — not registered in layout, zero nav entries), `fuel-logs.graphql`, `queryKeys.fuelLogs`, analytics events, i18n strings. CarPlay: fuel already removed — only a stale header comment to delete.
- `fuel` expense category untouched.
- *Acceptance:* `pnpm precheck` green with zero fuel-log references; GDPR data export runs; fuel-stops range badges removed or re-sourced; demo account seeds sensibly; existing fuel expenses render unchanged.

**R10. GDPR deletion coverage (C2 — new)**
`hard_delete_expired_accounts()` (00151) sweeps a hardcoded bucket list that will not include `receipts` — the most PII-dense images in the app would orphan forever (Art. 17 violation). **Ship a 00151-style `CREATE OR REPLACE` adding `receipts` in the same PR that creates the bucket.** Launch-checklist item + acceptance test: deleted account leaves zero objects under `receipts/{uid}/`.

### P1 — Nice-to-Have (fast follows)

- VIN/plate → bike auto-match (transient use only, never persisted).
- Record re-assignment (move expense/task to another bike from detail screen).
- Duplicate detection via image hash.
- **Pending-task reconciliation (v1.1 headline):** three-outcome matcher.
- In-form scan re-entry as prefill-only mode.
- Full offline queue (beyond v1's minimal deferred upload).

### P2 — Future Considerations

- Line-item schema (extraction schema versioned for it).
- Document vault routing; batch scanning; email-forwarding ingestion.
- Quota-window changes (pluggable; fuel exemption is the first candidate if telemetry demands).

## 8. Success Metrics

**Leading (2–4 weeks):**
- Scan adoption ≥25% of WAU in 30 days; **onboarding scan completion ≥30% of new users** (Goal 7).
- Extraction success ≥85%; median fields edited ≤1; type-switch ≤15%.
- Time-to-log <20s p50; upload-failure rate at first attempt (pump-signal reality check).
- Repeat-scan rate ≥40% ≤30d; exhaustion rate + median time-to-exhaust (post-flip).
- Review-later park rate + next-day nudge conversion (graveyard check).

**Lagging (quarter):**
- +30% expense records per active user; D30 retention scanning vs non-scanning cohort; **D7 retention onboarding-scan cohort vs holdout**.
- Odometer freshness −40% days-since-update — **reported only after §11 ships** (Goal 3 gate).
- Paywall funnel (post-flip): unique exhausted users → paid ≤30d ≥3% (stretch 6%); view-rate tracked separately per-user.
- Exhaustion → outcome timing; post-paywall manual-entry continuation rate; scans/subscriber/month (p50+p95); actual cost/scan.
- **Support tripwire:** 1-star reviews / refunds / tickets mentioning scan or paywall (target: ~0; any spike = copy/quota review).

## 9. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| ~~Q1~~ | **Resolved: storage-first** (body-parser ~100 KB ceiling; photo persists anyway). | — | — |
| ~~Q2~~ | **Resolved: `receipt_scans` table + reservation RPC + RLS + reaper.** | — | — |
| ~~Q3~~ | **Resolved: existing premium tier, scans as headline; no scan SKU.** Tier pricing still owned by business. | Andrej | Copy only |
| ~~Q4~~ | **Resolved: GPT-4.1 primary** (~$0.007/scan, verified 2026-07); Phase 0 evals 4.1-mini (~$0.0015) side-by-side. **Not Gemini 2.5 Flash — deprecated 2026-10-16.** ⚠️ `model-insights` depends on it and needs migration regardless (separate ticket). | — | — |
| ~~Q5~~ | **Resolved: private `receipts` bucket day one** + data minimization (vendor name only; VIN stripped at persist) + R10 deletion coverage. Pending GDPR-posture sanity check. | — | — |
| ~~Q6~~ | **Resolved:** validated currency set (user + 14 ISO codes); needs-check fallback; no FX; both decimal formats in Phase 0. | — | — |
| ~~Q8~~ | **Resolved (refined): two-layer enforcement.** Client gate (`useProGate` + RevenueCat + `FREE_TIER_LIMITS`) live at launch → paywall visible day one, Goal 4 clock starts at scan launch. Server hard-rejection dormant until the `ENTITLEMENTS_ENFORCED` program flips (own launch, out of scope). | — | — |
| ~~Q9~~ | **Resolved 2026-07-18:** pricing verified; ≤$0.01/scan guardrail holds. | — | — |
| Q10 | Fuel-stops range badges (km/L) lose their data source with R9 — remove the badges, or re-source from ride distance estimates? | Andrej + Engineering | Yes (small, R9) |
| Q11 | AI-consent disclosure copy + whether it needs privacy-policy update (EU market, third-party processor). | Andrej / Legal | Before launch |

## 10. Timeline & Phasing

*(v0.5 revision per team review: honest v1 is **~6–7 solo engineer-weeks** — the 4.5–5.5 estimate + ~1–1.5 wks of security/GDPR-critical work that was missing (C1 authz + tests, R10 deletion, reaper, receipt_scans RLS, mixed URL resolution) + ~2–3 days onboarding re-aim. R9 is net ~a wash: smaller than believed in two places — CarPlay already clean, orphaned screen — larger in three consumers (C4).)*

| Phase | Scope | Est. |
|---|---|---|
| **Phase 0 — extraction spike** | 10–15 real receipts (incl. thermal) through GPT-4.1 **and** GPT-4.1-mini via the actual mobile compression path; both decimal formats; token/cost logging. **Gate: ≥80% usable extraction on printed invoices.** **Decision 2026-07-18 — provisional PROCEED** (below). | 1–2 days |
| **v1** | R1–R10 + onboarding integration | ~6–7 wks |
| **v1.1** | Pending-task reconciliation, VIN bike-match, record re-assignment, in-form prefill, full offline queue | +2–3 wks |
| **v2** | Document vault routing, batch scan, line items | later |

### Phase 0 gate decision — provisional PROCEED (2026-07-18)

**Decision:** PROCEED to v1 build (U2+). **Model choice NOT locked** — re-decide on the full corpus with the tightened U4 prompt. (Q4's "GPT-4.1 primary" is not yet earned by data: on the one real sample GPT-4.1-mini scored *higher* at ⅓ the cost. Both stay under the ≤$0.01/scan guardrail.)

**Basis — one real printed invoice actually run** (`scripts/receipt-scan-spike/RESULTS.md`; harness replicates the real `compressReceiptImage` ≥1920px-mild path, both models via `zodResponseFormat`, `odometerValue`+`odometerUnit` per KTD-7):
- ✅ **Money core reliable on BOTH models** — amount `241.46`, EUR, type=maintenance, category, parts `110.45` / labor `89.10` all correct. The feature's value lands.
- ⚠️ GPT-4.1-mini `usable=✅` / GPT-4.1 `usable=❌` on this sample (N=1 — not a model verdict).
- ❌ Three **prompt-addressable** failure modes to encode in the U4 prompt/schema: (1) **date-field disambiguation** — GPT-4.1 grabbed *Fecha Venta* (2022 bike-sale date) not the invoice date; (2) **EU thousands-separator odometer** — GPT-4.1 read `37.505` as `37.505` not `37505` (KTD-7/Q6 hazard, now empirically confirmed); (3) **vendor=seller not customer** — both returned the addressee. Minor: `fuelLitres` came back `0` not `null`.

**Standing risk / owner-accepted:** N=1 is a smoke test, not the ≥80%-across-printed-invoices gate; v1 product code (U2+) proceeds ahead of the full empirical gate. **Before U8 entry points ship:** run the ~15-receipt corpus (thermal, faded, US decimals `1,234.56`, non-EUR, miles odometer) with the tightened prompt and re-record model choice + confirmed gate. Fallbacks remain open (printed-only ship / prompt-tighten + re-spike / model switch or defer).

**If compressed to ~4.5 wks, cut in order:** (1) defer R9 to fast-follow (unused table is harmless — but keep the Q10 decision), (2) progressive-reveal → plain staged loader, (3) one entry point (bike hub) + onboarding, (4) odometer side effect → v1.1 **and stop reporting Goal 3 entirely** (with §11 also unshipped, its telemetry would be decorative).
**Never cut:** reservation RPC + reaper, `receipt_scans` RLS, **C1 path-ownership check + its test**, **R10 deletion coverage**, typed errors (union-result), failed-scan-is-free, resume-unreviewed-scan.

**Dependencies:** premium-tier pricing blocks paywall copy. **Launch checklist:** private bucket + R10 sweep in same PR; Q11 consent copy; paywall goes live only with the (separate) `ENTITLEMENTS_ENFORCED` program. No external teams.

---

## 11. Companion work item — Mileage-aware maintenance status (separate epic, strongly recommended)

**Finding (verified, with one correction from team review):** `due_date` and `target_mileage` coexist as independent optional fields everywhere (screens, OEM generation, recurring). But reminder/status logic is date-driven at every named surface: local notifications, server push cron (exact `due_date` match), bike-hub overdue badges, home priority list, health score, NextServiceDue — none compare `target_mileage` to the odometer. Mileage-only tasks get no reminder and are excluded from the home list; OEM schedules with only `interval_km` generate invisible tasks. *Correction: the CarPlay heads-up row DOES already compare `mileage >= targetMileage` — the pattern to generalize exists in-app.*

**Consequence:** the odometer side effect (R6, Goal 3) improves display only until this ships. Scope:

1. **Status engine:** `overdue` when odometer ≥ target (unit-aware) OR date-overdue; `due soon` within threshold (500 km / 7 days), applied consistently (bike hub, home, health score, NextServiceDue) — generalizing the CarPlay comparison.
2. **Mileage-triggered reminders:** evaluated on every odometer write (manual, receipt scan) — "You're 300 km from 'Revision 40.000 km'".
3. **"Whichever comes first"** semantics for dual-field tasks (the recurring UI already promises this; the code doesn't deliver).

~1–2 wks, own epic. **Goal 3 reporting is gated on it** (§2).

---

## Appendix A — Existing primitives this builds on

- Vision AI + Zod structured output: `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts`
- AI budget, reservation RPC, throttles: `ai-budget/`, `00145_reserve_ai_generation.sql`, `config/constants.ts` (content_type CHECK: **00121/00149**)
- Entitlements/gating: `entitlements/` (`GATING_MATRIX`, `QuotaStatus`, union-result error pattern), `user_gating_events` (00101/00102)
- Camera/upload: `apps/mobile/src/lib/image-upload.ts`
- Receipt photos (MOT-143): `expense_photos` (00076), `ExpensePhotoGallery`
- Unified ledger: `expenses` + auto-link from completed tasks (`createFromTask`); fuel-log trigger (00081) removed by R9
- Maintenance cost columns (00028); categories v2 + `item_name` (00154)
- Private-storage + deletion: documents vault (00150–00153), `hard_delete_expired_accounts()` (00151 — extend for `receipts`, R10)
- Subscription fields: defined **00021** (00141 adds column-level read grants); tier resolution in `GqlAuthGuard`

## Appendix B — First-round audit summary (v0.2 → v0.4)

**Engineering:** R4 unbuildable as assumed (no costs on create; auto-expense only from complete) → scoped; base64 100 KB ceiling → storage-first; compression profile too lossy → receipt profile; racy quota → reservation RPC; odometer units → R6; public bucket → Q5; +2 CHECK migrations, 13-locale i18n, typed errors, throttle preset, RevenueCat; estimate 3–4 → 4.5–5.5 wks.
**UX:** resume mechanism; bike pick before camera; in-form entry cut; paywall before camera; meter to post-save; "3 free" badge; streaming-failure choreography; photo checkbox deleted; odometer promoted; needs-check states; no autofocus; permission fallback; duplicate warn; "Review later" P0 + glove/haptic specs.
**Monetization:** 3 lifetime → 3/month; funnel fixed to exhausters (3%/6%); premium-tier bundle; ~$0.01/scan guardrail + 300/mo soft cap; habit/exhaustion/continuation metrics added.
**Fuel_logs decision (v0.4):** 5 rows, all demo account → deprecate (R9); consumption stats dropped (Non-Goal 2b).
**Q4–Q9 resolutions (v0.4):** GPT-4.1 primary (Gemini 2.5 Flash deprecating 2026-10-16 — model-insights migration ticket); private bucket + minimization; currency set; tier-keyed quota; pricing verified.

## Appendix C — Team review response (v0.5, 6 reviewers)

**Critical, all accepted:**
- **C1 (cross-user PII read):** photo-link tables validate ownership of the *row*, not the *path*; admin-minted signed URLs bypass storage RLS → server-derived paths only + ownership assertion + required test (R1/R5, never-cut).
- **C2 (GDPR deletion gap):** `receipts` bucket absent from the hard-delete sweep → R10, same-PR requirement.
- **C3/P1 (entitlements blast radius):** decision = **wait for the global flip** for *server-side* enforcement; scan never forces it. Refined post-review: the client-side gating layer (`useProGate` + RevenueCat, verified as how `MAX_BIKES` works today) makes the paywall live at scan launch with zero blast radius — Goal 4 is measurable day one after all.
- **C4 (R9 under-scope):** fuel-stops service, GDPR data-export, mutation-audit spec added; FK-drop-first order made a hard requirement; CarPlay/orphan-screen corrections applied.
- **Reaper + receipt_scans RLS + server-decided consumption:** added to R2/§6, never-cut.

**Corrections applied:** exception filter → union-result pattern (R2); content_type CHECK 00121/00149; subscription fields 00021; §11 CarPlay heads-up exception noted.

**Product decisions (Andrej, 2026-07-18):** P1 → wait for global flip. P2 → meter everything at 3/month as launch hypothesis (fuel exemption is the pre-registered fallback if exhauster telemetry shows fuel-heavy adverse selection). Re-aim → accepted: onboarding scan-to-populate (quota-exempt) + expense-first hero narrative + Goal 7.

**P3 conditions accepted:** paywall copy rules, co-equal manual button, support tripwire metric.

**UX gaps folded in:** upload-failure state (B1); minimal offline photo-persist in v1 (B2 — hero story must function at a pump); always-verify amount + zoomable receipt (B3); icon+text needs-check (M1); Dynamic Type (M2); review-later nudges (M3); compound-rollback undo + bike name on card, re-assignment P1 (M4); onboarding/empty-state discovery (M5); AI consent disclosure (M6, Q11).

**Contradictions resolved:** VIN stripped at persist, odometer retained with rationale; consumption server-decided; reaper specified; formSheet + explicit contentStyle; mixed public/private URL resolution spelled out (R5).

**Timeline:** 4.5–5.5 → **6–7 solo engineer-weeks**; cut-order updated (odometer cut also kills Goal 3 reporting; security items never-cut).
