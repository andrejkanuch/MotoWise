import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the factory passed to createParamDecorator
let capturedFactory: (data: unknown, context: ExecutionContext) => unknown;

vi.mock('@nestjs/common', async () => {
  const actual = await vi.importActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    ...actual,
    createParamDecorator: (factory: (data: unknown, context: ExecutionContext) => unknown) => {
      capturedFactory = factory;
      return () => {};
    },
  };
});

describe('CurrentUser decorator', () => {
  const mockUser = {
    id: 'user-456',
    email: 'rider@example.com',
    role: 'user',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { user: mockUser },
      }),
    } as unknown as GqlExecutionContext);

    // Force re-import so the mock captures the factory
    vi.resetModules();
    await import('./current-user.decorator');
  });

  it('should return the user object from request context', () => {
    const mockExecutionContext = {} as ExecutionContext;
    const result = capturedFactory(undefined, mockExecutionContext);

    expect(result).toEqual(mockUser);
    expect(result).toHaveProperty('id', 'user-456');
    expect(result).toHaveProperty('email', 'rider@example.com');
    expect(result).toHaveProperty('role', 'user');
  });
});
