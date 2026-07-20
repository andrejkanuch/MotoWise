import { palette } from '@motovault/design-system';
import { type Href, router } from 'expo-router';
import { DollarSign, Edit3, MoreHorizontal, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

/**
 * Bike-hub primary action grid: Add task (emphasis), Add expense, Edit, and an
 * overflow "More" button. Navigation lives here; `onMore` is delegated because
 * its action sheet is composed in the screen (delete, recalls, OEM import…).
 */
export function BikeQuickActions({
  motorcycleId,
  bikeName,
  onMore,
  delay = 100,
}: {
  motorcycleId: string;
  bikeName: string;
  onMore: () => void;
  delay?: number;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      <Pressable
        onPress={() => {
          triggerImpact();
          const href: Href = {
            pathname: '/(tabs)/(garage)/add-maintenance-task',
            params: { motorcycleId, bikeName },
          };
          router.push(href);
        }}
        style={({ pressed }) => ({
          flex: 2,
          alignItems: 'center',
          gap: 5,
          paddingVertical: 12,
          backgroundColor: theme.warm,
          borderRadius: 14,
          borderCurve: 'continuous',
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <Wrench size={18} color={palette.neutral950} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: palette.neutral950 }}>
          {t('maintenance.addTask', { defaultValue: 'Add task' })}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          triggerImpact();
          const href: Href = {
            pathname: '/(tabs)/(garage)/add-expense',
            params: { motorcycleId },
          };
          router.push(href);
        }}
        style={({ pressed }) => ({
          flex: 1.5,
          alignItems: 'center',
          gap: 5,
          paddingVertical: 12,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 14,
          borderCurve: 'continuous',
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <DollarSign size={18} color={theme.ink2} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.ink2 }}>
          {t('garage.addExpense', { defaultValue: 'Expense' })}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          triggerImpact();
          const href: Href = {
            pathname: '/(tabs)/(garage)/edit-bike',
            params: { id: motorcycleId },
          };
          router.push(href);
        }}
        accessibilityLabel={t('common.edit', { defaultValue: 'Edit' })}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 14,
          borderCurve: 'continuous',
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <Edit3 size={18} color={theme.ink2} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={onMore}
        accessibilityLabel={t('common.more', { defaultValue: 'More' })}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderRadius: 14,
          borderCurve: 'continuous',
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <MoreHorizontal size={16} color={theme.ink2} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}
