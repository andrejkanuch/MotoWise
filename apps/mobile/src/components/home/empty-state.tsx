import { Heart, Sparkles, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { ESettingsGroup, ESettingsRow } from '../ui/editorial';

const CTA_HEIGHT = 52;

interface EmptyStateProps {
  onAddBike: () => void;
  onExplore: () => void;
}

/** No bike yet: what the garage does, then one clear way to add the first bike. */
export function EmptyState({ onAddBike, onExplore }: EmptyStateProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const values = [
    { icon: Heart, title: t('home.emptyValueHealth'), subtitle: t('home.emptyValueHealthDesc') },
    {
      icon: Wrench,
      title: t('home.emptyValueMaintenance'),
      subtitle: t('home.emptyValueMaintenanceDesc'),
    },
    { icon: Sparkles, title: t('home.emptyValueAI'), subtitle: t('home.emptyValueAIDesc') },
  ];

  return (
    <Animated.View entering={FadeInUp.duration(240)} style={{ gap: space.md }}>
      <ESettingsGroup>
        {values.map((value) => (
          <ESettingsRow
            key={value.title}
            icon={value.icon}
            title={value.title}
            subtitle={value.subtitle}
          />
        ))}
      </ESettingsGroup>

      <Pressable
        onPress={() => {
          triggerImpact();
          onAddBike();
        }}
        accessibilityRole="button"
        android_ripple={{ color: tint(theme.onWarm, 0.12) }}
        style={({ pressed }) => ({
          backgroundColor: theme.warm,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          overflow: 'hidden',
          minHeight: CTA_HEIGHT,
          paddingHorizontal: space.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: theme.onWarm, textAlign: 'center' }]}>
          {t('home.emptyAddBike')}
        </Text>
      </Pressable>

      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => {
            triggerImpact();
            onExplore();
          }}
          accessibilityRole="button"
          hitSlop={12}
          style={{ paddingVertical: space.xs }}
        >
          <Text style={[type.label, { color: theme.warm2 }]}>{t('home.emptyExploreWithout')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
