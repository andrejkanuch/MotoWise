import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { buildArticle } from '@/lib/seo/schema';
import { TclocsChecklist } from './tclocs-checklist';
import '@/components/marketing/trackside-read.css';

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

  const articleUrl = getCanonicalUrl(locale, '/tools/tclocs-checklist');
  const articleSchema = buildArticle({
    url: articleUrl,
    headline: t('title'),
    description: t('description'),
    image: `${BASE_URL}/og-image.png`,
    datePublished: '2026-01-15',
    dateModified: '2026-05-27',
    authorName: 'Andrej Kanuch',
    authorUrl: `${BASE_URL}/about`,
    locale,
    slug: 'tclocs-checklist',
  });

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

  const faq = [
    {
      question: 'How long does a TCLOCS inspection take?',
      answer:
        'A thorough TCLOCS check takes about 10 minutes once you know the routine. With practice you can do a quick visual scan in under 5 minutes for daily rides and keep the full inspection for weekly or pre-trip checks.',
    },
    {
      question: 'Should I do TCLOCS before every single ride?',
      answer:
        'The MSF recommends a check before every ride. In practice, a full TCLOCS weekly or before trips and a quick tire, light and leak scan before daily rides is a reasonable approach. If the bike has been sitting for more than a week, always do the full check.',
    },
    {
      question: 'What should I do if I find a problem during TCLOCS?',
      answer:
        'It depends on the severity. Critical issues (brake failure, flat tire, major leak) mean do not ride until fixed. Minor issues (low tire pressure, dirty chain) can often be addressed immediately. When in doubt, err on the side of caution: riding with a known issue is an unnecessary risk.',
    },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={articleSchema} />

      <section className="mv-wide" style={{ paddingBottom: 0 }}>
        <header className="mv-tool">
          <h1 className="mv-index-h1">
            {t('heroTitleAccent')} <span className="mv-muted">{t('heroTitleRest')}</span>
          </h1>
          <p className="mv-index-lede">{t('heroSubtitle')}</p>
        </header>
      </section>

      <TclocsChecklist categories={categories} labels={labels} />

      {/* The article sits in the same 1040 column as the hero and the checklist */}
      <section className="mv-wide" style={{ paddingTop: 96 }}>
        <article className="mv-tool">
          <div className="mv-read-body">
            <h2>The complete guide to the TCLOCS pre-ride inspection</h2>
            <p>
              TCLOCS is a systematic motorcycle safety inspection developed by the Motorcycle Safety
              Foundation (MSF). The acronym stands for Tires, Controls, Lights, Oil, Chassis, and
              Stands: six categories that cover every critical system on your motorcycle. A thorough
              TCLOCS check takes about 10 minutes and should be performed before every ride.
            </p>

            <h3>T: tires and wheels</h3>
            <p>
              Tires are your only contact with the road. Check air pressure with a gauge (cold,
              before riding) and compare to the spec on the sidewall or owner&apos;s manual.
              Under-inflation causes sluggish handling and overheating, while over-inflation reduces
              grip. Inspect tread depth across the full surface; the legal minimum is 1 mm in most
              regions, but replace tires before reaching that point. Look for cracks, cuts, bulges,
              or embedded objects like nails. Check that wheel axle nuts are tight and inspect
              spoked wheels for loose or broken spokes.
            </p>

            <h3>C: controls</h3>
            <p>
              Controls include everything you operate with your hands and feet. Squeeze both brake
              levers: they should feel firm with no sponginess. Check clutch lever free play and
              cable condition. Verify the throttle snaps closed when released (a sticking throttle
              is a serious hazard). Test the horn and kill switch. Ensure foot pegs are secure and
              fold properly, and check that shift and brake pedals have correct height and travel.
            </p>

            <h3>L: lights and electrics</h3>
            <p>
              Visibility saves lives. Turn on the ignition and verify that the headlight (low beam
              and high beam), tail light, brake light (activated by both front lever and rear
              pedal), and all turn signals are working. Check that the instrument panel lights up
              correctly with no persistent warning indicators. A dead brake light or turn signal is
              one of the most common causes of motorcycle rear-end collisions.
            </p>

            <h3>O: oil and fluids</h3>
            <p>
              Check engine oil level via the sight glass or dipstick with the bike upright on level
              ground. Inspect both brake fluid reservoirs (front handlebar and rear frame): fluid
              should be above the minimum line and clear or amber in colour. Dark or cloudy brake
              fluid needs replacement. For liquid-cooled bikes, check the coolant reservoir. Look
              under the bike for fresh puddles or drips that indicate new leaks.
            </p>

            <h3>C: chassis and chain</h3>
            <p>
              Inspect chain tension by pushing up on the lower run. Correct slack is typically 25–35
              mm, but check your manual. The chain should be clean and lubricated with no tight
              spots or excessive rust. Check sprocket teeth for hooking or wear. Verify the frame
              has no visible cracks, especially around welds and mounting points. Push down on the
              front forks and rear shock to check for smooth operation and look for oil weeping from
              fork seals.
            </p>

            <h3>S: stands</h3>
            <p>
              Verify the side stand retracts fully and the return spring pulls it up firmly. Test
              the side stand engine cut-off switch: on most modern motorcycles, the engine will not
              start or will cut out if the side stand is down with a gear engaged. If your bike has
              a centre stand, check that it deploys and retracts smoothly and holds the bike stable.
            </p>

            <h3>Why TCLOCS matters</h3>
            <p>
              Mechanical failure accounts for a significant share of motorcycle incidents, and most
              failures are preventable with basic pre-ride checks. A nail in a tire, a dead brake
              light, or a low oil level can all be caught in under a minute, but only if you look.
              Making TCLOCS a habit before every ride is the single cheapest safety improvement any
              rider can make.
            </p>
          </div>

          <section className="mv-read-section" aria-labelledby="tclocs-faq-heading">
            <h2 id="tclocs-faq-heading" className="mv-read-h2">
              Questions riders ask
            </h2>
            <div className="mv-read-faq">
              {faq.map((item) => (
                <details key={item.question} className="mv-disclosure is-plus">
                  <summary>
                    {item.question}
                    <svg
                      className="mv-disclosure-mark"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p className="mv-read-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </section>
    </>
  );
}
