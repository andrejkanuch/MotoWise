import { createClient } from '@supabase/supabase-js';
import { captureException } from './analytics';
import { secureStoreAuthAdapter } from './secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keychain-backed, fail-soft, and stored with AFTER_FIRST_UNLOCK so a
    // background TOKEN_REFRESHED on a locked device can still read the session
    // instead of dropping it (lib/secure-store, MOTO-VAULT-REACT-NATIVE-2D).
    storage: secureStoreAuthAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Sign out safely — no-ops when the session is already gone instead of
 * throwing "the current user is anonymous".  Failures are logged to Sentry.
 */
export async function safeSignOut(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.signOut().catch((err) => {
      captureException(err, { source: 'supabase.safeSignOut' });
    });
  }
}
