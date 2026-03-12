import { Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

interface ProBadgeProps {
  size?: 'small' | 'default';
}

export function ProBadge({ size = 'default' }: ProBadgeProps) {
  const { t } = useTranslation();
  const isSmall = size === 'small';

  return (
    <Animated.View entering={ZoomIn.duration(200).springify()}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: isSmall ? 3 : 5,
          backgroundColor: 'rgba(250,204,21,0.15)',
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 3 : 5,
          borderRadius: isSmall ? 8 : 12,
          borderCurve: 'continuous',
        }}
      >
        <Crown size={isSmall ? 11 : 14} color="#FACC15" strokeWidth={2.5} fill="#FACC15" />
        <Text
          style={{
            fontSize: isSmall ? 10 : 12,
            fontWeight: '700',
            color: '#FACC15',
            letterSpacing: 0.5,
          }}
        >
          {t('proGate.proBadge', { defaultValue: 'PRO' })}
        </Text>
      </View>
    </Animated.View>
  );
}
