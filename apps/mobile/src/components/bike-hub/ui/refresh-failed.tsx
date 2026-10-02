import { withAlpha } from '@motovault/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, type LayoutRectangle, Pressable, Text, View } from 'react-native';
import { HUB_FONT, HUB_TOUCH_TARGET, type HubCopyKey, hub } from './tokens';

const SEPARATOR = ' · ';
const SEPARATOR_HIDDEN = withAlpha(hub.soon, 0);
const FONT_SIZE = 13;
const LINE_HEIGHT = 18;
/** Vertical slop that lifts the one-line Retry to a full touch target. */
const SLOP = Math.ceil((HUB_TOUCH_TARGET - LINE_HEIGHT) / 2);
const SLOP_LEFT = 8;
const SLOP_RIGHT = 12;

/**
 * One pull-to-refresh can fail several blocks at once; they share one
 * announcement. A line appearing within this window of the last one stays quiet.
 */
export const REFRESH_ANNOUNCE_WINDOW_MS = 2000;
let lastAnnouncedAt = Number.NEGATIVE_INFINITY;

/** Whether the line appearing now is the one that announces the failure. */
function claimAnnouncement(now: number): boolean {
  if (now - lastAnnouncedAt < REFRESH_ANNOUNCE_WINDOW_MS) return false;
  lastAnnouncedAt = now;
  return true;
}

/** Retry sits on a row below the message: the row has wrapped. */
function retryWrapped(message: LayoutRectangle, retry: LayoutRectangle): boolean {
  return retry.y >= message.y + message.height;
}

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
 * long translation at a large text size; the " · " then keeps its space (so
 * the row cannot flip back and forth) but is not drawn at the end of a line.
 * The failure is announced when the line appears — once for all the blocks a
 * refresh failed, not once per block (`announceForAccessibility`, on both
 * platforms).
 */
export function RefreshFailed({ block, onRetry, testID }: RefreshFailedProps) {
  const { t } = useTranslation();
  const message = t('bikeHub.refreshFailed');
  const [messageLayout, setMessageLayout] = useState<LayoutRectangle | null>(null);
  const [retryLayout, setRetryLayout] = useState<LayoutRectangle | null>(null);
  const wrapped = !!messageLayout && !!retryLayout && retryWrapped(messageLayout, retryLayout);

  useEffect(() => {
    if (claimAnnouncement(Date.now())) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Text
        onLayout={(event) => setMessageLayout(event.nativeEvent.layout)}
        style={{
          flexShrink: 1,
          fontFamily: HUB_FONT.sans,
          fontSize: FONT_SIZE,
          lineHeight: LINE_HEIGHT,
          color: hub.soon,
        }}
      >
        {message}
        {/* Nested Text takes no opacity: a clear colour keeps the space, hides the glyph. */}
        <Text style={{ color: wrapped ? SEPARATOR_HIDDEN : hub.soon }}>{SEPARATOR}</Text>
      </Text>
      <Pressable
        onLayout={(event) => setRetryLayout(event.nativeEvent.layout)}
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
