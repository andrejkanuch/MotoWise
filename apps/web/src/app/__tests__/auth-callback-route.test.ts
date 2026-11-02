import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthErrorCode, loginErrorPath } from '@/components/auth-ui/auth-query';

const exchangeCodeForSession = vi.fn();
const POST_AUTH_DESTINATION = '/welcome';

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession } }),
}));
vi.mock('@/lib/post-auth-redirect', () => ({ postAuthDestination: () => POST_AUTH_DESTINATION }));

const { GET } = await import('../(root)/auth/callback/route');

const ORIGIN = 'https://motovault.app';
const callback = (query: string) => GET(new NextRequest(new URL(`/auth/callback${query}`, ORIGIN)));
const location = (res: Response) => res.headers.get('location');

beforeEach(() => {
  exchangeCodeForSession.mockReset();
});

describe('/auth/callback', () => {
  it('sends a link with no code (expired or reused) to /login with the link_expired banner', async () => {
    const res = await callback('?error=access_denied&error_code=otp_expired');
    expect(location(res)).toBe(`${ORIGIN}${loginErrorPath(AuthErrorCode.LinkExpired)}`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('sends a code Supabase rejects to the same banner', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'expired' } });
    const res = await callback('?code=stale');
    expect(location(res)).toBe(`${ORIGIN}${loginErrorPath(AuthErrorCode.LinkExpired)}`);
  });

  it('forwards the code to the mobile app without exchanging it', async () => {
    const res = await callback(`?code=abc&redirect=${encodeURIComponent('motovault://auth')}`);
    expect(location(res)).toBe('motovault://auth?code=abc');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('lands a good code on the post-auth destination', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await callback('?code=good');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('good');
    expect(location(res)).toBe(`${ORIGIN}${POST_AUTH_DESTINATION}`);
  });
});
