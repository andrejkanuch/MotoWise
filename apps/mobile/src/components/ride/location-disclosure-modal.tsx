import { MapPin } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tint, useEditorialTheme } from '../../theme/editorial';

interface LocationDisclosureModalProps {
  visible: boolean;
  /** User accepted — proceed to the system permission request. */
  onContinue: () => void;
  /** User declined — no location access happens. */
  onDismiss: () => void;
}

/**
 * Google Play prominent disclosure for background location. Shown BEFORE the OS
 * permission prompt (and before the Android 11+ Settings redirect triggered by
 * `requestBackgroundPermissionsAsync`), it explains that location is collected in
 * the background and names the feature (ride recording). Required for the Play
 * Console "Location permissions" declaration — the walkthrough video must show
 * this exact screen ahead of the runtime prompt.
 */
export const LocationDisclosureModal = memo(function LocationDisclosureModal({
  visible,
  onContinue,
  onDismiss,
}: LocationDisclosureModalProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeInUp.duration(260)}
          style={{
            backgroundColor: theme.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderCurve: 'continuous',
            paddingHorizontal: 26,
            paddingTop: 28,
            paddingBottom: insets.bottom + 24,
            gap: 18,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={26} color={theme.warm} />
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.ink,
              letterSpacing: -0.5,
              lineHeight: 24 * 1.1,
            }}
          >
            {t('startRide.disclosureTitle')}
          </Text>

          <Text style={{ fontSize: 15, color: theme.ink2, lineHeight: 15 * 1.5 }}>
            {t('startRide.disclosureBody')}
          </Text>

          <Text style={{ fontSize: 13, color: theme.ink3, lineHeight: 13 * 1.45 }}>
            {t('startRide.disclosureSettingsNote')}
          </Text>

          <View style={{ gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel={t('startRide.disclosureContinue')}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: 999,
                borderCurve: 'continuous',
                backgroundColor: theme.ink,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.bg }}>
                {t('startRide.disclosureContinue')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('startRide.disclosureNotNow')}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: 999,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2 }}>
                {t('startRide.disclosureNotNow')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});
