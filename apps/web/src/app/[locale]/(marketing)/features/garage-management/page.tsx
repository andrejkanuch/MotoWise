import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { GarageManagementFaq } from './faq';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/garage-management'),
      languages: getHreflangMap('/features/garage-management'),
    },
  };
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const BIKES = [
  {
    abbr: 'MT',
    name: '2022 Yamaha MT-07',
    sub: '14,820 MI \u00b7 DAILY',
    status: 'Healthy',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.7 0.2 40), oklch(0.35 0.12 30))',
    hasMeta: false,
  },
  {
    abbr: 'GS',
    name: '2019 BMW R 1250 GS',
    sub: '32,104 MI \u00b7 TOURING',
    status: 'Oil due',
    statusWarn: true,
    bg: 'linear-gradient(135deg, oklch(0.75 0.18 240), oklch(0.3 0.12 240))',
    hasMeta: true,
  },
  {
    abbr: 'SV',
    name: '2006 Suzuki SV650',
    sub: '68,430 MI \u00b7 PROJECT',
    status: 'Stored',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.8 0.15 110), oklch(0.35 0.1 120))',
    hasMeta: false,
  },
  {
    abbr: 'GR',
    name: '2023 Honda Grom',
    sub: '4,002 MI \u00b7 WEEKENDS',
    status: 'Healthy',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.72 0.14 340), oklch(0.3 0.09 340))',
    hasMeta: false,
  },
] as const;

const CARD_POSITIONS = [
  { top: 0, transform: 'rotate(-2.5deg) translateX(-12px) scale(0.94)', zIndex: 1, opacity: 0.82 },
  { top: 74, transform: 'rotate(1.5deg)', zIndex: 3, opacity: 1 },
  { top: 150, transform: 'rotate(-1deg) translateX(8px) scale(0.97)', zIndex: 2, opacity: 0.93 },
  { top: 240, transform: 'rotate(2deg) translateX(-6px) scale(0.92)', zIndex: 1, opacity: 0.78 },
] as const;

const MAINT_ROWS = [
  {
    icon: 'M12 2v6 M5 10h14 M7 10v10a2 2 0 002 2h6a2 2 0 002-2V10',
    label: 'Oil change',
    sub: 'MOBIL 1 15W-50 \u00b7 3.2 QT',
    date: 'Mar 12, 2026',
    miles: '14,220 mi',
    status: 'Done',
    statusType: 'done',
  },
  {
    icon: 'M12 12m-8 0a8 8 0 1016 0 8 8 0 10-16 0 M12 4v4 M12 16v4 M4 12h4 M16 12h4',
    label: 'Chain clean & lube',
    sub: 'MOTUL C2+ \u00b7 EVERY 600 MI',
    date: 'Due in 120 mi',
    miles: '14,820 mi now',
    status: 'Due soon',
    statusType: 'due',
  },
  {
    icon: 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0 M12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0',
    label: 'Rear tire replacement',
    sub: 'PIRELLI ROSSO III \u00b7 180/55',
    date: 'Feb 4, 2026',
    miles: '12,940 mi',
    status: 'Done',
    statusType: 'done',
  },
  {
    icon: 'M5 5h14v14H5z M9 9l6 6',
    label: 'Valve clearance check',
    sub: 'MT-07 \u00b7 EVERY 24K MI',
    date: 'In ~9,000 mi',
    miles: '24,000 mi',
    status: 'Upcoming',
    statusType: 'wait',
  },
  {
    icon: 'M4 12h16 M4 6h16 M4 18h16',
    label: 'Brake pad inspection',
    sub: 'EBC FA \u00b7 4MM REMAINING',
    date: 'Feb 4, 2026',
    miles: '12,940 mi',
    status: 'Done',
    statusType: 'done',
  },
] as const;

export default async function GarageManagementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');

  const canonical = getCanonicalUrl(locale, '/features/garage-management');

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features/garage-management',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/garage-management',
    ),
    buildFAQPage(faqItems, `${locale}/features/garage-management/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* ════ HERO ════ */}
      <section
        style={{
          position: 'relative',
          padding: '180px 40px 100px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
            fontSize: 11,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          <Link href="/" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            MotoVault
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <Link href="/features" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            Features
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <span style={{ color: 'var(--mv-warm-400)' }}>{t('title')}</span>
        </nav>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1fr',
            gap: 80,
            alignItems: 'center',
          }}
        >
          {/* Text column */}
          <div>
            <div className="mv-section-meta">Feature &middot; 03</div>
            <h1
              style={{
                fontSize: 'clamp(48px, 7.5vw, 112px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                margin: '24px 0 0',
              }}
            >
              <span style={{ display: 'block' }}>Every bike.</span>
              <span style={{ display: 'block' }}>
                <em className="mv-serif">One vault.</em>
              </span>
            </h1>
            <p
              style={{
                marginTop: 32,
                color: 'var(--mv-ink-2)',
                fontSize: 18,
                lineHeight: 1.55,
                maxWidth: 520,
                letterSpacing: '-0.01em',
              }}
            >
              {t('heroSubtitle')}
            </p>
            <div style={{ marginTop: 40, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/#download" className="mv-btn mv-btn-primary">
                <span>Build your garage</span>
                <ArrowIcon />
              </Link>
              <a href="#maint" className="mv-btn mv-btn-ghost">
                See the tools
              </a>
            </div>
          </div>

          {/* Garage stack visual */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '4/4.3' }}>
              {BIKES.map((bike, i) => {
                const pos = CARD_POSITIONS[i];
                return (
                  <div
                    key={bike.abbr}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      background:
                        'linear-gradient(145deg, oklch(0.18 0.015 55), oklch(0.12 0.01 55))',
                      border: '1px solid var(--mv-line)',
                      borderRadius: 22,
                      padding: '22px 24px',
                      boxShadow: '0 30px 60px -20px oklch(0 0 0 / 0.7)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      top: pos.top,
                      transform: pos.transform,
                      zIndex: pos.zIndex,
                      opacity: pos.opacity,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          background: bike.bg,
                          color: '#000',
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {bike.abbr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {bike.name}
                        </div>
                        <div
                          className="mv-mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--mv-ink-3)',
                            marginTop: 4,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {bike.sub}
                        </div>
                      </div>
                      <div
                        className="mv-mono"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 999,
                          background: bike.statusWarn
                            ? 'oklch(0.76 0.18 60 / 0.15)'
                            : 'oklch(0.72 0.2 145 / 0.15)',
                          border: `1px solid ${bike.statusWarn ? 'oklch(0.76 0.18 60 / 0.35)' : 'oklch(0.72 0.2 145 / 0.35)'}`,
                          color: bike.statusWarn ? 'var(--mv-warm-400)' : 'var(--mv-success)',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {bike.status}
                      </div>
                    </div>
                    {bike.hasMeta && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: '1px solid var(--mv-line)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 10,
                        }}
                      >
                        {[
                          { label: 'Services', value: '34' },
                          { label: 'This year', value: '$1,204' },
                          { label: 'Cost/mi', value: '$0.24' },
                        ].map((m) => (
                          <div
                            key={m.label}
                            className="mv-mono"
                            style={{
                              fontSize: 10,
                              color: 'var(--mv-ink-3)',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {m.label}
                            <strong
                              style={{
                                display: 'block',
                                fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                                fontSize: 13,
                                color: 'var(--mv-ink)',
                                fontWeight: 500,
                                textTransform: 'none',
                                letterSpacing: '-0.005em',
                                marginTop: 2,
                              }}
                            >
                              {m.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════ PILLARS ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">One vault &middot; everything</div>
          <h2 className="mv-section-title">
            Everything your bike <span className="mv-serif">deserves to remember.</span>
          </h2>
        </div>

        <div
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {[
            { num: '01', title: 'Unlimited bikes.', body: 'Daily, weekend, touring, project, sold. Keep them all \u2014 even retired bikes stay searchable for when a buyer asks about service history.', kvLabel: 'Cost', kvValue: 'Free \u00b7 forever' },
            { num: '02', title: 'Auto-loaded specs.', body: 'Search your make & model \u2014 MotoVault pre-fills tank size, tire specs, service intervals and torque values for 12,000+ bikes.', kvLabel: 'Database', kvValue: '12k+ models' },
            { num: '03', title: 'Maintenance reminders.', body: "Mileage or time-based, tuned to each bike\u2019s service schedule. Alerts land before you\u2019re overdue \u2014 not the day the light turns on.", kvLabel: 'Reminders', kvValue: 'Per-bike & smart' },
            { num: '04', title: 'Expense tracking.', body: 'Fuel, parts, gear, insurance, storage \u2014 categorized and rolled up monthly. See your true cost-per-mile for every bike.', kvLabel: 'Categories', kvValue: '8 built-in' },
            { num: '05', title: 'Documents vault.', body: 'Registration, insurance card, service receipts, VIN. Encrypted, synced, one tap away when the officer asks.', kvLabel: 'Storage', kvValue: 'Encrypted \u00b7 synced' },
            { num: '06', title: 'Exportable history.', body: 'Selling a bike? Export a full service report as PDF \u2014 every oil change, every tire, every receipt. Adds real resale value.', kvLabel: 'Export', kvValue: 'PDF \u00b7 CSV' },
          ].map((p) => (
            <div
              key={p.num}
              style={{
                background: 'var(--mv-bg)',
                padding: 40,
                minHeight: 260,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="mv-mono"
                style={{ fontSize: 11, color: 'var(--mv-warm-400)', letterSpacing: '0.15em' }}
              >
                {p.num}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  margin: '32px 0 14px',
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  color: 'var(--mv-ink-3)',
                  fontSize: 14,
                  lineHeight: 1.55,
                  letterSpacing: '-0.005em',
                  flex: 1,
                }}
              >
                {p.body}
              </div>
              <div
                className="mv-mono"
                style={{
                  marginTop: 24,
                  paddingTop: 24,
                  borderTop: '1px solid var(--mv-line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {p.kvLabel}
                <strong
                  style={{
                    fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                    fontSize: 14,
                    color: 'var(--mv-warm-400)',
                    fontWeight: 500,
                    textTransform: 'none',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {p.kvValue}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ MAINTENANCE TIMELINE ════ */}
      <section
        id="maint"
        style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}
      >
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">Maintenance timeline</div>
          <h2 className="mv-section-title">
            Never be surprised by <span className="mv-serif">a service again.</span>
          </h2>
          <p className="mv-section-sub">
            A live timeline of what&apos;s done, what&apos;s due and what&apos;s coming &mdash; per
            bike, in one view.
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
            border: '1px solid var(--mv-line)',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          {MAINT_ROWS.map((row, i, arr) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 1fr auto',
                gap: 20,
                padding: '20px 24px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--mv-line)' : 'none',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'oklch(1 0 0 / 0.04)',
                  border: '1px solid var(--mv-line)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--mv-warm-400)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={row.icon} />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {row.label}
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--mv-ink-3)',
                    marginTop: 3,
                    letterSpacing: '0.04em',
                  }}
                >
                  {row.sub}
                </div>
              </div>
              <div
                className="mv-mono"
                style={{ fontSize: 12, color: 'var(--mv-ink-2)', letterSpacing: '0.04em' }}
              >
                {row.date}
              </div>
              <div
                className="mv-mono"
                style={{ fontSize: 12, color: 'var(--mv-ink-3)', letterSpacing: '0.04em' }}
              >
                {row.miles}
              </div>
              <div
                className="mv-mono"
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  background:
                    row.statusType === 'done'
                      ? 'oklch(0.72 0.2 145 / 0.15)'
                      : row.statusType === 'due'
                        ? 'oklch(0.76 0.18 60 / 0.15)'
                        : 'oklch(1 0 0 / 0.04)',
                  color:
                    row.statusType === 'done'
                      ? 'var(--mv-success)'
                      : row.statusType === 'due'
                        ? 'var(--mv-warm-400)'
                        : 'var(--mv-ink-3)',
                }}
              >
                {row.status}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ EXPENSES -- donut chart ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">Expenses &amp; cost/mile</div>
          <h2 className="mv-section-title">
            Know what your bike <span className="mv-serif">really costs.</span>
          </h2>
          <p className="mv-section-sub">
            Every fill-up, service and gear purchase &mdash; rolled up into the numbers that actually
            matter.
          </p>
        </div>

        <div
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'center',
          }}
        >
          {/* Donut */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 340,
              aspectRatio: '1',
              margin: '0 auto',
            }}
          >
            <svg
              viewBox="0 0 100 100"
              style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            >
              <circle cx="50" cy="50" r="40" stroke="oklch(1 0 0 / 0.04)" strokeWidth="14" fill="none" />
              <circle cx="50" cy="50" r="40" stroke="oklch(0.76 0.18 60)" strokeWidth="14" fill="none" strokeDasharray="88 251.33" strokeDashoffset="0" strokeLinecap="butt" />
              <circle cx="50" cy="50" r="40" stroke="oklch(0.84 0.15 68)" strokeWidth="14" fill="none" strokeDasharray="63 251.33" strokeDashoffset="-88" strokeLinecap="butt" />
              <circle cx="50" cy="50" r="40" stroke="oklch(0.6 0.13 60)" strokeWidth="14" fill="none" strokeDasharray="48 251.33" strokeDashoffset="-151" strokeLinecap="butt" />
              <circle cx="50" cy="50" r="40" stroke="oklch(0.45 0.1 60)" strokeWidth="14" fill="none" strokeDasharray="52 251.33" strokeDashoffset="-199" strokeLinecap="butt" />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 500,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  $214
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginTop: 8,
                  }}
                >
                  March &middot; 2026
                </div>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { color: 'oklch(0.76 0.18 60)', label: 'Fuel', sub: '14 fill-ups \u00b7 34% of total', value: '$75.20' },
              { color: 'oklch(0.84 0.15 68)', label: 'Maintenance', sub: 'Oil, chain lube \u00b7 25%', value: '$53.80' },
              { color: 'oklch(0.6 0.13 60)', label: 'Parts', sub: 'Brake pads \u00b7 19%', value: '$42.10' },
              { color: 'oklch(0.45 0.1 60)', label: 'Insurance & misc', sub: 'Monthly \u00b7 22%', value: '$43.70' },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  paddingBottom: i < arr.length - 1 ? 16 : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--mv-line)' : 'none',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 34,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: item.color,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, letterSpacing: '-0.005em' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--mv-ink-3)', marginTop: 2, letterSpacing: '0.03em' }}>
                    {item.sub}
                  </div>
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 14,
                    color: 'var(--mv-ink)',
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ STATS ROW ════ */}
      <section
        style={{
          padding: '80px 40px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 48,
          borderTop: '1px solid var(--mv-line)',
          borderBottom: '1px solid var(--mv-line)',
        }}
      >
        {[
          { value: '\u221e', unit: '', label: 'Bikes per garage. Seriously.' },
          { value: '12', unit: 'k+', label: 'Models with pre-loaded specs.' },
          { value: '$0.23', unit: '/mi', label: 'Avg. rider cost tracked.' },
          { value: '8', unit: ' cats', label: 'Expense categories built-in.' },
        ].map((s) => (
          <div key={s.label} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: 24 }}>
            <div
              style={{
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                fontWeight: 500,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: 'var(--mv-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
              {s.unit && (
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {s.unit}
                </span>
              )}
            </div>
            <div style={{ marginTop: 12, color: 'var(--mv-ink-3)', fontSize: 13, letterSpacing: '-0.005em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* ════ CTA ════ */}
      <section
        style={{
          padding: '180px 40px',
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 80% at 50% 50%, oklch(0.76 0.18 60 / 0.16), transparent 70%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.7), oklch(0.09 0.008 55 / 0.95))',
            zIndex: -1,
          }}
          aria-hidden="true"
        />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div className="mv-section-meta" style={{ justifyContent: 'center' }}>
            Build your garage
          </div>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            Ride,{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              remember.
            </span>
          </h2>
          <p style={{ margin: '24px auto 0', maxWidth: 460, fontSize: 17, color: 'var(--mv-ink-2)', lineHeight: 1.55, letterSpacing: '-0.01em' }}>
            Free forever. Set up your first bike in under 90 seconds.
          </p>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/#download" className="mv-btn mv-btn-primary">
              <span>Get the app</span>
            </Link>
            <Link href="/features/ai-diagnostics" className="mv-btn mv-btn-ghost">
              See AI diagnostics &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ════ NEXT FEATURE CARDS ════ */}
      <section style={{ padding: '100px 40px 140px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <Link
            href="/features/learning-paths"
            style={{ background: 'var(--mv-bg)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 260, textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <div className="mv-mono" style={{ fontSize: 11, color: 'var(--mv-ink-3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Next feature &middot; 04
              </div>
              <div style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 16 }}>
                Learning <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>paths.</span>
              </div>
            </div>
            <div style={{ marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--mv-warm-400)', fontWeight: 500 }}>
              Novice to expert.
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/features/trip-planning"
            style={{ background: 'var(--mv-bg)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 260, textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <div className="mv-mono" style={{ fontSize: 11, color: 'var(--mv-ink-3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Or see &middot; 01
              </div>
              <div style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 16 }}>
                Trip <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>planning.</span>
              </div>
            </div>
            <div style={{ marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--mv-warm-400)', fontWeight: 500 }}>
              Multi-day routes.
              <ArrowIcon />
            </div>
          </Link>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="mv-section-meta">Support</div>
          <h2 className="mv-section-title">Frequently Asked Questions</h2>
          <div style={{ marginTop: 48 }}>
            <GarageManagementFaq items={faqItems} />
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CTA ════ */}
      <FeatureCta />
    </>
  );
}
