import { View } from 'react-native';

/**
 * Overview segment. Plan Task 5.7 composes it (photo band → ride status →
 * attention → next up → costs → notes → papers & bike); until then the segment
 * is an empty panel so the shell can be built and tested around it.
 */
export function OverviewSegment() {
  return <View testID="overview-segment" style={{ minHeight: 1 }} />;
}
