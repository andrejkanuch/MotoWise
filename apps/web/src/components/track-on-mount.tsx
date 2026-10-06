'use client';

import { useEffect } from 'react';
import { trackEvent, type WebEventName } from '@/lib/analytics';

/** Fires a single analytics event on mount. Use inside server-component pages. */
export function TrackOnMount({
  event,
  properties,
}: {
  event: WebEventName;
  properties?: Record<string, unknown>;
}) {
  useEffect(() => {
    trackEvent(event, properties);
  }, [event, properties]);

  return null;
}
