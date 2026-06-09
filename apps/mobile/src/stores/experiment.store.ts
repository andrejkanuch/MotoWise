import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ObVariant } from '../config/onboarding';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

/** How the variant was decided — `posthog` = flag evaluated, `fallback` = offline default. */
export type VariantSource = 'posthog' | 'fallback';

interface ExperimentState {
  /**
   * Resolved onboarding A/B variant. Assigned once at first launch and then
   * immutable for the lifetime of the install — it must NEVER re-roll
   * mid-flow, across resume-after-kill, or on sign-out (deliberately not
   * reset with the auth/onboarding stores).
   */
  onboardingVariant: ObVariant | null;
  assignedAt: string | null;
  source: VariantSource | null;
  assignVariant: (variant: ObVariant, source: VariantSource) => void;
  /** Test/dev only — production code must never un-assign a variant. */
  reset: () => void;
}

const initialState = {
  onboardingVariant: null as ObVariant | null,
  assignedAt: null as string | null,
  source: null as VariantSource | null,
};

export const useExperimentStore = create<ExperimentState>()(
  persist(
    (set, get, store) => ({
      ...initialState,
      assignVariant: (variant, source) => {
        // First write wins — assignment is sticky per install.
        if (get().onboardingVariant) return;
        set({ onboardingVariant: variant, source, assignedAt: new Date().toISOString() });
      },
      reset: () => set(store.getInitialState(), true),
    }),
    {
      name: 'experiment-state',
      version: 1,
      storage: createJSONStorage(() => createZustandMMKVStorage('experiment-store')),
      partialize: ({ assignVariant, reset, ...data }) => data,
    },
  ),
);
