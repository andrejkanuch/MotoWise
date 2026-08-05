'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Top-of-viewport navigation progress bar.
 *
 * Replaces the deleted `app/loading.tsx`. That file created a Suspense boundary
 * for the ENTIRE app subtree, so the shell streamed before any page resolved —
 * and a streamed response can only carry HTTP 200. Every `notFound()` therefore
 * served the not-found page at 200, which Google indexed as a real, thin page
 * (~1k GSC "Not found (404)", Sentry MOTOVAULT-WEB-Q/-P/-R). A client component
 * driven by navigation events creates **no** Suspense boundary, so it cannot
 * affect a response's status code.
 *
 * Do NOT reintroduce `loading.tsx` to get this UI back.
 * See docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md
 *
 * ## Why click interception rather than a Next hook
 *
 * `useLinkStatus()` reports the pending state of the `<Link>` it is rendered
 * *inside*, so driving one global bar with it would mean putting a sensor in
 * every link. `onNavigate` only fires for `<Link>` clicks. Neither gives a
 * single app-wide indicator, so this listens for the click that starts a
 * navigation and clears on the resulting pathname change.
 *
 * Known limitation: a purely programmatic `router.push()` shows no bar (there is
 * no client-side navigation event to observe without monkey-patching the router).
 * Every navigation a visitor initiates on the marketing pages goes through a link,
 * which is what this is for. `usePathname()` is deliberate — `useSearchParams()`
 * would opt static routes into needing a Suspense boundary, reintroducing the very
 * problem this component exists to avoid.
 */

/** Don't flash a bar for prefetched navigations that resolve almost instantly. */
const SHOW_DELAY_MS = 150;
/** Failsafe: clear a bar left behind by a navigation that never completed. */
const MAX_VISIBLE_MS = 10_000;

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * True when this click will actually start an in-app navigation to a new URL.
 * Exported for tests — a false positive strands a running bar over a page that
 * never changed.
 */
export function startsInAppNavigation(anchor: HTMLAnchorElement): boolean {
  // `anchor.target` resolves <base target> too; treat anything but the current
  // frame as a new context we don't render into.
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;

  // `anchor.href` is already absolute and origin-resolved.
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // Non-http(s) schemes (mailto:, tel:) never share our origin, so reaching here
  // means a same-origin document. An in-page anchor or a link to the current URL
  // renders nothing new — no bar.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }
  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      showTimer.current = null;
      hideTimer.current = null;
    };

    const start = () => {
      clearTimers();
      showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      hideTimer.current = setTimeout(() => setVisible(false), MAX_VISIBLE_MS);
    };

    const onClick = (event: MouseEvent) => {
      if (!isPlainLeftClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor || !startsInAppNavigation(anchor)) return;
      start();
    };

    // Capture phase: a handler that calls stopPropagation (or Link's own
    // handling) must not hide the navigation from us.
    document.addEventListener('click', onClick, { capture: true });
    // Back/forward also swaps the page and can suspend on data.
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('popstate', start);
      clearTimers();
    };
  }, []);

  // The new pathname committing IS the completion signal. `pathname` is the
  // trigger, not a value read in the body — that is the point, so the
  // "unnecessary dependency" hint is wrong here: dropping it would run this once
  // at mount and the bar would never clear.
  // biome-ignore lint/correctness/useExhaustiveDependencies: route-commit trigger, intentionally not read
  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="mv-navprogress">
      <div className="mv-navprogress-bar" />
    </div>
  );
}
