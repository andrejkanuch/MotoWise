'use client';

import { palette } from '@motovault/design-system';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { CtaPlacement, pageContextFromPathname } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';
import { storeAnchorProps } from './store-buttons';

const DISMISS_KEY = 'mv_sticky_app_bar_dismissed';

/**
 * Thin, dismissible bottom bar promoting the app on Android + desktop.
 *
 * iOS is deliberately skipped — the native Smart App Banner (apple-itunes-app
 * meta in the root layout) already covers it, and stacking both is noisy. The
 * bar is inline and dismissible (never a full-screen interstitial), to stay
 * clear of Google's intrusive-interstitial penalty on search-landing pages.
 * Renders client-only after mount, so it's absent from SSR HTML and can't be
 * seen by crawlers as landing-page content.
 */
export function StickyAppBar() {
  const t = useTranslations('StickyBar');
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [dismissed, setDismissed] = useState(true); // hidden until mounted

  useEffect(() => {
    setPlatform(detectPlatform());
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // sessionStorage can throw in private mode / sandboxed webviews
      setDismissed(false);
    }
  }, []);

  // iOS handled by the Smart App Banner; never show there.
  const visible = platform !== 'ios' && !dismissed;

  // Reserve space for the fixed bar so it never covers the last controls/links
  // on a page. Only while visible; restored on dismiss, unmount, or iOS.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = 'calc(env(safe-area-inset-bottom) + 64px)';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const { pageType, slug } = pageContextFromPathname(pathname);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // best-effort — a failed write just means the bar reappears next load
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t px-4 py-3"
      style={{ backgroundColor: palette.neutral950, borderColor: palette.neutral800 }}
    >
      <p className="min-w-0 flex-1 truncate text-sm" style={{ color: palette.neutral200 }}>
        {t('message')}
      </p>
      <a
        {...storeAnchorProps(platform, { pageType, placement: CtaPlacement.StickyBar, slug })}
        className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: palette.signature500, color: palette.white }}
      >
        {t('cta')}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="shrink-0 rounded-full p-1.5 transition-opacity hover:opacity-70"
        style={{ color: palette.neutral400 }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
