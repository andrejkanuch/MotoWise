import { ChevronRight } from 'lucide-react-native';
import { useHubTheme } from './tokens';

/** Trailing chevron of a row that opens something. Decorative — the row carries the label. */
export function RowChevron({ color }: { color?: string }) {
  const hub = useHubTheme();
  return <ChevronRight size={18} color={color ?? hub.muted} strokeWidth={2} />;
}
