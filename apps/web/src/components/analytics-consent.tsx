'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useCookieConsent } from './cookie-consent';

export function AnalyticsWithConsent() {
  const { consent } = useCookieConsent();
  const hasConsent = consent === true;

  if (!hasConsent || !process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return null;

  return <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />;
}
