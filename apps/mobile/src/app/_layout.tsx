import '../global.css';
import { MeDocument } from '@motolearn/graphql';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Provider as UrqlProvider, useQuery } from 'urql';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { createUrqlClient } from '../lib/urql';
import { useAuthStore } from '../stores/auth.store';

function NavigationGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading, onboardingCompleted: storeOnboardingCompleted, setOnboardingCompleted } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const [meResult] = useQuery({
    query: MeDocument,
    pause: !session,
  });

  const preferences = meResult.data?.me?.preferences as
    | { onboardingCompleted?: boolean }
    | null
    | undefined;
  const serverOnboardingCompleted = preferences?.onboardingCompleted === true;
  const onboardingCompleted = storeOnboardingCompleted || serverOnboardingCompleted;

  // Sync server state to store
  useEffect(() => {
    if (serverOnboardingCompleted && !storeOnboardingCompleted) {
      setOnboardingCompleted(true);
    }
  }, [serverOnboardingCompleted, storeOnboardingCompleted, setOnboardingCompleted]);

  useEffect(() => {
    if (isLoading) return;
    if (meResult.fetching) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    console.log('[NavGate]', { segments: segments[0], session: !!session, onboardingCompleted, serverOnboardingCompleted, storeOnboardingCompleted, fetching: meResult.fetching });

    let target: string | null = null;

    if (!session && !inAuthGroup) {
      target = '/(auth)/login';
    } else if (session && inAuthGroup) {
      target = onboardingCompleted ? '/(tabs)/(home)' : '/(onboarding)';
    } else if (session && !inOnboarding && !onboardingCompleted) {
      target = '/(onboarding)';
    } else if (session && inOnboarding && onboardingCompleted) {
      target = '/(tabs)/(home)';
    }

    if (target) {
      console.log('[NavGate] →', target);
      // Defer navigation to avoid setState-during-render warning
      setTimeout(() => router.replace(target as any), 0);
    }
  }, [session, segments, isLoading, router, onboardingCompleted, meResult.fetching]);

  if (isLoading || (session && meResult.fetching)) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const { session, setSession, setLoading } = useAuthStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: recreate client when user changes
  const urqlClient = useMemo(() => createUrqlClient(), [session?.user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setLoading, setSession]);

  useEffect(() => {
    const locale = useAuthStore.getState().locale;
    if (locale !== 'en') i18n.changeLanguage(locale);
  }, []);

  return (
    <UrqlProvider value={urqlClient}>
      <NavigationGate>
        <Stack screenOptions={{ headerShown: false }} />
      </NavigationGate>
    </UrqlProvider>
  );
}
