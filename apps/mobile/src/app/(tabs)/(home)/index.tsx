import * as Sentry from '@sentry/react-native';
import { parseISO } from 'date-fns';
import { Route, Sparkles, Wallet, WifiOff, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BikeSwitcher } from '@/components/home/bike-switcher';
import { EmptyState } from '@/components/home/empty-state';
import { FocusHistory } from '@/components/home/focus-history';
import { FocusStats } from '@/components/home/focus-stats';
import { type HomeAction, HomeActionRow, ReceiptScanRow } from '@/components/home/home-actions';
import { describePlate, rankBikeTasks } from '@/components/home/home-plate';
import { OnboardingChecklist } from '@/components/home/onboarding-checklist';
import { UpNext } from '@/components/home/up-next';
import { useHomeData } from '@/components/home/use-home-data';
import { Skeleton } from '@/components/skeleton/skeleton';
import { SkeletonProvider } from '@/components/skeleton/skeleton-provider';
import { BikePlate, PLATE_SIZE } from '@/components/ui/bike-plate';
import { ESettingsGroup, ESettingsRow } from '@/components/ui/editorial';
import { ThemedSegmentedControl } from '@/components/ui/themed-segmented-control';
import { HOME_ROUTE } from '@/config/routes';
import { ReceiptScanRecoveryCard } from '@/features/receipt-scan/receipt-scan-recovery-card';
import { SCAN_ENTRY_SURFACE } from '@/features/receipt-scan/scan-flow-constants';
import { useMileageUnit } from '@/hooks/use-mileage-unit';
import { useProGate } from '@/hooks/use-pro-gate';
import { BIKE_ORIGIN, BIKE_SEGMENT } from '@/lib/bike-hub/constants';
import { useRideStore } from '@/stores/ride.store';
import { tabBarBottomOffset, useTabBarStore } from '@/stores/tab-bar.store';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';

const FOCUS_TAB = { STATS: 'stats', TRIP: 'trip', HISTORY: 'history' } as const;
type FocusTab = (typeof FOCUS_TAB)[keyof typeof FOCUS_TAB];
const FOCUS_TABS: readonly FocusTab[] = [FOCUS_TAB.STATS, FOCUS_TAB.TRIP, FOCUS_TAB.HISTORY];

const HOME_ACTION = {
  RIDE: 'ride',
  EXPENSE: 'expense',
  TASK: 'task',
  DIAGNOSE: 'diagnose',
} as const;

/** A ride in these states is resumed in the HUD instead of starting a new one. */
const ACTIVE_RIDE_STATUSES: ReadonlySet<string> = new Set(['recording', 'paused']);

/** Tab bar height before its first layout (default text size). */
const TAB_BAR_FALLBACK_HEIGHT = 65;
const AVATAR_SIZE = 44;
const TITLE_MAX_FONT_SCALE = 1.6;
const PLATE_NUMBER_DIGITS = 2;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  // Unit label follows the user's profile preference (deprecated per-bike field).
  // Odometer and target values are stored RAW in this unit — never converted.
  const mileageUnit = useMileageUnit();
  const { requireAccess } = useProGate();
  const tabBarHeight = useTabBarStore((s) => s.height);
  const rideStatus = useRideStore((s) => s.status);

  const {
    isLoading,
    hasCriticalError,
    isOffline,
    isOfflineEmpty,
    dataUpdatedAt,
    errorMessage,
    isRefreshing,
    onRefresh,
    greetingText,
    avatarInitial,
    hasMotorcycles,
    motorcycles,
    allTasks,
    recentRides,
    upcomingTrips,
    router,
  } = useHomeData();

  const [selectedBikeIdx, setSelectedBikeIdx] = useState<number | null>(null);
  const [focusTab, setFocusTab] = useState<FocusTab>(FOCUS_TAB.STATS);

  // The primary bike until the rider picks another one.
  const primaryIdx = useMemo(() => {
    const idx = motorcycles.findIndex((b) => b.isPrimary);
    return idx >= 0 ? idx : 0;
  }, [motorcycles]);
  const activeBikeIdx =
    selectedBikeIdx !== null && selectedBikeIdx < motorcycles.length ? selectedBikeIdx : primaryIdx;
  const activeBike = motorcycles[activeBikeIdx] ?? null;

  const rankedTasks = useMemo(
    () =>
      activeBike
        ? rankBikeTasks(allTasks, {
            bikeId: activeBike.id,
            odometer: activeBike.currentMileage,
            unit: mileageUnit,
            today: new Date(),
          })
        : [],
    [activeBike, allTasks, mileageUnit],
  );

  const plate = describePlate(rankedTasks[0], {
    t,
    language: i18n.language,
    unit: mileageUnit,
    odometer: activeBike?.currentMileage,
  });

  const bottomPadding =
    (tabBarHeight ?? TAB_BAR_FALLBACK_HEIGHT) + tabBarBottomOffset(insets.bottom) + space.xl;

  const openBike = (params: { highlightTask?: string; segment?: string } = {}) => {
    if (!activeBike) return;
    router.navigate({
      pathname: '/(tabs)/(garage)/bike/[id]',
      params: {
        id: activeBike.id,
        ...params,
        from: BIKE_ORIGIN.HOME,
        _ts: Date.now().toString(),
      },
    });
  };

  const actions: HomeAction[] = activeBike
    ? [
        {
          key: HOME_ACTION.RIDE,
          icon: Route,
          label: t('common.ride'),
          testID: 'home-action-ride',
          onPress: () =>
            router.push(
              ACTIVE_RIDE_STATUSES.has(rideStatus) ? '/(modals)/ride-hud' : '/(modals)/start-ride',
            ),
        },
        {
          key: HOME_ACTION.EXPENSE,
          icon: Wallet,
          label: t('home.actionExpense'),
          testID: 'home-action-expense',
          onPress: () =>
            router.push({
              pathname: '/(tabs)/(home)/add-expense',
              params: { motorcycleId: activeBike.id },
            }),
        },
        {
          key: HOME_ACTION.TASK,
          icon: Wrench,
          label: t('home.actionTask'),
          testID: 'home-action-task',
          onPress: () =>
            router.push({
              pathname: '/(tabs)/(home)/add-maintenance-task',
              params: {
                motorcycleId: activeBike.id,
                bikeName: `${activeBike.year} ${activeBike.make} ${activeBike.model}`,
              },
            }),
        },
        {
          key: HOME_ACTION.DIAGNOSE,
          icon: Sparkles,
          label: t('home.actionDiagnose'),
          testID: 'home-action-diagnose',
          onPress: () => router.push('/(tabs)/(diagnose)'),
        },
      ]
    : [];

  // ── Loading ──
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          paddingTop: insets.top + space.xs,
          paddingHorizontal: GUTTER,
          gap: space.md,
        }}
      >
        <SkeletonProvider>
          <Skeleton width="65%" height={40} borderRadius={radius.chip} />
          <Skeleton width="100%" height={220} borderRadius={radius.plate} />
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1 }}>
                <Skeleton width="100%" height={68} borderRadius={radius.control} />
              </View>
            ))}
          </View>
          <Skeleton width="100%" height={132} borderRadius={radius.card} />
        </SkeletonProvider>
      </View>
    );
  }

  // ── Offline with no cached data ──
  if (isOfflineEmpty) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
        }}
      >
        <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: 'center' }}>
          <WifiOff size={40} color={theme.ink3} />
          <Text
            style={[
              type.bodyStrong,
              { color: theme.ink, marginTop: space.md, marginBottom: space.xs },
            ]}
          >
            {t('home.offlineTitle')}
          </Text>
          <Text style={[type.subhead, { color: theme.ink3, textAlign: 'center' }]}>
            {t('home.offlineSubtitle')}
          </Text>
        </Animated.View>
      </View>
    );
  }

  // ── Error ──
  if (hasCriticalError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          gap: space.xs,
        }}
      >
        <Text style={[type.bodyStrong, { color: theme.ink }]}>{t('common.error')}</Text>
        <Text
          style={[type.subhead, { color: theme.ink3, textAlign: 'center', marginBottom: space.xs }]}
        >
          {errorMessage}
        </Text>
        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          style={{
            backgroundColor: theme.warm,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            paddingHorizontal: space.xl,
            minHeight: AVATAR_SIZE,
            justifyContent: 'center',
          }}
        >
          <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Sentry.TimeToInitialDisplay record />
      <ScrollView
        testID="home-screen"
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...readableWidth,
          paddingBottom: bottomPadding,
          paddingTop: insets.top,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.ink3} />
        }
      >
        {/* Large title — greeting, with the avatar as the way to Profile */}
        <View
          style={{
            paddingHorizontal: GUTTER,
            paddingTop: space.xs,
            paddingBottom: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
            style={[type.largeTitle, { color: theme.ink, flex: 1 }]}
          >
            {greetingText}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/(profile)')}
            accessibilityRole="button"
            accessibilityLabel={t('home.openProfile')}
            hitSlop={4}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              borderCurve: 'continuous',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text maxFontSizeMultiplier={1.2} style={[type.bodyStrong, { color: theme.ink }]}>
              {avatarInitial}
            </Text>
          </Pressable>
        </View>

        {/* Offline, showing cached data */}
        {isOffline && !isOfflineEmpty && dataUpdatedAt > 0 && (
          <Animated.View
            entering={FadeInUp.duration(200)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              marginHorizontal: GUTTER,
              marginBottom: space.md,
              backgroundColor: theme.surface2,
              paddingHorizontal: space.sm,
              paddingVertical: space.xs,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
            }}
          >
            <WifiOff size={14} color={theme.ink2} />
            <Text style={[type.caption, { color: theme.ink2, flex: 1 }]}>
              {t('home.offlineBanner')} ·{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString(i18n.language)}
            </Text>
          </Animated.View>
        )}

        {/* No bike yet */}
        {!hasMotorcycles && (
          <View style={{ paddingHorizontal: GUTTER }}>
            <EmptyState
              onAddBike={() => router.push(HOME_ROUTE.ADD_BIKE)}
              onExplore={() => router.push('/(tabs)/(learn)')}
            />
          </View>
        )}

        {hasMotorcycles && (
          <BikeSwitcher
            bikes={motorcycles}
            selectedIndex={activeBikeIdx}
            onSelect={setSelectedBikeIdx}
            onAddBike={() => {
              // Same gate as the Garage button: a free rider at the bike limit sees the
              // paywall now, not after filling in the whole form (MOTO-VAULT-REACT-NATIVE-2Y).
              if (!requireAccess('MAX_BIKES', motorcycles.length)) return;
              router.push(HOME_ROUTE.ADD_BIKE);
            }}
          />
        )}

        {/* The plate IS the bike's state: ready, due soon or overdue */}
        {activeBike && (
          <View
            style={{
              paddingHorizontal: GUTTER,
              marginTop: motorcycles.length > 1 ? space.sm : 0,
              gap: space.sm,
            }}
          >
            <BikePlate
              key={activeBike.id}
              size={PLATE_SIZE.HERO}
              state={plate.state}
              figure={plate.figure}
              unit={plate.unit}
              caption={plate.caption}
              stateLabel={plate.stateLabel}
              identity={`${activeBike.make} ${activeBike.model} · ${activeBike.year}`}
              plateNumber={String(activeBikeIdx + 1).padStart(PLATE_NUMBER_DIGITS, '0')}
              onPress={() => openBike()}
              accessibilityHint={t('home.plateHint')}
              testID="home-bike-plate"
            />

            <HomeActionRow actions={actions} />
            <ReceiptScanRow motorcycleId={activeBike.id} surface={SCAN_ENTRY_SURFACE.HOME} />
          </View>
        )}

        <Sentry.TimeToFullDisplay record />

        {/* Onboarding checklist and receipt-scan recovery (parked scans + undo, U8).
            Both carry their own side margins. */}
        <View style={{ paddingTop: space.lg }}>
          <OnboardingChecklist />
          <ReceiptScanRecoveryCard />
        </View>

        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xs, gap: space.lg }}>
          {activeBike && rankedTasks.length > 0 && (
            <UpNext
              tasks={rankedTasks}
              unit={mileageUnit}
              onOpenTask={(taskId) => openBike({ highlightTask: taskId })}
              onSeeAll={() => openBike({ segment: BIKE_SEGMENT.SERVICE })}
            />
          )}

          {/* Focus picker — this month / upcoming trip / ride history */}
          {hasMotorcycles && (
            <View style={{ gap: space.sm }}>
              <ThemedSegmentedControl
                values={[
                  t('home.focusThisMonth'),
                  t('home.focusUpcomingTrip'),
                  t('home.focusRideHistory'),
                ]}
                selectedIndex={FOCUS_TABS.indexOf(focusTab)}
                onChange={(index) => {
                  setFocusTab(FOCUS_TABS[index]);
                  triggerSelection();
                }}
              />
              {focusTab === FOCUS_TAB.STATS && <FocusStats recentRides={recentRides} />}
              {focusTab === FOCUS_TAB.HISTORY && <FocusHistory rides={recentRides} />}
              {focusTab === FOCUS_TAB.TRIP &&
                (upcomingTrips.length > 0 ? (
                  <ESettingsGroup>
                    {upcomingTrips.map((trip) => (
                      <ESettingsRow
                        key={trip.id}
                        title={trip.title}
                        subtitle={formatTripDates(trip.startDate, trip.endDate, i18n.language)}
                        onPress={() =>
                          router.push({
                            pathname: '/(modals)/trip-detail',
                            params: { tripId: trip.id },
                          })
                        }
                      />
                    ))}
                  </ESettingsGroup>
                ) : (
                  <View
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: radius.card,
                      borderCurve: 'continuous',
                      padding: space.md,
                      gap: space.xxs,
                    }}
                  >
                    <Text style={[type.bodyStrong, { color: theme.ink }]}>
                      {t('home.planNextTrip')}
                    </Text>
                    <Text style={[type.subhead, { color: theme.ink3 }]}>
                      {t('home.planNextTripDesc')}
                    </Text>
                    <Pressable
                      onPress={() => router.push('/(tabs)/(discover)')}
                      accessibilityRole="link"
                      hitSlop={12}
                      style={{ alignSelf: 'flex-start', marginTop: space.xs }}
                    >
                      <Text style={[type.label, { color: theme.warm2 }]}>
                        {t('home.exploreRoutes')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** "Jun 12, 2026 – Jun 15" in the rider's language; `undefined` without a start date. */
function formatTripDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  language: string,
): string | undefined {
  if (!startDate) return undefined;
  const start = parseISO(startDate).toLocaleDateString(language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!endDate || endDate === startDate) return start;
  const end = parseISO(endDate).toLocaleDateString(language, { month: 'short', day: 'numeric' });
  return `${start} – ${end}`;
}
