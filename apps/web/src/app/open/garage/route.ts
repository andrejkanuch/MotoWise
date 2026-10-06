import { after, type NextRequest, NextResponse } from 'next/server';
import { captureAnonymousCount } from '@/lib/anonymous-counter';
import {
  GET_PATH,
  GET_SOURCE_PARAM,
  GetSource,
  isBotUserAgent,
  platformFromUserAgent,
} from '@/lib/get-link';
import { normalizeOpenFrom, OPEN_FROM_PARAM } from '@/lib/open-link';

/** Consent-independent count of web → app hand-off opens, split by placement and platform. */
const OPEN_LINK_EVENT = 'open_link_opened';
const OPEN_TARGET = 'garage';

export function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? '';
  const from = normalizeOpenFrom(request.nextUrl.searchParams.get(OPEN_FROM_PARAM));

  if (!isBotUserAgent(userAgent)) {
    const platform = platformFromUserAgent(userAgent);
    after(() => captureAnonymousCount(OPEN_LINK_EVENT, { target: OPEN_TARGET, from, platform }));
  }

  const destination = new URL(GET_PATH, request.nextUrl.origin);
  destination.searchParams.set(GET_SOURCE_PARAM, GetSource.WebProfile);
  const response = NextResponse.redirect(destination, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
