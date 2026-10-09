import type { ReactNode } from 'react';
import { ListRow } from '../ui/list-row';

interface AttentionRowProps {
  title: string;
  sub?: ReactNode;
  /** A tag; the default chevron when omitted. */
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** Hairline under the row — off for the last row of the group. */
  divider?: boolean;
  testID?: string;
}

/**
 * One row of "Needs attention" / "Next up": a native inset row inside one
 * grouped `HubCard` — title, sub-line, trailing tag or chevron. No icon tile:
 * the tag (graphite or the plate-state triad) carries priority and status.
 */
export function AttentionRow({ divider = false, ...props }: AttentionRowProps) {
  return <ListRow divider={divider} {...props} />;
}
