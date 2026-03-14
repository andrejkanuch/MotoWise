import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type Step = 1 | 2 | 3 | 4;
export type NavigationDirection = 'forward' | 'backward';
export type InputMode = 'wizard' | 'freetext';
export type Urgency = 'stranded' | 'soon' | 'preventive';
export type WizardSubStep = 0 | 1 | 2;
export type WizardField = 'symptoms' | 'location' | 'timing';

export interface ManualBikeInfo {
  type: string;
  year?: number;
  make?: string;
  model?: string;
}

export interface WizardAnswers {
  symptoms: string[];
  location: string[];
  timing: string[];
}

export const PREDEFINED_SYMPTOMS = [
  'noise',
  'vibration',
  'leak',
  'smoke',
  'warningLight',
  'performanceIssue',
  'visualDamage',
  'smell',
  'grinding',
  'clicking',
  'backfiring',
  'squealing',
  'wobble',
  'hardToSteer',
  'spongyBrakes',
  'rustCorrosion',
  'discoloration',
  'wontStart',
  'stalling',
  'poorFuelEconomy',
  'overheating',
] as const;
export const PREDEFINED_LOCATION = [
  'engine',
  'brakes',
  'exhaust',
  'tires',
  'electrical',
  'suspension',
  'chainDrivetrain',
  'bodywork',
] as const;
export const PREDEFINED_TIMING = [
  'always',
  'atSpeed',
  'idle',
  'coldStart',
  'hotEngine',
  'braking',
  'acceleration',
  'turning',
] as const;

const PREDEFINED_OPTIONS: Record<WizardField, readonly string[]> = {
  symptoms: PREDEFINED_SYMPTOMS,
  location: PREDEFINED_LOCATION,
  timing: PREDEFINED_TIMING,
};

const MAX_CUSTOM_VALUES = 3;

interface DiagnosticFlowState {
  currentStep: Step;
  navigationDirection: NavigationDirection;
  editingFromReview: boolean;
  isTransitioning: boolean;

  selectedMotorcycleId: string | null;
  manualBikeInfo: ManualBikeInfo | null;
  showManualForm: boolean;

  inputMode: InputMode;
  wizardAnswers: WizardAnswers;
  wizardSubStep: WizardSubStep;
  freeTextDescription: string;

  photoUri: string | null;
  additionalNotes: string;
  urgency: Urgency | null;

  dataSharingOptedIn: boolean;
  isSubmitting: boolean;
  submitError: string | null;

  setStep: (step: Step) => void;
  goNext: () => void;
  goBack: () => void;
  goToStepFromReview: (step: Step) => void;
  backToReview: () => void;
  setSelectedMotorcycleId: (id: string | null) => void;
  setManualBikeInfo: (info: ManualBikeInfo | null) => void;
  setShowManualForm: (show: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setWizardAnswers: (answers: WizardAnswers) => void;
  setWizardSubStep: (step: WizardSubStep) => void;
  setFreeTextDescription: (text: string) => void;
  setPhotoUri: (uri: string | null) => void;
  setAdditionalNotes: (notes: string) => void;
  setUrgency: (urgency: Urgency | null) => void;
  setDataSharingOptedIn: (opted: boolean) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;
  setIsTransitioning: (transitioning: boolean) => void;
  toggleWizardOption: (field: WizardField, value: string) => void;
  addCustomValue: (field: WizardField, value: string) => boolean;
  removeCustomValue: (field: WizardField, value: string) => void;
  getProgress: () => number;
  reset: () => void;
  hasAnyData: () => boolean;
}

const initialState = {
  currentStep: 1 as Step,
  navigationDirection: 'forward' as NavigationDirection,
  editingFromReview: false,
  isTransitioning: false,
  selectedMotorcycleId: null as string | null,
  manualBikeInfo: null as ManualBikeInfo | null,
  showManualForm: false,
  inputMode: 'wizard' as InputMode,
  wizardAnswers: { symptoms: [], location: [], timing: [] } as WizardAnswers,
  wizardSubStep: 0 as WizardSubStep,
  freeTextDescription: '',
  photoUri: null as string | null,
  additionalNotes: '',
  urgency: null as Urgency | null,
  dataSharingOptedIn: false,
  isSubmitting: false,
  submitError: null as string | null,
};

export const useDiagnosticFlowStore = create<DiagnosticFlowState>()((set, get) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  goNext: () =>
    set((s) => {
      if (s.isTransitioning || s.isSubmitting) return s;
      const next = Math.min(s.currentStep + 1, 4) as Step;
      return {
        currentStep: next,
        navigationDirection: 'forward',
        editingFromReview: false,
        isTransitioning: true,
      };
    }),

  goBack: () =>
    set((s) => {
      if (s.isTransitioning || s.isSubmitting) return s;
      const prev = Math.max(s.currentStep - 1, 1) as Step;
      return { currentStep: prev, navigationDirection: 'backward', isTransitioning: true };
    }),

  goToStepFromReview: (step) =>
    set({ currentStep: step, navigationDirection: 'backward', editingFromReview: true }),

  backToReview: () =>
    set({ currentStep: 4, navigationDirection: 'forward', editingFromReview: false }),

  setSelectedMotorcycleId: (id) => set({ selectedMotorcycleId: id, manualBikeInfo: null }),
  setManualBikeInfo: (info) => set({ manualBikeInfo: info, selectedMotorcycleId: null }),
  setShowManualForm: (show) => set({ showManualForm: show }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setWizardAnswers: (answers) => set({ wizardAnswers: answers }),
  setWizardSubStep: (step) => set({ wizardSubStep: step }),
  setFreeTextDescription: (text) => set({ freeTextDescription: text }),
  setPhotoUri: (uri) => set({ photoUri: uri }),
  setAdditionalNotes: (notes) => set({ additionalNotes: notes }),
  setUrgency: (urgency) => set({ urgency: urgency }),
  setDataSharingOptedIn: (opted) => set({ dataSharingOptedIn: opted }),
  setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),
  setSubmitError: (error) => set({ submitError: error }),
  setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

  toggleWizardOption: (field, value) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    set((s) => {
      const current = [...s.wizardAnswers[field]];
      const isDontKnow = value === 'dont_know';
      const alreadySelected = current.includes(value);

      if (alreadySelected) {
        return {
          wizardAnswers: {
            ...s.wizardAnswers,
            [field]: current.filter((v) => v !== value),
          },
        };
      }

      if (isDontKnow) {
        return {
          wizardAnswers: {
            ...s.wizardAnswers,
            [field]: ['dont_know'],
          },
        };
      }

      return {
        wizardAnswers: {
          ...s.wizardAnswers,
          [field]: [...current.filter((v) => v !== 'dont_know'), value],
        },
      };
    });
  },

  addCustomValue: (field, value) => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;

    const s = get();
    const current = s.wizardAnswers[field];
    const predefined = PREDEFINED_OPTIONS[field];

    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate =
      current.some((v) => v.toLowerCase() === lowerTrimmed) ||
      predefined.some((v) => v.toLowerCase() === lowerTrimmed);
    if (isDuplicate) return false;

    const customCount = current.filter(
      (v) => v !== 'dont_know' && !(predefined as readonly string[]).includes(v),
    ).length;
    if (customCount >= MAX_CUSTOM_VALUES) return false;

    set({
      wizardAnswers: {
        ...s.wizardAnswers,
        [field]: [...current.filter((v) => v !== 'dont_know'), trimmed],
      },
    });
    return true;
  },

  removeCustomValue: (field, value) => {
    set((s) => ({
      wizardAnswers: {
        ...s.wizardAnswers,
        [field]: s.wizardAnswers[field].filter((v) => v !== value),
      },
    }));
  },

  getProgress: () => {
    const s = get();
    const totalSteps = 4;
    const subStepsPerWizardStep = 3;
    if (s.currentStep === 2 && s.inputMode === 'wizard') {
      return (1 + s.wizardSubStep / subStepsPerWizardStep) / totalSteps;
    }
    return s.currentStep / totalSteps;
  },

  reset: () => set({ ...initialState }),

  hasAnyData: () => {
    const s = get();
    return !!(
      s.selectedMotorcycleId ||
      s.manualBikeInfo ||
      s.freeTextDescription.trim() ||
      s.photoUri ||
      s.additionalNotes.trim() ||
      s.urgency ||
      s.wizardAnswers.symptoms.length > 0 ||
      s.wizardAnswers.location.length > 0 ||
      s.wizardAnswers.timing.length > 0
    );
  },
}));
