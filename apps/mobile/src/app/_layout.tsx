import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Provider as UrqlProvider } from 'urql';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { createUrqlClient } from '../lib/urql';
import { useAuthStore } from '../stores/auth.store';

export default function RootLayout() {
  const { session, isLoading, setSession, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

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

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/(learn)');
    }
  }, [session, segments, isLoading, router.replace]);

  if (isLoading) return null;

  return (
    <UrqlProvider value={urqlClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </UrqlProvider>
  );
}
