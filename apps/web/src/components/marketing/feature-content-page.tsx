import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

interface FeatureContentPageProps {
  locale: string;
  namespace: string;
  route: string;
  screenshots: { src: string; alt: string }[];
  featureIcons: readonly [string, string, string];
}

export async function FeatureContentPage({
  locale,
  namespace,
  route,
  screenshots,
  featureIcons,
}: FeatureContentPageProps) {
  const t = await getTranslations(namespace);
  const canonical = getCanonicalUrl(locale, route);

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: route,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      route,
    ),
    buildFAQPage(faqItems, `${locale}${route}/faq`),
  );

  const features = [
    { titleKey: 'f1Title', descKey: 'f1Desc' },
    { titleKey: 'f2Title', descKey: 'f2Desc' },
    { titleKey: 'f3Title', descKey: 'f3Desc' },
  ] as const;

  const sections = [
    { titleKey: 's1Title', bodyKey: 's1Body' },
    { titleKey: 's2Title', bodyKey: 's2Body' },
    { titleKey: 's3Title', bodyKey: 's3Body' },
  ] as const;

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              {t('breadcrumbHome')}
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
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features" className="transition-colors hover:text-neutral-300">
              {t('breadcrumbFeatures')}
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
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <span className="text-neutral-300" aria-current="page">
              {t('title')}
            </span>
          </li>
        </ol>
      </nav>

      <section className="px-6 pb-16 pt-8 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('sectionLabel')}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      <FeatureScreenshotPair screenshots={screenshots} />

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('featuresLabel')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('featuresTitle')}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ titleKey, descKey }, index) => (
              <article
                key={titleKey}
                className="card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 0%, oklch(0.76 0.13 70 / 0.08), transparent 70%)',
                  }}
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 h-[3px] transition-colors group-hover:bg-warm-500" />
                <div className="relative z-10">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 text-warm-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-6"
                      aria-hidden="true"
                    >
                      <path d={featureIcons[index]} />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-50">{t(titleKey)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t(descKey)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('longFormLabel')}
          </p>
          <h2 className="reveal-on-scroll text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('longFormTitle')}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-300">{t('longFormIntro')}</p>
          {sections.map(({ titleKey, bodyKey }) => (
            <div key={titleKey}>
              <div
                className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
                aria-hidden="true"
              />
              <h3 className="text-2xl font-semibold text-neutral-50">{t(titleKey)}</h3>
              <p className="mt-4 leading-relaxed text-neutral-300">{t(bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('faqLabel')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('faqTitle')}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {faqItems.map(({ question, answer }, index) => (
              <details
                key={question}
                className="group border-b border-neutral-800/50"
                open={index === 0}
              >
                <summary className="flex min-h-[44px] cursor-pointer items-center gap-3 py-4 text-left text-neutral-400 transition-colors hover:text-neutral-200 group-open:text-neutral-50 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium text-warm-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-lg font-medium">{question}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto shrink-0 text-neutral-500 transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="pb-4 pl-4 text-base leading-7 text-neutral-300 lg:max-w-2xl">
                  {answer}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-12 text-center text-neutral-500">
            {t('faqMore')}{' '}
            <Link
              href="/support"
              className="text-warm-400 underline underline-offset-4 transition-colors hover:text-warm-300"
            >
              {t('faqSupportLink')}
            </Link>
          </p>
        </div>
      </section>

      <FeatureCta />
    </>
  );
}
