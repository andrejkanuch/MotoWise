import { CalendarDays, FileText, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { HubCard } from '../ui/hub-card';
import { ListRow } from '../ui/list-row';
import { SectionHeader } from '../ui/section-header';
import { hub } from '../ui/tokens';

interface SetupListProps {
  make: string;
  unit: HubUnit;
  onImportSchedule: () => void;
  isImporting: boolean;
  onLogPastWork: () => void;
  onAddDocument: () => void;
}

/** "Set this bike up" — shown only while nothing is tracked on the bike. */
export function SetupList({
  make,
  unit,
  onImportSchedule,
  isImporting,
  onLogPastWork,
  onAddDocument,
}: SetupListProps) {
  const { t } = useTranslation();
  return (
    <View testID="setup-list" style={{ gap: 8 }}>
      <SectionHeader label={t('bikeHub.setup.title')} />
      <HubCard style={{ overflow: 'hidden' }}>
        <ListRow
          testID="setup-import"
          icon={{ icon: CalendarDays, color: hub.copperText, background: hub.raised }}
          title={t('bikeHub.setup.import', { make })}
          sub={t('bikeHub.setup.importSub', { unit })}
          busy={isImporting}
          onPress={onImportSchedule}
        />
        <ListRow
          testID="setup-log-work"
          icon={{ icon: Wrench, color: hub.dim, background: hub.raised }}
          title={t('bikeHub.setup.logWork')}
          sub={t('bikeHub.setup.logWorkSub')}
          onPress={onLogPastWork}
        />
        <ListRow
          testID="setup-documents"
          icon={{ icon: FileText, color: hub.dim, background: hub.raised }}
          title={t('bikeHub.setup.documents')}
          sub={t('bikeHub.setup.documentsSub')}
          divider={false}
          onPress={onAddDocument}
        />
      </HubCard>
    </View>
  );
}
