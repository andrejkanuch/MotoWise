import { Image } from 'expo-image';
import { View } from 'react-native';
import { useHubTheme } from '../ui/tokens';

const FADE_IN_MS = 180;
const PHOTO_RADIUS = 10;

/**
 * Local files of photos this session uploaded, by storage path. A note saved
 * with a photo is re-read from the API with the photo's public URL, which has
 * to download before it can show; the rider's own file is already on the
 * device, so the row shows that instead.
 */
const localUriByStoragePath = new Map<string, string>();

export function rememberLocalNotePhoto(storagePath: string, localUri: string): void {
  localUriByStoragePath.set(storagePath, localUri);
}

/** A saved photo (`storagePath` + `publicUrl`) or a local file not uploaded yet. */
export interface NotePhotoSource {
  storagePath?: string;
  uri: string;
}

/** The uri to draw: the rider's own local file when this session uploaded it, else the remote one. */
export function notePhotoUri(photo: NotePhotoSource): string {
  const local = photo.storagePath ? localUriByStoragePath.get(photo.storagePath) : undefined;
  return local ?? photo.uri;
}

interface NotePhotoProps {
  photo: NotePhotoSource;
  size: number;
  accessibilityLabel?: string;
}

/** One square note photo: a raised placeholder until the image fades in. */
export function NotePhoto({ photo, size, accessibilityLabel }: NotePhotoProps) {
  const hub = useHubTheme();
  // The rounded, raised frame shows until the image fades in; expo-image's own
  // style has no `borderCurve`, so the frame clips it.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: PHOTO_RADIUS,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: hub.raised,
      }}
    >
      <Image
        source={{ uri: notePhotoUri(photo) }}
        accessibilityLabel={accessibilityLabel}
        transition={FADE_IN_MS}
        contentFit="cover"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
