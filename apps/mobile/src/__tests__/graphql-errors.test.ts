import { extractGraphQLMessage, hasGraphQLCode, userFriendlyError } from '../lib/graphql-errors';

describe('graphql-errors', () => {
  it('extractGraphQLMessage reads first GraphQL error message', () => {
    const err = {
      response: { errors: [{ message: 'Not found' }] },
    };
    expect(extractGraphQLMessage(err)).toBe('Not found');
  });

  it('extractGraphQLMessage falls back for unknown shapes', () => {
    expect(extractGraphQLMessage(new Error('oops'))).toBe('oops');
    expect(extractGraphQLMessage(null)).toBe('Something went wrong');
  });

  it('hasGraphQLCode matches extensions.code', () => {
    const err = {
      response: {
        errors: [{ message: 'x', extensions: { code: 'UNAUTHENTICATED' } }],
      },
    };
    expect(hasGraphQLCode(err, 'UNAUTHENTICATED')).toBe(true);
    expect(hasGraphQLCode(err, 'FORBIDDEN')).toBe(false);
  });

  describe('userFriendlyError', () => {
    it('maps UNAUTHENTICATED code to friendly message', () => {
      const err = {
        response: {
          errors: [{ message: 'jwt expired', extensions: { code: 'UNAUTHENTICATED' } }],
        },
      };
      expect(userFriendlyError(err)).toBe('Your session has expired. Please sign in again.');
    });

    it('maps FORBIDDEN code to friendly message', () => {
      const err = {
        response: {
          errors: [{ message: 'Insufficient permissions', extensions: { code: 'FORBIDDEN' } }],
        },
      };
      expect(userFriendlyError(err)).toBe("You don't have permission to do this.");
    });

    it('maps TOO_MANY_REQUESTS code to friendly message', () => {
      const err = {
        response: {
          errors: [{ message: 'Rate limit', extensions: { code: 'TOO_MANY_REQUESTS' } }],
        },
      };
      expect(userFriendlyError(err)).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('passes through known user-friendly messages', () => {
      const err = {
        response: {
          errors: [{ message: 'Quality gate: needs at least 2 waypoints' }],
        },
      };
      expect(userFriendlyError(err)).toBe('Quality gate: needs at least 2 waypoints');
    });

    it('passes through Supabase auth messages', () => {
      expect(userFriendlyError(new Error('Invalid login credentials'))).toBe(
        'Invalid login credentials',
      );
    });

    it('maps network errors to friendly message', () => {
      expect(userFriendlyError(new Error('Network request failed'))).toBe(
        'Connection error. Please check your internet and try again.',
      );
    });

    it('returns generic fallback for unknown errors', () => {
      expect(userFriendlyError(new Error('NullPointerException at com.foo.bar'))).toBe(
        'Something went wrong. Please try again.',
      );
    });

    it('returns generic fallback for non-Error values', () => {
      expect(userFriendlyError(null)).toBe('Something went wrong. Please try again.');
      expect(userFriendlyError(undefined)).toBe('Something went wrong. Please try again.');
    });
  });
});
