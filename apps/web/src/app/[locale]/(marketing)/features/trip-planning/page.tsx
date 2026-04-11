import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { TripPlanningFlowStepper } from '@/components/marketing/trip-planning-flow-stepper';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCanonicalUrl } from '@/lib/constants';
import { TripPlanningFaq } from './trip-planning-faq';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesTripPlanning');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/trip-planning'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/features/trip-planning')]),
        ['x-default', getCanonicalUrl('en', '/features/trip-planning')],
      ]),
    },
  };
}

const WAYPOINT_TYPES = [
  { key: 'start', label: 'Start', color: 'oklch(0.70 0.16 150)' },
  { key: 'end', label: 'End', color: 'oklch(0.62 0.18 25)' },
  { key: 'fuel', label: 'Fuel', color: 'oklch(0.72 0.16 70)' },
  { key: 'food', label: 'Food', color: 'oklch(0.72 0.14 50)' },
  { key: 'scenic', label: 'Scenic', color: 'oklch(0.65 0.14 230)' },
  { key: 'overnight', label: 'Overnight', color: 'oklch(0.55 0.15 270)' },
  { key: 'photo', label: 'Photo', color: 'oklch(0.68 0.15 200)' },
  { key: 'mechanical', label: 'Mechanical', color: 'oklch(0.65 0.14 0)' },
  { key: 'ferry', label: 'Ferry', color: 'oklch(0.65 0.14 210)' },
  { key: 'pass_summit', label: 'Pass Summit', color: 'oklch(0.70 0.15 40)' },
  { key: 'rally_point', label: 'Rally Point', color: 'oklch(0.68 0.15 180)' },
] as const;

const FEATURE_CARDS = [
  {
    titleKey: 'f1Title',
    descKey: 'f1Desc',
    // calendar
    icon: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  },
  {
    titleKey: 'f2Title',
    descKey: 'f2Desc',
    // pin
    icon: 'M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  },
  {
    titleKey: 'f3Title',
    descKey: 'f3Desc',
    // route
    icon: 'M4 5a3 3 0 1 1 6 0v14a3 3 0 0 0 6 0V5a3 3 0 1 1 6 0',
  },
  {
    titleKey: 'f4Title',
    descKey: 'f4Desc',
    // lock/eye
    icon: 'M12 5c5 0 9 5 9 7s-4 7-9 7-9-5-9-7 4-7 9-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    titleKey: 'f5Title',
    descKey: 'f5Desc',
    // users
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  },
  {
    titleKey: 'f6Title',
    descKey: 'f6Desc',
    // draft doc
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 14l2 2 4-4',
  },
  {
    titleKey: 'f7Title',
    descKey: 'f7Desc',
    // bars/difficulty
    icon: 'M3 20h4V10H3zM10 20h4V4h-4zM17 20h4v-8h-4z',
  },
  {
    titleKey: 'f8Title',
    descKey: 'f8Desc',
    // share
    icon: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  },
] as const;

export default async function TripPlanningPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesTripPlanning');

  const canonical = getCanonicalUrl(locale, '/features/trip-planning');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getCanonicalUrl(locale) },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Features',
        item: getCanonicalUrl(locale, '/features'),
      },
      { '@type': 'ListItem', position: 3, name: t('title'), item: canonical },
    ],
  };

  const faqItems = [0, 1, 2, 3, 4, 5].map((i) => ({
    question: t(`faq${i}Question`),
    answer: t(`faq${i}Answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  const steps = [
    {
      number: '1',
      label: t('step1Label'),
      title: t('step1Title'),
      description: t('step1Desc'),
      screenshot: '/images/features/trip-planning/trip-planning-new.png',
      alt: 'MotoVault trip planner — blank dark map over New York ready for waypoints',
    },
    {
      number: '2',
      label: t('step2Label'),
      title: t('step2Title'),
      description: t('step2Desc'),
      screenshot: '/images/features/trip-planning/trip-planning-edit.png',
      alt: 'MotoVault trip planner — Dolomites route with typed waypoints rendered on the map',
    },
    {
      number: '3',
      label: t('step3Label'),
      title: t('step3Title'),
      description: t('step3Desc'),
      screenshot: '/images/features/trip-planning/trip-detail-hero.png',
      alt: 'MotoVault trip detail — title, difficulty badge, dates, organiser and route',
    },
    {
      number: '4',
      label: t('step4Label'),
      title: t('step4Title'),
      description: t('step4Desc'),
      screenshot: '/images/features/trip-planning/trip-detail-itinerary.png',
      alt: 'MotoVault trip detail — expanded itinerary with Day 1 waypoints and notes',
    },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features" className="transition-colors hover:text-neutral-300">
              Features
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features/trip-planning" className="text-neutral-300" aria-current="page">
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero — distinctive: map backdrop + hand-drawn route SVG */}
      <section className="relative px-6 pb-16 pt-8 md:pb-28 md:pt-14">
        {/* Layered topo + route motif */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* soft radial glow */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 50% 10%, oklch(0.76 0.13 70 / 0.12), transparent 70%)',
            }}
          />
          {/* route polyline across the hero */}
          <svg
            className="absolute inset-x-0 top-[42%] mx-auto h-44 w-full max-w-6xl opacity-[0.35]"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="tp-route" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.70 0.16 150)" stopOpacity="0.0" />
                <stop offset="15%" stopColor="oklch(0.70 0.16 150)" stopOpacity="0.9" />
                <stop offset="50%" stopColor="oklch(0.76 0.13 70)" stopOpacity="0.9" />
                <stop offset="85%" stopColor="oklch(0.62 0.18 25)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="oklch(0.62 0.18 25)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0 130 C120 80 200 150 320 110 S520 40 660 100 S900 170 1040 90 L1200 60"
              fill="none"
              stroke="url(#tp-route)"
              strokeWidth="2.5"
              strokeDasharray="6 8"
              strokeLinecap="round"
            />
            {/* waypoint dots */}
            {[
              { x: 120, y: 100, c: 'oklch(0.70 0.16 150)' },
              { x: 320, y: 110, c: 'oklch(0.65 0.14 230)' },
              { x: 520, y: 70, c: 'oklch(0.55 0.15 270)' },
              { x: 660, y: 100, c: 'oklch(0.70 0.15 40)' },
              { x: 820, y: 130, c: 'oklch(0.72 0.16 70)' },
              { x: 1040, y: 90, c: 'oklch(0.62 0.18 25)' },
            ].map((p) => (
              <g key={`${p.x}-${p.y}`}>
                <circle cx={p.x} cy={p.y} r="7" fill={p.c} fillOpacity="0.25" />
                <circle cx={p.x} cy={p.y} r="3.5" fill={p.c} />
              </g>
            ))}
          </svg>
          {/* topo contour lines */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.06]"
            viewBox="0 0 1200 600"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g fill="none" stroke="oklch(0.76 0.13 70)" strokeWidth="0.8">
              <path d="M0 100 Q300 60 600 110 T1200 80" />
              <path d="M0 160 Q320 120 620 170 T1200 140" />
              <path d="M0 220 Q280 180 580 230 T1200 200" />
              <path d="M0 280 Q300 240 600 290 T1200 260" />
              <path d="M0 340 Q320 300 620 350 T1200 320" />
              <path d="M0 400 Q280 360 580 410 T1200 380" />
              <path d="M0 460 Q300 420 600 470 T1200 440" />
            </g>
          </svg>
        </div>

        <div className="reveal-on-scroll relative mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('heroEyebrow')}
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-neutral-50 sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-40 rounded-full bg-gradient-to-r from-warm-400 via-signature-500 to-warm-400" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>

          {/* CTA pair */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#download"
              className="group inline-flex items-center gap-2 rounded-full bg-warm-500 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-warm-500/20 transition-all hover:-translate-y-0.5 hover:bg-warm-400"
            >
              {t('heroCtaPrimary')}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#real-trip"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/60 px-6 py-3 text-sm font-semibold text-neutral-200 backdrop-blur transition-colors hover:border-warm-500/50 hover:text-warm-300"
            >
              {t('heroCtaSecondary')}
            </a>
          </div>
        </div>
      </section>

      {/* Positioning / "Why we built this first" — CEO-friendly narrative */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="reveal-on-scroll rounded-2xl border border-warm-500/15 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-8 shadow-xl backdrop-blur-sm md:p-12">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-warm-500/10 text-warm-400">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
                Founder's Note
              </p>
            </div>
            <h2 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-neutral-50 sm:text-3xl">
              {t('positioningTitle')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-neutral-300 md:text-lg">
              {t('positioningBody')}
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Step-by-step */}
      <TripPlanningFlowStepper
        sectionLabel={t('howItWorksLabel')}
        sectionTitle={t('howItWorksTitle')}
        steps={steps}
      />

      {/* Divider */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Waypoint types chip strip */}
      <section className="reveal-on-scroll px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Typed Waypoints
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
            Eleven waypoint types, one living map
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
            Every stop on a trip has a type, an icon, and its own semantic meaning. The itinerary,
            the map, and the analytics all understand the difference between a fuel stop and an
            overnight.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-2.5">
            {WAYPOINT_TYPES.map((wp) => (
              <span
                key={wp.key}
                className="group inline-flex items-center gap-2 rounded-full border border-neutral-800/80 bg-neutral-900/70 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full ring-2 ring-transparent transition-all group-hover:ring-neutral-800"
                  style={{ backgroundColor: wp.color }}
                  aria-hidden="true"
                />
                {wp.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Real Trip phone gallery */}
      <section id="real-trip" className="relative px-6 py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 50%, oklch(0.76 0.13 70 / 0.07), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('galleryLabel')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('galleryTitle')}
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-neutral-400">{t('galleryBody')}</p>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-6 md:flex-row md:items-start md:gap-8 lg:gap-10"
            style={{ perspective: '1200px' }}
          >
            {[
              {
                src: '/images/features/trip-planning/trip-detail-hero.png',
                alt: 'Dolomites Loop trip detail — map with route, title, difficulty, dates',
                label: t('gallery1Label'),
                subtitle: t('gallery1Subtitle'),
                rot: 'rotateY(3deg)',
              },
              {
                src: '/images/features/trip-planning/trip-detail-itinerary.png',
                alt: 'Dolomites Loop itinerary — Day 1 waypoints with icons and notes',
                label: t('gallery2Label'),
                subtitle: t('gallery2Subtitle'),
                rot: 'none',
              },
              {
                src: '/images/features/trip-planning/trip-detail-full.png',
                alt: 'Dolomites Loop full itinerary — Day 1 and Day 2 waypoints',
                label: t('gallery3Label'),
                subtitle: t('gallery3Subtitle'),
                rot: 'rotateY(-3deg)',
              },
            ].map((shot, i) => (
              <div
                key={shot.src}
                className="reveal-on-scroll flex flex-col items-center gap-4"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div
                  className={`relative w-[240px] md:w-[260px] lg:w-[280px] ${i === 1 ? 'z-10' : 'z-0'}`}
                >
                  <div
                    className="relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-neutral-700/50 transition-transform duration-500 hover:-translate-y-2"
                    style={{ transform: shot.rot }}
                  >
                    <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-neutral-800" />
                    <div className="overflow-hidden rounded-[2rem]">
                      <Image
                        src={shot.src}
                        alt={shot.alt}
                        width={1206}
                        height={2322}
                        className="block w-full"
                        sizes="280px"
                        loading="lazy"
                      />
                    </div>
                    <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-neutral-700" />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
                    style={{
                      background:
                        'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.70 0.16 150 / 0.1), transparent)',
                    }}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-neutral-300">{shot.label}</p>
                  <p className="mt-1 text-xs text-neutral-500">{shot.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Feature grid — 8 cards */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('featuresLabel')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('featuresTitle')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_CARDS.map((feature, index) => (
              <div
                key={feature.titleKey}
                className="card-lift reveal-on-scroll group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 text-warm-400 transition-colors group-hover:bg-warm-500/10">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-neutral-50">{t(feature.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Narrative long-form */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('walkthroughLabel')}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('walkthroughTitle')}
          </h2>

          <div className="mt-10 space-y-6 text-lg leading-relaxed text-neutral-300">
            <p>{t('walkthroughP1')}</p>
            <p>{t('walkthroughP2')}</p>
            <p>{t('walkthroughP3')}</p>
            <p>{t('walkthroughP4')}</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* FAQ */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('faqLabel')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('faqTitle')}
            </h2>
          </div>
          <TripPlanningFaq items={faqItems} />
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
