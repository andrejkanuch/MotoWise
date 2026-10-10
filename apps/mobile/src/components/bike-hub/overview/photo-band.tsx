import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { triggerImpact } from '@/utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_PRESSED_SCALE,
  HUB_RADIUS,
  SYSTEM_WEIGHT,
  useHubTheme,
} from '../ui/tokens';

const BAND_HEIGHT = 150;
const EMPTY_HEIGHT = 120;
const CHIP_INSET = 12;
const CHIP_GAP = 8;

interface PhotoBandProps {
  photoUrl: string | null | undefined;
  isPrimary: boolean;
  ridesCount: number;
  uploading: boolean;
  /** The band opens the bike's details (the Bike segment in R1). */
  onPress: () => void;
  /** The empty state opens the take / choose photo sheet. */
  onAddPhoto: () => void;
}

function Chip({ label }: { label: string }) {
  const hub = useHubTheme();
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: HUB_RADIUS.photoChip,
        borderCurve: 'continuous',
        backgroundColor: hub.photoChip,
      }}
    >
      {/* Overlay chrome on a fixed 150 px band: capped so the chips stay chips. */}
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        numberOfLines={1}
        style={{ ...SYSTEM_WEIGHT.medium, fontSize: 12, color: hub.onPhotoChip }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * 150 px photo band with PRIMARY / rides chips; without a photo, a dashed
 * "Add a photo" button. Replaces the 320 pt hero of the old screen.
 */
export function PhotoBand({
  photoUrl,
  isPrimary,
  ridesCount,
  uploading,
  onPress,
  onAddPhoto,
}: PhotoBandProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();

  if (!photoUrl) {
    return (
      <Pressable
        testID="photo-band-empty"
        onPress={onAddPhoto}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={t('bikeHub.photo.addA11y')}
        accessibilityState={{ busy: uploading }}
        style={({ pressed }) => ({
          height: EMPTY_HEIGHT,
          borderRadius: HUB_RADIUS.card,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: hub.dashed,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {uploading ? (
          <ActivityIndicator color={hub.dim} />
        ) : (
          <Camera size={22} color={hub.dim} strokeWidth={1.8} />
        )}
        <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 13, color: hub.dim }}>
          {uploading ? t('garage.uploadingPhoto') : t('bikeHub.photo.add')}
        </Text>
      </Pressable>
    );
  }

  const chips = [
    ...(isPrimary ? [t('bikeHub.photo.primary')] : []),
    ...(ridesCount > 0 ? [t('bikeHub.photo.rides', { count: ridesCount })] : []),
  ];

  return (
    <Pressable
      testID="photo-band"
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('bikeHub.photo.a11y')}
      style={({ pressed }) => ({
        height: BAND_HEIGHT,
        borderRadius: HUB_RADIUS.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: hub.card,
        transform: [{ scale: pressed ? HUB_PRESSED_SCALE : 1 }],
      })}
    >
      <Image
        source={{ uri: photoUrl }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />
      {chips.length > 0 ? (
        <View
          testID="photo-band-chips"
          style={{
            position: 'absolute',
            left: CHIP_INSET,
            right: CHIP_INSET,
            bottom: 10,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: CHIP_GAP,
          }}
        >
          {chips.map((chip) => (
            <Chip key={chip} label={chip} />
          ))}
        </View>
      ) : null}
      {uploading ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: hub.photoChip,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <ActivityIndicator color={hub.onPhotoChip} />
          <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 13, color: hub.onPhotoChip }}>
            {t('garage.uploadingPhoto')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
