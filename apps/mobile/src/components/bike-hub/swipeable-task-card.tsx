import { palette } from '@motovault/design-system';
import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Trash2,
} from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { getRelativeDueDate } from '../../lib/health-score';
import { TaskPhotoGallery } from '../TaskPhotoGallery';

const PRIORITY_COLORS: Record<string, string> = {
  critical: palette.danger500,
  high: palette.warning500,
  medium: palette.primary500,
  low: palette.success500,
};

export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
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
        {String(
          t(`maintenance.priority${priority.charAt(0).toUpperCase()}${priority.slice(1)}` as never),
        )}
      </Text>
    </View>
  );
}

/** Swipeable task card with left/right actions */
export const SwipeableTaskCard = memo(function SwipeableTaskCard({
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
    <Animated.View
      key={task.id}
      entering={FadeInUp.delay(index * 50).duration(300)}
      exiting={FadeOutLeft.duration(250)}
      layout={LinearTransition.duration(200)}
    >
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
                    {String(t(relative.key as never, relative.params as never))}
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
                    {t('maintenance.overdue')}
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
                haptic();
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
});
