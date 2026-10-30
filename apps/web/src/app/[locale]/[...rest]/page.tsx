import { notFound } from 'next/navigation';

/**
 * Catch-all for URLs no route matches. The app has two root layouts
 * ([locale] and (root)), so there is no single root not-found.tsx to fall
 * back on and an unmatched URL would get Next's bare 404. Matching it here
 * sends it to [locale]/not-found.tsx: the branded 404, in the visitor's
 * locale, still with HTTP 404. (experimental.globalNotFound would also do
 * this, but on Next 16.3 it turns the proxy's `/` → `/en` rewrite into a
 * redirect loop in production builds.)
 */
export default function CatchAll() {
  notFound();
}
