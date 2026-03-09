import { palette } from '@motolearn/design-system';
import {
  CompleteMaintenanceTaskDocument,
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
  MyMotorcyclesDocument,
} from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Edit3,
  FileText,
  Gauge,
  Plus,
  Star,
  Wrench,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HealthScoreRing } from '../../../../components/HealthScoreRing';
import { LottieMotorcycle } from '../../../../components/LottieMotorcycle';
import { TaskPhotoGallery } from '../../../../components/TaskPhotoGallery';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { computeHealthScore, getRelativeDueDate } from '../../../../lib/health-score';
import { exportMaintenanceHistory, type PdfBike, type PdfTask } from '../../../../lib/pdf-export';
import { queryKeys } from '../../../../lib/query-keys';

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

function MaintenanceTab({
  motorcycleId,
  isDark,
  bike,
}: {
  motorcycleId: string;
  isDark: boolean;
  bike: { make: string; model: string; year: number; nickname?: string | null };
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(CompleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
    },
  });

  type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
  const tasks: Task[] = data?.maintenanceTasks ?? [];
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

  // Find next upcoming task
  const nextTask = activeTasks.find((t) => t.dueDate);
  const nextTaskRelative = nextTask?.dueDate ? getRelativeDueDate(nextTask.dueDate) : null;

  const handleComplete = (taskId: string) => {
    haptic();
    completeMutation.mutate(taskId);
  };

  const handleDelete = (taskId: string, taskTitle: string) => {
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

  if (isLoading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <Text style={{ color: palette.neutral500, fontSize: 14 }}>
          {t('common.error', { defaultValue: 'Something went wrong' })}
        </Text>
      </View>
    );
  }

  const renderTask = (task: Task, index: number) => {
    const isExpanded = expandedId === task.id;
    const isCompleted = task.status === 'completed';
    const relative = task.dueDate && !isCompleted ? getRelativeDueDate(task.dueDate) : null;

    return (
      <Animated.View key={task.id} entering={FadeInUp.delay(index * 50).duration(300)}>
        <Pressable
          onPress={() => {
            haptic();
            setExpandedId(isExpanded ? null : task.id);
          }}
          onLongPress={() => handleDelete(task.id, task.title)}
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
            padding: 14,
            marginBottom: 10,
            borderLeftWidth: relative?.isOverdue ? 3 : 0,
            borderLeftColor: palette.danger500,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Checkbox */}
            {!isCompleted ? (
              <Pressable onPress={() => handleComplete(task.id)} hitSlop={8}>
                <Circle size={22} color={palette.neutral400} strokeWidth={1.5} />
              </Pressable>
            ) : (
              <CheckCircle2 size={22} color={palette.success500} strokeWidth={1.5} />
            )}

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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                  }}
                >
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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Gauge size={12} color={palette.neutral400} />
                  <Text style={{ fontSize: 12, color: palette.neutral400 }}>
                    {task.targetMileage.toLocaleString()} mi
                  </Text>
                </View>
              )}
            </View>

            {/* Priority badge or OVERDUE badge */}
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

          {/* Expanded content */}
          {isExpanded && (
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? palette.neutral700 : palette.neutral200,
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
                <View>
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
              {isCompleted && task.completedAt && (
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.success500,
                    marginTop: 4,
                  }}
                >
                  {t('maintenance.completedOn', { defaultValue: 'Completed' })}{' '}
                  {new Date(task.completedAt).toLocaleDateString()}
                  {task.completedMileage ? ` @ ${task.completedMileage.toLocaleString()} mi` : ''}
                </Text>
              )}

              {/* Photo Gallery */}
              <TaskPhotoGallery
                taskId={task.id}
                userId={task.userId}
                motorcycleId={motorcycleId}
                photos={task.photos ?? []}
                isDark={isDark}
              />
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Health Score Gauge */}
      {tasks.length > 0 && (
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{
            alignItems: 'center',
            marginBottom: 20,
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            padding: 20,
          }}
        >
          <HealthScoreRing
            score={healthScore.score}
            grade={healthScore.grade}
            hasData={healthScore.hasData}
            isDark={isDark}
          />
          {healthScore.hasData && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: palette.neutral500,
                marginTop: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('maintenance.healthScore', { defaultValue: 'Health Score' })}
            </Text>
          )}
          {nextTask && nextTaskRelative && (
            <View
              style={{
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar
                size={14}
                color={nextTaskRelative.isOverdue ? palette.danger500 : palette.neutral400}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: nextTaskRelative.isOverdue
                    ? palette.danger500
                    : isDark
                      ? palette.neutral300
                      : palette.neutral600,
                }}
              >
                {nextTask.title} — {nextTaskRelative.text}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Export PDF Button */}
      {tasks.length > 0 && (
        <Animated.View entering={FadeInUp.delay(50).duration(300)}>
          <Pressable
            onPress={handleExportPdf}
            disabled={exporting}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 12,
              borderCurve: 'continuous',
              paddingVertical: 12,
              marginBottom: 20,
            }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={palette.primary500} />
            ) : (
              <>
                <FileText size={16} color={palette.primary500} strokeWidth={2} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: palette.primary500,
                  }}
                >
                  {t('maintenance.exportPdf', { defaultValue: 'Export PDF' })}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      )}

      {tasks.length === 0 ? (
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
              defaultValue: 'Tap + to add your first task',
            })}
          </Text>
        </Animated.View>
      ) : (
        <>
          {/* Active Tasks */}
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
                {t('maintenance.activeTasks', { defaultValue: 'Active' })} ({activeTasks.length})
              </Text>
              {activeTasks.map((task: Task, i: number) => renderTask(task, i))}
            </View>
          )}

          {/* Completed Tasks */}
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
                {t('maintenance.history', { defaultValue: 'History' })} ({completedTasks.length})
              </Text>
              {completedTasks.map((task: Task, i: number) =>
                renderTask(task, activeTasks.length + i),
              )}
            </View>
          )}
        </>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => {
          haptic();
          router.push({
            pathname: '/(tabs)/(garage)/add-maintenance-task',
            params: {
              motorcycleId,
              bikeName: bike.nickname || `${bike.year} ${bike.make} ${bike.model}`,
            },
          });
        }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          borderCurve: 'continuous',
          backgroundColor: palette.primary500,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: palette.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Plus size={24} color={palette.white} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

export default function BikeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'details' | 'maintenance'>('details');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { mutateAsync: deleteBike, isPending: deleting } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const motorcycles = data?.myMotorcycles ?? [];
  const bikeIndex = motorcycles.findIndex((m: { id: string }) => m.id === id);
  const bike = motorcycles[bikeIndex];

  const handleDelete = () => {
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
          } catch (e) {
            Alert.alert(t('common.error'), String(e));
          }
        },
      },
    ]);
  };

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <Animated.View entering={FadeInUp.duration(400)}>
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
          <LottieMotorcycle animation="cardPlaceholder" size={140} loop speed={0.5} />

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
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.white }}>Primary</Text>
            </View>
          )}

          <Pressable
            onPress={() => {
              haptic();
              router.push({ pathname: '/(garage)/edit-bike', params: { id: bike.id } });
            }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Edit3 size={16} color={isDark ? palette.white : palette.neutral700} strokeWidth={2} />
          </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* Info */}
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
      </Animated.View>

      {/* Tab Bar */}
      <Animated.View entering={FadeInUp.delay(120).duration(400)}>
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginTop: 20,
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 12,
            borderCurve: 'continuous',
            padding: 4,
          }}
        >
          {(['details', 'maintenance'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                haptic();
                setActiveTab(tab);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                borderCurve: 'continuous',
                alignItems: 'center',
                backgroundColor:
                  activeTab === tab
                    ? isDark
                      ? palette.primary700
                      : palette.primary500
                    : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color:
                    activeTab === tab
                      ? palette.white
                      : isDark
                        ? palette.neutral400
                        : palette.neutral600,
                  textTransform: 'capitalize',
                }}
              >
                {t(`garage.tab_${tab}`, { defaultValue: tab })}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Tab Content */}
      {activeTab === 'details' ? (
        <>
          {/* Details Card */}
          <Animated.View
            entering={FadeInUp.delay(160).duration(400)}
            style={{ paddingHorizontal: 20, marginTop: 24 }}
          >
            <View
              style={{
                backgroundColor: isDark ? palette.neutral800 : palette.white,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
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

          {/* Delete */}
          <Animated.View
            entering={FadeInUp.delay(240).duration(400)}
            style={{ paddingHorizontal: 20, marginTop: 32 }}
          >
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={{
                backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={palette.danger500} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: palette.danger500 }}>
                  {t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' })}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        </>
      ) : (
        <MaintenanceTab motorcycleId={id} isDark={isDark} bike={bike} />
      )}
    </ScrollView>
  );
}
