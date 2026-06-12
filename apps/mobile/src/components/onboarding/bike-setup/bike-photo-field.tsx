import { Image } from 'expo-image';
import { Camera, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { pickImage, takePhoto } from '../../../lib/image-upload';
import { triggerImpact } from '../../../utils/haptics';
import { ONBOARDING_COLORS } from '../onboarding-colors';

interface BikePhotoFieldProps {
  /** Local image URI, or null when none chosen. */
  photoUri: string | null;
  onChange: (uri: string | null) => void;
  /** Brand accent for the selected-state framing. */
  accent: string;
}

/**
 * Optional bike-photo picker for the bike-setup selected state. Stores a local
 * URI on the onboarding bike data; the Reveal shows it (falling back to the
 * stock per-make image when absent).
 */
export function BikePhotoField({ photoUri, onChange, accent }: BikePhotoFieldProps) {
  const { t } = useTranslation();

  const choosePhoto = () => {
    triggerImpact();
    Alert.alert(t('onboarding.bikePhotoSubtitle'), undefined, [
      {
        text: t('onboarding.takePhoto'),
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) onChange(uri);
        },
      },
      {
        text: t('onboarding.chooseFromLibrary'),
        onPress: async () => {
          const uri = await pickImage();
          if (uri) onChange(uri);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  if (photoUri) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 10,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surfaceInput,
          borderWidth: 1,
          borderColor: `${accent}59`,
        }}
      >
        <Pressable
          onPress={choosePhoto}
          accessibilityRole="button"
          accessibilityLabel="Change photo"
        >
          <Image
            source={{ uri: photoUri }}
            style={{ width: 56, height: 56, borderRadius: 12 }}
            contentFit="cover"
          />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 13.5, color: ONBOARDING_COLORS.textBody }}>
          {t('onboarding.bikePhotoSubtitle')}
        </Text>
        <Pressable
          onPress={() => onChange(null)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: ONBOARDING_COLORS.surfaceDismiss,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={15} color={ONBOARDING_COLORS.iconDismiss} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={choosePhoto}
      accessibilityRole="button"
      accessibilityLabel={t('onboarding.bikePhotoSubtitle')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: ONBOARDING_COLORS.borderMuted,
      }}
    >
      <Camera size={17} color={ONBOARDING_COLORS.warm2} />
      <Text style={{ fontSize: 14, fontWeight: '500', color: ONBOARDING_COLORS.warm2 }}>
        {t('onboarding.bikePhotoSubtitle')}
      </Text>
    </Pressable>
  );
}
