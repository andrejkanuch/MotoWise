/**
 * Maintenance-article generator for the Africa Twin DCT (plan U10).
 *
 * THIS IS NOT PART OF `next build`. It is a standalone Node step
 * (`pnpm --filter web generate:maintenance-article`) run on demand by a
 * developer/admin. It reads VERIFIED dataset rows (`is_verified = true`) from
 * Supabase via the SERVICE ROLE key and UPSERTS the article into the blog CMS
 * tables (blog_posts + blog_post_maintenance + blog_post_translations.body_raw),
 * landing as a draft for the admin-review gate. It no longer writes an MDX file.
 *
 * Two generators, never conflated (KTD 5):
 *   - The PROSE comes from the narrative-only LLM path in the API
 *     (`article-generator.service.ts` → `generateMaintenanceNarrative`), which
 *     guarantees no digits. This script consumes that prose as input (passed via
 *     a JSON file path / arg, or the placeholder below until U2/U3 produce data)
 *     and merges it with the tables.
 *   - The NUMBERS come from this script: GFM tables built from verified DB rows,
 *     with imperial DERIVED at generation time via the pure per-spec_type
 *     convert+round function (KTD 7) and baked into the MDX text. Metric stays
 *     canonical; imperial is never persisted to the dataset DB rows.
 *
 * Regeneration replaces ONLY the table regions, between the comment markers
 * SPEC_TABLES_START / SPEC_TABLES_END, so a re-run after a dataset correction
 * refreshes the numbers without touching the stored narrative.
 *
 * ── Revalidation mechanism (KTD 6, atomic step) ───────────────────────────────
 * The blog route uses `export const revalidate = 604800` (7-day ISR). Without
 * on-demand revalidation a corrected safety number could disagree with mobile
 * (DB-live) for up to 7 days. The repo already exposes an on-demand
 * revalidation endpoint at `POST {WEB_URL}/api/revalidate`
 * (`apps/web/src/app/api/revalidate/route.ts`), authed by the shared
 * `REVALIDATE_SECRET` header `x-revalidate-secret`, body `{ paths: string[] }`.
 * The API's `RevalidationService` already calls it for trips. This standalone
 * script is not inside the Nest DI graph, so it calls that SAME endpoint
 * directly with the SAME secret + payload shape after writing the file. The
 * route fans each bare path out to every locale variant itself, so we send the
 * bare `/blog/<slug>`.
 *
 * Service-role key handling (KTD 6): `SUPABASE_SERVICE_ROLE_KEY` is server-only,
 * read from the shell env at run time, NEVER `NEXT_PUBLIC_*`, never bundled.
 */

import { readFileSync } from 'node:fs';
import {
  BlogPostStatus,
  BlogPostType,
  findDigitViolations,
  type MaintenanceNarrative,
  MaintenanceNarrativeSchema,
  type MaintenanceSpecType,
} from '@motovault/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stripMdxToText } from './migrate-blog-to-db';
import { convertKmToMiles, convertSpecToImperial } from './unit-convert';

// --- Pilot constants ---------------------------------------------------------

const SLUG = 'honda-africa-twin-crf1100-maintenance-schedule';
const MAKE = 'HONDA';
const MODEL = 'CRF1100';
const VARIANT = 'DCT';
/** `make/model[/variant]` — the file-based stand-in for the future blog_posts FK (KTD 6). */
const DATASET_MODELS = [`${MAKE}/${MODEL}/${VARIANT}`];

const REVALIDATE_PATH = `/blog/${SLUG}`;

// Post-level constants written to CMS columns (were MDX frontmatter).
const TITLE = 'Honda CRF1100 Africa Twin (DCT) Maintenance Schedule & Service Intervals';
const KEYWORDS = [
  'Honda Africa Twin maintenance schedule',
  'CRF1100 DCT service intervals',
  'Africa Twin valve clearance',
  'CRF1100L maintenance',
];

// JSX-style comments, NOT HTML `<!-- -->`: MDX (next-mdx-remote) rejects `<!--`
// ("Unexpected character `!`") and would fail to compile the article body. `{/* */}`
// is a valid MDX comment, renders to nothing, and still works as an indexOf region marker.
const TABLES_START = '{/* SPEC_TABLES_START */}';
const TABLES_END = '{/* SPEC_TABLES_END */}';

// Imperial display is only derived for known spec types; an unknown type is
// rendered metric-only rather than guessing a conversion.
const IMPERIAL_SPEC_TYPES = new Set<MaintenanceSpecType>([
  'torque',
  'valve_clearance',
  'capacity',
  'pressure',
  'plug_gap',
]);

// Narrative shape (`MaintenanceNarrative`) is imported from @motovault/types — the same schema
// the API narrative path produces, so loadNarrative can validate + digit-guard it (see below).

// Minimal row shapes — only the columns this script reads.
interface ScheduleRow {
  task_name: string;
  interval_km: number | null;
  interval_days: number | null;
  priority: string;
  is_safety_critical: boolean;
}
interface SpecRow {
  spec_type: string;
  spec_name: string;
  value_numeric: number;
  value_display: string | null;
  unit: string;
  is_safety_critical: boolean;
}

// --- Supabase (service role) -------------------------------------------------

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL');
  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (server-only; see apps/web/.env.example). ' +
        'New maintenance tables are service-role-only (deny-all RLS).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Merge variant-specific rows OVER the variant-agnostic (`variant IS NULL`) baseline,
 * keyed by `task_name` (variant wins), preserving baseline tasks with no variant entry.
 * Mirrors the runtime resolver's `mergeRowsByTaskName` (oem-schedules.service.ts) so the
 * published article matches what mobile shows. Without this the article would render ONLY
 * the variant-specific rows and silently drop every verified all-variant task.
 */
function mergeByKey<T extends Record<string, unknown>>(
  baseline: T[],
  variantRows: T[],
  key: keyof T,
): T[] {
  if (variantRows.length === 0) return baseline;
  const byKey = new Map<unknown, T>();
  for (const row of baseline) byKey.set(row[key], row);
  for (const row of variantRows) byKey.set(row[key], row); // variant overrides baseline
  return [...byKey.values()];
}

async function fetchVerifiedSchedules(db: SupabaseClient): Promise<ScheduleRow[]> {
  // is_verified = true is THE gate (KTD 3). Service role bypasses RLS, so the
  // explicit filter is also the trust boundary here. Fetch the variant tier and the
  // variant-agnostic (NULL) baseline, then merge variant-over-baseline by task_name —
  // a flat `.eq('variant', …)` would exclude NULL rows in PostgREST and drop them.
  const select = 'task_name, interval_km, interval_days, priority, is_safety_critical, sort_order';
  const base = db
    .from('oem_maintenance_schedules')
    .select(select)
    .eq('make', MAKE)
    .eq('model', MODEL);
  const [variantRes, baselineRes] = await Promise.all([
    base.eq('variant', VARIANT).eq('is_verified', true),
    db
      .from('oem_maintenance_schedules')
      .select(select)
      .eq('make', MAKE)
      .eq('model', MODEL)
      .is('variant', null)
      .eq('is_verified', true),
  ]);
  if (variantRes.error)
    throw new Error(`Failed to load verified schedules: ${variantRes.error.message}`);
  if (baselineRes.error)
    throw new Error(`Failed to load verified schedules: ${baselineRes.error.message}`);
  const merged = mergeByKey(
    (baselineRes.data ?? []) as (ScheduleRow & { sort_order: number | null })[],
    (variantRes.data ?? []) as (ScheduleRow & { sort_order: number | null })[],
    'task_name',
  );
  // Order by interval_km (NULLs last) so the rendered table is shortest-interval-first.
  return merged.sort(
    (a, b) =>
      (a.interval_km ?? Number.POSITIVE_INFINITY) - (b.interval_km ?? Number.POSITIVE_INFINITY),
  );
}

async function fetchVerifiedSpecs(db: SupabaseClient): Promise<SpecRow[]> {
  const select = 'spec_type, spec_name, value_numeric, value_display, unit, is_safety_critical';
  const [variantRes, baselineRes] = await Promise.all([
    db
      .from('motorcycle_specs')
      .select(select)
      .eq('make', MAKE)
      .eq('model', MODEL)
      .eq('variant', VARIANT)
      .eq('is_verified', true),
    db
      .from('motorcycle_specs')
      .select(select)
      .eq('make', MAKE)
      .eq('model', MODEL)
      .is('variant', null)
      .eq('is_verified', true),
  ]);
  if (variantRes.error)
    throw new Error(`Failed to load verified specs: ${variantRes.error.message}`);
  if (baselineRes.error)
    throw new Error(`Failed to load verified specs: ${baselineRes.error.message}`);
  // Spec identity is per spec_name (a variant-specific spec overrides the baseline of the same name).
  const merged = mergeByKey(
    (baselineRes.data ?? []) as SpecRow[],
    (variantRes.data ?? []) as SpecRow[],
    'spec_name',
  );
  return merged.sort((a, b) => a.spec_type.localeCompare(b.spec_type));
}

// --- GFM table builders ------------------------------------------------------

/** Escape a pipe so a value can't break GFM table columns. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function buildIntervalTable(rows: ScheduleRow[]): string {
  if (rows.length === 0) return '';
  const lines = [
    '### Service intervals',
    '',
    '| Service item | Interval (km) | Interval (mi) | Time interval | Priority |',
    '|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const km = r.interval_km != null ? r.interval_km.toLocaleString('en-US') : '—';
    const mi =
      r.interval_km != null ? `${convertKmToMiles(r.interval_km).toLocaleString('en-US')}` : '—';
    const days =
      r.interval_days != null
        ? r.interval_days % 365 === 0
          ? `${r.interval_days / 365} yr`
          : `${r.interval_days} days`
        : '—';
    lines.push(`| ${cell(r.task_name)} | ${km} | ${mi} | ${days} | ${cell(r.priority)} |`);
  }
  return lines.join('\n');
}

function buildSpecTable(rows: SpecRow[]): { md: string; outOfTolerance: string[] } {
  const outOfTolerance: string[] = [];
  if (rows.length === 0) return { md: '', outOfTolerance };

  const lines = [
    '### Specifications',
    '',
    '| Spec | Metric (verified) | Imperial (derived) |',
    '|---|---|---|',
  ];
  for (const r of rows) {
    // Metric display prefers the verbatim manual string the human verified.
    const metric = r.value_display?.trim() || `${r.value_numeric} ${r.unit}`;
    let imperial = '—';
    if (IMPERIAL_SPEC_TYPES.has(r.spec_type as MaintenanceSpecType)) {
      const conv = convertSpecToImperial(
        r.spec_type as MaintenanceSpecType,
        r.value_numeric,
        r.value_display,
      );
      imperial = `${conv.value} ${conv.unit}`;
      // KTD 7: flag any spec whose displayed imperial drifted beyond tolerance —
      // it needs human review before shipping. Safety-critical drift is fatal.
      if (!conv.withinTolerance) {
        outOfTolerance.push(`${r.spec_name} (${r.spec_type})`);
      }
    }
    lines.push(`| ${cell(r.spec_name)} | ${cell(metric)} | ${cell(imperial)} |`);
  }
  return { md: lines.join('\n'), outOfTolerance };
}

// --- Frontmatter + MDX assembly ----------------------------------------------

const FAQ_QUESTIONS = [
  'What does the Africa Twin DCT maintenance schedule cover?',
  'Should I service my Africa Twin DCT myself or at a dealer?',
  'What are the key things to know about owning an Africa Twin DCT?',
  'How often does the Africa Twin DCT need servicing?',
  'What should I check before a long Africa Twin ride?',
];

/** FAQ pairs from the digit-free key takeaways — stored in the faq jsonb column. */
export function buildFaq(
  narrative: MaintenanceNarrative,
): Array<{ question: string; answer: string }> {
  return narrative.keyTakeaways.map((answer, i) => ({
    question: FAQ_QUESTIONS[i] ?? FAQ_QUESTIONS[FAQ_QUESTIONS.length - 1],
    answer,
  }));
}

/** The static narrative body (outside the table region). Regeneration preserves this. */
function buildNarrativeBody(narrative: MaintenanceNarrative): string {
  const sections = narrative.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n');
  return [
    narrative.intro,
    '## DIY vs. Dealer',
    '',
    narrative.diyVsDealer,
    '## Ownership Notes',
    '',
    narrative.ownershipNotes,
    sections,
  ].join('\n\n');
}

/**
 * Build the MDX BODY (no frontmatter — that lives in CMS columns now). The table
 * region between TABLES_START/END is the ONLY part a re-run replaces; the stored
 * narrative is preserved from the existing body_raw when present (surgical re-gen).
 */
export function buildBody(
  narrative: MaintenanceNarrative,
  tablesMd: string,
  existing: string | null,
): string {
  const tableBlock = `${TABLES_START}\n\n${tablesMd}\n\n${TABLES_END}`;

  if (existing?.includes(TABLES_START) && existing.includes(TABLES_END)) {
    const start = existing.indexOf(TABLES_START);
    const end = existing.indexOf(TABLES_END) + TABLES_END.length;
    return `${existing.slice(0, start)}${tableBlock}${existing.slice(end)}`;
  }

  return [
    buildNarrativeBody(narrative),
    '',
    '## Maintenance Schedule & Specifications',
    '',
    tableBlock,
    '',
  ].join('\n');
}

/**
 * Upsert the maintenance post into the CMS. An existing post keeps its status (so
 * a published article stays published on re-gen); a brand-new post lands as draft
 * for the admin-review gate. body_text is recomputed via the shared stripMdxToText
 * helper; there is no rendered_html cache (KTD11).
 */
async function upsertMaintenancePost(
  db: SupabaseClient,
  narrative: MaintenanceNarrative,
  body: string,
  existingStatus: string | null,
): Promise<void> {
  const status = existingStatus ?? BlogPostStatus.DRAFT;
  const excerpt = narrative.intro.slice(0, 155);

  const { data: post, error: postErr } = await db
    .from('blog_posts')
    .upsert(
      {
        slug: SLUG,
        type: BlogPostType.MAINTENANCE,
        status,
        spec_data: true,
        is_safety_critical: true,
        author: 'Andrej Kanuch',
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (postErr) throw new Error(`blog_posts upsert failed: ${postErr.message}`);
  const postId = (post as { id: string }).id;

  const { error: mErr } = await db.from('blog_post_maintenance').upsert(
    {
      post_id: postId,
      make: MAKE,
      model: MODEL,
      variant: VARIANT,
      dataset_models: DATASET_MODELS,
    },
    { onConflict: 'post_id' },
  );
  if (mErr) throw new Error(`blog_post_maintenance upsert failed: ${mErr.message}`);

  const { error: tErr } = await db.from('blog_post_translations').upsert(
    {
      post_id: postId,
      locale: 'en',
      title: TITLE,
      excerpt,
      seo_title: TITLE,
      seo_description: excerpt,
      body_raw: body,
      body_text: stripMdxToText(body),
      keyword_text: KEYWORDS.join(' '),
      faq: buildFaq(narrative),
      reading_time: '8',
    },
    { onConflict: 'post_id,locale' },
  );
  if (tErr) throw new Error(`blog_post_translations upsert failed: ${tErr.message}`);

  console.log(`[blog] upserted maintenance post ${SLUG} (status=${status})`);
}

// --- On-demand revalidation (KTD 6) ------------------------------------------

/**
 * Hit the repo's existing on-demand revalidation endpoint
 * (`apps/web/src/app/api/revalidate/route.ts`) so the corrected article surfaces
 * without waiting out the 7-day ISR window. Same secret + payload shape the
 * API's RevalidationService uses for trips. Best-effort: a revalidation failure
 * is reported loudly but does not delete the freshly written file.
 */
async function triggerRevalidation(): Promise<void> {
  const webUrl = (process.env.WEB_URL ?? process.env.NEXT_PUBLIC_BASE_URL)?.replace(/\/+$/, '');
  const secret = process.env.REVALIDATE_SECRET;
  if (!webUrl || !secret) {
    console.warn(
      '[revalidate] skipped — WEB_URL/NEXT_PUBLIC_BASE_URL or REVALIDATE_SECRET not set. ' +
        `The article will refresh on the next ISR window. Path: ${REVALIDATE_PATH}`,
    );
    return;
  }
  const res = await fetch(`${webUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ paths: [REVALIDATE_PATH] }),
  });
  if (!res.ok) {
    throw new Error(`Revalidation failed: ${res.status} ${res.statusText}`);
  }
  console.log(`[revalidate] ok — ${REVALIDATE_PATH} (fanned out to all locales by the route)`);
}

// --- Narrative loading -------------------------------------------------------

/**
 * Load the digit-free narrative produced by the API narrative-only path.
 * Pass its JSON via `--narrative <path>` (or NARRATIVE_JSON_PATH). Until U2/U3
 * produce verified data the script is not meant to run; if no narrative is
 * supplied we fail loudly rather than invent prose (the LLM path owns prose).
 */
function loadNarrative(): MaintenanceNarrative {
  const argIdx = process.argv.indexOf('--narrative');
  const path =
    (argIdx >= 0 ? process.argv[argIdx + 1] : undefined) ?? process.env.NARRATIVE_JSON_PATH;
  if (!path) {
    throw new Error(
      'No narrative supplied. Generate it via the API maintenance-narrative path, write the ' +
        'JSON, then pass --narrative <path> (or set NARRATIVE_JSON_PATH). This script renders ' +
        'tables + merges prose; it never writes prose itself.',
    );
  }
  // Validate the JSON against the shared schema, then re-run the no-digit guard HERE — the
  // write boundary — not just at API generation time. A hand-edited or stale narrative JSON
  // with a stray number would otherwise bake a digit into the live MDX (KTD 5).
  const parsed = MaintenanceNarrativeSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
  const violations = findDigitViolations(parsed);
  if (violations.length > 0) {
    throw new Error(
      `Narrative contains digits at: ${violations.join(', ')}. Numbers must come only from the ` +
        'dataset-driven tables (KTD 5). Regenerate the narrative; do not hand-edit numbers in.',
    );
  }
  return parsed;
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  const narrative = loadNarrative();
  const db = getServiceClient();

  const [schedules, specs] = await Promise.all([
    fetchVerifiedSchedules(db),
    fetchVerifiedSpecs(db),
  ]);

  if (schedules.length === 0 && specs.length === 0) {
    throw new Error(
      `No verified rows for ${DATASET_MODELS.join(', ')}. Approve drafts in the admin review ` +
        'page (U4) before generating — the generator never renders unverified data.',
    );
  }

  const intervalTable = buildIntervalTable(schedules);
  const { md: specTable, outOfTolerance } = buildSpecTable(specs);

  // KTD 7: an out-of-tolerance imperial display is a safety flag. Fail the run
  // for any safety-critical drift so a bad number can't ship; warn otherwise.
  if (outOfTolerance.length > 0) {
    const criticalDrift = specs.some(
      (s) => s.is_safety_critical && outOfTolerance.includes(`${s.spec_name} (${s.spec_type})`),
    );
    const msg = `Imperial display out of tolerance for: ${outOfTolerance.join(', ')}`;
    if (criticalDrift) {
      throw new Error(
        `${msg}. Safety-critical — refusing to generate. Review the displayed imperial.`,
      );
    }
    console.warn(`[tolerance] ${msg}. Review the displayed imperial before publishing.`);
  }

  const tablesMd = [intervalTable, specTable].filter(Boolean).join('\n\n');

  // Surgical table replacement operates on the EXISTING stored en body_raw.
  const { data: existingPost } = await db
    .from('blog_posts')
    .select('id, status')
    .eq('slug', SLUG)
    .maybeSingle();

  let existingBody: string | null = null;
  const existingStatus = (existingPost as { status?: string } | null)?.status ?? null;
  if (existingPost) {
    const { data: t } = await db
      .from('blog_post_translations')
      .select('body_raw')
      .eq('post_id', (existingPost as { id: string }).id)
      .eq('locale', 'en')
      .maybeSingle();
    existingBody = (t as { body_raw?: string } | null)?.body_raw ?? null;
  }

  const body = buildBody(narrative, tablesMd, existingBody);
  await upsertMaintenancePost(db, narrative, body, existingStatus);
  console.log(`[blog] ${schedules.length} intervals, ${specs.length} specs`);

  // Upsert THEN revalidate so the article never lags mobile by the full ISR window.
  await triggerRevalidation();
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1]?.endsWith('generate-maintenance-article.ts')) {
  main().catch((err: unknown) => {
    console.error(
      '[generate-maintenance-article] failed:',
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
  });
}
