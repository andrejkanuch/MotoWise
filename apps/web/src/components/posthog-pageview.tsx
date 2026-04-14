'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { Suspense, useEffect, useRef } from 'react';

/**
 * Next.js App Router does not auto-capture `$pageview` on soft navigation —
 * PostHog's `capture_pageview` only fires on full page loads. This component
 * closes that gap by capturing a pageview every time the pathname or search
 * params change.
 *
 * Respects the user's cookie-consent choice: PostHog is initialized with
 * `opt_out_capturing_by_default: true`, so this call is a no-op until the
 * user accepts. No PII is attached — only the resolved URL.
 *
 * Must be mounted inside a <Suspense> boundary because `useSearchParams`
 * de-opts the page to client-side rendering otherwise.
 */
function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const queryString = searchParams?.toString();
    const url =
      typeof window !== 'undefined'
        ? window.location.origin + pathname + (queryString ? `?${queryString}` : '')
        : pathname;
    const previous = lastTrackedUrlRef.current;
    if (previous !== null && previous !== url) {
      // After client navigation, `window.location` is already the new URL; set the URL
      // we are leaving so $pageleave matches the previous page (PostHog Installation Health + accurate paths).
      posthog.capture('$pageleave', { $current_url: previous });
    }
    lastTrackedUrlRef.current = url;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}
