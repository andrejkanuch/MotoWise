import { Compass, WifiOff } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useEditorialTheme } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '../../theme/type';

const SKELETON_CARDS = 3;
const SKELETON_IMAGE_HEIGHT = 140;

/** Placeholder cards while the first ride list loads (FS-PO7, issue 365). */
export const DiscoverListSkeleton = memo(function DiscoverListSkeleton() {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  return (
    <View
      testID="discover-skeleton"
      accessible
      accessibilityLabel={i18n('discoverFilters.loadingRoutes')}
      style={{ gap: space.sm, paddingTop: space.xxs }}
    >
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders, never reordered.
          key={i}
          style={{
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <View style={{ height: SKELETON_IMAGE_HEIGHT, backgroundColor: t.bg2 }} />
          <View style={{ padding: space.sm, gap: space.xs }}>
            <View
              style={{
                height: 14,
                width: '70%',
                borderRadius: radius.chip,
                backgroundColor: t.line,
              }}
            />
            <View
              style={{
                height: 10,
                width: '40%',
                borderRadius: radius.chip,
                backgroundColor: t.line,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
});

/** The ride list failed or is still loading at the deadline: say so and offer Retry. */
export const DiscoverLoadError = memo(function DiscoverLoadError({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(200)}
      style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.xs }}
    >
      <WifiOff size={28} color={t.ink3} />
      <Text style={[type.bodyStrong, { color: t.ink, textAlign: 'center' }]}>
        {i18n('discoverFilters.loadErrorTitle')}
      </Text>
      <Text style={[type.caption, { color: t.ink2, textAlign: 'center' }]}>
        {i18n('discoverFilters.loadErrorBody')}
      </Text>
      <Pressable
        testID="discover-retry"
        onPress={onRetry}
        accessibilityRole="button"
        style={{
          marginTop: space.xs,
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: t.warm,
        }}
      >
        <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: t.onWarm }]}>
          {i18n('discoverFilters.retry')}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

/** The list settled empty: nothing matches the active filters. */
export const DiscoverNoRoutes = memo(function DiscoverNoRoutes({
  onClear,
}: {
  onClear: () => void;
}) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300)}
      style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.xs }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderCurve: 'continuous',
          backgroundColor: t.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Compass size={30} color={t.ink3} />
      </View>
      <Text style={{ ...type.bodyStrong, color: t.ink, textAlign: 'center' }}>
        {i18n('discoverFilters.noRoutesMatch')}
      </Text>
      <Pressable
        onPress={onClear}
        style={{
          marginTop: space.xs,
          paddingHorizontal: space.sm,
          paddingVertical: space.xs,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.line,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: t.ink }}>
          {i18n('discoverFilters.clearFilters')}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
