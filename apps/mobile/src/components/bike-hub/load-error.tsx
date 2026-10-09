import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { HUB_RADIUS, HUB_TOUCH_TARGET, SYSTEM_WEIGHT, useHubTheme } from './ui/tokens';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
  testID?: string;
  retryTestID?: string;
  /** Names what Retry reloads when a screen can show more than one of these. */
  retryAccessibilityLabel?: string;
}

/**
 * "Couldn't load … · Retry" for the sections the interim segments reuse
 * (Expenses, Documents), on the hub's card with the hub's copper text Retry —
 * the same look as the Overview's Costs error — and announced when it
 * appears — a live region on Android, an explicit announcement on iOS (which
 * has no live regions).
 */
export function LoadError({
  message,
  onRetry,
  testID,
  retryTestID,
  retryAccessibilityLabel,
}: LoadErrorProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (process.env.EXPO_OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 2,
        paddingLeft: 16,
        paddingRight: 8,
        backgroundColor: hub.card,
        borderWidth: 1,
        borderColor: hub.hairline,
        borderRadius: HUB_RADIUS.card,
        borderCurve: 'continuous',
      }}
    >
      <Text
        style={{ flex: 1, ...SYSTEM_WEIGHT.regular, fontSize: 14, lineHeight: 19, color: hub.dim }}
      >
        {message}
      </Text>
      <Pressable
        testID={retryTestID}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryAccessibilityLabel}
        style={({ pressed }) => ({
          minHeight: HUB_TOUCH_TARGET,
          justifyContent: 'center',
          paddingHorizontal: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 14, color: hub.copperText }}>
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}
