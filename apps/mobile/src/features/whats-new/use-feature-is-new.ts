import * as Application from 'expo-application';
import type { WhatsNewFeature } from '@/data/whats-new-releases';
import { releaseForVersion, selectPages } from '@/lib/whats-new';
import { useWhatsNewStore } from '@/stores/whats-new.store';

/**
 * The features the installed build's What's New can present: its release's own
 * features plus the catch-up ones, before anything the rider has been shown or
 * used is taken out.
 */
function latestFeatureSet(): readonly WhatsNewFeature[] {
  const release = releaseForVersion(Application.nativeApplicationVersion);
  if (!release) return [];
  return selectPages(release, { seenFeatures: [], usedFeatures: [] }).map((page) => page.feature);
}

/**
 * Whether `feature` gets the NEW chip on its entry rows: it is in the latest
 * release's What's New set and the rider has not used it on this device. Being
 * shown in the carousel does not clear it, and riders held out of the carousel
 * still see it.
 */
export function useFeatureIsNew(feature: WhatsNewFeature): boolean {
  const used = useWhatsNewStore((state) => state.usedFeatures.includes(feature));
  return !used && latestFeatureSet().includes(feature);
}
