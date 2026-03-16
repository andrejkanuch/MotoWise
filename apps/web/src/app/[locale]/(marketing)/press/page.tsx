import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

  return {
    title: 'Press Kit | MotoVault',
    description:
      'Download MotoVault brand assets, logos, screenshots, and company information for press and media coverage.',
    alternates: {
      canonical: `${BASE_URL}/press`,
      languages: {
        en: `${BASE_URL}/press`,
        es: `${BASE_URL}/es/press`,
        de: `${BASE_URL}/de/press`,
        fr: `${BASE_URL}/fr/press`,
        it: `${BASE_URL}/it/press`,
        'x-default': `${BASE_URL}/press`,
      },
    },
  };
}

const stats = [
  { label: '5 Locales Supported', detail: 'EN, ES, DE, FR, IT' },
  { label: 'AI-Powered Diagnostics', detail: 'Powered by Claude AI' },
  { label: 'Available on iOS & Android', detail: 'Built with Expo' },
  { label: 'Free to Use', detail: 'No subscription required' },
] as const;

const screenshots = [
  'Home Dashboard',
  'AI Diagnostics Chat',
  'Bike Garage',
  'Maintenance Log',
  'Article Reader',
  'Quiz Mode',
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
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description:
      'MotoVault is an AI-powered motorcycle companion app that helps riders maintain, diagnose, and learn about their motorcycles.',
    foundingDate: '2025',
    founder: {
      '@type': 'Person',
      name: 'Andrej',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: 'press@motovault.app',
        contactType: 'press',
      },
      {
        '@type': 'ContactPoint',
        email: 'support@motovault.app',
        contactType: 'customer support',
      },
    ],
    sameAs: [],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={organizationSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            MotoVault Press Kit
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            Everything you need to write about MotoVault. Brand assets, company information, and
            media resources.
          </p>
        </div>
      </section>

      {/* About Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="reveal-on-scroll text-3xl font-extrabold tracking-tight text-neutral-50">
            About MotoVault
          </h2>

          <div className="mt-8 space-y-6">
            <div className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
              <h3 className="mb-4 text-lg font-bold text-warm-400">Short Description</h3>
              <p className="text-neutral-300">
                MotoVault is a free, AI-powered motorcycle companion app that helps riders maintain
                their bikes, diagnose issues, and expand their mechanical knowledge — all from their
                phone.
              </p>
            </div>

            <div className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
              <h3 className="mb-4 text-lg font-bold text-warm-400">Long Description</h3>
              <div className="space-y-4 text-neutral-300">
                <p>
                  MotoVault is an AI-powered motorcycle platform designed to be every rider&apos;s
                  digital garage companion. Built for both seasoned mechanics and new riders alike,
                  MotoVault combines artificial intelligence with deep motorcycle knowledge to
                  provide instant diagnostics, personalized maintenance tracking, and educational
                  content tailored to each rider&apos;s bike.
                </p>
                <p>
                  At its core, MotoVault features an AI diagnostics engine powered by Claude AI that
                  can help riders identify and troubleshoot mechanical issues by describing symptoms
                  in plain language. Whether it&apos;s a strange noise, an electrical gremlin, or a
                  performance drop, the AI provides actionable guidance with estimated difficulty
                  levels and safety warnings.
                </p>
                <p>
                  Beyond diagnostics, MotoVault offers a comprehensive learning platform with
                  curated articles, interactive quizzes, and a digital garage where riders can track
                  their motorcycles, maintenance history, and upcoming service intervals. Available
                  in five languages and on both iOS and Android, MotoVault is building the future of
                  motorcycle ownership.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Stats */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            Key Facts
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center"
              >
                <p className="text-lg font-bold text-neutral-50">{stat.label}</p>
                <p className="mt-2 text-sm text-neutral-400">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Screenshots */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            App Screenshots
          </h2>
          <p className="mt-4 text-center text-neutral-400">
            High-resolution screenshots for press use
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {screenshots.map((label) => (
              <div
                key={label}
                className="reveal-on-scroll flex aspect-[9/16] items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-800 p-6"
              >
                <p className="text-center text-sm font-medium text-neutral-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            Logo &amp; Brand Assets
          </h2>
          <div className="reveal-on-scroll mt-12 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-neutral-800">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative logo placeholder */}
                <svg
                  className="h-16 w-16 text-warm-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold text-neutral-50">MotoVault</h3>
                <p className="mt-2 text-neutral-400">
                  Please use the official MotoVault logo without modification. Maintain clear space
                  around the logo equal to the height of the &quot;M&quot; in MotoVault. Do not
                  change the colors, proportions, or add effects to the logo.
                </p>
                <p className="mt-4 text-sm text-neutral-500">
                  Logo downloads coming soon. Contact{' '}
                  <a
                    href="mailto:press@motovault.app"
                    className="text-warm-400 underline underline-offset-2 hover:text-warm-300"
                  >
                    press@motovault.app
                  </a>{' '}
                  for assets in the meantime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Press Contact */}
      <section className="px-4 py-16 pb-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            Press Contact
          </h2>
          <div className="reveal-on-scroll mt-12 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
            <p className="text-neutral-300">
              For press inquiries, interview requests, or additional assets, please reach out to:
            </p>
            <a
              href="mailto:press@motovault.app"
              className="mt-4 inline-block text-xl font-bold text-warm-400 underline underline-offset-4 hover:text-warm-300"
            >
              press@motovault.app
            </a>
            <p className="mt-6 text-sm text-neutral-500">
              We aim to respond to all press inquiries within 24 hours.
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="text-sm text-neutral-400 underline underline-offset-2 hover:text-neutral-300"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
