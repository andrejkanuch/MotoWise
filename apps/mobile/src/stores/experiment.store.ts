import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ObVariant } from '../config/onboarding';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

/**
 * How the variant was decided.
 *
 * `shipped` is the only source new installs produce, as of the 2026-08-24
 * experiment retirement — one flow ships, so there is nothing to evaluate and
 * nothing to fall back from.
 *
 * `posthog` and `fallback` are RETIRED but must stay in the union: ~423 installs
 * have one of them persisted in MMKV, and narrowing the type would make those
 * stored records fail to parse.
 */
export type VariantSource = 'shipped' | 'posthog' | 'fallback' | 'override';

interface ExperimentState {
  /**
   * Resolved onboarding variant. Assigned once at first launch and then
   * immutable for the lifetime of the install — it must NEVER re-roll
   * mid-flow, across resume-after-kill, or on sign-out (deliberately not
   * reset with the auth/onboarding stores).
   *
   * Post-retirement this is `shipped` for new installs and one of the three
   * legacy experiment values for existing ones. All four resolve to the same
   * flow; the stored value is kept purely as cohort history.
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
