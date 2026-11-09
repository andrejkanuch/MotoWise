import type { ExpenseCategory } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BarChart3, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GARAGE_ROUTE } from '@/config/routes';
import { ReceiptScanEntry } from '@/features/receipt-scan/receipt-scan-entry';
import { SCAN_ENTRY_SURFACE } from '@/features/receipt-scan/scan-flow-constants';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { CATEGORY_COLORS } from '@/lib/expense-constants';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';

/**
 * MOT-273: one-tap quick-add categories on the empty state. Prefilling the
 * category + landing on the form (amount-only) cuts the friction between
 * "I see the value" and "I logged my first expense".
 */
const QUICK_ADD_CATEGORIES: ExpenseCategory[] = ['fuel', 'maintenance', 'insurance'];

export function ExpenseDashboardEmptyState({ motorcycleId }: { motorcycleId: string }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const ctaScale = useSharedValue(1);
  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: theme.bg,
      }}
    >
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
        <BarChart3 size={48} color={theme.ink3} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(200).duration(300)}>
        <Text
          accessibilityRole="header"
          style={{
            ...type.sheetTitle,
            color: theme.ink,
            marginTop: space.md,
            textAlign: 'center',
          }}
        >
          {t('expenses.empty')}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(280).duration(300)}>
        <Text
          style={{
            ...type.subhead,
            color: theme.ink2,
            marginTop: space.xs,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          {t('expenses.emptyStateSubtitle')}
        </Text>
      </Animated.View>
      {/* MOT-273: prefilled quick-add chips — one tap to an amount-only form. */}
      <Animated.View
        entering={FadeInUp.delay(320).duration(300)}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          marginTop: 20,
        }}
      >
        {QUICK_ADD_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => {
              triggerImpact(Haptics.ImpactFeedbackStyle.Light);
              trackEvent(AnalyticsEvent.EXPENSE_QUICK_ADD_TAPPED, { category: cat });
              router.push({
                pathname: GARAGE_ROUTE.ADD_EXPENSE,
                params: { motorcycleId, category: cat },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={t(`expenses.category_${cat}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              height: 38,
              borderRadius: 19,
              borderCurve: 'continuous',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: CATEGORY_COLORS[cat] ?? theme.warm,
              }}
            />
            <Plus size={13} color={theme.ink3} strokeWidth={2} />
            <Text style={{ ...type.label, fontSize: 14, color: theme.ink }}>
              {t(`expenses.category_${cat}`)}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(420).duration(300)} style={ctaAnimatedStyle}>
        <Pressable
          onPressIn={() => {
            ctaScale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
          }}
          onPressOut={() => {
            ctaScale.value = withSpring(1, { damping: 15, stiffness: 150 });
          }}
          onPress={() => {
            triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: GARAGE_ROUTE.ADD_EXPENSE,
              params: { motorcycleId },
            });
          }}
          accessibilityLabel={t('expenses.addFirstExpense')}
          accessibilityRole="button"
          style={{
            backgroundColor: theme.warm,
            paddingHorizontal: 32,
            height: 48,
            borderRadius: 24,
            borderCurve: 'continuous',
            marginTop: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ ...type.bodyStrong, color: theme.onWarm }}>
            {t('expenses.addFirstExpense')}
          </Text>
        </Pressable>
      </Animated.View>
      {/* Scan-a-receipt alternative to manual entry — carries bike context (U8) */}
      <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
        <ReceiptScanEntry
          motorcycleId={motorcycleId}
          surface={SCAN_ENTRY_SURFACE.EXPENSE_EMPTY}
          delay={480}
        />
      </View>
      <Animated.View entering={FadeIn.delay(560).duration(300)}>
        <Text
          style={{
            ...type.subhead,
            color: theme.ink3,
            marginTop: space.sm,
          }}
        >
          {t('expenses.emptyStateTip')}
        </Text>
      </Animated.View>
    </View>
  );
}
