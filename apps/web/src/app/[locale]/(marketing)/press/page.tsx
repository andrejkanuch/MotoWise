import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { BASE_URL } from '@/lib/constants';
import { LEGAL_ADDRESS, LEGAL_NAME } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

  return {
    title: 'Press kit | MotoVault',
    description:
      'Download MotoVault brand assets, logos, screenshots, and company information for press and media coverage.',
    alternates: {
      // Press page is English-only — always canonical to unprefixed URL.
      canonical: `${BASE_URL}/press`,
      languages: { 'x-default': `${BASE_URL}/press` },
    },
  };
}

// Facts a journalist can check. No rider counts, no ratings, no "beautifully
// simple": the store listings and the company register carry the proof.
const facts = [
  {
    label: 'What it is',
    value: 'A logbook app for riders: rides, expenses, maintenance and the garage',
  },
  { label: 'Platforms', value: 'iOS and Android' },
  { label: 'Price', value: 'Free to download; MotoVault Pro is an optional subscription' },
  {
    label: 'Website languages',
    value: 'English, German, French, Spanish, Italian, Polish, Portuguese (Brazil) and Japanese',
  },
  { label: 'Founded', value: '2025, Slovakia' },
  { label: 'Operator', value: `${LEGAL_NAME}, registered in Slovakia` },
  { label: 'Press contact', value: 'support@motovault.app' },
] as const;

const logos = [
  { label: 'App icon, light background', href: '/images/marketing/MotoVault.png' },
  { label: 'App icon, dark background', href: '/images/marketing/MotoVaultDark.png' },
] as const;

export default async function PressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

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
        name: 'Press Kit',
        item: `${BASE_URL}/press`,
      },
    ],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MotoVault',
    legalName: LEGAL_NAME,
    address: LEGAL_ADDRESS,
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description:
      'MotoVault is a logbook app for motorcycle riders: ride tracking, expenses, maintenance reminders and service history for every bike in the garage.',
    foundingDate: '2025',
    founder: {
      '@type': 'Person',
      name: 'Andrej',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: 'support@motovault.app',
        contactType: 'press',
      },
      {
        '@type': 'ContactPoint',
        email: 'support@motovault.app',
        contactType: 'customer support',
      },
    ],
    sameAs: [
      'https://apps.apple.com/us/app/motovault/id6760291360',
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={organizationSchema} />

      <article className="mv-read">
        <header>
          <h1 className="mv-read-h1">Press kit</h1>
          <p className="mv-read-lede">
            What MotoVault is, who makes it and the assets you can use. For anything else, write to
            us and you will hear back within a working day.
          </p>
        </header>

        <section className="mv-read-section" aria-labelledby="about-heading">
          <h2 id="about-heading" className="mv-read-h2">
            About MotoVault
          </h2>
          <div className="mv-read-body">
            <p>
              <strong>Short description.</strong> MotoVault is a logbook app for motorcycle riders.
              It records rides, tracks what each bike costs, reminds riders when a service is due
              and keeps the service history for every bike in the garage, on iOS and Android.
            </p>
            <p>
              <strong>Long description.</strong> Most riders keep their service history in a notes
              app, a folder of receipts and a shop manual nobody opens. MotoVault puts the records
              in one place. A ride is recorded with the route, distance and time. An expense is
              logged against the bike, so the real cost per year and per kilometre is always
              current. Maintenance tasks carry an interval in days or distance, and the app reminds
              the rider before the next one is due. The garage shows every bike with its readiness
              at a glance.
            </p>
            <p>
              MotoVault is built in Slovakia by a rider and software developer, and operated by{' '}
              {LEGAL_NAME}. The app is free to download; MotoVault Pro is an optional subscription
              for riders who want the deeper ride insights and sharing.
            </p>
          </div>
        </section>

        <section className="mv-read-section" aria-labelledby="facts-heading">
          <h2 id="facts-heading" className="mv-read-h2">
            Facts
          </h2>
          <dl className="mv-defs">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mv-read-section" aria-labelledby="assets-heading">
          <h2 id="assets-heading" className="mv-read-h2">
            Logo and brand assets
          </h2>
          <div className="mv-read-body">
            <p>
              Use the MotoVault icon as supplied: no recolouring, no effects, and clear space around
              it at least the height of the &ldquo;M&rdquo;. The wordmark is set in Barlow
              Condensed; the brand colour is exhaust copper.
            </p>
          </div>
          <ul className="mv-rows">
            {logos.map((logo) => (
              <li key={logo.href}>
                <a href={logo.href} download className="mv-row">
                  <span className="mv-row-title">{logo.label}</span>
                  <span className="mv-row-aside">PNG, 1024 × 1024</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mv-read-note">
            Screenshots of the current app, in light and dark, are available on request at the
            address below.
          </p>
        </section>

        <section className="mv-read-section" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mv-read-h2">
            Press contact
          </h2>
          <div className="mv-read-body">
            <p>
              Interviews, additional assets and fact checks:{' '}
              <a href="mailto:support@motovault.app">support@motovault.app</a>. We answer within a
              working day.
            </p>
          </div>
          <p style={{ marginTop: 32 }}>
            <Link href="/" className="mv-quiet-link">
              Back to home
            </Link>
          </p>
        </section>
      </article>
    </>
  );
}
