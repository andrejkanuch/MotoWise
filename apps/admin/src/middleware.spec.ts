import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock next/server ─────────────────────────────────────────────────────────
function createFakeRequest(path: string) {
  return {
    url: `http://localhost:3000${path}`,
    cookies: {
      getAll: vi.fn().mockReturnValue([]),
    },
  };
}

function createFakeResponse() {
  const cookies = new Map<string, unknown>();
  return {
    headers: new Headers(),
    status: 200,
    cookies: {
      set: vi.fn((name: string, value: string, options: unknown) => {
        cookies.set(name, { value, options });
      }),
    },
  };
}

vi.mock('next/server', () => {
  const fakeResponse = createFakeResponse();
  return {
    NextResponse: {
      next: vi.fn(() => fakeResponse),
      redirect: vi.fn((url: URL) => ({
        status: 307,
        headers: new Headers({ location: url.toString() }),
      })),
    },
  };
});

// ── Mock @supabase/ssr ───────────────────────────────────────────────────────
const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  })),
}));

// Import after mocks
import { middleware } from './middleware';

// ── Helpers ──────────────────────────────────────────────────────────────────
function isRedirectToLogin(response: { status: number; headers: Headers }): boolean {
  const location = response.headers.get('location');
  if (!location) return false;
  try {
    return response.status === 307 && new URL(location).pathname === '/login';
  } catch {
    return false;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('admin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when there is no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect(isRedirectToLogin(response as any)).toBe(true);
  });

  it('redirects to /login when session exists but user is missing', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: null } } });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect(isRedirectToLogin(response as any)).toBe(true);
  });

  it('redirects to /login for a non-admin user', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'user-456', app_metadata: { role: 'user' } },
        },
      },
    });

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { role: 'user' } });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect(isRedirectToLogin(response as any)).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('allows admin user through via JWT fast-path', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'admin-1', app_metadata: { role: 'admin' } },
        },
      },
    });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect((response as any).status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('allows admin user through via DB fallback', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'admin-2', app_metadata: {} },
        },
      },
    });

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { role: 'admin' } });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect((response as any).status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockEq).toHaveBeenCalledWith('id', 'admin-2');
  });

  it('redirects when DB fallback returns null profile', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'ghost', app_metadata: {} },
        },
      },
    });

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await middleware(createFakeRequest('/dashboard/articles') as any);

    expect(isRedirectToLogin(response as any)).toBe(true);
  });
});
