'use client';

import { useEffect, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { detectPlatform, type Platform, storeUrlForPlatform } from '@/lib/store-links';

const DEFAULT_CLASS =
  'inline-block rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400';

/**
 * Platform-aware "Download Free" CTA. Resolves to the App Store on iOS/desktop and Google Play
 * on Android (client-side UA detection) instead of linking to the homepage. The href is set
 * before hydration (App Store default) so it works without JS and is never a dead `/` link.
 */
export function DownloadAppButton({
  source,
  label = 'Download Free',
  className = DEFAULT_CLASS,
}: {
  source: string;
  label?: string;
  className?: string;
}) {
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <a
      href={storeUrlForPlatform(platform)}
      onClick={() => trackEvent(WebEvent.OPEN_IN_APP_CLICKED, { source, platform })}
      className={className}
    >
      {label}
    </a>
  );
}
