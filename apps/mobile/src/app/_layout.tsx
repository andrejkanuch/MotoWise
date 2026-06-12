import '../global.css';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { AppState, LogBox } from 'react-native';

LogBox.ignoreLogs(['Method readAsStringAsync imported from "expo-file-system" is deprecated']);

import { palette } from '@motovault/design-system';
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
import * as SystemUI from 'expo-system-ui';
import { PostHogProvider, PostHogSurveyProvider } from 'posthog-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { OB_VARIANT } from '../config/onboarding';
import { getWhatsNewRelease } from '../data/whats-new-releases';
import { useNotificationDeepLink } from '../hooks/use-notification-deep-link';
import i18n from '../i18n';
import {
  AnalyticsEvent,
  captureException,
  getAnalyticsDistinctId,
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
import {
  AUTH_HYDRATION_TIMEOUT_MESSAGE,
  AUTH_HYDRATION_TIMEOUT_MS,
  AUTH_HYDRATION_TIMEOUT_SOURCE,
  shouldReportHydrationTimeout,
} from '../lib/auth-hydration';
import { decideAuthStateChange } from '../lib/auth-state-change';
import { invalidateGqlAccessTokenCache } from '../lib/gql-auth-session';
import { gqlFetcher } from '../lib/graphql-client';
import { captureMetaAttribution } from '../lib/meta-attribution';
import { migrateAsyncStorageToMMKV } from '../lib/migrate-async-to-mmkv';
import {
  cancelAllNotifications,
  setupNotificationCategories,
  setupNotificationChannels,
  snoozeTaskNotification,
} from '../lib/notifications';
import { resolveOnboardingVariant } from '../lib/onboarding-experiment';
import { LAST_USER_KEY, PersistedQueryClientBoundary } from '../lib/persisted-query-provider';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { setupFocusManager, setupOnlineManager } from '../lib/query-native';
import { clearPersistedQueryCache } from '../lib/query-persist';
import {
  configureRevenueCatAnonymously,
  initRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
} from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { clearAllWidgets, syncWidgets } from '../lib/widget-sync';
import { useAuthStore } from '../stores/auth.store';
import { useExperimentStore } from '../stores/experiment.store';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useWhatsNewStore } from '../stores/whats-new.store';
import { clearRideData, rideMMKV } from '../utils/ride-storage';
import { clearAll as clearSyncQueue, drainQueue } from '../utils/ride-sync-queue';

// Native splash is the ONLY splash: hold it while the app boots (auth hydration
// + the `me` gate), then fade it out directly into real UI. The app tree mounts
// and fetches underneath it from the first frame.
SplashScreen.preventAutoHideAsync();
const SPLASH_FADE_MS = 400;
SplashScreen.setOptions({ duration: SPLASH_FADE_MS, fade: true });

/** Hard cap — if hydration or the `me` query ever hangs, never wedge the splash. */
const SPLASH_FAILSAFE_MS = 10000;

// Root view defaults to white — paint it the splash color so no frame between
// the native splash and React's first paint can flash white. (The app.config
// `backgroundColor` covers builds; this covers dev reloads at runtime.)
SystemUI.setBackgroundColorAsync(palette.editorialDarkBg2);

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

function NavigationGate({ onSettled }: { onSettled: () => void }) {
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

  // --- Anonymous-first onboarding (A/B 2026) ---
  // Fresh installs (never authenticated on this install) onboard BEFORE auth:
  // the account step lives inside the onboarding flow, after the paywall.
  // `control` keeps the V4 auth-first gate. While the variant is unresolved
  // (null, first launch) the (onboarding) layout holds a blank frame for up to
  // ~2s and then always resolves, so this can never wedge the app.
  const variant = useExperimentStore((s) => s.onboardingVariant);
  const hasAuthenticatedBefore = useAuthStore((s) => s.hasAuthenticatedBefore);
  const isAnonOnboarding = !session && !hasAuthenticatedBefore && variant !== OB_VARIANT.CONTROL;

  useEffect(() => {
    // Kick off assignment for signed-out fresh installs so the gate above can
    // settle; signed-in users resolve inside (onboarding)/_layout as before.
    if (isAnonOnboarding && !variant) void resolveOnboardingVariant();
  }, [isAnonOnboarding, variant]);

  // Configure RevenueCat anonymously for sessionless onboarders so the paywall
  // can present + purchase without an account; $posthogUserId is stamped with
  // the anonymous distinct_id so the purchase joins this person post-signup.
  useEffect(() => {
    if (isAnonOnboarding) {
      void configureRevenueCatAnonymously(getAnalyticsDistinctId());
    }
  }, [isAnonOnboarding]);

  const inOnboarding = segments[0] === '(onboarding)';

  // Hold the splash (render nothing) until auth + the `me` query resolve, so the
  // guards below evaluate against settled state — otherwise a returning,
  // already-onboarded user would briefly route through (onboarding) before `me`
  // confirms completion. Exception: when the session appears MID-onboarding
  // (post-paywall account step signs the user in), keep the stack mounted —
  // unmounting would reset onboarding navigation state.
  const holding =
    isLoading || (!!session && meQuery.isLoading && !meQuery.isError && !inOnboarding);

  // The gate settling means real UI is about to paint — tell the root to drop
  // the native splash (it fades out over the first frames of the stack).
  useEffect(() => {
    if (!holding) onSettled();
  }, [holding, onSettled]);

  if (holding) {
    return null;
  }

  const isSignedIn = !!session;

  // Declarative gating via Stack.Protected: when a guard flips (sign-in, sign-out,
  // onboarding completion) Expo Router auto-navigates to the next available
  // screen. No imperative router.replace — which would collapse the back stack.
  // NOTE: the returning-user "Sign in" surface for anonymous onboarders lives
  // INSIDE (onboarding) (sign-in screen), so (auth) stays hidden during
  // anonymous onboarding without any cross-group navigation.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSignedIn && !isAnonOnboarding}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={isAnonOnboarding || (isSignedIn && !onboardingCompleted)}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && onboardingCompleted}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" />
        <Stack.Screen name="trip/[id]" />
      </Stack.Protected>

      {/* Public share-link routes — always accessible to anonymous AND
          authenticated users (even mid-onboarding). Declared last so they are
          never resolved as the default landing screen. */}
      <Stack.Screen name="t/[token]/index" />
      <Stack.Screen name="ride/[id]" />
      <Stack.Screen name="route/[country]/[region]/[slug]" />
      <Stack.Screen name="routes/[id]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  const { setSession, setLoading } = useAuthStore();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  // Tracks the last identified user so a null session is only treated as a
  // logout when we actually had one — see onAuthStateChange below.
  const prevUserIdRef = useRef<string | null>(null);

  // Native splash lifecycle: hidden once (idempotent) when the navigation gate
  // settles — or by the failsafe below. `splashDismissed` flips after the fade
  // completes and gates the ATT prompt (it must never appear under the splash).
  const [splashDismissed, setSplashDismissed] = useState(false);
  const splashHiddenRef = useRef(false);
  const hideSplash = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync();
    setTimeout(() => setSplashDismissed(true), SPLASH_FADE_MS + 50);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(hideSplash, SPLASH_FAILSAFE_MS);
    return () => clearTimeout(timeout);
  }, [hideSplash]);

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
      // Only report when the app is actually foregrounded — a real user
      // staring at a stuck splash. On background launches (widget sync,
      // location updates) iOS throttles JS so getSession() can't resolve in
      // wall-clock time and this timer fires harmlessly. Reporting that is
      // pure noise. (Sentry MOTO-VAULT-REACT-NATIVE-W)
      if (shouldReportHydrationTimeout(useAuthStore.getState().isLoading, AppState.currentState)) {
        captureException(new Error(AUTH_HYDRATION_TIMEOUT_MESSAGE), {
          source: AUTH_HYDRATION_TIMEOUT_SOURCE,
        });
      }
      if (useAuthStore.getState().isLoading) {
        setLoading(false);
      }
    }, AUTH_HYDRATION_TIMEOUT_MS);
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

      const sessionUserId = session?.user?.id ?? null;
      const decision = decideAuthStateChange({
        sessionUserId,
        prevUserId: prevUserIdRef.current,
        // Persistent "a user was signed in on this device" signal that survives
        // cold starts (the per-mount ref is null on every launch). Lets a
        // server-revoked session surfacing as a null INITIAL_SESSION still run
        // local cleanup. (todo 188)
        hasPersistedUser: SecureStore.getItem(LAST_USER_KEY) !== null,
      });

      if (sessionUserId) {
        loginRevenueCat(sessionUserId);
        if (decision.shouldIdentify) {
          // identify() merges the current anonymous distinct_id onto the user,
          // so pre-signup events (install, /login views) attach to the person.
          // Skipped on TOKEN_REFRESHED/USER_UPDATED for the same id. (todo 191)
          identifyUser(sessionUserId);
        }
      } else {
        if (decision.shouldResetUser) {
          // Reset only when we PREVIOUSLY had a user in this app session. On a
          // cold-start anonymous launch, onAuthStateChange fires with a null
          // session (INITIAL_SESSION) — calling reset() there rotates the
          // anonymous id and orphans pre-signup events, breaking cross-signup
          // funnels. (Defect 1) Reset/RC-logout only on a real sign-out.
          logoutRevenueCat();
          resetUser();
        }
        if (decision.shouldClearLocalData) {
          // Decoupled from reset (todo 188): runs whenever a user previously
          // existed by EITHER the per-mount ref OR the persisted signal, so a
          // server-revoked session that only surfaces on the next cold start
          // still clears this device's user data.
          queryClient.clear();
          clearPersistedQueryCache();
          SecureStore.deleteItemAsync(LAST_USER_KEY);
          clearSyncQueue();
          const activeRideId = rideMMKV.getCurrentId();
          if (activeRideId) clearRideData(activeRideId);
          cancelAllNotifications();
          clearAllWidgets();
        }
      }

      prevUserIdRef.current = sessionUserId;
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

  // Set up notification channels and categories. Permission is requested
  // ONLY on the onboarding notifications screen — never at app launch
  // (iOS shows the system prompt once; asking here would consume it).
  useEffect(() => {
    async function initNotifications() {
      await setupNotificationChannels();
      await setupNotificationCategories();
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
        {/* Renders PostHog-managed popover surveys natively. Display timing,
            targeting, and appearance are all configured server-side in PostHog;
            the SDK auto-captures `survey shown/sent/dismissed` and respects the
            client opt-out set by setAnalyticsEnabled(). */}
        <PostHogSurveyProvider androidKeyboardBehavior="padding">
          <KeyboardProvider>
            <PersistedQueryClientBoundary>
              <NavigationGate onSettled={hideSplash} />
            </PersistedQueryClientBoundary>
          </KeyboardProvider>
        </PostHogSurveyProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}

export default withSentry(RootLayout);
