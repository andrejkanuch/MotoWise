import { palette } from '@motolearn/design-system';
import {
  CompleteMaintenanceTaskDocument,
  DeleteMaintenanceTaskDocument,
  DeleteMotorcycleDocument,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
} from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Gauge,
  Plus,
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
import { gqlFetcher } from '../../../../lib/graphql-client';
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
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: palette.neutral400,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
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

function MaintenanceTab({ motorcycleId, isDark }: { motorcycleId: string; isDark: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
    },
  });

  // biome-ignore lint/suspicious/noExplicitAny: maintenance task types not yet generated
  type Task = any;
  const tasks: Task[] = data?.maintenanceTasks ?? [];
  const activeTasks = tasks
    .filter((t: Task) => t.status === 'pending' || t.status === 'in_progress')
    .sort(
      (a: Task, b: Task) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed');

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

    return (
      <Animated.View key={task.id} entering={FadeInUp.delay(index * 50).duration(300)}>
        <Pressable
          onPress={() => {
            haptic();
            setExpandedId(isExpanded ? null : task.id);
          }}
          onLongPress={() => handleDelete(task.id, task.title)}
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 14,
            marginBottom: 10,
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
              {task.dueDate && !isCompleted && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <Calendar size={12} color={palette.neutral400} />
                  <Text style={{ fontSize: 12, color: palette.neutral400 }}>{task.dueDate}</Text>
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
                    {task.targetMileage.toLocaleString()} km
                  </Text>
                </View>
              )}
            </View>

            {/* Priority badge + chevron */}
            {!isCompleted && <PriorityBadge priority={task.priority} />}
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
                  {task.completedMileage ? ` @ ${task.completedMileage.toLocaleString()} km` : ''}
                </Text>
              )}
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
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
            params: { motorcycleId },
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
  const queryClient = useQueryClient();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'details' | 'maintenance'>('details');

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { mutateAsync: deleteBike, isPending: deleting } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const bike = (data?.myMotorcycles ?? []).find((m: { id: string }) => m.id === id);

  const handleDelete = () => {
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
          backgroundColor: isDark ? palette.neutral900 : palette.white,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (error || !bike) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.white,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: palette.neutral500, textAlign: 'center' }}>
          {error ? t('common.error') : t('notFound.message')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
      }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={{
          marginHorizontal: 20,
          marginTop: 20,
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 20,
          borderCurve: 'continuous',
          padding: 24,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: isDark ? palette.neutral50 : palette.neutral950,
            marginBottom: 4,
          }}
        >
          {bike.make} {bike.model}
        </Text>
        <Text style={{ fontSize: 16, color: palette.neutral500 }}>{bike.year}</Text>

        {bike.nickname && (
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                fontSize: 12,
                color: palette.neutral400,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('garage.nickname')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: isDark ? palette.neutral50 : palette.neutral950,
                marginTop: 2,
              }}
            >
              {bike.nickname}
            </Text>
          </View>
        )}

        {bike.isPrimary && (
          <View
            style={{
              backgroundColor: palette.primary500,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingHorizontal: 12,
              paddingVertical: 4,
              alignSelf: 'flex-start',
              marginTop: 12,
            }}
          >
            <Text style={{ color: palette.white, fontSize: 12, fontWeight: '600' }}>Primary</Text>
          </View>
        )}
      </Animated.View>

      {/* Tab Bar */}
      <Animated.View entering={FadeInUp.delay(50).duration(400)}>
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
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, paddingTop: 20 }}
        >
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 20,
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
          </View>

          {/* Delete Button */}
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={{
              backgroundColor: palette.danger500,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 16,
              alignItems: 'center',
              marginTop: 20,
            }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <Text style={{ color: palette.white, fontSize: 16, fontWeight: '600' }}>
                {t('garage.deleteBike')}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <MaintenanceTab motorcycleId={id} isDark={isDark} />
      )}
    </ScrollView>
  );
}
