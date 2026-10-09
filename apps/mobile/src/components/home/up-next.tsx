import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { DUE_STATE, type DueState, type HubUnit } from '../../lib/bike-hub/constants';
import { useEditorialTheme } from '../../theme/editorial';
import { space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { describeDue } from '../bike-hub/ui/due-line';
import { ESettingsGroup, ESettingsRow } from '../ui/editorial';
import type { RankedHomeTask } from './home-plate';

/** Rows shown before "See all" hands over to the bike's Service segment. */
export const UP_NEXT_MAX_ROWS = 3;

const DOT_SIZE = 8;

interface UpNextProps {
  tasks: readonly RankedHomeTask[];
  /** The rider's unit — a label only, nothing is converted. */
  unit: HubUnit;
  onOpenTask: (taskId: string) => void;
  onSeeAll: () => void;
}

/** "Up next": the active bike's nearest tasks as native inset rows. */
export function UpNext({ tasks, unit, onOpenTask, onSeeAll }: UpNextProps) {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const dotColor: Partial<Record<DueState, string>> = {
    [DUE_STATE.OVERDUE]: theme.overdueInk,
    [DUE_STATE.SOON]: theme.dueInk,
  };

  return (
    <View style={{ gap: space.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
        }}
      >
        <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
          {t('home.upNext')}
        </Text>
        <Pressable
          onPress={() => {
            triggerImpact();
            onSeeAll();
          }}
          accessibilityRole="link"
          hitSlop={12}
        >
          <Text style={[type.label, { color: theme.warm2 }]}>{t('home.seeAll')}</Text>
        </Pressable>
      </View>

      <ESettingsGroup testID="home-up-next">
        {tasks.slice(0, UP_NEXT_MAX_ROWS).map(({ task, due }) => {
          const copy = describeDue(due, { t, unit, language: i18n.language });
          const subtitle = copy.secondary ? `${copy.primary} · ${copy.secondary}` : copy.primary;
          const color = dotColor[due.state];
          return (
            <ESettingsRow
              key={task.id}
              title={task.title}
              subtitle={subtitle}
              onPress={() => onOpenTask(task.id)}
              accessibilityLabel={`${task.title}, ${subtitle}`}
              badge={
                color ? (
                  <View
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: DOT_SIZE / 2,
                      backgroundColor: color,
                    }}
                  />
                ) : null
              }
            />
          );
        })}
      </ESettingsGroup>
    </View>
  );
}
