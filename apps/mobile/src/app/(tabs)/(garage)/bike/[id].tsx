import { palette } from '@motovault/design-system';
import {
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Edit3,
  MoreHorizontal,
  Star,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesSection } from '../../../../components/bike-hub/expenses-section';
import { MaintenanceSection } from '../../../../components/bike-hub/maintenance-section';
import { MileageDisplay } from '../../../../components/bike-hub/mileage-display';
import { HealthScoreRing } from '../../../../components/HealthScoreRing';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { haptic } from '../../../../lib/haptics';
import { computeHealthScore } from '../../../../lib/health-score';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../../lib/image-upload';
import { exportMaintenanceHistory, type PdfBike, type PdfTask } from '../../../../lib/pdf-export';
import { queryKeys } from '../../../../lib/query-keys';
import { useAuthStore } from '../../../../stores/auth.store';

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <Text style={{ fontSize: 14, color: palette.neutral500 }}>{label}</Text>
      <Text
        selectable
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? palette.neutral50 : palette.neutral950,
        }}
      >
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
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const session = useAuthStore((s) => s.session);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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

  // --- Mutations ---

  const { mutateAsync: deleteBike } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
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
    onSuccess: invalidateTasks,
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
    haptic();
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
    haptic();
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
      params: { taskId, motorcycleId: id, bikeName },
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

  const handleExportPdf = async () => {
    if (!bike) return;
    haptic();
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
        photoCount: 0,
      }));
      await exportMaintenanceHistory(pdfBike, pdfTasks);
    } catch (_e) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.exportError', { defaultValue: 'Failed to export PDF. Please try again.' }),
      );
    }
  };

  const handleMoreActions = () => {
    haptic();
    const labels = {
      cancel: t('common.cancel', { defaultValue: 'Cancel' }),
      export: t('maintenance.exportPdf', { defaultValue: 'Export PDF' }),
      delete: t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
    };
    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [labels.cancel, labels.export, labels.delete],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleExportPdf();
          else if (buttonIndex === 2) handleDeleteBike();
        },
      );
    } else {
      Alert.alert(t('common.actions', { defaultValue: 'Actions' }), undefined, [
        { text: labels.cancel, style: 'cancel' },
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
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
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
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: palette.neutral500, textAlign: 'center' }}>
          {t('notFound.message', { defaultValue: 'Not found' })}
        </Text>
      </View>
    );
  }

  const hasPhoto = !!bike.primaryPhotoUrl;
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero — photo or gradient placeholder */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <Pressable onPress={handleAddPhoto} disabled={uploadingPhoto}>
            {hasPhoto ? (
              <View style={{ height: 240, position: 'relative' }}>
                <Image
                  source={{ uri: bike.primaryPhotoUrl ?? undefined }}
                  style={{ width: screenWidth, height: 240 }}
                  contentFit="cover"
                  transition={300}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.5)']}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 80,
                  }}
                />
                <Pressable
                  onPress={handleAddPhoto}
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={20} color={palette.white} strokeWidth={2} />
                </Pressable>
              </View>
            ) : (
              <LinearGradient
                colors={isDark ? ['#1a1a2e', '#16213e'] : [palette.primary50, palette.primary100]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 200,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="large" color={palette.primary500} />
                ) : (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Camera
                        size={26}
                        color={isDark ? palette.neutral300 : palette.neutral500}
                        strokeWidth={1.5}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isDark ? palette.neutral400 : palette.neutral500,
                      }}
                    >
                      {t('garage.addPhoto', { defaultValue: 'Add Photo' })}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            )}

            {bike.isPrimary && (
              <View
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: palette.warning500,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                }}
              >
                <Star size={13} color={palette.white} strokeWidth={2.5} fill={palette.white} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.white }}>
                  {t('garage.primary', { defaultValue: 'Primary' })}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* 2. Bike name/year info + Quick Stats */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 20 }}
        >
          {bike.nickname && (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: palette.primary500,
                marginBottom: 4,
              }}
            >
              &ldquo;{bike.nickname}&rdquo;
            </Text>
          )}
          <Text
            selectable
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {bike.make} {bike.model}
          </Text>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color={palette.neutral400} strokeWidth={2} />
              <Text style={{ fontSize: 14, color: palette.neutral500, fontWeight: '500' }}>
                {bike.year}
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
                <Text style={{ fontSize: 14, color: palette.neutral500, fontWeight: '500' }}>
                  {healthScore.score}%
                </Text>
              </View>
            )}
          </View>

          <MileageDisplay
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={bike.mileageUnit ?? 'mi'}
            mileageUpdatedAt={bike.mileageUpdatedAt ?? undefined}
            isDark={isDark}
            onUpdate={handleMileageUpdate}
          />
        </Animated.View>

        {/* 3. Quick Actions — 4 buttons */}
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
              haptic();
              router.push({
                pathname: '/(tabs)/(garage)/add-maintenance-task',
                params: { motorcycleId: id, bikeName },
              });
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 12,
              backgroundColor: palette.primary500,
              borderRadius: 12,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Wrench size={16} color={palette.white} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: palette.white }}>
              {t('maintenance.addTask', { defaultValue: 'Add Task' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptic();
              router.push({
                pathname: '/(tabs)/(garage)/add-expense',
                params: { motorcycleId: id },
              });
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 12,
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              borderRadius: 12,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <DollarSign
              size={16}
              color={isDark ? palette.neutral300 : palette.neutral600}
              strokeWidth={2.5}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: isDark ? palette.neutral300 : palette.neutral600,
              }}
            >
              {t('garage.addExpense', { defaultValue: 'Expense' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptic();
              router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id } });
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 12,
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              borderRadius: 12,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Edit3
              size={16}
              color={isDark ? palette.neutral300 : palette.neutral600}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: isDark ? palette.neutral300 : palette.neutral600,
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
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              borderRadius: 12,
              borderCurve: 'continuous',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <MoreHorizontal
              size={16}
              color={isDark ? palette.neutral300 : palette.neutral600}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: isDark ? palette.neutral300 : palette.neutral600,
              }}
            >
              {t('common.more', { defaultValue: 'More' })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* 4. Maintenance Section — tabbed (Active | History) */}
        <View style={{ marginTop: 20 }}>
          <MaintenanceSection
            tasks={tasks}
            isDark={isDark}
            motorcycleId={id}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
          />
        </View>

        {/* 5. Expenses Section */}
        <View style={{ marginTop: 24 }}>
          <ExpensesSection motorcycleId={id} isDark={isDark} />
        </View>

        {/* 6. Details section (collapsible) */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 20 }}
        >
          <Pressable
            onPress={() => {
              haptic();
              setShowDetails((prev) => !prev);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: isDark ? palette.neutral800 : palette.white,
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
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {t('garage.tab_details', { defaultValue: 'Details' })}
            </Text>
            {showDetails ? (
              <ChevronDown size={18} color={palette.neutral400} />
            ) : (
              <ChevronRight size={18} color={palette.neutral400} />
            )}
          </Pressable>
          {showDetails && (
            <Animated.View entering={FadeIn.duration(200)}>
              <View
                style={{
                  backgroundColor: isDark ? palette.neutral800 : palette.white,
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
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
