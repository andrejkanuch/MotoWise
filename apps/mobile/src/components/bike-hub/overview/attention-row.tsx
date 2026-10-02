import type { ReactNode } from 'react';
import { HubCard } from '../ui/hub-card';
import { RowBody, type RowIcon } from '../ui/list-row';

interface AttentionRowProps {
  icon?: RowIcon;
  title: string;
  sub?: ReactNode;
  /** A tag; the default chevron when omitted. */
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

/**
 * One row of "Needs attention" / "Next up": a card that is a single pressable
 * (no pressable inside it) — icon tile, title, sub-line, trailing tag or chevron.
 */
export function AttentionRow({ onPress, accessibilityLabel, testID, ...body }: AttentionRowProps) {
  return (
    <HubCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingLeft: 14,
        paddingRight: 12,
      }}
    >
      <RowBody {...body} />
    </HubCard>
  );
}
