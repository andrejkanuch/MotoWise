import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { Switch, Text, useColorScheme, View } from 'react-native';

interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}

export function ToggleRow({ icon: Icon, title, subtitle, value, onToggle }: ToggleRowProps) {
  const isDark = useColorScheme() === 'dark';

  const handleChange = (next: boolean) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle(next);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.iconBubbleDark : palette.neutral100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          size={17}
          color={isDark ? palette.neutral300 : palette.neutral600}
          strokeWidth={1.8}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
        <Text
          style={{
            fontSize: 16,
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{ false: palette.neutral300, true: palette.primary500 }}
        thumbColor={palette.white}
      />
    </View>
  );
}
