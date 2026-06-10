import { LastServiceDate, type MileageUnit } from '@motovault/types';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

/** Maps the chip selection to the LastServiceDate store enum. */
const LAST_SERVICE_CHIPS = [
  { id: LastServiceDate.UNDER_1MO, labelKey: 'obServiceUnder1Mo' },
  { id: LastServiceDate.BETWEEN_1_3MO, labelKey: 'obService13Mo' },
  { id: LastServiceDate.BETWEEN_3_6MO, labelKey: 'obService36Mo' },
  { id: LastServiceDate.OVER_6MO, labelKey: 'obServiceOver6Mo' },
  { id: LastServiceDate.UNSURE, labelKey: 'obServiceUnsure' },
] as const;

const UNITS: MileageUnit[] = ['km', 'mi'];

export default function LastServiceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const onBack = useOnboardingBack(OB_SCREEN.LAST_SERVICE);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.LAST_SERVICE);
  const goNext = useOnboardingNext(OB_SCREEN.LAST_SERVICE);
  const measurementSystem = useOnboardingStore((s) => s.preBikeMileageUnit);
  const setLastServiceDate = useOnboardingStore((s) => s.setLastServiceDate);
  const setPreBikeMileage = useOnboardingStore((s) => s.setPreBikeMileage);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [lastService, setLastService] = useState<LastServiceDate | null>(null);
  const [mileage, setMileage] = useState('');
  const [unit, setUnit] = useState<MileageUnit>(measurementSystem ?? 'km');

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.LAST_SERVICE);
  }, []);

  const persist = (service: LastServiceDate | null) => {
    if (service) setLastServiceDate(service);
    const parsed = mileage ? Number.parseInt(mileage, 10) : null;
    setPreBikeMileage(Number.isFinite(parsed) ? parsed : null, unit);
    setLastCompletedScreen(OB_SCREEN.LAST_SERVICE);
  };

  const handleContinue = () => {
    persist(lastService);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.LAST_SERVICE, {
      last_service: lastService ?? 'unset',
      has_mileage: mileage.length > 0,
      mileage_unit: unit,
    });
    goNext();
  };

  const handleSkip = () => {
    persist(lastService ?? LastServiceDate.UNSURE);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.LAST_SERVICE);
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 44,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={24} color={ONBOARDING_COLORS.textPrimary} />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 72, paddingBottom: 200 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
              marginBottom: 12,
            }}
          >
            {t('onboarding.obServiceEyebrow')}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 32,
              lineHeight: 34,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
            }}
          >
            {t('onboarding.obServiceTitle')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.obServiceTitleItalic')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 20,
              marginTop: 10,
              marginBottom: 28,
              maxWidth: 320,
            }}
          >
            {t('onboarding.obServiceWhy')}
          </Text>
        </Animated.View>

        {/* Last service — single-select chips */}
        <Animated.View entering={FadeInUp.delay(120).duration(320)}>
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.textLabel,
              marginBottom: 12,
            }}
          >
            {t('onboarding.obServiceLastLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LAST_SERVICE_CHIPS.map((chip) => {
              const on = lastService === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => {
                    triggerImpact();
                    setLastService(on ? null : chip.id);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 15,
                    borderRadius: 999,
                    borderCurve: 'continuous',
                    backgroundColor: on ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: on ? 'transparent' : ONBOARDING_COLORS.cardBorderDefault,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: '600',
                      color: on ? ONBOARDING_COLORS.textOnAccent : ONBOARDING_COLORS.textBody,
                    }}
                  >
                    {t(`onboarding.${chip.labelKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Current mileage — optional numeric + unit toggle */}
        <Animated.View entering={FadeInUp.delay(190).duration(320)} style={{ marginTop: 26 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: ONBOARDING_COLORS.textLabel,
              }}
            >
              {t('onboarding.obServiceMileageLabel')}
            </Text>
            <Text style={{ fontSize: 11, color: ONBOARDING_COLORS.textMuted }}>
              {t('onboarding.obServiceOptional')}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: ONBOARDING_COLORS.cardBg,
              borderWidth: 1,
              borderColor: ONBOARDING_COLORS.cardBorderDefault,
              borderRadius: 15,
              borderCurve: 'continuous',
              paddingVertical: 6,
              paddingLeft: 16,
              paddingRight: 6,
            }}
          >
            <TextInput
              value={mileage}
              onChangeText={(v) => setMileage(v.replace(/[^0-9]/g, '').slice(0, 7))}
              inputMode="numeric"
              placeholder={t('onboarding.obServiceMileagePlaceholder')}
              placeholderTextColor={ONBOARDING_COLORS.textMuted}
              style={{
                flex: 1,
                fontFamily: 'GeistMono-Medium',
                fontSize: 18,
                color: ONBOARDING_COLORS.textPrimary,
                letterSpacing: 0.4,
                paddingVertical: 10,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: ONBOARDING_COLORS.surface2,
                borderRadius: 11,
                borderCurve: 'continuous',
                padding: 3,
              }}
            >
              {UNITS.map((u) => {
                const on = unit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 9,
                      borderCurve: 'continuous',
                      backgroundColor: on ? ONBOARDING_COLORS.warm : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'GeistMono-Medium',
                        fontSize: 12,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        color: on ? ONBOARDING_COLORS.textOnAccent : ONBOARDING_COLORS.ink3,
                      }}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: ONBOARDING_COLORS.ink3,
              lineHeight: 17,
              marginTop: 10,
            }}
          >
            {t('onboarding.obServiceMileageHint')}
          </Text>
        </Animated.View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: insets.bottom + 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 0.6,
            color: ONBOARDING_COLORS.ink3,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {t('onboarding.obServiceProof')}
        </Text>
        <OnboardingContinueButton label={t('onboarding.continue')} onPress={handleContinue} />
        <Pressable onPress={handleSkip} hitSlop={8} style={{ marginTop: 12, alignSelf: 'center' }}>
          <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.textMuted }}>
            {t('onboarding.obServiceSkip')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
