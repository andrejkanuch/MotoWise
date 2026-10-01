import { createClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
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

// Supabase's React Native guidance: run the token auto-refresh timer only while the
// app is in use. It is a permanently pending interval, and on iOS the CarPlay
// library's native timers (install-timers.ts) keep a main-thread tick alive for as
// long as any timer is pending, so leaving it on in the background costs battery on
// every locked-phone ride. Nothing loses auth: every GraphQL request refreshes a
// near-expiry token on demand (gql-auth-session.materializeSession), and getSession()
// refreshes an expired one. A CarPlay session keeps the app `active`, so refresh
// stays on while the head unit is in use.
//
// `autoRefreshToken` stays true so initialization still refreshes an expired session
// at launch; but initialization also starts the ticker unconditionally on native, and
// a launch that begins in the background (iOS relaunching the app for the background
// location task) never sees a `change` event to stop it — so the current state is
// applied once initialization has settled. `inactive` (Control Center, the ATT alert)
// is transient and leaves the ticker as it is.
const APP_STATE = { active: 'active', background: 'background' } as const;
function syncAutoRefresh(state: AppStateStatus): void {
  if (state === APP_STATE.active) supabase.auth.startAutoRefresh();
  else if (state === APP_STATE.background) supabase.auth.stopAutoRefresh();
}
AppState.addEventListener('change', syncAutoRefresh);
supabase.auth
  .initialize()
  .then(() => syncAutoRefresh(AppState.currentState))
  .catch((err) => captureException(err, { source: 'supabase.syncAutoRefresh' }));

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
