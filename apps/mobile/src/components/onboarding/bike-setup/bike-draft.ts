import type { BikeDraft } from '@/stores/onboarding.store';

/**
 * issue 365 T13b (FS-OB1c): the onboarding bike-setup search in progress lives in
 * the onboarding store's `bikeDraft`, so a relaunch reopens the step with the
 * picked make, the typed model and the year instead of the empty make list.
 *
 * Encoding: `makeId > 0` is a make picked from the list; `makeId === 0` is
 * "Other make" with the typed name in `make` (as `bikeData` stores a custom make);
 * `modelQuery` is the model search text, or the picked model's name.
 */

export interface PickedMake {
  makeId: number;
  makeName: string;
}

export interface BikeSetupStart {
  year: string;
  make: PickedMake | null;
  isCustomMake: boolean;
  customMakeName: string;
  model: { modelId: number; modelName: string } | null;
  modelQuery: string;
}

interface SavedBike {
  year?: number;
  make?: string;
  makeId?: number;
  model?: string;
}

const CUSTOM_MAKE_ID = 0;

/**
 * The step's starting state: the draft when there is one (the last search on
 * screen), otherwise the bike saved by an earlier Continue.
 */
export function bikeSetupStart(
  draft: BikeDraft | null,
  bike: SavedBike | null,
  defaultYear: number,
): BikeSetupStart {
  if (draft) {
    const picked = draft.makeId !== null && draft.makeId > 0 && !!draft.make;
    const custom = draft.makeId === CUSTOM_MAKE_ID;
    // A picked model comes back picked: Continue saves only a picked model, so
    // restoring it as search text would save the bike without its model.
    const modelPicked = (picked || custom) && !!draft.modelPicked && draft.modelQuery !== '';
    return {
      year: String(draft.year ?? defaultYear),
      make: picked ? { makeId: draft.makeId as number, makeName: draft.make as string } : null,
      isCustomMake: custom,
      customMakeName: custom ? (draft.make ?? '') : '',
      model: modelPicked ? { modelId: 0, modelName: draft.modelQuery } : null,
      modelQuery: picked || custom ? draft.modelQuery : '',
    };
  }
  return {
    year: bike?.year ? String(bike.year) : String(defaultYear),
    make: bike?.make && bike.makeId ? { makeId: bike.makeId, makeName: bike.make } : null,
    isCustomMake: false,
    customMakeName: '',
    model: bike?.model ? { modelId: 0, modelName: bike.model } : null,
    modelQuery: '',
  };
}

/** The draft for the step's current state; null while no make is picked. */
export function bikeDraftOf(state: {
  year: string;
  make: PickedMake | null;
  isCustomMake: boolean;
  customMakeName: string;
  modelName: string | null;
  modelQuery: string;
}): BikeDraft | null {
  if (!state.make && !state.isCustomMake) return null;
  const year = Number.parseInt(state.year, 10);
  return {
    makeId: state.isCustomMake ? CUSTOM_MAKE_ID : (state.make?.makeId ?? null),
    make: state.isCustomMake ? state.customMakeName : (state.make?.makeName ?? null),
    modelQuery: state.modelName ?? state.modelQuery,
    year: Number.isNaN(year) ? null : year,
    modelPicked: state.modelName !== null,
  };
}
