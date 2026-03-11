import { palette } from '@motolearn/design-system';
import { CheckCircle2, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';
import type { TaskWithRelative } from './home-types';
import { MaintenanceTaskRow } from './maintenance-task-row';
import { SectionHeader } from './section-header';

interface MaintenanceSummaryProps {
  tasks: TaskWithRelative[];
  bikeNames: Record<string, string>;
  isDark: boolean;
  onViewAll: () => void;
  onTaskPress: (motorcycleId: string) => void;
}

export function MaintenanceSummary({
  tasks,
  bikeNames,
  isDark,
  onViewAll,
  onTaskPress,
}: MaintenanceSummaryProps) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(280).duration(300)}>
      <SectionHeader
        icon={Wrench}
        iconColor={palette.warning500}
        title={t('maintenance.alertsTitle')}
        badgeCount={tasks.length}
        badgeColor={palette.warning500}
        actionLabel={tasks.length > 0 ? t('maintenance.viewAll') : undefined}
        onActionPress={tasks.length > 0 ? onViewAll : undefined}
        isDark={isDark}
      />

      {tasks.length === 0 ? (
        <CardWrapper
          tier="subtle"
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: isDark ? palette.neutral700 : palette.neutral200,
          }}
        >
          <View
            style={{
              padding: 20,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={36} color={palette.success500} strokeWidth={1.5} />
            <Text
              style={{
                fontSize: 14,
                color: palette.neutral500,
                fontWeight: '500',
                textAlign: 'center',
              }}
            >
              {t('maintenance.alertsEmpty')}
            </Text>
          </View>
        </CardWrapper>
      ) : (
        <View style={{ gap: 8 }}>
          {tasks.map((task, index) => (
            <MaintenanceTaskRow
              key={task.id}
              task={task}
              bikeName={bikeNames[task.motorcycleId] ?? ''}
              isDark={isDark}
              index={index}
              onPress={() => onTaskPress(task.motorcycleId)}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}
