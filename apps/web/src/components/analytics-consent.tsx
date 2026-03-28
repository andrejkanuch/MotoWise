'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { CookieConsentBanner, useCookieConsent } from './cookie-consent';
import { MetaPixel } from './meta-pixel';

export function AnalyticsWithConsent() {
  const { consent } = useCookieConsent();
  const hasConsent = consent === true;

  return (
    <>
      {hasConsent && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
      {hasConsent && <MetaPixel />}
      <CookieConsentBanner />
    </>
  );
}
