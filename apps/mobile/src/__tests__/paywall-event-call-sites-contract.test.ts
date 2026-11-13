/**
 * Structural guard (issue 365 T05a): the paywall lifecycle events are fired only
 * by `lib/subscription.ts`, which stamps every one of them with `trigger`,
 * `gate_policy`, `session_paywall_index` and `minutes_since_onboarding_completed`.
 * A second `trackEvent` of one of these events anywhere else ships it without
 * those props and double-counts paywall requests. To add context from a call
 * site, pass it to `presentPaywall` / `requireAccess` as metadata instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '..');
const OWNER = path.join('lib', 'subscription.ts');
const PAYWALL_LIFECYCLE_EVENT =
  /AnalyticsEvent\.(PAYWALL_PRESENT_REQUESTED|PAYWALL_VIEWED|PAYWALL_RESULT)\b/;
const SOURCE_FILE = /\.(ts|tsx)$/;
const SKIPPED_DIRS = new Set(['__tests__', 'test']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sourceFiles(full);
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

describe('paywall lifecycle event call sites', () => {
  it('are only in lib/subscription.ts', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => path.relative(SRC, file))
      .filter((rel) => rel !== OWNER)
      .filter((rel) => PAYWALL_LIFECYCLE_EVENT.test(readFileSync(path.join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('still finds them in lib/subscription.ts', () => {
    expect(readFileSync(path.join(SRC, OWNER), 'utf8')).toMatch(PAYWALL_LIFECYCLE_EVENT);
  });
});
