import { Pressable, Text, View } from 'react-native';
import type { DueTone } from '../../../lib/bike-hub/constants';
import { triggerImpact } from '../../../utils/haptics';
import { DUE_TONE_COLOR, HUB_FONT, HUB_TOUCH_TARGET, hub } from './tokens';

const EYEBROW_SIZE = 11;
const ACTION_LINE_HEIGHT = 18;
// Vertical slop that grows the one-line text action to a full touch target.
const ACTION_SLOP = Math.ceil((HUB_TOUCH_TARGET - ACTION_LINE_HEIGHT) / 2);

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface SectionHeaderProps {
  label: string;
  /** Appended to the label as "Label · 6". */
  count?: number;
  /** Colours the eyebrow (e.g. the Overdue group in R2). Muted by default. */
  tone?: DueTone;
  /** Copper text action on the right. */
  action?: SectionHeaderAction;
  /** Grey rule-of-sorting hint on the right, when there is no action. */
  hint?: string;
}

/**
 * The one section header of the bike hub: a mono uppercase eyebrow with an
 * optional count, and either a copper text action or a grey hint on the right.
 * No serif section titles (DESIGN-SPEC §2).
 */
export function SectionHeader({ label, count, tone, action, hint }: SectionHeaderProps) {
  const eyebrow = count === undefined ? label : `${label} · ${count}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: 4,
        paddingHorizontal: 2,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flexShrink: 1,
          fontFamily: HUB_FONT.mono,
          fontSize: EYEBROW_SIZE,
          letterSpacing: EYEBROW_SIZE * 0.08,
          textTransform: 'uppercase',
          color: tone ? DUE_TONE_COLOR[tone] : hub.muted,
        }}
      >
        {eyebrow}
      </Text>
      {action ? (
        <Pressable
          onPress={() => {
            triggerImpact();
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={{ top: ACTION_SLOP, bottom: ACTION_SLOP, left: 12, right: 12 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontFamily: HUB_FONT.sansSemiBold,
              fontSize: 13,
              lineHeight: ACTION_LINE_HEIGHT,
              color: hub.copperText,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
      {!action && hint ? (
        <Text style={{ fontFamily: HUB_FONT.sans, fontSize: 12, color: hub.muted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
