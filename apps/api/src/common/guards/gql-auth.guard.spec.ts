import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GqlAuthGuard } from './gql-auth.guard';

// Mock jose at the top level (guard uses dynamic `await import('jose')`)
// NOTE: decodeProtectedHeader is SYNC in jose v6 → mockReturnValue;
// jwtVerify is async → mockResolvedValue (sync mocks on async fns hide missing awaits).
const mockJwtVerify = vi.fn();
const mockDecodeProtectedHeader = vi.fn();
const mockCreateRemoteJWKSet = vi.fn();

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
  decodeProtectedHeader: mockDecodeProtectedHeader,
  createRemoteJWKSet: mockCreateRemoteJWKSet,
}));

vi.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

const VERIFY_OPTIONS = {
  audience: 'authenticated',
  issuer: 'https://test.supabase.co/auth/v1',
};

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;
  let mockConfigService: { getOrThrow: ReturnType<typeof vi.fn> };
  let mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let mockRequest: { headers: Record<string, string>; user?: unknown; accessToken?: string };

  const mockExecutionContext = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    getType: vi.fn().mockReturnValue('graphql'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionContext.getType.mockReturnValue('graphql');

    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_JWT_SECRET') return 'test-secret';
        throw new Error(`Unknown key: ${key}`);
      }),
      get: vi.fn((_key: string, defaultValue?: string) => defaultValue ?? undefined),
    };

    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    mockRequest = { headers: {} };

    (GqlExecutionContext.create as ReturnType<typeof vi.fn>).mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    });

    const mockSupabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                subscription_tier: 'free',
                subscription_status: 'free',
                subscription_expires_at: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    guard = new GqlAuthGuard(
      mockConfigService as unknown as ConfigService,
      mockReflector as unknown as Reflector,
      mockSupabaseAdmin as never,
    );
  });

  // Helper to set up a valid HS256 token scenario
  function setupHs256Token(token: string, payload: Record<string, unknown>) {
    mockRequest.headers.authorization = `Bearer ${token}`;
    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
    mockJwtVerify.mockResolvedValue({ payload });
  }

  it('should return true for @Public() routes', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const result = await guard.canActivate(mockExecutionContext as never);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Missing authorization header',
    );
  });

  it("should throw UnauthorizedException for header without 'Bearer ' prefix", async () => {
    mockRequest.headers.authorization = 'Basic some-token';
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Missing authorization header',
    );
  });

  it('should throw UnauthorizedException for Bearer with empty token', async () => {
    mockRequest.headers.authorization = 'Bearer ';
    mockDecodeProtectedHeader.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should validate HS256 token with pinned algorithm + audience + issuer', async () => {
    setupHs256Token('valid-hs256-token', {
      sub: 'user-123',
      email: 'test@example.com',
      app_metadata: { role: 'admin' },
    });

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-hs256-token', expect.anything(), {
      ...VERIFY_OPTIONS,
      algorithms: ['HS256'],
    });
  });

  it('should validate JWKS token when header has kid, pinning asymmetric algorithms', async () => {
    mockRequest.headers.authorization = 'Bearer valid-jwks-token';
    const mockJwksKeySet = vi.fn();
    mockDecodeProtectedHeader.mockReturnValue({ kid: 'key-1', alg: 'RS256' });
    mockCreateRemoteJWKSet.mockReturnValue(mockJwksKeySet);
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-456',
        email: 'jwks@example.com',
        app_metadata: { role: 'user' },
      },
    });

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://test.supabase.co/auth/v1/.well-known/jwks.json'),
    );
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-jwks-token', mockJwksKeySet, {
      ...VERIFY_OPTIONS,
      algorithms: ['ES256', 'RS256'],
    });
  });

  it('should throw UnauthorizedException for expired/invalid token', async () => {
    mockRequest.headers.authorization = 'Bearer expired-token';
    mockDecodeProtectedHeader.mockImplementation(() => {
      throw new Error('Token expired');
    });
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should reject a token without sub (anon/service keys verify but carry no subject)', async () => {
    // The Supabase anon key is a valid HS256 JWT signed with the same secret —
    // requiring `sub` is what stops it from authenticating as a user.
    setupHs256Token('anon-key-token', { role: 'anon' });

    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
    expect(mockRequest.user).toBeUndefined();
  });

  it('should proceed WITHOUT a user when anon key is sent to a @Public() route', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    setupHs256Token('anon-key-token', { role: 'anon' });

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockRequest.user).toBeUndefined();
  });

  it('should enforce auth on REST (http) routes that are not @Public()', async () => {
    mockExecutionContext.getType.mockReturnValue('http');
    const restContext = {
      ...mockExecutionContext,
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    };

    await expect(guard.canActivate(restContext as never)).rejects.toThrow(
      'Missing authorization header',
    );
  });

  it('should allow @Public() REST (http) routes through without a token', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    mockExecutionContext.getType.mockReturnValue('http');
    const restContext = {
      ...mockExecutionContext,
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    };

    const result = await guard.canActivate(restContext as never);
    expect(result).toBe(true);
  });

  it('should extract user correctly with id, email, and role', async () => {
    setupHs256Token('valid-token', {
      sub: 'user-789',
      email: 'user@example.com',
      app_metadata: { role: 'premium' },
    });

    await guard.canActivate(mockExecutionContext as never);

    expect(mockRequest.user).toEqual({
      id: 'user-789',
      email: 'user@example.com',
      role: 'premium',
      tier: 'pro', // ENTITLEMENTS_ENFORCED defaults to false → everyone gets pro (Phase 1)
    });
  });

  it('should fallback to user_role when app_metadata.role is missing', async () => {
    setupHs256Token('token-1', {
      sub: 'user-a',
      email: 'a@example.com',
      app_metadata: {},
      user_role: 'moderator',
    });

    await guard.canActivate(mockExecutionContext as never);
    expect(mockRequest.user).toEqual({
      id: 'user-a',
      email: 'a@example.com',
      role: 'moderator',
      tier: 'pro',
    });
  });

  it('should default role to "user" when both app_metadata.role and user_role are missing', async () => {
    setupHs256Token('token-2', {
      sub: 'user-b',
      email: 'b@example.com',
      app_metadata: {},
    });

    await guard.canActivate(mockExecutionContext as never);
    expect(mockRequest.user).toEqual({
      id: 'user-b',
      email: 'b@example.com',
      role: 'user',
      tier: 'pro',
    });
  });

  it('should store raw token on request.accessToken', async () => {
    setupHs256Token('my-raw-token', {
      sub: 'user-123',
      email: 'test@example.com',
      app_metadata: { role: 'user' },
    });

    await guard.canActivate(mockExecutionContext as never);
    expect(mockRequest.accessToken).toBe('my-raw-token');
  });

  describe('resolveEffectiveTier (entitlements enforced)', () => {
    // Builds a guard with ENTITLEMENTS_ENFORCED=true and a users row stub.
    function guardWithUserRow(row: {
      subscription_tier: string;
      subscription_status: string;
      subscription_expires_at: string | null;
    }): GqlAuthGuard {
      const config = {
        getOrThrow: vi.fn((key: string) => {
          if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
          if (key === 'SUPABASE_JWT_SECRET') return 'test-secret';
          throw new Error(`Unknown key: ${key}`);
        }),
        get: vi.fn((key: string, defaultValue?: string) =>
          key === 'ENTITLEMENTS_ENFORCED' ? 'true' : (defaultValue ?? undefined),
        ),
      };
      const supabaseAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: row, error: null }),
            }),
          }),
        }),
      };
      return new GqlAuthGuard(
        config as unknown as ConfigService,
        mockReflector as unknown as Reflector,
        supabaseAdmin as never,
      );
    }

    // Regression: new Date(null) coerces to 1970 → always "expired", which
    // silently downgraded active/trialing Pro users with a null (lifetime) expiry.
    it("treats a null expiry on an active Pro row as 'pro', not 'free'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'pro',
        subscription_status: 'active',
        subscription_expires_at: null,
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-lifetime');
      expect(tier).toBe('pro');
    });

    it("downgrades an active Pro row with a past expiry to 'free'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'pro',
        subscription_status: 'active',
        subscription_expires_at: '2000-01-01T00:00:00.000Z',
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-expired');
      expect(tier).toBe('free');
    });

    it("keeps a future-dated active Pro row as 'pro'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'pro',
        subscription_status: 'active',
        subscription_expires_at: '2999-01-01T00:00:00.000Z',
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-active');
      expect(tier).toBe('pro');
    });

    it("treats a trialing Pro row with a null expiry as 'pro'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'pro',
        subscription_status: 'trialing',
        subscription_expires_at: null,
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-trial');
      expect(tier).toBe('pro');
    });

    // The null-expiry relaxation must NOT promote a non-pro or inactive row.
    it("keeps a non-pro tier with a null expiry as 'free'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'free',
        subscription_status: 'active',
        subscription_expires_at: null,
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-free');
      expect(tier).toBe('free');
    });

    it("keeps a cancelled Pro row with a null expiry as 'free'", async () => {
      const g = guardWithUserRow({
        subscription_tier: 'pro',
        subscription_status: 'canceled',
        subscription_expires_at: null,
      });
      const tier = await (
        g as unknown as { resolveEffectiveTier: (id: string) => Promise<string> }
      ).resolveEffectiveTier('user-cancelled');
      expect(tier).toBe('free');
    });
  });
});
