import { palette } from '@motovault/design-system';
import { MileageUnit, MotorcycleType } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, SkipForward } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const currentYear = new Date().getFullYear();
const defaultYear = String(currentYear - 3);

export default function BikeYearScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);

  const [year, setYear] = useState(
    existingBikeData?.year ? String(existingBikeData.year) : defaultYear,
  );

  const yearNum = Number.parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1970 && yearNum <= currentYear + 1;

  const handleContinue = () => {
    if (!isValidYear) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBikeData({
      ...(existingBikeData ?? {
        make: '',
        makeId: 0,
        model: '',
        type: MotorcycleType.STANDARD,
        currentMileage: 0,
        mileageUnit: MileageUnit.MI,
      }),
      year: yearNum,
    });
    router.replace('/(onboarding)/bike-make');
  };

  const handleSkip = () => {
    router.replace('/(onboarding)/riding-frequency');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={2} totalScreens={TOTAL_SCREENS} />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 48,
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Animated.Text
            entering={FadeInDown.duration(300)}
            style={{
              fontSize: 36,
              fontWeight: '800',
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.5,
              marginBottom: 12,
            }}
          >
            {t('onboarding.bikeYearTitle')}
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(100).duration(300)}
            style={{
              fontSize: 17,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 24,
              marginBottom: 40,
            }}
          >
            {t('onboarding.bikeYearSubtitle')}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Calendar size={18} color={ONBOARDING_COLORS.textMuted} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: ONBOARDING_COLORS.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('onboarding.yearPlaceholder')}
              </Text>
            </View>
            <TextInput
              value={year}
              onChangeText={setYear}
              placeholder={t('onboarding.yearPlaceholder')}
              placeholderTextColor={ONBOARDING_COLORS.textDimmed}
              keyboardType="number-pad"
              maxLength={4}
              style={{
                backgroundColor: ONBOARDING_COLORS.cardBg,
                borderWidth: 1,
                borderColor: isValidYear
                  ? `${ONBOARDING_COLORS.accent}80`
                  : ONBOARDING_COLORS.cardBorder,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 20,
                fontSize: 32,
                fontWeight: '700',
                color: ONBOARDING_COLORS.textPrimary,
                textAlign: 'center',
                letterSpacing: 4,
              }}
            />
            {year.length === 4 && !isValidYear && (
              <Text
                style={{
                  fontSize: 14,
                  color: palette.danger500,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                {t('onboarding.bikeYearInvalid')}
              </Text>
            )}
          </Animated.View>
        </View>

        <View style={{ paddingBottom: 48, gap: 12 }}>
          <Animated.View entering={FadeInUp.delay(300).duration(300)}>
            <Pressable
              onPress={handleContinue}
              disabled={!isValidYear}
              style={({ pressed }) => ({
                backgroundColor: isValidYear
                  ? ONBOARDING_COLORS.textPrimary
                  : ONBOARDING_COLORS.textMuted,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: isValidYear ? ONBOARDING_COLORS.background : ONBOARDING_COLORS.textMuted,
                }}
              >
                {t('onboarding.continue')}
              </Text>
              <ChevronRight
                size={20}
                color={isValidYear ? ONBOARDING_COLORS.background : ONBOARDING_COLORS.textMuted}
              />
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => ({
              paddingVertical: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SkipForward size={16} color={ONBOARDING_COLORS.textMuted} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: ONBOARDING_COLORS.textMuted,
              }}
            >
              {t('onboarding.skipBikeSetup')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
