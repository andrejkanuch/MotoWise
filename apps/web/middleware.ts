import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveUuidToSlug } from '@/lib/redirect/uuid-to-slug';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Match /routes/{uuid} or /routes/{uuid}/*
  const match = pathname.match(/^\/routes\/([0-9a-f-]+)/i);
  if (!match) return NextResponse.next();

  const uuid = match[1];
  const resolved = await resolveUuidToSlug(uuid);

  if (!resolved) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const canonicalUrl = `/route/${resolved.country}/${resolved.region}/${resolved.slug}`;
  return NextResponse.redirect(new URL(canonicalUrl, request.url), 301);
}

export const config = {
  matcher: ['/routes/:path*'],
};
