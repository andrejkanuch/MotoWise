import { buildAasaResponse } from '@/lib/aasa';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Bare-root AASA endpoint. Apple only fetches `/.well-known/apple-app-site-association`,
 * but the root path is requested by tooling, validators, and humans (it 404'd
 * before). A real route handler is used rather than a `next.config` rewrite —
 * afterFiles rewrites don't fire for the App Router not-found path, so the
 * rewrite returned 404 in production.
 */
export function GET() {
  return buildAasaResponse();
}
