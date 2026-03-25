import '../global.css';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Method readAsStringAsync imported from "expo-file-system" is deprecated']);

import { CompleteMaintenanceTaskDocument, MeDocument } from '@motovault/graphql';
import { Currency, MeasurementSystem } from '@motovault/types';
import MapboxGL from '@rnmapbox/maps';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AnimatedSplash } from '../components/animated-splash';
import { useNotificationDeepLink } from '../hooks/use-notification-deep-link';
import i18n from '../i18n';
import {
  identifyUser,
  initPostHog,
  initSentry,
  resetUser,
  sentryNavigationIntegration,
} from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  setupNotificationCategories,
  setupNotificationChannels,
  snoozeTaskNotification,
} from '../lib/notifications';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { setupFocusManager, setupOnlineManager } from '../lib/query-native';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth.store';

// Keep native splash visible until animated splash is ready
SplashScreen.preventAutoHideAsync();

// Initialize Sentry and PostHog as early as possible
initSentry();
initPostHog();

// Initialize Mapbox
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    retry: 1,
    retryDelay: 1000,
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

  // Hydrate user preferences (currency + measurementSystem) from server
  const setCurrency = useAuthStore((s) => s.setCurrency);
  const setMeasurementSystem = useAuthStore((s) => s.setMeasurementSystem);
  const serverCurrency = meQuery.data?.me?.currency;
  const serverMeasurementSystem = meQuery.data?.me?.measurementSystem;

  useEffect(() => {
    const state = useAuthStore.getState();
    if (serverCurrency && serverCurrency in Currency && serverCurrency !== state.currency) {
      setCurrency(serverCurrency as typeof state.currency);
    }
    if (
      serverMeasurementSystem &&
      serverMeasurementSystem in MeasurementSystem &&
      serverMeasurementSystem !== state.measurementSystem
    ) {
      setMeasurementSystem(serverMeasurementSystem as typeof state.measurementSystem);
    }
  }, [serverCurrency, serverMeasurementSystem, setCurrency, setMeasurementSystem]);

  useEffect(() => {
    if (isLoading) return;
    if (meQuery.isLoading && !meQuery.isError) return;

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
  }, [
    session,
    segments,
    isLoading,
    router,
    onboardingCompleted,
    meQuery.isLoading,
    meQuery.isError,
  ]);

  if (isLoading || (session && meQuery.isLoading && !meQuery.isError)) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const [appReady, setAppReady] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useNotificationDeepLink();

  useEffect(() => {
    if (navigationRef) {
      sentryNavigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loginRevenueCat(session.user.id);
        identifyUser(session.user.id);
      } else {
        logoutRevenueCat();
        resetUser();
      }
      if (!session) {
        queryClient.clear();
        cancelAllNotifications();
      }
    });

    return () => subscription.unsubscribe();
  }, [setLoading, setSession]);

  // Mark app as ready once auth state is resolved
  useEffect(() => {
    if (!isLoading) setAppReady(true);
  }, [isLoading]);

  useEffect(() => {
    const locale = useAuthStore.getState().locale;
    if (locale !== 'en') i18n.changeLanguage(locale);
  }, []);

  useEffect(() => {
    return setupFocusManager();
  }, []);

  // Initialize RevenueCat SDK with cleanup
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    initRevenueCat().then((c) => {
      if (cancelled) {
        c?.();
      } else {
        cleanup = c;
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Quick action routing — handles navigation automatically via params.href
  useQuickActionRouting();

  // Set up home screen quick actions
  useEffect(() => {
    QuickActions.setItems([
      {
        id: 'start-ride',
        title: i18n.t('quickActions.startRide', { defaultValue: 'Start Ride' }),
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:location.fill' : undefined,
        params: { href: '/(modals)/start-ride' },
      },
      {
        id: 'new-diagnostic',
        title: i18n.t('quickActions.diagnoseIssue', { defaultValue: 'Diagnose Issue' }),
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:wrench.and.screwdriver.fill' : undefined,
        params: { href: '/(tabs)/(diagnose)/new' },
      },
      {
        id: 'add-expense',
        title: i18n.t('quickActions.addExpense', { defaultValue: 'Add Expense' }),
        icon: process.env.EXPO_OS === 'ios' ? 'symbol:dollarsign.circle.fill' : undefined,
        params: { href: '/(tabs)/(garage)' },
      },
    ]);
  }, []);

  // Set up notification channels, categories, and request permission
  useEffect(() => {
    async function initNotifications() {
      await setupNotificationChannels();
      await setupNotificationCategories();
      await requestNotificationPermission();
    }
    initNotifications();
  }, []);

  // Handle notification action responses (Mark Done / Snooze)
  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data as {
          taskId?: string;
          motorcycleId?: string;
        };

        if (!data?.taskId) return;

        if (actionId === 'MARK_DONE') {
          try {
            await gqlFetcher(CompleteMaintenanceTaskDocument, { id: data.taskId });
            queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
            if (data.motorcycleId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.maintenanceTasks.byMotorcycle(data.motorcycleId),
              });
            }
          } catch {
            // Silently fail — user can mark done manually in app
          }
        } else if (actionId === 'SNOOZE_1D') {
          const title = response.notification.request.content.title ?? 'Maintenance task';
          await snoozeTaskNotification(
            {
              id: data.taskId,
              title: title.replace(/ due tomorrow$/, ''),
              motorcycleId: data.motorcycleId ?? '',
            },
            '',
          );
        }
      },
    );

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AnimatedSplash isReady={appReady}>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <NavigationGate>
              <Stack screenOptions={{ headerShown: false }} />
            </NavigationGate>
          </QueryClientProvider>
        </KeyboardProvider>
      </AnimatedSplash>
    </GestureHandlerRootView>
  );
}
