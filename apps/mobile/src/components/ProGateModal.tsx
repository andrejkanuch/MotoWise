import { palette } from '@motolearn/design-system';
import type { ProFeature } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Crown, Sparkles, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURE_DETAILS: Record<ProFeature, { titleKey: string; descriptionKey: string }> = {
  unlimited_bikes: {
    titleKey: 'proGate.unlimitedBikesTitle',
    descriptionKey: 'proGate.unlimitedBikesDesc',
  },
  unlimited_articles: {
    titleKey: 'proGate.unlimitedArticlesTitle',
    descriptionKey: 'proGate.unlimitedArticlesDesc',
  },
  full_ai_diagnostics: {
    titleKey: 'proGate.fullDiagnosticsTitle',
    descriptionKey: 'proGate.fullDiagnosticsDesc',
  },
  maintenance_reminders: {
    titleKey: 'proGate.maintenanceRemindersTitle',
    descriptionKey: 'proGate.maintenanceRemindersDesc',
  },
  pdf_export: {
    titleKey: 'proGate.pdfExportTitle',
    descriptionKey: 'proGate.pdfExportDesc',
  },
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

interface ProGateModalProps {
  visible: boolean;
  feature: ProFeature | null;
  onDismiss: () => void;
}

export function ProGateModal({ visible, feature, onDismiss }: ProGateModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!feature) return null;

  const details = FEATURE_DETAILS[feature];

  const handleUpgrade = () => {
    haptic();
    onDismiss();
    router.push('/(tabs)/(profile)/upgrade');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#0F172A',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Close button */}
        <Pressable
          onPress={onDismiss}
          style={{
            position: 'absolute',
            top: insets.top + 16,
            right: 20,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
        </Pressable>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          {/* Icon */}
          <Animated.View entering={FadeIn.duration(300)}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(250,204,21,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 28,
              }}
            >
              <Crown size={40} color="#FACC15" strokeWidth={1.5} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: -0.5,
                marginBottom: 12,
              }}
            >
              {t(details.titleKey, { defaultValue: 'Upgrade to Pro' })}
            </Text>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <Text
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
                lineHeight: 24,
                marginBottom: 40,
              }}
            >
              {t(details.descriptionKey, {
                defaultValue: 'Unlock this feature with a Pro subscription.',
              })}
            </Text>
          </Animated.View>

          {/* Pro features list */}
          <Animated.View entering={FadeInUp.delay(300).duration(300)} style={{ width: '100%' }}>
            {[
              { icon: Sparkles, label: t('proGate.featureUnlimitedBikes') },
              { icon: Sparkles, label: t('proGate.featureFullDiagnostics') },
              { icon: Sparkles, label: t('proGate.featureMaintenanceReminders') },
              { icon: Sparkles, label: t('proGate.featurePdfExport') },
            ].map((item, index) => (
              <Animated.View
                key={item.label}
                entering={FadeInUp.delay(350 + index * 60).duration(300)}
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
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <item.icon size={16} color="#818CF8" strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                  {item.label}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Pressable
            onPress={handleUpgrade}
            style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[palette.gradientCTAStart, palette.gradientCTAEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: 18,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Crown size={20} color="#FACC15" strokeWidth={2} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                {t('proGate.upgradeToPro', { defaultValue: 'Upgrade to Pro' })}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onDismiss} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
              {t('proGate.maybeLater', { defaultValue: 'Maybe Later' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
