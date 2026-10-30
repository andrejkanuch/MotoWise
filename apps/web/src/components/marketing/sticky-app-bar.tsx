'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
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

/** The page's closing store-button pair; while it is on screen the bar would
 *  be a third copper button in one viewport, so it steps aside. */
const CLOSING_CTA_ID = 'download';

/* A thin bar on the raised step with a hairline top; the one copper button
   is the kit's primary, dismiss is the kit's icon button. Honours the
   home-indicator inset and stacks above the cookie banner by translating,
   never by animating `bottom`. Enters with the kit's `.mv-enter-up`; the
   kit's reduced-motion policy covers it. */
const STICKY_BAR_CSS = `
.mv-appbar {
  position: fixed;
  left: 0; right: 0;
  bottom: 0;
  translate: 0 calc(-1 * var(${COOKIE_BANNER_HEIGHT_VAR}, 0px));
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) 16px;
  background: var(--mv-surface-2);
  border-top: 1px solid var(--mv-line);
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
  transition: translate 250ms var(--mv-ease-expo), opacity 240ms var(--mv-ease-expo);
}
.mv-appbar-text {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  color: var(--mv-ink-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
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
  const [closingCtaInView, setClosingCtaInView] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

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
  const visible = platform !== 'ios' && !dismissed && !closingCtaInView;

  // Step aside while the page's own closing CTA is on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-find the CTA when the route changes
  useEffect(() => {
    const target = document.getElementById(CLOSING_CTA_ID);
    if (!target || typeof IntersectionObserver === 'undefined') {
      setClosingCtaInView(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setClosingCtaInView(entry?.isIntersecting ?? false),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  // Reserve space for the fixed bar so it never covers the last controls/links
  // on a page — including the cookie banner it stacks on. The bar's real
  // height is measured (the message may wrap to two lines). Only while
  // visible; restored on dismiss, unmount, or iOS.
  useEffect(() => {
    if (!visible) return;
    const el = barRef.current;
    if (!el) return;
    const prev = document.body.style.paddingBottom;
    const reserve = () => {
      document.body.style.paddingBottom = `calc(${el.offsetHeight}px + var(${COOKIE_BANNER_HEIGHT_VAR}, 0px))`;
    };
    reserve();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserve);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
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
    <div ref={barRef} className="mv-appbar mv-enter-up">
      <style>{STICKY_BAR_CSS}</style>
      <p className="mv-appbar-text">{t('message')}</p>
      <a
        {...storeAnchorProps(platform, { pageType, placement: CtaPlacement.StickyBar, slug })}
        className="mv-btn mv-btn-primary"
      >
        {t('cta')}
      </a>
      <button type="button" onClick={dismiss} aria-label={t('dismiss')} className="mv-icon-btn">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
