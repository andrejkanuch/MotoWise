/** GraphQL errors from graphql-request use this response shape. */
export function extractGraphQLMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'errors' in error.response &&
    Array.isArray(error.response.errors) &&
    error.response.errors[0]?.message
  ) {
    return error.response.errors[0].message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function hasGraphQLCode(error: unknown, code: string): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'errors' in error.response &&
    Array.isArray(error.response.errors)
  ) {
    return error.response.errors.some(
      (e: { extensions?: { code?: string } }) => e.extensions?.code === code,
    );
  }
  return false;
}
