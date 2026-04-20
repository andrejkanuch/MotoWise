'use client';

import { useEffect, useState } from 'react';

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

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '14px 22px',
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '-0.005em',
  transition: 'transform .2s cubic-bezier(0.2, 0.8, 0.2, 1), background .25s',
  background: 'oklch(0.98 0.006 80)',
  color: 'oklch(0.15 0.02 55)',
};

export function OpenInAppCta() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (platform === 'unknown') {
    return (
      <a href={STORE_URLS.ios} style={btnStyle}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>Open in App</title>
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
        <span style={{ position: 'relative', zIndex: 1 }}>Open in App</span>
      </a>
    );
  }

  const url = platform === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
  const label = platform === 'ios' ? 'Open in App' : 'Get on Google Play';

  return (
    <a href={url} style={btnStyle}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>{label}</title>
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
      </svg>
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
    </a>
  );
}
