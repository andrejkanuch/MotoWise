import { useState } from 'react';
import { useMotorcycleMakes } from './use-motorcycle-makes';
import { useMotorcycleModels } from './use-motorcycle-models';

/** A model year as the bike sheets accept it: four digits, 1900 to next year. */
export const BIKE_YEAR = {
  LENGTH: 4,
  MIN: 1900,
} as const;

export interface BikeMake {
  makeId: number;
  makeName: string;
}

export interface BikeModel {
  modelId: number;
  modelName: string;
}

/** Keeps only digits, at most four of them. */
export function sanitizeBikeYear(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, BIKE_YEAR.LENGTH);
}

/** Four digits between 1900 and next year (next year's models ship this autumn). */
export function isValidBikeYear(year: string, now: Date = new Date()): boolean {
  const yearNum = Number.parseInt(year, 10);
  return (
    year.length === BIKE_YEAR.LENGTH && yearNum >= BIKE_YEAR.MIN && yearNum <= now.getFullYear() + 1
  );
}

/**
 * The make / model typeahead state the Add a Bike and Edit Motorcycle sheets
 * share: the NHTSA make list, the models for the chosen make and year, and the
 * reset rules between them.
 *
 * - The model unlocks once there is a make (NHTSA or custom) and a valid year.
 * - A new make, or a new year (`resetModel`), clears the chosen model.
 * - A custom make (typed text NHTSA does not list) skips the models query; its
 *   model is free text. Edit Motorcycle never sets one: a saved make NHTSA does
 *   not list stays the bike's own value until the rider picks another.
 */
export function useBikePicker(year: string) {
  const [selectedMake, setSelectedMake] = useState<BikeMake | null>(null);
  const [selectedModel, setSelectedModel] = useState<BikeModel | null>(null);
  const [makeSearch, setMakeSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');

  const yearNum = Number.parseInt(year, 10);
  const validYear = isValidBikeYear(year);
  const modelsMakeId = selectedMake && validYear && !customMake ? selectedMake.makeId : 0;

  const makes = useMotorcycleMakes(makeSearch);
  const models = useMotorcycleModels(modelsMakeId, validYear ? yearNum : 0, modelSearch);

  const clearModel = () => {
    setSelectedModel(null);
    setModelSearch('');
  };

  return {
    yearNum,
    validYear,
    /** A make (NHTSA or custom) and a valid year: the model row can be used. */
    modelUnlocked: (!!selectedMake || !!customMake) && validYear,
    selectedMake,
    selectedModel,
    makeSearch,
    modelSearch,
    customMake,
    customModel,
    /** What the rider chose, custom text first; empty when nothing is chosen yet. */
    makeName: customMake || selectedMake?.makeName || '',
    modelName: customModel || selectedModel?.modelName || '',
    makes: { all: makes.makes, filtered: makes.filteredMakes, isLoading: makes.isLoading },
    models: { all: models.models, filtered: models.filteredModels, isLoading: models.isLoading },

    /** The year changed: the chosen model belonged to the old one. */
    resetModel: clearModel,
    setMakeSearch,
    /** Seed from a saved bike (Edit): no reset of anything else. */
    setSelectedMake,
    setSelectedModel,

    selectMake: (make: BikeMake) => {
      setSelectedMake(make);
      setMakeSearch('');
      clearModel();
    },
    /** Reopen the search on the chosen NHTSA make. */
    reopenMake: () => {
      if (!selectedMake) return;
      setMakeSearch(selectedMake.makeName);
      setSelectedMake(null);
      clearModel();
    },
    /** Keep the typed search as a custom make. */
    chooseTypedMake: () => {
      setCustomMake(makeSearch);
      setSelectedMake(null);
      setMakeSearch('');
      clearModel();
      setCustomModel('');
    },
    /** Reopen the search on the custom make. */
    reopenCustomMake: () => {
      setMakeSearch(customMake);
      setCustomMake('');
      clearModel();
      setCustomModel('');
    },

    selectModel: (model: BikeModel) => {
      setSelectedModel(model);
      setModelSearch('');
    },
    /** Typing in the NHTSA model search drops any choice. */
    searchModel: (text: string) => {
      setModelSearch(text);
      setSelectedModel(null);
      setCustomModel('');
    },
    reopenModel: () => {
      if (!selectedModel) return;
      setModelSearch(selectedModel.modelName);
      setSelectedModel(null);
    },
    /** Keep the typed search as a custom model. */
    chooseTypedModel: () => {
      setCustomModel(modelSearch);
      setSelectedModel(null);
      setModelSearch('');
    },
    reopenCustomModel: () => {
      setModelSearch(customModel);
      setCustomModel('');
      setSelectedModel(null);
    },
    /** A custom make's model is free text, kept as typed. */
    typeCustomModel: (text: string) => {
      setModelSearch(text);
      setCustomModel(text);
    },
    /** Leaving the custom model field settles the typed text as the value. */
    commitCustomModel: () => {
      const typed = modelSearch.trim();
      if (!typed) return;
      setCustomModel(typed);
      setModelSearch('');
    },
  };
}

export type BikePicker = ReturnType<typeof useBikePicker>;
