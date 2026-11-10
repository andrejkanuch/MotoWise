import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { WhatsNewFeature } from '../data/whats-new-releases';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

/** The rider's holdout arm, recorded only when PostHog assigned one. */
export interface WhatsNewHoldout {
  experimentKey: string;
  arm: string;
}

interface WhatsNewPersisted {
  /** The release the rider last saw (or was marked as having seen). */
  lastSeenVersion: string | null;
  /** Features already shown to the rider in a carousel. */
  seenFeatures: WhatsNewFeature[];
  /** Features the rider opened from a What's New page. */
  triedFeatures: WhatsNewFeature[];
  /** Features the rider used on this device, from any entry. */
  usedFeatures: WhatsNewFeature[];
  holdout: WhatsNewHoldout | null;
}

interface WhatsNewState extends WhatsNewPersisted {
  /** In memory only: a What's New visit is open, so feature screens show the way back. */
  returnSessionOpen: boolean;
  markReleaseSeen: (version: string, features: readonly WhatsNewFeature[]) => void;
  markTried: (feature: WhatsNewFeature) => void;
  markUsed: (feature: WhatsNewFeature) => void;
  /** Sticky per experiment: the first arm recorded for an experiment key wins. */
  setHoldoutArm: (experimentKey: string, arm: string) => void;
  setReturnSessionOpen: (open: boolean) => void;
}

const STORE_VERSION = 1;

const initialPersisted: WhatsNewPersisted = {
  lastSeenVersion: null,
  seenFeatures: [],
  triedFeatures: [],
  usedFeatures: [],
  holdout: null,
};

function withFeatures(
  list: readonly WhatsNewFeature[],
  added: readonly WhatsNewFeature[],
): WhatsNewFeature[] {
  return [...new Set([...list, ...added])];
}

/**
 * Version 0 stored only `lastSeenVersion`. Keeping it is what stops every
 * existing rider from being owed every release again after the update.
 */
export function migrateWhatsNewState(persisted: unknown, version: number): WhatsNewPersisted {
  const previous = (persisted ?? {}) as Partial<WhatsNewPersisted>;
  if (version >= STORE_VERSION) return { ...initialPersisted, ...previous };
  return {
    ...initialPersisted,
    lastSeenVersion: typeof previous.lastSeenVersion === 'string' ? previous.lastSeenVersion : null,
  };
}

export const useWhatsNewStore = create<WhatsNewState>()(
  persist(
    (set, get) => ({
      ...initialPersisted,
      returnSessionOpen: false,
      markReleaseSeen: (version, features) =>
        set({
          lastSeenVersion: version,
          seenFeatures: withFeatures(get().seenFeatures, features),
        }),
      markTried: (feature) => set({ triedFeatures: withFeatures(get().triedFeatures, [feature]) }),
      markUsed: (feature) => set({ usedFeatures: withFeatures(get().usedFeatures, [feature]) }),
      setHoldoutArm: (experimentKey, arm) => {
        if (get().holdout?.experimentKey === experimentKey) return;
        set({ holdout: { experimentKey, arm } });
      },
      setReturnSessionOpen: (returnSessionOpen) => set({ returnSessionOpen }),
    }),
    {
      // Same name and MMKV id as version 0, so riders keep their last-seen release.
      name: 'whats-new',
      version: STORE_VERSION,
      storage: createJSONStorage(() => createZustandMMKVStorage('whats-new')),
      migrate: migrateWhatsNewState,
      partialize: ({ lastSeenVersion, seenFeatures, triedFeatures, usedFeatures, holdout }) => ({
        lastSeenVersion,
        seenFeatures,
        triedFeatures,
        usedFeatures,
        holdout,
      }),
    },
  ),
);
