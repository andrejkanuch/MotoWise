import { palette } from '@motovault/design-system';
import type { ProFeature } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Bell, Bike, BookOpen, Brain, FileText, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { presentPaywall } from '../lib/subscription';

const FEATURE_DETAILS: Record<
  ProFeature,
  { titleKey: string; descriptionKey: string; icon: LucideIcon }
> = {
  unlimited_bikes: {
    titleKey: 'proGate.unlimitedBikesTitle',
    descriptionKey: 'proGate.unlimitedBikesDesc',
    icon: Bike,
  },
  unlimited_articles: {
    titleKey: 'proGate.unlimitedArticlesTitle',
    descriptionKey: 'proGate.unlimitedArticlesDesc',
    icon: BookOpen,
  },
  full_ai_diagnostics: {
    titleKey: 'proGate.fullDiagnosticsTitle',
    descriptionKey: 'proGate.fullDiagnosticsDesc',
    icon: Brain,
  },
  maintenance_reminders: {
    titleKey: 'proGate.maintenanceRemindersTitle',
    descriptionKey: 'proGate.maintenanceRemindersDesc',
    icon: Bell,
  },
  pdf_export: {
    titleKey: 'proGate.pdfExportTitle',
    descriptionKey: 'proGate.pdfExportDesc',
    icon: FileText,
  },
};

const FEATURE_LIST: { key: ProFeature; icon: LucideIcon; labelKey: string }[] = [
  { key: 'unlimited_bikes', icon: Bike, labelKey: 'proGate.featureUnlimitedBikes' },
  { key: 'full_ai_diagnostics', icon: Brain, labelKey: 'proGate.featureFullDiagnostics' },
  { key: 'maintenance_reminders', icon: Bell, labelKey: 'proGate.featureMaintenanceReminders' },
  { key: 'pdf_export', icon: FileText, labelKey: 'proGate.featurePdfExport' },
];

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
  const insets = useSafeAreaInsets();

  if (!feature) return null;

  const details = FEATURE_DETAILS[feature];
  const FeatureIcon = details.icon;

  const handleUpgrade = () => {
    haptic();
    onDismiss();
    presentPaywall();
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
          backgroundColor: palette.surfaceDark,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Close button */}
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: insets.top + 16,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.1)',
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
          {/* Icon */}
          <Animated.View entering={FadeIn.duration(300)}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderCurve: 'continuous',
                backgroundColor: `${palette.signature500}25`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 28,
              }}
            >
              <FeatureIcon size={40} color={palette.signature500} strokeWidth={1.5} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)}>
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
              {t(details.titleKey, { defaultValue: 'Upgrade to Pro' })}
            </Text>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <Text
              style={{
                fontSize: 16,
                color: palette.neutral400,
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
            {FEATURE_LIST.map((item, index) => (
              <Animated.View
                key={item.key}
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
                    backgroundColor: `${palette.primary400}25`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <item.icon size={16} color={palette.primary400} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                  {String(t(item.labelKey as never))}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Pressable
            onPress={handleUpgrade}
            accessibilityRole="button"
            style={{
              backgroundColor: palette.primary700,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
              {t('proGate.upgradeToPro', { defaultValue: 'Upgrade to Pro' })}
            </Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            style={{ alignItems: 'center', paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, color: palette.neutral400, fontWeight: '500' }}>
              {t('proGate.maybeLater', { defaultValue: 'Maybe Later' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
