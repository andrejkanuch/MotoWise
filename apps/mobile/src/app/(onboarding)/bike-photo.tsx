import * as Haptics from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Image as ImageIcon, SkipForward, Tag, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

async function compressImage(uri: string): Promise<string> {
  const compressed = await manipulateAsync(uri, [{ resize: { width: 600 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return compressed.uri;
}

export default function BikePhotoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [nickname, setNickname] = useState(bikeData?.nickname ?? '');
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
          allowsEditing: true,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets[0]) {
          let uri = result.assets[0].uri;
          try {
            uri = await compressImage(uri);
          } catch (compressionError) {
            console.warn('Image compression failed, using original image:', compressionError);
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
      nickname: nickname.trim() || undefined,
      photoUri: photoUri ?? undefined,
    });

    router.replace('/(onboarding)/riding-frequency');
  };

  const handleSkip = () => {
    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      nickname: nickname.trim() || undefined,
    });

    router.replace('/(onboarding)/riding-frequency');
  };

  const displayName = nickname.trim() || bikeLabel;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={7} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 32,
          }}
        >
          {t('onboarding.bikePhotoTitle')}
        </Animated.Text>

        {/* Nickname input */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Tag size={18} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('onboarding.nicknamePlaceholder')}
            </Text>
          </View>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('onboarding.nicknamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 32,
            }}
          />
        </Animated.View>

        {/* Photo section */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: 16,
            }}
          >
            {t('onboarding.bikePhotoSubtitle')}
          </Text>

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
                      color: '#FFFFFF',
                    }}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {nickname.trim() && bikeLabel ? (
                    <Text
                      style={{
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.7)',
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {bikeLabel}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={handleContinue}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: '#FFFFFF',
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
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                    {t('onboarding.looksGreat')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleRetake}
                  style={({ pressed }) => ({
                    backgroundColor: 'rgba(255,255,255,0.08)',
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
                  <X size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                    {t('onboarding.retakePhoto')}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            /* Photo picker buttons */
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={handleTakePhoto}
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 18,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: 'continuous',
                    backgroundColor: 'rgba(129,140,248,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={22} color="#818CF8" />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#FFFFFF' }}>
                  {t('onboarding.takePhoto')}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleChooseFromLibrary}
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 18,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: 'continuous',
                    backgroundColor: 'rgba(96,165,250,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ImageIcon size={22} color="#60A5FA" />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#FFFFFF' }}>
                  {t('onboarding.chooseFromLibrary')}
                </Text>
              </Pressable>
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
              backgroundColor: '#FFFFFF',
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
                color: '#0F172A',
              }}
            >
              {t('onboarding.continue')}
            </Text>
            <ChevronRight size={20} color="#0F172A" />
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
            <SkipForward size={16} color="rgba(255,255,255,0.5)" />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {t('onboarding.addLater')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
