import { UnauthorizedException } from '@nestjs/common';
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

// Mock GqlExecutionContext.create
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

    mockRequest = {
      headers: {},
    };

    (GqlExecutionContext.create as ReturnType<typeof vi.fn>).mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    });

    guard = new GqlAuthGuard(
      mockConfigService as unknown as ConfigService,
      mockReflector as unknown as Reflector,
    );
  });

  it('should return true for @Public() routes', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
      mockExecutionContext.getHandler(),
      mockExecutionContext.getClass(),
    ]);
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    mockRequest.headers = {};

    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Missing authorization header',
    );
  });

  it("should throw UnauthorizedException for header without 'Bearer ' prefix", async () => {
    mockRequest.headers.authorization = 'Basic some-token';

    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Missing authorization header',
    );
  });

  it('should validate HS256 token and extract user (no kid in header)', async () => {
    mockRequest.headers.authorization = 'Bearer valid-hs256-token';

    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'test@example.com',
        app_metadata: { role: 'admin' },
      },
    });

    const result = await guard.canActivate(mockExecutionContext as never);

    expect(result).toBe(true);
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-hs256-token', expect.any(Uint8Array));
  });

  it('should validate JWKS token when header has kid', async () => {
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
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-jwks-token', mockJwksKeySet);
  });

  it('should throw UnauthorizedException for expired/invalid token', async () => {
    mockRequest.headers.authorization = 'Bearer expired-token';

    mockDecodeProtectedHeader.mockImplementation(() => {
      throw new Error('Token expired');
    });

    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(mockExecutionContext as never)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should extract user correctly with id, email, and role', async () => {
    mockRequest.headers.authorization = 'Bearer valid-token';

    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-789',
        email: 'user@example.com',
        app_metadata: { role: 'premium' },
      },
    });

    await guard.canActivate(mockExecutionContext as never);

    expect(mockRequest.user).toEqual({
      id: 'user-789',
      email: 'user@example.com',
      role: 'premium',
    });
  });

  it('should fallback role: app_metadata.role -> user_role -> "user"', async () => {
    mockRequest.headers.authorization = 'Bearer token-1';
    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });

    // Fallback to user_role when app_metadata.role is missing
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-a',
        email: 'a@example.com',
        app_metadata: {},
        user_role: 'moderator',
      },
    });

    await guard.canActivate(mockExecutionContext as never);
    expect(mockRequest.user).toEqual({
      id: 'user-a',
      email: 'a@example.com',
      role: 'moderator',
    });

    // Fallback to 'user' when both are missing
    vi.clearAllMocks();
    (GqlExecutionContext.create as ReturnType<typeof vi.fn>).mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    });
    mockRequest.headers.authorization = 'Bearer token-2';
    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-b',
        email: 'b@example.com',
        app_metadata: {},
      },
    });

    await guard.canActivate(mockExecutionContext as never);
    expect(mockRequest.user).toEqual({
      id: 'user-b',
      email: 'b@example.com',
      role: 'user',
    });
  });

  it('should store raw token on request.accessToken', async () => {
    mockRequest.headers.authorization = 'Bearer my-raw-token';

    mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'test@example.com',
        app_metadata: { role: 'user' },
      },
    });

    await guard.canActivate(mockExecutionContext as never);

    expect(mockRequest.accessToken).toBe('my-raw-token');
  });
});
