type GqlError = { extensions?: { code?: string }; message?: string };

function extractGqlErrors(error: unknown): GqlError[] | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'errors' in error.response &&
    Array.isArray(error.response.errors)
  ) {
    return error.response.errors as GqlError[];
  }
  return undefined;
}

/** Extract raw GraphQL error message — use only for logging/Sentry, never show to users. */
export function extractGraphQLMessage(error: unknown): string {
  const errors = extractGqlErrors(error);
  if (errors?.[0]?.message) return errors[0].message;
  return error instanceof Error ? error.message : 'Something went wrong';
}

/**
 * Well-known backend messages that are safe/intended to show to users.
 * Matched case-insensitively via `includes`.
 */
const PASSTHROUGH_MESSAGES = [
  'quality gate',
  'already published',
  'already cloned',
  'already reviewed',
  'invalid login credentials',
  'email not confirmed',
  'user already registered',
  'password should be at least',
  'email rate limit exceeded',
  'signups not allowed',
] as const;

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

/**
 * Returns a user-friendly error message safe to show in Alert.alert or UI text.
 * - Maps GraphQL error codes to friendly messages.
 * - Passes through known backend messages that are already user-facing.
 * - Falls back to a generic message for anything else.
 */
export function userFriendlyError(error: unknown): string {
  const errors = extractGqlErrors(error);
  const code = errors?.[0]?.extensions?.code;
  const raw = errors?.[0]?.message ?? (error instanceof Error ? error.message : '');

  // Map GraphQL error codes to friendly messages
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Your session has expired. Please sign in again.';
    case 'FORBIDDEN':
      return "You don't have permission to do this.";
    case 'NOT_FOUND':
      return 'The requested item could not be found.';
    case 'BAD_REQUEST':
    case 'BAD_USER_INPUT':
      return 'Please check your input and try again.';
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests. Please wait a moment and try again.';
    case 'CONFLICT':
      return 'This action conflicts with an existing item.';
  }

  // Pass through known messages that are already user-friendly
  const lower = raw.toLowerCase();
  if (PASSTHROUGH_MESSAGES.some((msg) => lower.includes(msg))) {
    return raw;
  }

  // Network / connectivity errors
  if (/network|failed to fetch|internet|offline|econnrefused|timeout/i.test(raw)) {
    return 'Connection error. Please check your internet and try again.';
  }

  return GENERIC_FALLBACK;
}

/**
 * True when a deleteAccount mutation failed because the account is already gone
 * server-side — deleted in a prior attempt, or the underlying auth user no longer
 * exists ("User not found or already deleted"). The desired end state is identical
 * to success, so callers treat this as success (sign out + navigate) instead of
 * surfacing an error. (Sentry MOTO-VAULT-REACT-NATIVE-1J)
 */
export function isAccountAlreadyDeleted(error: unknown): boolean {
  const message = extractGraphQLMessage(error).toLowerCase();
  return message.includes('already deleted') || message.includes('user not found');
}

export function hasGraphQLCode(error: unknown, code: string): boolean {
  const errors = extractGqlErrors(error);
  if (!errors) return false;
  return errors.some((e) => e.extensions?.code === code);
}
