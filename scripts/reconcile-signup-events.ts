/**
 * Signup-event reconciliation — the acceptance gate for the canonical signup
 * event (migration 00174, `SignupEventsService`).
 *
 * WHY THIS IS A SCRIPT AND NOT A TEST
 * The 2026-06-09 fix for this same bug class shipped with a green test suite and
 * its acceptance criterion is still failing. A unit test can only prove the code
 * emits what the code intends to emit; only a count against the database proves
 * the event means what we think it means. So the gate is this number, and this
 * script exists so the number is easy to produce and hard to produce WRONGLY.
 *
 * The plan flagged two ways to get it wrong, both of which look exactly like a
 * bug in the emitter and would send someone chasing one that does not exist:
 *
 *   1. Comparing a PARTIAL deployment month against a full month of rows.
 *   2. Omitting the `role` / `deleted_at` filters, inflating the denominator.
 *      On production today that is the difference between 577, 553 and 551 —
 *      there are 2 admin rows and 24 soft-deleted ones.
 *
 * This script applies the same filters as `claim_pending_signup_events` so the
 * denominator cannot drift from the numerator's definition, refuses to report a
 * partial month as if it were complete, and prints the exact HogQL for the other
 * half of the comparison.
 *
 * Usage:  pnpm reconcile:signup
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from apps/api/.env. Read-only:
 * it issues GETs against PostgREST and writes nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Must stay identical to the filters in `claim_pending_signup_events`. */
const CLAIM_FILTERS = { role: 'user', notDeleted: true } as const;

/** ±10% is the agreed tolerance from the plan's Success Criteria. */
const TOLERANCE = 0.1;

const PAGE = 1000;

interface UserRow {
  created_at: string;
  role: string;
  deleted_at: string | null;
}

function loadEnv(): { url: string; key: string } {
  const path = join(process.cwd(), 'apps', 'api', '.env');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${path}. This script needs production SUPABASE_URL and ` +
        'SUPABASE_SERVICE_ROLE_KEY to count the denominator.',
    );
  }
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('apps/api/.env is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

async function fetchUsers(url: string, key: string): Promise<UserRow[]> {
  const rows: UserRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${url}/rest/v1/users?select=created_at,role,deleted_at`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
    const batch = (await res.json()) as UserRow[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

const monthKey = (iso: string) => iso.slice(0, 7);

function main(rows: UserRow[]): void {
  const eligible = rows.filter(
    (r) => r.role === CLAIM_FILTERS.role && (CLAIM_FILTERS.notDeleted ? !r.deleted_at : true),
  );

  const byMonth = new Map<string, number>();
  for (const r of eligible)
    byMonth.set(monthKey(r.created_at), (byMonth.get(monthKey(r.created_at)) ?? 0) + 1);

  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  console.log('Signup reconciliation — DENOMINATOR (production public.users)\n');
  console.log(`  filters applied: role = '${CLAIM_FILTERS.role}' AND deleted_at IS NULL`);
  console.log(
    `  (identical to claim_pending_signup_events — do not change one without the other)\n`,
  );
  console.log(`  rows total ......................... ${rows.length}`);
  console.log(
    `  excluded, role <> 'user' ........... ${rows.filter((r) => r.role !== 'user').length}`,
  );
  console.log(`  excluded, soft-deleted ............. ${rows.filter((r) => r.deleted_at).length}`);
  console.log(`  ELIGIBLE ........................... ${eligible.length}\n`);

  console.log('  month     signups   status');
  console.log('  ------------------------------------------------------');
  for (const month of [...byMonth.keys()].sort()) {
    const partial = month === currentMonth;
    const note = partial ? 'INCOMPLETE MONTH — do not use for the gate' : 'complete';
    console.log(`  ${month}   ${String(byMonth.get(month)).padStart(7)}   ${note}`);
  }

  const complete = [...byMonth.keys()].filter((m) => m !== currentMonth).sort();
  const target = complete[complete.length - 1];

  console.log(`\nNUMERATOR — run this in PostHog (project 155556) for the SAME month:\n`);
  console.log(`  SELECT count(DISTINCT person_id) AS signup_completed_uniques`);
  console.log(`  FROM events`);
  console.log(`  WHERE event = 'signup_completed'`);
  console.log(`    AND timestamp >= toStartOfMonth(toDate('${target}-01'))`);
  console.log(`    AND timestamp <  toStartOfMonth(toDate('${target}-01')) + INTERVAL 1 MONTH\n`);

  const denominator = byMonth.get(target) ?? 0;
  const low = Math.round(denominator * (1 - TOLERANCE));
  const high = Math.round(denominator * (1 + TOLERANCE));
  console.log(
    `GATE for ${target}: denominator ${denominator}, so PASS is ${low}–${high} (±${TOLERANCE * 100}%).\n`,
  );
  console.log('Use the FIRST FULL CALENDAR MONTH AFTER the event ships — not this one, unless');
  console.log('the sweep was already live on its first day. Then write the number into');
  console.log('docs/Signup-Reconciliation-2026-08-24.md. A green test suite is not this gate.');
}

const { url, key } = loadEnv();
fetchUsers(url, key)
  .then(main)
  .catch((e) => {
    console.error(`reconcile-signup-events: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
