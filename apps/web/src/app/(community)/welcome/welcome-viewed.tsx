'use client';

import { useEffect } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';
import type { GetPlatform } from '@/lib/get-link';

export function WelcomeViewed({ device }: { device: GetPlatform }) {
  useEffect(() => {
    trackEvent(WebEvent.WELCOME_VIEWED, { device });
  }, [device]);
  return null;
}
