import en from '../../../messages/en.json';
import { RootShell } from '../root-shell';

export { rootMetadata as metadata, rootViewport as viewport } from '../root-metadata';

/**
 * Root layout for the root-only routes (auth, garage, explore, trips, pro,
 * share links, admin…). They are English-only, so the locale is fixed and no
 * request header is read — every route under here can stay static where its
 * own segment allows. The localized marketing tree has its own root layout in
 * app/[locale]/layout.tsx. See root-shell.tsx for why there are two.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell locale="en" cookieBannerMessages={{ CookieBanner: en.CookieBanner }}>
      {children}
    </RootShell>
  );
}
