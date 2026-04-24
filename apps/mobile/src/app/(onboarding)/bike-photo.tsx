import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronLeft, Image as ImageIcon, SkipForward, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const SCREEN_INDEX = 3;

/** Crop to 4:3 center and compress */
async function cropAndCompress(uri: string): Promise<string> {
  const {
    width,
    height,
    uri: resizedUri,
  } = await manipulateAsync(uri, [], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  const targetAspect = 4 / 3;
  const currentAspect = width / height;

  let cropAction:
    | { crop: { originX: number; originY: number; width: number; height: number } }
    | undefined;
  if (currentAspect > targetAspect) {
    const cropWidth = height * targetAspect;
    cropAction = {
      crop: { originX: (width - cropWidth) / 2, originY: 0, width: cropWidth, height },
    };
  } else if (currentAspect < targetAspect) {
    const cropHeight = width / targetAspect;
    cropAction = {
      crop: { originX: 0, originY: (height - cropHeight) / 2, width, height: cropHeight },
    };
  }

  const actions = cropAction
    ? [cropAction, { resize: { width: 600 } as const }]
    : [{ resize: { width: 600 } as const }];
  const result = await manipulateAsync(resizedUri, actions, {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

export default function BikePhotoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [photoUri, setPhotoUri] = useState<string | null>(bikeData?.photoUri ?? null);

  const bikeLabel = [bikeData?.year, bikeData?.make, bikeData?.model].filter(Boolean).join(' ');

  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              t('onboarding.cameraPermissionDeniedTitle'),
              t('onboarding.cameraPermissionDeniedMessage'),
            );
            return;
          }
        }

        const launcher =
          source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;

        const result = await launcher({
          mediaTypes: 'images',
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          let uri = result.assets[0].uri;
          try {
            uri = await cropAndCompress(uri);
          } catch (processingError) {
            console.warn('Image processing failed, using original image:', processingError);
          }
          setPhotoUri(uri);
        }
      } catch (error) {
        console.warn('Image picker failed:', error);
        Alert.alert(t('common.error'), t('onboarding.imagePickerError'));
      }
    },
    [t],
  );

  const handleTakePhoto = useCallback(() => pickImage('camera'), [pickImage]);
  const handleChooseFromLibrary = useCallback(() => pickImage('library'), [pickImage]);

  const handleRetake = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPhotoUri(null);
  };

  const handleContinue = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      photoUri: photoUri ?? undefined,
    });
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'bike_photo',
      step_index: SCREEN_INDEX,
      has_photo: !!photoUri,
    });

    router.replace('/(onboarding)/preferences');
  };

  const handleSkip = () => {
    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
    });
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, {
      step: 'bike_photo',
      step_index: SCREEN_INDEX,
    });

    router.replace('/(onboarding)/preferences');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={SCREEN_INDEX} totalScreens={TOTAL_SCREENS} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <ChevronLeft size={22} color={ONBOARDING_COLORS.textSecondary} />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.duration(300)}>
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
            Add a photo of{'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              your ride.
            </Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeIn.delay(100).duration(250)}
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 32,
          }}
        >
          {t('onboarding.bikePhotoSubtitle')}
        </Animated.Text>

        {/* Photo section */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)}>
          {photoUri ? (
            /* Photo preview */
            <Animated.View entering={FadeIn.duration(300)}>
              <View
                style={{
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: '100%', aspectRatio: 4 / 3 }}
                  resizeMode="cover"
                />
                {/* Bike info overlay */}
                {bikeLabel ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                      numberOfLines={1}
                    >
                      {bikeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={handleContinue}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: ONBOARDING_COLORS.warm,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#1a1208',
                    }}
                  >
                    {t('onboarding.looksGreat')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleRetake}
                  style={({ pressed }) => ({
                    backgroundColor: ONBOARDING_COLORS.cardBorderDefault,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row',
                    gap: 6,
                  })}
                >
                  <X size={18} color={ONBOARDING_COLORS.textSecondary} />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textSecondary,
                    }}
                  >
                    {t('onboarding.retakePhoto')}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            /* Dashed upload area + camera/library buttons */
            <View style={{ gap: 16 }}>
              {/* Large dashed-border upload area */}
              <Pressable
                onPress={handleChooseFromLibrary}
                style={({ pressed }) => ({
                  borderWidth: 2,
                  borderColor: ONBOARDING_COLORS.cardBorder,
                  borderStyle: 'dashed',
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  paddingVertical: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderCurve: 'continuous',
                    backgroundColor: ONBOARDING_COLORS.accentBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ImageIcon size={26} color={ONBOARDING_COLORS.accent} />
                </View>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textPrimary,
                  }}
                >
                  {t('onboarding.tapToAddPhoto')}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: ONBOARDING_COLORS.textMuted,
                  }}
                >
                  {t('onboarding.cameraOrLibrary')}
                </Text>
              </Pressable>

              {/* Camera + Library buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={handleTakePhoto}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: ONBOARDING_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: ONBOARDING_COLORS.cardBorder,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Camera size={20} color={ONBOARDING_COLORS.accent} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  >
                    {t('onboarding.takePhoto')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleChooseFromLibrary}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: ONBOARDING_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: ONBOARDING_COLORS.cardBorder,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <ImageIcon size={20} color={palette.moduleSuspension} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  >
                    {t('onboarding.chooseFromLibrary')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom buttons (only when no photo preview) */}
      {!photoUri && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => ({
              backgroundColor: ONBOARDING_COLORS.warm,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            })}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: '#1a1208',
              }}
            >
              {t('onboarding.continue')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => ({
              paddingVertical: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SkipForward size={16} color={ONBOARDING_COLORS.textMuted} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: ONBOARDING_COLORS.textMuted,
              }}
            >
              {t('onboarding.skipAddLater')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
