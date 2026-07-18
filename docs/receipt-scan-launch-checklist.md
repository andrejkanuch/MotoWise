# Receipt Scan — Launch Checklist (U11)

Gate before any production OTA that exposes the scan entry points (U8). Derived from
PRD §6/§10 + the plan's never-cut list. Check every box or hold the release.

## Release rule (hard)
- [ ] **No production OTA containing U8's entry points may ship** before this checklist
      is signed off **and** the final Q11 AI-consent copy is in — a placeholder legal
      disclosure must never reach EU users. The entry points are unreachable by users
      until they land in a shipped build, so backend/plumbing can merge to `main` freely.

## Never-cut regression (all have automated coverage — re-run `pnpm precheck`)
- [ ] **C1** cross-user path denied + traversal (`/`, `..` in scanId) → `IMAGE_INVALID` pre-derivation, and signed-URL resolver refuses a foreign-uid path (photo-storage + receipt-scan specs).
- [ ] **Quota race** — two concurrent reservations, 1 credit → exactly one `over_quota=false` (RPC advisory lock; verified live in a rolled-back tx).
- [ ] **Reaper lockout** — 3 abandoned pendings >15 min → next reservation sweeps then succeeds.
- [ ] **`receipt_scans` RLS** — own-user SELECT only; writes service-role + RPC only.
- [ ] **R10 deletion** — `hard_delete_expired_accounts` sweeps the `receipts` bucket (00167, live); zero `receipts/{uid}/` objects after account delete.
- [ ] **Transactional save/undo** — compound save compensates on mid-save failure; undo reverses all incl. guarded odometer revert (receipt-scan specs).
- [ ] **Imperial odometer (KTD-7)** — miles-printed unchanged, km-printed converted; never auto-decrease; first-set when current null.
- [ ] **Shadow vs enforce** — over-quota proceeds + logs `paywall_would_have_shown` while `ENTITLEMENTS_ENFORCED=false`; rejects `SCAN_QUOTA_EXCEEDED` when true.
- [ ] **Cancel races (KTD-4)** — cancel wins → no credit; finalize wins → `ALREADY_COMPLETED`, unreviewed scan.
- [ ] **Kill switch (KTD-12)** — `RECEIPT_SCAN_ENABLED=false` → `SCAN_DISABLED` union error, graceful manual fallback.
- [ ] **Failed/cancelled/timeout scans consume no credit** ("No credit used" shown).

## Environment (verify in prod, not just `.env.example`)
- [ ] `RECEIPT_SCAN_ENABLED` — documented in `apps/api/.env.example`; defaults enabled. Set explicitly in prod if you want the kill switch pre-armed.
- [ ] `ENTITLEMENTS_ENFORCED` — prod `render.yaml` does **not** declare it → defaults `false` (client paywall live regardless). **Confirm no Render-dashboard override** flipped it true before the RevenueCat webhook is verified.
- [ ] `OPENAI_API_KEY` present in prod (Render).
- [ ] Migrations `00166`/`00167`/`00168` applied to prod ✓ (reconciled to numbered versions).

## Monetization / RevenueCat (business-owned)
- [ ] **`unlimited_scans` entitlement + a scan paywall** configured via a **new placement or explicit `offeringIdentifier`** — the `presentPaywall({feature})` param is **analytics-only**; the offering is placement-selected, and `useProGate` passes `placement:'feature_gate'`. Without this the scan paywall shows the generic feature-gate offering.
- [ ] Premium-tier pricing set (blocks paywall copy).
- [ ] **`REVENUECAT_WEBHOOK_SECRET` set in prod**; confirm `process_revenuecat_event` (00165) writes `subscription_tier` — required before the `ENTITLEMENTS_ENFORCED` flip or paying subscribers get gated as free by the server layer. (Webhook 401 is fixed: `@Public()` + HMAC fail-closed.)

## Consent / legal (Q11 — blocks release)
- [ ] Final AI-consent disclosure copy approved by Andrej/Legal (EU third-party processor); privacy-policy updated if required. Current copy in `receiptScan.consent.*` is a **placeholder**.

## Extraction quality (before shipping U8)
- [ ] Re-run the U1 spike over the full ~15-receipt corpus (thermal, faded, US decimals, non-EUR, miles odometer) with the tightened U4 prompt; confirm the ≥80%-on-printed-invoices gate and **record the model choice (GPT-4.1 vs 4.1-mini)** — N=1 provisional PROCEED is recorded, not the full gate.

## Telemetry (feature must be evaluable — R8)
- [ ] PostHog receiving: `receipt_scan_started` → `receipt_scan_completed`/`extraction_failed` → `save_completed{route, ms}` funnel; `paywall_viewed`→convert; `onboarding_scan_completed`; `field_edited`/`type_switched` (Goal 5); `upload_failed`, `scan_resumed{source}`, `nudge_converted`.
- [ ] **G3 (odometer freshness) is NOT reported** until the §11 mileage-aware-status epic ships (annotated on the dashboard).

## Fair-use
- [ ] COGS ≤ $0.01/scan holds (GPT-4.1 ~$0.007); U4 committed hard ceiling (~1,000/mo per subscriber) is the only real pre-flip ceiling atop the alert-only 300/mo soft cap.
