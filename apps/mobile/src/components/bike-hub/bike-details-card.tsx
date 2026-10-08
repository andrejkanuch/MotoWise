import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { triggerImpact } from '../../utils/haptics';
import { HubCard } from './ui/hub-card';
import { HUB_FONT, HUB_TOUCH_TARGET, hub } from './ui/tokens';

/** Chevron turn when the card opens: a disclosure, not a push. */
const DISCLOSURE_MS = 180;

/** The subset of a motorcycle this card renders. */
export interface BikeDetailsCardBike {
  make: string;
  model: string;
  year: number;
  nickname?: string | null;
  isPrimary?: boolean | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
}

interface InfoRowProps {
  label: string;
  value: string;
  /** Numbers, money and dates are set in mono. */
  mono?: boolean;
  divider: boolean;
}

function InfoRow({ label, value, mono = false, divider }: InfoRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        columnGap: 12,
        rowGap: 2,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: hub.hairline,
      }}
    >
      <Text style={{ fontFamily: HUB_FONT.sans, fontSize: 14, lineHeight: 19, color: hub.dim }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          flexShrink: 1,
          textAlign: 'right',
          fontFamily: mono ? HUB_FONT.mono : HUB_FONT.sansSemiBold,
          fontSize: 14,
          lineHeight: 19,
          color: hub.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Collapsible "Details" card for the bike hub — make/model/year, nickname,
 * primary flag and purchase info. Owns its own expand state; formats money in
 * the user's display currency. The header is a disclosure: its chevron points
 * down and turns over when the card opens in place.
 */
export function BikeDetailsCard({ bike }: { bike: BikeDetailsCardBike }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: DISCLOSURE_MS });
  }, [open, turn]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  const rows: Omit<InfoRowProps, 'divider'>[] = [
    { label: t('garage.make'), value: bike.make },
    { label: t('garage.model'), value: bike.model },
    { label: t('garage.year'), value: String(bike.year), mono: true },
    ...(bike.nickname ? [{ label: t('garage.nickname'), value: bike.nickname }] : []),
    { label: t('garage.primary'), value: bike.isPrimary ? t('common.yes') : t('common.no') },
    ...(bike.purchasePrice != null
      ? [
          {
            label: t('garage.purchasePrice'),
            value: formatCurrency(bike.purchasePrice),
            mono: true,
          },
        ]
      : []),
    ...(bike.purchaseDate
      ? [
          {
            label: t('garage.purchaseDate'),
            value: new Date(bike.purchaseDate).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            mono: true,
          },
        ]
      : []),
  ];

  return (
    <HubCard style={{ overflow: 'hidden' }}>
      <Pressable
        testID="bike-details-toggle"
        onPress={() => {
          triggerImpact();
          setOpen((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          minHeight: HUB_TOUCH_TARGET + 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 12,
          paddingLeft: 14,
          paddingRight: 12,
          borderBottomWidth: open ? 1 : 0,
          borderBottomColor: hub.hairline,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: HUB_FONT.sansSemiBold,
            fontSize: 15,
            lineHeight: 18,
            color: hub.text,
          }}
        >
          {t('garage.tab_details')}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={hub.muted} strokeWidth={2} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)}>
          {rows.map((row, index) => (
            <InfoRow key={row.label} {...row} divider={index < rows.length - 1} />
          ))}
        </Animated.View>
      ) : null}
    </HubCard>
  );
}
