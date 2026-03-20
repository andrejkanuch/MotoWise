import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GqlAuthGuard } from './gql-auth.guard';

// Mock jose at the top level (guard uses dynamic `await import('jose')`)
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

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;
  let mockConfigService: { getOrThrow: ReturnType<typeof vi.fn> };
  let mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let mockRequest: { headers: Record<string, string>; user?: unknown; accessToken?: string };

  const mockExecutionContext = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_JWT_SECRET') return 'test-secret';
        throw new Error(`Unknown key: ${key}`);
      }),
    };

    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };

    mockRequest = { headers: {} };

    (GqlExecutionContext.create as ReturnType<typeof vi.fn>).mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    });

    guard = new GqlAuthGuard(
      mockConfigService as unknown as ConfigService,
      mockReflector as unknown as Reflector,
    );
  });

  // Helper to set up a valid HS256 token scenario
  function setupHs256Token(token: string, payload: Record<string, unknown>) {
    mockRequest.headers.authorization = `Bearer ${token}`;
    mockDecodeProtectedHeader.mockResolvedValue({ alg: 'HS256' });
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
    mockDecodeProtectedHeader.mockRejectedValue(new Error('Invalid token'));
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should validate HS256 token and extract user (no kid in header)', async () => {
    setupHs256Token('valid-hs256-token', {
      sub: 'user-123',
      email: 'test@example.com',
      app_metadata: { role: 'admin' },
    });

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-hs256-token', expect.anything());
  });

  it('should validate JWKS token when header has kid', async () => {
    mockRequest.headers.authorization = 'Bearer valid-jwks-token';
    const mockJwksKeySet = vi.fn();
    mockDecodeProtectedHeader.mockResolvedValue({ kid: 'key-1', alg: 'RS256' });
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
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-jwks-token', mockJwksKeySet);
  });

  it('should throw UnauthorizedException for expired/invalid token', async () => {
    mockRequest.headers.authorization = 'Bearer expired-token';
    mockDecodeProtectedHeader.mockRejectedValue(new Error('Token expired'));
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
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
});
