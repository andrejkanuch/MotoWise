import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Provider as UrqlProvider } from 'urql';
import { supabase } from '../lib/supabase';
import { createUrqlClient } from '../lib/urql';
import { useAuthStore } from '../stores/auth.store';

const urqlClient = createUrqlClient();

export default function RootLayout() {
  const { session, isLoading, setSession, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

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
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(learn)');
    }
  }, [session, segments, isLoading, router.replace]);

  if (isLoading) return null;

  return (
    <UrqlProvider value={urqlClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </UrqlProvider>
  );
}
