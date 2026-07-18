/**
 * U1 extraction spike (THROWAWAY — do not ship).
 *
 * Runs every image in `samples/` through the receipt compression profile
 * (compressReceiptImage, ≥1920px mild — KTD-8) and then through BOTH GPT-4.1 and
 * GPT-4.1-mini via `zodResponseFormat` with the draft R1 extraction schema
 * (odometerValue + odometerUnit per KTD-7). Logs per-receipt field hit/miss,
 * token counts, and cost, and writes RESULTS.md.
 *
 * Uses the same OpenAI provider + AI_MODELS + MODEL_COSTS pattern as
 * `apps/api/src/modules/diagnostics` (CLAUDE.md standing rule).
 *
 * Ground truth (optional, enables auto-scoring): drop `<basename>.truth.json`
 * next to an image with any subset of the scored fields, plus an optional
 * `"docType"`. Without it, extracted values are still dumped for manual scoring.
 *
 *   docType values: "printed_invoice" | "thermal" | "faded" | "other"
 *   Filename fallback: names starting `invoice`/`printed` ⇒ printed_invoice.
 *
 * Run:  cd scripts/receipt-scan-spike && pnpm i && pnpm start
 *   (or from repo root, with OPENAI_API_KEY exported: pnpm tsx scripts/receipt-scan-spike/run.ts)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { MODEL_COSTS } from '../../apps/api/src/config/constants';
import { compressReceiptImage } from './compress';
import { RECEIPT_SCAN_SCHEMA_VERSION, ReceiptExtractionSchema, SCORED_FIELDS } from './schema';
import type { ReceiptExtraction, ScoredField } from './schema';

const SAMPLES_DIR = join(__dirname, 'samples');
const RESULTS_PATH = join(__dirname, 'RESULTS.md');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

/** Models under evaluation — the AI_MODELS.DIAGNOSTIC pattern (gpt-4.1) plus its mini sibling. */
const MODELS = ['gpt-4.1', 'gpt-4.1-mini'] as const;
type Model = (typeof MODELS)[number];

const SYSTEM_PROMPT = [
  'You are an expert at reading motorcycle-related receipts and service invoices from any country.',
  'Extract structured data from the receipt image. Follow these rules exactly:',
  '- `amount` is the GRAND TOTAL actually paid (tax included), not a subtotal.',
  '- Numbers may use either decimal convention: "1.234,56" (EU) or "1,234.56" (US). Interpret the thousands/decimal separators correctly and return a plain number (e.g. 1234.56).',
  '- `currency` is the ISO 4217 code (EUR, USD, GBP, …). If a € / $ / £ symbol is shown, map it. Null if genuinely absent.',
  '- `date` is ISO 8601 (YYYY-MM-DD). Convert DD/MM/YYYY or MM/DD/YYYY using surrounding context.',
  '- `type` is "maintenance" for a service/repair/workshop invoice, otherwise "expense".',
  '- `category` MUST be one of the allowed enum values; pick the closest. Use "fuel" for fuel purchases, "maintenance" for service labour, "parts" for parts.',
  '- Odometer: capture `odometerValue` as the printed number and `odometerUnit` as the PRINTED unit ("km" or "mi"). Never assume km. Watch for "Kmts"/"km"/"miles"/"mi".',
  '- For a service invoice, split `partsCost` (materials) and `laborCost` (labour / "mano de obra" / "M.O.") when both are shown.',
  '- `vinOrPlate`: VIN/chassis (bastidor) or licence plate (matrícula) if present.',
  '- `fieldConfidence`: your genuine 0–1 confidence per field. Be honest — low confidence on anything hard to read.',
  '- Null out any field you cannot read with reasonable confidence rather than guessing.',
].join('\n');

interface TruthFile {
  docType?: string;
  [k: string]: unknown;
}

interface ModelRun {
  model: Model;
  ok: boolean;
  error?: string;
  refusal?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  extraction?: ReceiptExtraction;
  /** field → 'hit' | 'miss' | 'na' (no truth for this field) */
  scores: Partial<Record<ScoredField, 'hit' | 'miss' | 'na'>>;
  usable: boolean;
}

interface SampleResult {
  file: string;
  docType: string;
  compressedBytes: number;
  dimensions: string;
  hasTruth: boolean;
  runs: ModelRun[];
}

function loadEnv(): void {
  if (process.env.OPENAI_API_KEY) return;
  const apiEnv = join(__dirname, '../../apps/api/.env');
  if (!existsSync(apiEnv)) return;
  for (const line of readFileSync(apiEnv, 'utf8').split('\n')) {
    const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) {
      process.env.OPENAI_API_KEY = m[1].replace(/^["']|["']$/g, '');
      break;
    }
  }
}

function inferDocType(file: string, truth: TruthFile | null): string {
  if (truth?.docType) return truth.docType;
  const stem = basename(file).toLowerCase();
  if (stem.startsWith('invoice') || stem.startsWith('printed')) return 'printed_invoice';
  if (stem.startsWith('thermal') || stem.startsWith('fuel')) return 'thermal';
  return 'other';
}

function costUsd(model: Model, inputTokens: number, outputTokens: number): number {
  const { inputUsdPerMTok, outputUsdPerMTok } = MODEL_COSTS[model];
  return (inputTokens * inputUsdPerMTok + outputTokens * outputUsdPerMTok) / 1_000_000;
}

/** Loose equality tuned per field: numbers within 1% or 0.01; strings case/space-insensitive substring. */
function fieldMatches(field: ScoredField, expected: unknown, actual: unknown): boolean {
  if (expected == null) return actual == null;
  if (actual == null) return false;
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) <= Math.max(0.01, Math.abs(expected) * 0.01);
  }
  const e = String(expected).trim().toLowerCase();
  const a = String(actual).trim().toLowerCase();
  if (field === 'vendor') return a.includes(e) || e.includes(a);
  return e === a;
}

function scoreRun(extraction: ReceiptExtraction, truth: TruthFile | null) {
  const scores: Partial<Record<ScoredField, 'hit' | 'miss' | 'na'>> = {};
  for (const field of SCORED_FIELDS) {
    if (!truth || !(field in truth)) {
      scores[field] = 'na';
      continue;
    }
    scores[field] = fieldMatches(field, truth[field], extraction[field]) ? 'hit' : 'miss';
  }
  // "usable" = the money-bearing core is right (or unscored-but-present): amount, currency, date, type.
  const core: ScoredField[] = ['amount', 'currency', 'date'];
  const usable = core.every((f) => (scores[f] === 'na' ? extraction[f] != null : scores[f] === 'hit'));
  return { scores, usable };
}

async function runModel(
  openai: OpenAI,
  model: Model,
  base64: string,
  truth: TruthFile | null,
): Promise<ModelRun> {
  const start = Date.now();
  try {
    const completion = await openai.chat.completions.parse({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/webp;base64,${base64}`, detail: 'high' },
            },
            { type: 'text', text: 'Extract the structured receipt data.' },
          ],
        },
      ],
      response_format: zodResponseFormat(ReceiptExtractionSchema, 'receipt'),
      max_tokens: 2048,
    });
    const latencyMs = Date.now() - start;
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const parsed = completion.choices[0].message.parsed;
    const refusal = completion.choices[0].message.refusal ?? undefined;

    if (!parsed) {
      return {
        model, ok: false, refusal, latencyMs, inputTokens, outputTokens,
        costUsd: costUsd(model, inputTokens, outputTokens),
        scores: {}, usable: false,
      };
    }
    const { scores, usable } = scoreRun(parsed, truth);
    return {
      model, ok: true, latencyMs, inputTokens, outputTokens,
      costUsd: costUsd(model, inputTokens, outputTokens),
      extraction: parsed, scores, usable,
    };
  } catch (err) {
    return {
      model, ok: false, error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start, inputTokens: 0, outputTokens: 0, costUsd: 0,
      scores: {}, usable: false,
    };
  }
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(5)}`;
}

function renderResults(results: SampleResult[]): string {
  const lines: string[] = [];
  lines.push('# U1 — Receipt Extraction Spike Results');
  lines.push('');
  lines.push('> Throwaway spike (do not ship). Schema v' + RECEIPT_SCAN_SCHEMA_VERSION +
    '. Compression: ≥1920px mild WebP (compressReceiptImage / KTD-8).');
  lines.push('');
  lines.push(`Samples: **${results.length}**. Models: ${MODELS.join(', ')}.`);
  lines.push('');

  // Aggregate per model.
  lines.push('## Aggregate');
  lines.push('');
  lines.push('| Model | Runs OK | Usable (core fields) | Avg tokens (in/out) | Avg cost | Avg latency |');
  lines.push('|---|---|---|---|---|---|');
  for (const model of MODELS) {
    const runs = results.map((r) => r.runs.find((x) => x.model === model)).filter(Boolean) as ModelRun[];
    const ok = runs.filter((r) => r.ok).length;
    const usable = runs.filter((r) => r.usable).length;
    const avgIn = Math.round(runs.reduce((s, r) => s + r.inputTokens, 0) / (runs.length || 1));
    const avgOut = Math.round(runs.reduce((s, r) => s + r.outputTokens, 0) / (runs.length || 1));
    const avgCost = runs.reduce((s, r) => s + r.costUsd, 0) / (runs.length || 1);
    const avgLat = Math.round(runs.reduce((s, r) => s + r.latencyMs, 0) / (runs.length || 1));
    lines.push(`| ${model} | ${ok}/${runs.length} | ${usable}/${runs.length} | ${avgIn}/${avgOut} | ${fmtUsd(avgCost)} | ${avgLat}ms |`);
  }
  lines.push('');

  // Printed-invoice gate.
  const printed = results.filter((r) => r.docType === 'printed_invoice');
  lines.push('## Gate — ≥80% usable extraction on printed invoices');
  lines.push('');
  if (printed.length === 0) {
    lines.push('_No samples tagged `printed_invoice` — cannot evaluate the gate._');
  } else {
    lines.push(`Printed-invoice samples: **${printed.length}**` +
      (printed.length < 10 ? ' ⚠️ (N<10 — smoke test, not a statistically meaningful gate)' : ''));
    lines.push('');
    lines.push('| Model | Usable printed | Rate | Gate (≥80%) |');
    lines.push('|---|---|---|---|');
    for (const model of MODELS) {
      const runs = printed.map((r) => r.runs.find((x) => x.model === model)).filter(Boolean) as ModelRun[];
      const usable = runs.filter((r) => r.usable).length;
      const rate = usable / (runs.length || 1);
      lines.push(`| ${model} | ${usable}/${runs.length} | ${(rate * 100).toFixed(0)}% | ${rate >= 0.8 ? '✅ PASS' : '❌ FAIL'} |`);
    }
  }
  lines.push('');

  // Per-sample detail.
  lines.push('## Per-receipt detail');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.file}  \`${r.docType}\``);
    lines.push(`Compressed: ${(r.compressedBytes / 1024).toFixed(0)} KB, ${r.dimensions}. Truth file: ${r.hasTruth ? 'yes (auto-scored)' : 'no (manual review)'}.`);
    lines.push('');
    for (const run of r.runs) {
      if (!run.ok) {
        lines.push(`- **${run.model}** — ❌ ${run.error ?? run.refusal ?? 'no structured output'} (${run.latencyMs}ms)`);
        continue;
      }
      const e = run.extraction as ReceiptExtraction;
      const mark = (f: ScoredField) => (run.scores[f] === 'hit' ? '✓' : run.scores[f] === 'miss' ? '✗' : '·');
      lines.push(`- **${run.model}** — usable: ${run.usable ? '✅' : '❌'} · ${run.latencyMs}ms · ${run.inputTokens}/${run.outputTokens} tok · ${fmtUsd(run.costUsd)}`);
      lines.push(`  - type ${mark('type')} \`${e.type}\` · amount ${mark('amount')} \`${e.amount}\` · currency ${mark('currency')} \`${e.currency}\` · date ${mark('date')} \`${e.date}\``);
      lines.push(`  - vendor ${mark('vendor')} \`${e.vendor}\` · category ${mark('category')} \`${e.category}\` · item ${mark('itemName')} \`${e.itemName}\``);
      lines.push(`  - odometer ${mark('odometerValue')} \`${e.odometerValue} ${e.odometerUnit ?? ''}\` · parts \`${e.partsCost}\` · labor \`${e.laborCost}\` · fuelL ${mark('fuelLitres')} \`${e.fuelLitres}\``);
      if (e.legibilityNote) lines.push(`  - note: _${e.legibilityNote}_`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Go / No-Go decision');
  lines.push('');
  lines.push('_Record the decision here and in `docs/prd-receipt-scan.md` (Q4 / Phase 0 gate): proceed to U2 / rescope (printed-only, prompt-tighten + re-spike, model switch or defer) + model choice (4.1 vs 4.1-mini)._');
  lines.push('');
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set (checked env + apps/api/.env). Export it and retry.');
    process.exit(1);
  }
  if (!existsSync(SAMPLES_DIR)) {
    console.error(`samples/ not found at ${SAMPLES_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(SAMPLES_DIR)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(
      'No sample images in samples/. Drop receipt photos there first — ideally the full corpus\n' +
      '(printed dealer invoice, thermal fuel, faded/glare/crumpled, both decimal formats, ≥1 non-EUR,\n' +
      '≥1 miles-printed odometer). Then re-run. See README.md.',
    );
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 3, timeout: 60_000 });
  const results: SampleResult[] = [];

  for (const file of files) {
    const path = join(SAMPLES_DIR, file);
    const truthPath = join(SAMPLES_DIR, `${basename(file, extname(file))}.truth.json`);
    const truth: TruthFile | null = existsSync(truthPath)
      ? (JSON.parse(readFileSync(truthPath, 'utf8')) as TruthFile)
      : null;
    const docType = inferDocType(file, truth);

    console.log(`\n▶ ${file} (${docType})`);
    let compressed: Awaited<ReturnType<typeof compressReceiptImage>>;
    try {
      compressed = await compressReceiptImage(path);
    } catch (err) {
      console.error(`  ✗ compression failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    console.log(`  compressed → ${(compressed.bytes / 1024).toFixed(0)} KB, ${compressed.width}×${compressed.height}`);

    const runs: ModelRun[] = [];
    for (const model of MODELS) {
      process.stdout.write(`  ${model}… `);
      const run = await runModel(openai, model, compressed.base64, truth);
      runs.push(run);
      console.log(
        run.ok
          ? `usable=${run.usable} ${run.inputTokens}/${run.outputTokens}tok ${fmtUsd(run.costUsd)} ${run.latencyMs}ms`
          : `FAILED (${run.error ?? run.refusal ?? 'no output'})`,
      );
    }

    results.push({
      file,
      docType,
      compressedBytes: compressed.bytes,
      dimensions: `${compressed.width}×${compressed.height}`,
      hasTruth: truth !== null,
      runs,
    });
  }

  writeFileSync(RESULTS_PATH, renderResults(results));
  console.log(`\n✔ Wrote ${RESULTS_PATH}`);
}

void main();
