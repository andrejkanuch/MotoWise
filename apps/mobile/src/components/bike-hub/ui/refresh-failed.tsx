import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { HUB_FONT, HUB_TOUCH_TARGET, type HubCopyKey, hub } from './tokens';

const SEPARATOR = ' · ';
const FONT_SIZE = 13;
const LINE_HEIGHT = 18;
/** Vertical slop that lifts the one-line Retry to a full touch target. */
const SLOP = Math.ceil((HUB_TOUCH_TARGET - LINE_HEIGHT) / 2);
const SLOP_LEFT = 8;
const SLOP_RIGHT = 12;

/** The Overview blocks that can show "Couldn't refresh". */
export const REFRESH_BLOCK = {
  ATTENTION: 'attention',
  COSTS: 'costs',
  NOTES: 'notes',
} as const;
export type RefreshBlock = (typeof REFRESH_BLOCK)[keyof typeof REFRESH_BLOCK];

/** Each block's Retry gets its own label, so a screen reader can tell them apart. */
const RETRY_A11Y_KEY: Record<RefreshBlock, HubCopyKey> = {
  [REFRESH_BLOCK.ATTENTION]: 'bikeHub.refreshRetryA11y.attention',
  [REFRESH_BLOCK.COSTS]: 'bikeHub.refreshRetryA11y.costs',
  [REFRESH_BLOCK.NOTES]: 'bikeHub.refreshRetryA11y.notes',
};

interface RefreshFailedProps {
  block: RefreshBlock;
  onRetry: () => void;
  testID?: string;
}

/**
 * "Couldn't refresh · Retry": shown inside a block that still has its last
 * loaded data but whose latest refetch failed — the data stays, and the rider
 * learns it may be out of date.
 *
 * The row wraps, so Retry moves to the next line instead of off-screen with a
 * long translation at a large text size. The line is announced when it
 * appears: a live region on Android, an explicit announcement on iOS (which
 * has no live regions).
 */
export function RefreshFailed({ block, onRetry, testID }: RefreshFailedProps) {
  const { t } = useTranslation();
  const message = t('bikeHub.refreshFailed');

  useEffect(() => {
    if (process.env.EXPO_OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Text
        style={{
          flexShrink: 1,
          fontFamily: HUB_FONT.sans,
          fontSize: FONT_SIZE,
          lineHeight: LINE_HEIGHT,
          color: hub.soon,
        }}
      >
        {message}
        {SEPARATOR}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t(RETRY_A11Y_KEY[block])}
        hitSlop={{ top: SLOP, bottom: SLOP, left: SLOP_LEFT, right: SLOP_RIGHT }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          style={{
            fontFamily: HUB_FONT.sansSemiBold,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            color: hub.copperText,
          }}
        >
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}
