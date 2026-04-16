import type { Session } from '@supabase/supabase-js';

/**
 * Resolve the best available avatar URL for the signed-in user.
 *
 * Priority:
 *   1. `public.users.avatar_url` (user-uploaded / canonical)
 *   2. OAuth provider's `user_metadata.avatar_url` (Google)
 *   3. OAuth provider's `user_metadata.picture` (alt Google key)
 *
 * Returns null if no avatar is available (UI should fall back to initials).
 *
 * NOTE: Apple Sign-In does not return a profile picture, so Apple-only users
 * will always fall through to initials unless they upload one.
 */
export function getUserAvatarUrl(
  dbAvatarUrl: string | null | undefined,
  session: Session | null,
): string | null {
  if (dbAvatarUrl) return dbAvatarUrl;

  const meta = session?.user?.user_metadata as
    | { avatar_url?: string; picture?: string }
    | undefined;
  return meta?.avatar_url ?? meta?.picture ?? null;
}

/** Build initials from a full name (max 2 chars). */
export function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  return fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
