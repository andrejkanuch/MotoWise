'use client';

import { useEffect } from 'react';
import { trackEvent, type WebEventName } from '@/lib/analytics';

/** Fires a single analytics event on mount. Use inside server-component checkout pages. */
export function CheckoutTracker({ event }: { event: WebEventName }) {
  useEffect(() => {
    trackEvent(event);
  }, [event]);

  return null;
}
