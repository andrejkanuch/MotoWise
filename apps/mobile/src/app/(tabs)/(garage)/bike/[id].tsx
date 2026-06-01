import { palette } from '@motovault/design-system';
import {
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  ExpensesByMotorcycleDocument,
  ImportOemScheduleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
  MyMotorcyclesDocument,
  MyRidesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit3,
  Gauge,
  HeartPulse,
  MoreHorizontal,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesSection } from '../../../../components/bike-hub/expenses-section';
import { MaintenanceSection } from '../../../../components/bike-hub/maintenance-section';
import { MileageDisplay } from '../../../../components/bike-hub/mileage-display';
import { useMileageUnit } from '../../../../hooks/use-mileage-unit';

import { AnalyticsEvent, trackEvent } from '../../../../lib/analytics';
import { formatCurrency } from '../../../../lib/expense-constants';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { computeHealthScore } from '../../../../lib/health-score';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../../lib/image-upload';
import { queryKeys } from '../../../../lib/query-keys';
import { useAuthStore } from '../../../../stores/auth.store';
import { useEditorialTheme } from '../../../../theme/editorial';
import { showActionSheet } from '../../../../utils/action-sheet';
import { triggerImpact, triggerNotification } from '../../../../utils/haptics';

function InfoRow({ label, value }: { label: string; value: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.line,
      }}
    >
      <Text style={{ fontSize: 14, color: theme.ink3 }}>{label}</Text>
      <Text selectable style={{ fontSize: 15, fontWeight: '600', color: theme.ink }}>
        {value}
      </Text>
    </View>
  );
}

export default function BikeDetailScreen() {
  const { t } = useTranslation();
  const { id, highlightTask } = useLocalSearchParams<{
    id: string;
    highlightTask?: string;
    _ts?: string;
  }>();
  const router = useRouter();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  // Source of truth for the unit label — the user's profile preference, not the
  // deprecated per-bike `bike.mileageUnit`.
  const mileageUnit = useMileageUnit();

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);

  // --- Queries ---

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { data: tasksData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId: id }),
  });

  // Stats queries for the new cards row
  const { data: statsExpenseData } = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(id), 0],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: id, year: 0 }),
  });

  const { data: ridesData } = useQuery({
    queryKey: ['rides', 'motorcycle', id],
    queryFn: () => gqlFetcher(MyRidesDocument, { first: 1, motorcycleId: id }),
  });

  const hasHighlighted = useRef(false);
  useEffect(() => {
    if (highlightTask && tasksData && !hasHighlighted.current) {
      hasHighlighted.current = true;
      setExpandedId(highlightTask);
    }
  }, [highlightTask, tasksData]);

  const onRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: queryKeys.motorcycles.all,
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.expenses.byMotorcycle(id),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: ['rides', 'motorcycle', id],
          refetchType: 'active',
        }),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient, id]);

  // --- Mutations ---

  const { mutateAsync: deleteBike } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      trackEvent(AnalyticsEvent.GARAGE_BIKE_REMOVED, { motorcycle_id: id });
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const updateBikeMutation = useMutation({
    mutationFn: (input: { primaryPhotoUrl?: string; currentMileage?: number }) =>
      gqlFetcher(UpdateMotorcycleDocument, { id, input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const invalidateTasks = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
  };

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: (_data, taskId) => {
      invalidateTasks();
      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_DELETED, { motorcycle_id: id, task_id: taskId });
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
    },
    onError: (_err: Error) => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.deleteError', {
          defaultValue: 'Failed to delete task. Please try again.',
        }),
      );
    },
  });

  // --- Derived data ---

  const motorcycles = data?.myMotorcycles ?? [];
  const bike = motorcycles.find((m: { id: string }) => m.id === id);

  type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
  const tasks: Task[] = tasksData?.maintenanceTasks ?? [];

  const healthScore = computeHealthScore(
    tasks.map((t) => ({
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      completedAt: t.completedAt,
    })),
  );

  // --- Handlers ---

  const handleDeleteBike = () => {
    triggerImpact();
    Alert.alert(t('garage.deleteBike'), t('garage.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBike();
            router.back();
          } catch (_e) {
            Alert.alert(
              t('common.error', { defaultValue: 'Error' }),
              t('garage.deleteFailed', {
                defaultValue: 'Failed to delete motorcycle. Please try again.',
              }),
            );
          }
        },
      },
    ]);
  };

  const handleAddPhoto = () => {
    triggerImpact();
    const userId = session?.user?.id;
    if (!userId) return;

    const upload = async (uri: string) => {
      try {
        setUploadingPhoto(true);
        const { publicUrl } = await uploadBikePhoto(uri, userId, id);
        await updateBikeMutation.mutateAsync({ primaryPhotoUrl: publicUrl });
      } catch (_e) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('garage.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
        );
      } finally {
        setUploadingPhoto(false);
      }
    };

    showActionSheet(t('garage.addPhoto', { defaultValue: 'Add Photo' }), [
      {
        label: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) upload(uri);
        },
      },
      {
        label: t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
        onPress: async () => {
          const uri = await pickImage();
          if (uri) upload(uri);
        },
      },
      {
        label: t('common.cancel', { defaultValue: 'Cancel' }),
        onPress: () => {},
        style: 'cancel',
      },
    ]);
  };

  const handleCompleteTask = (taskId: string) => {
    const bikeName = bike ? `${bike.year} ${bike.make} ${bike.model}` : '';
    router.push({
      pathname: '/(tabs)/(garage)/complete-task',
      params: {
        taskId,
        motorcycleId: id,
        bikeName,
        currentMileage: bike?.currentMileage ? String(bike.currentMileage) : '',
        mileageUnit,
      },
    });
  };

  const handleDeleteTask = (taskId: string, taskTitle: string) => {
    Alert.alert(
      t('maintenance.deleteTask', { defaultValue: 'Delete Task' }),
      t('maintenance.confirmDeleteTask', {
        defaultValue: `Delete "${taskTitle}"?`,
        title: taskTitle,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(taskId),
        },
      ],
    );
  };

  // MOT-142: Navigate to safety recalls modal
  const handleCheckRecalls = () => {
    if (!bike) return;
    triggerImpact();
    trackEvent(AnalyticsEvent.RECALLS_CHECKED, {
      motorcycle_id: bike.id,
      bike_make: bike.make,
      bike_model: bike.model,
      bike_year: bike.year,
      has_vin: !!bike.vin,
    });
    router.push({
      pathname: '/(modals)/recalls',
      params: {
        motorcycleId: bike.id,
        bikeName: `${bike.year} ${bike.make} ${bike.model}`,
      },
    });
  };

  // MOT-138: Manually re-import the OEM maintenance schedule for this bike
  const importOemMutation = useMutation({
    mutationFn: () => gqlFetcher(ImportOemScheduleDocument, { motorcycleId: id }),
    onSuccess: (data) => {
      const count = data?.importOemSchedule ?? 0;
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
      });
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('oem.importedTitle', { defaultValue: 'OEM schedule imported' }),
        count > 0
          ? t('oem.importedCount', {
              defaultValue: `Added ${count} maintenance task${count === 1 ? '' : 's'} from the manufacturer schedule.`,
              count,
            })
          : t('oem.importedNone', {
              defaultValue: 'No new tasks to import — your schedule is already up to date.',
            }),
      );
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('oem.importFailed', { defaultValue: 'Failed to import OEM schedule. Please try again.' }),
      );
    },
  });

  const handleImportOem = () => {
    triggerImpact();
    trackEvent(AnalyticsEvent.OEM_SCHEDULE_IMPORTED, {
      motorcycle_id: id,
      bike_make: bike?.make ?? '',
      bike_model: bike?.model ?? '',
      bike_year: bike?.year ?? 0,
    });
    importOemMutation.mutate();
  };

  const handleMoreActions = () => {
    triggerImpact();
    const labels = {
      cancel: t('common.cancel', { defaultValue: 'Cancel' }),
      recalls: t('recalls.checkButton', { defaultValue: 'Check Safety Recalls' }),
      importOem: t('oem.importButton', { defaultValue: 'Import OEM Schedule' }),
      delete: t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
    };
    showActionSheet(t('common.actions', { defaultValue: 'Actions' }), [
      { label: labels.recalls, onPress: handleCheckRecalls },
      { label: labels.importOem, onPress: handleImportOem },
      { label: labels.delete, onPress: handleDeleteBike, style: 'destructive' },
      { label: labels.cancel, onPress: () => {}, style: 'cancel' },
    ]);
  };

  const handleToggleExpand = useCallback(
    (taskId: string) => setExpandedId((prev) => (prev === taskId ? null : taskId)),
    [],
  );

  // --- Loading / not found states ---

  if (isLoading && !data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.warm} />
      </View>
    );
  }

  if (!bike) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: theme.ink3, textAlign: 'center' }}>
          {t('notFound.message', { defaultValue: 'Not found' })}
        </Text>
      </View>
    );
  }

  const hasPhoto = !!bike.primaryPhotoUrl;
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Sentry.TimeToInitialDisplay record />
      <Sentry.TimeToFullDisplay record />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.warm} />
        }
      >
        {/* 1. Hero — editorial full-bleed photo */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <Pressable onPress={handleAddPhoto} disabled={uploadingPhoto}>
            <View style={{ position: 'relative', height: 320 }}>
              {hasPhoto ? (
                <Image
                  source={{ uri: bike.primaryPhotoUrl ?? undefined }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundColor: theme.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="large" color={theme.warm} />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Camera size={26} color={theme.ink3} strokeWidth={1.5} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink3 }}>
                        {t('garage.addPhoto', { defaultValue: 'Add Photo' })}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {/* Gradient overlay */}
              <LinearGradient
                colors={['rgba(0,0,0,0.35)', 'transparent']}
                locations={[0, 0.7]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%' }}
              />
              <LinearGradient
                colors={['transparent', theme.bg]}
                locations={[0.3, 1]}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' }}
              />

              {/* Upload overlay */}
              {uploadingPhoto && hasPhoto && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator size="large" color={palette.white} />
                  <Text
                    style={{ color: palette.white, fontSize: 14, fontWeight: '600', marginTop: 8 }}
                  >
                    {t('garage.uploadingPhoto', { defaultValue: 'Uploading...' })}
                  </Text>
                </View>
              )}

              {/* Top bar */}
              <View
                style={{
                  position: 'absolute',
                  top: insets.top + 8,
                  left: 16,
                  right: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Pressable
                  onPress={() => router.back()}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    paddingLeft: 10,
                    backgroundColor: `${theme.bg}99`,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.line,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ChevronLeft size={16} color={palette.white} />
                  <Text style={{ fontSize: 13, color: palette.white, fontWeight: '500' }}>
                    {t('tabs.garage')}
                  </Text>
                </Pressable>
                {!uploadingPhoto && (
                  <Pressable
                    onPress={handleAddPhoto}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${theme.bg}99`,
                      borderWidth: 1,
                      borderColor: theme.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Camera size={16} color={palette.white} />
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* 2. Bike meta — lifted over hero (editorial) */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: -40, position: 'relative' }}
        >
          <Text style={{ fontSize: 11, color: theme.ink3, marginBottom: 4, fontWeight: '500' }}>
            {bike.year}
            {bike.nickname ? ` · "${bike.nickname}"` : ''}
          </Text>
          <Text
            selectable
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 36,
              color: theme.ink,
              letterSpacing: -0.7,
              lineHeight: 40,
              marginBottom: 14,
            }}
          >
            {bike.make} <Text style={{ fontFamily: 'InstrumentSerif-Italic' }}>{bike.model}</Text>
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18, alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 5,
                paddingHorizontal: 10,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 999,
              }}
            >
              <Gauge size={13} color={theme.ink2} />
              <Text style={{ fontSize: 12, color: theme.ink2, fontWeight: '600' }}>
                {(bike.currentMileage ?? 0).toLocaleString()} {mileageUnit}
              </Text>
            </View>
            {tasks.length > 0 && healthScore.hasData && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.line,
                  borderRadius: 999,
                }}
              >
                {(() => {
                  const healthColor =
                    healthScore.score >= 75
                      ? palette.editorialSuccess
                      : healthScore.score >= 40
                        ? palette.warning500
                        : palette.editorialDanger;
                  return (
                    <>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: healthColor,
                        }}
                      />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: healthColor }}>
                        {t('garage.percentReady', { score: healthScore.score })}
                      </Text>
                    </>
                  );
                })()}
              </View>
            )}
          </View>

          <MileageDisplay
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={mileageUnit}
            mileageUpdatedAt={bike.mileageUpdatedAt ?? undefined}
            isDark={isDark}
          />
        </Animated.View>

        {/* 3. Quick Actions — editorial 4-button grid */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 20,
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          <Pressable
            onPress={() => {
              triggerImpact();
              router.push({
                pathname: '/(tabs)/(garage)/add-maintenance-task',
                params: { motorcycleId: id, bikeName },
              });
            }}
            style={({ pressed }) => ({
              flex: 2,
              alignItems: 'center',
              gap: 5,
              paddingVertical: 12,
              backgroundColor: theme.warm,
              borderRadius: 14,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Wrench size={18} color="#1a1208" />
            <Text style={{ fontSize: 11, fontWeight: '600', color: palette.neutral950 }}>
              {t('maintenance.addTask', { defaultValue: 'Add task' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerImpact();
              router.push({
                pathname: '/(tabs)/(garage)/add-expense',
                params: { motorcycleId: id },
              });
            }}
            style={({ pressed }) => ({
              flex: 1.5,
              alignItems: 'center',
              gap: 5,
              paddingVertical: 12,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 14,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <DollarSign size={18} color={theme.ink2} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.ink2 }}>
              {t('garage.addExpense', { defaultValue: 'Expense' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerImpact();
              router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id } });
            }}
            accessibilityLabel={t('common.edit', { defaultValue: 'Edit' })}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 14,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Edit3 size={18} color={theme.ink2} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={handleMoreActions}
            accessibilityLabel={t('common.more', { defaultValue: 'More' })}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <MoreHorizontal size={16} color={theme.ink2} strokeWidth={2} />
          </Pressable>
        </Animated.View>

        {/* Stats Cards Row */}
        <Animated.View
          entering={FadeInUp.delay(120).duration(400)}
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 20,
            marginTop: 16,
          }}
        >
          <View
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 4,
              }}
            >
              {t('bikeHub.costPerKm', { defaultValue: 'COST / KM' })}
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: theme.ink,
                letterSpacing: -0.4,
                fontVariant: ['tabular-nums'],
              }}
            >
              {bike.currentMileage && (statsExpenseData?.expenses?.ytdTotal ?? 0) > 0
                ? formatCurrency((statsExpenseData?.expenses?.ytdTotal ?? 0) / bike.currentMileage)
                : '—'}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 4,
              }}
            >
              {t('bikeHub.rides', { defaultValue: 'RIDES' })}
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: theme.ink,
                letterSpacing: -0.4,
                fontVariant: ['tabular-nums'],
              }}
            >
              {ridesData?.myRides?.totalCount ?? 0}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              triggerImpact();
              router.push({
                pathname: '/(tabs)/(garage)/expense-dashboard',
                params: {
                  motorcycleId: id,
                  currentMileage: bike?.currentMileage ? String(bike.currentMileage) : '',
                  mileageUnit,
                },
              });
            }}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 4,
              }}
            >
              {t('bikeHub.analytics', { defaultValue: 'ANALYTICS' })}
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: theme.warm,
                letterSpacing: -0.4,
              }}
            >
              {t('bikeHub.viewAnalytics')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* AI Health Report — contextual paywall trigger */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 12 }}
        >
          <Pressable
            onPress={() => {
              triggerImpact();
              trackEvent(AnalyticsEvent.HEALTH_REPORT_VIEWED, {
                motorcycle_id: id,
                bike_make: bike.make,
                bike_model: bike.model,
                bike_year: bike.year,
              });
              router.push({
                pathname: '/(tabs)/(garage)/health-report',
                params: { bikeId: id },
              });
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.line,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: `${theme.warm}20`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HeartPulse size={20} color={theme.warm} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }}>
                {t('healthReport.title', { defaultValue: 'Service Report' })}
              </Text>
              <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 1 }}>
                {t('healthReport.subtitle', {
                  defaultValue: 'Maintenance history, expenses & condition overview',
                })}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.ink3} />
          </Pressable>
        </Animated.View>

        {/* 4. Maintenance Section — tabbed (Active | History) */}
        <Animated.View entering={FadeInUp.delay(180).duration(400)} style={{ marginTop: 20 }}>
          <MaintenanceSection
            tasks={tasks}
            isDark={isDark}
            motorcycleId={id}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
            mileageUnit={mileageUnit}
          />
        </Animated.View>

        {/* 5. Expenses Section */}
        <Animated.View entering={FadeInUp.delay(240).duration(400)} style={{ marginTop: 24 }}>
          <ExpensesSection
            motorcycleId={id}
            isDark={isDark}
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={mileageUnit}
          />
        </Animated.View>

        {/* 6. Details section (collapsible) */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 20 }}
        >
          <Pressable
            onPress={() => {
              triggerImpact();
              setShowDetails((prev) => !prev);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: theme.surface,
              borderRadius: showDetails ? 0 : 16,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderCurve: 'continuous',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: theme.ink,
              }}
            >
              {t('garage.tab_details', { defaultValue: 'Details' })}
            </Text>
            <Animated.View
              style={{
                transform: [{ rotate: showDetails ? '0deg' : '-90deg' }],
              }}
            >
              <ChevronDown size={18} color={palette.neutral400} />
            </Animated.View>
          </Pressable>
          {showDetails && (
            <Animated.View entering={FadeIn.duration(200)}>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  borderCurve: 'continuous',
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                }}
              >
                <InfoRow label={t('garage.make', { defaultValue: 'Make' })} value={bike.make} />
                <InfoRow label={t('garage.model', { defaultValue: 'Model' })} value={bike.model} />
                <InfoRow
                  label={t('garage.year', { defaultValue: 'Year' })}
                  value={String(bike.year)}
                />
                {bike.nickname && (
                  <InfoRow
                    label={t('garage.nickname', { defaultValue: 'Nickname' })}
                    value={bike.nickname}
                  />
                )}
                <InfoRow
                  label={t('garage.primary', { defaultValue: 'Primary' })}
                  value={
                    bike.isPrimary
                      ? t('common.yes', { defaultValue: 'Yes' })
                      : t('common.no', { defaultValue: 'No' })
                  }
                />
                {bike.purchasePrice != null && (
                  <InfoRow
                    label={t('garage.purchasePrice', { defaultValue: 'Purchase Price' })}
                    value={formatCurrency(bike.purchasePrice)}
                  />
                )}
                {bike.purchaseDate && (
                  <InfoRow
                    label={t('garage.purchaseDate', { defaultValue: 'Purchase Date' })}
                    value={new Date(bike.purchaseDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  />
                )}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
