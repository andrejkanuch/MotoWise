// The app's own sign-outs (Log out, account deletion, an account that no longer
// exists) mark themselves here while `supabase.auth.signOut` runs. supabase-js
// awaits every `onAuthStateChange` callback before `signOut` resolves, so the
// auth listener sees the mark on the SIGNED_OUT it causes and applies it at once
// instead of holding it as a possible blip (issue 365 T15, lib/auth-state-change).

let depth = 0;

export async function withExplicitSignOut<T>(signOut: () => Promise<T>): Promise<T> {
  depth += 1;
  try {
    return await signOut();
  } finally {
    depth -= 1;
  }
}

export function isExplicitSignOutInProgress(): boolean {
  return depth > 0;
}
