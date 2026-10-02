import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { HUB_FONT, HUB_TOUCH_TARGET, hub } from './tokens';

const SEPARATOR = ' · ';
const SLOP = Math.ceil((HUB_TOUCH_TARGET - 18) / 2);

interface RefreshFailedProps {
  onRetry: () => void;
  testID?: string;
}

/**
 * "Couldn't refresh · Retry": shown inside a block that still has its last
 * loaded data but whose latest refetch failed — the data stays, and the rider
 * learns it may be out of date.
 */
export function RefreshFailed({ onRetry, testID }: RefreshFailedProps) {
  const { t } = useTranslation();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}
    >
      <Text style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 18, color: hub.soon }}>
        {t('bikeHub.refreshFailed')}
        {SEPARATOR}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        hitSlop={{ top: SLOP, bottom: SLOP, left: 8, right: 12 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          style={{
            fontFamily: HUB_FONT.sansSemiBold,
            fontSize: 13,
            lineHeight: 18,
            color: hub.copperText,
          }}
        >
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}
