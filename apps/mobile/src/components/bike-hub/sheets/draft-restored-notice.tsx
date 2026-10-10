import { History } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SYSTEM_WEIGHT, type } from '@/theme/type';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_TOUCH_TARGET, useHubTheme } from '../ui/tokens';
import { SHEET_LOCKED_OPACITY } from './sheet-header';

const PRESSED_OPACITY = 0.6;
const ACTION_SLOP = 8;

interface DraftRestoredNoticeProps {
  /** "Restored what you were writing" / "Restored your reading". */
  message: string;
  /** What VoiceOver / TalkBack reads for Clear. */
  clearAccessibilityLabel: string;
  onClear: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * The quiet line a sheet shows when it reopened with work a native dismissal
 * left behind: a caption in stone grey and a copper "Clear" text action (DESIGN.md
 * caption + text action). Clear empties the form back to how it would have opened.
 */
export function DraftRestoredNotice({
  message,
  clearAccessibilityLabel,
  onClear,
  disabled = false,
  testID,
}: DraftRestoredNoticeProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <History size={14} color={hub.dim} strokeWidth={2} />
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={[type.label, SYSTEM_WEIGHT.regular, { flex: 1, color: hub.dim }]}
      >
        {message}
      </Text>
      <Pressable
        testID={testID ? `${testID}-clear` : undefined}
        onPress={onClear}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={clearAccessibilityLabel}
        accessibilityState={{ disabled }}
        hitSlop={{ top: ACTION_SLOP, bottom: ACTION_SLOP, left: ACTION_SLOP, right: ACTION_SLOP }}
        style={({ pressed }) => ({
          minHeight: HUB_TOUCH_TARGET - 2 * ACTION_SLOP,
          justifyContent: 'center',
          opacity: disabled ? SHEET_LOCKED_OPACITY : pressed ? PRESSED_OPACITY : 1,
        })}
      >
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: hub.copperText }]}
        >
          {t('bikeHub.sheetDraft.clear')}
        </Text>
      </Pressable>
    </View>
  );
}
