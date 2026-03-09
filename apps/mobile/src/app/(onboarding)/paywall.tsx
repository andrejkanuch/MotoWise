import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  Crown,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

const isExpoGo = Constants.appOwnership === 'expo';

function isPurchaseCancellation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'userCancelled' in error) {
    return (error as { userCancelled: boolean }).userCancelled === true;
  }
  return false;
}

const VALUE_PROPS = [
  { icon: Sparkles, key: 'aiDiagnostics' },
  { icon: Crown, key: 'personalizedLearning' },
  { icon: Shield, key: 'maintenanceAlerts' },
] as const;

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);

  useEffect(() => {
    if (isExpoGo) return;
    (async () => {
      try {
        const { default: Purchases } = await import('react-native-purchases');
        const off = await Purchases.getOfferings();
        setOfferings(off.current);
      } catch (e) {
        console.error('[Paywall] Failed to fetch offerings:', e);
      }
    })();
  }, []);

  const annualPrice = offerings?.annual?.product?.priceString ?? '$39.99';
  const monthlyPrice = offerings?.monthly?.product?.priceString ?? '$6.99';

  const bikeName = bikeData ? `${bikeData.year} ${bikeData.make} ${bikeData.model}` : null;

  const handlePurchase = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoading(true);

    try {
      const { default: Purchases } = await import('react-native-purchases');
      const offerings = await Purchases.getOfferings();
      const packageToBuy =
        selectedPlan === 'annual' ? offerings.current?.annual : offerings.current?.monthly;

      if (!packageToBuy) {
        console.error('[Paywall] No package found for plan:', selectedPlan);
        Alert.alert(t('common.error'), t('paywall.packageUnavailable'), [
          { text: t('common.cancel') },
        ]);
        return;
      }

      await Purchases.purchasePackage(packageToBuy);
      router.replace('/(onboarding)/personalizing');
    } catch (error) {
      if (isPurchaseCancellation(error)) {
        // User cancelled — stay on paywall
        return;
      }
      console.error('[Paywall] Purchase failed:', error);
      Alert.alert(t('common.error'), t('paywall.purchaseFailed'), [{ text: t('common.cancel') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const { default: Purchases } = await import('react-native-purchases');
      const info = await Purchases.restorePurchases();
      const hasPro = info.entitlements.active['MotoWise Pro'] !== undefined;
      if (hasPro) {
        router.replace('/(onboarding)/personalizing');
      } else {
        Alert.alert(t('paywall.noSubscriptionFound'), t('paywall.noSubscriptionFoundDesc'), [
          { text: t('common.cancel') },
        ]);
      }
    } catch (error) {
      console.error('[Paywall] Restore failed:', error);
      Alert.alert(t('common.error'), t('paywall.restoreFailed'), [{ text: t('common.cancel') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueFree = () => {
    router.replace('/(onboarding)/personalizing');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={15} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{ alignItems: 'center', marginBottom: 32 }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(250, 204, 21, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Star size={32} color="#FACC15" fill="#FACC15" />
          </View>

          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            {t('paywall.title')}
          </Text>

          {bikeName && (
            <Text
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
              }}
            >
              {t('paywall.personalizedFor', { bike: bikeName })}
            </Text>
          )}
        </Animated.View>

        {/* Value Props */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(300)}
          style={{ gap: 16, marginBottom: 32 }}
        >
          {VALUE_PROPS.map(({ icon: Icon, key }, index) => (
            <Animated.View
              key={key}
              entering={FadeInUp.delay(200 + index * 80).duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color="#818CF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                  {t(`paywall.feature${key}Title`)}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {t(`paywall.feature${key}Desc`)}
                </Text>
              </View>
              <Check size={18} color="#34D399" />
            </Animated.View>
          ))}
        </Animated.View>

        {/* Pricing Cards */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(300)}
          style={{ gap: 12, marginBottom: 24 }}
        >
          {/* Annual Card */}
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setSelectedPlan('annual');
            }}
            style={{
              borderWidth: selectedPlan === 'annual' ? 2 : 1.5,
              borderColor: selectedPlan === 'annual' ? '#818CF8' : 'rgba(255,255,255,0.15)',
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 20,
              backgroundColor:
                selectedPlan === 'annual' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              position: 'relative',
              overflow: 'visible',
            }}
          >
            {/* Best Value Badge */}
            <Animated.View
              entering={ZoomIn.duration(200).springify()}
              style={{
                position: 'absolute',
                top: -12,
                right: 16,
                backgroundColor: '#FACC15',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
                borderCurve: 'continuous',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>
                {t('paywall.bestValue')}
              </Text>
            </Animated.View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                  {t('paywall.annual')}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {t('paywall.annualTrialDays', { days: 7 })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
                  {annualPrice}
                  <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' }}>
                    /{t('paywall.year')}
                  </Text>
                </Text>
                <Text style={{ fontSize: 13, color: '#34D399', marginTop: 2 }}>
                  $3.33/{t('paywall.month')}
                </Text>
              </View>
            </View>

            {/* Selected indicator */}
            <View
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                width: 22,
                height: 22,
                borderRadius: 11,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderColor: selectedPlan === 'annual' ? '#818CF8' : 'rgba(255,255,255,0.3)',
                backgroundColor: selectedPlan === 'annual' ? '#818CF8' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedPlan === 'annual' && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
          </Pressable>

          {/* Monthly Card */}
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setSelectedPlan('monthly');
            }}
            style={{
              borderWidth: selectedPlan === 'monthly' ? 2 : 1.5,
              borderColor: selectedPlan === 'monthly' ? '#818CF8' : 'rgba(255,255,255,0.15)',
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 20,
              backgroundColor:
                selectedPlan === 'monthly' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                  {t('paywall.monthly')}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {t('paywall.monthlyTrialDays', { days: 3 })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
                  {monthlyPrice}
                  <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' }}>
                    /{t('paywall.month')}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Selected indicator */}
            <View
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                width: 22,
                height: 22,
                borderRadius: 11,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderColor: selectedPlan === 'monthly' ? '#818CF8' : 'rgba(255,255,255,0.3)',
                backgroundColor: selectedPlan === 'monthly' ? '#818CF8' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedPlan === 'monthly' && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
          </Pressable>
        </Animated.View>

        {/* Trust Signals */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(300)}
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 24,
            marginBottom: 28,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {t('paywall.cancelAnytime')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Shield size={16} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {t('paywall.noChargeDuringTrial')}
            </Text>
          </View>
        </Animated.View>

        {/* CTA Button */}
        <Animated.View entering={FadeInUp.delay(600).duration(300)}>
          {isExpoGo ? (
            <Pressable
              onPress={() => router.replace('/(onboarding)/personalizing')}
              style={({ pressed }) => ({
                backgroundColor: '#FACC15',
                borderRadius: 20,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
                {t('paywall.skipDevMode')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handlePurchase}
              disabled={isLoading}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
                    {t('paywall.startFreeTrial')}
                  </Text>
                  <ChevronRight size={18} color="#0F172A" />
                </>
              )}
            </Pressable>
          )}
        </Animated.View>

        {/* Restore Purchases */}
        {!isExpoGo && (
          <Animated.View entering={FadeInUp.delay(650).duration(300)} style={{ marginTop: 16 }}>
            <Pressable
              onPress={handleRestore}
              disabled={isLoading}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>
                {t('paywall.restorePurchases')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Continue with Free */}
        <Animated.View entering={FadeInUp.delay(700).duration(300)} style={{ marginTop: 12 }}>
          <Pressable
            onPress={handleContinueFree}
            disabled={isLoading}
            style={{ alignItems: 'center', paddingVertical: 8, opacity: isLoading ? 0.3 : 1 }}
          >
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              {t('paywall.continueWithFree')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Terms & Privacy */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <Pressable onPress={() => Linking.openURL('https://motowise.app/terms')}>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                textDecorationLine: 'underline',
              }}
            >
              Terms of Service
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://motowise.app/privacy')}>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                textDecorationLine: 'underline',
              }}
            >
              Privacy Policy
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
