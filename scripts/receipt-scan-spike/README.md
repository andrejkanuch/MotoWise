# Receipt Scan — U1 Extraction Spike (THROWAWAY)

Gate for the receipt-scan epic (`docs/plans/2026-07-18-001-feat-receipt-scan-execution-plan.md`, unit **U1**).
**This code is not shipped** — it exists only to answer one question before any product code:

> Does a real receipt, pushed through the **real mobile compression profile**, extract well enough via GPT-4.1 / GPT-4.1-mini to build on?

**Gate (from the plan/PRD): ≥80% usable extraction on printed invoices.** "Usable" = the money-bearing
core (`amount`, `currency`, `date`) is correct.

## What it does

For every image in `samples/`:
1. Compresses it with `compressReceiptImage` (≥1920px, mild WebP — KTD-8; a `sharp` replica of the
   native mobile profile, **not** the lossy 1200px/0.7 gallery profile).
2. Runs it through **both** `gpt-4.1` and `gpt-4.1-mini` via `zodResponseFormat` with the draft R1
   extraction schema (`schema.ts`), including `odometerValue` + `odometerUnit` per KTD-7.
3. Logs per-field hit/miss, token counts, cost (from `apps/api` `MODEL_COSTS`), and latency.
4. Writes `RESULTS.md` with an aggregate table, the printed-invoice gate calc, and per-receipt detail.

## Corpus (drop into `samples/`, git-ignored)

Ideal is **~15 real receipts** spanning real-world degradation:
- printed dealer invoice ✅ (have one: `invoice-honda-africatwin.*`)
- thermal fuel receipts
- faded / glare / crumpled
- **both** decimal formats: `1.234,56` (EU) and `1,234.56` (US)
- ≥1 non-EUR currency
- ≥1 **miles**-printed odometer (the KTD-7 case)

### Auto-scoring (optional)
Drop `<basename>.truth.json` next to an image with any subset of the scored fields plus optional
`"docType"` (`printed_invoice` | `thermal` | `faded` | `other`). Without a truth file the extracted
values are still dumped for manual scoring. Filename fallback: names starting `invoice`/`printed` are
treated as printed invoices; `thermal`/`fuel` as thermal.

## Run

```bash
# from repo root; OPENAI_API_KEY is auto-read from apps/api/.env if not exported
pnpm tsx scripts/receipt-scan-spike/run.ts
```

Then record the go/no-go decision in `RESULTS.md` **and** in `docs/prd-receipt-scan.md` (Q4 / Phase 0
gate). Do not enter U2 without a recorded decision.

## Files
- `schema.ts` — draft R1 Zod extraction schema (throwaway copy of the future shipped validator)
- `compress.ts` — `compressReceiptImage` replica via `sharp`
- `run.ts` — driver + scorer + RESULTS.md writer
- `samples/` — receipt photos (git-ignored) + `*.truth.json` sidecars (committed)
