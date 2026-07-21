import { palette } from '@motovault/design-system';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

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

function InfoRow({ label, value }: { label: string; value: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.line,
      }}
    >
      <Text style={{ fontSize: 14, color: theme.ink3 }}>{label}</Text>
      <Text selectable style={{ fontSize: 15, fontWeight: '600', color: theme.ink }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Collapsible "Details" card for the bike hub — make/model/year, nickname,
 * primary flag and purchase info. Owns its own expand state; formats money in
 * the user's display currency.
 */
export function BikeDetailsCard({
  bike,
  delay = 300,
}: {
  bike: BikeDetailsCardBike;
  delay?: number;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { format: formatCurrency } = useCurrency();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{ paddingHorizontal: 20, marginTop: 20 }}
    >
      <Pressable
        onPress={() => {
          triggerImpact();
          setShowDetails((prev) => !prev);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: theme.surface,
          borderRadius: showDetails ? 0 : 16,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderCurve: 'continuous',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }}>
          {t('garage.tab_details', { defaultValue: 'Details' })}
        </Text>
        <Animated.View style={{ transform: [{ rotate: showDetails ? '0deg' : '-90deg' }] }}>
          <ChevronDown size={18} color={palette.neutral400} />
        </Animated.View>
      </Pressable>
      {showDetails && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View
            style={{
              backgroundColor: theme.surface,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              paddingBottom: 16,
            }}
          >
            <InfoRow label={t('garage.make', { defaultValue: 'Make' })} value={bike.make} />
            <InfoRow label={t('garage.model', { defaultValue: 'Model' })} value={bike.model} />
            <InfoRow label={t('garage.year', { defaultValue: 'Year' })} value={String(bike.year)} />
            {bike.nickname && (
              <InfoRow
                label={t('garage.nickname', { defaultValue: 'Nickname' })}
                value={bike.nickname}
              />
            )}
            <InfoRow
              label={t('garage.primary', { defaultValue: 'Primary' })}
              value={
                bike.isPrimary
                  ? t('common.yes', { defaultValue: 'Yes' })
                  : t('common.no', { defaultValue: 'No' })
              }
            />
            {bike.purchasePrice != null && (
              <InfoRow
                label={t('garage.purchasePrice', { defaultValue: 'Purchase Price' })}
                value={formatCurrency(bike.purchasePrice)}
              />
            )}
            {bike.purchaseDate && (
              <InfoRow
                label={t('garage.purchaseDate', { defaultValue: 'Purchase Date' })}
                value={new Date(bike.purchaseDate).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
            )}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
