import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { TclocsChecklist } from './tclocs-checklist';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('TclocsChecklist');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/tools/tclocs-checklist'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/tools/tclocs-checklist')]),
        ['x-default', `${BASE_URL}/tools/tclocs-checklist`],
      ]),
    },
  };
}

export default async function TclocsChecklistPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('TclocsChecklist');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${BASE_URL}/tools` },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: `${BASE_URL}/tools/tclocs-checklist`,
      },
    ],
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'TCLOCS Motorcycle Pre-Ride Inspection Checklist',
    description:
      'A systematic 6-point motorcycle safety inspection covering Tires, Controls, Lights, Oil, Chassis, and Stands. Complete this check before every ride to catch issues early.',
    totalTime: 'PT10M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'T — Tires & Wheels',
        text: 'Check tire pressure, tread depth, and sidewall condition. Inspect wheels for cracks, loose spokes, and proper axle nut torque. Look for nails, cuts, or bulges in the tire surface.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'C — Controls',
        text: 'Test front and rear brake levers for firm feel and proper free play. Check clutch lever engagement point and cable condition. Verify throttle snaps closed when released. Test horn and kill switch.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'L — Lights & Electrics',
        text: 'Verify headlight (low and high beam), tail light, brake light (both levers), and turn signals are functioning. Check instrument panel warning lights and battery voltage.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'O — Oil & Fluids',
        text: 'Check engine oil level via sight glass or dipstick. Inspect brake fluid reservoirs (front and rear) for proper level and color. Check coolant level if liquid-cooled. Look under the bike for any fresh leaks.',
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: 'C — Chassis & Chain',
        text: 'Inspect chain tension and lubrication. Check sprocket teeth for wear. Verify frame, swingarm, and steering head bearings feel tight with no play. Check suspension for smooth operation and no oil weeping.',
      },
      {
        '@type': 'HowToStep',
        position: 6,
        name: 'S — Stands',
        text: 'Verify side stand retracts fully and spring returns it firmly. Check side stand engine cut-off switch operates correctly. If equipped, test center stand for stability and smooth operation.',
      },
    ],
  };

  const categories = [
    {
      id: 'tires',
      letter: 'T',
      name: t('catTires'),
      items: [
        t('tirePressure'),
        t('tireTread'),
        t('tireCracks'),
        t('tireValves'),
        t('tireBearings'),
      ],
    },
    {
      id: 'controls',
      letter: 'C',
      name: t('catControls'),
      items: [
        t('controlFrontBrake'),
        t('controlRearBrake'),
        t('controlClutch'),
        t('controlThrottle'),
        t('controlHorn'),
      ],
    },
    {
      id: 'lights',
      letter: 'L',
      name: t('catLights'),
      items: [
        t('lightHeadlight'),
        t('lightTail'),
        t('lightBrake'),
        t('lightTurnSignals'),
        t('lightDashboard'),
      ],
    },
    {
      id: 'oil',
      letter: 'O',
      name: t('catOil'),
      items: [t('oilLevel'), t('oilLeaks'), t('oilColor'), t('oilCoolant')],
    },
    {
      id: 'chassis',
      letter: 'C',
      name: t('catChassis'),
      items: [t('chassisFrame'), t('chassisSuspension'), t('chassisFasteners'), t('chassisChain')],
    },
    {
      id: 'stands',
      letter: 'S',
      name: t('catStands'),
      items: [t('standsSide'), t('standsCenter'), t('standsSwitch')],
    },
  ];

  const labels = {
    overallProgress: t('overallProgress'),
    items: t('items'),
    readyToRide: t('readyToRide'),
    resetAll: t('resetAll'),
    printChecklist: t('printChecklist'),
    ctaTitle: t('ctaTitle'),
    ctaDesc: t('ctaDesc'),
    getEarlyAccess: t('getEarlyAccess'),
    timerTitle: t('timerTitle'),
    timerStart: t('timerStart'),
    timerRunning: t('timerRunning'),
    timerComplete: t('timerComplete'),
    personalBest: t('personalBest'),
    newRecord: t('newRecord'),
    noBestYet: t('noBestYet'),
    downloadPdf: t('downloadPdf'),
    pdfTitle: t('pdfTitle'),
    pdfDate: t('pdfDate'),
    pdfStatus: t('pdfStatus'),
    pdfComplete: t('pdfComplete'),
    pdfIncomplete: t('pdfIncomplete'),
    pdfFooter: t('pdfFooter'),
    pdfCta: t('pdfCta'),
    pdfWebsite: t('pdfWebsite'),
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />

      {/* Hero */}
      <section className="px-4 pb-8 pt-24 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            <span className="text-warm-400">{t('heroTitleAccent')}</span> {t('heroTitleRest')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            {t('heroSubtitle')} <strong className="text-neutral-300">{t('heroCategories')}</strong>.
          </p>
        </div>
      </section>

      {/* Checklist */}
      <TclocsChecklist categories={categories} labels={labels} />

      {/* Written guide */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-4">
        <h2 className="mb-6 text-2xl font-bold text-neutral-50">
          The Complete Guide to TCLOCS Motorcycle Pre-Ride Inspection
        </h2>

        <p className="mb-6 text-base leading-relaxed text-neutral-300">
          TCLOCS is a systematic motorcycle safety inspection developed by the Motorcycle Safety
          Foundation (MSF). The acronym stands for Tires, Controls, Lights, Oil, Chassis, and Stands
          — six categories that cover every critical system on your motorcycle. A thorough TCLOCS
          check takes about 10 minutes and should be performed before every ride.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">T — Tires &amp; Wheels</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Tires are your only contact with the road. Check air pressure with a gauge (cold, before
          riding) and compare to the spec on the sidewall or owner&apos;s manual — under-inflation
          causes sluggish handling and overheating, while over-inflation reduces grip. Inspect tread
          depth across the full surface; the legal minimum is 1mm in most regions, but replace tires
          before reaching that point. Look for cracks, cuts, bulges, or embedded objects like nails.
          Check that wheel axle nuts are tight and inspect spoked wheels for loose or broken spokes.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">C — Controls</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Controls include everything you operate with your hands and feet. Squeeze both brake
          levers — they should feel firm with no sponginess. Check clutch lever free play and cable
          condition. Verify the throttle snaps closed when released (a sticking throttle is a
          serious hazard). Test the horn and kill switch. Ensure foot pegs are secure and fold
          properly, and check that shift and brake pedals have correct height and travel.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">
          L — Lights &amp; Electrics
        </h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Visibility saves lives. Turn on the ignition and verify that headlight (low beam and high
          beam), tail light, brake light (activated by both front lever and rear pedal), and all
          turn signals are functioning. Check that the instrument panel lights up correctly with no
          persistent warning indicators. A dead brake light or turn signal is one of the most common
          causes of motorcycle rear-end collisions.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">O — Oil &amp; Fluids</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Check engine oil level via the sight glass or dipstick with the bike upright on level
          ground. Inspect both brake fluid reservoirs (front handlebar and rear frame) — fluid
          should be above the minimum line and clear/amber in color. Dark or cloudy brake fluid
          needs replacement. For liquid-cooled bikes, check the coolant reservoir. Look under the
          bike for fresh puddles or drips that indicate new leaks.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">
          C — Chassis &amp; Chain
        </h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Inspect chain tension by pushing up on the lower run — correct slack is typically 25–35mm
          but check your manual. The chain should be clean and lubricated with no tight spots or
          excessive rust. Check sprocket teeth for hooking or wear. Verify the frame has no visible
          cracks, especially around welds and mounting points. Push down on the front forks and rear
          shock to check for smooth operation and look for oil weeping from fork seals.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">S — Stands</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Verify the side stand retracts fully and the return spring pulls it up firmly. Test the
          side stand engine cut-off switch — on most modern motorcycles, the engine will not start
          or will cut out if the side stand is down with a gear engaged. If your bike has a center
          stand, check that it deploys and retracts smoothly and holds the bike stable.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">Why TCLOCS Matters</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Mechanical failure accounts for a significant percentage of motorcycle incidents, and most
          failures are preventable with basic pre-ride checks. A nail in a tire, a dead brake light,
          or a low oil level can all be caught in under a minute — but only if you look. Making
          TCLOCS a habit before every ride is the single cheapest safety improvement any rider can
          make.
        </p>

        {/* FAQ */}
        <h3 className="mb-4 mt-10 text-lg font-semibold text-neutral-100">
          Frequently Asked Questions
        </h3>
        <dl className="space-y-4">
          <div>
            <dt className="text-base font-medium text-neutral-200">
              How long does a TCLOCS inspection take?
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-neutral-400">
              A thorough TCLOCS check takes about 10 minutes once you know the routine. With
              practice, you can complete a quick visual scan in under 5 minutes for daily rides,
              reserving the full inspection for weekly or pre-trip checks.
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium text-neutral-200">
              Should I do TCLOCS before every single ride?
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-neutral-400">
              The MSF recommends a check before every ride. In practice, a full TCLOCS weekly or
              before trips and a quick tire/light/leak scan before daily rides is a reasonable
              approach. If the bike has been sitting for more than a week, always do the full check.
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium text-neutral-200">
              What should I do if I find a problem during TCLOCS?
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-neutral-400">
              It depends on the severity. Critical issues (brake failure, flat tire, major leak)
              mean do not ride until fixed. Minor issues (low tire pressure, dirty chain) can often
              be addressed immediately. When in doubt, err on the side of caution — riding with a
              known issue is an unnecessary risk.
            </dd>
          </div>
        </dl>
      </section>

      {/* SEO Content */}
      <section className="px-4 py-16 print:hidden">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-neutral-50">{t('seoTitle')}</h2>
          <div className="mt-6 space-y-4 text-neutral-400">
            <p>{t('seoP1')}</p>
            <p>{t('seoP2')}</p>
            <p>{t('seoP3')}</p>
          </div>
        </div>
      </section>
    </>
  );
}
