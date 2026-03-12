import { palette } from '@motolearn/design-system';
import {
  CompleteMaintenanceTaskDocument,
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Gauge,
  Plus,
  Star,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MileageDisplay } from '../../../../components/bike-hub/mileage-display';
import { SpendingSummary } from '../../../../components/bike-hub/spending-summary';
import { StatCards } from '../../../../components/bike-hub/stat-cards';
import { UpcomingTasks } from '../../../../components/bike-hub/upcoming-tasks';
import { HealthScoreRing } from '../../../../components/HealthScoreRing';
import { TaskPhotoGallery } from '../../../../components/TaskPhotoGallery';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { computeHealthScore, getRelativeDueDate } from '../../../../lib/health-score';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../../lib/image-upload';
import { exportMaintenanceHistory, type PdfBike, type PdfTask } from '../../../../lib/pdf-export';
import { queryKeys } from '../../../../lib/query-keys';
import { useAuthStore } from '../../../../stores/auth.store';

const PRIORITY_COLORS: Record<string, string> = {
  critical: palette.danger500,
  high: palette.warning500,
  medium: palette.primary500,
  low: palette.success500,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

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

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? palette.neutral500;
  return (
    <View
      style={{
        backgroundColor: `${color}20`,
        borderRadius: 6,
        borderCurve: 'continuous',
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {priority}
      </Text>
    </View>
  );
}

/** Swipeable task card with left/right actions */
function SwipeableTaskCard({
  task,
  index,
  isDark,
  expandedId,
  motorcycleId,
  onToggleExpand,
  onComplete,
  onDelete,
}: {
  task: MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
  index: number;
  isDark: boolean;
  expandedId: string | null;
  motorcycleId: string;
  onToggleExpand: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const isExpanded = expandedId === task.id;
  const isCompleted = task.status === 'completed';
  const relative = task.dueDate && !isCompleted ? getRelativeDueDate(task.dueDate) : null;

  return (
    <Animated.View key={task.id} entering={FadeInUp.delay(index * 50).duration(300)}>
      <View
        style={{
          backgroundColor: relative?.isOverdue
            ? isDark
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(239,68,68,0.05)'
            : isDark
              ? palette.neutral800
              : palette.white,
          borderRadius: 14,
          borderCurve: 'continuous',
          marginBottom: 10,
          overflow: 'hidden',
          borderLeftWidth: relative?.isOverdue ? 3 : 0,
          borderLeftColor: palette.danger500,
        }}
      >
        {/* Main card content */}
        <Pressable
          onPress={() => {
            haptic();
            onToggleExpand(task.id);
          }}
          style={{ padding: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Title + meta */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isCompleted
                    ? palette.neutral400
                    : isDark
                      ? palette.neutral50
                      : palette.neutral950,
                  textDecorationLine: isCompleted ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </Text>
              {relative && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Calendar
                    size={12}
                    color={relative.isOverdue ? palette.danger500 : palette.neutral400}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: relative.isOverdue ? palette.danger500 : palette.neutral400,
                    }}
                  >
                    {relative.text}
                  </Text>
                </View>
              )}
              {task.targetMileage && !isCompleted && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Gauge size={12} color={palette.neutral400} />
                  <Text style={{ fontSize: 12, color: palette.neutral400 }}>
                    {task.targetMileage.toLocaleString()} mi
                  </Text>
                </View>
              )}
            </View>

            {/* Priority/overdue badge */}
            {!isCompleted &&
              (relative?.isOverdue ? (
                <View
                  style={{
                    backgroundColor: `${palette.danger500}20`,
                    borderRadius: 6,
                    borderCurve: 'continuous',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: palette.danger500,
                      letterSpacing: 0.3,
                    }}
                  >
                    OVERDUE
                  </Text>
                </View>
              ) : (
                <PriorityBadge priority={task.priority} />
              ))}
            {isExpanded ? (
              <ChevronDown size={16} color={palette.neutral400} />
            ) : (
              <ChevronRight size={16} color={palette.neutral400} />
            )}
          </View>
        </Pressable>

        {/* Action buttons row — visible always for active tasks */}
        {!isCompleted && (
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: 0.5,
              borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios')
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onComplete(task.id);
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRightWidth: 0.5,
                borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <Check size={14} color={palette.success500} strokeWidth={2.5} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.success500 }}>
                {t('maintenance.markDone', { defaultValue: 'Done' })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic();
                onDelete(task.id, task.title);
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
              }}
            >
              <Trash2 size={14} color={palette.danger500} strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.danger500 }}>
                {t('common.delete', { defaultValue: 'Delete' })}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Completed info row */}
        {isCompleted && task.completedAt && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingBottom: 10,
            }}
          >
            <CheckCircle2 size={14} color={palette.success500} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: palette.success500 }}>
              {new Date(task.completedAt).toLocaleDateString()}
              {task.completedMileage ? ` @ ${task.completedMileage.toLocaleString()} mi` : ''}
            </Text>
          </View>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingBottom: 14,
                paddingTop: 4,
                borderTopWidth: isCompleted ? 0.5 : 0,
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              }}
            >
              {task.description && (
                <Text
                  style={{
                    fontSize: 14,
                    color: isDark ? palette.neutral300 : palette.neutral600,
                    marginBottom: 8,
                    lineHeight: 20,
                  }}
                >
                  {task.description}
                </Text>
              )}
              {task.notes && (
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: palette.neutral500,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    {t('maintenance.notes', { defaultValue: 'Notes' })}
                  </Text>
                  <Text
                    selectable
                    style={{
                      fontSize: 13,
                      color: isDark ? palette.neutral300 : palette.neutral600,
                      lineHeight: 18,
                    }}
                  >
                    {task.notes}
                  </Text>
                </View>
              )}
              {task.partsNeeded && task.partsNeeded.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: palette.neutral500,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    {t('maintenance.partsNeeded', { defaultValue: 'Parts Needed' })}
                  </Text>
                  {task.partsNeeded.map((part: string) => (
                    <Text
                      key={`${task.id}-part-${part}`}
                      style={{
                        fontSize: 13,
                        color: isDark ? palette.neutral300 : palette.neutral600,
                        lineHeight: 20,
                      }}
                    >
                      {'\u2022'} {part}
                    </Text>
                  ))}
                </View>
              )}
              <TaskPhotoGallery
                taskId={task.id}
                userId={task.userId}
                motorcycleId={motorcycleId}
                photos={task.photos ?? []}
                isDark={isDark}
              />
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

export default function BikeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const session = useAuthStore((s) => s.session);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // --- Queries ---

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId: id }),
  });

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

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(CompleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateTasks();
    },
    onError: (_err: Error) => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.completeError', {
          defaultValue: 'Failed to complete task. Please try again.',
        }),
      );
    },
  });

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
  const activeTasks = tasks
    .filter((t: Task) => t.status === 'pending' || t.status === 'in_progress')
    .sort(
      (a: Task, b: Task) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed');

  const healthScore = computeHealthScore(
    tasks.map((t) => ({
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      completedAt: t.completedAt,
    })),
  );

  // Compute spending from completed tasks (estimate from task data)
  const spendThisYear = completedTasks
    .filter(
      (t) => t.completedAt && new Date(t.completedAt).getFullYear() === new Date().getFullYear(),
    )
    .reduce((sum, t) => sum + (t.cost ?? 0), 0);
  const spendAllTime = completedTasks.reduce((sum, t) => sum + (t.cost ?? 0), 0);

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
        console.log('[BikeDetail] Uploading photo, uri:', uri, 'userId:', userId, 'bikeId:', id);
        const { publicUrl } = await uploadBikePhoto(uri, userId, id);
        console.log('[BikeDetail] Photo uploaded, publicUrl:', publicUrl);
        await updateBikeMutation.mutateAsync({ primaryPhotoUrl: publicUrl });
        console.log('[BikeDetail] Motorcycle updated with photo URL');
      } catch (e) {
        console.error('[BikeDetail] Photo upload error:', e);
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('garage.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
        );
      } finally {
        setUploadingPhoto(false);
      }
    };

    if (Platform.OS === 'ios') {
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
    completeMutation.mutate(taskId);
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
    setExporting(true);
    try {
      const pdfBike: PdfBike = {
        make: bike.make,
        model: bike.model,
        year: bike.year,
        nickname: bike.nickname ?? undefined,
        mileageUnit: 'mi',
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
    } finally {
      setExporting(false);
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
                {/* Gradient overlay for readability */}
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
                {/* Camera icon to change photo */}
                <Pressable
                  onPress={handleAddPhoto}
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 16,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={18} color={palette.white} strokeWidth={2} />
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
                  backgroundColor: 'rgba(245,158,11,0.9)',
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

            <Pressable
              onPress={() => {
                haptic();
                router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id: bike.id } });
              }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 36,
                height: 36,
                borderRadius: 10,
                borderCurve: 'continuous',
                backgroundColor: hasPhoto
                  ? 'rgba(0,0,0,0.4)'
                  : isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Edit3
                size={16}
                color={hasPhoto ? palette.white : isDark ? palette.white : palette.neutral700}
                strokeWidth={2}
              />
            </Pressable>
          </Pressable>
        </Animated.View>

        {/* 2. Bike name/year info */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Wrench size={14} color={palette.neutral400} strokeWidth={2} />
              <Text style={{ fontSize: 14, color: palette.neutral500, fontWeight: '500' }}>
                {t('garage.serviceRecords', { defaultValue: 'Service' })}
              </Text>
            </View>
          </View>

          {/* 3. MileageDisplay */}
          <MileageDisplay
            currentMileage={bike.currentMileage ?? undefined}
            mileageUnit={bike.mileageUnit ?? 'mi'}
            mileageUpdatedAt={bike.mileageUpdatedAt ?? undefined}
            isDark={isDark}
            onUpdate={handleMileageUpdate}
          />
        </Animated.View>

        {/* 4. Health Score (compact, inline) */}
        {tasks.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(120).duration(400)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginTop: 20,
              marginHorizontal: 20,
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
            }}
          >
            <HealthScoreRing
              score={healthScore.score}
              grade={healthScore.grade}
              hasData={healthScore.hasData}
              isDark={isDark}
              size={64}
            />
            <View style={{ flex: 1 }}>
              {healthScore.hasData && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: palette.neutral500,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('maintenance.healthScore', { defaultValue: 'Health Score' })}
                </Text>
              )}
              {healthScore.overdueTasks > 0 && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: palette.danger500,
                    marginTop: 4,
                  }}
                >
                  {healthScore.overdueTasks} overdue
                </Text>
              )}
              {healthScore.urgentTasks > 0 && healthScore.overdueTasks === 0 && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: palette.warning500,
                    marginTop: 4,
                  }}
                >
                  {healthScore.urgentTasks} urgent
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* 5. Stat Cards */}
        {tasks.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <StatCards
              upcomingCount={activeTasks.length}
              overdueCount={healthScore.overdueTasks}
              totalSpend={spendAllTime > 0 ? spendAllTime : null}
              isDark={isDark}
            />
          </View>
        )}

        {/* Quick Action Bar */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={{
            flexDirection: 'row',
            gap: 10,
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
                params: { motorcycleId: id, bikeName: `${bike.year} ${bike.make} ${bike.model}` },
              });
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
              backgroundColor: palette.primary500,
              borderRadius: 12,
              borderCurve: 'continuous',
            }}
          >
            <Plus size={16} color={palette.white} strokeWidth={2.5} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
              {t('maintenance.addTask', { defaultValue: 'Add Task' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic();
              if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: [
                      t('common.cancel', { defaultValue: 'Cancel' }),
                      t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
                      t('maintenance.exportPdf', { defaultValue: 'Export PDF' }),
                      t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
                    ],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 3,
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 1) {
                      router.push({
                        pathname: '/(tabs)/(garage)/edit-bike',
                        params: { id },
                      });
                    } else if (buttonIndex === 2) {
                      handleExportPdf();
                    } else if (buttonIndex === 3) {
                      handleDeleteBike();
                    }
                  },
                );
              } else {
                // Android fallback — simple Alert
                Alert.alert(t('common.actions', { defaultValue: 'Actions' }), undefined, [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
                    onPress: () =>
                      router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id } }),
                  },
                  {
                    text: t('maintenance.exportPdf', { defaultValue: 'Export PDF' }),
                    onPress: handleExportPdf,
                  },
                  {
                    text: t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
                    style: 'destructive',
                    onPress: handleDeleteBike,
                  },
                ]);
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              borderRadius: 12,
              borderCurve: 'continuous',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? palette.neutral300 : palette.neutral600,
              }}
            >
              {t('common.more', { defaultValue: 'More' })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* 6. Upcoming Tasks (quick glance) */}
        {tasks.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <UpcomingTasks
              tasks={tasks.map((t) => ({
                id: t.id,
                title: t.title,
                dueDate: t.dueDate,
                targetMileage: t.targetMileage,
                priority: t.priority,
                status: t.status,
              }))}
              isDark={isDark}
              onTaskPress={(taskId) => {
                haptic();
                setExpandedId((prev) => (prev === taskId ? null : taskId));
              }}
              onSeeAllPress={() => {
                // Scroll down to full task list — for now just a no-op
              }}
            />
          </View>
        )}

        {/* 7. Spending Summary */}
        <View style={{ marginTop: 20 }}>
          <SpendingSummary thisYear={spendThisYear} allTime={spendAllTime} isDark={isDark} />
        </View>

        {/* 8. Full task list — Active + History */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {tasksLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={palette.primary500} />
            </View>
          ) : tasks.length === 0 ? (
            <Animated.View
              entering={FadeInUp.duration(400)}
              style={{ alignItems: 'center', paddingVertical: 40 }}
            >
              <Wrench size={40} color={palette.neutral400} strokeWidth={1.2} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: isDark ? palette.neutral300 : palette.neutral700,
                  marginTop: 16,
                }}
              >
                {t('maintenance.noTasks', { defaultValue: 'No maintenance tasks yet' })}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: palette.neutral500,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {t('maintenance.addFirstTask', {
                  defaultValue: 'Add your first maintenance task',
                })}
              </Text>
            </Animated.View>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: palette.neutral500,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 10,
                      marginLeft: 4,
                    }}
                  >
                    {t('maintenance.activeTasks', { defaultValue: 'Active' })} ({activeTasks.length}
                    )
                  </Text>
                  {activeTasks.map((task: Task, i: number) => (
                    <SwipeableTaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      isDark={isDark}
                      expandedId={expandedId}
                      motorcycleId={id}
                      onToggleExpand={handleToggleExpand}
                      onComplete={handleCompleteTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </View>
              )}

              {completedTasks.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: palette.neutral500,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 10,
                      marginLeft: 4,
                    }}
                  >
                    {t('maintenance.history', { defaultValue: 'History' })} ({completedTasks.length}
                    )
                  </Text>
                  {completedTasks.map((task: Task, i: number) => (
                    <SwipeableTaskCard
                      key={task.id}
                      task={task}
                      index={activeTasks.length + i}
                      isDark={isDark}
                      expandedId={expandedId}
                      motorcycleId={id}
                      onToggleExpand={handleToggleExpand}
                      onComplete={handleCompleteTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* 9. Details section (collapsible) */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 8 }}
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
