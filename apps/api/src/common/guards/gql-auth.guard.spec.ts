import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GqlAuthGuard } from './gql-auth.guard';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';

const mockJwtVerify = vi.mocked(jwtVerify);

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;
  let mockRequest: { headers: Record<string, string>; user?: unknown; accessToken?: string };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
    };

    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    } as unknown as GqlExecutionContext);

    const configService = {
      getOrThrow: vi.fn().mockReturnValue('test-jwt-secret'),
    } as unknown as ConfigService;

    guard = new GqlAuthGuard(configService);
  });

  it('should set user on request when JWT is valid', async () => {
    mockRequest.headers.authorization = 'Bearer valid.jwt.token';
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'rider@example.com',
        app_metadata: { role: 'admin' },
      },
      protectedHeader: { alg: 'HS256' },
    } as never);

    const result = await guard.canActivate({} as never);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({
      id: 'user-123',
      email: 'rider@example.com',
      role: 'admin',
    });
    expect(mockRequest.accessToken).toBe('valid.jwt.token');
  });

  it('should throw UNAUTHENTICATED when JWT is expired', async () => {
    mockRequest.headers.authorization = 'Bearer expired.jwt.token';
    mockJwtVerify.mockRejectedValue(new Error('JWT expired'));

    await expect(guard.canActivate({} as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate({} as never)).rejects.toThrow('Invalid or expired token');
  });

  it('should throw when authorization header is missing', async () => {
    await expect(guard.canActivate({} as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate({} as never)).rejects.toThrow('Missing authorization header');
  });

  it('should throw when scheme is Basic instead of Bearer', async () => {
    mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';

    await expect(guard.canActivate({} as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate({} as never)).rejects.toThrow('Missing authorization header');
  });

  it('should throw when token after Bearer is empty', async () => {
    mockRequest.headers.authorization = 'Bearer ';
    mockJwtVerify.mockRejectedValue(new Error('Invalid compact JWS'));

    await expect(guard.canActivate({} as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate({} as never)).rejects.toThrow('Invalid or expired token');
  });

  it('should throw when JWT is malformed', async () => {
    mockRequest.headers.authorization = 'Bearer not-a-real-jwt';
    mockJwtVerify.mockRejectedValue(new Error('Invalid compact JWS'));

    await expect(guard.canActivate({} as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate({} as never)).rejects.toThrow('Invalid or expired token');
  });
});
