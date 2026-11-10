import { NewChip } from '@/components/ui/new-chip';
import type { WhatsNewFeature } from '@/data/whats-new-releases';
import { useFeatureIsNew } from './use-feature-is-new';

/** Test id of a feature's NEW chip, wherever its entry row draws it. */
export const featureNewChipTestId = (feature: WhatsNewFeature) => `new-chip-${feature}`;

/** The NEW chip for `feature`'s entry row, drawn only while the feature counts as new. */
export function FeatureNewChip({ feature }: { feature: WhatsNewFeature }) {
  return useFeatureIsNew(feature) ? <NewChip testID={featureNewChipTestId(feature)} /> : null;
}
