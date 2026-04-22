import '../global.css';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Method readAsStringAsync imported from "expo-file-system" is deprecated']);

import { CompleteMaintenanceTaskDocument, MeDocument } from '@motovault/graphql';
import { Currency, MeasurementSystem } from '@motovault/types';
import MapboxGL from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';

// expo-quick-actions requires a custom dev build — guard for Expo Go
let QuickActions: typeof import('expo-quick-actions') | null = null;
let useQuickActionRouting: (() => void) | null = null;
try {
  QuickActions = require('expo-quick-actions');
  useQuickActionRouting = require('expo-quick-actions/router').useQuickActionRouting;
} catch {
  // Not available in Expo Go
}

import { Stack, useNavigationContainerRef, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AnimatedSplash } from '../components/animated-splash';
import { getWhatsNewRelease } from '../data/whats-new-releases';
import { useNotificationDeepLink } from '../hooks/use-notification-deep-link';
import i18n from '../i18n';
import {
  AnalyticsEvent,
  identifyUser,
  initPostHog,
  initSentry,
  posthogClient,
  resetUser,
  sentryNavigationIntegration,
  setUserProperties,
  trackEvent,
  trackScreen,
} from '../lib/analytics';
import { invalidateGqlAccessTokenCache } from '../lib/gql-auth-session';
import { gqlFetcher } from '../lib/graphql-client';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  setupNotificationCategories,
  setupNotificationChannels,
  snoozeTaskNotification,
} from '../lib/notifications';
import { PersistedQueryClientBoundary } from '../lib/persisted-query-provider';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { setupFocusManager, setupOnlineManager } from '../lib/query-native';
import { clearPersistedQueryCache } from '../lib/query-persist';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth.store';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useWhatsNewStore } from '../stores/whats-new.store';

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

  // Sync user properties to PostHog for segmentation
  const meData = meQuery.data?.me;
  const isPro = useSubscriptionStore((s) => s.isPro);
  useEffect(() => {
    if (!session?.user?.id || !meData) return;
    const prefs = meData.preferences as Record<string, unknown> | null | undefined;
    setUserProperties({
      experience_level: (prefs?.experienceLevel as string) ?? null,
      is_pro: isPro,
      currency: meData.currency ?? null,
      locale: useAuthStore.getState().locale,
      app_version: Application.nativeApplicationVersion ?? null,
    });
  }, [session?.user?.id, meData, isPro]);

  useEffect(() => {
    if (isLoading) return;
    if (meQuery.isLoading && !meQuery.isError) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    // Public share-link routes — anonymous recipients must be able to view
    // unlisted trip/ride share previews without being redirected to login.
    const inPublicShareRoute =
      segments[0] === 't' ||
      segments[0] === 'r' ||
      segments[0] === 'ride' ||
      segments[0] === 'routes' ||
      segments[0] === 'route';

    // Public share-link routes bypass the entire auth/onboarding gate.
    // Anonymous AND authenticated users (even mid-onboarding) must be able
    // to view shared trip/ride previews. Resolving the token is independent
    // of any session state.
    if (inPublicShareRoute) return;

    let target: string | null = null;

    if (!session && !inAuthGroup && !inPublicShareRoute) {
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

  // --- What's New modal trigger ---
  const lastSeenVersion = useWhatsNewStore((s) => s.lastSeenVersion);
  const whatsNewShown = useRef(false);

  useEffect(() => {
    if (isLoading || !session || !onboardingCompleted) return;
    if (whatsNewShown.current) return;

    const currentVersion = Application.nativeApplicationVersion;
    if (!currentVersion || currentVersion === lastSeenVersion) return;

    // Only show if we have release data for this version
    if (!getWhatsNewRelease(currentVersion)) return;

    // Avoid showing during initial navigation
    const inTabs = segments[0] === '(tabs)';
    if (!inTabs) return;

    whatsNewShown.current = true;
    trackEvent(AnalyticsEvent.WHATS_NEW_VIEWED, { version: currentVersion });
    setTimeout(() => router.push('/(modals)/whats-new' as never), 500);
  }, [isLoading, session, onboardingCompleted, segments, lastSeenVersion, router]);

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
  const pathname = usePathname();
  const previousPathname = useRef<string | undefined>(undefined);

  useNotificationDeepLink();

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      trackScreen(pathname, { previous_screen: previousPathname.current ?? null });
      previousPathname.current = pathname;
    }
  }, [pathname]);

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
      invalidateGqlAccessTokenCache();
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
        clearPersistedQueryCache();
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
  useQuickActionRouting?.();

  // Set up home screen quick actions
  useEffect(() => {
    QuickActions?.setItems([
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
      <PostHogProvider
        client={posthogClient}
        autocapture={{ captureScreens: false, captureTouches: true }}
      >
        <AnimatedSplash isReady={appReady}>
          <KeyboardProvider>
            <PersistedQueryClientBoundary>
              <NavigationGate>
                <Stack screenOptions={{ headerShown: false }} />
              </NavigationGate>
            </PersistedQueryClientBoundary>
          </KeyboardProvider>
        </AnimatedSplash>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
