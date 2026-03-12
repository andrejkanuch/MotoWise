import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Crown,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent, trackScreen } from '../../../lib/analytics';
import { useSubscriptionStore } from '../../../stores/subscription.store';

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

type PurchasesOfferings = Awaited<
  ReturnType<typeof import('react-native-purchases').default.getOfferings>
>;

function PricingCard({
  plan,
  selected,
  price,
  trialDays,
  monthlyEquiv,
  badge,
  onSelect,
}: {
  plan: 'annual' | 'monthly';
  selected: boolean;
  price: string;
  trialDays: number;
  monthlyEquiv?: string;
  badge?: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const periodKey = plan === 'annual' ? 'year' : 'month';
  const trialKey = plan === 'annual' ? 'annualTrialDays' : 'monthlyTrialDays';

  return (
    <Pressable
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onSelect();
      }}
      style={{
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? '#818CF8' : 'rgba(255,255,255,0.15)',
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 20,
        backgroundColor: selected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
        position: 'relative',
        overflow: 'visible',
        ...(process.env.EXPO_OS === 'ios'
          ? {
              shadowColor: selected ? '#818CF8' : '#000',
              shadowOffset: { width: 0, height: selected ? 0 : 1 },
              shadowOpacity: selected ? 0.2 : 0.15,
              shadowRadius: selected ? 10 : 3,
            }
          : { elevation: selected ? 4 : 2 }),
      }}
    >
      {badge && (
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
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>{badge}</Text>
        </Animated.View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
            {t(`paywall.${plan}`)}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {t(`paywall.${trialKey}`, { days: trialDays })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
            {price}
            <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' }}>
              /{t(`paywall.${periodKey}`)}
            </Text>
          </Text>
          {monthlyEquiv && (
            <Text style={{ fontSize: 13, color: '#34D399', marginTop: 2 }}>
              {monthlyEquiv}/{t('paywall.month')}
            </Text>
          )}
        </View>
      </View>

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
          borderColor: selected ? '#818CF8' : 'rgba(255,255,255,0.3)',
          backgroundColor: selected ? '#818CF8' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

export default function UpgradeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(!isExpoGo);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // If already pro, go back
  useEffect(() => {
    if (isPro) {
      router.back();
    }
  }, [isPro, router]);

  // Track screen view and paywall impression
  useEffect(() => {
    trackScreen('Upgrade');
    trackEvent(AnalyticsEvent.PAYWALL_VIEWED);
  }, []);

  const fetchOfferings = useCallback(async () => {
    if (isExpoGo) return;
    setOfferingsLoading(true);
    setFetchError(null);
    try {
      const { default: Purchases } = await import('react-native-purchases');
      const result = await Purchases.getOfferings();
      setOfferings(result);
    } catch (error) {
      console.error('[Upgrade] Failed to load offerings:', error);
      setFetchError(
        error instanceof Error ? error.message : 'Failed to load subscription options.',
      );
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const annualPackage = offerings?.current?.annual;
  const monthlyPackage = offerings?.current?.monthly;
  const annualPrice = annualPackage?.product.priceString;
  const monthlyPrice = monthlyPackage?.product.priceString;
  const annualMonthlyEquiv =
    annualPackage?.product.price != null
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: annualPackage.product.currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(annualPackage.product.price / 12)
      : undefined;

  const handlePurchase = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoading(true);
    try {
      const { default: Purchases } = await import('react-native-purchases');
      let currentOfferings = offerings;
      if (!currentOfferings) {
        currentOfferings = await Purchases.getOfferings();
        setOfferings(currentOfferings);
      }
      const packageToBuy =
        selectedPlan === 'annual'
          ? currentOfferings.current?.annual
          : currentOfferings.current?.monthly;
      if (!packageToBuy) {
        Alert.alert(t('common.error'), t('paywall.packageUnavailable'), [
          { text: t('common.cancel') },
        ]);
        return;
      }
      trackEvent(AnalyticsEvent.PURCHASE_STARTED, { packageId: selectedPlan });
      await Purchases.purchasePackage(packageToBuy);
      trackEvent(AnalyticsEvent.PURCHASE_COMPLETED);
      router.back();
    } catch (error) {
      if (isPurchaseCancellation(error)) {
        trackEvent(AnalyticsEvent.PURCHASE_CANCELLED);
        return;
      }
      console.error('[Upgrade] Purchase failed:', error);
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
      const hasPro = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
      if (hasPro) {
        router.back();
      } else {
        Alert.alert(t('paywall.noSubscriptionFound'), t('paywall.noSubscriptionFoundDesc'), [
          { text: t('common.cancel') },
        ]);
      }
    } catch (error) {
      console.error('[Upgrade] Restore failed:', error);
      Alert.alert(t('common.error'), t('paywall.restoreFailed'), [{ text: t('common.cancel') }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
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
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
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
          {offeringsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#818CF8" />
            </View>
          ) : fetchError ? (
            <View
              style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 12 }}
            >
              <AlertCircle size={32} color="rgba(255,255,255,0.5)" />
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                {fetchError}
              </Text>
              <Pressable
                onPress={fetchOfferings}
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#818CF8' }}>
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {annualPrice && (
                <PricingCard
                  plan="annual"
                  selected={selectedPlan === 'annual'}
                  price={annualPrice}
                  trialDays={7}
                  monthlyEquiv={annualMonthlyEquiv}
                  badge={t('paywall.bestValue')}
                  onSelect={() => setSelectedPlan('annual')}
                />
              )}
              {monthlyPrice && (
                <PricingCard
                  plan="monthly"
                  selected={selectedPlan === 'monthly'}
                  price={monthlyPrice}
                  trialDays={3}
                  onSelect={() => setSelectedPlan('monthly')}
                />
              )}
            </>
          )}
        </Animated.View>

        {/* Trust Signals */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(300)}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 28 }}
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
              onPress={() => router.back()}
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
              disabled={isLoading || offeringsLoading || !!fetchError}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: isLoading || offeringsLoading || fetchError ? 0.5 : pressed ? 0.85 : 1,
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

        {/* Terms & Privacy */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <Pressable onPress={() => Linking.openURL('https://motovault.app/terms')}>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                textDecorationLine: 'underline',
              }}
            >
              {t('onboarding.termsOfService')}
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://motovault.app/privacy')}>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                textDecorationLine: 'underline',
              }}
            >
              {t('onboarding.privacyPolicy')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
