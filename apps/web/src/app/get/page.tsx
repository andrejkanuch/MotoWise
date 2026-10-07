import { palette } from '@motovault/design-system';
import { Bell, Receipt, Route } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { renderSVG } from 'uqr';
import { StoreButtons } from '@/components/marketing/store-buttons';
import { captureAnonymousCount } from '@/lib/anonymous-counter';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import {
  GET_PATH,
  GET_SOURCE_PARAM,
  isBotUserAgent,
  normalizeGetSource,
  platformFromUserAgent,
  storeRedirectFor,
} from '@/lib/get-link';

// The redirect depends on the visitor's user agent, so this page can never be
// prerendered or shared from a cache.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://motovault.app';
/** Consent-independent count of bio-link opens, split by source and platform. */
const GET_LINK_EVENT = 'get_link_opened';
const GetOutcome = { StoreRedirect: 'store_redirect', Page: 'page' } as const;
/** RevenueCat discount codes are short alphanumerics; anything else is dropped. */
const DISCOUNT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export const metadata: Metadata = {
  title: 'Get MotoVault — your bike, every ride and every service',
  description:
    'Log rides, track every expense and never miss a service. MotoVault is free on iPhone and Android.',
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}${GET_PATH}` },
  openGraph: {
    title: 'Get MotoVault',
    description: 'Log rides, track every expense and never miss a service.',
    url: `${SITE_URL}${GET_PATH}`,
    type: 'website',
  },
};

const BENEFITS = [
  { icon: Route, label: 'Log every ride' },
  { icon: Receipt, label: 'Track every expense' },
  { icon: Bell, label: 'Never miss a service' },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GetPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const source = normalizeGetSource(sp[GET_SOURCE_PARAM]);
  const userAgent = (await headers()).get('user-agent') ?? '';
  const isBot = isBotUserAgent(userAgent);
  const platform = platformFromUserAgent(userAgent);

  // Phones go straight to their store — no page, no cookie banner, one tap
  // from the bio link to the install button. Link-preview bots get the page so
  // the post shows a proper card.
  const storeUrl = isBot
    ? null
    : storeRedirectFor(platform, source, process.env.APPLE_CAMPAIGN_PROVIDER_TOKEN);

  if (!isBot) {
    // after() runs once the response is sent (redirect included), so the
    // PostHog round-trip never delays the hop to the store.
    after(() =>
      captureAnonymousCount(GET_LINK_EVENT, {
        source,
        platform,
        outcome: storeUrl ? GetOutcome.StoreRedirect : GetOutcome.Page,
      }),
    );
  }
  if (storeUrl) redirect(storeUrl);

  const rawCode = Array.isArray(sp.code) ? sp.code[0] : sp.code;
  const discountCode = rawCode && DISCOUNT_CODE_PATTERN.test(rawCode) ? rawCode : null;
  const proHref = discountCode
    ? `/pro/checkout?plan=annual&discount_code=${encodeURIComponent(discountCode)}`
    : '/pro';

  // The QR code points back at this same URL, so the phone that scans it takes
  // the per-platform redirect above with the source intact.
  const qrSvg = renderSVG(`${SITE_URL}${GET_PATH}?${GET_SOURCE_PARAM}=${source}`, {
    border: 1,
    whiteColor: palette.white,
    blackColor: palette.neutral950,
  });

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-16 text-neutral-50">
      <div className="w-full max-w-[880px]">
        <Link href="/" className="mb-10 inline-block text-lg font-bold tracking-tight">
          Moto<span className="text-warm-400">Vault</span>
        </Link>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Your bike, every ride and every service — in one place.
            </h1>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-neutral-300">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-warm-500/10">
                    <Icon className="size-4 text-warm-400" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            {/* StoreButtons pads its own row (px-6 / sm:px-8); pull it back to the text edge. */}
            <div className="mt-10 -ml-6 sm:-ml-8">
              <StoreButtons pageType={CtaPageType.Get} placement={CtaPlacement.Hero} />
            </div>
            <p className="mt-6 text-sm text-neutral-500">
              Free on iPhone and Android.{' '}
              <Link href={proHref} className="text-neutral-300 underline underline-offset-4">
                {discountCode ? 'Get Pro on the web with your code' : 'Get Pro on the web'}
              </Link>
            </p>
          </div>

          <figure className="hidden w-56 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-center md:block">
            <div
              className="overflow-hidden rounded-xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr from our own URL
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <figcaption className="mt-4 text-sm text-neutral-400">
              Scan with your phone camera
            </figcaption>
          </figure>
        </div>
      </div>
    </main>
  );
}
