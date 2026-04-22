'use client';

import { palette } from '@motovault/design-system';
import { useEffect, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';

const STORE_URLS = {
  ios: 'https://apps.apple.com/us/app/motovault/id6760291360',
  android: 'https://play.google.com/store/apps/details?id=com.motovault.app',
} as const;

type Platform = 'ios' | 'android' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|macintosh/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}

export function OpenInAppCta() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Show both stores if we can't detect, or the specific one
  if (platform === 'unknown') {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={STORE_URLS.ios}
          onClick={() =>
            trackEvent(WebEvent.OPEN_IN_APP_CLICKED, { source: 'route_detail', platform: 'ios' })
          }
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: palette.signature500, color: palette.white }}
        >
          App Store
        </a>
        <a
          href={STORE_URLS.android}
          onClick={() =>
            trackEvent(WebEvent.OPEN_IN_APP_CLICKED, {
              source: 'route_detail',
              platform: 'android',
            })
          }
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:text-neutral-100"
          style={{ border: `1px solid ${palette.neutral800}` }}
        >
          Google Play
        </a>
        <p className="text-xs text-neutral-600">Navigation, tracking, fuel stops</p>
      </div>
    );
  }

  const url = platform === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
  const label = platform === 'ios' ? 'Open in App' : 'Get on Google Play';

  return (
    <div>
      <a
        href={url}
        onClick={() =>
          trackEvent(WebEvent.OPEN_IN_APP_CLICKED, { source: 'route_detail', platform })
        }
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: palette.signature500, color: palette.white }}
      >
        {label}
      </a>
      <p className="mt-2 text-xs text-neutral-600">Navigation, tracking, fuel stops</p>
    </div>
  );
}
