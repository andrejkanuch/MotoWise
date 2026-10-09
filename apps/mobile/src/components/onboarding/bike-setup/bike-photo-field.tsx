import { Image } from 'expo-image';
import { Camera, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { pickImage, takePhoto } from '../../../lib/image-upload';
import { radius, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { useOnboardingColors } from '../onboarding-colors';

interface BikePhotoFieldProps {
  /** Local image URI, or null when none chosen. */
  photoUri: string | null;
  onChange: (uri: string | null) => void;
}

/**
 * Optional bike-photo picker for the bike-setup selected state. Stores a local
 * URI on the onboarding bike data; the Reveal shows it (falling back to the
 * stock per-make image when absent).
 */
export function BikePhotoField({ photoUri, onChange }: BikePhotoFieldProps) {
  const oc = useOnboardingColors();
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
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surfaceInput,
          borderWidth: 1,
          borderColor: oc.cardBorder,
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
        <Text style={[type.subhead, { flex: 1, color: oc.textBody }]}>
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
            backgroundColor: oc.surfaceDismiss,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={15} color={oc.iconDismiss} />
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
        minHeight: 52,
        paddingVertical: 16,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: oc.borderMuted,
      }}
    >
      <Camera size={17} color={oc.warm2} />
      <Text style={[type.label, { color: oc.warm2 }]}>{t('onboarding.bikePhotoSubtitle')}</Text>
    </Pressable>
  );
}
