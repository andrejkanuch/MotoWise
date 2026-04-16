import { palette } from '@motovault/design-system';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, useColorScheme, View, type ViewStyle } from 'react-native';
import { getInitials } from '../../lib/user-avatar';

type AvatarVariant = 'primary' | 'neutral' | 'gradient';

interface AvatarProps {
  /** Remote URL. When null/undefined, the initials fallback is rendered. */
  url?: string | null;
  /** Used to derive initials and the image a11y label. */
  name?: string | null;
  /** Diameter in px. Border radius is always `size / 2` (round). */
  size: number;
  /**
   * Visual treatment for the fallback background.
   *   - `primary` (default): tinted primary bubble — used on cards, comments, reviews.
   *   - `neutral`: muted neutral bubble — used on profile headers, follower rows, participant chips.
   *   - `gradient`: primary500→700 gradient — reserved for the signed-in user's large self-avatar.
   */
  variant?: AvatarVariant;
  /** Extra wrapper styles (e.g. border, margin). */
  style?: ViewStyle;
}

/**
 * Unified avatar: renders the image when `url` is provided, otherwise initials on a
 * tinted background. The initials also show through briefly during image load (as a
 * placeholder), and if the image 404s or the user is offline the initials remain visible.
 */
export function Avatar({ url, name, size, variant = 'primary', style }: AvatarProps) {
  const isDark = useColorScheme() === 'dark';
  const initials = getInitials(name);
  const radius = size / 2;
  const fontSize = Math.max(10, Math.round(size * 0.36));

  let bgColor: string | undefined;
  let textColor: string = palette.white;
  if (variant === 'primary') {
    bgColor = isDark ? palette.primary700 : palette.primary200;
    textColor = isDark ? palette.primary200 : palette.primary700;
  } else if (variant === 'neutral') {
    bgColor = isDark ? palette.neutral800 : palette.neutral200;
    textColor = isDark ? palette.neutral300 : palette.neutral700;
  }

  const fallback = (
    <Text
      style={{
        fontSize,
        fontWeight: '700',
        color: textColor,
        includeFontPadding: false,
      }}
    >
      {initials}
    </Text>
  );

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: 'continuous',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={[palette.primary500, palette.primary700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fallback}
        </LinearGradient>
      ) : (
        fallback
      )}
      {url && (
        <Image
          source={{ uri: url }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          accessibilityLabel={name ?? 'Avatar'}
        />
      )}
    </View>
  );
}
