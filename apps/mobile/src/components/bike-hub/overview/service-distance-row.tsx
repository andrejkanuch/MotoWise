import { Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { HubUnit } from '@/lib/bike-hub/constants';
import { formatOdometer } from '@/lib/bike-hub/format';
import type { ServiceDistance } from '@/lib/bike-hub/service-distance';
import { HubCard } from '../ui/hub-card';
import { ListRow } from '../ui/list-row';
import { useHubTheme } from '../ui/tokens';

interface ServiceDistanceRowProps {
  /** `null` when the bike has no logged service. */
  since: ServiceDistance | null;
  unit: HubUnit;
  /** Opens the Service segment. */
  onPress: () => void;
}

/** "1,250 km since last service", or "No service logged". Free for every rider. */
export function ServiceDistanceRow({ since, unit, onPress }: ServiceDistanceRowProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();
  const title = since
    ? t('bikeHub.serviceDistance.since', {
        distance: formatOdometer(since.distance, i18n.language),
        unit,
      })
    : t('bikeHub.serviceDistance.none');
  const sub = since
    ? t('bikeHub.serviceDistance.servicedAt', {
        distance: formatOdometer(since.serviceOdometer, i18n.language),
        unit,
      })
    : undefined;
  return (
    <View testID="service-distance-row">
      <HubCard style={{ overflow: 'hidden' }}>
        <ListRow
          icon={{ icon: Wrench, color: hub.dim, background: hub.raised }}
          title={title}
          sub={sub}
          accessibilityLabel={sub ? `${title}. ${sub}` : title}
          divider={false}
          onPress={onPress}
        />
      </HubCard>
    </View>
  );
}
