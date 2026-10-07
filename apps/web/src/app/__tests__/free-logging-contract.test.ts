import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_TRIAL_DAYS, webOfferCopy } from '@/lib/pro-plan';

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
const GARAGE_DIR = path.join(SRC, 'app/(community)/garage');
const PROFILE_DIR = path.join(SRC, 'app/(community)/profile');
const GARAGE_VIEW = path.join(GARAGE_DIR, 'garage-view.tsx');
const GARAGE_CARDS = path.join(GARAGE_DIR, 'garage-cards.tsx');
const GENERATED_GRAPHQL = path.join(
  process.cwd(),
  '../../packages/graphql/src/generated/graphql.ts',
);
const PRO_DIR = path.join(SRC, 'app/pro');
const MESSAGES_DIR = path.join(process.cwd(), 'messages');

const FREE_LOGGING_START = 'Free logging: service + spend';
const FREE_LOGGING_END = 'End free logging';

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
  const view = fs.readFileSync(GARAGE_VIEW, 'utf8');
  const cards = fs.readFileSync(GARAGE_CARDS, 'utf8');

  it('has no ProGate wrapper anywhere in the garage', () => {
    for (const file of listFiles(GARAGE_DIR).filter((f) => /\.tsx?$/.test(f))) {
      expect(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)).not.toMatch(/ProGate/);
    }
  });

  it('renders the next-service and spend cards ungated', () => {
    const start = view.indexOf(FREE_LOGGING_START);
    const end = view.indexOf(FREE_LOGGING_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const sections = view.slice(start, end);
    expect(sections).toContain('<NextServiceCard');
    expect(sections).toContain('<SpendCard');
    expect(sections).not.toMatch(/isPro/);
    expect(sections).not.toMatch(/blur\(/);
  });

  it('the cards themselves never read the plan', () => {
    expect(cards).not.toMatch(/isPro|useProStatus|blur\(/);
  });
});

/**
 * Every generated GraphQL document whose operation is a mutation. Read from the
 * codegen output so a new mutation is covered without touching this test.
 */
function mutationDocumentNames(): string[] {
  const generated = fs.readFileSync(GENERATED_GRAPHQL, 'utf8');
  return [
    ...generated.matchAll(
      /export const (\w+Document) = \{"kind":"Document","definitions":\[\{"kind":"OperationDefinition","operation":"mutation"/g,
    ),
  ].map((m) => m[1]);
}

/**
 * Guard (#277): the web displays, the app does. The garage and profile pages
 * show a rider's data but never create or edit it — logging, completing
 * maintenance and editing the profile happen in the app. Displaying expenses
 * and maintenance stays free (above); acting on them moves to the app.
 *
 * The one allowed write is account management: the billing-portal session a
 * web (Stripe) subscriber needs to manage or cancel Pro.
 */
describe('read-only contract (web garage + profile)', () => {
  const ALLOWED_MUTATIONS = new Set(['CreateBillingPortalSessionDocument']);
  const files = [...listFiles(GARAGE_DIR), ...listFiles(PROFILE_DIR)].filter((f) =>
    /\.tsx?$/.test(f),
  );
  const mutations = mutationDocumentNames();

  it('finds the generated mutation documents', () => {
    expect(mutations).toContain('LogExpenseDocument');
    expect(mutations).toContain('CompleteMaintenanceTaskDocument');
  });

  it('calls no data mutation and no server action', () => {
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const rel = path.relative(SRC, file);
      expect(src, rel).not.toMatch(/useMutation|['"]use server['"]/);
      const used = mutations.filter(
        (name) => !ALLOWED_MUTATIONS.has(name) && new RegExp(`\\b${name}\\b`).test(src),
      );
      expect(used, rel).toEqual([]);
    }
  });

  it('has no profile edit route', () => {
    expect(fs.existsSync(path.join(PROFILE_DIR, 'edit'))).toBe(false);
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)).not.toMatch(
        /\/profile\/edit/,
      );
    }
  });

  // The allowed write above must stay reachable: /profile is the only place a
  // web (Stripe) subscriber can manage or cancel Pro, in both profile states.
  it('keeps the billing-portal manage/cancel path on /profile', () => {
    const page = fs.readFileSync(path.join(PROFILE_DIR, 'page.tsx'), 'utf8');
    const noUsernameStart = page.indexOf('if (!user.publicUsername)');
    const profileCardStart = page.indexOf('const initial =');
    expect(noUsernameStart).toBeGreaterThan(-1);
    expect(profileCardStart).toBeGreaterThan(noUsernameStart);
    expect(page.slice(noUsernameStart, profileCardStart)).toContain('<ProBanner');
    expect(page.slice(profileCardStart)).toContain('<ProBanner');

    const banner = fs.readFileSync(path.join(PROFILE_DIR, 'pro-banner.tsx'), 'utf8');
    expect(banner).toContain('<ManageWebSubscription');

    const manage = fs.readFileSync(path.join(PROFILE_DIR, 'manage-web-subscription.tsx'), 'utf8');
    expect(manage).toMatch(/\bCreateBillingPortalSessionDocument\b/);
  });
});

describe('Pro copy contract (web)', () => {
  it('Pro pages do not sell free or non-existent features', () => {
    const banned = /csv|priority support|ride analytics|health report|export everything/i;
    for (const file of listFiles(PRO_DIR).filter((f) => /\.tsx?$/.test(f))) {
      expect(fs.readFileSync(file, 'utf8'), path.relative(SRC, file)).not.toMatch(banned);
    }
  });

  it('makes no free-trial claim on /pro while web checkout has no trial', () => {
    // The RevenueCat web packages bill immediately (sandbox purchase, 2026-10-05).
    expect(WEB_TRIAL_DAYS).toBe(0);
    const trialClaim = /free trial|days? free|\$0 today|no charge|trial/i;
    const copy = webOfferCopy(WEB_TRIAL_DAYS);
    const strings = [
      copy.eyebrow,
      copy.metaCallToAction,
      ...copy.heroBullets,
      copy.cardCta,
      copy.cardFootnote,
      copy.finalLine,
      copy.finalCta,
      copy.billingFaq.q,
    ];
    for (const s of strings) expect(s).not.toMatch(trialClaim);
    // The only trial mention allowed is the FAQ answer saying web has none.
    expect(copy.billingFaq.a).toMatch(/no free trial/i);

    // And the page sources must not hardcode trial copy around the constant.
    for (const file of ['page.tsx', 'pricing-card.tsx']) {
      const src = fs.readFileSync(path.join(PRO_DIR, file), 'utf8');
      expect(src, file).not.toMatch(/7[- ]days?|free trial|\$0 today|no charge/i);
    }
  });

  it('turns trial copy on only through WEB_TRIAL_DAYS', () => {
    const withTrial = webOfferCopy(7);
    expect(withTrial.hasTrial).toBe(true);
    expect(withTrial.cardCta).toMatch(/7-day free trial/);
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

describe('price copy contract (web)', () => {
  it('checkout renders prices from RevenueCat, never hardcoded', () => {
    // '$0.00' is the "due today" amount during a trial, not a plan price.
    const src = fs
      .readFileSync(path.join(PRO_DIR, 'checkout/page.tsx'), 'utf8')
      .replace("'$0.00'", '');
    expect(src).not.toMatch(/\$\d+\.\d{2}/);
    expect(src).not.toMatch(/-30%/);
    expect(src).toContain('webBillingProduct.currentPrice');
  });

  it('the static /pro page reads prices only from lib/web-pricing', () => {
    for (const file of ['page.tsx', 'pricing-card.tsx']) {
      const src = fs.readFileSync(path.join(PRO_DIR, file), 'utf8');
      expect(src, file).not.toMatch(/\$\d+\.\d{2}|[−-]30%/);
    }
  });

  it('no locale quotes a price MotoVault has never charged', () => {
    // $4 / $36 and $4.99 were never MotoVault prices (app: $9.99/mo, $79.99 iOS /
    // $59.99 Play annual; web: $5.99/mo, $49.99/yr).
    const stale =
      /\$4 per month|\$36 per year|\b4 \$ (pro|al|par)|\b36 \$|\(\$4[.,]99\/|\(4,99 \$\/|[（(]月額 \$4\.99[）)]/;
    for (const file of fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'))) {
      const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'));
      const offenders = collectStrings(messages).filter(
        (s) => /MotoVault/.test(s) && stale.test(s),
      );
      expect(offenders, file).toEqual([]);
    }
  });

  it('does not claim recorded rides export as GPX', () => {
    const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));
    const offenders = collectStrings(messages).filter((s) =>
      /every ride you record[^.]*can be exported|GPX export for both recorded rides/i.test(s),
    );
    expect(offenders).toEqual([]);
  });
});
