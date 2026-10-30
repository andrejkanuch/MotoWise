import {
  ArrowRight,
  Bike,
  Check,
  ChevronDown,
  Download,
  type LucideIcon,
  MapPin,
  Minus,
  Receipt,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  type ComparisonValue,
  FREE_VS_PRO,
  PRO_FEATURE_KEYS,
  PRO_FEATURES,
  type ProFeatureKey,
  WEB_OFFER_COPY,
} from '@/lib/pro-plan';
import { STATIC_WEB_PLANS } from '@/lib/web-pricing';
import { PricingCard } from './pricing-card';
import './pro.css';

export const metadata: Metadata = {
  title: { absolute: 'MotoVault Pro: unlimited bikes and AI' },
  description: `MotoVault Pro adds unlimited bikes, unlimited AI diagnostics, unlimited receipt scans, GPX export and offline trip maps. Maintenance and expense logging stay free. ${WEB_OFFER_COPY.metaCallToAction}`,
  alternates: { canonical: 'https://motovault.app/pro' },
};

/* ── Data ─────────────────────────────────────────────────────── */

/** Icon per Pro feature; the copy itself lives in lib/pro-plan.ts. */
const FEATURE_ICONS: Record<ProFeatureKey, LucideIcon> = {
  [PRO_FEATURE_KEYS.BIKES]: Bike,
  [PRO_FEATURE_KEYS.AI_DIAGNOSTICS]: ScanSearch,
  [PRO_FEATURE_KEYS.AI_EXTRAS]: Sparkles,
  [PRO_FEATURE_KEYS.RECEIPT_SCANS]: Receipt,
  [PRO_FEATURE_KEYS.GPX_EXPORT]: Download,
  [PRO_FEATURE_KEYS.OFFLINE_MAPS]: MapPin,
};

const FAQ = [
  WEB_OFFER_COPY.billingFaq,
  {
    q: 'How do I cancel?',
    a: 'If you subscribed on the web, open your profile and choose “Manage subscription” on the Pro banner — that opens the billing portal, where cancelling takes one click. If you subscribed on iPhone or iPad, cancel in Settings › your name › Subscriptions; on Android, in Google Play › Payments & subscriptions. Pro stays active until the end of the period you have paid for.',
  },
  {
    q: 'Is there a lock-in?',
    a: 'No. Cancel whenever you like from the same place you subscribed, and you keep Pro until the end of the period you have already paid for.',
  },
  {
    q: 'Why a subscription rather than a one-off payment?',
    a: 'AI diagnostics, receipt scanning and offline map data cost us something every time you use them (the AI, map and hosting bills). A subscription pays for that usage and lets us keep shipping, while logging maintenance and expenses stays free for everyone.',
  },
  {
    q: 'Is my data private?',
    a: 'Diagnostic photos are processed in real time and deleted within 24 hours. We never sell or rent personal data. The full privacy policy is at motovault.app/privacy.',
  },
  {
    q: 'Does Pro work offline?',
    a: 'Pro lets you download a trip’s maps for offline use, and your garage and maintenance log work offline on every plan. AI diagnostics, receipt scans and route discovery need a connection.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Switch from monthly to annual (or back) at any time; the difference is pro-rated automatically.',
  },
] as const;

const ANNUAL = STATIC_WEB_PLANS.plans.annual;

/* ── Helpers ───────────────────────────────────────────────────── */

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (typeof value === 'string') {
    return <span className="mv-figure">{value}</span>;
  }
  if (value) {
    return <Check size={18} strokeWidth={2} aria-label="Included" />;
  }
  return <Minus size={18} strokeWidth={2} className="mvp-no" aria-label="Not included" />;
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function ProPage() {
  const lastRow = FREE_VS_PRO.length - 1;
  return (
    <div>
      {/* Hero: the plan in one sentence, the pricing card as the one card */}
      <section className="mvp-section mvp-section--hero">
        <div className="mvp-hero-grid">
          <div>
            <h1 className="mv-section-title">
              More bikes. More AI.
              <br />
              <span className="mv-muted">Logging stays free.</span>
            </h1>
            <p className="mvp-lead">
              One subscription lifts the limits on bikes, AI diagnostics and receipt scans, and adds
              GPX export and offline trip maps. Maintenance, expenses, rides and trips are free for
              every rider, for good.
            </p>
            <ul className="mvp-check-list">
              {[...WEB_OFFER_COPY.heroBullets, 'Works on iPhone, Android and the web'].map(
                (line) => (
                  <li key={line}>
                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                    {line}
                  </li>
                ),
              )}
            </ul>
          </div>

          <PricingCard />
        </div>
      </section>

      {/* What Pro adds: a hairline list, icons inline with the title */}
      <section className="mvp-section mvp-section--features">
        <h2 className="mv-h2">What Pro adds</h2>
        <p className="mvp-sub">
          Pro is one bundle, not a tier ladder. It lifts the limits on bikes and AI and adds GPX
          export and offline maps. Everything you log stays free.
        </p>
        <ul className="mvp-features">
          {PRO_FEATURES.map((f) => {
            const Icon = FEATURE_ICONS[f.key];
            return (
              <li key={f.key} className="mvp-feature">
                <h3 className="mvp-feature-title">
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  {f.title}
                </h3>
                <p className="mvp-feature-body">{f.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Free vs Pro: hairline rows, the Pro column carried as the one card */}
      <section className="mvp-section mvp-section--compare" aria-labelledby="mvp-compare-title">
        <h2 id="mvp-compare-title" className="mv-h2">
          Free and Pro, side by side
        </h2>
        <div className="mvp-compare-wrap">
          <table className="mv-table mvp-compare">
            <colgroup>
              <col />
              <col className="mvp-compare-col--value" />
              <col className="mvp-compare-col--pro" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="mvp-compare-cell mvp-compare-cell--head">
                  What you get
                </th>
                <th
                  scope="col"
                  className="mvp-compare-cell mvp-compare-cell--head mvp-compare-cell--value"
                >
                  Free
                </th>
                <th
                  scope="col"
                  className="mvp-compare-cell mvp-compare-cell--head mvp-compare-cell--value mvp-compare-cell--pro"
                >
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {FREE_VS_PRO.map((row, i) => {
                const last = i === lastRow ? ' mvp-compare-cell--last' : '';
                return (
                  <tr key={row.name}>
                    <th scope="row" className={`mvp-compare-cell${last}`}>
                      {row.name}
                    </th>
                    <td className={`mvp-compare-cell mvp-compare-cell--value${last}`}>
                      <ComparisonCell value={row.free} />
                    </td>
                    <td
                      className={`mvp-compare-cell mvp-compare-cell--value mvp-compare-cell--pro${last}`}
                    >
                      <ComparisonCell value={row.pro} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ: hairline details */}
      <section className="mvp-section mvp-section--faq">
        <h2 className="mv-h2">Questions, answered</h2>
        <div className="mvp-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
              </summary>
              <p className="mvp-faq-body">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final: the one centred block on the page */}
      <section className="mvp-section mvp-section--final">
        <h2 className="mv-h2">Ready when you are</h2>
        <p className="mvp-final-line">{WEB_OFFER_COPY.finalLine}</p>
        <div className="mvp-final-cta">
          <Link href="/pro/checkout?plan=annual" className="mv-btn mv-btn-primary">
            {WEB_OFFER_COPY.finalCta}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <p className="mvp-final-price">
            <span className="mv-figure">{ANNUAL.price}</span>
            <span>
              {ANNUAL.period} · {ANNUAL.sub}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
