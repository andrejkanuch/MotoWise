import { palette } from '@motovault/design-system';
import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { getRelativeDueDate } from '../../lib/health-score';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';
import { TaskPhotoGallery } from '../task-photo-gallery';
import { EPriority } from '../ui/editorial';

export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Swipeable task card with left/right actions */
export const SwipeableTaskCard = memo(function SwipeableTaskCard({
  task,
  index,
  isDark,
  isExpanded,
  motorcycleId,
  onToggleExpand,
  onComplete,
  onDelete,
  mileageUnit,
}: {
  task: MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
  index: number;
  isDark: boolean;
  isExpanded: boolean;
  motorcycleId: string;
  onToggleExpand: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  mileageUnit: string;
}) {
  const { t: et } = useEditorialTheme();
  const { t } = useTranslation();
  const isCompleted = task.status === 'completed';
  const relative = task.dueDate && !isCompleted ? getRelativeDueDate(task.dueDate) : null;
  const isOverdue = relative?.isOverdue ?? false;

  return (
    <Animated.View
      key={task.id}
      entering={FadeInUp.delay(Math.min(index, 5) * 50).duration(300)}
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
            triggerImpact();
            onToggleExpand(task.id);
          }}
          style={{ padding: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Wrench icon circle */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: tint(et.warm, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wrench size={18} color={et.warm} strokeWidth={2} />
            </View>

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
              {task.notes && (
                <Text
                  style={{ fontSize: 12, color: palette.neutral500, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {task.notes}
                </Text>
              )}
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
                    {task.targetMileage.toLocaleString()} {mileageUnit}
                  </Text>
                </View>
              )}
            </View>

            {/* Priority/overdue badge */}
            {!isCompleted &&
              (isOverdue ? (
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
                <EPriority level={task.priority as 'low' | 'medium' | 'high' | 'critical'} />
              ))}
            {isExpanded ? (
              <ChevronDown size={16} color={palette.neutral400} />
            ) : (
              <ChevronRight size={16} color={palette.neutral400} />
            )}
          </View>
        </Pressable>

        {/* Action buttons row */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          {!isCompleted && (
            <Pressable
              onPress={() => {
                triggerImpact();
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
          )}
          <Pressable
            onPress={() => {
              triggerImpact();
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
              {task.completedMileage
                ? ` @ ${task.completedMileage.toLocaleString()} ${mileageUnit}`
                : ''}
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
