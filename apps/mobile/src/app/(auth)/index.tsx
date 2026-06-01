import { Redirect } from 'expo-router';

/**
 * Owns `/` for the signed-out state.
 *
 * The root path `/` is claimed by three group index routes:
 * `(tabs)/(home)/index`, `(onboarding)/index`, and this one. Stack.Protected
 * gates the first two, so when the user is signed out neither is available — and
 * without this screen `/` would have no available owner and fall through to
 * `+not-found` ("Page not found"). This guarantees a deterministic landing
 * (login) on a logged-out cold start instead of relying on Expo's
 * "first available screen" heuristic.
 *
 * It lives inside the `guard={!isSignedIn}` block in the root layout, so it is
 * only ever the `/` owner while signed out; once a session exists the guard
 * removes it and `/` resolves to (onboarding) or (tabs).
 */
export default function AuthIndex() {
  return <Redirect href="/(auth)/login" />;
}
