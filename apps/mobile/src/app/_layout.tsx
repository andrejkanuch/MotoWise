import '../global.css';
import { MeDocument } from '@motolearn/graphql';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import i18n from '../i18n';
import { gqlFetcher } from '../lib/graphql-client';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { setupFocusManager, setupOnlineManager } from '../lib/query-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth.store';

setupOnlineManager();

function NavigationGate({ children }: { children: React.ReactNode }) {
  const {
    session,
    isLoading,
    onboardingCompleted: storeOnboardingCompleted,
    setOnboardingCompleted,
  } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
    enabled: !!session,
  });

  const preferences = meQuery.data?.me?.preferences as
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
    if (meQuery.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

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
      // Defer navigation to avoid setState-during-render warning
      // biome-ignore lint/suspicious/noExplicitAny: expo-router replace expects typed route literal
      setTimeout(() => router.replace(target as any), 0);
    }
  }, [session, segments, isLoading, router, onboardingCompleted, meQuery.isLoading]);

  if (isLoading || (session && meQuery.isLoading)) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const { setSession, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [setLoading, setSession]);

  useEffect(() => {
    const locale = useAuthStore.getState().locale;
    if (locale !== 'en') i18n.changeLanguage(locale);
  }, []);

  useEffect(() => {
    return setupFocusManager();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationGate>
        <Stack screenOptions={{ headerShown: false }} />
      </NavigationGate>
    </QueryClientProvider>
  );
}
