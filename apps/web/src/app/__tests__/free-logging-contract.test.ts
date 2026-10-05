import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: logging maintenance and expenses is free for every rider, on every
 * platform, and the web must not sell anything as Pro that Pro does not unlock.
 *
 * Until 2026-10 the web garage wrapped the expense dashboard and the maintenance
 * section in a `ProGate` that blurred them for free users — a paywall on the two
 * features the product promises are never paywalled — and /pro sold free or
 * non-existent features (ride analytics, health reports, CSV/PDF export,
 * priority support) as Pro. These checks are structural tripwires; the Pro list
 * itself is covered by lib/__tests__/pro-plan.test.ts.
 */

const SRC = path.join(process.cwd(), 'src');
const GARAGE_DASHBOARD = path.join(SRC, 'app/(community)/garage/garage-dashboard.tsx');
const PRO_DIR = path.join(SRC, 'app/pro');
const MESSAGES_DIR = path.join(process.cwd(), 'messages');

const EXPENSE_SECTION_MARKER = 'Section C: Expense Dashboard';
const SAVED_TRIPS_MARKER = 'Section E: Saved Trips';

/** Words that, next to "Pro", mean a false claim in any shipped locale. */
const FALSE_PRO_CLAIM =
  /csv|priority support|support prioritaire|soporte prioritario|supporto prioritario|suporte prioritário|priorytetowe wsparcie|bevorzugte|優先サポート|प्रायोरिटी सपोर्ट|dukungan prioritas|การสนับสนุนลำดับแรก|oncelikli destek|öncelikli destek/i;

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(abs) : [abs];
  });
}

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const v of node) collectStrings(v, out);
  else if (node && typeof node === 'object')
    for (const v of Object.values(node)) collectStrings(v, out);
  return out;
}

describe('free logging contract (web garage)', () => {
  const source = fs.readFileSync(GARAGE_DASHBOARD, 'utf8');

  it('has no ProGate wrapper', () => {
    expect(source).not.toMatch(/ProGate/);
  });

  it('renders the expense dashboard and maintenance section ungated', () => {
    const start = source.indexOf(EXPENSE_SECTION_MARKER);
    const end = source.indexOf(SAVED_TRIPS_MARKER);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const sections = source.slice(start, end);
    expect(sections).toContain('<ExpenseDashboardPanel');
    expect(sections).toContain('<MaintenanceSection');
    expect(sections).not.toMatch(/isPro/);
    expect(sections).not.toMatch(/blur\(/);
  });
});

describe('Pro copy contract (web)', () => {
  it('Pro pages do not sell free or non-existent features', () => {
    const banned = /csv|priority support|ride analytics|health report|export everything/i;
    for (const file of listFiles(PRO_DIR).filter((f) => /\.tsx?$/.test(f))) {
      expect(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)).not.toMatch(banned);
    }
  });

  it('no locale message pairs Pro with CSV export or priority support', () => {
    for (const file of fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'))) {
      const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'));
      const offenders = collectStrings(messages).filter(
        (s) => /\bPro\b/.test(s) && FALSE_PRO_CLAIM.test(s),
      );
      expect(offenders, file).toEqual([]);
    }
  });
});
