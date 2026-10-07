import { ChevronRight } from 'lucide-react-native';
import { hub } from './tokens';

/** Trailing chevron of a row that opens something. Decorative — the row carries the label. */
export function RowChevron({ color = hub.muted }: { color?: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2} />;
}
