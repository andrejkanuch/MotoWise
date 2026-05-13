import { palette } from '@motovault/design-system';
import { Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface MileageDisplayProps {
  currentMileage?: number;
  mileageUnit?: string;
  mileageUpdatedAt?: string;
  isDark: boolean;
}

export function MileageDisplay({
  currentMileage,
  mileageUnit = 'mi',
  mileageUpdatedAt,
  isDark,
}: MileageDisplayProps) {
  const { t } = useTranslation();

  const getLastUpdatedText = () => {
    if (!mileageUpdatedAt) return t('bikeHub.neverUpdated', { defaultValue: 'Never updated' });
    const diff = Date.now() - new Date(mileageUpdatedAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t('bikeHub.updatedToday', { defaultValue: 'Updated today' });
    if (days === 1) return t('bikeHub.updatedYesterday', { defaultValue: 'Updated yesterday' });
    return t('bikeHub.updatedDaysAgo', {
      defaultValue: `Updated ${days}d ago`,
      days,
    });
  };

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(300)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
          borderRadius: 10,
          borderCurve: 'continuous',
          alignSelf: 'flex-start',
        }}
      >
        <Gauge size={16} color={palette.primary500} strokeWidth={2} />
        <View>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {currentMileage != null
              ? `${currentMileage.toLocaleString()} ${mileageUnit}`
              : t('bikeHub.noMileage', { defaultValue: 'No mileage' })}
          </Text>
          <Text style={{ fontSize: 11, color: palette.neutral500 }}>{getLastUpdatedText()}</Text>
        </View>
      </View>
    </Animated.View>
  );
}
