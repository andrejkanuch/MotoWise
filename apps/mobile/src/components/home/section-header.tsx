import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface SectionHeaderProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  badgeCount?: number;
  badgeColor?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  isDark: boolean;
}

export function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  badgeCount,
  badgeColor = palette.warning500,
  actionLabel,
  onActionPress,
  isDark,
}: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: `${iconColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={15} color={iconColor} strokeWidth={2} />
        </View>
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {title}
        </Text>
        {badgeCount != null && badgeCount > 0 && (
          <View
            style={{
              backgroundColor: `${badgeColor}20`,
              borderRadius: 999,
              borderCurve: 'continuous',
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: badgeColor }}>{badgeCount}</Text>
          </View>
        )}
      </View>
      {actionLabel && onActionPress && (
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onActionPress();
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary500 }}>
            {actionLabel}
          </Text>
          <ChevronRight size={14} color={palette.primary500} strokeWidth={2.5} />
        </Pressable>
      )}
    </View>
  );
}
