import type { Currency } from '@motovault/types';
import type { TFunction } from 'i18next';
import { Bike, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useCurrency } from '@/hooks/use-currency';
import type { DocumentSignal } from '@/lib/bike-hub/documents';
import { formatMonthYear } from '@/lib/bike-hub/format';
import type { HubBike } from '../shell/use-bike-hub-data';
import { HubCard } from '../ui/hub-card';
import { ListRow } from '../ui/list-row';
import { SectionHeader } from '../ui/section-header';
import { SYSTEM_WEIGHT, useHubTheme } from '../ui/tokens';

const SEPARATOR = ' · ';

/** The most urgent document signal as words: "Insurance expires in 12 days". */
function signalCopy(signal: DocumentSignal, t: TFunction): string {
  const category = signal.categoryName ?? t('documents.uncategorized');
  if (signal.expired) return t('bikeHub.rideStatus.reason.documentExpired', { category });
  if (signal.days === 0) return t('bikeHub.rideStatus.reason.documentExpiresToday', { category });
  return t('bikeHub.rideStatus.reason.documentExpiresIn', { category, count: signal.days });
}

/** The parts that exist of [variant, "bought June 2022", purchase price]. */
export function bikeFacts(
  bike: Pick<HubBike, 'variant' | 'purchaseDate' | 'purchasePrice'>,
  t: TFunction,
  language: string,
  currency: Currency,
): string {
  const price =
    bike.purchasePrice != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(bike.purchasePrice)
      : null;
  return [
    bike.variant?.trim() || null,
    bike.purchaseDate
      ? t('bikeHub.papers.bought', { date: formatMonthYear(bike.purchaseDate, language) })
      : null,
    price,
  ]
    .filter((part): part is string => !!part)
    .join(SEPARATOR);
}

interface PapersBikeRowsProps {
  bike: HubBike;
  /** Expired or expiring documents, most urgent first. */
  documentSignals: readonly DocumentSignal[];
  documentCount: number;
  /** Both rows open the Bike segment. */
  onPress: () => void;
}

/** "Papers & bike": the documents row with its most urgent signal, and the bike row. */
export function PapersBikeRows({
  bike,
  documentSignals,
  documentCount,
  onPress,
}: PapersBikeRowsProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();
  const urgent = documentSignals[0];
  const stored = t('bikeHub.papers.stored', { count: documentCount });
  const documentsSub =
    documentCount === 0 ? (
      t('bikeHub.papers.empty')
    ) : urgent ? (
      <Text numberOfLines={2} style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 16 }}>
        <Text style={{ color: urgent.expired ? hub.late : hub.soon }}>{signalCopy(urgent, t)}</Text>
        <Text style={{ color: hub.muted }}>
          {SEPARATOR}
          {stored}
        </Text>
      </Text>
    ) : (
      stored
    );
  const facts = bikeFacts(bike, t, i18n.language, currency);

  return (
    <View testID="papers-bike-rows" style={{ gap: 8 }}>
      <SectionHeader label={t('bikeHub.papers.title')} />
      <HubCard style={{ overflow: 'hidden' }}>
        <ListRow
          testID="papers-documents-row"
          icon={{ icon: FileText, color: hub.dim, background: hub.raised }}
          title={t('documents.title')}
          sub={documentsSub}
          accessibilityLabel={`${t('documents.title')}. ${urgent ? `${signalCopy(urgent, t)}. ` : ''}${
            documentCount > 0 ? stored : t('bikeHub.papers.empty')
          }`}
          onPress={onPress}
        />
        <ListRow
          testID="papers-bike-row"
          icon={{ icon: Bike, color: hub.dim, background: hub.raised }}
          title={`${bike.year} ${bike.make} ${bike.model}`}
          sub={facts || undefined}
          divider={false}
          onPress={onPress}
        />
      </HubCard>
    </View>
  );
}
