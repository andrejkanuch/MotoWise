import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ChevronRight, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';
import type { TaskWithRelative } from './home-types';

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  critical: 'maintenance.priorityCritical',
  high: 'maintenance.priorityHigh',
  medium: 'maintenance.priorityMedium',
  low: 'maintenance.priorityLow',
};

interface MaintenanceTaskRowProps {
  task: TaskWithRelative;
  bikeName: string;
  isDark: boolean;
  index: number;
  onPress: () => void;
}

export function MaintenanceTaskRow({
  task,
  bikeName,
  isDark,
  index,
  onPress,
}: MaintenanceTaskRowProps) {
  const { t } = useTranslation();
  const isOverdue = task.relative.isOverdue;
  const isHighPriority = task.priority === 'critical' || task.priority === 'high';

  return (
    <Animated.View entering={FadeInUp.delay(320 + index * 50).duration(300)}>
      <CardWrapper
        tier="subtle"
        style={{
          backgroundColor: isOverdue
            ? isDark
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(239,68,68,0.06)'
            : isDark
              ? palette.cardDark
              : palette.white,
        }}
      >
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: isOverdue ? `${palette.danger500}18` : `${palette.warning500}18`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isOverdue ? (
              <AlertTriangle size={18} color={palette.danger500} strokeWidth={2} />
            ) : (
              <Wrench size={18} color={palette.warning500} strokeWidth={1.5} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: isDark ? palette.neutral400 : palette.neutral500,
                }}
              >
                {bikeName}
              </Text>
              {isHighPriority && (
                <View
                  style={{
                    backgroundColor: `${palette.danger500}18`,
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: palette.danger500 }}>
                    {String(t(PRIORITY_LABEL_KEYS[task.priority] as never))}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: isOverdue ? palette.danger500 : palette.warning500,
              }}
            >
              {String(t(task.relative.key as never, task.relative.params as never))}
            </Text>
          </View>
          <ChevronRight size={16} color={palette.neutral400} strokeWidth={2} />
        </Pressable>

        {/* Overdue dot indicator */}
        {isOverdue && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: palette.danger500,
            }}
          />
        )}
      </CardWrapper>
    </Animated.View>
  );
}
