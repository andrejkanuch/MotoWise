import { palette } from '@motovault/design-system';
import type { PaywallConfig } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { presentPaywall } from '../lib/subscription';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

interface PaywallModalProps {
  visible: boolean;
  config: PaywallConfig;
  onDismiss: () => void;
}

export function PaywallModal({ visible, config, onDismiss }: PaywallModalProps) {
  const insets = useSafeAreaInsets();

  // Track shown + haptic on open
  useEffect(() => {
    if (visible) {
      haptic();
      trackEvent(AnalyticsEvent.PAYWALL_VIEWED, {
        feature: config.feature,
        source: config.source,
      });
    }
  }, [visible, config.feature, config.source]);

  const handleUpgrade = useCallback(async () => {
    haptic();
    trackEvent(AnalyticsEvent.PURCHASE_STARTED, {
      feature: config.feature,
      source: config.source,
    });
    onDismiss();
    const result = await presentPaywall();
    if (result === 'purchased' || result === 'restored') {
      trackEvent(AnalyticsEvent.PURCHASE_COMPLETED, {
        feature: config.feature,
        source: config.source,
      });
    } else if (result === 'cancelled') {
      trackEvent(AnalyticsEvent.PURCHASE_CANCELLED, {
        feature: config.feature,
        source: config.source,
      });
    }
  }, [config.feature, config.source, onDismiss]);

  const handleDismiss = useCallback(() => {
    trackEvent(AnalyticsEvent.PAYWALL_VIEWED, {
      feature: config.feature,
      source: config.source,
      action: 'dismissed',
    });
    onDismiss();
  }, [config.feature, config.source, onDismiss]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surfaceDark,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Close button */}
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: insets.top + 16,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            borderCurve: 'continuous',
            backgroundColor: palette.controlBg,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <X size={20} color={palette.neutral400} strokeWidth={2} />
        </Pressable>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          {/* Title */}
          <Animated.View entering={FadeInUp.duration(280)}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: palette.white,
                textAlign: 'center',
                letterSpacing: -0.5,
                marginBottom: 12,
              }}
            >
              {config.title}
            </Text>
          </Animated.View>

          {/* Value prop bullets */}
          <Animated.View entering={FadeInUp.delay(100).duration(280)} style={{ width: '100%' }}>
            {config.valuePropBullets.map((bullet, index) => (
              <Animated.View
                key={bullet}
                entering={FadeInUp.delay(150 + index * 50).duration(280)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: `${palette.signature500}25`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={16} color={palette.signature500} strokeWidth={2.5} />
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: palette.neutral300,
                    fontWeight: '500',
                    flex: 1,
                  }}
                >
                  {bullet}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Price */}
          <Animated.View entering={FadeIn.delay(350).duration(280)}>
            <Text
              style={{
                fontSize: 14,
                color: palette.neutral400,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {config.price}
            </Text>
          </Animated.View>
        </View>

        {/* CTA buttons */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Pressable
            onPress={handleUpgrade}
            accessibilityRole="button"
            style={{
              backgroundColor: palette.signature500,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
              Start 7-day free trial
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            accessibilityRole="button"
            style={{ alignItems: 'center', paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, color: palette.neutral400, fontWeight: '500' }}>
              Maybe Later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
