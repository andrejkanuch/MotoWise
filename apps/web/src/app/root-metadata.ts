import { palette } from '@motovault/design-system';
import type { Metadata, Viewport } from 'next';

/** Shared by both root layouts (see root-shell.tsx). */
export const rootMetadata: Metadata = {
  metadataBase: new URL('https://motovault.app'),
  title: {
    default: 'MotoVault',
    template: '%s | MotoVault',
  },
  description: 'Motorcycle maintenance, expense tracking & ride logging platform',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export const rootViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // env(safe-area-inset-*) resolves only under cover: the fixed bars pad by it.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: palette.plateLightG0 },
    { media: '(prefers-color-scheme: dark)', color: palette.plateG0 },
  ],
};
