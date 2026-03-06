import { GqlExecutionContext } from '@nestjs/graphql';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleInterceptor } from './locale.interceptor';

describe('LocaleInterceptor', () => {
  let interceptor: LocaleInterceptor;
  let mockRequest: { headers: Record<string, string>; locale?: string };

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new LocaleInterceptor();
    mockRequest = { headers: {} };

    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: mockRequest }),
    } as unknown as GqlExecutionContext);
  });

  const mockNext = { handle: () => of('result') };

  it('should default to en when no locale headers are present', () => {
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('en');
  });

  it('should use Accept-Language header', () => {
    mockRequest.headers['accept-language'] = 'es-MX,es;q=0.9';
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('es');
  });

  it('should use x-locale header as fallback', () => {
    mockRequest.headers['x-locale'] = 'de';
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('de');
  });

  it('should prefer Accept-Language over x-locale', () => {
    mockRequest.headers['accept-language'] = 'de';
    mockRequest.headers['x-locale'] = 'es';
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('de');
  });

  it('should fall back to en for invalid locale', () => {
    mockRequest.headers['accept-language'] = 'fr';
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('en');
  });

  it('should fall back to en for malicious header value', () => {
    mockRequest.headers['x-locale'] = '../../etc/passwd';
    interceptor.intercept({} as never, mockNext);
    expect(mockRequest.locale).toBe('en');
  });
});
