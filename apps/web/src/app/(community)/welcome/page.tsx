import { palette } from '@motovault/design-system';
import { Bell, Receipt, Route } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { renderSVG } from 'uqr';
import { StoreButtons } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { GetPlatform, platformFromUserAgent } from '@/lib/get-link';
import { OpenFrom, openGarageHref } from '@/lib/open-link';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { WelcomeViewed } from './welcome-viewed';

// Per-user (email) and per-device (QR or button) content: never prerender or cache.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://motovault.app';

export const metadata: Metadata = {
  title: 'Welcome to MotoVault',
  robots: { index: false, follow: false },
};

/** What only the phone can do: the reasons to install, not a feature list. */
const APP_REASONS = [
  { icon: Route, label: 'Record rides with GPS' },
  { icon: Bell, label: 'Get service reminders before they are due' },
  { icon: Receipt, label: 'Scan receipts with the camera' },
] as const;

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', apple: 'Apple' };

/**
 * Where a new web account lands (signup and the OAuth callback), in place of
 * /garage. Most web signups never open the app, and the app is where riders
 * record rides, get reminders and log expenses. Auth comes from
 * (community)/layout.tsx.
 */
export default async function WelcomePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const provider = PROVIDER_LABEL[String(user?.app_metadata?.provider ?? '')];
  const platform = platformFromUserAgent((await headers()).get('user-agent') ?? '');
  const isDesktop = platform === GetPlatform.Desktop;

  const qrSvg = isDesktop
    ? renderSVG(`${SITE_URL}${openGarageHref(OpenFrom.WelcomeQr)}`, {
        border: 1,
        whiteColor: palette.white,
        blackColor: palette.neutral950,
      })
    : null;

  return (
    <div className="dark flex items-center justify-center px-4 py-16 text-neutral-50">
      <WelcomeViewed device={platform} />
      <div className="w-full max-w-[880px]">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              You&apos;re in. Now put MotoVault in your pocket.
            </h1>
            <ul className="mt-8 space-y-3">
              {APP_REASONS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-neutral-300">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-warm-500/10">
                    <Icon className="size-4 text-warm-400" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            {isDesktop ? (
              // StoreButtons pads its own row (px-6 / sm:px-8); pull it back to the text edge.
              <div className="mt-10 -ml-6 sm:-ml-8">
                <StoreButtons pageType={CtaPageType.Welcome} placement={CtaPlacement.Hero} />
              </div>
            ) : (
              <Link
                href={openGarageHref(OpenFrom.Welcome)}
                className="mt-10 inline-flex items-center justify-center rounded-full bg-warm-500 px-8 py-4 text-lg font-semibold text-neutral-950 transition hover:bg-warm-400 active:scale-[0.98]"
              >
                Get the MotoVault app
              </Link>
            )}

            {user?.email && (
              <p className="mt-6 text-sm text-neutral-400">
                In the app, sign in with the same account:{' '}
                <span className="text-neutral-200">
                  {provider ? `Continue with ${provider} (${user.email})` : user.email}
                </span>
              </p>
            )}
            <p className="mt-4 text-sm">
              <Link href="/garage" className="text-neutral-300 underline underline-offset-4">
                Continue to your garage on the web &rarr;
              </Link>
            </p>
          </div>

          {qrSvg && (
            <figure className="w-56 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-center">
              <div
                className="overflow-hidden rounded-xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr from our own URL
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <figcaption className="mt-4 text-sm text-neutral-400">
                Scan with your phone camera
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </div>
  );
}
