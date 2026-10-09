import { Image } from 'expo-image';
import { Text, View, type ViewStyle } from 'react-native';
import { getInitials } from '../../lib/user-avatar';
import { useEditorialTheme } from '../../theme/editorial';
import { SYSTEM_WEIGHT } from '../../theme/type';

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
   *   - `primary` (default): raised graphite bubble — cards, comments, reviews.
   *   - `neutral`: quieter graphite bubble — profile headers, follower rows, participant chips.
   *   - `gradient`: kept for API compatibility; renders like `primary` (no gradients).
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
  const { t } = useEditorialTheme();
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.round(size * 0.36));

  // Race Plate: no blue/gradient bubbles. `primary` and `gradient` read as a
  // raised graphite chip, `neutral` as the quieter one — all per-scheme tokens.
  const fill = {
    primary: { bg: t.surface3, fg: t.ink },
    neutral: { bg: t.surface2, fg: t.ink2 },
    gradient: { bg: t.surface3, fg: t.ink },
  }[variant];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderCurve: 'continuous',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fill.bg,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...SYSTEM_WEIGHT.semibold,
          fontSize,
          color: fill.fg,
          includeFontPadding: false,
        }}
      >
        {initials}
      </Text>
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
