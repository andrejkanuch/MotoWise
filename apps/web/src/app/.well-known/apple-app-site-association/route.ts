import { buildAasaResponse } from '@/lib/aasa';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Canonical AASA endpoint Apple fetches for Universal Links. Body is shared
 * with the bare-root `/apple-app-site-association` handler via {@link buildAasaResponse}.
 */
export function GET() {
  return buildAasaResponse();
}
