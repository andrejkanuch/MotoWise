'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { CtaPlacement, pageContextFromPathname } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';
import { storeAnchorProps } from './store-buttons';

const DISMISS_KEY = 'mv_sticky_app_bar_dismissed';

/**
 * Published by the cookie banner (components/cookie-consent.tsx) on the root
 * element while one of its surfaces is on screen: the height of that surface.
 * The bar sits on top of it instead of underneath it.
 */
const COOKIE_BANNER_HEIGHT_VAR = '--mv-cookie-banner-h';

/* A thin bar on the raised step with a hairline top; the one copper button
   is the action, dismiss is a ghost icon. Honours the home-indicator inset. */
const STICKY_BAR_CSS = `
.mv-appbar {
  position: fixed;
  left: 0; right: 0;
  bottom: var(${COOKIE_BANNER_HEIGHT_VAR}, 0px);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) 16px;
  background: var(--mv-surface-2);
  border-top: 1px solid var(--mv-line);
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
  transition: bottom .25s var(--mv-ease);
}
.mv-appbar-text {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--mv-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mv-appbar-cta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: var(--mv-radius-control);
  background: var(--mv-copper);
  color: var(--mv-on-copper);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background .2s, transform .2s var(--mv-ease);
}
.mv-appbar-cta:hover { background: var(--mv-copper-hover); }
.mv-appbar-cta:active { transform: scale(0.985); }
.mv-appbar-dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px; height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--mv-radius-control);
  background: transparent;
  color: var(--mv-ink-3);
  cursor: pointer;
  transition: color .15s, background .15s;
}
.mv-appbar-dismiss:hover { color: var(--mv-ink); background: var(--mv-fill); }
.mv-appbar :focus-visible { outline: 2px solid var(--mv-copper); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .mv-appbar, .mv-appbar * { transition-duration: 0.01ms; }
}
`;

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
    <div className="mv-appbar">
      <style>{STICKY_BAR_CSS}</style>
      <p className="mv-appbar-text">{t('message')}</p>
      <a
        {...storeAnchorProps(platform, { pageType, placement: CtaPlacement.StickyBar, slug })}
        className="mv-appbar-cta"
      >
        {t('cta')}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="mv-appbar-dismiss"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
