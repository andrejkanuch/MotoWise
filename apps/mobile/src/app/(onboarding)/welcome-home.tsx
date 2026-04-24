import { CURRENCY_SYMBOLS } from '@motovault/types';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar, DollarSign, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

const FALLBACK_MOTORCYCLE_IMAGE =
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80';

export default function WelcomeHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bikeData = useOnboardingStore((s) => s.bikeData);
  const currency = useOnboardingStore((s) => s.currency);
  const reset = useOnboardingStore((s) => s.reset);
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);

  const bikeLabel = bikeData
    ? [bikeData.year, bikeData.make, bikeData.model].filter(Boolean).join(' ')
    : null;

  const currencySymbol = currency ? (CURRENCY_SYMBOLS[currency] ?? currency) : '$';
  const displayCurrency = currency ?? 'USD';

  const handleOpenGarage = () => {
    setOnboardingCompleted(true);
    reset();
    router.replace('/(tabs)/(home)');
  };

  const previewCards = [
    {
      icon: Calendar,
      iconColor: ONBOARDING_COLORS.warm,
      iconBg: ONBOARDING_COLORS.accentBg,
      title: t('onboarding.nextServiceCard'),
      subtitle: t('onboarding.nextServiceDesc'),
    },
    {
      icon: ShieldCheck,
      iconColor: ONBOARDING_COLORS.success,
      iconBg: `${ONBOARDING_COLORS.success}1A`,
      title: t('onboarding.noRecallsCard'),
      subtitle: bikeData?.make
        ? t('onboarding.noRecallsDesc', { make: bikeData.make })
        : t('onboarding.noRecallsDescDefault'),
    },
    {
      icon: DollarSign,
      iconColor: ONBOARDING_COLORS.warm2,
      iconBg: `${ONBOARDING_COLORS.warm2}1A`,
      title: `${t('onboarding.trackTcoCard')} (${currencySymbol} ${displayCurrency})`,
      subtitle: t('onboarding.trackTcoDesc'),
    },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ONBOARDING_COLORS.background,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingHorizontal: 28,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge */}
        <Animated.View entering={FadeIn.duration(250)} style={{ marginBottom: 16 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: ONBOARDING_COLORS.accentBg,
              borderRadius: 8,
              borderCurve: 'continuous',
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: ONBOARDING_COLORS.warm,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              {t('onboarding.welcomeHomeBadge')}
            </Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 40,
              lineHeight: 44,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.8,
              marginBottom: 8,
            }}
          >
            Welcome home,{'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              rider.
            </Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeIn.delay(150).duration(250)}
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 24,
          }}
        >
          {bikeLabel
            ? t('onboarding.welcomeHomeSubtitle', { bike: bikeLabel })
            : t('onboarding.welcomeHomeSubtitleDefault')}
        </Animated.Text>

        {/* Bike photo hero */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginBottom: 28 }}>
          <View
            style={{
              borderRadius: 20,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}
          >
            <Image
              source={{ uri: bikeData?.photoUri ?? FALLBACK_MOTORCYCLE_IMAGE }}
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              contentFit="cover"
              transition={300}
            />
          </View>
        </Animated.View>

        {/* Preview cards */}
        {previewCards.map((card, index) => (
          <Animated.View
            key={card.title}
            entering={FadeInUp.delay(300 + index * 80).duration(300)}
            style={{
              backgroundColor: ONBOARDING_COLORS.cardBg,
              borderWidth: 1,
              borderColor: ONBOARDING_COLORS.cardBorder,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: 'continuous',
                backgroundColor: card.iconBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <card.icon size={22} color={card.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: ONBOARDING_COLORS.textPrimary,
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {card.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: ONBOARDING_COLORS.textMuted,
                }}
                numberOfLines={1}
              >
                {card.subtitle}
              </Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
          paddingTop: 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <OnboardingContinueButton
          label={t('onboarding.openMyGarage')}
          onPress={handleOpenGarage}
          showIcon={false}
        />
      </View>
    </View>
  );
}
