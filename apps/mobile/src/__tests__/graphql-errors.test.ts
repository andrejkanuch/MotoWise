import { extractGraphQLMessage, hasGraphQLCode } from '../lib/graphql-errors';

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
});
