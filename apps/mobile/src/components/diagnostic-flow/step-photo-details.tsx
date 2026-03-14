import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, Camera, Clock, Image as ImageIcon, Shield, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import type { Urgency } from '../../stores/diagnostic-flow.store';
import { useDiagnosticFlowStore } from '../../stores/diagnostic-flow.store';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';

const URGENCY_COLORS: Record<string, string> = {
  stranded: palette.danger500,
  soon: palette.warning500,
  preventive: palette.success500,
};

const URGENCY_OPTIONS: { value: Urgency; labelKey: string; icon: typeof AlertTriangle }[] = [
  { value: 'stranded', labelKey: 'diagnoseV2.urgencyStranded', icon: AlertTriangle },
  { value: 'soon', labelKey: 'diagnoseV2.urgencySoon', icon: Clock },
  { value: 'preventive', labelKey: 'diagnoseV2.urgencyPreventive', icon: Shield },
];

async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1920 });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return result.uri;
}

export function StepPhotoDetails() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [compressing, setCompressing] = useState(false);

  const {
    photoUri,
    additionalNotes,
    urgency,
    editingFromReview,
    setPhotoUri,
    setAdditionalNotes,
    setUrgency,
    goNext,
    backToReview,
  } = useDiagnosticFlowStore(
    useShallow((s) => ({
      photoUri: s.photoUri,
      additionalNotes: s.additionalNotes,
      urgency: s.urgency,
      editingFromReview: s.editingFromReview,
      setPhotoUri: s.setPhotoUri,
      setAdditionalNotes: s.setAdditionalNotes,
      setUrgency: s.setUrgency,
      goNext: s.goNext,
      backToReview: s.backToReview,
    })),
  );

  const handleCapture = async (source: 'camera' | 'gallery') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (result.canceled || !result.assets[0]) return;

    try {
      setCompressing(true);
      const compressed = await compressPhoto(result.assets[0].uri);
      setPhotoUri(compressed);
    } catch {
      Alert.alert(t('diagnoseV2.photoError'));
    } finally {
      setCompressing(false);
    }
  };

  const handleUrgencyPress = (value: Urgency) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUrgency(urgency === value ? null : value);
  };

  const handleNext = () => {
    if (editingFromReview) backToReview();
    else goNext();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: DIAGNOSTIC_COLORS.textMuted,
            }}
          >
            {t('diagnoseV2.stepOf', { current: 3, total: 4 })}
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textPrimary,
              marginTop: 4,
            }}
          >
            {t('diagnoseV2.photoDetails')}
          </Text>
          <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted, marginTop: 4 }}>
            {t('diagnoseV2.photoEncouragement')}
          </Text>
        </View>

        {/* Photo section */}
        {photoUri ? (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={{ paddingHorizontal: 20, marginBottom: 16 }}
          >
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderCurve: 'continuous',
              }}
            >
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 240, borderRadius: 16 }}
                resizeMode="cover"
              />
              <Pressable
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setPhotoUri(null)}
              >
                <X size={16} color={palette.white} strokeWidth={2} />
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ paddingHorizontal: 20, gap: 12, marginBottom: 16 }}
          >
            <Pressable
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.accent,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 12,
                borderCurve: 'continuous',
              }}
              onPress={() => handleCapture('camera')}
              disabled={compressing}
            >
              <Camera size={20} color={palette.white} strokeWidth={2} />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                {t('diagnoseV2.takePhoto')}
              </Text>
            </Pressable>
            <Pressable
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderCurve: 'continuous',
              }}
              onPress={() => handleCapture('gallery')}
              disabled={compressing}
            >
              <ImageIcon size={20} color={DIAGNOSTIC_COLORS.textSecondary} strokeWidth={2} />
              <Text
                style={{ color: DIAGNOSTIC_COLORS.textSecondary, fontWeight: '600', fontSize: 16 }}
              >
                {t('diagnoseV2.chooseFromGallery')}
              </Text>
            </Pressable>
            <Pressable style={{ paddingVertical: 8, alignItems: 'center' }} onPress={handleNext}>
              <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted }}>
                {t('diagnoseV2.skipPhoto')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Additional notes */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(300)}
          style={{ paddingHorizontal: 20, marginBottom: 16 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textSecondary,
              marginBottom: 8,
            }}
          >
            {t('diagnoseV2.additionalNotes')}
          </Text>
          <TextInput
            style={{
              backgroundColor: DIAGNOSTIC_COLORS.cardBg,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: DIAGNOSTIC_COLORS.textPrimary,
              borderWidth: 1,
              borderColor: DIAGNOSTIC_COLORS.cardBorder,
              borderCurve: 'continuous',
              textAlignVertical: 'top',
              minHeight: 80,
            }}
            placeholder={t('diagnoseV2.additionalNotesPlaceholder')}
            placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
            value={additionalNotes}
            onChangeText={(text) => setAdditionalNotes(text.slice(0, 500))}
            multiline
            maxLength={500}
          />
          <Text
            style={{
              fontSize: 12,
              color: DIAGNOSTIC_COLORS.textMuted,
              marginTop: 4,
              textAlign: 'right',
            }}
          >
            {t('diagnoseV2.charCount', { count: additionalNotes.length, max: 500 })}
          </Text>
        </Animated.View>

        {/* Urgency */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          style={{ paddingHorizontal: 20 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textSecondary,
              marginBottom: 12,
            }}
          >
            {t('diagnoseV2.howUrgent')}
          </Text>
          <View style={{ gap: 8 }}>
            {URGENCY_OPTIONS.map(({ value, labelKey, icon: Icon }) => {
              const isSelected = urgency === value;
              const accentColor = URGENCY_COLORS[value] ?? DIAGNOSTIC_COLORS.accent;
              return (
                <Pressable
                  key={value}
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? accentColor : DIAGNOSTIC_COLORS.cardBorder,
                    backgroundColor: isSelected
                      ? DIAGNOSTIC_COLORS.cardBgSelected
                      : DIAGNOSTIC_COLORS.cardBg,
                    borderCurve: 'continuous',
                  }}
                  onPress={() => handleUrgencyPress(value)}
                >
                  <Icon
                    size={20}
                    color={isSelected ? accentColor : DIAGNOSTIC_COLORS.textMuted}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: isSelected
                        ? DIAGNOSTIC_COLORS.textPrimary
                        : DIAGNOSTIC_COLORS.textSecondary,
                    }}
                  >
                    {/* biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key */}
                    {t(labelKey as any)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Next button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: DIAGNOSTIC_COLORS.background,
          borderTopWidth: 1,
          borderTopColor: DIAGNOSTIC_COLORS.cardBorder,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
        }}
      >
        <Pressable
          style={{
            backgroundColor: DIAGNOSTIC_COLORS.accent,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            borderCurve: 'continuous',
          }}
          onPress={handleNext}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
            {editingFromReview ? t('diagnoseV2.backToReview') : t('diagnoseV2.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
