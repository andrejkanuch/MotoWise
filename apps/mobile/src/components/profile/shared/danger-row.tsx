import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';

interface DangerRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  isPending?: boolean;
}

export function DangerRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
  isPending = false,
}: DangerRowProps) {
  const isDark = useColorScheme() === 'dark';

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: isPending }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: isPending ? 0.6 : 1,
        backgroundColor: pressed
          ? isDark
            ? palette.pressedDark
            : palette.pressedLight
          : 'transparent',
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.dangerTintDark : palette.dangerTintLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPending ? (
          <ActivityIndicator size="small" color={palette.danger500} />
        ) : (
          <Icon size={17} color={palette.danger500} strokeWidth={1.8} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: palette.danger500 }}>{title}</Text>
        <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}
