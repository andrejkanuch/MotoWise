import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Pencil,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { formatMoney, serviceTypeLabel } from '../../lib/expense-constants';
import { getRelativeDueDate } from '../../lib/health-score';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';
import { TaskPhotoGallery } from '../task-photo-gallery';
import { EPriority } from '../ui/editorial';
import { effectiveTaskTotal } from './service/group-tasks';

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
  onEdit,
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
  onEdit?: (id: string) => void;
  mileageUnit: string;
}) {
  const { t: et } = useEditorialTheme();
  const { t } = useTranslation();
  // Task money renders in the task's own stored currency; legacy null-currency
  // tasks fall back to the user's display currency.
  const { currency: displayCurrency } = useCurrency();
  const isCompleted = task.status === 'completed';
  const relative = task.dueDate && !isCompleted ? getRelativeDueDate(task.dueDate) : null;
  const isOverdue = relative?.isOverdue ?? false;
  const total = isCompleted ? effectiveTaskTotal(task) : 0;
  const lineItems = task.lineItems ?? [];

  return (
    <Animated.View
      key={task.id}
      entering={FadeInUp.delay(Math.min(index, 5) * 50).duration(300)}
      exiting={FadeOutLeft.duration(250)}
      layout={LinearTransition.duration(200)}
    >
      <View
        style={{
          backgroundColor: relative?.isOverdue ? tint(et.danger, 0.08) : et.surface,
          borderRadius: 14,
          borderCurve: 'continuous',
          marginBottom: 10,
          overflow: 'hidden',
          borderWidth: relative?.isOverdue ? 1 : 0,
          borderColor: tint(et.danger, 0.35),
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
                  color: isCompleted ? et.ink3 : et.ink,
                  textDecorationLine: isCompleted ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </Text>
              {task.notes && (
                <Text style={{ fontSize: 12, color: et.ink3, marginTop: 2 }} numberOfLines={1}>
                  {task.notes}
                </Text>
              )}
              {relative && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Calendar size={12} color={relative.isOverdue ? et.overdueInk : et.ink3} />
                  <Text
                    style={{
                      fontSize: 12,
                      color: relative.isOverdue ? et.overdueInk : et.ink3,
                    }}
                  >
                    {String(t(relative.key as never, relative.params as never))}
                  </Text>
                </View>
              )}
              {task.targetMileage && !isCompleted && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Gauge size={12} color={et.ink3} />
                  <Text style={{ fontSize: 12, color: et.ink3 }}>
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
                    backgroundColor: tint(et.danger, 0.12),
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
                      color: et.overdueInk,
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
              <ChevronDown size={16} color={et.ink3} />
            ) : (
              <ChevronRight size={16} color={et.ink3} />
            )}
          </View>
        </Pressable>

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
            <CheckCircle2 size={14} color={et.success} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: et.success }}>
              {new Date(task.completedAt).toLocaleDateString()}
              {task.completedMileage
                ? ` @ ${task.completedMileage.toLocaleString()} ${mileageUnit}`
                : ''}
            </Text>
            {total > 0 && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: et.ink2,
                  marginLeft: 'auto',
                }}
              >
                {formatMoney(total, task.currency, displayCurrency)}
              </Text>
            )}
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
                borderTopColor: et.line,
              }}
            >
              {task.description && (
                <Text
                  style={{
                    fontSize: 14,
                    color: et.ink2,
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
                      fontSize: 13,
                      fontWeight: '600',
                      color: et.ink3,
                      marginBottom: 4,
                    }}
                  >
                    {t('maintenance.notes', { defaultValue: 'Notes' })}
                  </Text>
                  <Text
                    selectable
                    style={{
                      fontSize: 13,
                      color: et.ink2,
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
                      fontSize: 13,
                      fontWeight: '600',
                      color: et.ink3,
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
                        color: et.ink2,
                        lineHeight: 20,
                      }}
                    >
                      {'\u2022'} {part}
                    </Text>
                  ))}
                </View>
              )}
              {lineItems.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: et.ink3,
                      marginBottom: 6,
                    }}
                  >
                    {t('maintenance.serviceItems', { defaultValue: 'Service items' })}
                  </Text>
                  {lineItems.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 4,
                      }}
                    >
                      {item.serviceType && item.serviceType !== 'other' && (
                        <View
                          style={{
                            paddingVertical: 2,
                            paddingHorizontal: 7,
                            borderRadius: 7,
                            borderCurve: 'continuous',
                            backgroundColor: tint(et.warm, 0.15),
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: et.warm }}>
                            {serviceTypeLabel(item.serviceType, t)}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: et.ink2,
                        }}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.lineTotal != null && (
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: et.ink2,
                          }}
                        >
                          {formatMoney(item.lineTotal, task.currency, displayCurrency)}
                        </Text>
                      )}
                    </View>
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

              {/* Actions — revealed on expand (was an always-visible row). Keeps
                  the collapsed list clean and mirrors the tap-to-detail model
                  used by expenses. */}
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  borderTopWidth: 0.5,
                  borderTopColor: et.line,
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
                      borderRightColor: et.line,
                    }}
                  >
                    <Check size={14} color={et.success} strokeWidth={2.5} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: et.success }}>
                      {t('maintenance.markDone', { defaultValue: 'Done' })}
                    </Text>
                  </Pressable>
                )}
                {!isCompleted && onEdit && (
                  <Pressable
                    onPress={() => {
                      triggerImpact();
                      onEdit(task.id);
                    }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRightWidth: 0.5,
                      borderRightColor: et.line,
                    }}
                  >
                    <Pencil size={14} color={et.warm2} strokeWidth={2} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: et.warm2 }}>
                      {t('common.edit', { defaultValue: 'Edit' })}
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
                  <Trash2 size={14} color={et.overdueInk} strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: et.overdueInk }}>
                    {t('common.delete', { defaultValue: 'Delete' })}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
});
