import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import type { TaskDue } from '../../../lib/bike-hub/task-due';
import type { HubTask } from '../shell/use-bike-hub-data';
import { DueLine, describeDue } from '../ui/due-line';
import { PriorityTag } from '../ui/priority-tag';
import { SectionHeader } from '../ui/section-header';
import { PRIORITY_TAG } from '../ui/tokens';
import { AttentionRow } from './attention-row';

interface NextUpProps {
  entry: { task: Pick<HubTask, 'id' | 'title' | 'priority'>; due: TaskDue } | null;
  unit: HubUnit;
  make: string;
  onPress: (taskId: string) => void;
}

/** The nearest upcoming task. Hidden when there is none. */
export function NextUp({ entry, unit, make, onPress }: NextUpProps) {
  const { t, i18n } = useTranslation();
  if (!entry) return null;
  const { task, due } = entry;
  const copy = describeDue(due, { t, unit, language: i18n.language, scheduleName: make });
  return (
    <View testID="next-up" style={{ gap: 8 }}>
      <SectionHeader label={t('bikeHub.nextUp.title')} />
      <AttentionRow
        testID={`next-up-${task.id}`}
        title={task.title}
        sub={<DueLine due={due} unit={unit} scheduleName={make} />}
        trailing={<PriorityTag priority={task.priority} />}
        accessibilityLabel={[
          task.title,
          copy.primary,
          copy.secondary,
          t(PRIORITY_TAG[task.priority].labelKey),
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={() => onPress(task.id)}
      />
    </View>
  );
}
