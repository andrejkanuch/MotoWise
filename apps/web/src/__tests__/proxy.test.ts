import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// The locale branch and the /routes/{uuid} lookup are out of scope here; stub
// them so the proxy runs without a network or next-intl's routing.
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }));
vi.mock('../lib/redirect/uuid-to-slug', () => ({ resolveUuidToSlug: async () => null }));

const { proxy } = await import('../proxy');

const ORIGIN = 'https://motovault.app';
const COUNTRY_HEADER = 'x-vercel-ip-country';
const EDGE_CACHE = 's-maxage';

function request(path: string, init: { country?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (init.country) headers.set(COUNTRY_HEADER, init.country);
  if (init.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

const setCookies = (res: Response) => res.headers.getSetCookie();

describe('proxy: routes this PR made root-only', () => {
  it('marks /reset-password noindex and keeps it out of the edge cache', async () => {
    const res = await proxy(request('/reset-password'));
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Cache-Control') ?? '').not.toContain(EDGE_CACHE);
  });

  it.each([
    '/share/abc123',
    '/u/rider',
    '/u/rider/saved',
  ])('keeps token- and user-scoped %s out of the edge cache', async (path) => {
    const res = await proxy(request(path));
    expect(res.headers.get('Cache-Control') ?? '').not.toContain(EDGE_CACHE);
  });

  it('still edge-caches the public /explore page', async () => {
    const res = await proxy(request('/explore'));
    expect(res.headers.get('Cache-Control')).toContain(EDGE_CACHE);
  });
});

describe('proxy: mv_country cookie', () => {
  it('sets the edge country, upper-cased, when the cookie is missing', async () => {
    const res = await proxy(request('/explore', { country: 'de' }));
    expect(setCookies(res).some((c) => c.startsWith('mv_country=DE;'))).toBe(true);
  });

  it('does not rewrite a cookie that already matches', async () => {
    const res = await proxy(request('/explore', { country: 'DE', cookie: 'mv_country=DE' }));
    expect(setCookies(res).some((c) => c.startsWith('mv_country='))).toBe(false);
  });

  it.each(['', 'XX1', 'deu'])('ignores a malformed country header %j', async (country) => {
    const res = await proxy(request('/explore', { country }));
    expect(setCookies(res).some((c) => c.startsWith('mv_country='))).toBe(false);
  });
});
