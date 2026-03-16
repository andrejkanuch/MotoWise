import type { Metadata } from 'next';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL } from '@/lib/constants';
import { TclocsChecklist } from './tclocs-checklist';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'TCLOCS Motorcycle Pre-Ride Checklist | MotoVault',
    description:
      'Interactive TCLOCS pre-ride inspection checklist for motorcycles. Check Tires, Controls, Lights, Oil, Chassis, and Stands before every ride. Print-friendly.',
    keywords: [
      'TCLOCS checklist',
      'motorcycle pre-ride checklist',
      'motorcycle safety inspection',
      'pre-ride inspection',
      'motorcycle checklist',
      'TCLOCS',
    ],
    alternates: {
      canonical: `${BASE_URL}/tools/tclocs-checklist`,
      languages: {
        en: `${BASE_URL}/tools/tclocs-checklist`,
        es: `${BASE_URL}/es/tools/tclocs-checklist`,
        de: `${BASE_URL}/de/tools/tclocs-checklist`,
        fr: `${BASE_URL}/fr/tools/tclocs-checklist`,
        it: `${BASE_URL}/it/tools/tclocs-checklist`,
        'x-default': `${BASE_URL}/tools/tclocs-checklist`,
      },
    },
  };
}

export default function TclocsChecklistPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: `${BASE_URL}/tools`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'TCLOCS Pre-Ride Checklist',
        item: `${BASE_URL}/tools/tclocs-checklist`,
      },
    ],
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'TCLOCS Motorcycle Pre-Ride Inspection',
    description:
      'A comprehensive pre-ride safety inspection following the TCLOCS method recommended by the Motorcycle Safety Foundation.',
    totalTime: 'PT10M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Tires',
        text: 'Check tire pressure, inspect tread depth (minimum 2mm), look for cracks or damage, check valve stems, and verify wheel bearings.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Controls',
        text: 'Test front brake lever, test rear brake pedal, check clutch free play, verify throttle snap-back, and test horn.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Lights',
        text: 'Check headlight on low and high beam, tail light, brake light from both levers, all 4 turn signals, and dashboard warning lights.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Oil',
        text: 'Check oil level, look for leaks, verify oil color is not black or gritty, and check coolant level if liquid-cooled.',
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: 'Chassis',
        text: 'Inspect frame for cracks, check suspension for leaks and smooth operation, verify fasteners are tight, and check chain tension and lubrication.',
      },
      {
        '@type': 'HowToStep',
        position: 6,
        name: 'Stands',
        text: 'Verify side stand retracts fully, check center stand if equipped, and test that the stand switch works (engine should cut when stand is down in gear).',
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />

      {/* Hero */}
      <section className="px-4 pb-8 pt-24 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            <span className="text-warm-400">TCLOCS</span> Pre-Ride Checklist
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            The Motorcycle Safety Foundation recommends the TCLOCS inspection before every ride. Tap
            each item to check it off &mdash;{' '}
            <strong className="text-neutral-300">
              Tires, Controls, Lights, Oil, Chassis, Stands
            </strong>
            .
          </p>
        </div>
      </section>

      {/* Checklist */}
      <TclocsChecklist />

      {/* SEO Content */}
      <section className="px-4 py-16 print:hidden">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-neutral-50">What is TCLOCS?</h2>
          <div className="mt-6 space-y-4 text-neutral-400">
            <p>
              TCLOCS is a pre-ride inspection acronym developed by the Motorcycle Safety Foundation
              (MSF). It stands for{' '}
              <strong className="text-neutral-300">
                Tires, Controls, Lights, Oil, Chassis, and Stands
              </strong>{' '}
              &mdash; the six critical areas to check before every motorcycle ride.
            </p>
            <p>
              A thorough pre-ride inspection takes about 5-10 minutes and can prevent mechanical
              failures, accidents, and costly breakdowns. Professional riders and safety instructors
              consider it an essential habit for every motorcyclist.
            </p>
            <p>
              This interactive checklist lets you track your inspection progress. You can also print
              it to keep in your garage or tank bag for quick reference.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
