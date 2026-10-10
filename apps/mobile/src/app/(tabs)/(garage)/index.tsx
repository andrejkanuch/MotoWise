import {
  MyMotorcyclesDocument,
  type MyMotorcyclesQuery,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Crown, Plus } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DocumentExpiryAlerts } from '@/components/garage/document-expiry-alerts';
import { GarageBikeCard } from '@/components/garage/garage-bike-card';
import { describePlate, type PlateCopy, rankBikeTasks } from '@/components/home/home-plate';
import { LottieMotorcycle } from '@/components/lottie-motorcycle';
import { Skeleton } from '@/components/skeleton/skeleton';
import { SkeletonProvider } from '@/components/skeleton/skeleton-provider';
import { PLATE_SIZE, PLATE_STATE } from '@/components/ui/bike-plate';
import { useMileageUnit } from '@/hooks/use-mileage-unit';
import { useProGate } from '@/hooks/use-pro-gate';
import { formatOdometer, hasOdometer } from '@/lib/bike-hub/format';
import { isActiveTask } from '@/lib/bike-hub/task-due';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { maintenanceBadgeOptions } from '@/lib/query-options';
import { presentPaywall } from '@/lib/subscription';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '@/theme/type';
import { showActionSheet } from '@/utils/action-sheet';
import { triggerImpact } from '@/utils/haptics';

type GarageBike = MyMotorcyclesQuery['myMotorcycles'][number];

/** Minimum height of an inset row: 44pt on iOS, 48dp on Android. */
const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const ADD_BUTTON_SIZE = process.env.EXPO_OS === 'android' ? 48 : 44;
/** Shown in place of a figure the garage cannot know yet. */
const NO_VALUE = '—';
const LIST_STAGGER_MS = 50;
const LIST_ENTER_MS = 240;

function useGarageBikes() {
  return useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    // Renders its own error state with Retry (below). It stays mounted beneath
    // the bike hub, which opts out of the same key; the global handler needs
    // every observer to agree.
    meta: QUERY_META.OWN_ERROR_UI,
  });
}

export default function GarageScreen() {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requireAccess, isPro } = useProGate();
  const mileageUnit = useMileageUnit();
  const language = i18n.language;

  const { data, isLoading, error, refetch, isRefetching } = useGarageBikes();
  // The same query as the tab-bar badge, so it is usually already cached.
  const tasksQuery = useQuery(maintenanceBadgeOptions());

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) =>
      gqlFetcher(UpdateMotorcycleDocument, { id, input: { isPrimary: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const onRefresh = useCallback(() => {
    refetch();
    tasksQuery.refetch();
  }, [refetch, tasksQuery.refetch]);

  const motorcycles = data?.myMotorcycles ?? [];
  const tasks = tasksQuery.data?.allMaintenanceTasks;
  const totalDistance = motorcycles.reduce((sum, b) => sum + (b.currentMileage ?? 0), 0);
  const totalDistanceDisplay = formatOdometer(totalDistance, language);

  const plates = useMemo(() => {
    const today = new Date();
    return new Map<string, PlateCopy>(
      motorcycles.map((bike) => {
        const odometer = bike.currentMileage;
        if (!tasks) {
          // Tasks not loaded (or failed): show the odometer and claim no verdict.
          return [
            bike.id,
            {
              state: PLATE_STATE.READY,
              figure: hasOdometer(odometer) ? formatOdometer(odometer, language) : NO_VALUE,
              unit: hasOdometer(odometer) ? mileageUnit : undefined,
              caption: '',
              stateLabel: '',
            },
          ];
        }
        const [next] = rankBikeTasks(tasks, {
          bikeId: bike.id,
          odometer,
          unit: mileageUnit,
          today,
        });
        return [bike.id, describePlate(next, { t, language, unit: mileageUnit, odometer })];
      }),
    );
  }, [motorcycles, tasks, mileageUnit, language, t]);

  const openTaskCount = useMemo(() => {
    if (!tasks) return null;
    const bikeIds = new Set(motorcycles.map((b) => b.id));
    return tasks.filter((task) => bikeIds.has(task.motorcycleId) && isActiveTask(task)).length;
  }, [tasks, motorcycles]);

  const atFreeLimit = !isPro && motorcycles.length >= 1;

  const handleAddBike = () => {
    if (!requireAccess('MAX_BIKES', motorcycles.length)) return;
    triggerImpact();
    router.push('/(tabs)/(garage)/add-bike');
  };

  const handleHeaderAdd = atFreeLimit
    ? () =>
        presentPaywall({
          source: 'garage',
          feature: 'unlimited_bikes',
          surface: 'garage_add_bike_header',
        })
    : handleAddBike;

  const openBike = (bike: GarageBike) => {
    triggerImpact();
    router.push(`/(tabs)/(garage)/bike/${bike.id}`);
  };

  const openBikeMenu = (bike: GarageBike) => {
    showActionSheet(`${bike.make} ${bike.model}`, [
      {
        label: t('common.edit'),
        onPress: () =>
          router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id: bike.id } }),
      },
      ...(bike.isPrimary
        ? []
        : [{ label: t('garage.setAsPrimary'), onPress: () => setPrimaryMutation.mutate(bike.id) }]),
      { label: t('common.cancel'), onPress: () => {}, style: 'cancel' as const },
    ]);
  };

  if (isLoading && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          paddingHorizontal: GUTTER,
          paddingTop: insets.top + space.lg,
        }}
      >
        <SkeletonProvider>
          <Skeleton width="45%" height={36} borderRadius={radius.chip} />
          {[0, 1].map((i) => (
            <View key={i} style={{ marginTop: space.xl, gap: space.sm }}>
              <Skeleton width="70%" height={56} borderRadius={radius.control} />
              <Skeleton width="100%" height={150} borderRadius={radius.plate} />
            </View>
          ))}
        </SkeletonProvider>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
          gap: space.md,
        }}
      >
        <Text style={[type.body, { color: theme.ink, textAlign: 'center' }]}>
          {t('common.error')}
        </Text>
        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          android_ripple={{ color: theme.line }}
          style={({ pressed }) => ({
            minHeight: ROW_MIN_HEIGHT,
            justifyContent: 'center',
            backgroundColor: theme.warm,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            paddingHorizontal: space.xl,
            opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
          })}
        >
          <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (motorcycles.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xxl,
          paddingBottom: 80,
        }}
      >
        <Animated.View entering={FadeInUp.duration(LIST_ENTER_MS)} style={{ alignItems: 'center' }}>
          <LottieMotorcycle
            animation="emptyGarage"
            size={160}
            loop={false}
            style={{ marginBottom: space.xs }}
          />
          <Text
            accessibilityRole="header"
            style={[type.sheetTitle, { color: theme.ink, textAlign: 'center' }]}
          >
            {t('garage.emptyTitle')}
          </Text>
          <Text
            style={[
              type.subhead,
              {
                color: theme.ink2,
                textAlign: 'center',
                marginTop: space.xs,
                marginBottom: space.xxl,
              },
            ]}
          >
            {t('garage.emptySubtitle')}
          </Text>
          <Pressable
            onPress={handleAddBike}
            accessibilityRole="button"
            android_ripple={{ color: theme.line }}
            style={({ pressed }) => ({
              minHeight: 52,
              backgroundColor: theme.warm,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              paddingHorizontal: space.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
            })}
          >
            <Plus size={20} color={theme.onWarm} strokeWidth={2.5} />
            <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
              {t('garage.addFirstBike')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  const plateSize = motorcycles.length === 1 ? PLATE_SIZE.HERO : PLATE_SIZE.COMPACT;
  const oldestYear = Math.min(...motorcycles.map((b) => b.year));
  const numbers = [
    {
      key: 'distance',
      label: t('garage.totalDistance'),
      value: totalDistanceDisplay,
      unit: mileageUnit,
    },
    { key: 'oldest', label: t('garage.oldestBike'), value: String(oldestYear) },
    ...(openTaskCount === null
      ? []
      : [{ key: 'tasks', label: t('garage.openTasks'), value: String(openTaskCount) }]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Sentry.TimeToInitialDisplay record />
      <Sentry.TimeToFullDisplay record />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ ...readableWidth, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.warm} />
        }
      >
        {/* ── Title ── */}
        <View
          style={{
            paddingTop: insets.top + space.sm,
            paddingHorizontal: GUTTER,
            paddingBottom: space.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
          }}
        >
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text accessibilityRole="header" style={[type.largeTitle, { color: theme.ink }]}>
              {t('tabs.garage')}
            </Text>
            <Text style={[type.subhead, { color: theme.ink2 }]}>
              {t('garage.summaryLine', {
                count: motorcycles.length,
                distance: totalDistanceDisplay,
                unit: mileageUnit,
              })}
            </Text>
          </View>
          <Pressable
            onPress={handleHeaderAdd}
            accessibilityRole="button"
            accessibilityLabel={t('garage.addBike')}
            accessibilityHint={atFreeLimit ? t('garage.moreBikesPro') : undefined}
            android_ripple={{ color: theme.line, borderless: true }}
            style={({ pressed }) => ({
              width: ADD_BUTTON_SIZE,
              height: ADD_BUTTON_SIZE,
              borderRadius: radius.pill,
              borderCurve: 'continuous',
              backgroundColor: theme.warm,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
            })}
          >
            {atFreeLimit ? (
              <Crown size={20} color={theme.onWarm} />
            ) : (
              <Plus size={22} color={theme.onWarm} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>

        {/* ── Bikes ── */}
        <View style={{ paddingHorizontal: GUTTER, gap: space.xxl }}>
          {motorcycles.map((bike, i) => {
            const plate = plates.get(bike.id);
            if (!plate) return null;
            return (
              <Animated.View
                key={bike.id}
                entering={FadeInUp.delay(i * LIST_STAGGER_MS).duration(LIST_ENTER_MS)}
              >
                <GarageBikeCard
                  bike={bike}
                  plate={plate}
                  size={plateSize}
                  onOpen={() => openBike(bike)}
                  onMenu={() => openBikeMenu(bike)}
                />
              </Animated.View>
            );
          })}

          {/* Add a bike — an inset row; the label is the Maestro anchor. */}
          <Pressable
            onPress={handleAddBike}
            accessibilityRole="button"
            android_ripple={{ color: theme.line }}
            style={({ pressed }) => ({
              minHeight: ROW_MIN_HEIGHT + space.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor:
                pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : theme.surface,
            })}
          >
            <Plus size={20} color={theme.warm2} strokeWidth={2.25} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: theme.warm2 }]}>{t('garage.addBike')}</Text>
              {atFreeLimit ? (
                <Text style={[type.subhead, { color: theme.ink3 }]}>
                  {t('garage.moreBikesPro')}
                </Text>
              ) : null}
            </View>
            {atFreeLimit ? <Crown size={18} color={theme.ink3} /> : null}
          </Pressable>
        </View>

        {/* ── Document expiry alerts (R11) — only renders when ≥1 expiring ── */}
        <DocumentExpiryAlerts />

        {/* ── By the numbers ── */}
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xxl, gap: space.xs }}>
          <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
            {t('garage.byTheNumbers')}
          </Text>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}
          >
            {numbers.map((row, i) => (
              <View
                key={row.key}
                accessible
                accessibilityLabel={`${row.label}: ${row.value}${row.unit ? ` ${row.unit}` : ''}`}
                style={{
                  minHeight: ROW_MIN_HEIGHT,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space.sm,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: theme.line,
                }}
              >
                <Text style={[type.body, { color: theme.ink2, flexShrink: 1 }]}>{row.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
                  <Text style={[type.figureSmall, { color: theme.ink }]}>{row.value}</Text>
                  {row.unit ? (
                    <Text style={[type.label, { color: theme.ink3 }]}>{row.unit}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
