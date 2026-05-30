import '../global.css';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { AppState, LogBox } from 'react-native';

LogBox.ignoreLogs(['Method readAsStringAsync imported from "expo-file-system" is deprecated']);

import { CompleteMaintenanceTaskDocument, MeDocument } from '@motovault/graphql';
import { Currency, MeasurementSystem } from '@motovault/types';
import MapboxGL from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Settings } from 'react-native-fbsdk-next';

// expo-quick-actions requires a custom dev build — guard for Expo Go
let QuickActions: typeof import('expo-quick-actions') | null = null;
let useQuickActionRouting: (() => void) | null = null;
try {
  QuickActions = require('expo-quick-actions');
  useQuickActionRouting = require('expo-quick-actions/router').useQuickActionRouting;
} catch {
  // Not available in Expo Go
}

import * as Linking from 'expo-linking';
import { Stack, useNavigationContainerRef, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AnimatedSplash } from '../components/animated-splash';
import { SurveyOverlay } from '../components/survey/survey-overlay';
import { getWhatsNewRelease } from '../data/whats-new-releases';
import { useNotificationDeepLink } from '../hooks/use-notification-deep-link';
import i18n from '../i18n';
import {
  AnalyticsEvent,
  captureException,
  identifyUser,
  initPostHog,
  initSentry,
  posthogClient,
  resetUser,
  sentryNavigationIntegration,
  setAnalyticsEnabled,
  setCrashReportingEnabled,
  setUserProperties,
  trackEvent,
  trackScreen,
  withSentry,
} from '../lib/analytics';
import { invalidateGqlAccessTokenCache } from '../lib/gql-auth-session';
import { gqlFetcher } from '../lib/graphql-client';
import { captureMetaAttribution } from '../lib/meta-attribution';
import { migrateAsyncStorageToMMKV } from '../lib/migrate-async-to-mmkv';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  setupNotificationCategories,
  setupNotificationChannels,
  snoozeTaskNotification,
} from '../lib/notifications';
import { LAST_USER_KEY, PersistedQueryClientBoundary } from '../lib/persisted-query-provider';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { setupFocusManager, setupOnlineManager } from '../lib/query-native';
import { clearPersistedQueryCache } from '../lib/query-persist';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { clearAllWidgets, syncWidgets } from '../lib/widget-sync';
import { useAuthStore } from '../stores/auth.store';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useWhatsNewStore } from '../stores/whats-new.store';
import { clearRideData, rideMMKV } from '../utils/ride-storage';
import { clearAll as clearSyncQueue, drainQueue } from '../utils/ride-sync-queue';

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

// Module-scoped guard: survives React 19 StrictMode double-mount so the
// What's New modal is only pushed once per app cold-start.
let whatsNewPushed = false;

// First path segment of public share-link routes that bypass the auth/onboarding
// gate (token resolvers for shared trips/rides). `r` is a bare short-link host
// with no matching app/ route, so it isn't part of the generated typed-route union.
const PUBLIC_SHARE_SEGMENTS = ['t', 'r', 'ride', 'routes', 'route'];

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
    meta: { showErrorAlert: false },
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
  const userPreferences = meData?.preferences as Record<string, unknown> | null | undefined;

  useEffect(() => {
    const privacy = userPreferences?.privacy as
      | { analyticsEnabled?: boolean; crashReportingEnabled?: boolean }
      | undefined;

    if (typeof privacy?.analyticsEnabled === 'boolean') {
      setAnalyticsEnabled(privacy.analyticsEnabled);
    }
    if (typeof privacy?.crashReportingEnabled === 'boolean') {
      setCrashReportingEnabled(privacy.crashReportingEnabled);
    }
  }, [userPreferences]);

  useEffect(() => {
    if (!session?.user?.id || !meData) return;
    setUserProperties({
      experience_level: (userPreferences?.experienceLevel as string) ?? null,
      is_pro: isPro,
      currency: meData.currency ?? null,
      locale: useAuthStore.getState().locale,
      app_version: Application.nativeApplicationVersion ?? null,
    });
  }, [session?.user?.id, meData, userPreferences, isPro]);

  useEffect(() => {
    if (isLoading) return;
    if (meQuery.isLoading && !meQuery.isError) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    // Public share-link routes — anonymous recipients must be able to view
    // unlisted trip/ride share previews without being redirected to login.
    // (Cast to string: typed routes don't include the bare `r` short-link host.)
    const inPublicShareRoute = PUBLIC_SHARE_SEGMENTS.includes(segments[0] as string);

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
  // Module-scoped `whatsNewPushed` flag survives React 19 StrictMode
  // double-mount (useRef and even immediate store writes can race).
  const lastSeenVersion = useWhatsNewStore((s) => s.lastSeenVersion);

  useEffect(() => {
    if (isLoading || !session || !onboardingCompleted) return;
    if (whatsNewPushed) return;

    const currentVersion = Application.nativeApplicationVersion;
    if (!currentVersion || currentVersion === lastSeenVersion) return;

    // Only show if we have release data for this version
    if (!getWhatsNewRelease(currentVersion)) return;

    // Avoid showing during initial navigation
    const inTabs = segments[0] === '(tabs)';
    if (!inTabs) return;

    whatsNewPushed = true;
    trackEvent(AnalyticsEvent.WHATS_NEW_VIEWED, { version: currentVersion });
    setTimeout(() => router.push('/(modals)/whats-new' as never), 500);
  }, [isLoading, session, onboardingCompleted, segments, lastSeenVersion, router]);

  if (isLoading || (session && meQuery.isLoading && !meQuery.isError)) {
    return null;
  }

  return (
    <>
      {children}
      <SurveyOverlay />
    </>
  );
}

function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const onSplashDismiss = useCallback(() => setSplashDismissed(true), []);

  // Load editorial fonts — don't block splash on this; text uses system fallback until loaded
  useFonts({
    'InstrumentSerif-Regular': InstrumentSerif_400Regular,
    'InstrumentSerif-Italic': InstrumentSerif_400Regular_Italic,
  });
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

  // Safety timeout: if auth takes too long, unblock the splash anyway
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        captureException(new Error('Auth hydration timeout — forcing app ready'), {
          source: 'RootLayout.authTimeout',
        });
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [setLoading]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch((error) => {
        captureException(error, { source: 'supabase.auth.getSession' });
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
        SecureStore.deleteItemAsync(LAST_USER_KEY);
        clearSyncQueue();
        const activeRideId = rideMMKV.getCurrentId();
        if (activeRideId) clearRideData(activeRideId);
        cancelAllNotifications();
        clearAllWidgets();
      }
    });

    return () => subscription.unsubscribe();
  }, [setLoading, setSession]);

  // Handle deep link auth callback (email confirmation / password reset)
  // When the web intermediary redirects to motovault://auth/callback?code=xxx,
  // exchange the code for a session in the mobile Supabase client.
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.hostname !== 'auth' || parsed.path !== 'callback') return;
      const code = parsed.queryParams?.code;
      if (typeof code !== 'string') return;
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        captureException(err, { source: 'deepLink.exchangeCodeForSession' });
      }
    };

    // Handle URL that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle URL while app is already open (warm start)
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

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

  // Migrate persisted Zustand stores from AsyncStorage to MMKV (one-time, idempotent)
  useEffect(() => {
    migrateAsyncStorageToMMKV();
  }, []);

  // Capture Meta ad attribution params (fbclid + UTM) from initial deep link
  useEffect(() => {
    captureMetaAttribution();
  }, []);

  // Initialize Meta/Facebook SDK + ATT prompt
  // ATT must be shown AFTER the splash screen is dismissed so the user can see
  // the system dialog. On Android, skip ATT and initialise the SDK immediately.
  useEffect(() => {
    if (process.env.EXPO_OS !== 'ios') {
      Settings.initializeSDK();
      return;
    }

    // On iOS, wait until the splash animation has fully dismissed so the ATT
    // dialog is not hidden behind it (Apple rejects apps where the prompt is
    // invisible — Guideline 2.1).
    if (!splashDismissed) return;

    let cancelled = false;

    async function initATTAndMetaSDK() {
      // Check if the user has already responded to the ATT prompt in a
      // previous session — only show the system dialog on first launch.
      const { status: currentStatus } = await getTrackingPermissionsAsync();

      let finalStatus = currentStatus;
      if (currentStatus === 'undetermined') {
        const { status } = await requestTrackingPermissionsAsync();
        finalStatus = status;
      }

      if (cancelled) return;

      // Initialise the Facebook SDK only AFTER the ATT decision is made so
      // no data is collected before consent.
      Settings.initializeSDK();
      try {
        Settings.setAdvertiserTrackingEnabled(finalStatus === 'granted');
      } catch {
        // setAdvertiserTrackingEnabled can crash on iOS simulator
      }
    }

    initATTAndMetaSDK();
    return () => {
      cancelled = true;
    };
  }, [splashDismissed]);

  // Drain ride sync queue on app resume, initial mount, and connectivity restore
  useEffect(() => {
    drainQueue();
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const appSub = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') {
        drainQueue();
        // Delay widget sync to let TanStack Query refetches settle, then read from cache
        setTimeout(() => syncWidgets(), 3000);
      }
    });
    const netSub = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => drainQueue(), 2000);
      }
    });
    return () => {
      appSub.remove();
      netSub.remove();
      clearTimeout(debounceTimer);
    };
  }, []);

  // Sync widgets once auth session is available (cold start + session restore)
  const session = useAuthStore((s) => s.session);
  useEffect(() => {
    if (!session) return;
    // Delay to let TanStack Query persist-restore and refetches settle
    const timer = setTimeout(() => syncWidgets(), 3000);
    return () => clearTimeout(timer);
  }, [session]);

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
        <AnimatedSplash isReady={appReady} onDismiss={onSplashDismiss}>
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

export default withSentry(RootLayout);
