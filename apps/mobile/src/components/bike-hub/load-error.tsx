import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import { HUB_TOUCH_TARGET } from './ui/tokens';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
  testID?: string;
  retryTestID?: string;
  /** Names what Retry reloads when a screen can show more than one of these. */
  retryAccessibilityLabel?: string;
}

/**
 * "Couldn't load … · Retry" for the legacy sections the interim segments reuse
 * (Expenses, Documents): one look, one Retry colour, and announced when it
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
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

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
        paddingHorizontal: 2,
      }}
    >
      <Text style={{ flex: 1, fontSize: 14, color: theme.ink2 }}>{message}</Text>
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
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}
