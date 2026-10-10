import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { triggerImpact } from '@/utils/haptics';
import { RowChevron } from './row-chevron';
import { HUB_RADIUS, HUB_ROW_SUB_LINES, SYSTEM_WEIGHT, useHubTheme } from './tokens';

const TILE_SIZE = 36;

export interface RowIcon {
  icon: LucideIcon;
  color: string;
  background: string;
}

interface RowBodyProps {
  icon?: RowIcon;
  title: string;
  /** Second line: a string (dim) or pre-styled nested `Text` parts. */
  sub?: ReactNode;
  /** Right edge: a tag, or the default chevron when omitted. `null` renders nothing. */
  trailing?: ReactNode;
  busy?: boolean;
}

/** Icon tile · title + sub-line · trailing. The content of every hub row. */
export function RowBody({ icon, title, sub, trailing, busy = false }: RowBodyProps) {
  const hub = useHubTheme();
  const Icon = icon?.icon;
  return (
    <>
      {icon && Icon ? (
        <View
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            borderRadius: HUB_RADIUS.tile,
            borderCurve: 'continuous',
            backgroundColor: icon.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={icon.color} />
          ) : (
            <Icon size={18} color={icon.color} strokeWidth={2} />
          )}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={{
            ...SYSTEM_WEIGHT.semibold,
            fontSize: 15,
            lineHeight: 18,
            color: hub.text,
          }}
        >
          {title}
        </Text>
        {typeof sub === 'string' ? (
          <Text
            numberOfLines={HUB_ROW_SUB_LINES}
            style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 16, color: hub.dim }}
          >
            {sub}
          </Text>
        ) : (
          sub
        )}
      </View>
      {trailing === undefined ? <RowChevron /> : trailing}
    </>
  );
}

interface ListRowProps extends RowBodyProps {
  onPress: () => void;
  accessibilityLabel?: string;
  /** Hairline under the row — off for the last row of a card. */
  divider?: boolean;
  testID?: string;
}

/** A pressable row inside a `HubCard` that holds several rows. */
export function ListRow({
  onPress,
  accessibilityLabel,
  divider = true,
  testID,
  ...body
}: ListRowProps) {
  const hub = useHubTheme();
  return (
    <Pressable
      testID={testID}
      disabled={body.busy}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: !!body.busy }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingLeft: 14,
        paddingRight: 12,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: hub.hairline,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <RowBody {...body} />
    </Pressable>
  );
}
