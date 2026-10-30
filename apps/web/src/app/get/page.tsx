import { Bell, Receipt, Route } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { renderSVG } from 'uqr';
import { StoreLink } from '@/components/marketing/store-buttons';
import { captureAnonymousCount } from '@/lib/anonymous-counter';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import {
  GET_PATH,
  GET_SOURCE_PARAM,
  isBotUserAgent,
  normalizeGetSource,
  platformFromUserAgent,
  storeRedirectFor,
} from '@/lib/get-link';
import '@/components/marketing/design-system.css';

// The redirect depends on the visitor's user agent, so this page can never be
// prerendered or shared from a cache.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://motovault.app';
/** Consent-independent count of bio-link opens, split by source and platform. */
const GET_LINK_EVENT = 'get_link_opened';
const GetOutcome = { StoreRedirect: 'store_redirect', Page: 'page' } as const;
/** RevenueCat discount codes are short alphanumerics; anything else is dropped. */
const DISCOUNT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const BRAND_LOGO = '/images/marketing/MotoVault.png';

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

/* Page styles: every colour a --mv-* token, so both schemes hold. */
const S = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    boxSizing: 'border-box' as const,
  },
  inner: { width: '100%', maxWidth: 920 },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    marginBottom: 40,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--mv-ink)',
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },
  brandMark: { width: 24, height: 24, borderRadius: 7, overflow: 'hidden', display: 'flex' },
  h1: {
    fontFamily: 'var(--mv-font-display)',
    fontWeight: 600,
    fontSize: 'clamp(48px, 7vw, 84px)',
    lineHeight: 0.96,
    letterSpacing: '0.002em',
    margin: 0,
    textWrap: 'balance' as const,
  },
  list: {
    listStyle: 'none',
    margin: '32px 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 17,
    color: 'var(--mv-ink-2)',
  },
  icon: { flex: 'none', color: 'var(--mv-ink-2)' },
  ctas: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, marginTop: 40 },
  note: { margin: '24px 0 0', fontSize: 14, color: 'var(--mv-ink-3)' },
  noteLink: {
    color: 'var(--mv-copper-text)',
    textDecoration: 'underline',
    textUnderlineOffset: 4,
  },
  figure: { margin: 0, width: 232 },
  /* The QR tile is fixed-light in both schemes so every phone camera reads it. */
  qr: {
    width: 232,
    padding: 18,
    boxSizing: 'border-box' as const,
    borderRadius: 16,
    background: 'var(--mv-qr-tile)',
    color: 'var(--mv-qr-ink)',
  },
  caption: { fontSize: 14, color: 'var(--mv-ink-2)', textAlign: 'center' as const },
} as const;

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
  // the per-platform redirect above with the source intact. The modules inherit
  // the tile's ink; the tile itself paints the light ground.
  const qrSvg = renderSVG(`${SITE_URL}${GET_PATH}?${GET_SOURCE_PARAM}=${source}`, {
    border: 1,
    whiteColor: 'transparent',
    blackColor: 'currentColor',
  });
  const ctaCtx = { pageType: CtaPageType.Get, placement: CtaPlacement.Hero };

  return (
    <div className="mv-marketing">
      <main style={S.main}>
        <div style={S.inner}>
          <Link href="/" style={S.brand} aria-label="MotoVault home">
            <span style={S.brandMark} aria-hidden="true">
              <Image src={BRAND_LOGO} alt="" width={24} height={24} />
            </span>
            MotoVault
          </Link>

          <div className="grid items-center gap-14 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 style={S.h1}>Your bike, every ride and every service, in one place.</h1>
              <ul style={S.list}>
                {BENEFITS.map(({ icon: Icon, label }) => (
                  <li key={label} style={S.item}>
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" style={S.icon} />
                    {label}
                  </li>
                ))}
              </ul>
              <div style={S.ctas}>
                <StoreLink
                  {...ctaCtx}
                  platform={StorePlatform.Ios}
                  className="mv-btn mv-btn-primary"
                >
                  Download for iOS
                </StoreLink>
                <StoreLink
                  {...ctaCtx}
                  platform={StorePlatform.Android}
                  className="mv-btn mv-btn-ghost"
                >
                  Download for Android
                </StoreLink>
              </div>
              <p style={S.note}>
                Free on iPhone and Android.{' '}
                <Link href={proHref} style={S.noteLink}>
                  {discountCode ? 'Get Pro on the web with your code' : 'Get Pro on the web'}
                </Link>
              </p>
            </div>

            <figure style={S.figure} className="hidden flex-col items-center gap-3.5 md:flex">
              <div
                style={S.qr}
                className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr from our own URL
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <figcaption style={S.caption}>Scan with your phone camera</figcaption>
            </figure>
          </div>
        </div>
      </main>
    </div>
  );
}
