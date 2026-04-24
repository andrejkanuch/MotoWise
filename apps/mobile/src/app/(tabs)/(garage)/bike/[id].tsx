import { palette } from '@motovault/design-system';
import {
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  ImportOemScheduleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  DollarSign,
  Edit3,
  Gauge,
  MoreHorizontal,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesSection } from '../../../../components/bike-hub/expenses-section';
import { MaintenanceSection } from '../../../../components/bike-hub/maintenance-section';
import { MileageDisplay } from '../../../../components/bike-hub/mileage-display';
import { HealthScoreRing } from '../../../../components/HealthScoreRing';
import { AnalyticsEvent, trackEvent } from '../../../../lib/analytics';
import { formatCurrency } from '../../../../lib/expense-constants';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { computeHealthScore } from '../../../../lib/health-score';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../../lib/image-upload';
import { exportMaintenanceHistory, type PdfBike, type PdfTask } from '../../../../lib/pdf-export';
import { queryKeys } from '../../../../lib/query-keys';
import { useAuthStore } from '../../../../stores/auth.store';
import { useEditorialTheme } from '../../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../../utils/haptics';

function InfoRow({ label, value }: { label: string; value: string; isDark?: boolean }) {
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

    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('common.cancel', { defaultValue: 'Cancel' }),
            t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
            t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          ],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const uri = await takePhoto();
            if (uri) upload(uri);
          } else if (buttonIndex === 2) {
            const uri = await pickImage();
            if (uri) upload(uri);
          }
        },
      );
    } else {
      Alert.alert(t('garage.addPhoto', { defaultValue: 'Add Photo' }), undefined, [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) upload(uri);
          },
        },
        {
          text: t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          onPress: async () => {
            const uri = await pickImage();
            if (uri) upload(uri);
          },
        },
      ]);
    }
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
        mileageUnit: bike?.mileageUnit ?? 'mi',
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

  // MOT-141: Maintenance history PDF export with optional date range filter.
  const runPdfExport = async (dateFrom?: string, dateRangeLabel?: string) => {
    if (!bike) return;
    try {
      const pdfBike: PdfBike = {
        make: bike.make,
        model: bike.model,
        year: bike.year,
        nickname: bike.nickname ?? undefined,
        mileageUnit: bike.mileageUnit ?? 'mi',
      };
      const pdfTasks: PdfTask[] = tasks.map((task) => ({
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ?? undefined,
        completedAt: task.completedAt ?? undefined,
        completedMileage: task.completedMileage ?? undefined,
        targetMileage: task.targetMileage ?? undefined,
        notes: task.notes ?? undefined,
        photoCount: task.photos?.length ?? 0,
        cost: task.cost ?? undefined,
        currency: task.currency ?? undefined,
      }));
      await exportMaintenanceHistory(pdfBike, pdfTasks, { dateFrom, dateRangeLabel });
    } catch (_e) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.exportError', { defaultValue: 'Failed to export PDF. Please try again.' }),
      );
    }
  };

  const handleExportPdf = () => {
    if (!bike) return;
    triggerImpact();
    const labelAll = t('maintenance.exportAllTime', { defaultValue: 'All time' });
    const labelYear = t('maintenance.exportLastYear', { defaultValue: 'Last 12 months' });
    const labelSix = t('maintenance.exportLast6Months', { defaultValue: 'Last 6 months' });
    const labelCancel = t('common.cancel', { defaultValue: 'Cancel' });

    const nowIso = new Date();
    const yearAgo = new Date(nowIso);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const sixMonthsAgo = new Date(nowIso);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);

    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('maintenance.exportTitle', { defaultValue: 'Export History' }),
          message: t('maintenance.exportMessage', {
            defaultValue: 'Choose the date range to include',
          }),
          options: [labelAll, labelYear, labelSix, labelCancel],
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index === 0) runPdfExport(undefined, labelAll);
          else if (index === 1) runPdfExport(isoDate(yearAgo), labelYear);
          else if (index === 2) runPdfExport(isoDate(sixMonthsAgo), labelSix);
        },
      );
    } else {
      Alert.alert(
        t('maintenance.exportTitle', { defaultValue: 'Export History' }),
        t('maintenance.exportMessage', { defaultValue: 'Choose the date range to include' }),
        [
          { text: labelAll, onPress: () => runPdfExport(undefined, labelAll) },
          { text: labelYear, onPress: () => runPdfExport(isoDate(yearAgo), labelYear) },
          { text: labelSix, onPress: () => runPdfExport(isoDate(sixMonthsAgo), labelSix) },
          { text: labelCancel, style: 'cancel' },
        ],
      );
    }
  };

  // MOT-142: Navigate to safety recalls modal
  const handleCheckRecalls = () => {
    if (!bike) return;
    triggerImpact();
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
    importOemMutation.mutate();
  };

  const handleMoreActions = () => {
    triggerImpact();
    const labels = {
      cancel: t('common.cancel', { defaultValue: 'Cancel' }),
      recalls: t('recalls.checkButton', { defaultValue: 'Check Safety Recalls' }),
      importOem: t('oem.importButton', { defaultValue: 'Import OEM Schedule' }),
      export: t('maintenance.exportPdf', { defaultValue: 'Export PDF' }),
      delete: t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
    };
    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [labels.cancel, labels.recalls, labels.importOem, labels.export, labels.delete],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleCheckRecalls();
          else if (buttonIndex === 2) handleImportOem();
          else if (buttonIndex === 3) handleExportPdf();
          else if (buttonIndex === 4) handleDeleteBike();
        },
      );
    } else {
      Alert.alert(t('common.actions', { defaultValue: 'Actions' }), undefined, [
        { text: labels.cancel, style: 'cancel' },
        { text: labels.recalls, onPress: handleCheckRecalls },
        { text: labels.importOem, onPress: handleImportOem },
        { text: labels.export, onPress: handleExportPdf },
        { text: labels.delete, style: 'destructive', onPress: handleDeleteBike },
      ]);
    }
  };

  const handleToggleExpand = useCallback(
    (taskId: string) => setExpandedId((prev) => (prev === taskId ? null : taskId)),
    [],
  );

  const handleMileageUpdate = (newMileage: number) => {
    updateBikeMutation.mutate({ currentMileage: newMileage });
  };

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
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '30%',
                  backgroundColor: `${theme.bg}80`,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '45%',
                  backgroundColor: theme.bg,
                }}
              />

              {/* Upload overlay */}
              {uploadingPhoto && hasPhoto && (
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 }}>
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
                  <ChevronLeft size={16} color="#fff" />
                  <Text style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>Garage</Text>
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
                    <Camera size={16} color="#fff" />
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
              lineHeight: 36,
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
                {(bike.currentMileage ?? 0).toLocaleString()} {bike.mileageUnit ?? 'km'}
              </Text>
            </View>
            {tasks.length > 0 && healthScore.hasData && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <HealthScoreRing
                  score={healthScore.score}
                  grade={healthScore.grade}
                  hasData={healthScore.hasData}
                  isDark={isDark}
                  size={20}
                />
                <Text style={{ fontSize: 14, color: theme.ink3, fontWeight: '500' }}>
                  {healthScore.score}%
                </Text>
              </View>
            )}
          </View>

          <MileageDisplay
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={bike.mileageUnit ?? 'mi'}
            mileageUpdatedAt={bike.mileageUpdatedAt ?? undefined}
            odometerSyncSource={bike.odometerSyncSource ?? undefined}
            isDark={isDark}
            onUpdate={handleMileageUpdate}
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
              flex: 1,
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
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#1a1208' }}>
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
              flex: 1,
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
            style={({ pressed }) => ({
              flex: 1,
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
            <Edit3 size={18} color={theme.ink2} strokeWidth={2} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: theme.ink2,
              }}
            >
              {t('common.edit', { defaultValue: 'Edit' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleMoreActions}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 12,
              backgroundColor: theme.surface,
              borderRadius: 12,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <MoreHorizontal size={16} color={theme.ink2} strokeWidth={2} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: theme.ink2,
              }}
            >
              {t('common.more', { defaultValue: 'More' })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* 4. Maintenance Section — tabbed (Active | History) */}
        <Animated.View entering={FadeInUp.delay(140).duration(400)} style={{ marginTop: 20 }}>
          <MaintenanceSection
            tasks={tasks}
            isDark={isDark}
            motorcycleId={id}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
            mileageUnit={bike.mileageUnit ?? 'mi'}
          />
        </Animated.View>

        {/* 5. Expenses Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ marginTop: 24 }}>
          <ExpensesSection
            motorcycleId={id}
            isDark={isDark}
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={bike.mileageUnit ?? 'mi'}
          />
        </Animated.View>

        {/* 6. Details section (collapsible) */}
        <Animated.View
          entering={FadeInUp.delay(260).duration(400)}
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
                <InfoRow
                  label={t('garage.make', { defaultValue: 'Make' })}
                  value={bike.make}
                  isDark={isDark}
                />
                <InfoRow
                  label={t('garage.model', { defaultValue: 'Model' })}
                  value={bike.model}
                  isDark={isDark}
                />
                <InfoRow
                  label={t('garage.year', { defaultValue: 'Year' })}
                  value={String(bike.year)}
                  isDark={isDark}
                />
                {bike.nickname && (
                  <InfoRow
                    label={t('garage.nickname', { defaultValue: 'Nickname' })}
                    value={bike.nickname}
                    isDark={isDark}
                  />
                )}
                <InfoRow
                  label={t('garage.primary', { defaultValue: 'Primary' })}
                  value={
                    bike.isPrimary
                      ? t('common.yes', { defaultValue: 'Yes' })
                      : t('common.no', { defaultValue: 'No' })
                  }
                  isDark={isDark}
                />
                {bike.purchasePrice != null && (
                  <InfoRow
                    label={t('garage.purchasePrice', { defaultValue: 'Purchase Price' })}
                    value={formatCurrency(bike.purchasePrice)}
                    isDark={isDark}
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
                    isDark={isDark}
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
