import { palette } from '@motovault/design-system';
import { mileageFromDisplayUnit, mileageToDisplayUnit } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';

interface MileageDisplayProps {
  currentMileage?: number;
  mileageUnit?: string;
  mileageUpdatedAt?: string;
  isDark: boolean;
  onUpdate: (newMileage: number) => void;
}

export function MileageDisplay({
  currentMileage,
  mileageUnit = 'mi',
  mileageUpdatedAt,
  isDark,
  onUpdate,
}: MileageDisplayProps) {
  const { t } = useTranslation();
  const system = useMeasurementSystem();
  // `currentMileage` is stored in canonical km; convert to the user's unit for display/prefill.
  const displayMileage =
    currentMileage != null ? mileageToDisplayUnit(currentMileage, system) : null;

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

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.prompt(
      t('bikeHub.updateMileage', { defaultValue: 'Update Mileage' }),
      t('bikeHub.enterCurrentMileage', {
        defaultValue: `Enter current odometer reading (${mileageUnit})`,
        unit: mileageUnit,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.save', { defaultValue: 'Save' }),
          onPress: (value: string | undefined) => {
            // The user types in their display unit; persist canonical km via onUpdate.
            const num = Number.parseInt(value ?? '', 10);
            if (Number.isNaN(num) || num < 0) return;
            const km = Math.round(mileageFromDisplayUnit(num, system));
            // Compare in display space so the warning matches what the user sees.
            if (displayMileage != null && num < displayMileage) {
              Alert.alert(
                t('bikeHub.mileageWarning', { defaultValue: 'Lower mileage?' }),
                t('bikeHub.mileageWarningMessage', {
                  defaultValue: 'The new reading is lower than current. Are you sure?',
                }),
                [
                  { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
                  {
                    text: t('common.confirm', { defaultValue: 'Confirm' }),
                    onPress: () => onUpdate(km),
                  },
                ],
              );
              return;
            }
            onUpdate(km);
          },
        },
      ],
      'plain-text',
      displayMileage != null ? Math.round(displayMileage).toString() : '',
      'number-pad',
    );
  };

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(300)}>
      <Pressable
        onPress={handlePress}
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
            {displayMileage != null
              ? `${Math.round(displayMileage).toLocaleString()} ${mileageUnit}`
              : t('bikeHub.noMileage', { defaultValue: 'No mileage' })}
          </Text>
          <Text style={{ fontSize: 11, color: palette.neutral500 }}>{getLastUpdatedText()}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
