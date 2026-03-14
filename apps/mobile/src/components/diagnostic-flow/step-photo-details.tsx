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
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2">
          <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-1">
            {t('diagnoseV2.photoDetails')}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
            {t('diagnoseV2.photoEncouragement')}
          </Text>
        </View>

        {/* Photo section */}
        {photoUri ? (
          <Animated.View entering={FadeInUp.duration(300)} className="px-5 mb-4">
            <View
              className="rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800"
              style={{ borderCurve: 'continuous' }}
            >
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 240, borderRadius: 16 }}
                resizeMode="cover"
              />
              <Pressable
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 items-center justify-center"
                onPress={() => setPhotoUri(null)}
              >
                <X size={16} color={palette.white} strokeWidth={2} />
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} className="px-5 gap-3 mb-4">
            <Pressable
              className="bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-3"
              style={{ borderCurve: 'continuous' }}
              onPress={() => handleCapture('camera')}
              disabled={compressing}
            >
              <Camera size={20} color={palette.white} strokeWidth={2} />
              <Text className="text-white font-semibold text-base">
                {t('diagnoseV2.takePhoto')}
              </Text>
            </Pressable>
            <Pressable
              className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl py-4 items-center flex-row justify-center gap-3"
              style={{ borderCurve: 'continuous' }}
              onPress={() => handleCapture('gallery')}
              disabled={compressing}
            >
              <ImageIcon size={20} color={palette.neutral600} strokeWidth={2} />
              <Text className="text-neutral-700 dark:text-neutral-300 font-semibold text-base">
                {t('diagnoseV2.chooseFromGallery')}
              </Text>
            </Pressable>
            <Pressable className="py-2 items-center" onPress={handleNext}>
              <Text className="text-sm text-neutral-400">{t('diagnoseV2.skipPhoto')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Additional notes */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)} className="px-5 mb-4">
          <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            {t('diagnoseV2.additionalNotes')}
          </Text>
          <TextInput
            className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-950 dark:text-neutral-50"
            style={{ borderCurve: 'continuous', textAlignVertical: 'top', minHeight: 80 }}
            placeholder={t('diagnoseV2.additionalNotesPlaceholder')}
            placeholderTextColor={palette.neutral400}
            value={additionalNotes}
            onChangeText={(text) => setAdditionalNotes(text.slice(0, 500))}
            multiline
            maxLength={500}
          />
          <Text className="text-xs text-neutral-400 mt-1 text-right">
            {t('diagnoseV2.charCount', { count: additionalNotes.length, max: 500 })}
          </Text>
        </Animated.View>

        {/* Urgency */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} className="px-5">
          <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            {t('diagnoseV2.howUrgent')}
          </Text>
          <View className="gap-2">
            {URGENCY_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <Pressable
                key={value}
                className={`rounded-xl p-4 flex-row items-center gap-3 border-2 ${
                  urgency === value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }`}
                style={{ borderCurve: 'continuous' }}
                onPress={() => handleUrgencyPress(value)}
              >
                <Icon
                  size={20}
                  color={urgency === value ? palette.primary500 : palette.neutral400}
                  strokeWidth={1.5}
                />
                <Text
                  className={`text-sm font-medium ${
                    urgency === value
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {/* biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key */}
                  {t(labelKey as any)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Next button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        <Pressable
          className="bg-primary-500 rounded-2xl py-4 items-center"
          style={{ borderCurve: 'continuous' }}
          onPress={handleNext}
        >
          <Text className="text-white font-semibold text-base">
            {editingFromReview ? t('diagnoseV2.backToReview') : t('diagnoseV2.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
